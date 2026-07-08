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

## Usage

Scenes are authored in Blender and loaded as `.glb`. The app is bootstrapped in [`src/ts/main.ts`](src/ts/main.ts):

```javascript
import { World } from './world/World';
new World('/assets/world.glb');
```

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
