import { continueMsg, midiClock, songPositionPointer, start, stop } from '../midi/messages.ts';
import type { TimedMessage } from './pattern.ts';

export type Scenario = 'A' | 'B';
export type TransportMode = 'start' | 'continue';

export interface SyncOptions {
  mode: TransportMode;
  /** Send Song Position Pointer 0 before Start/Continue. */
  spp: boolean;
  /** Send Stop after the last step. */
  stopAtEnd: boolean;
}

/** 24 clocks per quarter note. */
export const clockMs = (bpm: number) => 60000 / bpm / 24;

/**
 * Scenario B: wraps note messages with SPP, Start/Continue, a 24 PPQN clock for the
 * pattern's duration and optional Stop. Notes are delayed by `leadInSteps` 16ths so the
 * device has clock before the first note.
 */
export function withSync(
  notes: readonly TimedMessage[],
  steps: number,
  bpm: number,
  opts: SyncOptions,
  leadInMs = 0,
): TimedMessage[] {
  const out: TimedMessage[] = [];
  if (opts.spp) out.push({ at: 0, bytes: songPositionPointer(0), step: -1 });
  out.push({ at: 0, bytes: opts.mode === 'start' ? start() : continueMsg(), step: -1 });
  const totalTicks = steps * 6;
  const tick = clockMs(bpm);
  const ticks = totalTicks + Math.ceil(leadInMs / tick);
  for (let i = 0; i < ticks; i++) out.push({ at: i * tick, bytes: midiClock(), step: -1 });
  notes.forEach((m) => out.push({ ...m, at: m.at + leadInMs }));
  if (opts.stopAtEnd) out.push({ at: ticks * tick, bytes: stop(), step: -1 });
  return out.sort((a, b) => a.at - b.at);
}
