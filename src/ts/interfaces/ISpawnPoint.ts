import type { EngineContext } from '../core/EngineContext';
import { LoadingManager } from '../core/LoadingManager';

export interface ISpawnPoint
{
	spawn(loadingManager: LoadingManager, world: EngineContext): void;
}