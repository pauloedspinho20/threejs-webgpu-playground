# Roadmap

**Vision:** a batteries-included **game-engine template** on three.js WebGPU + TSL — fork it, drop in a Blender-authored world, and get a playable third-person space with modern GPU rendering, physics, vehicles, and character controls.

This is a living document. Items are ordered by priority within each milestone. Check them off as they land.

---

## Current state (what already works)

- ✅ WebGPU renderer (`WebGPURenderer`) with automatic WebGL2 fallback
- ✅ TSL shaders: procedural sky (`SkyMesh`), raymarched ocean, FXAA post-pass
- ✅ Cascaded shadow maps via `CSMShadowNode`
- ✅ cannon-es physics: character capsule, `RaycastVehicle` cars, colliders
- ✅ Third-person character controller + drivable cars, airplanes, helicopters
- ✅ Blender → glb world loading with `userData`-driven entities
- ✅ Vite + TypeScript toolchain, `tsc --noEmit` clean

---

## Milestone 1 — Make it buildable *by other people* (highest priority)

The authoring contract is currently implicit in [`World.loadScene`](src/ts/world/World.ts). Nobody can build a world without reading the source. This milestone is the difference between "a demo" and "a template."

- [ ] **Document the world-authoring contract.** A `docs/authoring.md` specifying the Blender conventions the loader recognizes:
  - `userData.data = 'physics'` + `userData.type = 'box' | 'trimesh'` → collider (note the current `box`/`trimesh`-only limitation; convex is unsupported)
  - `userData.data = 'path'` → AI path; `userData.data = 'scenario'` → spawn scenario
  - material named `ocean` → water surface
  - scale/unit expectations, axis orientation, naming rules
- [ ] **Ship a minimal starter world** (`empty-world.glb` + source `.blend`) plus a documented `tools/` export workflow, so a creator has a working example to copy.
- [ ] **De-hardcode the entry point.** [`main.ts`](src/ts/main.ts) hardwires `/assets/world.glb`. Make the world path config-driven (query param / config file) and expose a small `createWorld(options)` API instead of `new World(path)` doing everything.
- [ ] **Validate on load with actionable errors** ("object X marked `physics` but missing `type`") instead of silently skipping malformed objects.
- [ ] Add `CLAUDE.md` / `docs/architecture.md` mapping the module layout (core / world / characters / vehicles / physics).

## Milestone 2 — Engine maturity & credibility

- [ ] **Extract a clean core vs. game layer.** Keep character + vehicles as the showcase, but make them opt-in modules on top of a core (renderer, sky, world loader, camera, physics, post-processing) so people can build non-vehicle games.
- [ ] **Tighten types.** Add a tsconfig `paths` alias `three` → `three/webgpu` (mirroring the Vite alias) so `WebGPURenderer`, `PostProcessing`, and node materials are typed — removing the `as any` casts in [`World.ts`](src/ts/world/World.ts) and [`Ocean.ts`](src/ts/world/Ocean.ts). Replace private-member casts (`getVehicleAxisWorld`, `char.physicsEnabled`) with public accessors.
- [ ] **Tests + CI.** Smoke tests (world loads, character spawns, no console errors) and a GitHub Actions gate running `typecheck` + `build` + `lint`.
- [ ] **Bundle hygiene.** The build is a single ~1.4 MB chunk — code-split and lazy-load assets/scenarios.
- [ ] **Asset compression pipeline.** Draco/meshopt geometry + KTX2/Basis textures — essential for shipping real worlds over the web.

## Milestone 3 — "Open space" scale features

The single static world mesh won't scale to large environments.

- [ ] **Frustum culling + LOD** for meshes.
- [ ] **Instancing** (`InstancedMesh` / GPU instancing) for repeated props and vegetation.
- [ ] **Streaming / chunked world loading** — load tiles on demand rather than one monolithic glb.
- [ ] **Terrain system** — heightmap or chunked mesh (currently terrain is just static geometry).
- [ ] **Floating-origin / camera-relative rendering** — f32 precision breaks past a few km; rebase the origin for genuinely large spaces.

## Milestone 4 — Cash in on WebGPU (the point of the migration)

- [ ] **Compute shaders (TSL compute).** The headline WebGPU feature, currently unused. Showcase: GPU particle systems, instanced grass/foliage fields, boids.
- [ ] **Richer post-processing stack.** Add bloom, SSAO/GTAO, TAA, and color-grading as a composable TSL node pipeline (only FXAA today).
- [ ] **IBL / environment lighting.** HDRI environment maps + light probes for realistic outdoor lighting (currently hemisphere + single sun).
- [ ] **Rework the ocean.** It's a per-fragment screen-space raymarch on a flat plane (expensive, limited). Move to a mesh-based Gerstner/FFT water simulated via compute — faster and more open-world-appropriate.
- [ ] **Day/night cycle.** `SkyMesh` already takes a sun vector — a time-of-day driver is low-effort, high-impact, and would drive the CSM sun light and ambient automatically.

## Milestone 5 — Polish & reach

- [ ] Graceful WebGPU-unsupported UX beyond the current dialog; document the HTTPS deploy requirement.
- [ ] Mobile / touch controls and responsive canvas.
- [ ] A GUI-driven scene inspector (entities, physics debug toggle already exists) for tuning worlds live.
- [ ] Save/load of world/entity state.
- [ ] Optional multiplayer hooks (transform sync layer) — commonly wanted for shared spaces.

---

## Known issues / tech debt

- WebGPU/TSL types are cast to `any` in places because `@types/three` doesn't cover the aliased `three/webgpu` build (see Milestone 2 tsconfig fix).
- `eslint.config.js` uses the default recommended `no-explicit-any`; the engine legitimately needs `any` for TSL node params and dynamic physics/DOM code. Decide on a project-wide policy (allow `any`, or a per-directory override for shader/TSL files).
- Ocean water is a flat plane with a screen-space raymarch — see Milestone 4.
- Physics colliders are limited to boxes and trimeshes (`// Convex doesn't work! Stick to boxes!`).
