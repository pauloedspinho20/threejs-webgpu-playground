import * as THREE from 'three';
import type { CameraOperator } from '../CameraOperator';
import type { ICameraMode } from './ICameraMode';

/**
 * Orbits the camera on a sphere around `target`, always looking at it. This is
 * the classic third-person / vehicle-chase view; at a near-zero radius it also
 * serves as the free-fly camera (the operator flies `target` around).
 */
export class OrbitCameraMode implements ICameraMode
{
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(op: CameraOperator, _timeScale: number): void
	{
		op.radius = THREE.MathUtils.lerp(op.radius, op.targetRadius, 0.1);

		op.camera.position.x = op.target.x + op.radius * Math.sin(op.theta * Math.PI / 180) * Math.cos(op.phi * Math.PI / 180);
		op.camera.position.y = op.target.y + op.radius * Math.sin(op.phi * Math.PI / 180);
		op.camera.position.z = op.target.z + op.radius * Math.cos(op.theta * Math.PI / 180) * Math.cos(op.phi * Math.PI / 180);
		op.camera.updateMatrix();
		op.camera.lookAt(op.target);
	}
}
