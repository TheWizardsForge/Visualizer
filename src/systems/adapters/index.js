/**
 * System Adapters
 *
 * These adapters wrap existing systems to work with the new
 * WorldContext/SystemManager/LightManager architecture.
 *
 * Usage:
 *   import { AtmosphereAdapter, TerrainAdapter } from './adapters/index.js';
 *
 *   const manager = new SystemManager(context);
 *   manager.register('atmosphere', new AtmosphereAdapter(scene, context, config));
 *   manager.register('terrain', new TerrainAdapter(scene, context, config), ['atmosphere']);
 */

export { AtmosphereAdapter } from './AtmosphereAdapter.js';
export { TerrainAdapter } from './TerrainAdapter.js';
export { GrassAdapter } from './GrassAdapter.js';
export { FloraAdapter } from './FloraAdapter.js';
export { FaunaAdapter } from './FaunaAdapter.js';
export { FireflyAdapter } from './FireflyAdapter.js';
export { WispAdapter } from './WispAdapter.js';
export { SkyAdapter } from './SkyAdapter.js';
export { CameraAdapter } from './CameraAdapter.js';
export { ShadowAdapter } from './ShadowAdapter.js';
