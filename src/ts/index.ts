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
export type { EngineOptions, ResolvedEngineOptions, WorldBounds } from './core/EngineOptions';
export { resolveEngineOptions, DEMO_WORLD_BOUNDS } from './core/EngineOptions';

// The contract entities depend on
export type { EngineContext, IWorldParams } from './core/EngineContext';

// Events
export type { EngineEvents, ScenarioInfo, WelcomeInfo, IControlRow, Listener } from './core/EngineEvents';
export { Emitter } from './core/EngineEvents';

// Extension interfaces
export type { IUpdatable } from './interfaces/IUpdatable';
export type { IWorldEntity } from './interfaces/IWorldEntity';
export type { ISpawnPoint } from './interfaces/ISpawnPoint';
export type { ICollider } from './interfaces/ICollider';

// Core subsystems (useful for advanced consumers)
export { InputManager } from './core/InputManager';
export { CameraOperator } from './core/CameraOperator';
export { LoadingManager } from './core/LoadingManager';
