# Silicon City — Agent Review

> **Purpose of this document:** Complete architectural reference for any agent continuing development. Read this before touching any file.

---

## 1. What It Is

**Silicon City** is a React + Three.js interactive 3D file-system visualiser. The user types shell-like commands in a terminal sidebar and watches a miniature isometric city update in real time:

- `touch file.js` → a construction worker pops up, smoke puffs, then a colour-coded skyscraper rises.
- `mkdir mydir` → same worker animation, then a Roman triumphal arch (the "gate") appears.
- `rm file` → demolition dust cloud.
- `cd mydir` → the city zooms into the gate portal, buildings scale out, the camera transitions to a new city representing the subdirectory.
- `mv`, `cp`, `cat`, `ls`, `pwd`, `tree` are all supported.

Clicking a building prints its metadata in the terminal. Clicking a gate navigates into that directory. The sidebar shows a live file tree and terminal simultaneously.

---

## 2. Stack

| Concern | Library / Tool |
|---|---|
| Framework | React 19 (Vite) |
| 3D rendering | Three.js `^0.183` via `@react-three/fiber ^9` |
| 3D helpers | `@react-three/drei ^10` |
| Animation (transition) | GSAP `^3.15` (building scale-out timeline) |
| Animation (3D) | `useFrame` per-frame loops in R3F |
| State management | Zustand `^5` |
| Physics (installed, unused) | `@react-three/rapier` |

**Dev server:** `npm run dev` (Vite HMR). All changes hot-reload.

---

## 3. Project Structure

```
src/
├── App.jsx                  # Root layout: sidebar + 3D view
├── App.css                  # All CSS (sidebar, terminal, animations)
├── main.jsx                 # React DOM root
│
├── store/
│   ├── vfsStore.js          # Virtual filesystem (Zustand) — THE source of truth
│   └── playerStore.js       # Player position + cd-transition camera overrides
│
├── engine/
│   └── gridLayout.js        # City grid math: lot positions, wall constants
│
└── components/
    ├── CityScene.jsx         # R3F Canvas + City orchestrator (cd animation, builder spawning)
    ├── CameraController.jsx  # Follows player; zooms into gate during cd transition
    ├── Player.jsx            # WASD voxel player with walk bob
    ├── Building.jsx          # File → coloured skyscraper (size/ext driven)
    ├── Gate.jsx              # Directory → Roman arch (deterministic variety)
    ├── EntranceGate.jsx      # Imperial arch at city entrance (always visible; cd '..')
    ├── PortalScene.jsx       # Night-city silhouette rendered inside every arch
    ├── Builder.jsx           # Construction worker + smoke puffs (mkdir/touch feedback)
    ├── DustCloud.jsx         # Demolition particle burst (rm feedback)
    ├── CityBoundary.jsx      # Walls, fountain, park lots, street lamps, trees
    ├── PlotGrid.jsx          # 12 raised lot slabs where buildings stand
    ├── Ground.jsx            # Single 60×60 asphalt base mesh
    ├── TerminalHUD.jsx       # Terminal input/output, command parser, Tab autocomplete
    ├── FileTreePanel.jsx     # Recursive live file tree in the sidebar
    └── Breadcrumb.jsx        # (Legacy — path display now lives in App.jsx header)
```

---

## 4. State Layer

### 4.1 `vfsStore.js` — Virtual Filesystem

The entire filesystem is a single mutable tree object in Zustand. **All city renders derive from it.**

```js
tree: {
  name: '/', type: 'dir',
  children: [
    { name: 'src', type: 'dir', children: [...] },
    { name: 'index.js', type: 'file', ext: 'js', size: 4096 },
  ]
}
cwd: '/src'   // current working directory path string
```

**Actions (all mutate `tree` and/or `cwd`):**

| Action | Signature | Notes |
|---|---|---|
| `mkdir` | `(name)` | Adds `{name, type:'dir', children:[]}` to cwd |
| `touch` | `(name, sizeBytes?)` | Adds file leaf; `ext` extracted from name |
| `cd` | `(target)` | `'..'`, absolute, or relative name; validates node exists |
| `rm` | `(name)` | Removes child from cwd |
| `mv` | `(src, dest)` | Rename within cwd; updates `ext` |
| `cp` | `(src, dest)` | Shallow copy; dirs copy as empty |
| `ls` | `()` → array | Returns `{name, type, size, ext}[]` for cwd children |
| `getCwdNode` | `()` → node | Returns live node object for cwd |
| `tree` (getter) | — | The root node (triggers re-renders on mutation) |

