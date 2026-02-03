import * as THREE from 'three';
import GUI from 'lil-gui';
import { AudioAnalyzer } from './audio/AudioAnalyzer.js';
import { FractalMode } from './modes/FractalMode.js';
import { ParticleMode } from './modes/ParticleMode.js';
import { TunnelMode } from './modes/TunnelMode.js';
import { KaleidoscopeMode } from './modes/KaleidoscopeMode.js';
import { PlasmaMode } from './modes/PlasmaMode.js';
import { MandelbrotMode } from './modes/MandelbrotMode.js';
import { AuroraMode } from './modes/AuroraMode.js';
import { SacredGeometryMode } from './modes/SacredGeometryMode.js';
import { VoronoiMode } from './modes/VoronoiMode.js';
import { TerrainMode } from './modes/TerrainMode.js';
import { RoverMode } from './modes/RoverMode.js';
import { PlanarMode } from './modes/PlanarMode.js';

const MODE_LIST = [
  { name: 'Fractal', Class: FractalMode },
  { name: 'Mandelbrot Zoom', Class: MandelbrotMode },
  { name: 'Kaleidoscope', Class: KaleidoscopeMode },
  { name: 'Tunnel', Class: TunnelMode },
  { name: 'Plasma', Class: PlasmaMode },
  { name: 'Aurora', Class: AuroraMode },
  { name: 'Sacred Geometry', Class: SacredGeometryMode },
  { name: 'Voronoi Cells', Class: VoronoiMode },
  { name: 'Terrain Flyover', Class: TerrainMode },
  { name: 'Planet Rover', Class: RoverMode },
  { name: 'Planar Realms', Class: PlanarMode },
  { name: 'Particles', Class: ParticleMode },
];

class Visualizer {
  constructor() {
    this.modes = [];
    this.activeModeIndex = 10; // Planar Realms as default
    this.currentModeIndex = 10; // For GUI binding
    this.nextModeIndex = null;
    this.audioEnabled = false;
    this.audioSensitivity = 2.5;
    this.audioSource = 'microphone'; // 'microphone' or 'system'
    this.uiVisible = true;

    // Transition state
    this.transitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 0.5; // seconds

    // Performance options
    this.showFPS = false;
    this.frameRateCap = 0; // 0 = uncapped (vsync), 30, 60, etc.
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsUpdateTime = 0;

    this.init();
  }

  init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    // Clock for animations
    this.clock = new THREE.Clock();

    // Audio analyzer
    this.audio = new AudioAnalyzer();

    // Initialize all modes
    this.modes = MODE_LIST.map(m => new m.Class(this.renderer));

    // Create fade overlay for smooth transitions
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: black;
      opacity: 0;
      pointer-events: none;
      transition: none;
      z-index: 1000;
    `;
    document.body.appendChild(this.fadeOverlay);

    // FPS display
    this.fpsDisplay = document.createElement('div');
    this.fpsDisplay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      color: #0f0;
      font-family: monospace;
      font-size: 14px;
      background: rgba(0,0,0,0.5);
      padding: 4px 8px;
      border-radius: 4px;
      z-index: 1001;
    `;
    this.fpsDisplay.textContent = 'FPS: --';
    this.fpsDisplay.style.display = 'none'; // Hidden by default
    document.body.appendChild(this.fpsDisplay);

    // Build mode dropdown options
    this.modeOptions = {};
    MODE_LIST.forEach((m, i) => {
      this.modeOptions[m.name] = i;
    });

