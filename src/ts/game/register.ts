import * as THREE from 'three';
import type { Engine } from '../index';
import { Car } from './vehicles/Car';
import { Helicopter } from './vehicles/Helicopter';
import { Airplane } from './vehicles/Airplane';
import { Character } from './characters/Character';
import { Path } from './world/Path';
import { Scenario } from './world/Scenario';
import { MagicBolt } from './abilities/MagicBolt';
import { Target } from './combat/Target';

/**
 * Registers this demo's content with an engine: the entity kinds its spawn
 * points can create, and the Blender glb conventions its worlds use. A
 * different game would provide its own equivalent — the engine ships none of
 * this hardcoded.
 */
export function registerGameContent(engine: Engine): void
{
	// Entity kinds (referenced by `userData.type` on scenario spawn points).
	engine.entities.register('car', (_ctx, { model }) => new Car(model));
	engine.entities.register('heli', (_ctx, { model }) => new Helicopter(model));
	engine.entities.register('airplane', (_ctx, { model }) => new Airplane(model));
	engine.entities.register('player', (_ctx, { model }) => new Character(model));

	// Dual-wield powers: a warm bolt for the right hand, a cool one for the left.
	engine.abilities.register('fire-bolt', () => new MagicBolt('fire-bolt', 0xff6a2a));
	engine.abilities.register('frost-bolt', () => new MagicBolt('frost-bolt', 0x4aa3ff));

	// Destructible target block (opts: { position, size?, health? }).
	engine.entities.register('target', (_ctx, opts: { position: THREE.Vector3; size?: number; health?: number }) =>
		new Target(opts.position, opts.size, opts.health));

	// Demo shooting-range: a floating arc of targets in front of the default spawn.
	engine.events.on('world:loaded', () =>
	{
		const spots: Array<[number, number, number]> = [
			[-4.5, 16.2, -11], [-2.2, 16.8, -12], [0, 17, -12.5], [2.2, 16.8, -12], [4.5, 16.2, -11]
		];
		for (const [x, y, z] of spots)
		{
			engine.add(engine.entities.create('target', engine, { position: new THREE.Vector3(x, y, z) }));
		}
	});

	// glb authoring conventions specific to this game.
	engine.sceneLoader.onUserData('data', 'path', ({ node, ctx }) =>
	{
		ctx.paths.push(new Path(node));
	});
	engine.sceneLoader.onUserData('data', 'scenario', ({ node, ctx }) =>
	{
		ctx.scenarios.push(new Scenario(node, ctx));
	});
}
