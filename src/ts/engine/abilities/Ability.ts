import type * as THREE from 'three';
import type { EngineContext } from '../EngineContext';

/** Everything an ability needs to know when it fires. */
export interface AbilityCastContext
{
	ctx: EngineContext;
	/** World-space position to cast from (typically the eye or a hand). */
	origin: THREE.Vector3;
	/** Normalized aim direction. */
	direction: THREE.Vector3;
	/** Which hand triggered the cast. */
	hand: 'left' | 'right';
}

/**
 * A wieldable power (spell, weapon, tool). The engine defines the contract;
 * games implement concrete abilities and register them so a character can
 * equip one per hand. Cooldown is enforced by the wielder, not the ability.
 */
export interface Ability
{
	readonly id: string;
	/** Seconds before the same hand can cast again. */
	readonly cooldown: number;
	/** Optional object shown in the hand socket while equipped (view space). */
	createViewmodel?(): THREE.Object3D | null;
	/** Fire the ability — spawn a projectile, effect, hit query, etc. */
	cast(context: AbilityCastContext): void;
}
