import type { Step } from '../pattern/pattern.ts';
import { buildMessages, type TimedMessage } from '../pattern/pattern.ts';

export type Role = 'bass' | 'chords' | 'lead' | 'drums';

/** Mock of the GrooveSketch routing export: role + channel + steps. */
export interface SketchExport {
  role: Role;
  channel: number;
  steps: Step[];
}

/** Circuit Tracks default receive channels: synth 1 = ch1, synth 2 = ch2, MIDI tracks 3/4 = ch3/ch4, drums = ch10. */
export const DEFAULT_ROLE_CHANNEL: Record<Role, number> = {
  bass: 1,
  chords: 2,
  lead: 3,
  drums: 10,
};

export function mockSketch(): SketchExport[] {
  const n = (note: number | null, velocity = 100): Step => ({ note, velocity });
  const bass = [36, null, 36, null, 43, null, 36, 38, 36, null, 36, null, 41, null, 43, null];
  const chords = [60, null, null, null, 63, null, null, null, 67, null, null, null, 63, null, null, null];
  const lead = [72, null, 75, null, 79, null, 75, null, 72, null, 70, null, 67, null, null, null];
  const mk = (role: Role, notes: (number | null)[]): SketchExport => ({
    role,
    channel: DEFAULT_ROLE_CHANNEL[role],
    steps: notes.map((x) => n(x)),
  });
  return [mk('bass', bass), mk('chords', chords), mk('lead', lead)];
}

/** Validates an export against hardware constraints; returns problems (empty = transferable). */
export function validateExport(e: SketchExport): string[] {
  const problems: string[] = [];
  if (e.steps.length !== 16 && e.steps.length !== 32)
    problems.push(`${e.role}: ${e.steps.length} steps (only 16 or 32 supported)`);
  if (!Number.isInteger(e.channel) || e.channel < 1 || e.channel > 16)
    problems.push(`${e.role}: invalid channel ${e.channel}`);
  return problems;
}

/** Merges several role exports into one time-ordered message stream (simultaneous channel transmission). */
export function buildMultiChannel(exports: SketchExport[], bpm: number): TimedMessage[] {
  return exports
    .flatMap((e) => buildMessages(e.steps, e.channel, bpm))
    .sort((a, b) => a.at - b.at);
}
