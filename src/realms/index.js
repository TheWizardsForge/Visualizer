/**
 * Realm Index - Export all realm configurations
 */

export { RealmBase, createRealmConfig, createBiome } from './RealmBase.js';
export { TheMaterial } from './TheMaterial.js';
export { TheDeep } from './TheDeep.js';
export { TheVerdantWild } from './TheVerdantWild.js';
export { TheDrift } from './TheDrift.js';
export { TheEmberPlane } from './TheEmberPlane.js';

// Registry of all available realms
export const RealmRegistry = {
  material: () => import('./TheMaterial.js').then(m => m.TheMaterial),
  deep: () => import('./TheDeep.js').then(m => m.TheDeep),
  verdant: () => import('./TheVerdantWild.js').then(m => m.TheVerdantWild),
  drift: () => import('./TheDrift.js').then(m => m.TheDrift),
  ember: () => import('./TheEmberPlane.js').then(m => m.TheEmberPlane)
};

// Get realm by ID (sync version using static imports)
export function getRealmSync(id) {
  const realms = {
    material: require('./TheMaterial.js').TheMaterial,
    deep: require('./TheDeep.js').TheDeep,
    verdant: require('./TheVerdantWild.js').TheVerdantWild,
    drift: require('./TheDrift.js').TheDrift,
    ember: require('./TheEmberPlane.js').TheEmberPlane
  };
  return realms[id] || realms.material;
}

// List all available realm IDs
export const availableRealms = ['material', 'deep', 'verdant', 'drift', 'ember'];

// Realm display names
export const realmNames = {
  material: 'The Material',
  deep: 'The Deep',
  verdant: 'The Verdant Wild',
  drift: 'The Drift',
  ember: 'The Ember Plane'
};
