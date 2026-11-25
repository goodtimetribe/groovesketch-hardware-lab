import { describe as suite, expect, it } from 'vitest';
import {
  continueMsg, describe, midiClock, noteOff, noteOn, programChange,
  songPositionPointer, songSelect, start, stop, hex,
} from './messages.ts';
import { MidiSession, isWebMidiSupported } from './session.ts';

suite('message builders', () => {
  it('builds channel messages with 1-based channels', () => {
    expect(noteOn(1, 36, 100)).toEqual([0x90, 36, 100]);
    expect(noteOff(16, 60)).toEqual([0x8f, 60, 0]);
    expect(programChange(3, 5)).toEqual([0xc2, 5]);
  });
  it('clamps out-of-range data', () => {
    expect(noteOn(99, 300, -5)).toEqual([0x9f, 127, 0]);
  });
  it('builds system messages', () => {
    expect([midiClock(), start(), continueMsg(), stop()]).toEqual([[0xf8], [0xfa], [0xfb], [0xfc]]);
    expect(songSelect(2)).toEqual([0xf3, 2]);
  });
  it('encodes SPP as 14-bit LSB first', () => {
    expect(songPositionPointer(0)).toEqual([0xf2, 0, 0]);
    expect(songPositionPointer(130)).toEqual([0xf2, 2, 1]);
    expect(describe(songPositionPointer(130))).toBe('Song Position Pointer 130');
  });
  it('describes messages', () => {
    expect(describe(noteOn(2, 60, 90))).toBe('Note On ch2 C4 vel 90');
    expect(hex([0x90, 0x0a])).toBe('90 0A');
  });
});

suite('MidiSession', () => {
  it('throws without output', () => {
    expect(() => new MidiSession().send([0xfa])).toThrow();
  });
  it('sends and logs traffic', () => {
    const sent: number[][] = [];
    const s = new MidiSession(() => 5);
    const seen: string[] = [];
    s.subscribe((e) => seen.push(e.text));
    s.select({ id: '1', send: (d) => sent.push(d) });
    s.send(start());
    expect(sent).toEqual([[0xfa]]);
    expect(seen).toEqual(['Start']);
    expect(s.log[0].time).toBe(5);
  });
  it('detects support', () => {
    expect(isWebMidiSupported({})).toBe(false);
    expect(isWebMidiSupported({ requestMIDIAccess: () => {} })).toBe(true);
  });
});
