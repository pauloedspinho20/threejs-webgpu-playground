import type { Engine } from '../engine/Engine';
import { Car } from './vehicles/Car';
import { Helicopter } from './vehicles/Helicopter';
import { Airplane } from './vehicles/Airplane';
import { Character } from './characters/Character';
import { Path } from './world/Path';
import { Scenario } from './world/Scenario';

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
