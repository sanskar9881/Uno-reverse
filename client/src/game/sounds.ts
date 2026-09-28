/**
 * Sound effects. Everything is synthesized with Web Audio so the game needs no
 * assets; register real files in SOUND_FILES to replace any of them.
 */
export type SoundName =
  | 'play'
  | 'draw'
  | 'uno'
  | 'turn'
  | 'yourTurn'
  | 'join'
  | 'leave'
  | 'victory'
  | 'catch'
  | 'error'
  | 'click';

/** Map a sound to a file in /public/sounds to use it instead of the synth, e.g. play: '/sounds/play.mp3'. */
export const SOUND_FILES: Partial<Record<SoundName, string>> = {};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const buffers = new Map<SoundName, AudioBuffer | 'failed'>();

export function setMuted(value: boolean): void {
  muted = value;
}

/** Browsers only allow audio after a user gesture; call this from the first click/keypress. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      void preloadFiles();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

async function preloadFiles(): Promise<void> {
  for (const [name, url] of Object.entries(SOUND_FILES) as [SoundName, string][]) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      buffers.set(name, await ctx!.decodeAudioData(await res.arrayBuffer()));
    } catch {
      buffers.set(name, 'failed');
    }
  }
}

function tone(freq: number, at: number, duration: number, type: OscillatorType, volume: number, glideTo?: number): void {
  const c = ctx!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function noise(at: number, duration: number, filterFrom: number, filterTo: number, volume: number): void {
  const c = ctx!;
  const length = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(filterFrom, at);
  filter.frequency.exponentialRampToValueAtTime(filterTo, at + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter).connect(gain).connect(master!);
  src.start(at);
}

const SYNTHS: Record<SoundName, (t: number) => void> = {
  play: (t) => {
    noise(t, 0.09, 2600, 900, 0.5);
    tone(520, t, 0.08, 'triangle', 0.12, 330);
  },
  draw: (t) => noise(t, 0.16, 900, 3800, 0.32),
  uno: (t) => {
    tone(880, t, 0.12, 'triangle', 0.3);
    tone(1320, t + 0.1, 0.22, 'triangle', 0.3);
  },
  turn: (t) => tone(440, t, 0.05, 'sine', 0.06),
  yourTurn: (t) => {
    tone(988, t, 0.35, 'sine', 0.22);
    tone(1482, t, 0.25, 'sine', 0.06);
  },
  join: (t) => tone(523, t, 0.16, 'sine', 0.2, 784),
  leave: (t) => tone(523, t, 0.18, 'sine', 0.16, 330),
  victory: (t) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.28, 'triangle', 0.24));
    [523, 659, 784].forEach((f) => tone(f, t + 0.5, 0.8, 'sine', 0.12));
  },
  catch: (t) => {
    tone(330, t, 0.09, 'square', 0.1);
    tone(262, t + 0.1, 0.14, 'square', 0.1);
  },
  error: (t) => tone(150, t, 0.14, 'square', 0.06, 120),
  click: (t) => tone(1100, t, 0.03, 'sine', 0.05),
};

export function playSound(name: SoundName): void {
  if (muted || !ctx || !master || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.005;
  const buffer = buffers.get(name);
  try {
    if (buffer && buffer !== 'failed') {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(master);
      src.start(t);
      return;
    }
    SYNTHS[name](t);
  } catch {
    // Audio glitches must never break the game.
  }
}
