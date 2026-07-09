import * as THREE from 'three';
import type { CameraOperator } from '../CameraOperator';
import type { ICameraMode } from './ICameraMode';

/**
 * Places the camera *at* `target` (the eye) and looks outward along the
 * operator's yaw/pitch (`theta`/`phi`) — the classic first-person view. The
 * consumer is responsible for feeding `target` the eye position and for hiding
 * the viewer's own body; this mode only computes the camera pose.
 */
export class FirstPersonCameraMode implements ICameraMode
{
	private lookAt = new THREE.Vector3();

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(op: CameraOperator, _timeScale: number): void
	{
		op.camera.position.copy(op.target);
		op.getForward(this.lookAt).add(op.target);
		op.camera.updateMatrix();
		op.camera.lookAt(this.lookAt);
	}
}
