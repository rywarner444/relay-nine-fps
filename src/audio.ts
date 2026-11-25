/** Original synthesized effects; no downloaded sounds, music, or external requests. */
export class RangeAudio {
  private context: AudioContext | null = null;
  enabled = false;

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    this.ping(490, 770, 0.11, 0.018, 'sine');
  }

  private ping(start: number, end: number, duration: number, volume: number, wave: OscillatorType): void {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, end), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  fire(): void { this.ping(310, 78, 0.11, 0.032, 'sawtooth'); }
  hit(): void { this.ping(670, 160, 0.12, 0.025, 'triangle'); }
  destroy(): void { this.ping(160, 47, 0.32, 0.065, 'sawtooth'); }
  warning(): void { this.ping(220, 160, 0.34, 0.06, 'square'); }
  reload(): void { this.ping(350, 640, 0.21, 0.014, 'triangle'); }
}
