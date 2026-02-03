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

### Unified Architecture (Core Abstractions)

The codebase uses a unified architecture with centralized state management and automatic system orchestration.

#### WorldContext (`src/core/WorldContext.js`)
Single source of truth for all shared state:
```js
context.delta          // Frame delta time
context.elapsed        // Total elapsed time
context.roverZ         // Camera Z position (movement)
context.roverX         // Camera X position (lateral)
context.terrainY       // Current terrain height
context.sunBrightness  // 0-1 based on day/night cycle
context.dayNightCycle  // 0-1 (0=midnight, 0.5=noon)
context.audioData      // { bass, mid, treble, overall }
context.terrainSystem  // Reference for height sampling
context.lightManager   // Central light registry
```

#### SystemManager (`src/core/SystemManager.js`)
Orchestrates system lifecycle with dependency-based ordering:
```js
const manager = new SystemManager(context);
manager.register('terrain', terrainAdapter);
manager.register('flora', floraAdapter, ['terrain']);  // depends on terrain
manager.register('firefly', fireflyAdapter, ['terrain', 'atmosphere']);

manager.createAll();        // Topological order
manager.initAll(renderer);  // GPU resources
manager.update();           // Per-frame updates
manager.disposeAll();       // Reverse order cleanup
```

#### BaseSystem (`src/core/BaseSystem.js`)
Interface all systems implement:
```js
class MySystem extends BaseSystem {
  create()           // Build geometry, materials
  init(renderer)     // Initialize GPU resources
  update()           // Per-frame logic, reads from this.context
  dispose()          // Cleanup
}
```

#### LightManager (`src/lights/LightManager.js`)
Central registry for dynamic light sources:
```js
lightManager.registerSource('firefly', color, radius);
lightManager.updateSource('firefly', positions);  // Updates data texture
lightManager.getTexture('firefly');               // For shader uniforms
```

### Core Structure
- `src/main.js` - Entry point, manages mode switching, GUI, keyboard controls, and render loop
- `src/audio/AudioAnalyzer.js` - Web Audio API wrapper for frequency analysis (bass/mid/treble/overall)
- `src/modes/BaseMode.js` - Abstract base class all visual modes extend
- `src/core/` - Unified architecture (WorldContext, SystemManager, BaseSystem, ZWrapper)
- `src/lights/` - Centralized lighting (LightManager)

### Systems (`src/systems/`)
GPU-first reusable systems. Each system has an **adapter** in `src/systems/adapters/` that wraps it for the unified architecture:

| System | Adapter | Purpose |
|--------|---------|---------|
| `TerrainSystem.js` | `TerrainAdapter.js` | GPU terrain with biomes, dynamic lighting |
| `GrassSystem.js` | `GrassAdapter.js` | Instanced grass with GPU terrain sampling |
| `SkySystem.js` | `SkyAdapter.js` | Stars, nebulae, moons |
| `AtmosphereSystem.js` | `AtmosphereAdapter.js` | Weather, fog, day/night, post-processing |
| `CameraSystem.js` | `CameraAdapter.js` | Multiple camera modes |
| `FloraSystem.js` | `FloraAdapter.js` | Procedural trees and plants |
| `FaunaSystem.js` | `FaunaAdapter.js` | Animated creatures |
| `FireflySystem.js` | `FireflyAdapter.js` | GPU-instanced fireflies |
| `WispSystem.js` | `WispAdapter.js` | Ethereal light sources |

**Adding a new system:**
1. Create `src/systems/MySystem.js` with the core logic
2. Create `src/systems/adapters/MyAdapter.js` extending `BaseSystem`
3. Export from `src/systems/adapters/index.js`
4. Register in `PlanarMode.setupScene()` with dependencies

### Realms
Realm configurations are defined in `PlanarMode.getRealmConfig()`. Each realm specifies:
- Terrain: biomes, height, scale, alien veins
- Sky: type, stars, nebulae, moons, aurora
- Atmosphere: fog, bloom, underwater effects
- Flora/Fauna: types per biome
- Grass: enabled, density, color

Available realms: `material`, `astral`, `deep`, `verdant`, `drift`, `ember`

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
