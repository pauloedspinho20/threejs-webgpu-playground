import * as THREE from 'three';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { World } from './World';
import { IUpdatable } from '../interfaces/IUpdatable';

export class Sky extends THREE.Object3D implements IUpdatable
{
	public updateOrder: number = 5;

	public sunPosition: THREE.Vector3 = new THREE.Vector3();
	public sunLight: THREE.DirectionalLight;
	public csm: CSMShadowNode;

	set theta(value: number) {
		this._theta = value;
		this.refreshSunPosition();
	}

	set phi(value: number) {
		this._phi = value;
		this.refreshSunPosition();
		this.refreshHemiIntensity();
	}

	private _phi: number = 50;
	private _theta: number = 145;

	private hemiLight: THREE.HemisphereLight;
	// Intensities are ~PI x the original values to compensate for three.js r155+
	// physically-based lighting (legacy 0.9 / 0.3).
	private maxHemiIntensity: number = 2.83;
	private minHemiIntensity: number = 0.94;

	private skyMesh: SkyMesh;

	private world: World;

	constructor(world: World)
	{
		super();

		this.world = world;

		// Sky dome — three.js SkyMesh is the TSL-native Preetham model.
		// Uniform values match the original SkyShader (same lineage).
		this.skyMesh = new SkyMesh();
		this.skyMesh.scale.setScalar(1000);
		this.skyMesh.turbidity.value = 2;
		this.skyMesh.rayleigh.value = 1;
		this.skyMesh.mieCoefficient.value = 0.005;
		this.skyMesh.mieDirectionalG.value = 0.8;
		this.attach(this.skyMesh);

		// Ambient light
		this.hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 1.0 );
		this.refreshHemiIntensity();
		this.hemiLight.color.setHSL( 0.59, 0.4, 0.6 );
		this.hemiLight.groundColor.setHSL( 0.095, 0.2, 0.75 );
		this.hemiLight.position.set( 0, 50, 0 );
		this.world.graphicsWorld.add( this.hemiLight );

		// Sun (directional light). Its direction (position -> target) drives CSM.
		this.sunLight = new THREE.DirectionalLight( 0xffffff, 3.0 );
		this.sunLight.castShadow = true;
		this.sunLight.shadow.mapSize.setScalar( 2048 );
		this.sunLight.shadow.camera.near = 0.5;
		this.sunLight.shadow.camera.far = 250;
		this.world.graphicsWorld.add( this.sunLight );
		this.world.graphicsWorld.add( this.sunLight.target );

		// CSMShadowNode drives cascaded shadows for the sun light.
		// customSplitsCallback pushes normalized cascade breaks into `target`,
		// preserving the original 1/4^i split distribution.
		let splitsCallback = (amount: number, near: number, far: number, target: number[]) =>
		{
			for (let i = amount - 1; i >= 0; i--)
			{
				target.push(Math.pow(1 / 4, i));
			}
		};

		this.csm = new CSMShadowNode(this.sunLight, {
			maxFar: 250,
			cascades: 3,
			mode: 'custom',
			customSplitsCallback: splitsCallback
		});
		this.csm.fade = true;
		this.sunLight.shadow.shadowNode = this.csm;

		this.refreshSunPosition();

		world.graphicsWorld.add(this);
		world.registerUpdatable(this);
	}

	public update(timeScale: number): void
	{
		this.position.copy(this.world.camera.position);
		this.refreshSunPosition();
	}

	public refreshSunPosition(): void
	{
		const sunDistance = 10;

		this.sunPosition.x = sunDistance * Math.sin(this._theta * Math.PI / 180) * Math.cos(this._phi * Math.PI / 180);
		this.sunPosition.y = sunDistance * Math.sin(this._phi * Math.PI / 180);
		this.sunPosition.z = sunDistance * Math.cos(this._theta * Math.PI / 180) * Math.cos(this._phi * Math.PI / 180);

		this.skyMesh.sunPosition.value.copy(this.sunPosition);

		// DirectionalLight shines from position toward target(origin), so the
		// light direction equals -sunPosition.
		this.sunLight.position.copy(this.sunPosition);
		this.sunLight.target.position.set(0, 0, 0);
	}

	public refreshHemiIntensity(): void
	{
		this.hemiLight.intensity = this.minHemiIntensity + Math.pow(1 - (Math.abs(this._phi - 90) / 90), 0.25) * (this.maxHemiIntensity - this.minHemiIntensity);
	}
}
