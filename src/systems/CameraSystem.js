import * as THREE from 'three';

/**
 * CameraSystem - Handles camera modes and movement
 */
export class CameraSystem {
  constructor(camera, terrainSystem, config = {}) {
    this.camera = camera;
    this.terrainSystem = terrainSystem;

    this.config = {
      fov: config.fov ?? 90,
      cameraHeight: config.cameraHeight ?? 4.0,
      ...config
    };

    // Camera state
    this.cameraY = 0;
    this.cameraTilt = 0;
    this.cameraRoll = 0;
    this.mode = 'normal';

    // Scenic mode state
    this.scenicTime = 0;
    this.scenicLookTarget = new THREE.Vector3(0, 0, -40);

    // Lake tour state
    this.lakeTourTime = 0;
    this.lakeTourPhase = 0;
    this.lakeTourLakeIndex = 0;
    this.lakeTourCamPos = new THREE.Vector3();
    this.lakeTourLookTarget = new THREE.Vector3();

    // Collision avoidance
    this.collisionAvoidanceEnabled = true;
    this.collisionAvoidanceHeight = 0;

    // Lakes reference (set externally for lake tour mode)
    this.lakes = [];
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'lakeTour') {
      this.lakeTourTime = 0;
      this.lakeTourLakeIndex = 0;
      this.lakeTourCamPos.copy(this.camera.position);
      this.lakeTourLookTarget.set(
        this.camera.position.x,
        this.camera.position.y - 2,
        this.camera.position.z - 5
      );
    }
  }

  setLakes(lakes) {
    this.lakes = lakes || [];
  }

  update(delta, elapsed, roverZ, terrainY) {
    const terrainHeightAtRover = this.terrainSystem.getHeight(0, roverZ);
    const sampleDist = 5;
    const terrainHeightAhead = this.terrainSystem.getHeight(0, roverZ - sampleDist);
    const terrainHeightLeft = this.terrainSystem.getHeight(-sampleDist, roverZ);
    const terrainHeightRight = this.terrainSystem.getHeight(sampleDist, roverZ);

    const forwardSlope = (terrainHeightAhead - terrainHeightAtRover) / sampleDist;
    const sideSlope = (terrainHeightRight - terrainHeightLeft) / (sampleDist * 2);

    switch (this.mode) {
      case 'normal':
        this.updateNormal(delta, elapsed, terrainHeightAtRover, forwardSlope, sideSlope, terrainY);
        break;
      case 'cinematic':
        this.updateCinematic(delta, elapsed, terrainHeightAtRover, terrainY);
        break;
      case 'orbit':
        this.updateOrbit(delta, elapsed, terrainHeightAtRover, terrainY);
        break;
      case 'low':
        this.updateLow(delta, elapsed, terrainHeightAtRover, forwardSlope, terrainY);
        break;
      case 'scenic':
        this.updateScenic(delta, elapsed, terrainHeightAtRover, terrainY);
        break;
      case 'lakeTour':
        this.updateLakeTour(delta, elapsed);
        break;
    }

    if (this.collisionAvoidanceEnabled) {
      this.updateCollisionAvoidance(delta, roverZ, terrainY);
    }
  }

  updateNormal(delta, elapsed, terrainHeight, forwardSlope, sideSlope, terrainY) {
    const targetY = terrainHeight + this.config.cameraHeight + terrainY;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 4);

    const targetPitch = Math.atan(forwardSlope) * 0.8;
    this.cameraTilt += (targetPitch - this.cameraTilt) * Math.min(1, delta * 3);

    const targetRoll = Math.atan(sideSlope) * 0.4;
    this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, delta * 3);

    this.camera.position.x = Math.sin(elapsed * 1.5) * 0.015;
    this.camera.position.y = this.cameraY + Math.sin(elapsed * 2) * 0.008;
    this.camera.rotation.x = this.cameraTilt;
    this.camera.rotation.z = this.cameraRoll + Math.sin(elapsed * 0.5) * 0.003;
    this.camera.rotation.y = 0;
  }

  updateCinematic(delta, elapsed, terrainHeight, terrainY) {
    const targetY = terrainHeight + this.config.cameraHeight * 1.5 + terrainY;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 2);

    this.camera.position.x = Math.sin(elapsed * 0.15) * 15;
    this.camera.position.y = this.cameraY;
    this.camera.rotation.y = Math.sin(elapsed * 0.15) * 0.3;
    this.camera.rotation.x = -0.1 + Math.sin(elapsed * 0.1) * 0.05;
    this.camera.rotation.z = Math.sin(elapsed * 0.2) * 0.02;
  }

  updateOrbit(delta, elapsed, terrainHeight, terrainY) {
    const orbitRadius = 20;
    const orbitSpeed = 0.2;
    const targetY = terrainHeight + this.config.cameraHeight * 2 + terrainY;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 3);

    this.camera.position.x = Math.sin(elapsed * orbitSpeed) * orbitRadius;
    this.camera.position.y = this.cameraY + 10;
    this.camera.position.z = Math.cos(elapsed * orbitSpeed) * orbitRadius * 0.5;

    this.camera.lookAt(0, this.cameraY - 5, -20);
  }

  updateLow(delta, elapsed, terrainHeight, forwardSlope, terrainY) {
    const targetY = terrainHeight + 1.5 + terrainY;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 4);

    const targetPitch = Math.atan(forwardSlope) * 0.5 - 0.1;
    this.cameraTilt += (targetPitch - this.cameraTilt) * Math.min(1, delta * 3);

    this.camera.position.x = Math.sin(elapsed * 0.8) * 0.03;
    this.camera.position.y = this.cameraY;
    this.camera.rotation.x = this.cameraTilt;
    this.camera.rotation.z = Math.sin(elapsed * 0.3) * 0.01;
    this.camera.rotation.y = 0;
  }

  updateScenic(delta, elapsed, terrainHeight, terrainY) {
    this.scenicTime += delta * 0.15;

    const scenicHeight = 35 + Math.sin(this.scenicTime * 0.3) * 12;
    const targetY = terrainHeight + scenicHeight + terrainY;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 1.2);

    this.camera.position.x = Math.sin(this.scenicTime * 0.4) * 30;
    this.camera.position.y = this.cameraY;
    this.camera.position.z = Math.cos(this.scenicTime * 0.25) * 15;

    const lookY = this.cameraY - 20 + Math.sin(this.scenicTime * 0.2) * 25;
    const lookZ = -50 + Math.cos(this.scenicTime * 0.15) * 25;
    const lookTarget = new THREE.Vector3(
      Math.sin(this.scenicTime * 0.3) * 35,
      lookY,
      lookZ
    );
    this.scenicLookTarget.lerp(lookTarget, delta * 0.4);
    this.camera.lookAt(this.scenicLookTarget);

    this.camera.rotation.z += Math.sin(this.scenicTime * 0.35) * 0.015;
  }

  updateLakeTour(delta, elapsed) {
    this.lakeTourTime += delta * 0.1;

    if (!this.lakes || this.lakes.length === 0) {
      this.mode = 'normal';
      return;
    }

    const lake = this.lakes[this.lakeTourLakeIndex % this.lakes.length];
    const lakeSize = lake.userData.size || 30;
    const waterY = lake.position.y;

    const t = this.lakeTourTime;
    const radius = lakeSize * 0.3;

    const targetX = lake.position.x + Math.sin(t * 0.5) * radius;
    const targetZ = lake.position.z + Math.sin(t * 0.25) * radius * 0.5;
    const targetY = waterY + 1.5 + Math.sin(t * 0.3) * 0.3;

    this.lakeTourCamPos.lerp(new THREE.Vector3(targetX, targetY, targetZ), delta * 0.5);

    const lookX = lake.position.x + Math.sin(t * 0.5 + 0.5) * radius * 0.5;
    const lookZ = lake.position.z + Math.sin(t * 0.25 + 0.3) * radius * 0.3;
    this.lakeTourLookTarget.lerp(new THREE.Vector3(lookX, waterY - 0.5, lookZ), delta * 0.3);

    this.camera.position.copy(this.lakeTourCamPos);
    this.camera.lookAt(this.lakeTourLookTarget);
    this.camera.rotation.z = Math.sin(t * 0.2) * 0.01;

    if (Math.floor(t / 6) > Math.floor((t - delta * 0.1) / 6)) {
      this.lakeTourLakeIndex = (this.lakeTourLakeIndex + 1) % this.lakes.length;
    }
  }

  updateCollisionAvoidance(delta, roverZ, terrainY) {
    // Sample terrain in a small area around the camera
    const checkRadius = 3;
    const samples = [
      { x: 0, z: 0 },
      { x: checkRadius, z: 0 },
      { x: -checkRadius, z: 0 },
      { x: 0, z: checkRadius },
      { x: 0, z: -checkRadius }
    ];

    let maxTerrainHeight = -Infinity;
    for (const sample of samples) {
      const height = this.terrainSystem.getHeight(
        this.camera.position.x + sample.x,
        roverZ + sample.z
      );
      maxTerrainHeight = Math.max(maxTerrainHeight, height);
    }

    const minClearance = 1.5;
    const desiredY = maxTerrainHeight + terrainY + minClearance;

    if (this.camera.position.y < desiredY) {
      const pushUp = (desiredY - this.camera.position.y) * Math.min(1, delta * 5);
      this.camera.position.y += pushUp;
      this.collisionAvoidanceHeight = pushUp;
    } else {
      this.collisionAvoidanceHeight *= 0.9;
    }
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
