import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as _ from 'lodash';
import * as Utils from '../../engine/FunctionLibrary';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { KeyBinding } from '../../engine/KeyBinding';
import { OrbitCameraMode } from '../../engine/camera/OrbitCameraMode';
import { FirstPersonCameraMode } from '../../engine/camera/FirstPersonCameraMode';
import { cameraTuning } from '../config/cameraTuning';
import type { Ability } from '../../engine/abilities/Ability';
import { VectorSpringSimulator } from '../../engine/physics/spring_simulation/VectorSpringSimulator';
import { RelativeSpringSimulator } from '../../engine/physics/spring_simulation/RelativeSpringSimulator';
import { Idle } from './character_states/Idle';
import { EnteringVehicle } from './character_states/vehicles/EnteringVehicle';
import { ExitingVehicle } from './character_states/vehicles/ExitingVehicle';
import { OpenVehicleDoor as OpenVehicleDoor } from './character_states/vehicles/OpenVehicleDoor';
import { Driving } from './character_states/vehicles/Driving';
import { ExitingAirplane } from './character_states/vehicles/ExitingAirplane';
import { ICharacterAI } from '../interfaces/ICharacterAI';
import type { EngineContext } from '../../engine/EngineContext';
import { IControllable } from '../interfaces/IControllable';
import { ICharacterState } from '../interfaces/ICharacterState';
import { IWorldEntity } from '../../engine/interfaces/IWorldEntity';
import { VehicleSeat } from '../vehicles/VehicleSeat';
import { Vehicle } from '../vehicles/Vehicle';
import { CollisionGroups } from '../../engine/enums/CollisionGroups';
import { CapsuleCollider } from '../../engine/physics/colliders/CapsuleCollider';
import { VehicleEntryInstance } from './VehicleEntryInstance';
import { SeatType } from '../enums/SeatType';
import { GroundImpactData } from './GroundImpactData';
import { ClosestObjectFinder } from '../../engine/ClosestObjectFinder';
import { Object3D } from 'three';
import { EntityType } from '../enums/EntityType';

export class Character extends THREE.Object3D implements IWorldEntity
{
	public updateOrder: number = 1;
	public entityType: EntityType = EntityType.Character;

	public height: number = 0;
	public tiltContainer: THREE.Group;
	public modelContainer: THREE.Group;
	public materials: THREE.Material[] = [];
	public mixer: THREE.AnimationMixer;
	/** Head bone, pitched toward the camera aim so the body visibly looks up/down. */
	private headBone?: THREE.Object3D;
	/** Arm bones (real model), posed forward to "aim" in the aim views and fire from. */
	private armUpperR?: THREE.Object3D;
	private armLowerR?: THREE.Object3D;
	private armUpperL?: THREE.Object3D;
	private armLowerL?: THREE.Object3D;
	/** Per-hand recoil timers (seconds), kicked on cast. */
	private rightRecoil: number = 0;
	private leftRecoil: number = 0;

	// Aim pose + camera offsets live in the shared `cameraTuning` config (read
	// every frame, bound to the debug GUI for live tuning).
	private static readonly RECOIL_TIME = 0.15;
	/** Bone length axis in local space (armature bones run along +Y). */
	private static readonly BONE_AXIS = new THREE.Vector3(0, 1, 0);
	// Scratch objects for the world-space arm aiming (avoid per-frame allocation).
	private readonly aimLook = new THREE.Vector3();
	private readonly aimDir = new THREE.Vector3();
	private readonly aimRight = new THREE.Vector3();
	private readonly aimQ1 = new THREE.Quaternion();
	private readonly aimQ2 = new THREE.Quaternion();

	// Movement
	public acceleration: THREE.Vector3 = new THREE.Vector3();
	public velocity: THREE.Vector3 = new THREE.Vector3();
	public arcadeVelocityInfluence: THREE.Vector3 = new THREE.Vector3();
	public velocityTarget: THREE.Vector3 = new THREE.Vector3();
	public arcadeVelocityIsAdditive: boolean = false;

	public defaultVelocitySimulatorDamping: number = 0.8;
	public defaultVelocitySimulatorMass: number = 50;
	public velocitySimulator: VectorSpringSimulator;
	public moveSpeed: number = 4;
	public angularVelocity: number = 0;
	public orientation: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
	public orientationTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
	public defaultRotationSimulatorDamping: number = 0.5;
	public defaultRotationSimulatorMass: number = 10;
	public rotationSimulator: RelativeSpringSimulator;
	public viewVector: THREE.Vector3;
	public actions: { [action: string]: KeyBinding };

	/** Active on-foot camera view. Cycled with V. */
	public viewMode: 'third' | 'shoulder' | 'first' = 'third';
	/** Eye height above the character origin, used only as a no-head-bone fallback. */
	public firstPersonEyeHeight: number = 0.6;

	/** True while in the first-person view (camera at the eye, body hidden). */
	public get firstPerson(): boolean { return this.viewMode === 'first'; }

	/** Dual-wield loadout: an ability per hand, each with its own cooldown timer. */
	public rightHandAbility?: Ability;
	public leftHandAbility?: Ability;
	private rightCooldown: number = 0;
	private leftCooldown: number = 0;
	private rightOrb?: THREE.Object3D;
	private leftOrb?: THREE.Object3D;
	public characterCapsule: CapsuleCollider;
	
