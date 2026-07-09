import type { EngineContext } from '../EngineContext';
import { EntityType } from '../../game/enums/EntityType';
import { IUpdatable } from './IUpdatable';

export interface IWorldEntity extends IUpdatable
{
	entityType: EntityType;

	addToWorld(world: EngineContext): void;
	removeFromWorld(world: EngineContext): void;
}