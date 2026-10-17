// Web Audio API Sound Generator for Pomodoro & Study Timer
// Works offline, zero external assets, supported in web and mobile WebView

class SoundController {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Check saved user sound preference
    try {
      const saved = localStorage.getItem('pomodoro_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {
      // ignore
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('pomodoro_sound_enabled', String(enabled));
    } catch {
      // ignore
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play a clean tone with attack and decay
   */
  public playTone(freq: number, type: OscillatorType, duration: number, delay: number = 0, volume: number = 0.15) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      console.warn('Audio tone error', e);
    }
  }

  /**
   * Pleasant ascending chime for starting focus
   */
  public playStart() {
    this.playTone(440, 'sine', 0.12, 0, 0.12); // A4
    this.playTone(554.37, 'sine', 0.14, 0.1, 0.15); // C#5
    this.playTone(659.25, 'sine', 0.22, 0.2, 0.18); // E5
  }

  /**
   * Celebratory chime when 25 min focus finishes
   */
  public playFocusComplete() {
    // Joyful arpeggio
    this.playTone(523.25, 'triangle', 0.2, 0.0, 0.2); // C5
    this.playTone(659.25, 'triangle', 0.2, 0.12, 0.22); // E5
    this.playTone(783.99, 'triangle', 0.25, 0.24, 0.25); // G5
    this.playTone(1046.50, 'triangle', 0.45, 0.36, 0.3); // C6

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Energetic chime when 5 min break finishes
   */
  public playBreakComplete() {
    this.playTone(659.25, 'sine', 0.18, 0.0, 0.2); // E5
    this.playTone(783.99, 'sine', 0.18, 0.15, 0.22); // G5
    this.playTone(1046.50, 'sine', 0.35, 0.3, 0.25); // C6

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([150, 100, 300]);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Warning alert when focus is broken (tab switch, phone lock, blur)
   */
  public playInterruptedAlert() {
    // 3 warning pulses
    this.playTone(320, 'sawtooth', 0.12, 0.0, 0.25);
    this.playTone(280, 'sawtooth', 0.14, 0.14, 0.25);
    this.playTone(240, 'sawtooth', 0.22, 0.28, 0.28);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([300, 150, 300]);
      } catch {
        // ignore
      }
    }
  }
}

export const soundManager = new SoundController();
