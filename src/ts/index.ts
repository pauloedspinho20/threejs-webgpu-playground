/**
 * Public API for the threejs-webgpu-playground engine.
 *
 * Consumers build a world by constructing an engine, registering their own
 * content (entity kinds + glb conventions), and loading a glb scene:
 *
 *   import { createEngine } from 'threejs-webgpu-playground';
 *
 *   const engine = createEngine({ container, world: '/assets/world.glb' });
 *   engine.entities.register('car', (ctx, { model }) => new Car(model));
 *   engine.sceneLoader.onUserData('data', 'path', ({ node, ctx }) => { ... });
 *
 * The engine ships no game content — everything the demo shows is registered
 * by src/ts/game/register.ts through this same surface.
 */

// Core engine
export { Engine, createEngine } from './engine/Engine';

// Configuration
export type { EngineOptions, ResolvedEngineOptions, WorldBounds } from './engine/EngineOptions';
export { resolveEngineOptions, DEMO_WORLD_BOUNDS } from './engine/EngineOptions';

// The contract entities depend on
export type { EngineContext, IWorldParams } from './engine/EngineContext';

// Events
export type { EngineEvents, ScenarioInfo, WelcomeInfo, IControlRow, Listener } from './engine/EngineEvents';
export { Emitter } from './engine/EngineEvents';

// Plugin registries — register custom content without editing the engine
export { EntityRegistry } from './engine/EntityRegistry';
export type { EntityFactory } from './engine/EntityRegistry';
export { SceneLoader } from './engine/SceneLoader';
export type { SceneNode, UserDataHandler, MaterialHandler } from './engine/SceneLoader';

// Extension interfaces
export type { IUpdatable } from './engine/interfaces/IUpdatable';
export type { IWorldEntity } from './engine/interfaces/IWorldEntity';
export type { ISpawnPoint } from './engine/interfaces/ISpawnPoint';
export type { ICollider } from './engine/interfaces/ICollider';
export type { IInputReceiver } from './engine/interfaces/IInputReceiver';

// Core subsystems (useful for advanced consumers)
export { InputManager } from './engine/InputManager';
export { CameraOperator } from './engine/CameraOperator';
export { LoadingManager } from './engine/LoadingManager';

// Camera modes (swap via cameraOperator.setMode(); register your own)
export type { ICameraMode } from './engine/camera/ICameraMode';
export { OrbitCameraMode } from './engine/camera/OrbitCameraMode';
export { FollowCameraMode } from './engine/camera/FollowCameraMode';
export { FirstPersonCameraMode } from './engine/camera/FirstPersonCameraMode';
export { LockedCameraMode } from './engine/camera/LockedCameraMode';

// World subsystems
export { Sky } from './engine/world/Sky';
export { Ocean } from './engine/world/Ocean';
export { Viewmodel } from './engine/Viewmodel';

// Abilities (dual-wield powers; register your own, equip per hand)
export type { Ability, AbilityCastContext } from './engine/abilities/Ability';
export { AbilityRegistry } from './engine/abilities/AbilityRegistry';
export type { AbilityFactory } from './engine/abilities/AbilityRegistry';

// Physics building blocks (for custom scene/collider handlers)
export { BoxCollider } from './engine/physics/colliders/BoxCollider';
export { TrimeshCollider } from './engine/physics/colliders/TrimeshCollider';
export { CapsuleCollider } from './engine/physics/colliders/CapsuleCollider';
export { SphereCollider } from './engine/physics/colliders/SphereCollider';
export { CollisionGroups } from './engine/enums/CollisionGroups';
