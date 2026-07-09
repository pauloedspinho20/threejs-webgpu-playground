import * as GUI from 'dat.gui';
import Swal from 'sweetalert2';
import { Stats } from '../../lib/utils/Stats';
import { Engine } from '../engine/Engine';
import { IControlRow, ScenarioInfo, WelcomeInfo } from '../engine/EngineEvents';

/**
 * App-side UI host. Owns all DOM chrome, the debug GUI, the FPS stats panel,
 * and dialogs. It talks to the engine only through its public API and events —
 * the engine itself never touches the DOM.
 */
export class AppUI
{
	private world: Engine;
	private gui: GUI.GUI;
	private scenarioFolder: GUI.GUI;
	private scenarioControllers: GUI.GUIController[] = [];

	constructor(world: Engine)
	{
		this.world = world;

		this.setupStats();
		this.setupGUI();
		this.bindEvents();
	}

	private setupStats(): void
	{
		// Stats() self-appends a #statsBox into #ui-container (hidden by default).
		this.world.profiler = Stats();
	}

	private setupGUI(): void
	{
		const params = this.world.params;
		const world = this.world;

		const gui = new GUI.GUI();
		this.gui = gui;

		this.scenarioFolder = gui.addFolder('Scenarios');
		this.scenarioFolder.open();

		const worldFolder = gui.addFolder('World');
		worldFolder.add(params, 'Time_Scale', 0, 1).listen()
			.onChange((value) => { world.timeScaleTarget = value; });
		worldFolder.add(params, 'Sun_Elevation', 0, 180).listen()
			.onChange((value) => { world.sky.phi = value; });
		worldFolder.add(params, 'Sun_Rotation', 0, 360).listen()
			.onChange((value) => { world.sky.theta = value; });

		const settingsFolder = gui.addFolder('Settings');
		settingsFolder.add(params, 'FXAA');
		settingsFolder.add(params, 'Shadows')
			.onChange((enabled) => { world.sky.sunLight.castShadow = enabled; });
		settingsFolder.add(params, 'Pointer_Lock')
			.onChange((enabled) => { world.inputManager.setPointerLock(enabled); });
		settingsFolder.add(params, 'Mouse_Sensitivity', 0, 1)
			.onChange((value) => { world.cameraOperator.setSensitivity(value, value * 0.8); });
		settingsFolder.add(params, 'Debug_Physics')
			.onChange((enabled) => { world.setDebugPhysics(enabled); });
		settingsFolder.add(params, 'Debug_FPS')
			.onChange((enabled) => { this.setFPSVisible(enabled); });

		gui.open();
	}

	private bindEvents(): void
	{
		const w = this.world;

		w.events.on('webgpu:unsupported', () => this.showWebGPUWarning());
		w.events.on('load:start', () => { this.setLoadingVisible(true); this.setUIVisible(false); });
		w.events.on('load:complete', () => { this.setLoadingVisible(false); this.setUIVisible(true); });
		w.events.on('controls:changed', (rows) => this.renderControls(rows));

		w.events.on('world:loaded', ({ scenarios }) =>
		{
			this.buildScenarioMenu(scenarios);
			this.showWelcome();
		});

		w.events.on('world:empty', () =>
		{
			this.setLoadingVisible(false);
			this.setUIVisible(true);
			Swal.fire({
				icon: 'success',
				title: 'Hello world!',
				text: 'Empty world was succesfully initialized. Enjoy the blueness of the sky.',
				buttonsStyling: false
			});
		});

		w.events.on('scenario:launched', ({ welcome }) =>
		{
			if (welcome !== undefined) this.showScenarioWelcome(welcome);
		});
	}

	// --- Scenario menu -----------------------------------------------------

	private buildScenarioMenu(scenarios: ScenarioInfo[]): void
	{
		this.scenarioControllers.forEach((c) => this.scenarioFolder.remove(c));
		this.scenarioControllers = [];

		scenarios.filter((s) => !s.invisible).forEach((s) =>
		{
			const proxy = { [s.name]: () => this.world.launchScenario(s.id) };
			this.scenarioControllers.push(this.scenarioFolder.add(proxy, s.name));
		});
	}

	// --- Dialogs -----------------------------------------------------------

	private showWebGPUWarning(): void
	{
		Swal.fire({
			icon: 'warning',
			title: 'WebGPU compatibility',
			text: 'This browser doesn\'t support WebGPU. The application will fall back to WebGL2, which may perform differently.',
			footer: '<a href="https://caniuse.com/webgpu" target="_blank">Click here for more information</a>',
			showConfirmButton: false,
			buttonsStyling: false
		});
	}

	private showWelcome(): void
	{
		Swal.fire({
			title: 'Welcome to the playground!',
			text: 'Feel free to explore the world and interact with available vehicles. There are also various scenarios ready to launch from the right panel.',
			footer: '<a href="https://github.com/pauloedspinho20/threejs-webgpu-playground" target="_blank">GitHub page</a>',
			confirmButtonText: 'Okay',
			buttonsStyling: false
		});
	}

	private showScenarioWelcome(welcome: WelcomeInfo): void
	{
		Swal.fire({
			title: welcome.title,
			html: welcome.content,
			confirmButtonText: 'Play',
			buttonsStyling: false
		});
	}

	// --- DOM helpers -------------------------------------------------------

	private setUIVisible(visible: boolean): void
	{
		const el = document.getElementById('ui-container');
		if (el !== null) el.style.display = visible ? 'block' : 'none';
	}

	private setLoadingVisible(visible: boolean): void
	{
		const el = document.getElementById('loading-screen');
		if (el !== null) el.style.display = visible ? 'flex' : 'none';
	}

	private setFPSVisible(visible: boolean): void
	{
		const stats = document.getElementById('statsBox');
		if (stats !== null) stats.style.display = visible ? 'block' : 'none';
	}

	private renderControls(controls: IControlRow[]): void
	{
		const target = document.getElementById('controls');
		if (target === null) return;

		let html = '<h2 class="controls-title">Controls:</h2>';
		controls.forEach((row) =>
		{
			html += '<div class="ctrl-row">';
			row.keys.forEach((key) =>
			{
				if (key === '+' || key === 'and' || key === 'or' || key === '&') html += '&nbsp;' + key + '&nbsp;';
				else html += '<span class="ctrl-key">' + key + '</span>';
			});
			html += '<span class="ctrl-desc">' + row.desc + '</span></div>';
		});

		target.innerHTML = html;
	}
}
