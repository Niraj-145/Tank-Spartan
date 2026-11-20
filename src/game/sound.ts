class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastPlayed: Record<string, number> = {};

  private ensureGraph(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 1.5);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.masterGain) return null;
    return { ctx: this.ctx, out: this.masterGain };
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(m ? 0 : 0.85, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private throttle(key: string, minMs: number): boolean {
    const now = performance.now();
    if (this.lastPlayed[key] && now - this.lastPlayed[key] < minMs) {
      return false;
    }
    this.lastPlayed[key] = now;
    return true;
  }

  private playFilteredNoise(
    ctx: AudioContext,
    out: AudioNode,
    startTime: number,
    duration: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    q: number,
    peakGain: number
  ) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, startTime);
    filter.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  private playTone(
    ctx: AudioContext,
    out: AudioNode,
    type: OscillatorType,
    startTime: number,
    duration: number,
    startFreq: number,
    endFreq: number,
    peakGain: number,
    attack = 0.004
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0008, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(attack, duration * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(out);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  public playShoot(kind: 'cannon' | 'twin' | 'shotgun' | 'railgun' | 'plasma') {
    if (!this.throttle(`shoot_${kind}`, 42)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    if (kind === 'cannon') {
      // Punchy tank barrel thump + crisp powder crack
      this.playTone(ctx, out, 'triangle', now, 0.11, 185, 48, 0.24);
      this.playTone(ctx, out, 'sine', now, 0.09, 110, 38, 0.2);
      this.playFilteredNoise(ctx, out, now, 0.085, 'bandpass', 1100, 340, 1.4, 0.18);
    } else if (kind === 'twin') {
      // Rapid crisp autocannon snap
      this.playTone(ctx, out, 'square', now, 0.06, 360, 115, 0.1);
      this.playTone(ctx, out, 'triangle', now + 0.018, 0.055, 290, 95, 0.11);
      this.playFilteredNoise(ctx, out, now, 0.05, 'highpass', 1400, 700, 0.9, 0.11);
    } else if (kind === 'shotgun') {
      // Heavy wide scatter blast
      this.playTone(ctx, out, 'sawtooth', now, 0.14, 155, 42, 0.18);
      this.playTone(ctx, out, 'sine', now, 0.12, 95, 34, 0.24);
      this.playFilteredNoise(ctx, out, now, 0.16, 'lowpass', 2400, 360, 0.8, 0.28);
    } else if (kind === 'railgun') {
      // Laser gun harmonic beam zap + electric sizzle
      this.playTone(ctx, out, 'sawtooth', now, 0.16, 1280, 190, 0.14);
      this.playTone(ctx, out, 'sine', now, 0.15, 1920, 340, 0.11);
      this.playFilteredNoise(ctx, out, now, 0.11, 'bandpass', 3200, 950, 2.2, 0.12);
    } else if (kind === 'plasma') {
      // Bomb gun deep mortar launch + plasma shimmer
      this.playTone(ctx, out, 'sine', now, 0.2, 195, 46, 0.26);
      this.playTone(ctx, out, 'triangle', now, 0.18, 420, 130, 0.14);
      this.playFilteredNoise(ctx, out, now, 0.13, 'bandpass', 800, 220, 1.6, 0.15);
    }
  }

  public playWeaponSwitch() {
    if (!this.throttle('switch', 50)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;
    this.playFilteredNoise(ctx, out, now, 0.035, 'bandpass', 1900, 900, 2.2, 0.11);
    this.playTone(ctx, out, 'triangle', now + 0.01, 0.045, 440, 620, 0.08);
  }

  public playHit(heavy = false) {
    if (!this.throttle('hit', 40)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    this.playTone(ctx, out, 'triangle', now, heavy ? 0.11 : 0.06, heavy ? 150 : 250, 52, heavy ? 0.16 : 0.09);
    this.playFilteredNoise(
      ctx,
      out,
      now,
      heavy ? 0.08 : 0.045,
      'bandpass',
      heavy ? 900 : 1500,
      360,
      1.3,
      heavy ? 0.14 : 0.08
    );
  }

  public playTankHit() {
    if (!this.throttle('tank_hit', 75)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    // Metallic armor clang + heavy sub thud
    this.playTone(ctx, out, 'sine', now, 0.18, 125, 36, 0.28);
    this.playTone(ctx, out, 'square', now, 0.09, 310, 140, 0.11);
    this.playFilteredNoise(ctx, out, now, 0.12, 'bandpass', 1200, 280, 2.5, 0.22);
  }

  public playWallBreak(steel = false) {
    if (!this.throttle('wall_break', 55)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    this.playTone(ctx, out, 'triangle', now, 0.13, steel ? 220 : 135, 42, 0.17);
    this.playFilteredNoise(
      ctx,
      out,
      now,
      0.16,
      'bandpass',
      steel ? 1600 : 780,
      steel ? 420 : 180,
      steel ? 2.8 : 1.1,
      0.21
    );
  }

  public playExplosion(big = false) {
    if (!this.throttle('explosion', 45)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;
    const dur = big ? 0.36 : 0.22;

    this.playTone(ctx, out, 'sine', now, dur * 0.85, big ? 120 : 145, 30, big ? 0.3 : 0.22);
    this.playFilteredNoise(ctx, out, now, dur, 'lowpass', big ? 1300 : 1600, 110, 0.9, big ? 0.28 : 0.2);
  }

  public playKill(isBoss = false) {
    if (!this.throttle('kill', 35)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    if (isBoss) {
      // Multi-stage heavy boss detonation
      this.playTone(ctx, out, 'sine', now, 0.55, 145, 24, 0.34);
      this.playTone(ctx, out, 'sawtooth', now, 0.42, 210, 38, 0.16);
      this.playFilteredNoise(ctx, out, now, 0.58, 'lowpass', 1800, 95, 1.0, 0.34);
      this.playTone(ctx, out, 'triangle', now + 0.11, 0.36, 160, 32, 0.22);
    } else {
      this.playTone(ctx, out, 'triangle', now, 0.16, 240, 52, 0.18);
      this.playFilteredNoise(ctx, out, now, 0.18, 'lowpass', 1450, 180, 1.1, 0.18);
    }
  }

  public playComboTierUp(multiplier: number) {
    if (!this.throttle('combo_tier', 85)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;
    const baseFreq = multiplier >= 5 ? 880 : multiplier >= 4 ? 784 : multiplier >= 3 ? 659 : multiplier >= 2 ? 587 : 523;
    this.playTone(ctx, out, 'triangle', now, 0.08, baseFreq, baseFreq * 1.25, 0.11, 0.004);
    this.playTone(ctx, out, 'sine', now + 0.045, 0.12, baseFreq * 1.5, baseFreq * 1.5, 0.09, 0.004);
  }

  public playPickup(kind: 'gold' | 'exp' | 'heal') {
    if (!this.throttle(`pickup_${kind}`, 45)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    if (kind === 'gold') {
      // Crisp 2-note coin sparkle (B5 -> E6)
      this.playTone(ctx, out, 'sine', now, 0.065, 987.77, 987.77, 0.11, 0.003);
      this.playTone(ctx, out, 'triangle', now + 0.048, 0.13, 1318.51, 1318.51, 0.1, 0.003);
    } else if (kind === 'exp') {
      // Rising crystal chirp
      this.playTone(ctx, out, 'sine', now, 0.1, 620, 960, 0.09, 0.004);
      this.playTone(ctx, out, 'triangle', now + 0.025, 0.09, 930, 1240, 0.06, 0.004);
    } else {
      // Warm heal chime
      this.playTone(ctx, out, 'sine', now, 0.11, 523.25, 523.25, 0.1, 0.005);
      this.playTone(ctx, out, 'sine', now + 0.055, 0.16, 783.99, 783.99, 0.11, 0.005);
    }
  }

  public playLevelUp() {
    if (!this.throttle('level_up', 120)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.062;
      this.playTone(ctx, out, 'triangle', t, 0.22, freq, freq, 0.13, 0.006);
      this.playTone(ctx, out, 'sine', t, 0.24, freq * 2, freq * 2, 0.045, 0.006);
    });
  }

  public playWaveBanner(isBoss = false) {
    if (!this.throttle('wave_banner', 120)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    if (isBoss) {
      // Ominous low brass horn + sub rumble
      const freqs = [146.83, 138.59, 110];
      freqs.forEach((f, i) => {
        const t = now + i * 0.13;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, t);
        filter.frequency.exponentialRampToValueAtTime(320, t + 0.28);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.32);
      });
      this.playTone(ctx, out, 'sine', now, 0.5, 73.42, 55, 0.18, 0.02);
    } else {
      // Clean tactical wave alert
      this.playTone(ctx, out, 'triangle', now, 0.16, 392, 392, 0.11, 0.008);
      this.playTone(ctx, out, 'triangle', now + 0.1, 0.22, 523.25, 523.25, 0.13, 0.008);
    }
  }

  public playStoreBuy() {
    if (!this.throttle('store_buy', 40)) return;
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    this.playTone(ctx, out, 'triangle', now, 0.08, 659.25, 659.25, 0.11, 0.004);
    this.playTone(ctx, out, 'sine', now + 0.05, 0.15, 987.77, 987.77, 0.12, 0.004);
    this.playTone(ctx, out, 'sine', now + 0.08, 0.16, 1318.51, 1318.51, 0.07, 0.004);
  }

  public playVictory() {
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 0.09, d: 0.12 },
      { f: 783.99, t: 0.18, d: 0.14 },
      { f: 1046.5, t: 0.28, d: 0.42 },
    ];
    for (const n of melody) {
      this.playTone(ctx, out, 'triangle', now + n.t, n.d, n.f, n.f, 0.14, 0.006);
      this.playTone(ctx, out, 'sine', now + n.t, n.d, n.f * 1.5, n.f * 1.5, 0.045, 0.006);
    }
  }

  public playGameOver() {
    const graph = this.ensureGraph();
    if (!graph) return;
    const { ctx, out } = graph;
    const now = ctx.currentTime;

    this.playKill(true);
    const notes = [293.66, 261.63, 220.0, 164.81];
    notes.forEach((f, i) => {
      const t = now + 0.12 + i * 0.13;
      this.playTone(ctx, out, 'sawtooth', t, 0.2, f, f * 0.96, 0.08, 0.01);
      this.playTone(ctx, out, 'triangle', t, 0.24, f * 0.5, f * 0.48, 0.12, 0.01);
    });
  }
}

export const sound = new SoundEngine();
