import * as THREE from 'three';

export class Wheel
{
	public wheelObject: THREE.Object3D;
	public position: THREE.Vector3;
	public steering: boolean = false;
	public drive: string; // Drive type "fwd" or "rwd"
	public rayCastWheelInfoIndex: number; // Linked to a raycast vehicle WheelInfo structure

	constructor(wheelObject: THREE.Object3D)
	{
		this.wheelObject = wheelObject;

		this.position = wheelObject.position;

		if (Object.hasOwn(wheelObject, 'userData') && Object.hasOwn(wheelObject.userData, 'data'))
		{
			if (Object.hasOwn(wheelObject.userData, 'steering')) 
			{
				this.steering = (wheelObject.userData.steering === 'true');
			}

			if (Object.hasOwn(wheelObject.userData, 'drive')) 
			{
				this.drive = wheelObject.userData.drive;
			}
		}
	}
}