import type { Ability } from './Ability';

export type AbilityFactory = () => Ability;

/**
 * Maps an ability id (e.g. 'fire-bolt') to a factory. Consumers register their
 * powers here; a character equips one per hand by id. Mirrors EntityRegistry /
 * the SceneLoader — content plugs in without engine edits.
 */
export class AbilityRegistry
{
	private factories = new Map<string, AbilityFactory>();

	public register(id: string, factory: AbilityFactory): void
	{
		this.factories.set(id, factory);
	}

	public has(id: string): boolean
	{
		return this.factories.has(id);
	}

	public create(id: string): Ability
	{
		const factory = this.factories.get(id);
		if (factory === undefined)
		{
			throw new Error(`AbilityRegistry: no ability registered for id '${id}'`);
		}
		return factory();
	}

	public ids(): string[]
	{
		return [...this.factories.keys()];
	}
}
