import { ISpawnPoint } from '../interfaces/ISpawnPoint';
import { VehicleSpawnPoint } from './VehicleSpawnPoint';
import { CharacterSpawnPoint } from './CharacterSpawnPoint';
import { World } from '../world/World';
import { LoadingManager } from '../core/LoadingManager';

export class Scenario
{
	public id: string;
	public name: string;
	public spawnAlways: boolean = false;
	public default: boolean = false;
	public world: World;
	public descriptionTitle: string;
	public descriptionContent: string;
	
	private rootNode: THREE.Object3D;
	private spawnPoints: ISpawnPoint[] = [];
	private invisible: boolean = false;
	private initialCameraAngle: number;

	constructor(root: THREE.Object3D, world: World)
	{
		this.rootNode = root;
		this.world = world;
		this.id = root.name;

		// Scenario
		if (Object.hasOwn(root.userData, 'name')) 
		{
			this.name = root.userData.name;
		}
		if (Object.hasOwn(root.userData, 'default') && root.userData.default === 'true') 
		{
			this.default = true;
		}
		if (Object.hasOwn(root.userData, 'spawn_always') && root.userData.spawn_always === 'true') 
		{
			this.spawnAlways = true;
		}
		if (Object.hasOwn(root.userData, 'invisible') && root.userData.invisible === 'true') 
		{
			this.invisible = true;
		}
		if (Object.hasOwn(root.userData, 'desc_title')) 
		{
			this.descriptionTitle = root.userData.desc_title;
		}
		if (Object.hasOwn(root.userData, 'desc_content')) 
		{
			this.descriptionContent = root.userData.desc_content;
		}
		if (Object.hasOwn(root.userData, 'camera_angle')) 
		{
			this.initialCameraAngle = root.userData.camera_angle;
		}

		if (!this.invisible) this.createLaunchLink();

		// Find all scenario spawns and enitites
		root.traverse((child) => {
			if (Object.hasOwn(child, 'userData') && Object.hasOwn(child.userData, 'data'))
			{
				if (child.userData.data === 'spawn')
				{
					if (child.userData.type === 'car' || child.userData.type === 'airplane' || child.userData.type === 'heli')
					{
						const sp = new VehicleSpawnPoint(child);

						if (Object.hasOwn(child.userData, 'type')) 
						{
							sp.type = child.userData.type;
						}

						if (Object.hasOwn(child.userData, 'driver')) 
						{
							sp.driver = child.userData.driver;

							if (child.userData.driver === 'ai' && Object.hasOwn(child.userData, 'first_node'))
							{
								sp.firstAINode = child.userData.first_node;
							}
						}

						this.spawnPoints.push(sp);
					}
					else if (child.userData.type === 'player')
					{
						const sp = new CharacterSpawnPoint(child);
						this.spawnPoints.push(sp);
					}
				}
			}
		});
	}

	public createLaunchLink(): void
	{
		this.world.params[this.name] = () =>
		{
			this.world.launchScenario(this.id);
		};
		this.world.scenarioGUIFolder.add(this.world.params, this.name);
	}

	public launch(loadingManager: LoadingManager, world: World): void
	{
		this.spawnPoints.forEach((sp) => {
			sp.spawn(loadingManager, world);
		});

		if (!this.spawnAlways)
		{
			loadingManager.createWelcomeScreenCallback(this);

			world.cameraOperator.theta = this.initialCameraAngle;
			world.cameraOperator.phi = 15;
		}
	}
}