	// Ray casting
	public rayResult: CANNON.RaycastResult = new CANNON.RaycastResult();
	public rayHasHit: boolean = false;
	public rayCastLength: number = 0.57;
	public raySafeOffset: number = 0.03;
	public wantsToJump: boolean = false;
	public initJumpSpeed: number = -1;
	public groundImpactData: GroundImpactData = new GroundImpactData();
	public raycastBox: THREE.Mesh;
	
	public world: EngineContext;
	public charState: ICharacterState;
	public behaviour: ICharacterAI;
	
	// Vehicles
	public controlledObject: IControllable;
	public occupyingSeat: VehicleSeat = null;
	public vehicleEntryInstance: VehicleEntryInstance = null;
	
	public physicsEnabled: boolean = true;

	constructor(gltf: GLTF)
	{
		super();

		const model = gltf;
		this.readCharacterData(model);
		this.setAnimations(model.animations);

		// The visuals group is centered for easy character tilting
		this.tiltContainer = new THREE.Group();
		this.add(this.tiltContainer);

		// Model container is used to reliably ground the character, as animation can alter the position of the model itself
		this.modelContainer = new THREE.Group();
		this.modelContainer.position.y = -0.57;
		this.tiltContainer.add(this.modelContainer);
		this.modelContainer.add(model.scene);
		this.headBone = model.scene.getObjectByName('head') ?? undefined;
		this.armUpperR = model.scene.getObjectByName('arm_upperR') ?? undefined;
		this.armLowerR = model.scene.getObjectByName('arm_lowerR') ?? undefined;
		this.armUpperL = model.scene.getObjectByName('arm_upperL') ?? undefined;
		this.armLowerL = model.scene.getObjectByName('arm_lowerL') ?? undefined;

		this.mixer = new THREE.AnimationMixer(model.scene);

		this.velocitySimulator = new VectorSpringSimulator(60, this.defaultVelocitySimulatorMass, this.defaultVelocitySimulatorDamping);
		this.rotationSimulator = new RelativeSpringSimulator(60, this.defaultRotationSimulatorMass, this.defaultRotationSimulatorDamping);

		this.viewVector = new THREE.Vector3();

		// Actions
		this.actions = {
			'up': new KeyBinding('KeyW'),
			'down': new KeyBinding('KeyS'),
			'left': new KeyBinding('KeyA'),
			'right': new KeyBinding('KeyD'),
			'run': new KeyBinding('ShiftLeft'),
			'jump': new KeyBinding('Space'),
			'use': new KeyBinding('KeyE'),
			'enter': new KeyBinding('KeyF'),
			'enter_passenger': new KeyBinding('KeyG'),
			'seat_switch': new KeyBinding('KeyX'),
			'primary': new KeyBinding('mouse0'),
			'secondary': new KeyBinding('mouse1'),
		};

		// Physics
		// Player Capsule
		this.characterCapsule = new CapsuleCollider({
			mass: 1,
			position: new CANNON.Vec3(),
			height: 0.5,
			radius: 0.25,
			segments: 8,
			friction: 0.0
		});
		// capsulePhysics.physical.collisionFilterMask = ~CollisionGroups.Trimesh;
		this.characterCapsule.body.shapes.forEach((shape) => {
			// tslint:disable-next-line: no-bitwise
			shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
		});
		this.characterCapsule.body.allowSleep = false;

		// Move character to different collision group for raycasting
		this.characterCapsule.body.collisionFilterGroup = 2;

		// Disable character rotation
		this.characterCapsule.body.fixedRotation = true;
		this.characterCapsule.body.updateMassProperties();

		// Ray cast debug
		const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		const boxMat = new THREE.MeshLambertMaterial({
			color: 0xff0000
		});
		this.raycastBox = new THREE.Mesh(boxGeo, boxMat);
		this.raycastBox.visible = false;

		// Physics pre/post step callback bindings handled by World.ts
		this.setState(new Idle(this));
	}

	public setAnimations(animations: THREE.AnimationClip[]): void
	{
		this.animations = animations;
	}

	public setArcadeVelocityInfluence(x: number, y: number = x, z: number = x): void
	{
		this.arcadeVelocityInfluence.set(x, y, z);
	}

	public setViewVector(vector: THREE.Vector3): void
	{
		this.viewVector.copy(vector).normalize();
	}

	/**
	 * Set state to the player. Pass state class (function) name.
	 * @param {function} State 
	 */
	public setState(state: ICharacterState): void
	{
		this.charState = state;
		this.charState.onInputChange();
	}

	public setPosition(x: number, y: number, z: number): void
	{
		if (this.physicsEnabled)
		{
			this.characterCapsule.body.previousPosition = new CANNON.Vec3(x, y, z);
			this.characterCapsule.body.position = new CANNON.Vec3(x, y, z);
			this.characterCapsule.body.interpolatedPosition = new CANNON.Vec3(x, y, z);
		}
		else
		{
			this.position.x = x;
			this.position.y = y;
			this.position.z = z;
		}
	}

	public resetVelocity(): void
	{
		this.velocity.x = 0;
		this.velocity.y = 0;
		this.velocity.z = 0;

		this.characterCapsule.body.velocity.x = 0;
		this.characterCapsule.body.velocity.y = 0;
		this.characterCapsule.body.velocity.z = 0;

		this.velocitySimulator.init();
	}

	public setArcadeVelocityTarget(velZ: number, velX: number = 0, velY: number = 0): void
	{
		this.velocityTarget.z = velZ;
		this.velocityTarget.x = velX;
		this.velocityTarget.y = velY;
	}

