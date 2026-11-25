export type MidiBytes = readonly number[];

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

/** Channels are 1-16 in the UI and 0-15 on the wire. */
const ch = (channel: number) => clamp(channel, 1, 16) - 1;
const d7 = (v: number) => clamp(v, 0, 127);

export const noteOn = (channel: number, note: number, velocity = 100): MidiBytes => [
  0x90 | ch(channel),
  d7(note),
  d7(velocity),
];
export const noteOff = (channel: number, note: number, velocity = 0): MidiBytes => [
  0x80 | ch(channel),
  d7(note),
  d7(velocity),
];
export const programChange = (channel: number, program: number): MidiBytes => [
  0xc0 | ch(channel),
  d7(program),
];
export const midiClock = (): MidiBytes => [0xf8];
export const start = (): MidiBytes => [0xfa];
export const continueMsg = (): MidiBytes => [0xfb];
export const stop = (): MidiBytes => [0xfc];

/** Song Position Pointer; position is in MIDI beats (1 beat = 6 clocks = a 16th note). */
export const songPositionPointer = (midiBeats: number): MidiBytes => {
  const p = clamp(midiBeats, 0, 16383);
  return [0xf2, p & 0x7f, (p >> 7) & 0x7f];
};
export const songSelect = (song: number): MidiBytes => [0xf3, d7(song)];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (note: number) =>
  `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;

export const hex = (bytes: MidiBytes) =>
  bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

export function describe(bytes: MidiBytes): string {
  const [status = 0, a = 0, b = 0] = bytes;
  const c = (status & 0x0f) + 1;
  switch (status & 0xf0) {
    case 0x80:
      return `Note Off ch${c} ${noteName(a)} vel ${b}`;
    case 0x90:
      return `Note On ch${c} ${noteName(a)} vel ${b}`;
    case 0xc0:
      return `Program Change ch${c} program ${a}`;
  }
  switch (status) {
    case 0xf8:
      return 'MIDI Clock';
    case 0xfa:
      return 'Start';
    case 0xfb:
      return 'Continue';
    case 0xfc:
      return 'Stop';
    case 0xf2:
      return `Song Position Pointer ${a | (b << 7)}`;
    case 0xf3:
      return `Song Select ${a}`;
  }
  return 'Unknown';
}
