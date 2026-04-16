1. Core Concept
Silicon City is a web-based 3D isometric simulation where a
virtual file system is rendered as a walkable metropolis.
By mapping abstract data structures to physical geography, users
"inhabit" their directories.

The Russian Doll Principle: The world is built recursively.
The current directory is the "Active Plaza." Moving into a
sub-directory triggers a visual transition where the child
directory expands to become the new surrounding environment.
Simply put: cities inside of cities.

2. Technical Stack
Framework: React + Vite (Web Environment)
3D Engine: @react-three/fiber (Three.js for React)
State Management: Zustand (VFS Tree, CWD state, Player position)
Animations: useFrame (R3F) / GSAP

3. Navigation & Player Mechanics

View: Fixed isometric orthographic camera. The camera follows
the player character and never rotates. Scroll wheel zooms in/out.

Player: A small blocky character (box mesh) controlled with WASD.
Movement is in isometric axes — W/S/A/D map to the four diagonal
directions visible on screen.

Directory Gates: Folders are hollow archway structures. Clicking
a gate triggers a cd command, loading the sub-directory as the new
Active Plaza.

The Terminal HUD: A ~ toggleable overlay allows users to type
commands directly. The spacebar is never captured while the
terminal is open.

4. City Plot System

Every Active Plaza always displays a fixed grid of land plots
(default: 25 plots in spiral order from center). Plots represent
buildable parcels of land.

- Empty plots: flat concrete slabs with a dashed boundary marker.
- Occupied plots: building or gate constructed on top of the slab.
- touch [file] claims the next available empty plot and constructs
  a skyscraper. mkdir [name] claims a plot and places a gate arch.
- rm [name] removes the building and returns the plot to empty.

5. Command-to-Visual Mapping

Command     VFS Logic           3D Representation
mkdir       Add dir node        Gate arch appears on next plot
touch       Add file node       Skyscraper rises on next plot (scale-in)
cd          Update CWD          New plaza loads (gate click or terminal)
rm          Delete node         Building removed, plot returns empty
ls          Query children      Holographic labels pulse above structures

6. Building Logic (Files)
Files are solid skyscrapers where height is the primary indicator.

  const height = Math.log10(fileSizeInBytes) * SCALE_FACTOR;
  // ~1MB = 10 floors

Extension → color/style:
  .js/.jsx  → Blue
  .ts/.tsx  → Purple
  .mp4/.mov → Orange/Red (wide monolith)
  .txt/.md  → White (slender)
  .py       → Green
  .json     → Yellow
  .css      → Pink
  .html     → Orange
  default   → Grey

7. Development Roadmap

Phase 1: Virtual Kernel — Zustand VFS store (done)
Phase 2: Layout Engine + 3D Scene — grid layout, buildings, gates (done)
Phase 3: Player Character — isometric WASD movement, camera follow (done)
Phase 4: City Plot System — pre-placed land parcels, buildings claim plots (done)
Phase 5: Animation & Polish — scale-in construction, dissolve on rm,
         cd transition, ls label pulse (partial)
