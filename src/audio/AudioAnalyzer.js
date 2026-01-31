export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.gainNode = null;
    this.isRunning = false;
    this.sensitivity = 2.5; // Boost factor for weak signals
    this.smoothing = 0.8;
    this.mode = 'microphone'; // 'microphone' or 'system'
    this.stream = null;
  }

  async start(mode = 'microphone') {
    if (this.isRunning) return true;
    this.mode = mode;

    try {
      if (mode === 'system') {
        return await this.startSystemAudio();
      } else {
        return await this.startMicrophone();
      }
    } catch (err) {
      console.error('Could not start audio:', err);
      return false;
    }
  }

  async startMicrophone() {
    try {
      // Get microphone input (captures room audio)
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupAnalyzer(this.stream);
      console.log('Audio analyzer started (microphone)');
      return true;
    } catch (err) {
      console.error('Could not access microphone:', err);
      return false;
    }
  }

  async startSystemAudio() {
    try {
      // Use getDisplayMedia to capture system/tab audio
      // This requires user interaction and shows a picker dialog
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1 }, // Minimal video (required but we don't use it)
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Check if audio track was actually captured
      const audioTracks = this.stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('No audio track in captured stream. User may need to share a tab with audio.');
        // Stop the video track we don't need
        this.stream.getVideoTracks().forEach(track => track.stop());
        return false;
      }

      // Stop video track - we only need audio
      this.stream.getVideoTracks().forEach(track => track.stop());

      this.setupAnalyzer(this.stream);
      console.log('Audio analyzer started (system audio)');
      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.log('User cancelled system audio capture');
      } else {
        console.error('Could not capture system audio:', err);
      }
      return false;
    }
  }

  setupAnalyzer(stream) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = this.smoothing;

    // Add gain node to boost signals
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.sensitivity;

    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isRunning = true;
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isRunning = false;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
  }

  getFrequencyData() {
    if (!this.isRunning || !this.analyser) return null;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate some useful values
    const bass = this.getAverageFrequency(0, 10);
    const mid = this.getAverageFrequency(10, 50);
    const treble = this.getAverageFrequency(50, 128);
    const overall = this.getAverageFrequency(0, 128);

    return {
      raw: this.dataArray,
      bass: bass / 255,
      mid: mid / 255,
      treble: treble / 255,
      overall: overall / 255
    };
  }

  getAverageFrequency(startIndex, endIndex) {
    if (!this.dataArray) return 0;

    let sum = 0;
    for (let i = startIndex; i < endIndex && i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / (endIndex - startIndex);
  }

  setSensitivity(value) {
    this.sensitivity = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  getMode() {
    return this.mode;
  }

  isSystemAudioSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }
}
