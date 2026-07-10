import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * World bounds used for the out-of-bounds / respawn check. An entity is
 * considered out of bounds when it is BOTH outside the horizontal min/max box
 * (or below `min.y`) AND below `seaLevel`. Set `bounds` to `null` to disable
 * the check entirely (the default for worlds other than the demo).
 */
export interface WorldBounds
{
	min: THREE.Vector3;
	max: THREE.Vector3;
	seaLevel: number;
}

/**
 * Configuration for the engine. Every field is optional; unspecified values
 * fall back to the defaults in {@link resolveEngineOptions}, which reproduce
 * the original demo behaviour.
 */
export interface EngineOptions
{
	/** Element the canvas is mounted into. Defaults to `document.body`. */
	container?: HTMLElement;

	/** Track the container size via ResizeObserver (+ window resize). Default true. */
	autoResize?: boolean;

	/** Start the render loop automatically after init(). Default true. */
	autoStart?: boolean;

	renderer?: {
		antialias?: boolean;
		pixelRatio?: number;
		shadows?: boolean;
		/** Distance (world units) the cascaded sun shadows cover. Default 800. */
		shadowDistance?: number;
		/** Number of shadow cascades. More = crisper shadows over the distance. Default 4. */
		shadowCascades?: number;
		toneMapping?: THREE.ToneMapping;
		toneMappingExposure?: number;
	};

	camera?: {
		fov?: number;
		near?: number;
		far?: number;
	};

	physics?: {
		gravity?: readonly [number, number, number];
		frameRate?: number;
		maxPrediction?: number;
		solverIterations?: number;
	};

	postFX?: {
		enabled?: boolean;
		fxaa?: boolean;
	};

	/** Base URL prepended to named sub-assets (e.g. character/vehicle glbs). */
	assetBaseUrl?: string;

	/** Out-of-bounds bounds, or `null` to disable the check. */
	bounds?: WorldBounds | null;

	respawn?: {
		position: THREE.Vector3;
	};

	timeScale?: number;

	/** Enables app-side debug UI hooks. The engine never builds UI itself. */
	ui?: boolean;

	/** Initial world to load: a URL/path (used as-is) or an already-loaded GLTF. */
	world?: string | GLTF | null;
}

/** Fully-resolved options with all defaults applied. */
export interface ResolvedEngineOptions
{
	container: HTMLElement;
	autoResize: boolean;
	autoStart: boolean;
	renderer: {
		antialias: boolean;
		pixelRatio: number;
		shadows: boolean;
		shadowDistance: number;
		shadowCascades: number;
		toneMapping: THREE.ToneMapping;
		toneMappingExposure: number;
	};
	camera: { fov: number; near: number; far: number };
	physics: {
		gravity: readonly [number, number, number];
		frameRate: number;
		maxPrediction: number;
		solverIterations: number;
	};
	postFX: { enabled: boolean; fxaa: boolean };
	assetBaseUrl: string;
	bounds: WorldBounds | null;
	respawn: { position: THREE.Vector3 };
	timeScale: number;
	ui: boolean;
	world: string | GLTF | null;
}

/**
 * The demo world's out-of-bounds box (specific to `world.glb`). Used as the
 * default so the shipped playground behaves exactly as before.
 */
export const DEMO_WORLD_BOUNDS: WorldBounds = {
	min: new THREE.Vector3(-211.882, 0.107, -169.098),
	max: new THREE.Vector3(211.882, Infinity, 153.232),
	seaLevel: 14.989
};

/** Merge user options over the defaults that reproduce the original behaviour. */
export function resolveEngineOptions(options: EngineOptions = {}): ResolvedEngineOptions
{
	const frameRate = options.physics?.frameRate ?? 60;

	return {
		container: options.container ?? document.body,
		autoResize: options.autoResize ?? true,
		autoStart: options.autoStart ?? true,
		renderer: {
			antialias: options.renderer?.antialias ?? false,
			pixelRatio: options.renderer?.pixelRatio ?? window.devicePixelRatio,
			shadows: options.renderer?.shadows ?? true,
			shadowDistance: options.renderer?.shadowDistance ?? 800,
			shadowCascades: options.renderer?.shadowCascades ?? 4,
			toneMapping: options.renderer?.toneMapping ?? THREE.ACESFilmicToneMapping,
			toneMappingExposure: options.renderer?.toneMappingExposure ?? 1.0
		},
		camera: {
			fov: options.camera?.fov ?? 80,
			near: options.camera?.near ?? 0.1,
			far: options.camera?.far ?? 1010
		},
		physics: {
			gravity: options.physics?.gravity ?? [0, -9.81, 0],
			frameRate,
			maxPrediction: options.physics?.maxPrediction ?? frameRate,
			solverIterations: options.physics?.solverIterations ?? 10
		},
		postFX: {
			enabled: options.postFX?.enabled ?? true,
			fxaa: options.postFX?.fxaa ?? true
		},
		assetBaseUrl: options.assetBaseUrl ?? '/assets/',
		bounds: options.bounds === undefined ? DEMO_WORLD_BOUNDS : options.bounds,
		respawn: options.respawn ?? { position: new THREE.Vector3(0, 16, 0) },
		timeScale: options.timeScale ?? 1,
		ui: options.ui ?? true,
		world: options.world ?? null
	};
}
