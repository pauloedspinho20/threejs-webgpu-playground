import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EngineContext } from './EngineContext';
import * as Utils from './FunctionLibrary';

/** Passed to userData handlers for a single glb node. */
export interface SceneNode
{
	node: THREE.Object3D;
	data: Record<string, string>;
	ctx: EngineContext;
}

export type UserDataHandler = (node: SceneNode) => void;
export type MaterialHandler = (mesh: THREE.Mesh, ctx: EngineContext) => void;

/**
 * Traverses a loaded glb and dispatches to registered handlers based on
 * `userData` keys/values and material names. Consumers register handlers for
 * their own Blender conventions — replacing the fixed if-chain that used to
 * live in the engine, so new conventions need no engine changes.
 */
export class SceneLoader
{
	// key -> (value -> handler), e.g. 'data' -> ('physics' -> handler)
	private userDataHandlers = new Map<string, Map<string, UserDataHandler>>();
	private materialHandlers = new Map<string, MaterialHandler>();

	/** Handle nodes whose `userData[key] === value`. */
	public onUserData(key: string, value: string, handler: UserDataHandler): void
	{
		let byValue = this.userDataHandlers.get(key);
		if (byValue === undefined)
		{
			byValue = new Map();
			this.userDataHandlers.set(key, byValue);
		}
		byValue.set(value, handler);
	}

	/** Handle meshes whose material is named `materialName`. */
	public onMaterial(materialName: string, handler: MaterialHandler): void
	{
		this.materialHandlers.set(materialName, handler);
	}

	/** Traverse the glb, dispatch handlers, and add the scene to the graphics world. */
	public load(gltf: GLTF, ctx: EngineContext): void
	{
		gltf.scene.updateMatrixWorld(true);

		gltf.scene.traverse((child: THREE.Object3D) =>
		{
			if (child.type === 'Mesh')
			{
				Utils.setupMeshProperties(child);

				const material = (child as THREE.Mesh).material as THREE.Material | undefined;
				if (material?.name !== undefined)
				{
					const handler = this.materialHandlers.get(material.name);
					if (handler !== undefined) handler(child as THREE.Mesh, ctx);
				}
			}

			if (Object.hasOwn(child, 'userData'))
			{
				const data = child.userData as Record<string, string>;
				this.userDataHandlers.forEach((byValue, key) =>
				{
					if (Object.hasOwn(data, key))
					{
						const handler = byValue.get(data[key]);
						if (handler !== undefined) handler({ node: child, data, ctx });
					}
				});
			}
		});

		ctx.graphicsWorld.add(gltf.scene);
	}
}
