import { describe, expect, it } from 'vitest';
import { buildMultiChannel, mockSketch, validateExport } from '../groovesketch/export.ts';
import { buildMessages, generateBassline, playMessages, stepMs, type Clock } from './pattern.ts';
import { withSync } from './workflow.ts';

describe('pattern', () => {
  it('generates 16 and 32 step basslines', () => {
    expect(generateBassline(16)).toHaveLength(16);
    expect(generateBassline(32)).toHaveLength(32);
  });
  it('computes step length from BPM', () => {
    expect(stepMs(120)).toBe(125);
  });
  it('pairs every note on with a note off before the next step', () => {
    const steps = generateBassline(32);
    const msgs = buildMessages(steps, 1, 120);
    const ons = msgs.filter((m) => m.bytes[0] === 0x90);
    const offs = msgs.filter((m) => m.bytes[0] === 0x80);
    expect(ons.length).toBe(offs.length);
    expect(ons.length).toBe(steps.filter((s) => s.note !== null).length);
    msgs.forEach((m, i) => i && expect(m.at).toBeGreaterThanOrEqual(msgs[i - 1].at));
    ons.forEach((m) => expect(m.at % stepMs(120)).toBe(0));
  });
  it('plays messages in order with a virtual clock', async () => {
    let t = 0;
    const clock: Clock = { now: () => (t += 0.01), sleep: async (ms) => { t += ms; } };
    const sentAt: number[] = [];
    const r = await playMessages(buildMessages(generateBassline(16), 1, 120), () => sentAt.push(t), clock);
    expect(sentAt.length).toBe(r.jitter.length);
    expect(r.maxAbsJitter).toBeLessThan(1);
  });
});

describe('workflow', () => {
  it('Scenario B adds SPP, Start, 6 clocks per step and Stop', () => {
    const notes = buildMessages(generateBassline(16), 1, 120);
    const msgs = withSync(notes, 16, 120, { mode: 'start', spp: true, stopAtEnd: true });
    expect(msgs.filter((m) => m.bytes[0] === 0xf8)).toHaveLength(96);
    expect(msgs.filter((m) => m.bytes[0] === 0xf2)).toHaveLength(1);
    expect(msgs.filter((m) => m.bytes[0] === 0xfa)).toHaveLength(1);
    expect(msgs.at(-1)?.bytes[0]).toBe(0xfc);
  });
  it('supports Continue and lead-in', () => {
    const notes = buildMessages(generateBassline(16), 1, 120);
    const msgs = withSync(notes, 16, 120, { mode: 'continue', spp: false, stopAtEnd: false }, 500);
    expect(msgs.some((m) => m.bytes[0] === 0xfb)).toBe(true);
    expect(msgs.find((m) => m.bytes[0] === 0x90)?.at).toBeGreaterThanOrEqual(500);
  });
});

describe('groovesketch simulation', () => {
  it('validates exports', () => {
    expect(mockSketch().flatMap(validateExport)).toEqual([]);
    expect(validateExport({ role: 'bass', channel: 1, steps: [] })).toHaveLength(1);
    expect(validateExport({ role: 'bass', channel: 0, steps: generateBassline(16) })).toHaveLength(1);
  });
  it('merges channels into one stream', () => {
    const msgs = buildMultiChannel(mockSketch(), 120);
    const chans = new Set(msgs.map((m) => m.bytes[0] & 0x0f));
    expect(chans).toEqual(new Set([0, 1, 2]));
  });
});
