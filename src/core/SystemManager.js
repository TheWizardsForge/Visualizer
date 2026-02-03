/**
 * SystemManager - Lifecycle orchestrator for all systems
 *
 * Handles:
 * - System registration with dependencies
 * - Automatic update ordering based on dependencies
 * - Lifecycle management (create, init, update, dispose)
 *
 * Usage:
 *   const manager = new SystemManager(context);
 *   manager.register('atmosphere', atmosphereSystem);
 *   manager.register('terrain', terrainSystem, ['atmosphere']);
 *   manager.register('grass', grassSystem, ['terrain']);
 *
 *   manager.createAll();
 *   manager.initAll(renderer);
 *   // Per frame:
 *   manager.update();
 *   // Cleanup:
 *   manager.disposeAll();
 */
export class SystemManager {
  /**
   * @param {WorldContext} context - Shared world state
   */
  constructor(context) {
    this.context = context;

    // Map of name → { system, dependencies }
    this.systems = new Map();

    // Cached update order (computed on first update or when systems change)
    this._updateOrder = null;

    // Track state
    this._created = false;
    this._initialized = false;
  }

  /**
   * Register a system with optional dependencies
   *
   * @param {string} name - Unique name for this system
   * @param {BaseSystem} system - The system instance
   * @param {string[]} dependencies - Names of systems this depends on
   */
  register(name, system, dependencies = []) {
    if (this.systems.has(name)) {
      console.warn(`SystemManager: Overwriting existing system '${name}'`);
    }

    this.systems.set(name, {
      system,
      dependencies,
      name
    });

    // Invalidate cached update order
    this._updateOrder = null;
  }

  /**
   * Get a registered system by name
   *
   * @param {string} name
   * @returns {BaseSystem|undefined}
   */
  get(name) {
    const entry = this.systems.get(name);
    return entry?.system;
  }

  /**
   * Check if a system is registered
   *
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.systems.has(name);
  }

  /**
   * Unregister a system
   *
   * @param {string} name
   */
  unregister(name) {
    const entry = this.systems.get(name);
    if (entry) {
      entry.system._dispose();
      this.systems.delete(name);
      this._updateOrder = null;
    }
  }

  /**
   * Create all systems (call create() on each)
   * Order based on dependencies
   */
  createAll() {
    if (this._created) return;

    const order = this._getUpdateOrder();
    for (const name of order) {
      const entry = this.systems.get(name);
      try {
        entry.system._create();
      } catch (error) {
        console.error(`SystemManager: Error creating '${name}':`, error);
      }
    }

    this._created = true;
  }

  /**
   * Initialize all systems (call init() on each)
   * Order based on dependencies
   *
   * @param {THREE.WebGLRenderer} renderer
   */
  initAll(renderer) {
    if (this._initialized) return;
    if (!this._created) {
      this.createAll();
    }

    const order = this._getUpdateOrder();
    for (const name of order) {
      const entry = this.systems.get(name);
      try {
        entry.system._init(renderer);
      } catch (error) {
        console.error(`SystemManager: Error initializing '${name}':`, error);
      }
    }

    this._initialized = true;
  }

  /**
   * Update all systems
   * Called every frame, order based on dependencies
   */
  update() {
    const order = this._getUpdateOrder();
    for (const name of order) {
      const entry = this.systems.get(name);
      try {
        entry.system._update();
      } catch (error) {
        console.error(`SystemManager: Error updating '${name}':`, error);
      }
    }
  }

  /**
   * Dispose all systems (in reverse dependency order)
   */
  disposeAll() {
    const order = this._getUpdateOrder();
    // Dispose in reverse order
    for (let i = order.length - 1; i >= 0; i--) {
      const name = order[i];
      const entry = this.systems.get(name);
      try {
        entry.system._dispose();
      } catch (error) {
        console.error(`SystemManager: Error disposing '${name}':`, error);
      }
    }

    this.systems.clear();
    this._updateOrder = null;
    this._created = false;
    this._initialized = false;
  }

  /**
   * Get list of all system names
   *
   * @returns {string[]}
   */
  getSystemNames() {
    return Array.from(this.systems.keys());
  }

  /**
   * Compute topological sort of systems based on dependencies
   * Uses Kahn's algorithm
   *
   * @returns {string[]} - System names in dependency order
   * @private
   */
  _getUpdateOrder() {
    if (this._updateOrder) {
      return this._updateOrder;
    }

    const result = [];
    const visited = new Set();
    const visiting = new Set();

    // Build adjacency list
    const graph = new Map();
    for (const [name, entry] of this.systems) {
      graph.set(name, entry.dependencies.filter((dep) => this.systems.has(dep)));
    }

    // DFS with cycle detection
    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        console.error(`SystemManager: Circular dependency detected involving '${name}'`);
        return;
      }

      visiting.add(name);

      const deps = graph.get(name) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    // Visit all nodes
    for (const name of this.systems.keys()) {
      visit(name);
    }

    this._updateOrder = result;
    return result;
  }

  /**
   * Debug: Print update order
   */
  debugPrintOrder() {
    const order = this._getUpdateOrder();
    console.log('SystemManager update order:');
    order.forEach((name, i) => {
      const entry = this.systems.get(name);
      const deps = entry.dependencies.length > 0 ? ` (depends on: ${entry.dependencies.join(', ')})` : '';
      console.log(`  ${i + 1}. ${name}${deps}`);
    });
  }
}

export default SystemManager;