    // GUI
    this.setupGUI();

    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Start
    this.animate();
  }

  setupGUI() {
    this.gui = new GUI();

    const mainFolder = this.gui.addFolder('Visualizer');
    this.modeController = mainFolder.add(this, 'currentModeIndex', this.modeOptions)
      .name('Mode')
      .onChange((v) => this.switchMode(v));

    // Audio controls
    const audioFolder = mainFolder.addFolder('Audio');
    audioFolder.add(this, 'audioEnabled').name('Audio Reactive').onChange((v) => {
      this.toggleAudio(v);
    });

    // Audio source selector
    const audioSources = { 'Microphone': 'microphone', 'System Audio': 'system' };
    audioFolder.add(this, 'audioSource', audioSources).name('Audio Source').onChange((v) => {
      // If audio is currently enabled, restart with new source
      if (this.audioEnabled) {
        this.audio.stop();
        this.audio.start(v);
      }
    });

    audioFolder.add(this, 'audioSensitivity', 0.5, 10.0).name('Sensitivity').onChange((v) => {
      this.audio.setSensitivity(v);
    });

    // Performance controls
    const perfFolder = mainFolder.addFolder('Performance');
    perfFolder.add(this, 'showFPS').name('Show FPS').onChange((v) => {
      this.fpsDisplay.style.display = v ? '' : 'none';
    });
    const fpsCapOptions = { 'VSync (Monitor)': 0, '30 FPS': 30, '60 FPS': 60, '120 FPS': 120 };
    perfFolder.add(this, 'frameRateCap', fpsCapOptions).name('Frame Rate Cap');

    // Add mode-specific controls
    this.modeFolder = this.gui.addFolder('Mode Settings');
    this.updateModeGUI();
  }

  async toggleAudio(enabled) {
    if (enabled) {
      const success = await this.audio.start(this.audioSource);
      if (!success) {
        // Failed to start audio, reset the toggle
        this.audioEnabled = false;
        this.gui.controllersRecursive().find(c => c.property === 'audioEnabled')?.updateDisplay();
      }
    } else {
      this.audio.stop();
    }
  }

  updateModeGUI() {
    // Clear existing controls
    while (this.modeFolder.controllers.length > 0) {
      this.modeFolder.controllers[0].destroy();
    }
    while (this.modeFolder.folders.length > 0) {
      this.modeFolder.folders[0].destroy();
    }

    // Add controls for current mode
    const mode = this.modes[this.activeModeIndex];
    if (mode.setupGUI) {
      mode.setupGUI(this.modeFolder);
    }
  }

  switchMode(newIndex) {
    if (this.transitioning) return;
    if (newIndex === this.activeModeIndex) return;

    this.nextModeIndex = newIndex;
    this.transitioning = true;
    this.transitionProgress = 0;

    // Update immediately (don't wait for transition)
    this.activeModeIndex = newIndex;
    this.currentModeIndex = newIndex;
    this.updateModeGUI();
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.modes.forEach(mode => mode.onResize?.(window.innerWidth, window.innerHeight));
  }

  onKeyDown(e) {
    // Number keys to switch modes (0-9)
    const num = parseInt(e.key);
    if (!isNaN(num)) {
      const index = num === 0 ? 9 : num - 1; // 0 key = mode 10
      if (index < this.modes.length) {
        this.switchMode(index);
        return;
      }
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        this.audioEnabled = !this.audioEnabled;
        this.toggleAudio(this.audioEnabled);
        this.gui.controllersRecursive().find(c => c.property === 'audioEnabled')?.updateDisplay();
        break;
      case 'h':
        this.uiVisible = !this.uiVisible;
        this.gui.domElement.style.display = this.uiVisible ? '' : 'none';
        this.fpsDisplay.style.display = (this.uiVisible && this.showFPS) ? '' : 'none';
        document.getElementById('info')?.classList.toggle('hidden', !this.uiVisible);
        break;
      case 'arrowright':
        this.switchMode((this.currentModeIndex + 1) % this.modes.length);
        break;
      case 'arrowleft':
        this.switchMode((this.currentModeIndex - 1 + this.modes.length) % this.modes.length);
        break;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();

    // Frame rate cap (skip frame if too soon)
    if (this.frameRateCap > 0) {
      const minFrameTime = 1000 / this.frameRateCap;
      if (now - this.lastFrameTime < minFrameTime) {
        return; // Skip this frame
      }
    }
    this.lastFrameTime = now;

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // FPS calculation
    this.frameCount++;
    if (now - this.fpsUpdateTime >= 500) { // Update every 500ms
      this.fps = Math.round(this.frameCount / ((now - this.fpsUpdateTime) / 1000));
      this.fpsDisplay.textContent = `FPS: ${this.fps}`;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    // Get audio data
    const audioData = this.audioEnabled ? this.audio.getFrequencyData() : null;

    // Handle transition fade animation
    if (this.transitioning) {
      this.transitionProgress += delta / this.transitionDuration;

      if (this.transitionProgress < 0.5) {
        // Fading out
        this.fadeOverlay.style.opacity = this.transitionProgress * 2;
      } else if (this.transitionProgress < 1.0) {
        // Fading in
        this.fadeOverlay.style.opacity = (1 - this.transitionProgress) * 2;
      } else {
        // Transition complete
        this.fadeOverlay.style.opacity = 0;
        this.transitioning = false;
        this.nextModeIndex = null;
        this.modeController.updateDisplay();
      }
    }

    // Update and render current mode
    const mode = this.modes[this.activeModeIndex];
    mode.update(delta, elapsed, audioData);
    mode.render(this.renderer);
  }
}

// Start the visualizer
new Visualizer();
