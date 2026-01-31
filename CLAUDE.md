# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A WebGL-based visualizer for displaying trippy visuals on a projector. Built with Three.js and Vite. Features multiple visual modes with toggleable audio reactivity.

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

### Visual Modes (`src/modes/`)
Each mode extends `BaseMode` and implements:
- `update(delta, elapsed, audioData)` - Animation logic
- `render(renderer)` - Render to screen
- `setupGUI(folder)` - Mode-specific lil-gui controls
- `onResize(width, height)` - Handle window resize

Current modes:
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

## Keyboard Shortcuts
- `1-4` - Switch modes
- `Space` - Toggle audio reactive
- `H` - Hide/show UI