	public setOrientation(vector: THREE.Vector3, instantly: boolean = false): void
	{
		const lookVector = new THREE.Vector3().copy(vector).setY(0).normalize();
		this.orientationTarget.copy(lookVector);
		
		if (instantly)
		{
			this.orientation.copy(lookVector);
		}
	}

	public resetOrientation(): void
	{
		const forward = Utils.getForward(this);
		this.setOrientation(forward, true);
	}

	public setBehaviour(behaviour: ICharacterAI): void
	{
		behaviour.character = this;
		this.behaviour = behaviour;
	}

	public setPhysicsEnabled(value: boolean): void {
		this.physicsEnabled = value;

		if (value === true)
		{
			this.world.physicsWorld.addBody(this.characterCapsule.body);
		}
		else
		{
			this.world.physicsWorld.removeBody(this.characterCapsule.body);
		}
	}

	public readCharacterData(gltf: GLTF): void
	{
		gltf.scene.traverse((child) => {

			const mesh = child as THREE.Mesh;
			if (mesh.isMesh)
			{
				Utils.setupMeshProperties(child);

				if (mesh.material !== undefined)
				{
					this.materials.push(mesh.material as THREE.Material);
				}
			}
		});
	}

	public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleKeyboardEvent(event, code, pressed);
		}
		else
		{
			// Free camera
			if (code === 'KeyC' && pressed === true && event.shiftKey === true)
			{
				this.resetControls();
				this.modelContainer.visible = true; // reveal the body while flying
				this.world.viewmodel.enabled = false; // no hands in free camera
				this.world.events.emit('aim:changed', { aiming: false });
				this.world.cameraOperator.characterCaller = this;
				this.world.inputManager.setInputReceiver(this.world.cameraOperator);
			}
			else if (code === 'KeyV' && pressed === true)
			{
				this.cycleView();
			}
			else if (code === 'KeyR' && pressed === true && event.shiftKey === true)
			{
				this.world.restartScenario();
			}
			else
			{
				for (const action in this.actions) {
					if (Object.hasOwn(this.actions, action)) {
						const binding = this.actions[action];
	
						if (_.includes(binding.eventCodes, code))
						{
							this.triggerAction(action, pressed);
						}
					}
				}
			}
		}
	}

	public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseButton(event, code, pressed);
		}
		else
		{
			for (const action in this.actions) {
				if (Object.hasOwn(this.actions, action)) {
					const binding = this.actions[action];

					if (_.includes(binding.eventCodes, code))
					{
						this.triggerAction(action, pressed);
					}
				}
			}
		}
	}

	public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseMove(event, deltaX, deltaY);
		}
		else
		{
			this.world.cameraOperator.move(deltaX, deltaY);
		}
	}
	
	public handleMouseWheel(event: WheelEvent, value: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseWheel(event, value);
		}
		else
		{
			this.world.scrollTheTimeScale(value);
		}
	}

	public triggerAction(actionName: string, value: boolean): void
	{
		// Get action and set it's parameters
		const action = this.actions[actionName];

		if (action.isPressed !== value)
		{
			// Set value
			action.isPressed = value;

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;

			// Set the 'just' attributes
			if (value) action.justPressed = true;
			else action.justReleased = true;

			// Cast dual-wield abilities on press (Skyrim mapping: LMB = right
			// hand, RMB = left hand). Only fires on-foot (in a vehicle these
			// actions are routed to the controlled object instead).
			if (value)
			{
				if (actionName === 'primary') this.castHand('right');
				else if (actionName === 'secondary') this.castHand('left');
			}

			// Tell player to handle states according to new input
			this.charState.onInputChange();

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;
		}
	}

	public takeControl(): void
	{
		if (this.world !== undefined)
		{
			this.world.inputManager.setInputReceiver(this);
		}
		else
		{
			console.warn('Attempting to take control of a character that doesn\'t belong to a world.');
		}
	}

	public resetControls(): void
	{
		for (const action in this.actions) {
			if (Object.hasOwn(this.actions, action)) {
				this.triggerAction(action, false);
			}
		}
	}

	public update(timeStep: number): void
	{
		if (this.rightCooldown > 0) this.rightCooldown = Math.max(0, this.rightCooldown - timeStep);
		if (this.leftCooldown > 0) this.leftCooldown = Math.max(0, this.leftCooldown - timeStep);

		this.behaviour?.update(timeStep);
		this.vehicleEntryInstance?.update(timeStep);
		// console.log(this.occupyingSeat);
		this.charState?.update(timeStep);

		// Aim views strafe: the body faces the look, so redirect the forward-only
		// velocity target onto the full 2D input (W/S + A/D). Rotated by the
		// look-facing orientation in physicsPreStep, this yields camera-relative
		// movement in every direction. (Third-person keeps walk-where-you-point.)
		if (this.viewMode !== 'third')
		{
			const speed = this.velocityTarget.length();
			this.velocityTarget.copy(this.getLocalMovementDirection()).multiplyScalar(speed);
		}

		// this.visuals.position.copy(this.modelOffset);
		if (this.physicsEnabled) this.springMovement(timeStep);
		if (this.physicsEnabled) this.springRotation(timeStep);
		if (this.physicsEnabled) this.rotateModel();
		if (this.mixer !== undefined) this.mixer.update(timeStep);

		// Pitch the head toward the camera aim (applied after the mixer so it
		// layers on top of the current animation pose, which resets each frame).
		if (this.headBone !== undefined)
		{
			// Ease off the pitch in first person so it doesn't wobble the
			// head-mounted camera; keep it for the visible body otherwise.
			const factor = this.firstPerson ? 0.15 : 0.6;
			const aim = THREE.MathUtils.degToRad(this.world.cameraOperator.phi) * factor;
			this.headBone.rotateX(aim);
		}

		// Pose the real arms into a forward "aim" stance in the aim views (also
		// post-mixer). Fires-from and recoil live here too.
		this.poseArms(timeStep);

		// Sync physics/graphics
		if (this.physicsEnabled)
		{
			this.position.set(
				this.characterCapsule.body.interpolatedPosition.x,
				this.characterCapsule.body.interpolatedPosition.y,
				this.characterCapsule.body.interpolatedPosition.z
			);
		}
		else {
			const newPos = new THREE.Vector3();
			this.getWorldPosition(newPos);

			this.characterCapsule.body.position.copy(Utils.cannonVector(newPos));
			this.characterCapsule.body.interpolatedPosition.copy(Utils.cannonVector(newPos));
		}

		this.updateMatrixWorld();
	}

	public inputReceiverInit(): void
	{
		if (this.controlledObject !== undefined)
		{
			this.world.viewmodel.enabled = false; // no hands while controlling a vehicle
			this.world.cameraOperator.setShoulder(0, true); // no shoulder pan in a vehicle
			this.world.events.emit('aim:changed', { aiming: false });
			this.controlledObject.inputReceiverInit();
			return;
		}

		this.applyViewMode();
		// this.world.dirLight.target = this;

		// Equip default dual-wield powers (if the demo registered them).
		if (this.rightHandAbility === undefined && this.world.abilities.has('fire-bolt')) this.equip('right', 'fire-bolt');
		if (this.leftHandAbility === undefined && this.world.abilities.has('frost-bolt')) this.equip('left', 'frost-bolt');

		this.displayControls();
	}

	public displayControls(): void
	{
		this.world.updateControls([
			{
				keys: ['W', 'A', 'S', 'D'],
				desc: 'Movement'
			},
			{
				keys: ['Shift'],
				desc: 'Sprint'
			},
			{
				keys: ['Space'],
				desc: 'Jump'
			},
			{
				keys: ['F', 'or', 'G'],
				desc: 'Enter vehicle'
			},
			{
				keys: ['LMB', 'or', 'RMB'],
				desc: 'Cast right / left hand'
			},
			{
				keys: ['V'],
				desc: 'Cycle view (3rd / shoulder / 1st)'
			},
			{
				keys: ['Shift', '+', 'R'],
				desc: 'Respawn'
			},
			{
				keys: ['Shift', '+', 'C'],
				desc: 'Free camera'
			},
		]);
	}

	public inputReceiverUpdate(timeStep: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.inputReceiverUpdate(timeStep);
			return;
		}

		const op = this.world.cameraOperator;

		// View direction: the aim views (over-shoulder + first-person) look along
		// the operator yaw/pitch so the body + movement track the cursor; plain
		// third-person looks from the camera toward the character.
		if (this.viewMode !== 'third')
		{
			op.getForward(this.viewVector);
		}
		else
		{
			this.viewVector = new THREE.Vector3().subVectors(this.position, this.world.camera.position);
		}

		// Camera anchor. The aim views (over-shoulder + first-person) mount on the
		// head bone, so the view sits at head height and shakes naturally with the
		// animation; third-person orbits the body origin. Force the head's world
		// matrix current (the mixer runs in update()) before reading it.
		if (this.viewMode !== 'third' && this.headBone !== undefined)
		{
			this.headBone.updateWorldMatrix(true, false);
			this.headBone.getWorldPosition(op.target);
			if (this.firstPerson)
			{
				// Sit at the eyes and nudge to the front of the head so the raised
				// arms read as first-person hands and the head geometry doesn't clip.
				op.target.y += cameraTuning.fpEyeRaise;
				op.target.addScaledVector(this.viewVector, cameraTuning.fpEyeForward);
			}
			else
			{
				// Over-shoulder: high orbit centre for a raised, looking-down framing.
				op.target.y += cameraTuning.shoulderHeadHeight;
			}
		}
		else
		{
			this.getWorldPosition(op.target);
			if (this.firstPerson) op.target.y += this.firstPersonEyeHeight;
		}

		// In the aim views keep the whole body yawed to the look every frame
		// (the idle states don't call this, so the body would otherwise only turn
		// while moving).
		if (this.viewMode !== 'third') this.setCameraRelativeOrientationTarget();
	}

	public setAnimation(clipName: string, fadeIn: number): number
	{
		if (this.mixer !== undefined)
		{
			// gltf
			const clip = THREE.AnimationClip.findByName( this.animations, clipName );

			const action = this.mixer.clipAction(clip);
			if (action === null)
			{
				console.error(`Animation ${clipName} not found!`);
				return 0;
			}

			this.mixer.stopAllAction();
			action.fadeIn(fadeIn);
			action.play();

			return action.getClip().duration;
		}
	}

	public springMovement(timeStep: number): void
	{
		// Simulator
		this.velocitySimulator.target.copy(this.velocityTarget);
		this.velocitySimulator.simulate(timeStep);

		// Update values
		this.velocity.copy(this.velocitySimulator.position);
		this.acceleration.copy(this.velocitySimulator.velocity);
	}

	public springRotation(timeStep: number): void
	{
		// Spring rotation
		// Figure out angle between current and target orientation
		const angle = Utils.getSignedAngleBetweenVectors(this.orientation, this.orientationTarget);

		// Simulator
		this.rotationSimulator.target = angle;
		this.rotationSimulator.simulate(timeStep);
		const rot = this.rotationSimulator.position;

		// Updating values
		this.orientation.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
		this.angularVelocity = this.rotationSimulator.velocity;
	}

	public getLocalMovementDirection(): THREE.Vector3
	{
		const positiveX = this.actions.right.isPressed ? -1 : 0;
		const negativeX = this.actions.left.isPressed ? 1 : 0;
		const positiveZ = this.actions.up.isPressed ? 1 : 0;
		const negativeZ = this.actions.down.isPressed ? -1 : 0;

		return new THREE.Vector3(positiveX + negativeX, 0, positiveZ + negativeZ).normalize();
	}

	public getCameraRelativeMovementVector(): THREE.Vector3
	{
		const localDirection = this.getLocalMovementDirection();
		const flatViewVector = new THREE.Vector3(this.viewVector.x, 0, this.viewVector.z).normalize();

		return Utils.appplyVectorMatrixXZ(flatViewVector, localDirection);
	}

	public setCameraRelativeOrientationTarget(): void
	{
		if (this.vehicleEntryInstance !== null) return;

		// Aim views (over-shoulder + first-person): the whole body faces where the
		// camera looks (flattened yaw), turning with the cursor even when standing
		// still. Movement is look-relative (W forward, A/D strafe).
		if (this.viewMode !== 'third')
		{
			const flatLook = new THREE.Vector3(this.viewVector.x, 0, this.viewVector.z);
			if (flatLook.lengthSq() > 0)
			{
				flatLook.normalize();
				this.setOrientation(flatLook);
			}
			return;
		}

		// Third-person: the body turns to face the camera-relative input and
		// walks forward along it (classic movement-facing).
		const moveVector = this.getCameraRelativeMovementVector();

		if (moveVector.x === 0 && moveVector.y === 0 && moveVector.z === 0)
		{
			this.setOrientation(this.orientation);
		}
		else
		{
			this.setOrientation(moveVector);
		}
	}

	/** Cycle the on-foot view: third -> over-shoulder -> first -> third. */
	public cycleView(): void
	{
		const order: Array<'third' | 'shoulder' | 'first'> = ['third', 'shoulder', 'first'];
		this.setViewMode(order[(order.indexOf(this.viewMode) + 1) % order.length]);
	}

	/** Switch to a specific on-foot view (no-op if already there). */
	public setViewMode(mode: 'third' | 'shoulder' | 'first'): void
	{
		if (this.viewMode === mode) return;
		this.viewMode = mode;
		this.applyViewMode();
	}

	/** Backwards-compatible helper: enter first person, or return to third. */
	public setFirstPerson(enabled: boolean): void
	{
		this.setViewMode(enabled ? 'first' : 'third');
	}

	/**
	 * Apply camera mode, radius, shoulder pan, body visibility, and viewmodel
	 * for the current view. Radius/shoulder use lerped (non-instant) setters so
	 * third <-> over-shoulder glides; first-person swaps the camera mode.
	 */
	private applyViewMode(): void
	{
		const op = this.world.cameraOperator;

		// Reticle shows in the aim views (over-shoulder + first-person).
		this.world.events.emit('aim:changed', { aiming: this.viewMode !== 'third' });

		if (this.viewMode === 'first')
		{
			op.setRadius(0, true);
			op.setShoulder(0, true);
			op.setMode(new FirstPersonCameraMode());
			// Body stays visible: the real arms (posed in poseArms) are the
			// first-person hands, seen from the head-mounted camera.
			this.modelContainer.visible = true;
			return;
		}

		op.setMode(new OrbitCameraMode());
		this.modelContainer.visible = true;

		if (this.viewMode === 'shoulder')
		{
			op.setRadius(1.3, false);
			op.setShoulder(0.5, false);
		}
		else // third
		{
			op.setRadius(1.6, false);
			op.setShoulder(0, false);
		}
	}

	/**
	 * Pose the real arm bones into a forward "aim" stance while in an aim view
	 * (over-shoulder / first-person), overriding the animation for those bones
	 * only. Runs post-mixer. Points each bone's length axis (+Y) along the aim
	 * direction so the hands always reach forward regardless of the rig's rest
	 * orientation (no per-bone Euler tuning).
	 */
	private poseArms(timeStep: number): void
	{
		if (this.rightRecoil > 0) this.rightRecoil = Math.max(0, this.rightRecoil - timeStep);
		if (this.leftRecoil > 0) this.leftRecoil = Math.max(0, this.leftRecoil - timeStep);

		if (this.viewMode === 'third') return; // arms animate normally otherwise

		// Aim direction = where the player looks / where bolts fire.
		this.world.cameraOperator.getForward(this.aimLook);
		this.aimArm(this.armUpperR, this.armLowerR, 1, this.rightRecoil);
		this.aimArm(this.armUpperL, this.armLowerL, -1, this.leftRecoil);
	}

	private aimArm(upper: THREE.Object3D | undefined, lower: THREE.Object3D | undefined, side: number, recoil: number): void
	{
		if (upper === undefined || lower === undefined) return;
		const t = cameraTuning;
		const look = this.aimLook;

		// Horizontal "right of look" for splaying the two hands apart.
		this.aimRight.set(look.z, 0, -look.x).normalize();
		const dip = t.armDownTilt + (recoil / Character.RECOIL_TIME) * t.armRecoil;

		// Upper arm: aim, tilted down (more on recoil) and splayed outward.
		this.aimDir.copy(look);
		this.aimDir.y -= dip;
		this.aimDir.addScaledVector(this.aimRight, side * t.armSplay);
		this.aimDir.normalize();
		this.pointBoneY(upper, this.aimDir);

		// Forearm: continue the reach, lifted back up a touch.
		upper.updateWorldMatrix(true, false);
		this.aimDir.copy(look);
		this.aimDir.y -= dip - t.forearmBend;
		this.aimDir.addScaledVector(this.aimRight, side * t.armSplay);
		this.aimDir.normalize();
		this.pointBoneY(lower, this.aimDir);
	}

	/** Rotate a bone so its local +Y axis points along `worldDir` (world space). */
	private pointBoneY(bone: THREE.Object3D, worldDir: THREE.Vector3): void
	{
		if (bone.parent === null) return;
		bone.parent.getWorldQuaternion(this.aimQ1);
		this.aimQ2.setFromUnitVectors(Character.BONE_AXIS, worldDir);
		bone.quaternion.copy(this.aimQ1.invert().multiply(this.aimQ2));
	}

	/** Equip an ability (by registered id) into the given hand; orb rides the hand bone. */
	public equip(hand: 'left' | 'right', abilityId: string): void
	{
		const ability = this.world.abilities.create(abilityId);
		const socket = hand === 'right' ? this.armLowerR : this.armLowerL;
		const prevOrb = hand === 'right' ? this.rightOrb : this.leftOrb;

		if (prevOrb !== undefined) prevOrb.parent?.remove(prevOrb);
		const orb = ability.createViewmodel?.() ?? undefined;
		if (orb && socket !== undefined)
		{
			orb.position.set(0, 0.42, 0); // hand end, along the forearm bone (+Y)
			socket.add(orb);
		}

		if (hand === 'right') { this.rightHandAbility = ability; this.rightOrb = orb; }
		else { this.leftHandAbility = ability; this.leftOrb = orb; }
	}

	/** Cast the ability held in the given hand, if equipped and off cooldown. */
	private castHand(hand: 'left' | 'right'): void
	{
		// Abilities are wielded in the aim views (over-shoulder + first-person),
		// not in the default third-person orbit.
		if (this.viewMode === 'third') return;

		const ability = hand === 'right' ? this.rightHandAbility : this.leftHandAbility;
		const cooldown = hand === 'right' ? this.rightCooldown : this.leftCooldown;
		if (ability === undefined || cooldown > 0) return;

		const direction = this.world.cameraOperator.getForward();

		// Fire from the hand bone (forearm end), nudged forward so the bolt
		// clears the arm; fall back to the eye if the arm bone is missing.
		const arm = hand === 'right' ? this.armLowerR : this.armLowerL;
		const origin = new THREE.Vector3();
		if (arm !== undefined)
		{
			arm.updateWorldMatrix(true, false);
			arm.getWorldPosition(origin);
			origin.addScaledVector(direction, 0.4);
		}
		else
		{
			this.getWorldPosition(origin);
			origin.y += this.firstPersonEyeHeight;
		}

		ability.cast({ ctx: this.world, origin, direction, hand });

		if (hand === 'right') { this.rightCooldown = ability.cooldown; this.rightRecoil = Character.RECOIL_TIME; }
		else { this.leftCooldown = ability.cooldown; this.leftRecoil = Character.RECOIL_TIME; }
	}

	public rotateModel(): void
	{
		this.lookAt(this.position.x + this.orientation.x, this.position.y + this.orientation.y, this.position.z + this.orientation.z);
		this.tiltContainer.rotation.z = (-this.angularVelocity * 2.3 * this.velocity.length());
		this.tiltContainer.position.setY((Math.cos(Math.abs(this.angularVelocity * 2.3 * this.velocity.length())) / 2) - 0.5);
	}

	public jump(initJumpSpeed: number = -1): void
	{
		this.wantsToJump = true;
		this.initJumpSpeed = initJumpSpeed;
	}

	public findVehicleToEnter(wantsToDrive: boolean): void
	{
		// reusable world position variable
		const worldPos = new THREE.Vector3();

		// Find best vehicle
		const vehicleFinder = new ClosestObjectFinder<Vehicle>(this.position, 10);
		this.world.vehicles.forEach((vehicle) =>
		{
			vehicleFinder.consider(vehicle, vehicle.position);
		});

		if (vehicleFinder.closestObject !== undefined)
		{
			const vehicle = vehicleFinder.closestObject;
			const vehicleEntryInstance = new VehicleEntryInstance(this);
			vehicleEntryInstance.wantsToDrive = wantsToDrive;

			// Find best seat
			const seatFinder = new ClosestObjectFinder<VehicleSeat>(this.position);
			for (const seat of vehicle.seats)
			{
				if (wantsToDrive)
				{
					// Consider driver seats
					if (seat.type === SeatType.Driver)
					{
						seat.seatPointObject.getWorldPosition(worldPos);
						seatFinder.consider(seat, worldPos);
					}
					// Consider passenger seats connected to driver seats
					else if (seat.type === SeatType.Passenger)
					{
						for (const connSeat of seat.connectedSeats)
						{
							if (connSeat.type === SeatType.Driver)
							{
								seat.seatPointObject.getWorldPosition(worldPos);
								seatFinder.consider(seat, worldPos);
								break;
							}
						}
					}
				}
				else
				{
					// Consider passenger seats
					if (seat.type === SeatType.Passenger)
					{
						seat.seatPointObject.getWorldPosition(worldPos);
						seatFinder.consider(seat, worldPos);
					}
				}
			}

			if (seatFinder.closestObject !== undefined)
			{
				const targetSeat = seatFinder.closestObject;
				vehicleEntryInstance.targetSeat = targetSeat;

				const entryPointFinder = new ClosestObjectFinder<Object3D>(this.position);

				for (const point of targetSeat.entryPoints) {
					point.getWorldPosition(worldPos);
					entryPointFinder.consider(point, worldPos);
				}

				if (entryPointFinder.closestObject !== undefined)
				{
					// Drop back to third person so the walk-to-door / entry
					// animation is visible before it begins.
					this.setFirstPerson(false);

					vehicleEntryInstance.entryPoint = entryPointFinder.closestObject;
					this.triggerAction('up', true);
					this.vehicleEntryInstance = vehicleEntryInstance;
				}
			}
		}
	}

	public enterVehicle(seat: VehicleSeat, entryPoint: THREE.Object3D): void
	{
		this.resetControls();

		if (seat.door?.rotation < 0.5)
		{
			this.setState(new OpenVehicleDoor(this, seat, entryPoint));
		}
		else
		{
			this.setState(new EnteringVehicle(this, seat, entryPoint));
		}
	}

	public teleportToVehicle(vehicle: Vehicle, seat: VehicleSeat): void
	{
		this.resetVelocity();
		this.rotateModel();
		this.setPhysicsEnabled(false);
		(vehicle as unknown as THREE.Object3D).attach(this);

		this.setPosition(seat.seatPointObject.position.x, seat.seatPointObject.position.y + 0.6, seat.seatPointObject.position.z);
		this.quaternion.copy(seat.seatPointObject.quaternion);

		this.occupySeat(seat);
		this.setState(new Driving(this, seat));

		this.startControllingVehicle(vehicle, seat);
	}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public startControllingVehicle(vehicle: IControllable, _seat: VehicleSeat): void
	{
		if (this.controlledObject !== vehicle)
		{
			this.transferControls(vehicle);
			this.resetControls();
	
			this.controlledObject = vehicle;
			this.controlledObject.allowSleep(false);
			vehicle.inputReceiverInit();
	
			vehicle.controllingCharacter = this;
		}
	}

	public transferControls(entity: IControllable): void
	{
		// Currently running through all actions of this character and the vehicle,
		// comparing keycodes of actions and based on that triggering vehicle's actions
		// Maybe we should ask input manager what's the current state of the keyboard
		// and read those values... TODO
		for (const action1 in this.actions) {
// eslint-disable-next-line no-prototype-builtins
			if (this.actions.hasOwnProperty(action1)) {
				for (const action2 in entity.actions) {
// eslint-disable-next-line no-prototype-builtins
					if (entity.actions.hasOwnProperty(action2)) {

						const a1 = this.actions[action1];
						const a2 = entity.actions[action2];

						a1.eventCodes.forEach((code1) => {
							a2.eventCodes.forEach((code2) => {
								if (code1 === code2)
								{
									entity.triggerAction(action2, a1.isPressed);
								}
							});
						});
					}
				}
			}
		}
	}

	public stopControllingVehicle(): void
	{
		if (this.controlledObject?.controllingCharacter === this)
		{
			this.controlledObject.allowSleep(true);
			this.controlledObject.controllingCharacter = undefined;
			this.controlledObject.resetControls();
			this.controlledObject = undefined;
			this.inputReceiverInit();
		}
	}

	public exitVehicle(): void
	{
		if (this.occupyingSeat !== null)
		{
			if (this.occupyingSeat.vehicle.entityType === EntityType.Airplane)
			{
				this.setState(new ExitingAirplane(this, this.occupyingSeat));
			}
			else
			{
				this.setState(new ExitingVehicle(this, this.occupyingSeat));
			}
			
			this.stopControllingVehicle();
		}
	}

	public occupySeat(seat: VehicleSeat): void
	{
		this.occupyingSeat = seat;
		seat.occupiedBy = this;
	}

	public leaveSeat(): void
	{
		if (this.occupyingSeat !== null)
		{
			this.occupyingSeat.occupiedBy = null;
			this.occupyingSeat = null;
		}
	}

	public physicsPreStep(body: CANNON.Body, character: Character): void
	{
		character.feetRaycast();

		// Raycast debug
		if (character.rayHasHit)
		{
			if (character.raycastBox.visible) {
				character.raycastBox.position.x = character.rayResult.hitPointWorld.x;
				character.raycastBox.position.y = character.rayResult.hitPointWorld.y;
				character.raycastBox.position.z = character.rayResult.hitPointWorld.z;
			}
		}
		else
		{
			if (character.raycastBox.visible) {
				character.raycastBox.position.set(body.position.x, body.position.y - character.rayCastLength - character.raySafeOffset, body.position.z);
			}
		}
	}

	public feetRaycast(): void
	{
		// Player ray casting
		// Create ray
		const body = this.characterCapsule.body;
		const start = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
		const end = new CANNON.Vec3(body.position.x, body.position.y - this.rayCastLength - this.raySafeOffset, body.position.z);
		// Raycast options
		const rayCastOptions = {
			collisionFilterMask: CollisionGroups.Default,
			skipBackfaces: true      /* ignore back faces */
		};
		// Cast the ray
		this.rayHasHit = this.world.physicsWorld.raycastClosest(start, end, rayCastOptions, this.rayResult);
	}

	public physicsPostStep(body: CANNON.Body, character: Character): void
	{
		// Get velocities
		const simulatedVelocity = new THREE.Vector3(body.velocity.x, body.velocity.y, body.velocity.z);

		// Take local velocity
		let arcadeVelocity = new THREE.Vector3().copy(character.velocity).multiplyScalar(character.moveSpeed);
		// Turn local into global
		arcadeVelocity = Utils.appplyVectorMatrixXZ(character.orientation, arcadeVelocity);

		let newVelocity = new THREE.Vector3();

		// Additive velocity mode
		if (character.arcadeVelocityIsAdditive)
		{
			newVelocity.copy(simulatedVelocity);

			const globalVelocityTarget = Utils.appplyVectorMatrixXZ(character.orientation, character.velocityTarget);
			const add = new THREE.Vector3().copy(arcadeVelocity).multiply(character.arcadeVelocityInfluence);

			if (Math.abs(simulatedVelocity.x) < Math.abs(globalVelocityTarget.x * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.x, arcadeVelocity.x)) { newVelocity.x += add.x; }
			if (Math.abs(simulatedVelocity.y) < Math.abs(globalVelocityTarget.y * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.y, arcadeVelocity.y)) { newVelocity.y += add.y; }
			if (Math.abs(simulatedVelocity.z) < Math.abs(globalVelocityTarget.z * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.z, arcadeVelocity.z)) { newVelocity.z += add.z; }
		}
		else
		{
			newVelocity = new THREE.Vector3(
				THREE.MathUtils.lerp(simulatedVelocity.x, arcadeVelocity.x, character.arcadeVelocityInfluence.x),
				THREE.MathUtils.lerp(simulatedVelocity.y, arcadeVelocity.y, character.arcadeVelocityInfluence.y),
				THREE.MathUtils.lerp(simulatedVelocity.z, arcadeVelocity.z, character.arcadeVelocityInfluence.z),
			);
		}

		// If we're hitting the ground, stick to ground
		if (character.rayHasHit)
		{
			// Flatten velocity
			newVelocity.y = 0;

			// Move on top of moving objects
			if (character.rayResult.body.mass > 0)
			{
				const pointVelocity = new CANNON.Vec3();
				character.rayResult.body.getVelocityAtWorldPoint(character.rayResult.hitPointWorld, pointVelocity);
				newVelocity.add(Utils.threeVector(pointVelocity));
			}

			// Measure the normal vector offset from direct "up" vector
			// and transform it into a matrix
			const up = new THREE.Vector3(0, 1, 0);
			const normal = new THREE.Vector3(character.rayResult.hitNormalWorld.x, character.rayResult.hitNormalWorld.y, character.rayResult.hitNormalWorld.z);
			const q = new THREE.Quaternion().setFromUnitVectors(up, normal);
			const m = new THREE.Matrix4().makeRotationFromQuaternion(q);

			// Rotate the velocity vector
			newVelocity.applyMatrix4(m);

			// Compensate for gravity
			// newVelocity.y -= body.world.physicsWorld.gravity.y / body.character.world.physicsFrameRate;

			// Apply velocity
			body.velocity.x = newVelocity.x;
			body.velocity.y = newVelocity.y;
			body.velocity.z = newVelocity.z;
			// Ground character
			body.position.y = character.rayResult.hitPointWorld.y + character.rayCastLength + (newVelocity.y / character.world.physicsFrameRate);
		}
		else
		{
			// If we're in air
			body.velocity.x = newVelocity.x;
			body.velocity.y = newVelocity.y;
			body.velocity.z = newVelocity.z;

			// Save last in-air information
			character.groundImpactData.velocity.x = body.velocity.x;
			character.groundImpactData.velocity.y = body.velocity.y;
			character.groundImpactData.velocity.z = body.velocity.z;
		}

		// Jumping
		if (character.wantsToJump)
		{
			// If initJumpSpeed is set
			if (character.initJumpSpeed > -1)
			{
				// Flatten velocity
				body.velocity.y = 0;
				const speed = Math.max(character.velocitySimulator.position.length() * 4, character.initJumpSpeed);
				body.velocity = Utils.cannonVector(character.orientation.clone().multiplyScalar(speed));
			}
			else {
				// Moving objects compensation
				const add = new CANNON.Vec3();
				character.rayResult.body.getVelocityAtWorldPoint(character.rayResult.hitPointWorld, add);
				body.velocity.vsub(add, body.velocity);
			}

			// Add positive vertical velocity 
			body.velocity.y += 4;
			// Move above ground by 2x safe offset value
			body.position.y += character.raySafeOffset * 2;
			// Reset flag
			character.wantsToJump = false;
		}
	}

	public addToWorld(world: EngineContext): void
	{
		if (_.includes(world.characters, this))
		{
			console.warn('Adding character to a world in which it already exists.');
		}
		else
		{
			// Set world
			this.world = world;

			// Register character
			world.characters.push(this);

			// Register physics
			world.physicsWorld.addBody(this.characterCapsule.body);

			// Add to graphicsWorld
			world.graphicsWorld.add(this);
			world.graphicsWorld.add(this.raycastBox);

		}
	}

	public removeFromWorld(world: EngineContext): void
	{
		if (!_.includes(world.characters, this))
		{
			console.warn('Removing character from a world in which it isn\'t present.');
		}
		else
		{
			if (world.inputManager.inputReceiver === this)
			{
				world.inputManager.inputReceiver = undefined;
			}

			this.world = undefined;

			// Remove from characters
			_.pull(world.characters, this);

			// Remove physics
			world.physicsWorld.removeBody(this.characterCapsule.body);

			// Remove visuals
			world.graphicsWorld.remove(this);
			world.graphicsWorld.remove(this.raycastBox);
		}
	}
}