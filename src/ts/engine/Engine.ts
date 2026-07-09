import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { CameraOperator } from './CameraOperator';
import { EngineOptions, ResolvedEngineOptions, resolveEngineOptions } from './EngineOptions';
import type { IWorldParams, EngineContext } from './EngineContext';
import { Emitter, EngineEvents, IControlRow, ScenarioInfo } from './EngineEvents';
import { pass } from 'three/tsl';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

import { CannonDebugRenderer } from '../../lib/cannon/CannonDebugRenderer';
import * as _ from 'lodash';

import { InputManager } from './InputManager';
import * as Utils from './FunctionLibrary';
import { LoadingManager } from './LoadingManager';
import { IWorldEntity } from './interfaces/IWorldEntity';
import { IUpdatable } from './interfaces/IUpdatable';
import { Character } from '../game/characters/Character';
import { Path } from '../game/world/Path';
import { CollisionGroups } from './enums/CollisionGroups';
import { BoxCollider } from './physics/colliders/BoxCollider';
import { TrimeshCollider } from './physics/colliders/TrimeshCollider';
import { Vehicle } from '../game/vehicles/Vehicle';
import { Scenario } from '../game/world/Scenario';
import { Sky } from './world/Sky';
import { Ocean } from './world/Ocean';

export type { IControlRow } from './EngineEvents';
export type { IWorldParams, EngineContext } from './EngineContext';

export class Engine implements EngineContext
{
	public renderer: THREE.WebGPURenderer;
	public camera: THREE.PerspectiveCamera;
	public postProcessing: THREE.PostProcessing;
	public graphicsWorld: THREE.Scene;
	public sky: Sky;
	public physicsWorld: CANNON.World;
	public parallelPairs: object[];
	public physicsFrameRate: number;
	public physicsFrameTime: number;
	public physicsMaxPrediction: number;
	public clock: THREE.Clock;
	public renderDelta: number;
	public logicDelta: number;
	public requestDelta: number;
	public sinceLastFrame: number;
	public justRendered: boolean;
	public params: IWorldParams;
	public inputManager: InputManager;
	public cameraOperator: CameraOperator;
	public timeScaleTarget: number = 1;
	public cannonDebugRenderer: CannonDebugRenderer;
	public scenarios: Scenario[] = [];
	public characters: Character[] = [];
	public vehicles: Vehicle[] = [];
	public paths: Path[] = [];
	public updatables: IUpdatable[] = [];
	public options: ResolvedEngineOptions;

	/** Event bus. The app layer subscribes to render UI (dialogs, menus, HUD). */
	public readonly events = new Emitter<EngineEvents>();
	/** Optional per-frame profiler hook (e.g. a Stats panel), owned by the app. */
	public profiler?: { begin(): void; end(): void };

	private lastScenarioID: string;
	private rafId: number | undefined;
	private running: boolean = false;
	private resizeObserver: ResizeObserver | undefined;
	private readonly boundResize = (): void => this.resize();

