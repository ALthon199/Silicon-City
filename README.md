# Silicon City — Repository Visualizer

An interactive 3D city built from your filesystem. Every file becomes a building, every directory a city district. Navigate with terminal commands and explore public GitHub repos.

## Tech Stack

- **React + Vite** — frontend framework and build tool
- **Three.js / React Three Fiber** — 3D rendering
- **Zustand** — state management for the virtual filesystem
- **GitHub REST API** — load any public repository into the city

## Getting Started

```bash
npm install
npm run dev
```

## Terminal Commands

| Command | Description |
|---|---|
| `ls` | List files and directories |
| `cd <dir>` | Enter a directory |
| `mkdir <name>` | Create a directory |
| `touch <name>` | Create a file |
| `rm <name>` | Demolish a building / remove a node |
| `tree` | Show directory tree |
| `load <owner/repo>` | Load a public GitHub repo (e.g. `load facebook/react`) |
| `help` | Show all commands |

## Controls

- **Scroll** — zoom in / out
- **Arrow keys / WASD** — move the player around the city
