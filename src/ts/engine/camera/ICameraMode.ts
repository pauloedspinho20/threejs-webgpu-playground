import type { CameraOperator } from '../CameraOperator';

/**
 * A camera mode maps the operator's state (`target`, `theta`/`phi`, `radius`)
 * onto a camera pose each frame. Swapping the operator's `mode` is how the
 * engine supports third-person, first-person, chase, and free-fly views
 * without branching inside the operator.
 */
export interface ICameraMode
{
	/** Called when this mode becomes active on the operator. */
	enter?(operator: CameraOperator): void;
	/** Called when the operator switches away from this mode. */
	exit?(operator: CameraOperator): void;
	/** Position + orient the operator's camera for this frame. */
	update(operator: CameraOperator, timeScale: number): void;
}
