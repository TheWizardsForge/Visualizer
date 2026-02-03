# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **GPU-first WebGL visualizer** for displaying immersive fantasy environments on a projector. Built with Three.js and Vite. Features multiple visual modes with toggleable audio reactivity.

### Project Goals

- **GPU-First Architecture**: All terrain, lighting, and particle calculations happen on the GPU via shaders for optimal performance
- **D&D-Style Fantasy Planes**: Implementing distinct realms inspired by planar cosmology (Material, Ember Plane, The Deep, Verdant Wild, The Drift, etc.)
- **Dynamic Lighting**: GPU-based fireflies, wisps, and other light sources that illuminate terrain and grass in real-time
- **Day/Night Cycle**: Smooth transitions with proper lighting, fireflies at night, atmospheric changes
- **Procedural Flora/Fauna**: GPU-instanced trees, grass, and creatures with audio reactivity

## Commands

```bash
npm run dev      # Start development server (hot reload)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

### Core Structure
- `src/main.js` - Entry point, manages mode switching, GUI, keyboard controls, and render loop
- `src/audio/AudioAnalyzer.js` - Web Audio API wrapper for frequency analysis (bass/mid/treble/overall)
- `src/modes/BaseMode.js` - Abstract base class all visual modes extend

### Systems (`src/systems/`)
GPU-first reusable systems:
- `TerrainSystem.js` - GPU terrain generation with biomes, dynamic lighting
- `GrassSystem.js` - Instanced grass with GPU terrain sampling
- `SkySystem.js` - Stars, nebulae, moons
- `AtmosphereSystem.js` - Weather, fog, day/night cycle
- `CameraSystem.js` - Multiple camera modes with collision avoidance
- `FloraSystem.js` - Procedural trees and plants
- `FaunaSystem.js` - Animated creatures
- `FireflySystem.js` - GPU-instanced fireflies with dynamic lighting
- `WispSystem.js` - Ethereal light sources with dynamic lighting

### Realms (`src/realms/`)
Realm configurations for different planes of existence:
- `TheMaterial.js` - Earth-like natural biomes
- `TheDeep.js` - Underwater world
- `TheVerdantWild.js` - Fey forest with giant mushrooms
- `TheDrift.js` - Floating islands
- `TheEmberPlane.js` - Volcanic, lava, ash

### Visual Modes (`src/modes/`)
Each mode extends `BaseMode` and implements:
- `update(delta, elapsed, audioData)` - Animation logic
- `render(renderer)` - Render to screen
- `setupGUI(folder)` - Mode-specific lil-gui controls
- `onResize(width, height)` - Handle window resize

Primary modes:
- `PlanarMode` - Main realm-based exploration mode (GPU-first)
- `RoverMode` - Legacy alien planet exploration
- `FractalMode` - Fullscreen GLSL shader with fractal patterns
- `ParticleMode` - 3D particle system (spiral galaxy)

### Adding New Modes
1. Create `src/modes/YourMode.js` extending `BaseMode`
2. Import and add to `modes` array in `main.js`
3. Update mode selector in `setupGUI()`

### Audio Data
When audio is enabled, modes receive `audioData` object:
```js
{
  raw: Uint8Array,     // Raw frequency data
  bass: 0-1,           // Low frequencies
  mid: 0-1,            // Mid frequencies
  treble: 0-1,         // High frequencies
  overall: 0-1         // Average of all
}
```

## GPU-First Principles

1. **Terrain Height**: Computed in vertex shaders using shared noise functions (`src/shaders/terrainNoise.glsl.js`)
2. **Instancing**: All repeated geometry (grass, particles, fireflies) uses GPU instancing
3. **Dynamic Lighting**: Light positions stored in data textures, sampled in fragment shaders
4. **Minimize CPU-GPU Sync**: Height sampling done via GPU readback (`GPUHeightSampler.js`) only when necessary

## Keyboard Shortcuts
- `1-4` - Switch modes
- `Space` - Toggle audio reactive
- `H` - Hide/show UI
