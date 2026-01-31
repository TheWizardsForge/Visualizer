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
  }

  async start() {
    if (this.isRunning) return;

    try {
      // Get microphone input (captures room audio)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = this.smoothing;

      // Add gain node to boost weak mic signals
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.sensitivity;

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isRunning = true;

      console.log('Audio analyzer started');
    } catch (err) {
      console.error('Could not access microphone:', err);
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isRunning = false;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
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
}
