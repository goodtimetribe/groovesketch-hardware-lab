import { describe, hex, type MidiBytes } from './messages.ts';

export interface OutputLike {
  id: string;
  name?: string | null;
  send(data: number[], timestamp?: number): void;
}

export interface AccessLike {
  outputs: Iterable<[string, OutputLike]> | { values(): Iterable<OutputLike> };
  onstatechange: unknown;
}

export interface TrafficEntry {
  time: number;
  bytes: MidiBytes;
  hex: string;
  text: string;
}

export type ConnectionStatus =
  | 'unsupported'
  | 'idle'
  | 'denied'
  | 'ready'
  | 'connected';

export const isWebMidiSupported = (nav: { requestMIDIAccess?: unknown } = navigator) =>
  typeof nav.requestMIDIAccess === 'function';

export function listOutputs(access: { outputs: { values(): Iterable<OutputLike> } }) {
  return Array.from(access.outputs.values());
}

/** Wraps a selected output and records every transmitted message. */
export class MidiSession {
  private output: OutputLike | null = null;
  private listeners = new Set<(e: TrafficEntry) => void>();
  readonly log: TrafficEntry[] = [];

  private now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  select(output: OutputLike | null) {
    this.output = output;
  }

  get selected() {
    return this.output;
  }

  subscribe(fn: (e: TrafficEntry) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  send(bytes: MidiBytes) {
    if (!this.output) throw new Error('No MIDI output selected');
    this.output.send([...bytes]);
    const entry: TrafficEntry = {
      time: this.now(),
      bytes,
      hex: hex(bytes),
      text: describe(bytes),
    };
    this.log.push(entry);
    if (this.log.length > 2000) this.log.shift();
    this.listeners.forEach((l) => l(entry));
    return entry;
  }
}
