import type { EngineContext } from '../EngineContext';
import { LoadingManager } from '../LoadingManager';

export interface ISpawnPoint
{
	spawn(loadingManager: LoadingManager, world: EngineContext): void;
}