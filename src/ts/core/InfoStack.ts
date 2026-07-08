import { InfoStackMessage } from './InfoStackMessage';
import { IWorldEntity } from '../interfaces/IWorldEntity';
import { EntityType } from '../enums/EntityType';
import { World } from '../world/World';

export class InfoStack implements IWorldEntity
{
	public updateOrder: number = 3;
	public entityType: EntityType = EntityType.System;

	public messages: InfoStackMessage[] = [];
	public entranceAnimation: string = 'animate__slideInLeft';
	public exitAnimation: string = 'animate__backOutDown';

	public messageDuration: number = 3;

	public addMessage(text: string): void
	{
		const messageElement = document.createElement('div');
		messageElement.classList.add('console-message', 'animate__animated', this.entranceAnimation);
		messageElement.style.setProperty('--animate-duration', '0.3s');
		const textElement = document.createTextNode(text);
		messageElement.appendChild(textElement);
		document.getElementById('console').prepend(messageElement);
		this.messages.push(new InfoStackMessage(this, messageElement));
	}

	public update(timeStep: number): void
	{
		for (const message of this.messages) {
			message.update(timeStep);
		}
	}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public addToWorld(_world: World): void
	{
	}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public removeFromWorld(_world: World): void
	{
	}
}