**Important pattern:** Mutations call `set(state => { /* mutate directly */ return { tree: { ...state.tree } } })` — the spread creates a new reference to trigger React re-renders, while the inner children arrays are mutated in-place for simplicity.

### 4.2 `playerStore.js` — Player & Camera State

```js
x, z             // player world position (updated every frame by Player.jsx)
pendingTeleport  // {x, z} | null — consumed by Player.jsx useFrame
cdTarget         // {x, z} | null — gate position during cd transition; drives camera pan
cdZoom           // number | null — overrides camera zoom during cd transition
```

**Actions:**
- `setPosition(x, z)` — called every frame by Player
- `teleportTo(x, z)` — sets `pendingTeleport`; Player consumes and clears it
- `clearTeleport()` — called by Player after consuming teleport
- `setCdTarget(x, z, zoom=52)` — called by Gate/EntranceGate on click; starts camera zoom
- `clearCdTarget()` — called by CityScene `finish()` after transition completes

---

## 5. Grid Layout Engine (`engine/gridLayout.js`)

The city is a **60×60 world-unit** square. All coordinates are centred at origin `(0, 0)`.

```
CITY_HALF = 30      // walls at ±30 in both x and z
CELL      = 12      // lot spacing centre-to-centre
LOT_SIZE  = 8       // lot footprint
ROAD_W    = 4       // road width (CELL − LOT_SIZE)
WALL_H    = 4.2     // perimeter wall height
GATE_SPAN = 6.0     // total width of each gate opening (opening 3 + pillar 1.5 each side)
```

**Lot grid (top view, z positive = "top" of screen):**
```
Columns x: −21, −9, +9, +21
Rows    z: +21, +9, −9, −21

Park lots (never buildings): (±9, ±9) — fountain fills (0, 0) between them
File slots: remaining 12 outer-ring positions (exported as FILE_SLOTS)
Dir slots:  back wall at z=−30, x=−21, −9, +9, +21 (exported as DIR_SLOTS)
Entrance:   front wall at z=+30, x=0 (ENTRANCE_POS)
```

**`cityLayout(children)`** takes the cwd's children array and returns `{fileSlots, dirSlots}` — arrays of `{x, z, node}` where `node` is the VFS node (or `null` for empty slots).

---

## 6. `CityScene.jsx` — Orchestrator

This is the most complex file. It contains two React components:

### `CityScene` (exported default)
The R3F `<Canvas>` wrapper. Sets up:
- Orthographic camera at `zoom: 13`, position `[28, 28, 28]` (isometric)
- Shadow-casting directional lights (512×512 shadow map for perf)
- Background colour `#5a9e30` (matches grass — no sky gap)

### `City` (internal)
The main 3D scene inside the canvas. Responsibilities:

**1. cd transition animation**
- Watches `cwd` vs `prevCwd`; when they differ, runs a GSAP timeline:
  - Scale all buildings/gates to `{x:0, y:0, z:0}` over ~0.28–0.65 s (staggered)
  - 350 ms hold (camera fully zoomed, arch portal visible)
  - Calls `finish()` → clears cdTarget, teleports player to spawn, updates `displayedCwd`
- `displayedCwd` is the **rendered** directory — lags behind `cwd` until animation ends
- Buildings/gates are keyed by `"${displayedCwd}:${node.name}"` so React remounts them (re-triggering entrance animation) when `displayedCwd` changes

**2. Builder / DustCloud system**
- `knownKeys`: `Map<"cwd§name", {x,z}>` — maintained across renders
- **Additions (new nodes):** Diffed in `useEffect`; new nodes get a `Builder` spawned immediately. The corresponding `Building`/`Gate` gets `startDelay = BUILDER_TTL (4400ms)` so it only appears after the builder finishes.
- **Removals (rm):** Diffed in `useEffect`; removed nodes get a `DustCloud` at their lot position.
- `justCreatedKeys` — a `useMemo` that reads the **stale** `knownKeys.current` (before the effect updates it) to synchronously identify new nodes for `startDelay` assignment. This is a deliberate stale-ref pattern.

**Key constants:**
```js
BUILDER_TTL = 4400  // ms — must match Builder.jsx TOTAL_MS
DUST_TTL    = 1400  // ms — must match DustCloud.jsx TOTAL_MS
SPAWN_X = 0, SPAWN_Z = 26  // player teleport target after cd
```

---

## 7. Camera System (`CameraController.jsx`)

Runs every frame in `useFrame`. Two modes:

**Normal (no transition):**
- `destX/Z = player.x/z`
- `smoothX/Z` lerps to dest at `PAN_LERP_NORMAL = 0.22`
- `camera.zoom` lerps to `zoomRef.current` (scroll-wheel value) at `ZOOM_LERP_NORMAL = 0.12`

