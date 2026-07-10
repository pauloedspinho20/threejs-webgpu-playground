import * as THREE from 'three';
import type { Ability, AbilityCastContext } from '../../engine/abilities/Ability';
import { Projectile } from './Projectile';

/**
 * A simple ranged spell: holds a glowing orb in the hand and, on cast, launches
 * a coloured {@link Projectile} along the aim direction. Two colours give the
 * demo distinct left/right powers.
 */
export class MagicBolt implements Ability
{
	public readonly id: string;
	public readonly cooldown: number = 0.4;

	constructor(id: string, private readonly color: number)
	{
		this.id = id;
	}

	public createViewmodel(): THREE.Object3D
	{
		const orb = new THREE.Mesh(
			new THREE.SphereGeometry(0.05, 16, 16),
			new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 2.5, roughness: 0.3 })
		);
		// Rests near the fingertips of the placeholder arm.
		orb.position.set(0, 0.0, -0.42);
		const glow = new THREE.PointLight(this.color, 1.5, 1.2);
		orb.add(glow);
		return orb;
	}

	public cast({ ctx, origin, direction }: AbilityCastContext): void
	{
		ctx.registerUpdatable(new Projectile(ctx, origin, direction, this.color));
	}
}
