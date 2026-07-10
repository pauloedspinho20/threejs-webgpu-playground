import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { EngineContext } from '../../engine/EngineContext';
import type { IUpdatable } from '../../engine/interfaces/IUpdatable';
import { Explosion } from './Explosion';

/**
 * A glowing spell bolt that flies straight until it hits the physics world,
 * where it detonates an {@link Explosion} (and knocks back anything dynamic it
 * hits). Registered as an updatable; removes itself on impact or when its life
 * expires. A stand-in for richer VFX (compute particles are a later milestone).
 */
export class Projectile implements IUpdatable
{
	public updateOrder: number = 5;

	private readonly ctx: EngineContext;
	private readonly mesh: THREE.Mesh;
	private readonly light: THREE.PointLight;
	private readonly velocity: THREE.Vector3;
	private readonly color: number;
	private life: number;

	// Reused across frames to keep the per-frame raycast allocation-free.
	private readonly from = new CANNON.Vec3();
	private readonly to = new CANNON.Vec3();
	private readonly rayResult = new CANNON.RaycastResult();

	constructor(ctx: EngineContext, origin: THREE.Vector3, direction: THREE.Vector3, color: number, speed: number = 45, life: number = 2.5)
	{
		this.ctx = ctx;
		this.color = color;
		this.life = life;

		const dir = direction.clone().normalize();
		this.velocity = dir.clone().multiplyScalar(speed);

		this.mesh = new THREE.Mesh(
			new THREE.SphereGeometry(0.16, 16, 16),
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3, roughness: 0.25 })
		);
		// Start slightly ahead of the eye so the bolt clears the caster's own body.
		this.mesh.position.copy(origin).addScaledVector(dir, 0.7);

		this.light = new THREE.PointLight(color, 6, 10);
		this.mesh.add(this.light);

		ctx.graphicsWorld.add(this.mesh);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(timeStep: number, _unscaledTimeStep: number): void
	{
		const pos = this.mesh.position;
		this.from.set(pos.x, pos.y, pos.z);

		const next = pos.clone().addScaledVector(this.velocity, timeStep);
		this.to.set(next.x, next.y, next.z);

		// Sweep this frame's path against the physics world (colliders, vehicles…).
		this.rayResult.reset();
		this.ctx.physicsWorld.raycastClosest(this.from, this.to, {}, this.rayResult);

		if (this.rayResult.hasHit)
		{
			const hit = this.rayResult.hitPointWorld;
			this.detonate(new THREE.Vector3(hit.x, hit.y, hit.z), this.rayResult.body);
			return;
		}

		pos.copy(next);

		this.life -= timeStep;
		if (this.life <= 0) this.dispose();
	}

	private detonate(point: THREE.Vector3, body: CANNON.Body | null): void
	{
		// Knock back anything dynamic we hit (e.g. vehicles).
		if (body !== null && body.mass > 0)
		{
			const impulse = new CANNON.Vec3(this.velocity.x, this.velocity.y, this.velocity.z);
			impulse.scale(body.mass * 0.15, impulse);
			body.applyImpulse(impulse, new CANNON.Vec3(point.x, point.y, point.z));
		}

		this.ctx.registerUpdatable(new Explosion(this.ctx, point, this.color));
		this.dispose();
	}

	private dispose(): void
	{
		this.ctx.graphicsWorld.remove(this.mesh);
		this.mesh.geometry.dispose();
		(this.mesh.material as THREE.Material).dispose();
		this.ctx.unregisterUpdatable(this);
	}
}