**During cd transition (`cdTarget !== null`):**
- `destX/Z = player + 40% * (gate − player)` — drifts 40% toward the gate
- `smoothX/Z` lerps at `PAN_LERP_TRANSITION = 0.07` (slower pan)
- `camera.zoom` lerps to `cdZoom (52)` at `ZOOM_LERP_TRANSITION = 0.11` (fast zoom-in)
- After `clearCdTarget()`: zoom naturally lerps back to scroll-wheel value

**Camera position formula:** `camera.position = [smoothX + 28, 28, smoothZ + 28]` (isometric offset). `camera.lookAt(smoothX, 0, smoothZ)`.

**Scroll-wheel zoom:** clamped to `[MIN_ZOOM=15, MAX_ZOOM=38.5]`. Blocks when sidebar is focused.

---

## 8. Component Reference

### `Building.jsx`
**Props:** `name, ext, size, x, z, showLabel, startDelay`

- **Colours:** `EXT_STYLES` map: each file extension has a distinct `body`, `roof`, `accent` colour. `.js` → blue, `.py` → green, `.rs` → orange, etc. Unknown ext → grey.
- **Sizing:** `calcDimensions(sizeBytes, ext)` → `{w, d, height}`. Uses `log10(size)` to scale height (1.5–10 units) and footprint (2.5–5 units). Video files are wider and shallower.
- **Stepped towers:** Code file extensions (js, jsx, ts, tsx, py, go, rs, c, cpp) get a two-section setback tower (lower 60% + upper 40% at 70% width).
- **Floor belts:** Decorative horizontal bands every `1.2` units of height.
- **Rooftop variety:** `nameHash(name)` selects deterministic rooftop detail: water tower, antenna, roof garden, or satellite dish.
- **Hover:** Hovering raises the building on Y and brightens windows via `useFrame`.
- **Click:** Dispatches `CustomEvent('vfs-inspect', {detail:{name,ext,size}})` → TerminalHUD prints file info.
- **Entrance animation:** `startDelay` ms before scale-in begins; newly created buildings wait `BUILDER_TTL` ms.

### `Gate.jsx`
**Props:** `name, x, z, startDelay`

- Renders a Roman Triumphal Arch (full architecture: piers, 9 voussoir stones, entablature, attic, crown).
- **Geometry constants:** `HW=1.5` (half opening width, so opening = 3 units), `PIER_W=1.5`, `FULL_W=6.0`, `PIER_D=1.40`, `SPRING_Y=5.0`, `ARCH_TOP=6.5`, total height ≈ 9 units.
- **Variety:** `nameHash(name)` picks crown ornament (eagle/urn/trophy), banner colour (red/gold/blue/purple), and whether torches appear (50% chance).
- **Hover:** Voussoirs shimmer gold; keystone pulses in scale.
- **Click:** `setCdTarget(x, z)` + `cd(name)`.
- **Portal:** `<PortalScene />` rendered inside the arch opening.

### `EntranceGate.jsx`
**Props:** `x, z`

- Same arch geometry as `Gate.jsx`. Always at full scale (no entrance animation).
- Imperial gold/cream palette, always eagle crown, always torches.
- Click: `setCdTarget(x, z)` + `cd('..')`. Dimmed when already at root (`cwd === '/'`).
- **Portal:** `<PortalScene />` inside the arch.

### `PortalScene.jsx`
No props. Renders a miniature night city inside every arch opening.

**Technique:** All geometry uses `renderOrder < 0` (from −10 to −2) + `depthTest: false` + `depthWrite: false`. Gate stone renders at `renderOrder 0` (default), overwriting the portal where piers are. Through the 3-unit opening, portal shows.

**Layer stack (back → front):**

| renderOrder | Content |
|---|---|
| −10 | Dark navy sky |
| −9 | Mid sky + horizon glow (3 orange layers) + stars + moon |
| −8 | Far buildings (10 silhouettes, `InstancedMesh`) |
| −7 | Far windows (warm yellow/cool blue/orange, `InstancedMesh ×3`) |
| −6 | Mid buildings (6, `InstancedMesh`) |
| −5 | Mid windows (`InstancedMesh ×3`) |
| −4 | Near buildings (5, `InstancedMesh`) |
| −3 | Near windows (`InstancedMesh ×3`) |
| −2 | Ground + warm street-glow strip |

Windows are generated deterministically at module load via `genWins()` (DJB2 hash of building x-position + grid coords).

### `Builder.jsx`
**Props:** `x, z, spawnDelay=0`

