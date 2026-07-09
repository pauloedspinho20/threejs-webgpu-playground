/**
 * Public API for the threejs-webgpu-playground engine.
 *
 * Consumers build a world by constructing an engine, registering their own
 * content, and loading a glb scene:
 *
 *   import { createEngine } from 'threejs-webgpu-playground';
 *   const engine = createEngine({ container, world: '/assets/world.glb' });
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

// Extension interfaces
export type { IUpdatable } from './engine/interfaces/IUpdatable';
export type { IWorldEntity } from './engine/interfaces/IWorldEntity';
export type { ISpawnPoint } from './engine/interfaces/ISpawnPoint';
export type { ICollider } from './engine/interfaces/ICollider';

// Core subsystems (useful for advanced consumers)
export { InputManager } from './engine/InputManager';
export { CameraOperator } from './engine/CameraOperator';
export { LoadingManager } from './engine/LoadingManager';
