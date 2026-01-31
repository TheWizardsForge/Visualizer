import * as THREE from 'three';

export class BaseMode {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(delta, elapsed, audioData) {
    // Override in subclass
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  setupGUI(folder) {
    // Override in subclass to add mode-specific controls
  }

  dispose() {
    // Clean up resources - override in subclass if needed
  }
}
