import type * as THREE from 'three';
import type * as CANNON from 'cannon-es';

import type { CameraOperator } from './CameraOperator';
import type { InputManager } from './InputManager';
import type { LoadingManager } from './LoadingManager';
import type { Emitter, EngineEvents, IControlRow } from './EngineEvents';
import type { ResolvedEngineOptions } from './EngineOptions';
import type { IUpdatable } from '../interfaces/IUpdatable';
import type { IWorldEntity } from '../interfaces/IWorldEntity';
import type { Sky } from '../world/Sky';
import type { Path } from '../world/Path';
import type { Scenario } from '../world/Scenario';
import type { Character } from '../characters/Character';
import type { Vehicle } from '../vehicles/Vehicle';

/** Live, mutable engine parameters (driven by the app-side debug UI). */
export interface IWorldParams
{
	Pointer_Lock: boolean;
	Mouse_Sensitivity: number;
	Time_Scale: number;
	Shadows: boolean;
	FXAA: boolean;
	Debug_Physics: boolean;
	Debug_FPS: boolean;
	Sun_Elevation: number;
	Sun_Rotation: number;
}

/**
 * The contract entities and subsystems depend on instead of the concrete
 * engine. Breaking the entity -> World import cycle (entities `import type`
 * this) is what lets the engine and game layers separate.
 *
 * NOTE: this is currently a single comprehensive surface. The pure
 * engine-only vs. game-only split (EngineContext / GameContext) lands with the
 * directory split in a later phase.
 */
export interface EngineContext
{
	// Rendering / scene
	readonly graphicsWorld: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;

	// Physics
	readonly physicsWorld: CANNON.World;
	readonly physicsFrameRate: number;
	readonly physicsFrameTime: number;

	// Subsystems
	readonly cameraOperator: CameraOperator;
	readonly inputManager: InputManager;
	readonly sky: Sky;

	// State
	readonly events: Emitter<EngineEvents>;
	readonly options: ResolvedEngineOptions;
	params: IWorldParams;
	timeScaleTarget: number;

	// Content collections
	readonly characters: Character[];
	readonly vehicles: Vehicle[];
	readonly paths: Path[];
	readonly scenarios: Scenario[];

	// Entity management
	add(entity: IWorldEntity): void;
	remove(entity: IWorldEntity): void;
	registerUpdatable(registree: IUpdatable): void;
	unregisterUpdatable(registree: IUpdatable): void;

	// Control
	setTimeScale(value: number): void;
	scrollTheTimeScale(scrollAmount: number): void;
	updateControls(controls: IControlRow[]): void;
	resolveAsset(name: string): string;
	launchScenario(scenarioID: string, loadingManager?: LoadingManager): void;
	restartScenario(): void;
}
