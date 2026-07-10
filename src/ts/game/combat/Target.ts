import * as THREE from 'three';
import type { EngineContext } from '../../engine/EngineContext';
import type { IWorldEntity } from '../../engine/interfaces/IWorldEntity';
import { EntityType } from '../enums/EntityType';
import { BoxCollider } from '../../engine/physics/colliders/BoxCollider';
import { Explosion } from '../abilities/Explosion';
import { IDamageable, registerDamageable, unregisterDamageable } from './Damageable';

/**
 * A floating destructible block: takes damage from nearby explosions, flashes
 * on hit, and detonates when its health runs out. Demo combat content — a
 * shooting-range target for the dual-wield spells.
 */
export class Target implements IWorldEntity, IDamageable
{
	public updateOrder: number = 5;
	public entityType: EntityType = EntityType.Decoration;
	public readonly position: THREE.Vector3;

	private readonly mesh: THREE.Mesh;
	private readonly material: THREE.MeshStandardMaterial;
	private readonly body: BoxCollider;
	private readonly size: number;
	private health: number;
	private hitFlash: number = 0;
	private dead: boolean = false;
	private worldRef?: EngineContext;

	constructor(position: THREE.Vector3, size: number = 1, health: number = 100)
	{
		this.position = position.clone();
		this.size = size;
		this.health = health;

		this.material = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x1a3a5a, emissiveIntensity: 1, roughness: 0.5, metalness: 0.1 });
		this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.material);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		this.mesh.position.copy(this.position);

		this.body = new BoxCollider({ mass: 0, position: this.position, size: new THREE.Vector3(size / 2, size / 2, size / 2) });
	}

	public addToWorld(world: EngineContext): void
	{
		this.worldRef = world;
		world.graphicsWorld.add(this.mesh);
		world.physicsWorld.addBody(this.body.body);
		registerDamageable(this);
	}

	public removeFromWorld(world: EngineContext): void
	{
		world.graphicsWorld.remove(this.mesh);
		world.physicsWorld.removeBody(this.body.body);
		unregisterDamageable(this);
		this.mesh.geometry.dispose();
		this.material.dispose();
	}

	public takeDamage(amount: number): void
	{
		if (this.dead) return;
		this.health -= amount;
		this.hitFlash = 0.15;
		if (this.health <= 0) this.destroy();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public update(timeStep: number, _unscaledTimeStep: number): void
	{
		if (this.hitFlash > 0)
		{
			this.hitFlash = Math.max(0, this.hitFlash - timeStep);
			const t = this.hitFlash / 0.15;
			this.material.emissiveIntensity = 1 + t * 5;
		}
	}

	private destroy(): void
	{
		if (this.dead || this.worldRef === undefined) return;
		this.dead = true; // set before the burst: its area damage must not re-destroy us
		const world = this.worldRef;
		world.registerUpdatable(new Explosion(world, this.position.clone(), 0x66ccff, this.size * 1.6));
		world.remove(this); // removeFromWorld + unregister updatable
	}
}
