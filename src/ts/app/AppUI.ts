import * as GUI from "dat.gui";
import { ShadcnDialog } from "./ShadcnDialog";
import { Stats } from "../../lib/utils/Stats";
import { Engine } from "../index";
import type { IControlRow, ScenarioInfo, WelcomeInfo } from "../index";
import { cameraTuning } from "../game/config/cameraTuning";

/**
 * App-side UI host. Owns all DOM chrome, the debug GUI, the FPS stats panel,
 * and dialogs. It talks to the engine only through its public API and events —
 * the engine itself never touches the DOM.
 */
export class AppUI {
  private world: Engine;
  private gui: GUI.GUI;
  private scenarioFolder: GUI.GUI;
  private scenarioControllers: GUI.GUIController[] = [];

  constructor(world: Engine) {
    this.world = world;

    this.setupStats();
    this.setupCrosshair();
    this.setupGUI();
    this.bindEvents();
  }

  private crosshair!: HTMLElement;

  private setupCrosshair(): void {
    const el = document.createElement("div");
    el.id = "crosshair";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:50%",
      "width:6px",
      "height:6px",
      "margin:-3px 0 0 -3px",
      "border:1px solid rgba(255,255,255,0.9)",
      "border-radius:50%",
      "box-shadow:0 0 2px rgba(0,0,0,0.8)",
      "pointer-events:none",
      "z-index:20",
      "display:none",
    ].join(";");
    document.body.appendChild(el);
    this.crosshair = el;
  }

  private setCrosshairVisible(visible: boolean): void {
    this.crosshair.style.display = visible ? "block" : "none";
  }

  private setupStats(): void {
    // Stats() self-appends a #statsBox into #ui-container (hidden by default).
    this.world.profiler = Stats();
    this.setFPSVisible(this.world.params.Debug_FPS);
  }

  private setupGUI(): void {
    const params = this.world.params;
    const world = this.world;

    const gui = new GUI.GUI();
    this.gui = gui;

    this.scenarioFolder = gui.addFolder("Scenarios");
    this.scenarioFolder.open();

    const worldFolder = gui.addFolder("World");
    worldFolder
      .add(params, "Time_Scale", 0, 1)
      .listen()
      .onChange((value) => {
        world.timeScaleTarget = value;
      });
    worldFolder
      .add(params, "Sun_Elevation", 0, 180)
      .listen()
      .onChange((value) => {
        world.sky.phi = value;
      });
    worldFolder
      .add(params, "Sun_Rotation", 0, 360)
      .listen()
      .onChange((value) => {
        world.sky.theta = value;
      });

    const settingsFolder = gui.addFolder("Settings");
    settingsFolder.add(params, "FXAA");
    settingsFolder.add(params, "Shadows").onChange((enabled) => {
      world.sky.sunLight.castShadow = enabled;
    });
    settingsFolder.add(params, "Pointer_Lock").onChange((enabled) => {
      world.inputManager.setPointerLock(enabled);
    });
    settingsFolder.add(params, "Mouse_Sensitivity", 0, 1).onChange((value) => {
      world.cameraOperator.setSensitivity(value, value * 0.8);
    });
    settingsFolder.add(params, "Debug_Physics").onChange((enabled) => {
      world.setDebugPhysics(enabled);
    });
    settingsFolder.add(params, "Debug_FPS").onChange((enabled) => {
      this.setFPSVisible(enabled);
    });

    // Live camera / aim-pose tuning (read every frame by Character/Vehicle).
    const camFolder = gui.addFolder("Camera Tuning");
    camFolder.add(cameraTuning, "shoulderHeadHeight", 0, 1.5).name("Shoulder height");
    camFolder.add(cameraTuning, "fpEyeRaise", -0.3, 0.6).name("FP eye raise");
    camFolder.add(cameraTuning, "fpEyeForward", -0.3, 0.5).name("FP eye forward");
    camFolder.add(cameraTuning, "armDownTilt", -0.5, 1.2).name("Arm down tilt");
    camFolder.add(cameraTuning, "armSplay", 0, 0.8).name("Arm splay");
    camFolder.add(cameraTuning, "forearmBend", -0.3, 0.8).name("Forearm bend");
    camFolder.add(cameraTuning, "armRecoil", 0, 1.5).name("Arm recoil");
    camFolder.add(cameraTuning, "vehicleFrontDistance", 1, 6).name("Veh front dist");
    camFolder.add(cameraTuning, "vehicleFrontHeight", 0, 3).name("Veh front height");

    gui.open();
  }

  private bindEvents(): void {
    const w = this.world;

    w.events.on("webgpu:unsupported", () => this.showWebGPUWarning());
    w.events.on("load:start", () => {
      this.setLoadingVisible(true);
      this.setUIVisible(false);
    });
    w.events.on("load:progress", ({ fraction }) =>
      this.updateLoadingProgress(fraction),
    );
    w.events.on("load:complete", () => {
      this.setLoadingVisible(false);
      this.setUIVisible(true);
    });
    w.events.on("controls:changed", (rows) => this.renderControls(rows));
    w.events.on("aim:changed", ({ aiming }) => this.setCrosshairVisible(aiming));

    w.events.on("world:loaded", ({ scenarios }) => {
      this.buildScenarioMenu(scenarios);
      this.showWelcome();
    });

    w.events.on("world:empty", () => {
      this.setLoadingVisible(false);
      this.setUIVisible(true);
      ShadcnDialog.fire({
        icon: "success",
        title: "Hello world!",
        text: "Empty world was succesfully initialized. Enjoy the blueness of the sky.",
      });
    });

    w.events.on("scenario:launched", ({ welcome }) => {
      if (welcome !== undefined) this.showScenarioWelcome(welcome);
    });
  }

  // --- Scenario menu -----------------------------------------------------

  private buildScenarioMenu(scenarios: ScenarioInfo[]): void {
    this.scenarioControllers.forEach((c) => this.scenarioFolder.remove(c));
    this.scenarioControllers = [];

    scenarios
      .filter((s) => !s.invisible)
      .forEach((s) => {
        const proxy = { [s.name]: () => this.world.launchScenario(s.id) };
        this.scenarioControllers.push(this.scenarioFolder.add(proxy, s.name));
      });
  }

  // --- Dialogs -----------------------------------------------------------

  private showWebGPUWarning(): void {
    ShadcnDialog.fire({
      icon: "warning",
      title: "WebGPU compatibility",
      text: "This browser doesn't support WebGPU. The application will fall back to WebGL2, which may perform differently.",
      footer:
        '<a href="https://caniuse.com/webgpu" class="text-primary hover:underline" target="_blank">Click here for more information</a>',
      showConfirmButton: false,
    });
  }

  private showWelcome(): void {
    ShadcnDialog.fire({
      title: "Welcome to the playground!",
      text: "Feel free to explore the world and interact with available vehicles. There are also various scenarios ready to launch from the right panel.",
      footer:
        '<a href="https://github.com/pauloedspinho20/threejs-webgpu-playground" class="text-primary hover:underline" target="_blank">GitHub page</a>',
      confirmButtonText: "Okay",
    });
  }

  private showScenarioWelcome(welcome: WelcomeInfo): void {
    ShadcnDialog.fire({
      title: welcome.title,
      html: welcome.content,
      confirmButtonText: "Play",
    });
  }

  // --- DOM helpers -------------------------------------------------------

  private setUIVisible(visible: boolean): void {
    const el = document.getElementById("ui-container");
    if (el !== null) el.style.display = visible ? "block" : "none";
  }

  private setLoadingVisible(visible: boolean): void {
    const el = document.getElementById("loading-screen");
    if (el !== null) el.style.display = visible ? "flex" : "none";
  }

  private updateLoadingProgress(fraction: number): void {
    const bar = document.getElementById("loading-bar");
    const percentage = document.getElementById("loading-percentage");
    const value = Math.round(fraction * 100);
    if (bar !== null) bar.style.width = `${value}%`;
    if (percentage !== null) percentage.innerText = `${value}%`;
  }

  private setFPSVisible(visible: boolean): void {
    const stats = document.getElementById("statsBox");
    console.log("stats", stats);
    if (stats !== null) stats.style.display = visible ? "block" : "none";
  }

  private renderControls(controls: IControlRow[]): void {
    const target = document.getElementById("controls");
    if (target === null) return;

    let html = "";
    controls.forEach((row) => {
      html += '<div class="flex items-center gap-2 mb-2 justify-between">';
      html += '<div class="flex flex-wrap gap-1 items-center">';
      row.keys.forEach((key) => {
        if (key === "+" || key === "and" || key === "or" || key === "&")
          html += `<span class="text-xs text-muted-foreground">${key}</span>`;
        else
          html += `<span class="inline-flex items-center justify-center rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm">${key}</span>`;
      });
      html += "</div>";
      html += `<span class="text-xs text-right opacity-80 text-white">${row.desc}</span></div>`;
    });

    target.innerHTML = html;
  }
}
