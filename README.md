<p align="center">
	<img src="./src/img/thumbnail.png">
</p>

# 🎮 threejs-webgpu-playground

A web-based **game-engine template** built on [three.js](https://github.com/mrdoob/three.js) **WebGPU** (with shaders written in [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)) and [cannon-es](https://github.com/pmndrs/cannon-es). It provides third-person character controls, drivable vehicles, physics, cascaded shadow maps, a procedural sky, and a Blender-authored world pipeline — a starting point for building interactive 3D spaces.

It runs on the WebGPU backend where available and falls back to WebGL2 automatically. See [ROADMAP.md](ROADMAP.md) for where the project is headed.

> Forked from and originally created as [Sketchbook](https://github.com/swift502/Sketchbook) by Jan Bláha (swift502). This fork migrates the engine from WebGL to three.js WebGPU + TSL, updates the toolchain to Vite + TypeScript, and swaps in cannon-es.

## Features

* World
	* Three.js scene
	* Cannon.js physics
	* Variable timescale
	* Frame skipping
	* FXAA anti-aliasing
* Characters
	* Third-person camera
	* Raycast character controller with capsule collisions
	* General state system
	* Character AI
* Vehicles
	* Cars
	* Airplanes
	* Helicopters

All planned features can be found in the [GitHub Projects](https://github.com/swift502/Sketchbook/projects).

> **This fork** has been migrated from WebGL to **three.js WebGPU (`WebGPURenderer`)** with shaders rewritten in **TSL** (Three.js Shading Language). It runs on the WebGPU backend where available and automatically falls back to WebGL2 otherwise. The toolchain is **Vite + TypeScript**, physics uses **cannon-es**, and three.js is on r185+.

## Architecture

The source is split into three layers with a one-directional dependency rule
(`app` → `game` → `engine`); the engine ships **no** game content and has zero
runtime dependency on it. See [docs/architecture.md](docs/architecture.md).

- **`src/ts/engine/`** — the generic framework: renderer, physics, camera,
  input, loading, sky/ocean, and the plugin registries.
- **`src/ts/game/`** — this demo's content: characters, vehicles, scenarios,
  paths, spawn points.
- **`src/ts/app/`** — the host: canvas mount, debug GUI, dialogs, HUD.

## Usage

Construct an engine, register your content, and point it at a Blender-authored
`.glb`. The demo is bootstrapped in [`src/ts/app/main.ts`](src/ts/app/main.ts):

```ts
import { createEngine } from 'threejs-webgpu-playground';
import { registerGameContent } from './game/register';

const engine = createEngine({ world: '/assets/world.glb', assetBaseUrl: '/assets/' });
registerGameContent(engine); // entity kinds + glb conventions — before load
```

Add your own entity types and glb conventions through the public registries —
no engine edits needed:

```ts
engine.entities.register('drone', (ctx, { model }) => new Drone(model));
engine.sceneLoader.onUserData('data', 'light', ({ node, ctx }) => { /* … */ });
```

`createEngine(options)` is fully configurable (container, camera, renderer,
physics, post-FX, world bounds, …); every field has a sensible default. React
to lifecycle via the typed event bus (`engine.events.on('world:loaded', …)`).

- **World authoring** (the Blender `userData` contract): [docs/authoring.md](docs/authoring.md)
- **Architecture & extension points**: [docs/architecture.md](docs/architecture.md)

## Running locally

1. Install a current [Node.js](https://nodejs.org/en/) LTS (18+)
2. Run `npm install`
3. Run `npm run dev` and open http://localhost:8080
4. Build for production with `npm run build` (output in `dist/`); preview it with `npm run preview`

## Contributing

1. [Fork this repository](https://help.github.com/en/github/getting-started-with-github/fork-a-repo)
2. Run `npm install`, then `npm run dev`
3. Make changes and test them out at http://localhost:8080
4. Commit and [make a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request-from-a-fork)!

## Credits

Big thank you to each of the following github users for contributing to Sketchbook:

- [aleqsunder](https://github.com/aleqsunder)
- [barhatsor](https://github.com/barhatsor)
- [danshuri](https://github.com/danshuri)
