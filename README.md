# Visualizer

A WebGL-based visualizer for displaying trippy visuals. Mostly vibe coded, just a fun toy to use for background ambiance. 

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/thewizardsforge)

<!-- TODO: Add screenshot or GIF here -->
<!-- ![Visualizer Demo](docs/demo.gif) -->

## Features

- **11 Visual Modes** - Fractals, particle systems, shaders, and more
- **Audio Reactive** - Visuals respond to microphone input
- **Adjustable Parameters** - Each mode has tweakable settings via GUI
- **Smooth Transitions** - Fade effects when switching between modes
- **Fullscreen Ready** - Designed for projectors and large displays

## Visual Modes

| Mode | Description |
|------|-------------|
| Fractal | Animated GLSL fractal patterns |
| Mandelbrot Zoom | Classic Mandelbrot set with continuous zoom |
| Kaleidoscope | Symmetric, colorful kaleidoscope effect |
| Tunnel | Infinite tunnel fly-through |
| Plasma | Retro plasma wave patterns |
| Aurora | Northern lights simulation |
| Sacred Geometry | Geometric patterns and mandalas |
| Voronoi Cells | Dynamic Voronoi diagram visualization |
| Terrain Flyover | Procedural terrain generation |
| Planet Rover | Alien planet surface exploration |
| Particles | 3D particle system (spiral galaxy) |

## Installation

```bash
git clone https://github.com/Zarmazarma/Visualizer.git
cd visualizer
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Usage

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-9`, `0` | Switch to mode 1-10 (0 = mode 10) |
| `←` `→` | Cycle through modes |
| `Space` | Toggle audio reactive mode |
| `H` | Hide/show UI |

### Audio Reactivity

Click "Audio Reactive" in the GUI or press `Space` to enable. The visualizer will request microphone access and respond to sound - bass, mids, and treble affect different visual parameters depending on the mode.

Adjust "Audio Sensitivity" to fine-tune the responsiveness.

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` folder. Can be deployed to any static hosting (GitHub Pages, Netlify, Vercel, etc.).

## Adding Custom Modes

1. Create a new file in `src/modes/` extending `BaseMode`
2. Implement `update(delta, elapsed, audioData)` and `render(renderer)`
3. Add your mode to the `MODE_LIST` array in `src/main.js`

See existing modes for examples.

## Contributing

Feel free to contribute however you want. I'll be updating the project semi-regularly as I find time.

## Support

If you enjoy this project, consider supporting development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/thewizardsforge)

## License

[MIT](LICENSE)
