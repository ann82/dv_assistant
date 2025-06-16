export class SpeechHandler {
  private speechQueue: Array<{ text: string; resolve: Function; reject: Function }> = [];
  private isSpeaking: boolean = false;
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice;
  private rate: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private readonly MIN_DELAY = 100; // Reduced from 300ms to 100ms

  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = this.getDefaultVoice();
  }

  private getDefaultVoice(): SpeechSynthesisVoice {
    const voices = this.synth.getVoices();
    return voices.find(voice => voice.lang === 'en-US') || voices[0];
  }

  async speak(text: string): Promise<void> {
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

  private async processQueue() {
    if (this.speechQueue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const queueItem = this.speechQueue.shift();
    if (!queueItem) {
      this.isSpeaking = false;
      return;
    }

    const { text, resolve, reject } = queueItem;

    try {
      // Add a minimal delay between responses
      await new Promise(r => setTimeout(r, this.MIN_DELAY));

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