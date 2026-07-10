import * as THREE from 'three';
import * as Utils from './FunctionLibrary';
import type { EngineContext } from './EngineContext';
import { IInputReceiver } from './interfaces/IInputReceiver';
import { KeyBinding } from './KeyBinding';
import type { Character } from '../game/characters/Character';
import * as _ from 'lodash';
import { IUpdatable } from './interfaces/IUpdatable';
import type { ICameraMode } from './camera/ICameraMode';
import { OrbitCameraMode } from './camera/OrbitCameraMode';

export class CameraOperator implements IInputReceiver, IUpdatable
{
	public updateOrder: number = 4;

	public world: EngineContext;
	public camera: THREE.Camera;
	public target: THREE.Vector3;
	public sensitivity: THREE.Vector2;
	public radius: number = 1;
	public theta: number;
	public phi: number;
	public onMouseDownPosition: THREE.Vector2;
	public onMouseDownTheta: unknown;
	public onMouseDownPhi: unknown;
	public targetRadius: number = 1;
	/** Lateral over-the-shoulder pan (world units, along camera-right). Lerps to `targetShoulder`. */
	public shoulder: number = 0;
	public targetShoulder: number = 0;

	public movementSpeed: number;
	public actions: { [action: string]: KeyBinding };

	public upVelocity: number = 0;
	public forwardVelocity: number = 0;
	public rightVelocity: number = 0;

	/** Active view strategy. Swap via `setMode()`. Defaults to orbit (third-person). */
	public mode: ICameraMode = new OrbitCameraMode();

	public characterCaller: Character;

	constructor(world: EngineContext, camera: THREE.Camera, sensitivityX: number = 1, sensitivityY: number = sensitivityX * 0.8)
	{
		this.world = world;
		this.camera = camera;
		this.target = new THREE.Vector3();
		this.sensitivity = new THREE.Vector2(sensitivityX, sensitivityY);

		this.movementSpeed = 0.06;
		this.radius = 3;
		this.theta = 0;
		this.phi = 0;

		this.onMouseDownPosition = new THREE.Vector2();
		this.onMouseDownTheta = this.theta;
		this.onMouseDownPhi = this.phi;

		this.actions = {
			'forward': new KeyBinding('KeyW'),
			'back': new KeyBinding('KeyS'),
			'left': new KeyBinding('KeyA'),
			'right': new KeyBinding('KeyD'),
			'up': new KeyBinding('KeyE'),
			'down': new KeyBinding('KeyQ'),
			'fast': new KeyBinding('ShiftLeft'),
		};

		world.registerUpdatable(this);
	}

	public setSensitivity(sensitivityX: number, sensitivityY: number = sensitivityX): void
	{
		this.sensitivity = new THREE.Vector2(sensitivityX, sensitivityY);
	}

	public setRadius(value: number, instantly: boolean = false): void
	{
		this.targetRadius = Math.max(0.001, value);
		if (instantly === true)
		{
			this.radius = value;
		}
	}

	/** Lateral over-the-shoulder pan. Lerps unless `instantly`. */
	public setShoulder(value: number, instantly: boolean = false): void
	{
		this.targetShoulder = value;
		if (instantly === true)
		{
			this.shoulder = value;
		}
	}

	public move(deltaX: number, deltaY: number): void
	{
		this.theta -= deltaX * (this.sensitivity.x / 2);
		this.theta %= 360;
		this.phi += deltaY * (this.sensitivity.y / 2);
		this.phi = Math.min(85, Math.max(-85, this.phi));
	}

	/**
	 * Outward look direction implied by `theta`/`phi` (unit vector). This is the
	 * direction an orbit camera looks toward its target, and the direction a
	 * first-person camera looks from the eye. Writes into `target` if provided.
	 */
	public getForward(target?: THREE.Vector3): THREE.Vector3
	{
		const t = this.theta * Math.PI / 180;
		const p = this.phi * Math.PI / 180;
		return (target ?? new THREE.Vector3()).set(
			-Math.sin(t) * Math.cos(p),
			-Math.sin(p),
			-Math.cos(t) * Math.cos(p)
		);
	}

	/** Swap the active camera mode, firing exit/enter hooks. */
	public setMode(mode: ICameraMode): void
	{
		if (mode === this.mode) return;
		this.mode.exit?.(this);
		this.mode = mode;
		this.mode.enter?.(this);
	}

	public update(timeScale: number): void
	{
		this.mode.update(this, timeScale);
	}

	public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void
	{
		// Free camera
		if (code === 'KeyC' && pressed === true && event.shiftKey === true)
		{
			if (this.characterCaller !== undefined)
			{
				this.world.inputManager.setInputReceiver(this.characterCaller);
				this.characterCaller = undefined;
			}
		}
		else
		{
			for (const action in this.actions) {
				if (Object.hasOwn(this.actions, action)) {
					const binding = this.actions[action];
	
					if (_.includes(binding.eventCodes, code))
					{
						binding.isPressed = pressed;
					}
				}
			}
		}
	}

	public handleMouseWheel(event: WheelEvent, value: number): void
	{
		this.world.scrollTheTimeScale(value);
	}

	public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
	{
		for (const action in this.actions) {
			if (Object.hasOwn(this.actions, action)) {
				const binding = this.actions[action];

				if (_.includes(binding.eventCodes, code))
				{
					binding.isPressed = pressed;
				}
			}
		}
	}

	public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
	{
		this.move(deltaX, deltaY);
	}

	public inputReceiverInit(): void
	{
		this.target.copy(this.camera.position);
		this.setRadius(0, true);
		this.setShoulder(0, true);
		this.setMode(new OrbitCameraMode()); // free-fly relies on orbit-at-zero-radius
		// this.world.dirLight.target = this.world.camera;

		this.world.updateControls([
			{
				keys: ['W', 'S', 'A', 'D'],
				desc: 'Move around'
			},
			{
				keys: ['E', 'Q'],
				desc: 'Move up / down'
			},
			{
				keys: ['Shift'],
				desc: 'Speed up'
			},
			{
				keys: ['Shift', '+', 'C'],
				desc: 'Exit free camera mode'
			},
		]);
	}

	public inputReceiverUpdate(timeStep: number): void
	{
		// Set fly speed
		const speed = this.movementSpeed * (this.actions.fast.isPressed ? timeStep * 600 : timeStep * 60);

		const up = Utils.getUp(this.camera);
		const right = Utils.getRight(this.camera);
		const forward = Utils.getBack(this.camera);

		this.upVelocity = THREE.MathUtils.lerp(this.upVelocity, +this.actions.up.isPressed - +this.actions.down.isPressed, 0.3);
		this.forwardVelocity = THREE.MathUtils.lerp(this.forwardVelocity, +this.actions.forward.isPressed - +this.actions.back.isPressed, 0.3);
		this.rightVelocity = THREE.MathUtils.lerp(this.rightVelocity, +this.actions.right.isPressed - +this.actions.left.isPressed, 0.3);

		this.target.add(up.multiplyScalar(speed * this.upVelocity));
		this.target.add(forward.multiplyScalar(speed * this.forwardVelocity));
		this.target.add(right.multiplyScalar(speed * this.rightVelocity));
	}
}