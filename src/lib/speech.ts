export class SpeechHandler {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.speechQueue = [];
    this.isSpeaking = false;
  }

  async init() {
    // Wait for voices to be loaded
    if (this.synth.getVoices().length === 0) {
      await new Promise(resolve => {
        this.synth.addEventListener('voiceschanged', resolve, { once: true });
      });
    }

    // Try to find a good voice
    const voices = this.synth.getVoices();
    this.voice = voices.find(voice => 
      voice.lang === 'en-US' && 
      voice.name.toLowerCase().includes('female')
    ) || voices[0];

    return this.voice !== null;
  }

  async speak(text) {
    return new Promise((resolve, reject) => {
      try {
        // Add to queue
        this.speechQueue.push({ text, resolve, reject });
        
        // Start processing queue if not already speaking
        if (!this.isSpeaking) {
          this.processQueue();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async processQueue() {
    if (this.speechQueue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const { text, resolve, reject } = this.speechQueue.shift();

    try {
      // Add a small delay between responses
      await new Promise(r => setTimeout(r, 300));

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voice;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onend = () => {
        resolve();
        this.processQueue();
      };

      utterance.onerror = (error) => {
        reject(error);
        this.processQueue();
      };

      this.synth.speak(utterance);
    } catch (error) {
      reject(error);
      this.processQueue();
    }
  }

  stop() {
    this.synth.cancel();
    this.speechQueue = [];
    this.isSpeaking = false;
    if (this.synth.speaking) {
      this.synth.pause();
      this.synth.resume();
      this.synth.cancel();
    }
  }

  setVoice(voice) {
    this.voice = voice;
  }

  setRate(rate) {
    this.rate = rate;
  }

  setPitch(pitch) {
    this.pitch = pitch;
  }

  setVolume(volume) {
    this.volume = volume;
  }
} 