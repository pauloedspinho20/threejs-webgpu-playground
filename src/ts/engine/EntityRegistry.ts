import type { EngineContext } from './EngineContext';
import type { IWorldEntity } from './interfaces/IWorldEntity';

/**
 * Builds an entity of a given kind. `opts` is caller-defined (e.g. `{ model }`).
 */
export type EntityFactory<O = any> = (ctx: EngineContext, opts: O) => IWorldEntity;

/**
 * Maps a string `kind` (e.g. 'car', 'player', or a user's custom type) to a
 * factory. Lets consumers add new entity types without editing engine code —
 * replacing the old closed enum + hardcoded `switch`.
 */
export class EntityRegistry
{
	private factories = new Map<string, EntityFactory>();

	public register<O = any>(kind: string, factory: EntityFactory<O>): void
	{
		this.factories.set(kind, factory as EntityFactory);
	}

	public has(kind: string): boolean
	{
		return this.factories.has(kind);
	}

	public create<O = any>(kind: string, ctx: EngineContext, opts?: O): IWorldEntity
	{
		const factory = this.factories.get(kind);
		if (factory === undefined)
		{
			throw new Error(`EntityRegistry: no factory registered for kind '${kind}'`);
		}
		return factory(ctx, opts);
	}
}
