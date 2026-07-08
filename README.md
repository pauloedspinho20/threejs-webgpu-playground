<p align="center">
	<a href="https://jblaha.art/sketchbook/latest"><img src="./src/img/thumbnail.png"></a>
	<br>
	<a href="https://jblaha.art/sketchbook/latest">Live demo</a>
	<br>
</p>

# Final update (20. Feb 2023)

As I have no more interest in developing this project, it comes to a conclusion. In order to remain honest about the true state of the project, I am archiving this repository.

- If you wish to modify Sketchbook feel free to fork it.
- To see if someone is currently maintaining a fork, check out the [Network Graph](https://github.com/swift502/Sketchbook/network).

# 📒 Sketchbook

Simple web based game engine built on [three.js](https://github.com/mrdoob/three.js) and [cannon.js](https://github.com/schteppe/cannon.js) focused on third-person character controls and related gameplay mechanics.

Mostly a playground for exploring how conventional third person gameplay mechanics found in modern games work and recreating them in a general way.

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
