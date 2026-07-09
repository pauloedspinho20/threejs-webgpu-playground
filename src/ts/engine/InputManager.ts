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

		this.inputReceiver?.inputReceiverUpdate(unscaledTimeStep);
	}

	public setInputReceiver(receiver: IInputReceiver): void
	{
		this.inputReceiver = receiver;
		this.inputReceiver.inputReceiverInit();
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