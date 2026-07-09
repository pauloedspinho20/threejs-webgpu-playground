import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingTrackerEntry } from './LoadingTrackerEntry';
import type { EngineContext } from './EngineContext';

export class LoadingManager
{
	public firstLoad: boolean = true;
	public onFinishedCallback: () => void;

	private world: EngineContext;
	private gltfLoader: GLTFLoader;
	private loadingTracker: LoadingTrackerEntry[] = [];

	constructor(world: EngineContext)
	{
		this.world = world;
		this.gltfLoader = new GLTFLoader();

		this.world.setTimeScale(0);
		this.world.events.emit('load:start');
	}

	public loadGLTF(path: string, onLoadingFinished: (gltf: GLTF) => void): void
	{
		const trackerEntry = this.addLoadingEntry(path);

		this.gltfLoader.load(path,
		(gltf) =>
		{
			onLoadingFinished(gltf);
			this.doneLoading(trackerEntry);
		},
		(xhr) =>
		{
			if (xhr.lengthComputable)
			{
				trackerEntry.progress = xhr.loaded / xhr.total;
				this.world.events.emit('load:progress', { fraction: this.getLoadingPercentage() / 100 });
			}
		},
		(error) =>
		{
			console.error(error);
		});
	}

	public addLoadingEntry(path: string): LoadingTrackerEntry
	{
		const entry = new LoadingTrackerEntry(path);
		this.loadingTracker.push(entry);

		return entry;
	}

	public doneLoading(trackerEntry: LoadingTrackerEntry): void
	{
		trackerEntry.finished = true;
		trackerEntry.progress = 1;

		if (this.isLoadingDone())
		{
			this.world.events.emit('load:complete');

			if (this.onFinishedCallback !== undefined)
			{
				this.onFinishedCallback();
			}
		}
	}

	private getLoadingPercentage(): number
	{
		let total = 0;
		let finished = 0;

		for (const item of this.loadingTracker)
		{
			total++;
			finished += item.progress;
		}

		return (finished / total) * 100;
	}

	private isLoadingDone(): boolean
	{
		for (const entry of this.loadingTracker) {
			if (!entry.finished) return false;
		}
		return true;
	}
}