	constructor(options: EngineOptions = {})
	{
		this.options = resolveEngineOptions(options);
		const opts = this.options;

		// WebGPURenderer still auto-falls back to WebGL2; the app decides how to
		// surface the warning (deferred to init() so subscribers are attached).
		const webgpuAvailable = WebGPU.isAvailable();

		// Default engine parameters (mutated live by the app-side debug UI).
		this.params = {
			Pointer_Lock: true,
			Mouse_Sensitivity: 0.3,
			Time_Scale: opts.timeScale,
			Shadows: opts.renderer.shadows,
			FXAA: opts.postFX.fxaa,
			Debug_Physics: false,
			Debug_FPS: false,
			Sun_Elevation: 50,
			Sun_Rotation: 145,
		};

		// Renderer
		this.renderer = new THREE.WebGPURenderer({ antialias: opts.renderer.antialias });
		this.renderer.setPixelRatio(opts.renderer.pixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.toneMapping = opts.renderer.toneMapping;
		this.renderer.toneMappingExposure = opts.renderer.toneMappingExposure;
		this.renderer.shadowMap.enabled = opts.renderer.shadows;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Mount the canvas into the configured container.
		opts.container.appendChild(this.renderer.domElement);
		this.renderer.domElement.id = 'canvas';

		// Auto-resize to the container (ResizeObserver) with a window fallback.
		if (opts.autoResize)
		{
			this.resizeObserver = new ResizeObserver(this.boundResize);
			this.resizeObserver.observe(opts.container);
			window.addEventListener('resize', this.boundResize, false);
		}

		// Three.js scene
		this.graphicsWorld = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(opts.camera.fov, window.innerWidth / window.innerHeight, opts.camera.near, opts.camera.far);

		// Post-processing: FXAA as a TSL node pass
		this.postProcessing = new THREE.PostProcessing(this.renderer);
		const scenePass = pass(this.graphicsWorld, this.camera);
		this.postProcessing.outputNode = fxaa(scenePass);

		// Physics
		this.physicsWorld = new CANNON.World();
		this.physicsWorld.gravity.set(opts.physics.gravity[0], opts.physics.gravity[1], opts.physics.gravity[2]);
		this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
		(this.physicsWorld.solver as CANNON.GSSolver).iterations = opts.physics.solverIterations;
		this.physicsWorld.allowSleep = true;

		this.parallelPairs = [];
		this.physicsFrameRate = opts.physics.frameRate;
		this.physicsFrameTime = 1 / this.physicsFrameRate;
		this.physicsMaxPrediction = opts.physics.maxPrediction;

		// RenderLoop
		this.clock = new THREE.Clock();
		this.renderDelta = 0;
		this.logicDelta = 0;
		this.sinceLastFrame = 0;
		this.justRendered = false;

		// Initialization
		this.inputManager = new InputManager(this, this.renderer.domElement);
		this.cameraOperator = new CameraOperator(this, this.camera, this.params.Mouse_Sensitivity);
		this.sky = new Sky(this);
		
		// Load scene if a world is supplied
		if (opts.world !== null)
		{
			const loadingManager = new LoadingManager(this);
			loadingManager.onFinishedCallback = () =>
			{
				this.update(1, 1);
				this.setTimeScale(1);
				this.events.emit('world:loaded', { scenarios: this.getScenarioInfos() });
			};

			if (typeof opts.world === 'string')
			{
				loadingManager.loadGLTF(opts.world, (gltf) =>
				{
					this.loadScene(loadingManager, gltf);
				});
			}
			else
			{
				this.loadScene(loadingManager, opts.world);
			}
		}
		// WebGPURenderer needs async initialization before the first render.
		// Events here are deferred to a microtask so app-side subscribers
		// (attached right after `new World()`) receive them.
		this.renderer.init().then(() =>
		{
			if (!webgpuAvailable) this.events.emit('webgpu:unsupported');
			this.events.emit('ready');
			if (opts.world === null) this.events.emit('world:empty');
			this.resize();
			if (opts.autoStart) this.start();
		});
	}

	/** Update camera + renderer to the current container/window size. */
	public resize(): void
	{
		const container = this.options.container;
		const width = container === document.body ? window.innerWidth : container.clientWidth;
		const height = container === document.body ? window.innerHeight : container.clientHeight;
		if (width === 0 || height === 0) return;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	/** Start the render loop (idempotent). */
	public start(): void
	{
		if (this.running) return;
		this.running = true;
		this.render(this);
	}

	/** Stop the render loop (idempotent). */
	public stop(): void
	{
		this.running = false;
		if (this.rafId !== undefined)
		{
			cancelAnimationFrame(this.rafId);
			this.rafId = undefined;
		}
	}

	/** Stop the loop and release GPU + listener resources. */
	public dispose(): void
	{
		this.stop();
		if (this.resizeObserver !== undefined)
		{
			this.resizeObserver.disconnect();
			this.resizeObserver = undefined;
		}
		window.removeEventListener('resize', this.boundResize);
		this.renderer.dispose();
	}

	/** Subscribe to an engine event; returns an unsubscribe function. */
	public on<K extends keyof EngineEvents>(type: K, cb: (payload: EngineEvents[K]) => void): () => void
	{
		return this.events.on(type, cb);
	}

	/** Unsubscribe from an engine event. */
	public off<K extends keyof EngineEvents>(type: K, cb: (payload: EngineEvents[K]) => void): void
	{
		this.events.off(type, cb);
	}

	/** Snapshot of scenarios for building an app-side menu. */
	public getScenarioInfos(): ScenarioInfo[]
	{
		return this.scenarios.map((s) => ({
			id: s.id,
			name: s.name,
			invisible: s.invisible,
			welcome: s.descriptionTitle !== undefined
				? { title: s.descriptionTitle, content: s.descriptionContent }
				: undefined
		}));
	}

	// Update
	// Handles all logic updates.
	public update(timeStep: number, unscaledTimeStep: number): void
	{
		this.updatePhysics(timeStep);

		// Update registred objects
		this.updatables.forEach((entity) => {
			entity.update(timeStep, unscaledTimeStep);
		});

		// Lerp time scale
		this.params.Time_Scale = THREE.MathUtils.lerp(this.params.Time_Scale, this.timeScaleTarget, 0.2);

		// Physics debug
		if (this.params.Debug_Physics) this.cannonDebugRenderer.update();
	}

	public updatePhysics(timeStep: number): void
	{
		this.characters.forEach((char) => {
			if (char.physicsEnabled) {
				char.physicsPreStep(char.characterCapsule.body, char);
			}
		});

		this.vehicles.forEach((vehicle) => {
			if (vehicle.physicsPreStep) {
				vehicle.physicsPreStep(vehicle.collision, vehicle);
			}
		});

		// Step the physics world
		this.physicsWorld.step(this.physicsFrameTime, timeStep);

		this.characters.forEach((char) => {
			if (char.physicsEnabled) {
				char.physicsPostStep(char.characterCapsule.body, char);
			}
		});

		this.characters.forEach((char) => {
			if (this.isOutOfBounds(char.characterCapsule.body.position))
			{
				this.outOfBoundsRespawn(char.characterCapsule.body);
			}
		});

		this.vehicles.forEach((vehicle) => {
			if (this.isOutOfBounds(vehicle.rayCastVehicle.chassisBody.position))
			{
				const worldPos = new THREE.Vector3();
				vehicle.spawnPoint.getWorldPosition(worldPos);
				worldPos.y += 1;
				this.outOfBoundsRespawn(vehicle.rayCastVehicle.chassisBody, Utils.cannonVector(worldPos));
			}
		});
	}

	public isOutOfBounds(position: CANNON.Vec3): boolean
	{
		const bounds = this.options.bounds;
		if (bounds === null) return false;

		const inside = position.x > bounds.min.x && position.x < bounds.max.x &&
					position.z > bounds.min.z && position.z < bounds.max.z &&
					position.y > bounds.min.y;
		const belowSeaLevel = position.y < bounds.seaLevel;

		return !inside && belowSeaLevel;
	}

	public outOfBoundsRespawn(body: CANNON.Body, position?: CANNON.Vec3): void
	{
		const r = this.options.respawn.position;
		const newPos = position || new CANNON.Vec3(r.x, r.y, r.z);
		const newQuat = new CANNON.Quaternion(0, 0, 0, 1);

		body.position.copy(newPos);
		body.interpolatedPosition.copy(newPos);
		body.quaternion.copy(newQuat);
		body.interpolatedQuaternion.copy(newQuat);
		body.velocity.setZero();
		body.angularVelocity.setZero();
	}

	/**
	 * Rendering loop.
	 * Implements fps limiter and frame-skipping
	 * Calls the engine's "update" function before rendering.
	 * @param {Engine} world
	 */
	public render(world: Engine): void
	{
		if (!this.running) return;

		this.requestDelta = this.clock.getDelta();

		this.rafId = requestAnimationFrame(() =>
		{
			world.render(world);
		});

		// Getting timeStep
		const unscaledTimeStep = (this.requestDelta + this.renderDelta + this.logicDelta) ;
		let timeStep = unscaledTimeStep * this.params.Time_Scale;
		timeStep = Math.min(timeStep, 1 / 30);    // min 30 fps

		// Logic
		world.update(timeStep, unscaledTimeStep);

		// Measuring logic time
		this.logicDelta = this.clock.getDelta();

		// Frame limiting
		const interval = 1 / 60;
		this.sinceLastFrame += this.requestDelta + this.renderDelta + this.logicDelta;
		this.sinceLastFrame %= interval;

		// Profiler (e.g. Stats panel, owned by the app)
		this.profiler?.end();
		this.profiler?.begin();

		// Actual rendering with a FXAA ON/OFF switch. Skip while the canvas has
		// no size yet (e.g. an embed/iframe before first layout) to avoid
		// zero-size swapchain/depth-buffer errors; the loop recovers on resize.
		const canvas = this.renderer.domElement;
		if (canvas.width > 0 && canvas.height > 0)
		{
			if (this.params.FXAA) this.postProcessing.render();
			else this.renderer.render(this.graphicsWorld, this.camera);
		}

		// Measuring render time
		this.renderDelta = this.clock.getDelta();
	}

	/** Resolve a named sub-asset (e.g. 'boxman.glb') against the configured asset base URL. */
	public resolveAsset(name: string): string
	{
		return this.options.assetBaseUrl + name;
	}

	public setTimeScale(value: number): void
	{
		this.params.Time_Scale = value;
		this.timeScaleTarget = value;
	}

	public add(worldEntity: IWorldEntity): void
	{
		worldEntity.addToWorld(this);
		this.registerUpdatable(worldEntity);
	}

	public registerUpdatable(registree: IUpdatable): void
	{
		this.updatables.push(registree);
		this.updatables.sort((a, b) => (a.updateOrder > b.updateOrder) ? 1 : -1);
	}

	public remove(worldEntity: IWorldEntity): void
	{
		worldEntity.removeFromWorld(this);
		this.unregisterUpdatable(worldEntity);
	}

	public unregisterUpdatable(registree: IUpdatable): void
	{
		_.pull(this.updatables, registree);
	}

	public loadScene(loadingManager: LoadingManager, gltf: GLTF): void
	{
		gltf.scene.updateMatrixWorld(true);
		
		gltf.scene.traverse((child: THREE.Object3D) => {
			if (Object.hasOwn(child, 'userData'))
			{
				if (child.type === 'Mesh')
				{
					Utils.setupMeshProperties(child);

					if (((child as THREE.Mesh).material as THREE.Material).name === 'ocean')
					{
						this.registerUpdatable(new Ocean(child, this));
					}
				}

				if (Object.hasOwn(child.userData, 'data'))
				{
					if (child.userData.data === 'physics')
					{
						if (Object.hasOwn(child.userData, 'type')) 
						{
							// Convex doesn't work! Stick to boxes!
							if (child.userData.type === 'box')
							{
								const worldScale = child.getWorldScale(new THREE.Vector3());
								const phys = new BoxCollider({size: new THREE.Vector3(worldScale.x, worldScale.y, worldScale.z)});
								phys.body.position.copy(Utils.cannonVector(child.getWorldPosition(new THREE.Vector3())));
								phys.body.quaternion.copy(Utils.cannonQuat(child.getWorldQuaternion(new THREE.Quaternion())));
								phys.body.updateAABB();

								phys.body.shapes.forEach((shape) => {
									shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
								});

								this.physicsWorld.addBody(phys.body);
							}
							else if (child.userData.type === 'trimesh')
							{
								child.traverse((node: THREE.Object3D) => {
									if ((node as THREE.Mesh).isMesh) {
										const phys = new TrimeshCollider(node, {});
										if (phys.body) this.physicsWorld.addBody(phys.body);
									}
								});
							}

							child.visible = false;
						}
					}

					if (child.userData.data === 'path')
					{
						this.paths.push(new Path(child));
					}

					if (child.userData.data === 'scenario')
					{
						this.scenarios.push(new Scenario(child, this));
					}
				}
			}
		});

		this.graphicsWorld.add(gltf.scene);

		// Launch default scenario
		let defaultScenarioID: string;
		for (const scenario of this.scenarios) {
			if (scenario.default) {
				defaultScenarioID = scenario.id;
				break;
			}
		}
		if (defaultScenarioID !== undefined) this.launchScenario(defaultScenarioID, loadingManager);
	}
	
	public launchScenario(scenarioID: string, loadingManager?: LoadingManager): void
	{
		this.lastScenarioID = scenarioID;

		this.clearEntities();

		if (!loadingManager) loadingManager = new LoadingManager(this);

		let launched: Scenario | undefined;
		for (const scenario of this.scenarios) {
			if (scenario.id === scenarioID || scenario.spawnAlways) {
				scenario.launch(loadingManager, this);
				if (scenario.id === scenarioID) launched = scenario;
			}
		}

		// Point the camera at the launched scenario's initial angle.
		if (launched !== undefined && !launched.spawnAlways && launched.initialCameraAngle !== undefined)
		{
			this.cameraOperator.theta = launched.initialCameraAngle;
			this.cameraOperator.phi = 15;
		}

		// Announce completion once all scenario assets finish loading. Guarded so
		// the initial world-load welcome (set in the constructor) is not clobbered.
		if (loadingManager.onFinishedCallback === undefined)
		{
			const welcome = (launched !== undefined && !launched.spawnAlways && launched.descriptionTitle !== undefined)
				? { title: launched.descriptionTitle, content: launched.descriptionContent }
				: undefined;
			loadingManager.onFinishedCallback = () =>
			{
				this.setTimeScale(1);
				this.events.emit('scenario:launched', { id: scenarioID, welcome });
			};
		}
	}

	public restartScenario(): void
	{
		if (this.lastScenarioID !== undefined)
		{
			document.exitPointerLock();
			this.launchScenario(this.lastScenarioID);
		}
		else
		{
			console.warn('Can\'t restart scenario. Last scenarioID is undefined.');
		}
	}

	public clearEntities(): void
	{
		for (let i = 0; i < this.characters.length; i++) {
			this.remove(this.characters[i]);
			i--;
		}

		for (let i = 0; i < this.vehicles.length; i++) {
			this.remove(this.vehicles[i]);
			i--;
		}
	}

	public scrollTheTimeScale(scrollAmount: number): void
	{
		// Changing time scale with scroll wheel
		const timeScaleBottomLimit = 0.003;
		const timeScaleChangeSpeed = 1.3;
	
		if (scrollAmount > 0)
		{
			this.timeScaleTarget /= timeScaleChangeSpeed;
			if (this.timeScaleTarget < timeScaleBottomLimit) this.timeScaleTarget = 0;
		}
		else
		{
			this.timeScaleTarget *= timeScaleChangeSpeed;
			if (this.timeScaleTarget < timeScaleBottomLimit) this.timeScaleTarget = timeScaleBottomLimit;
			this.timeScaleTarget = Math.min(this.timeScaleTarget, 1);
		}
	}

	/** Broadcast the current control hints; the app renders them into the HUD. */
	public updateControls(controls: IControlRow[]): void
	{
		this.events.emit('controls:changed', controls);
	}

	/** Toggle the cannon-es physics debug wireframes (and character raycast boxes). */
	public setDebugPhysics(enabled: boolean): void
	{
		if (enabled)
		{
			this.cannonDebugRenderer = new CannonDebugRenderer(this.graphicsWorld, this.physicsWorld);
		}
		else if (this.cannonDebugRenderer !== undefined)
		{
			this.cannonDebugRenderer.clearMeshes();
			this.cannonDebugRenderer = undefined;
		}

		this.characters.forEach((char) =>
		{
			char.raycastBox.visible = enabled;
		});
	}
}

/** Convenience factory mirroring `new Engine(options)`. */
export function createEngine(options?: EngineOptions): Engine
{
	return new Engine(options);
}