- Voxel construction worker at lot position.
- `TOTAL_MS = 4400` ms lifespan (matches `BUILDER_TTL` in CityScene).
- 10 white/grey smoke puffs (`NPUFFS=10`), each cycling over `PUFF_CYCLE=2.4s`.
- Arm swings via `useFrame` sine wave. Worker body/head/arm all box geometries.
- Puff materials (`MeshBasicMaterial`, transparent) disposed on unmount.

### `DustCloud.jsx`
**Props:** `x, z`

- 10 brown-gold particles rising and spreading on `rm`.
- `TOTAL_MS = 1400` ms, `FADE_MS = 180` ms in/out.
- Sphere geometry (`args={[0.5, 5, 5]}`), each particle has a random outward direction from `useMemo`.

### `CityBoundary.jsx`
No props. Static city infrastructure. Contains:
- **Perimeter walls** (battlements via `WallSection`) with 6-unit gaps for each gate.
- **Corner towers** at four corners.
- **Fountain plaza** (8×8) at `(0, 0)` with animated water droplets (`InstancedMesh`).
- **4 park lots** at `(±9, ±9)` with grass, hedges, benches, flowers.
- **Street lamps** at road intersections (10 positions).
- **Road trees** at outer-road corners (4 positions).
- **Plaza planters** flanking the fountain (4 positions).
- **Entrance approach** — decorative plaza slab at `z=27.5`.

### `PlotGrid.jsx`
**Props:** `positions` (array of `{x, z}`)

Renders 12 raised concrete lot slabs. Each slab:
- Size: `LOT_SIZE × LOT_SIZE` (8×8 units) at `y=0.22`
- Slight texture variation using deterministic index.
- `SLAB_TOP = 0.36` — buildings start here.

### `Player.jsx`
No props. WASD movement in isometric space.

**Movement axes (camera at `[1,1,1]`):**
```
W → (−1, 0, −1) normalized   (screen up)
S → (+1, 0, +1) normalized   (screen down)
A → (−1, 0, +1) normalized   (screen left)
D → (+1, 0, −1) normalized   (screen right)
```

- `SPEED = 9` world-units/s.
- Walk bob: `Math.abs(Math.sin(t * BOB_FREQ)) * BOB_AMP` on Y when moving.
- Blocks movement when sidebar input has focus.
- On each frame: updates `posRef` → calls `store.setPosition(x, z)` for camera to follow.
- **Teleport:** reads `pendingTeleport` from store, snaps `posRef` instantly.

### `TerminalHUD.jsx`
No props. Embedded in the left sidebar.

**Commands:** `mkdir`, `touch`, `cd`, `rm`, `mv`, `cp`, `cat`, `ls`, `pwd`, `tree`, `help`, `clear`

**Tab completion:** If 1 token → complete command name. If 2+ tokens → complete filename from `store.ls()`. Single match auto-completes; multiple matches printed as list.

**Command history:** `↑`/`↓` arrows navigate `cmdHistory` array.

**Building click listener:** `window.addEventListener('vfs-inspect', handler)` — formats and prints file info card when a building is clicked in 3D.

### `FileTreePanel.jsx`
No props. Recursive `TreeNode` component tree.

- Always-expanded directories on the path from root → cwd.
- Clicking a directory calls `store.cd(path)`.
- Files show a colour-coded bullet by extension (matches Building.jsx colours).
- Active directory (`cwd`) gets a `cwd` badge.

---

## 9. Coordinate System & Geometry Constants

```
World origin: (0, 0, 0) — centre of city, ground level
Y axis: up
X axis: east/west
Z axis: north (negative) / south (positive) — "south" faces the camera

Camera: isometric at [player.x+28, 28, player.z+28], looking at player
        orthographic — zoom controls apparent size

Perimeter walls:       z = ±30, x = ±30
Directory gates:       z = −30, x ∈ {−21, −9, +9, +21}
Entrance gate:         z = +30, x = 0
Player spawn:          x = 0, z = 26 (just inside entrance)
Building lot centres:  x ∈ {−21, −9, +9, +21}, z ∈ {+21, +9, −9, −21}
Park lots:             (±9, ±9)
Fountain:              (0, 0)
Slab top surface:      y = 0.36
```

**Shared magic numbers that MUST stay in sync across files:**
```
SLAB_TOP = 0.36        (PlotGrid, CityBoundary, Builder, DustCloud)
BUILDER_TTL = 4400     (CityScene ↔ Builder TOTAL_MS)
DUST_TTL = 1400        (CityScene ↔ DustCloud TOTAL_MS)
GATE arch HW = 1.5     (Gate.jsx ↔ EntranceGate.jsx — same geometry)
GATE FULL_W = 6.0      (Gate.jsx ↔ CityBoundary wall gap)
```

