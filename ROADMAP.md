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
- ✅ Layered `engine` / `game` / `app` architecture with a `createEngine(options)` public API and plugin registries (engine has zero runtime dependency on game content) — see [docs/architecture.md](docs/architecture.md)
- ✅ Vite + TypeScript toolchain, `tsc --noEmit` clean, eslint clean

---

## Milestone 1 — Make it buildable *by other people* (highest priority)

**Largely complete.** A refactor split the source into `engine` / `game` / `app`
layers, replaced `new World(path)` with a configurable `createEngine(options)`
public API, moved the glb-authoring contract into pluggable registries, and
documented it. What's left is the starter world and load-time validation.

- [x] **Document the world-authoring contract** — [`docs/authoring.md`](docs/authoring.md) specifies the Blender `userData` conventions (physics box/trimesh, path, scenario + spawn points, `ocean` material) and the export checklist.
- [ ] **Ship a minimal starter world** (`empty-world.glb` + source `.blend`) plus a documented `tools/` export workflow, so a creator has a working example to copy.
- [x] **De-hardcode the entry point** — `createEngine(options)` (see [`EngineOptions`](src/ts/engine/EngineOptions.ts)) replaces `new World(path)`; the world path, container, and all subsystem settings are config-driven with defaults. Content is registered via `engine.entities` / `engine.sceneLoader` (see [`game/register.ts`](src/ts/game/register.ts)), not hardcoded in the engine.
- [ ] **Validate on load with actionable errors** ("object X marked `physics` but missing `type`") instead of silently skipping malformed objects.
- [x] **Map the module layout** — [`docs/architecture.md`](docs/architecture.md) covers the three-layer model, data flow, extension points, and events. *(A root `CLAUDE.md` is still worth adding for contributors.)*

## Milestone: First-person POV, viewmodel & abilities (current focus)

**Vision:** support first-person shooter cameras and a Skyrim-style dual-wield
where each hand holds an independent weapon/spell/torch. This is now the primary
direction. Today [`CameraOperator`](src/ts/engine/CameraOperator.ts) is a single
orbit rig (`target` + `radius` + `theta`/`phi`) with no mode abstraction — that
abstraction is the missing primitive. Build in independently-shippable layers:

- [x] **A1 · Camera-mode strategy (foundation).** `CameraOperator` hosts swappable `ICameraMode` strategies (`enter`/`exit`/`update`); third-person/free-cam ported to `OrbitCameraMode` with zero behavior change. Lives in `engine/`; modes exported from the public barrel.
- [x] **A2 · First-person mode.** `FirstPersonCameraMode` (camera at the eye, looking along `theta`/`phi`); `V` toggles it, body hidden, eye-height offset (`firstPersonEyeHeight`). Movement is camera-relative (W/A/S/D → forward/back/strafe).
- [x] **A3 · Viewmodel pass (the "hands").** `engine/Viewmodel`: separate scene + narrow-FOV camera, rendered after the world with depth cleared, `leftHand`/`rightHand` sockets. *(FXAA is skipped while active — a node-graph composite is the follow-up; see Milestone 4 post-FX.)*
- [x] **A4 · Ability / equip system (dual-wield powers).** `Ability` + `AbilityRegistry`; RMB → right hand, LMB → left hand, per-hand cooldowns, viewmodel orb per hand. `MagicBolt` fires a `Projectile` that raycasts the physics world and detonates an `Explosion` on impact (knockback on dynamic bodies). Casting is first-person only. Spell VFX → TSL compute particles is the natural upgrade (Milestone 4).
- [x] **A5 · Over-the-shoulder / aim mode + transitions.** `V` cycles third → over-shoulder → first. Over-shoulder = orbit at a shorter radius + a lerped lateral shoulder pan; third ↔ shoulder transitions glide (radius + shoulder lerp).

*Milestone complete.* Follow-ups worth doing: a true aim-lock in over-shoulder (camera fixed behind, mouse aims), spine/neck bones for visible first-person aim, and the FXAA-with-viewmodel node composite.

**Supporting work this milestone needs (elevated from later milestones):**

- [ ] **Input action-map + rebinding + gamepad.** `KeyBinding` is hardcoded per input receiver; an action-map layer is a prerequisite for a controls menu, gamepad support, and clean per-mode bindings.
- [ ] **Combat / interaction core.** Health + damage, hit detection (raycast / physics query), and interactables (pickups, doors, levers) — the scaffolding abilities and weapons act on.
- [ ] **TSL compute particles** (also in Milestone 4) — spell and impact VFX, and the actual payoff of the WebGPU migration.

> ✅ **Fixed along the way:** cascaded sun shadows were capped at 250u (`maxFar`) while the camera sees to ~1010u, so shadows faded out mid-view. Now 800u / 4 cascades by default and configurable via `renderer.shadowDistance` / `renderer.shadowCascades`.

## Milestone 2 — Engine maturity & credibility

- [x] **Extract a clean core vs. game layer.** Done: `engine/` is a generic core (renderer, sky/ocean, scene loader, camera, physics, post-processing) with **zero runtime dependency** on `game/`. Characters + vehicles are content in `game/`, registered onto the engine via the `EntityRegistry` / `SceneLoader` plugin registries — build a non-vehicle game by shipping a different `register`.
- [x] **tsconfig `three` → `three/webgpu` alias.** Added (mirrors the Vite alias), so `WebGPURenderer`, `PostProcessing`, and node materials are typed. Residual `any` for TSL node handles is confined to a per-file eslint override. *(Still open: replace remaining private-member casts like `getVehicleAxisWorld` / `char.physicsEnabled` with public accessors.)*
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

- WebGPU/TSL types still need `any` for node handles (`@types/three` doesn't model the TSL node graph). This is now scoped to a per-file eslint override rather than sprinkled casts — see `eslint.config.js`.
- **eslint `no-explicit-any` policy (resolved):** the base rule is `warn`; TSL shader modules (which idiomatically use `any` for node handles) get a per-file override turning it `off`. Add new TSL modules to that glob in `eslint.config.js`.
- Ocean water is a flat plane with a screen-space raymarch — see Milestone 4.
- Physics colliders are limited to boxes and trimeshes (`// Convex doesn't work! Stick to boxes!`).
