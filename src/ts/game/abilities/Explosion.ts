import * as THREE from 'three';
import type { EngineContext } from '../../engine/EngineContext';
import type { IUpdatable } from '../../engine/interfaces/IUpdatable';
import { applyAreaDamage } from '../combat/Damageable';

/**
 * A short-lived impact burst: an additive fireball that expands and fades, a
 * bright flash light, and an expanding shock ring. Registers itself as an
 * updatable and removes itself when finished. Placeholder VFX — a natural
 * candidate for a compute-particle upgrade later.
 */
export class Explosion implements IUpdatable
{
	public updateOrder: number = 5;

	private readonly ctx: EngineContext;
	private readonly core: THREE.Mesh;
	private readonly ring: THREE.Mesh;
	private readonly light: THREE.PointLight;
	private readonly coreMat: THREE.MeshBasicMaterial;
	private readonly ringMat: THREE.MeshBasicMaterial;
	private readonly baseIntensity: number = 25;
	private age: number = 0;
	private readonly duration: number = 0.35;

	constructor(ctx: EngineContext, position: THREE.Vector3, color: number, radius: number = 2.2)
	{
		this.ctx = ctx;

		this.coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
		this.core = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), this.coreMat);
		this.core.position.copy(position);
		this.core.scale.setScalar(0.25);

		this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
		this.ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.6, radius, 24), this.ringMat);
		this.ring.position.copy(position);

		this.light = new THREE.PointLight(color, this.baseIntensity, radius * 8);
		this.light.position.copy(position);

		ctx.graphicsWorld.add(this.core, this.ring, this.light);

		// Splash damage: full at the centre, falling off across ~2x the blast radius.
		applyAreaDamage(position, radius * 2, 120);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(timeStep: number, _unscaledTimeStep: number): void
	{
		this.age += timeStep;
		const t = Math.min(this.age / this.duration, 1);

		// Core: pop out fast, fade the whole way.
		this.core.scale.setScalar(0.25 + t * 1.6);
		this.coreMat.opacity = 1 - t;

		// Ring: expand wider than the core, fade a touch quicker.
		const ringScale = 0.2 + t * 2.4;
		this.ring.scale.setScalar(ringScale);
		this.ring.lookAt(this.ctx.camera.position);
		this.ringMat.opacity = Math.max(0, 0.9 - t * 1.2);

		// Flash: bright then out.
		this.light.intensity = this.baseIntensity * (1 - t);

		if (t >= 1) this.dispose();
	}

	private dispose(): void
	{
		this.ctx.graphicsWorld.remove(this.core, this.ring, this.light);
		this.core.geometry.dispose();
		this.coreMat.dispose();
		this.ring.geometry.dispose();
		this.ringMat.dispose();
		this.ctx.unregisterUpdatable(this);
	}
}
