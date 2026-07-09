# World authoring (Blender → glb)

Worlds are modelled in Blender and exported as a single `.glb`. The engine
reads Blender **custom properties** (which land in glTF `userData`) and material
names to turn plain meshes into physics colliders, water, AI paths, and
spawnable scenarios.

In Blender, add custom properties under **Object Properties → Custom
Properties** (and, for water, name the **material**). All values are strings —
`"true"`, `"box"`, `"car"`, etc.

> These conventions are **not hardcoded in the engine** — they are registered by
> [`game/register.ts`](../src/ts/game/register.ts) plus the engine's built-in
> handlers. To add your own convention, register a `sceneLoader.onUserData` /
> `onMaterial` handler (see [architecture.md](architecture.md#extension-points)).

## Physics colliders

| Custom property | Value | Meaning |
| --- | --- | --- |
| `data` | `physics` | This object is a collider (rendered mesh is hidden). |
| `type` | `box` | Box collider sized from the object's world scale. Cheap — prefer this. |
| `type` | `trimesh` | Triangle-mesh collider from the geometry. Static only. |

> **Limitation:** only `box` and `trimesh` are supported. Convex hulls do not
> work (`// Convex doesn't work! Stick to boxes!`). Build level collision out of
> boxes wherever possible.

## Water

Give a mesh a **material named `ocean`**. Any mesh with that material becomes a
TSL water surface (registered as a per-frame updatable). No custom property
needed.

## AI paths

| Custom property | Value | Meaning |
| --- | --- | --- |
| `data` | `path` | This object is the root of an AI path. |

Child objects of the path become ordered path nodes; their **object names** are
what a spawn point references via `first_node` (below).

## Scenarios

A scenario is an object whose children are spawn points. Set these on the
scenario **root** object:

| Custom property | Value | Meaning |
| --- | --- | --- |
| `data` | `scenario` | Marks this object as a scenario root. |
| `name` | string | Label shown in the scenario menu. |
| `default` | `true` | Launch this scenario automatically when the world loads. |
| `spawn_always` | `true` | Spawn its entities even when another scenario is active. |
| `invisible` | `true` | Hide it from the scenario menu. |
| `desc_title` | string | Title of the welcome dialog shown on launch. |
| `desc_content` | string | Body (HTML allowed) of the welcome dialog. |
| `camera_angle` | string | Initial camera angle. |

### Spawn points (children of a scenario)

Each child with `data = spawn` spawns one entity:

| Custom property | Value | Meaning |
| --- | --- | --- |
| `data` | `spawn` | Marks this object as a spawn point. |
| `type` | `player` | Spawn the player character here. |
| `type` | `car` \| `heli` \| `airplane` | Spawn a vehicle of that kind. |
| `driver` | `player` | Put the player in the vehicle's driver seat. |
| `driver` | `ai` | Put an AI driver in the vehicle. |
| `first_node` | string | (AI drivers) name of the path node to start following. |

The `type` values map to entity **kinds** registered in
[`game/register.ts`](../src/ts/game/register.ts) (`car`/`heli`/`airplane`/
`player`). Add a new vehicle by registering a new kind and authoring a spawn
point with that `type` — no engine change required.

## Assets

Vehicle and character models are loaded on demand from the engine's
`assetBaseUrl` (default `/assets/`) by filename: a spawn point of `type: 'car'`
loads `car.glb`, `heli` loads `heli.glb`, characters load `boxman.glb`. Keep
those alongside the world glb.

## Export checklist

- Apply transforms you don't want treated as runtime scale (box colliders read
  world scale directly).
- Name the water material exactly `ocean`.
- Give every scenario a unique `name`; mark exactly one `default`.
- Export as glTF Binary (`.glb`) with custom properties enabled
  (**Include → Custom Properties** in the Blender glTF exporter).
