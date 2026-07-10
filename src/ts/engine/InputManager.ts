import type { EngineContext } from './EngineContext';
import { IInputReceiver } from './interfaces/IInputReceiver';
import { IUpdatable } from './interfaces/IUpdatable';

export class InputManager implements IUpdatable
{
	public updateOrder: number = 3;

	public world: EngineContext;
	public domElement: HTMLElement;
	public pointerLock: any;
	public isLocked: boolean;
	public inputReceiver: IInputReceiver;

	public boundOnMouseDown: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnMouseMove: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnMouseUp: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnMouseWheelMove: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnPointerlockChange: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnPointerlockError: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnKeyDown: (evt: Event | MouseEvent | KeyboardEvent) => void;
	public boundOnKeyUp: (evt: Event | MouseEvent | KeyboardEvent) => void;

	/** Right-stick look speed (synthetic mouse delta per unit of stick tilt). */
	public gamepadLookSpeed: number = 14;
	/** Analog stick deadzone. */
	public gamepadDeadzone: number = 0.2;
	// Edge-tracking so held gamepad inputs map to clean key/mouse press/release.
	private readonly gamepadPrev = new Map<string, boolean>();

	constructor(world: EngineContext, domElement: HTMLElement)
	{
		this.world = world;
		this.pointerLock = world.params.Pointer_Lock;
		this.domElement = domElement || document.body;
		this.isLocked = false;
		
		// Bindings for later event use
		// Mouse
		this.boundOnMouseDown = (evt) => this.onMouseDown(evt as MouseEvent);
		this.boundOnMouseMove = (evt) => this.onMouseMove(evt as MouseEvent);
		this.boundOnMouseUp = (evt) => this.onMouseUp(evt as MouseEvent);
		this.boundOnMouseWheelMove = (evt) => this.onMouseWheelMove(evt as WheelEvent);

		// Pointer lock
		this.boundOnPointerlockChange = (evt) => this.onPointerlockChange(evt as MouseEvent);
		this.boundOnPointerlockError = (evt) => this.onPointerlockError(evt as MouseEvent);

		// Keys
		this.boundOnKeyDown = (evt) => this.onKeyDown(evt as KeyboardEvent);
		this.boundOnKeyUp = (evt) => this.onKeyUp(evt as KeyboardEvent);

		// Init event listeners
		// Mouse
		this.domElement.addEventListener('mousedown', this.boundOnMouseDown, false);
		document.addEventListener('wheel', this.boundOnMouseWheelMove, false);
		document.addEventListener('pointerlockchange', this.boundOnPointerlockChange, false);
		document.addEventListener('pointerlockerror', this.boundOnPointerlockError, false);
		
		// Keys
		document.addEventListener('keydown', this.boundOnKeyDown, false);
		document.addEventListener('keyup', this.boundOnKeyUp, false);

		world.registerUpdatable(this);
	}

	public update(timestep: number, unscaledTimeStep: number): void
	{
		if (this.inputReceiver === undefined && this.world !== undefined && this.world.cameraOperator !== undefined)
		{
			this.setInputReceiver(this.world.cameraOperator);
		}

		this.pollGamepad();
		this.inputReceiver?.inputReceiverUpdate(unscaledTimeStep);
	}

	public setInputReceiver(receiver: IInputReceiver): void
	{
		this.inputReceiver = receiver;
		// Drop stale gamepad edges so a held input doesn't carry across receivers.
		this.gamepadPrev.clear();
		this.inputReceiver.inputReceiverInit();
	}

