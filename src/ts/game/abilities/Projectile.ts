import * as THREE from 'three';
import type { EngineContext } from '../../engine/EngineContext';
import type { IUpdatable } from '../../engine/interfaces/IUpdatable';

/**
 * A glowing spell bolt that flies straight and fades out. Registered as an
 * updatable so the engine ticks it; it removes itself when its life expires.
 * A stand-in for richer VFX (compute particles are a later milestone).
 */
export class Projectile implements IUpdatable
{
	public updateOrder: number = 5;

	private readonly ctx: EngineContext;
	private readonly mesh: THREE.Mesh;
	private readonly light: THREE.PointLight;
	private readonly velocity: THREE.Vector3;
	private life: number;

	constructor(ctx: EngineContext, origin: THREE.Vector3, direction: THREE.Vector3, color: number, speed: number = 45, life: number = 2.5)
	{
		this.ctx = ctx;
		this.life = life;
		this.velocity = direction.clone().normalize().multiplyScalar(speed);

		this.mesh = new THREE.Mesh(
			new THREE.SphereGeometry(0.16, 16, 16),
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3, roughness: 0.25 })
		);
		this.mesh.position.copy(origin);

		this.light = new THREE.PointLight(color, 6, 10);
		this.mesh.add(this.light);

		ctx.graphicsWorld.add(this.mesh);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(timeStep: number, _unscaledTimeStep: number): void
	{
		this.mesh.position.addScaledVector(this.velocity, timeStep);

		this.life -= timeStep;
		if (this.life <= 0) this.dispose();
	}

	private dispose(): void
	{
		this.ctx.graphicsWorld.remove(this.mesh);
		this.mesh.geometry.dispose();
		(this.mesh.material as THREE.Material).dispose();
		this.ctx.unregisterUpdatable(this);
	}
}
