import * as THREE from 'three';
import type { CameraOperator } from '../CameraOperator';
import type { ICameraMode } from './ICameraMode';

/**
 * Keeps the camera a fixed distance (`targetRadius`) from `target`, clamped to
 * stay at or above the target's height, preserving its current viewing
 * direction. Ported verbatim from the original operator's follow branch.
 */
export class FollowCameraMode implements ICameraMode
{
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(op: CameraOperator, _timeScale: number): void
	{
		op.camera.position.y = THREE.MathUtils.clamp(op.camera.position.y, op.target.y, Number.POSITIVE_INFINITY);
		op.camera.lookAt(op.target);

		const newPos = op.target.clone().add(
			new THREE.Vector3().subVectors(op.camera.position, op.target).normalize().multiplyScalar(op.targetRadius)
		);
		op.camera.position.copy(newPos);
	}
}
