/**
 * Engine event system. The engine emits these events instead of touching the
 * DOM or showing dialogs directly; the app layer subscribes and renders UI.
 */

/** A row of control hints (keys + description) surfaced by an entity. */
export interface IControlRow
{
	keys: string[];
	desc: string;
}

/** Lightweight description of a scenario, for building an app-side menu. */
export interface ScenarioInfo
{
	id: string;
	name: string;
	invisible: boolean;
	welcome?: WelcomeInfo;
}

/** Welcome-screen text carried from a scenario's Blender metadata. */
export interface WelcomeInfo
{
	title?: string;
	content?: string;
}

/** Map of engine event names to their payload types. */
export type EngineEvents = {
	'webgpu:unsupported': void;
	'load:start': void;
	'load:progress': { fraction: number };
	'load:complete': void;
	'ready': void;
	'world:loaded': { scenarios: ScenarioInfo[] };
	'world:empty': void;
	'scenario:launched': { id: string; welcome?: WelcomeInfo };
	'controls:changed': IControlRow[];
};

export type Listener<T> = (payload: T) => void;

/** Minimal typed event emitter (no external dependency). */
export class Emitter<Events extends Record<string, unknown>>
{
	private listeners = new Map<keyof Events, Set<Listener<never>>>();

	public on<K extends keyof Events>(type: K, cb: Listener<Events[K]>): () => void
	{
		let set = this.listeners.get(type);
		if (set === undefined)
		{
			set = new Set();
			this.listeners.set(type, set);
		}
		set.add(cb as Listener<never>);
		return () => this.off(type, cb);
	}

	public off<K extends keyof Events>(type: K, cb: Listener<Events[K]>): void
	{
		this.listeners.get(type)?.delete(cb as Listener<never>);
	}

	public emit<K extends keyof Events>(type: K, payload?: Events[K]): void
	{
		this.listeners.get(type)?.forEach((cb) => (cb as Listener<Events[K]>)(payload as Events[K]));
	}
}
