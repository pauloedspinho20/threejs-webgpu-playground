import { ISpawnPoint } from '../interfaces/ISpawnPoint';
import * as THREE from 'three';
import type { EngineContext } from '../core/EngineContext';
import { Character } from '../characters/Character';
import { LoadingManager } from '../core/LoadingManager';
import * as Utils from '../core/FunctionLibrary';

export class CharacterSpawnPoint implements ISpawnPoint
{
	private object: THREE.Object3D;

	constructor(object: THREE.Object3D)
	{
		this.object = object;
	}
	
	public spawn(loadingManager: LoadingManager, world: EngineContext): void
	{
		loadingManager.loadGLTF(world.resolveAsset('boxman.glb'), (model) =>
		{
			const player = new Character(model);
			
			const worldPos = new THREE.Vector3();
			this.object.getWorldPosition(worldPos);
			player.setPosition(worldPos.x, worldPos.y, worldPos.z);
			
			const forward = Utils.getForward(this.object);
			player.setOrientation(forward, true);
			
			world.add(player);
			player.takeControl();
		});
	}
}