type AudioStyle = 'modern' | 'chiptune';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private style: AudioStyle = 'modern';

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setStyle(style: AudioStyle): void {
    this.style = style;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') {
      return null;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      return null;
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  unlock(): void {
    void this.getContext();
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    freqStart: number,
    freqEnd: number | null,
    startTime: number,
    duration: number,
    volume: number,
    lowPassHz?: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = this.style === 'chiptune' ? 'square' : type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    if (freqEnd !== null && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration * 0.85);
    }

    const effectiveVol = this.style === 'chiptune' ? volume * 0.55 : volume;
    gain.gain.setValueAtTime(0.0008, startTime);
    gain.gain.linearRampToValueAtTime(effectiveVol, startTime + Math.min(0.014, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    if (lowPassHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowPassHz, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /**
   * Plays a harmonic food chime whose pitch rises progressively with combo (1x -> 5x).
   */
  playEat(comboMultiplier: number = 1): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Ascending pentatonic pitches for 1x .. 5x combo
    const baseFreqs = [440, 493.88, 554.37, 659.25, 783.99];
    const idx = Math.min(baseFreqs.length - 1, Math.max(0, comboMultiplier - 1));
    const base = baseFreqs[idx];

    this.tone(ctx, 'triangle', base, base * 1.42, now, 0.11, 0.13);
    if (comboMultiplier >= 2) {
      this.tone(ctx, 'sine', base * 1.5, base * 1.85, now + 0.035, 0.11, 0.09);
    }
  }

  playGolden(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [587.33, 739.99, 880, 1174.66];
    chord.forEach((f, i) => {
      this.tone(ctx, 'triangle', f, f * 1.03, now + i * 0.045, 0.2, 0.12);
    });
  }

  playShrink(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'triangle', 680, 320, now, 0.16, 0.13);
    this.tone(ctx, 'sine', 500, 260, now + 0.06, 0.13, 0.09);
  }

  playGhost(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sine', 380, 920, now, 0.28, 0.11);
    this.tone(ctx, 'triangle', 760, 1180, now + 0.06, 0.26, 0.07);
  }

  playChrono(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [1046.5, 880, 659.25];
    notes.forEach((f, i) => {
      this.tone(ctx, 'sine', f, f * 0.94, now + i * 0.07, 0.22, 0.11);
    });
  }

  playGlitch(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sawtooth', 260, 150, now, 0.11, 0.1, 1100);
    this.tone(ctx, 'sawtooth', 390, 195, now + 0.07, 0.13, 0.09, 1000);
    this.tone(ctx, 'square', 175, 130, now + 0.15, 0.14, 0.08, 900);
  }

  playPortal(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sine', 310, 940, now, 0.16, 0.12);
    this.tone(ctx, 'triangle', 620, 420, now + 0.07, 0.14, 0.08);
  }

  playBoostBurn(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sawtooth', 190, 95, now, 0.09, 0.075, 700);
  }

  playNearMiss(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sine', 1174.66, 1567.98, now, 0.09, 0.1);
  }

  playAiShatter(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sawtooth', 240, 75, now, 0.22, 0.13, 1200);
    this.tone(ctx, 'triangle', 523.25, 1046.5, now + 0.07, 0.2, 0.11);
    this.tone(ctx, 'sine', 783.99, 1318.5, now + 0.13, 0.2, 0.09);
  }

  playLevelUp(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      this.tone(ctx, 'sine', freq, freq, now + idx * 0.065, 0.2, 0.12);
    });
  }

  playThemeUnlock(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 987.77, 1318.51];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      this.tone(ctx, 'triangle', freq, freq * 1.01, now + idx * 0.06, 0.24, 0.11);
    });
  }

  playShrinkWarning(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sawtooth', 165, 135, now, 0.14, 0.09, 650);
    this.tone(ctx, 'sawtooth', 165, 135, now + 0.18, 0.14, 0.09, 650);
  }

  playGameOver(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [330, 261.63, 196, 146.83];
    notes.forEach((freq, idx) => {
      this.tone(ctx, 'sawtooth', freq, freq * 0.92, now + idx * 0.095, 0.16, 0.095, 900);
    });
  }

  playToggle(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.tone(ctx, 'sine', 420, 300, now, 0.05, 0.06);
  }
}

export const audioEngine = new AudioEngine();
