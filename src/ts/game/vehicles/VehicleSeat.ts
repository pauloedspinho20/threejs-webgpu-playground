import * as THREE from 'three';
import { SeatType } from '../enums/SeatType';
import { IControllable } from '../interfaces/IControllable';
import { VehicleDoor } from './VehicleDoor';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Vehicle } from './Vehicle';
import { Character } from '../characters/Character';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class VehicleSeat
{
	public vehicle: IControllable;
	public seatPointObject: THREE.Object3D;

	// String of names of connected seats
	public connectedSeatsString: string;
	// Actual seatPoint objects, need to be identified
	// by parsing connectedSeatsString *after* all seats are imported
	public connectedSeats: VehicleSeat[] = [];

	public type: SeatType;
	public entryPoints: THREE.Object3D[] = [];
	public door: VehicleDoor;

	public occupiedBy: Character = null;

	constructor(vehicle: IControllable, object: THREE.Object3D, gltf: GLTF)
	{
		this.vehicle = vehicle;
		this.seatPointObject = object;

		if (Object.hasOwn(object, 'userData') && Object.hasOwn(object.userData, 'data'))
		{
			if (Object.hasOwn(object.userData, 'door_object')) 
			{
				this.door = new VehicleDoor(this, gltf.scene.getObjectByName(object.userData.door_object));
			}

			if (Object.hasOwn(object.userData, 'entry_points')) 
			{
				const entry_points = (object.userData.entry_points as string).split(';');
				for (const entry_point of entry_points)
				{
					if (entry_point.length > 0)
					{
						this.entryPoints.push(gltf.scene.getObjectByName(entry_point));
					}
				}
			}
			else
			{
				console.error('Seat object ' + object + ' has no entry point reference property.');
			}

			if (Object.hasOwn(object.userData, 'seat_type')) 
			{
				this.type = object.userData.seat_type;
			}
			else
			{
				console.error('Seat object ' + object + ' has no seat type property.');
			}

			if (Object.hasOwn(object.userData, 'connected_seats')) 
			{
				this.connectedSeatsString = object.userData.connected_seats;
			}
		}
	}

	public update(timeStep: number): void
	{
		if (this.door !== undefined)
		{
			this.door.update(timeStep);
		}
	}
}