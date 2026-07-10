import type * as THREE from 'three';

/** Anything an explosion (or other area effect) can damage. */
export interface IDamageable
{
	/** World-space position, used for distance falloff. */
	readonly position: THREE.Vector3;
	takeDamage(amount: number): void;
}

// Game-side registry of live damageables. Kept out of the engine: this is
// content-layer combat, not a core concern.
const damageables = new Set<IDamageable>();

export function registerDamageable(d: IDamageable): void { damageables.add(d); }
export function unregisterDamageable(d: IDamageable): void { damageables.delete(d); }

/**
 * Apply linearly-falling-off damage to every damageable within `radius` of
 * `center` (full `maxDamage` at the centre, 0 at the edge). Iterates a snapshot
 * so a target destroying itself mid-callback doesn't corrupt the set.
 */
export function applyAreaDamage(center: THREE.Vector3, radius: number, maxDamage: number): void
{
	for (const d of [...damageables])
	{
		const dist = d.position.distanceTo(center);
		if (dist <= radius)
		{
			d.takeDamage(maxDamage * (1 - dist / radius));
		}
	}
}
