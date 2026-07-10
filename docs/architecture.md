# Architecture

This project is a **game-engine template**, not just a demo. The code is split
into three layers with a strict, one-directional dependency rule:

```
┌─────────────────────────────────────────────────────────────┐
│  app/     DOM chrome, debug GUI, dialogs, HUD — the demo host │
│           (main.ts, AppUI.ts, ShadcnDialog.ts)                │
└───────────────┬───────────────────────────────────────────────┘
                │ builds on
┌───────────────▼───────────────────────────────────────────────┐
│  game/    Content: characters, vehicles, scenarios, paths,     │
│           spawn points — everything specific to *this* demo    │
└───────────────┬───────────────────────────────────────────────┘
                │ registers into
┌───────────────▼───────────────────────────────────────────────┐
│  engine/  Generic core: renderer, physics, camera, input,      │
│           loading, sky/ocean, plugin registries. Ships no       │
│           game content.                                         │
└───────────────────────────────────────────────────────────────┘
```

**The rule:** `engine/` must not depend on `game/` or `app/` at runtime, and
`game/` must not depend on `app/`. The only edges from `engine/` into `game/`
are `import type` (erased at compile time) — the shipped engine bundle has
**zero** runtime dependency on game content. You can verify this holds:

```bash
grep -rn "^import {" src/ts/engine --include='*.ts' | grep "game/"   # must be empty
```

## The layers

### `engine/` — the framework

Owns everything generic. Notable pieces:

| File | Responsibility |
| --- | --- |
| [`Engine.ts`](../src/ts/engine/Engine.ts) | The god object: renderer, scene, physics world, render loop, and lifecycle (`start`/`stop`/`dispose`). Exposes `createEngine(options)`. |
| [`EngineOptions.ts`](../src/ts/engine/EngineOptions.ts) | The config object + `resolveEngineOptions` (fills defaults). |
| [`EngineContext.ts`](../src/ts/engine/EngineContext.ts) | The narrow interface entities/subsystems depend on **instead of** the concrete `Engine` — this is what broke the old circular `World ↔ entity` dependency. |
| [`EngineEvents.ts`](../src/ts/engine/EngineEvents.ts) | Typed event bus (`Emitter`). The engine never touches the DOM; it emits events the app renders. |
| [`EntityRegistry.ts`](../src/ts/engine/EntityRegistry.ts) | `kind: string → factory` — register custom entity types. |
| [`SceneLoader.ts`](../src/ts/engine/SceneLoader.ts) | Handler table for glb `userData`/material conventions. |
| `world/` | `Sky` (TSL procedural sky + CSM sun) and `Ocean` (TSL water). |
| `physics/` | cannon-es colliders (box, trimesh, capsule, sphere). |
| `interfaces/`, `enums/` | The extension contracts (`IWorldEntity`, `IUpdatable`, `ISpawnPoint`, …). |

### `game/` — the content

Everything specific to *this* showcase: the `Character` controller and its
state machine + AI, the `Vehicle` types (`Car`, `Airplane`, `Helicopter`), and
the world constructs (`Scenario`, `Path`, spawn points). None of this is baked
into the engine — [`game/register.ts`](../src/ts/game/register.ts) wires it in
through the public registries. A different game would ship its own `register`.

### `app/` — the host

The demo's shell: mounts the canvas, builds the debug GUI (dat.gui), renders
dialogs (shadcn) and the controls HUD, and toggles the FPS panel. It talks to
the engine **only** through the public API and events — never by reaching into
engine internals. See [`AppUI.ts`](../src/ts/app/AppUI.ts).

## Data flow: booting a world

```
createEngine(options)                     // app/main.ts
  └─ new Engine(options)                   // starts async renderer.init() + glb load
registerGameContent(engine)                // game/register.ts — kinds + glb handlers
new AppUI(engine)                          // subscribes to engine events

… renderer.init() resolves, world.glb finishes loading …

Engine.loadScene(gltf)
  └─ SceneLoader.load(gltf, ctx)            // traverse, dispatch handlers:
       ├─ 'physics' → collider (engine handler)
       ├─ material 'ocean' → Ocean (engine handler)
       ├─ 'path' → new Path (game handler)
       └─ 'scenario' → new Scenario (game handler)
  └─ launch the scenario flagged `default`
       └─ SpawnPoint.spawn → ctx.entities.create('car' | 'player' | …)

Engine emits 'world:loaded' { scenarios }  → AppUI builds the scenario menu + welcome
```

## Extension points

The two registries are how you add content **without editing engine code**:

```ts
import { createEngine } from 'threejs-webgpu-playground';

const engine = createEngine({ container, world: '/assets/world.glb' });

// 1. A custom entity kind (referenced by userData.type on a spawn point)
engine.entities.register('drone', (ctx, { model }) => new Drone(model));

// 2. A custom glb authoring convention
engine.sceneLoader.onUserData('data', 'light', ({ node, ctx }) => {
  ctx.graphicsWorld.add(new THREE.PointLight().copy(node.position));
});

// 3. A custom material handler
engine.sceneLoader.onMaterial('lava', (mesh, ctx) => ctx.registerUpdatable(new Lava(mesh, ctx)));
```

See [authoring.md](authoring.md) for the glb `userData` conventions the demo's
handlers recognize.

## Events

Subscribe with `engine.events.on(type, cb)` (returns an unsubscribe function):

| Event | Payload | Fired when |
| --- | --- | --- |
| `ready` | — | Renderer initialized (WebGPU or WebGL2 fallback) |
| `webgpu:unsupported` | — | WebGPU unavailable; fell back to WebGL2 |
| `load:start` | — | A load batch began |
| `load:progress` | `{ fraction }` | Load progress |
| `load:complete` | — | A load batch finished |
| `world:loaded` | `{ scenarios }` | World glb loaded; scenario list ready |
| `world:empty` | — | Engine started with no world (`world: null`) |
| `scenario:launched` | `{ id, welcome? }` | A scenario was launched |
| `controls:changed` | `IControlRow[]` | The active control scheme changed (HUD) |

## The `three/webgpu` alias

`WebGPURenderer`, `PostProcessing`, and TSL node materials live in the
`three/webgpu` entry, which `@types/three` doesn't type against the bare
`three` specifier. Both Vite (`vite.config.ts`) and TypeScript
(`tsconfig.json` `paths`) alias `three` → `three/webgpu` so the WebGPU API is
typed. TSL shader modules still need `any` for node handles — this is confined
to a per-file eslint override (`eslint.config.js`).
