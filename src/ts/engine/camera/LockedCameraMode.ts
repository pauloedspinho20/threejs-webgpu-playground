import type { CameraOperator } from '../CameraOperator';
import type { ICameraMode } from './ICameraMode';

/**
 * A fully driven camera: sits at `target` and looks at `lookTarget`, ignoring
 * the orbit yaw/pitch and mouse entirely. The consumer sets both vectors each
 * frame (e.g. a vehicle placing a fixed, forward-facing hood or cockpit cam).
 */
export class LockedCameraMode implements ICameraMode
{
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(op: CameraOperator, _timeScale: number): void
	{
		op.camera.position.copy(op.target);
		op.camera.updateMatrix();
		op.camera.lookAt(op.lookTarget);
	}
}