---

## 10. Animation Patterns

### 10.1 Entrance animation (Building, Gate)
```js
// In useLayoutEffect: set scale to 0
groupRef.current.scale.setScalar(0)

// In useFrame: lerp scale up after startDelay
if (performance.now() >= startAt.current) {
  scaleProgress.current = Math.min(1, scaleProgress.current + delta * speed)
  groupRef.current.scale.setScalar(scaleProgress.current)
}
```

### 10.2 cd exit animation (CityScene — GSAP)
```js
gsap.timeline({ onComplete: finish })
  .to(scales, { x:0, y:0, z:0, duration:0.28, stagger:0.032, ease:'back.in(1.4)' })
  .to({}, { duration: 0.35 })   // hold at peak zoom
```

### 10.3 CSS portal animation (App.jsx)
On every `cwd` change, `App.jsx` adds class `portal-journey` to the canvas wrapper, which runs `@keyframes portal-journey` (scale zoom + perspective). Defined in `App.css`.

### 10.4 Material mutation pattern (hover effects)
Shared module-level materials are mutated via `useFrame` (never recreated) to avoid GPU material swaps:
```js
mat.color.lerpColors(_baseColor, _hovColor, hoverProgress.current * 0.35)
mat.emissiveIntensity = hoverProgress.current * 0.80
```

### 10.5 InstancedMesh (PortalScene, CityBoundary fountain)
```js
const ref = useRef()
useLayoutEffect(() => {
  data.forEach((item, i) => {
    dummy.position.set(...)
    dummy.scale.set(...)
    dummy.updateMatrix()
    ref.current.setMatrixAt(i, dummy.matrix)
  })
  ref.current.instanceMatrix.needsUpdate = true
}, [])  // runs once on mount
```

---

## 11. Performance Notes

- **Shadow map:** 512×512 (reduced from default 1024×1024).
- **Materials:** `MeshBasicMaterial` (no lighting calc) used for windows, droplets, portal, dust, smoke. `MeshLambertMaterial` for static stone. `MeshStandardMaterial` only on player.
- **`raycast={() => null}`** on all decorative meshes that should never be clickable.
- **`useFrame` throttling:** Some animations check `frameSkip` and skip every N frames when at rest.
- **Pre-allocated vectors:** `const _move = new THREE.Vector3()` at module level to avoid GC pressure.
- **Module-level materials:** Never recreated. Mutated in-place via `useFrame` or `useEffect`.
- **PortalScene:** All geometry is `depthTest: false` + `depthWrite: false`, batched into `InstancedMesh` per layer (~15 draw calls total per portal).

---

## 12. CSS Architecture (`App.css`)

**Layout:**
```
.app-root           → flex row, 100vw × 100vh
  .sidebar          → fixed 280px wide left panel; flex column
    .sidebar-header → logo + clickable breadcrumb path
    .sidebar-tree-section → FileTreePanel (flex-grow: 1, scrollable)
    .sidebar-terminal-section → TerminalHUD (fixed height ~280px)
  .city-view        → flex-grow: 1, relative container for canvas
    .canvas-wrapper → 100% width/height; receives portal-journey class
    .cd-portal-flash → full-overlay flash div (keyed, self-removes)
```

**Key classes:**
- `.portal-journey` — `@keyframes portal-journey`: CSS scale + blur zoom on cd
- `.terminal-output` — dark scrollable output area
- `.terminal-input-row` — sticky input at bottom of terminal
- `.tree-dir--active` — highlighted current directory in file tree
- `.tree-cwd-badge` — `cwd` badge on active dir

**Sidebar blocks 3D events:** `pointer-events: none` on canvas when sidebar input is focused is handled via key-blocking in `Player.jsx` (checks `document.activeElement?.closest('.sidebar')`).

---

## 13. Known Limitations / Good Next Ideas

- `mv` and `cp` are **within-cwd only** — no cross-directory moves.
- Building **collision** is not implemented — player walks through buildings.
- No **file content** — `cat` shows metadata only (size, extension, path).
- **`@react-three/rapier`** is installed but unused — could add physics colliders to buildings.
- Dir gates max at **4** (one per DIR_SLOT); more than 4 dirs in a cwd overflow to extra positions off-screen.
- Portal scene is **generic** — same night city in every arch, not a real preview of the next directory.
- No **persistence** — VFS resets on page refresh.
- Player has no **bounds checking** — can walk outside the city walls.
