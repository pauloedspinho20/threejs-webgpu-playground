import * as THREE from 'three';

/**
 * First-person viewmodel: a separate scene composited *over* the world through
 * a dedicated narrow-FOV camera fixed at the origin. Content parented to
 * `leftHand` / `rightHand` lives in view space (always in front of the player)
 * and, because it is its own pass, never clips into world geometry — the
 * standard FPS "hands / weapon" layer.
 *
 * The engine renders `scene`/`camera` as a post-processing pass and blends it
 * over the world by alpha. When `enabled` is false the hand sockets are hidden,
 * so the pass is fully transparent and nothing shows. Game code fills the hand
 * sockets (arms, weapons, spells).
 */
export class Viewmodel
{
	public readonly scene: THREE.Scene = new THREE.Scene();
	public readonly camera: THREE.PerspectiveCamera;
	/** View-space sockets. Attach held items / arms here. */
	public readonly leftHand: THREE.Group = new THREE.Group();
	public readonly rightHand: THREE.Group = new THREE.Group();

	private _enabled: boolean = false;

	constructor(fov: number = 55, near: number = 0.01, far: number = 20)
	{
		// Camera stays at the origin looking down -Z; the hands are placed in
		// view space so they track the screen, not the world.
		this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);

		// A separate scene isn't lit by the world's lights, so give it its own.
		const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0);
		const key = new THREE.DirectionalLight(0xffffff, 2.0);
		key.position.set(-0.5, 1.0, 1.0);
		this.scene.add(hemi, key, this.leftHand, this.rightHand);

		// Default resting placement: lower-left / lower-right of view, angled
		// inward and slightly up so held items read as "in front of the player".
		this.rightHand.position.set(0.16, -0.24, -0.45);
		this.rightHand.rotation.set(-0.2, -0.15, 0);
		this.leftHand.position.set(-0.16, -0.24, -0.45);
		this.leftHand.rotation.set(-0.2, 0.15, 0);

		this.enabled = false;
	}

	/** Show/hide the viewmodel. Hidden = the composite pass renders nothing. */
	public get enabled(): boolean { return this._enabled; }
	public set enabled(value: boolean)
	{
		this._enabled = value;
		this.leftHand.visible = value;
		this.rightHand.visible = value;
	}

	/** Keep the viewmodel projection matched to the screen so hands don't stretch. */
	public setAspect(aspect: number): void
	{
		if (aspect <= 0) return;
		this.camera.aspect = aspect;
		this.camera.updateProjectionMatrix();
	}
}
