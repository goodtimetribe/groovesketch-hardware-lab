import { noteOff, noteOn, type MidiBytes } from '../midi/messages.ts';

export type StepCount = 16 | 32;

export interface Step {
  /** MIDI note number, or null for a rest. */
  note: number | null;
  velocity: number;
}

export interface TimedMessage {
  /** Milliseconds from the start of the transmission. */
  at: number;
  bytes: MidiBytes;
  step: number;
}

/** One step is a 16th note. */
export const stepMs = (bpm: number) => 60000 / bpm / 4;

const BASS_ROOTS = [36, 36, null, 36, null, 43, 36, null, 39, null, 36, 36, null, 41, null, 34];

/** Deterministic, already-quantized bassline. 32 steps repeat with a variation in the second bar. */
export function generateBassline(steps: StepCount): Step[] {
  return Array.from({ length: steps }, (_, i) => {
    let note = BASS_ROOTS[i % 16];
    if (i >= 16 && note !== null && i % 4 === 3) note += 12;
    return { note, velocity: i % 4 === 0 ? 110 : 90 };
  });
}

/** Gate length as a fraction of a step. Kept below 1 so note-offs never collide with the next note-on. */
export const GATE = 0.8;

export function buildMessages(
  steps: readonly Step[],
  channel: number,
  bpm: number,
): TimedMessage[] {
  const len = stepMs(bpm);
  const out: TimedMessage[] = [];
  steps.forEach((s, i) => {
    if (s.note === null) return;
    out.push({ at: i * len, bytes: noteOn(channel, s.note, s.velocity), step: i });
    out.push({ at: i * len + len * GATE, bytes: noteOff(channel, s.note), step: i });
  });
  return out.sort((a, b) => a.at - b.at);
}

export interface PlaybackResult {
  /** Per-message difference between actual and intended send time (ms). */
  jitter: number[];
  maxAbsJitter: number;
  meanAbsJitter: number;
}

export function summarizeJitter(jitter: number[]): PlaybackResult {
  const abs = jitter.map(Math.abs);
  return {
    jitter,
    maxAbsJitter: abs.length ? Math.max(...abs) : 0,
    meanAbsJitter: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : 0,
  };
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/**
 * Sends messages at their scheduled times: coarse sleep, then a short spin
 * to reduce setTimeout jitter. Measures actual vs intended time.
 */
export async function playMessages(
  messages: readonly TimedMessage[],
  send: (bytes: MidiBytes, step: number) => void,
  clock: Clock = realClock,
  signal?: AbortSignal,
): Promise<PlaybackResult> {
  const t0 = clock.now();
  const jitter: number[] = [];
  for (const m of messages) {
    if (signal?.aborted) break;
    const target = t0 + m.at;
    const wait = target - clock.now();
    if (wait > 3) await clock.sleep(wait - 2);
    while (clock.now() < target) {
      /* short spin */
      if (signal?.aborted) break;
    }
    send(m.bytes, m.step);
    jitter.push(clock.now() - target);
  }
  return summarizeJitter(jitter);
}