	/**
	 * Poll the first connected gamepad and translate it into the same action
	 * events the keyboard/mouse produce. Sticks map to WASD + look; face/shoulder
	 * buttons to jump/enter/view/cast. Edge-detected so per-press actions (jump,
	 * cast, cycle view) fire once. No-op when no pad is connected.
	 */
	private pollGamepad(): void
	{
		const receiver = this.inputReceiver;
		if (receiver === undefined || typeof navigator === 'undefined' || navigator.getGamepads === undefined) return;

		let gp: Gamepad | null = null;
		for (const pad of navigator.getGamepads()) { if (pad !== null) { gp = pad; break; } }
		if (gp === null) return;

		const axis = (i: number): number => { const v = gp!.axes[i] ?? 0; return Math.abs(v) > this.gamepadDeadzone ? v : 0; };
		const pressed = (i: number): boolean => gp!.buttons[i]?.pressed === true;

		// Left stick -> movement (WASD).
		const lx = axis(0), ly = axis(1);
		this.setDigital(receiver, 'KeyD', lx > 0);
		this.setDigital(receiver, 'KeyA', lx < 0);
		this.setDigital(receiver, 'KeyW', ly < 0);
		this.setDigital(receiver, 'KeyS', ly > 0);

		// Face / shoulder buttons (standard mapping).
		this.setDigital(receiver, 'Space', pressed(0));                 // A / cross -> jump
		this.setDigital(receiver, 'ShiftLeft', pressed(10) || pressed(6)); // L3 / LT -> sprint
		this.setDigital(receiver, 'KeyF', pressed(2));                  // X / square -> enter vehicle
		this.setDigital(receiver, 'KeyV', pressed(3));                  // Y / triangle -> cycle view
		this.setMouseButton(receiver, 0, pressed(5));                   // RB -> cast right hand
		this.setMouseButton(receiver, 1, pressed(4));                   // LB -> cast left hand

		// Right stick -> look.
		const rx = axis(2), ry = axis(3);
		if (rx !== 0 || ry !== 0)
		{
			receiver.handleMouseMove(new MouseEvent('mousemove'), rx * this.gamepadLookSpeed, ry * this.gamepadLookSpeed);
		}
	}

	private setDigital(receiver: IInputReceiver, code: string, isDown: boolean): void
	{
		if (this.gamepadPrev.get(code) === isDown) return;
		this.gamepadPrev.set(code, isDown);
		receiver.handleKeyboardEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code }), code, isDown);
	}

	private setMouseButton(receiver: IInputReceiver, button: number, isDown: boolean): void
	{
		const key = 'mouse' + button;
		if (this.gamepadPrev.get(key) === isDown) return;
		this.gamepadPrev.set(key, isDown);
		receiver.handleMouseButton(new MouseEvent(isDown ? 'mousedown' : 'mouseup', { button }), key, isDown);
	}

	public setPointerLock(enabled: boolean): void
	{
		this.pointerLock = enabled;
	}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public onPointerlockChange(event: MouseEvent): void
	{
		if (document.pointerLockElement === this.domElement)
		{
			this.domElement.addEventListener('mousemove', this.boundOnMouseMove, false);
			this.domElement.addEventListener('mouseup', this.boundOnMouseUp, false);
			this.isLocked = true;
		}
		else
		{
			this.domElement.removeEventListener('mousemove', this.boundOnMouseMove, false);
			this.domElement.removeEventListener('mouseup', this.boundOnMouseUp, false);
			this.isLocked = false;
		}
	}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public onPointerlockError(event: MouseEvent): void
	{
		console.error('PointerLockControls: Unable to use Pointer Lock API');
	}

	public onMouseDown(event: MouseEvent): void
	{
		if (this.pointerLock)
		{
			this.domElement.requestPointerLock();
		}
		else
		{
			this.domElement.addEventListener('mousemove', this.boundOnMouseMove, false);
			this.domElement.addEventListener('mouseup', this.boundOnMouseUp, false);
		}

		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleMouseButton(event, 'mouse' + event.button, true);
		}
	}

	public onMouseMove(event: MouseEvent): void
	{
		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleMouseMove(event, event.movementX, event.movementY);
		}
	}

	public onMouseUp(event: MouseEvent): void
	{
		if (!this.pointerLock)
		{
			this.domElement.removeEventListener('mousemove', this.boundOnMouseMove, false);
			this.domElement.removeEventListener('mouseup', this.boundOnMouseUp, false);
		}

		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleMouseButton(event, 'mouse' + event.button, false);
		}
	}

	public onKeyDown(event: KeyboardEvent): void
	{
		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleKeyboardEvent(event, event.code, true);
		}
	}

	public onKeyUp(event: KeyboardEvent): void
	{
		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleKeyboardEvent(event, event.code, false);
		}
	}

	public onMouseWheelMove(event: WheelEvent): void
	{
		if (this.inputReceiver !== undefined)
		{
			this.inputReceiver.handleMouseWheel(event, event.deltaY);
		}
	}
}