import { useEffect, useMemo, useRef, useState } from 'react';
import {
  continueMsg, midiClock, noteName, noteOff, noteOn, programChange,
  songPositionPointer, songSelect, start, stop,
} from './midi/messages.ts';
import {
  MidiSession, isWebMidiSupported, listOutputs,
  type ConnectionStatus, type OutputLike, type TrafficEntry,
} from './midi/session.ts';
import {
  buildMessages, generateBassline, playMessages, type PlaybackResult, type Step, type StepCount,
} from './pattern/pattern.ts';
import { withSync, type SyncOptions } from './pattern/workflow.ts';
import { DEFAULT_ROLE_CHANNEL, buildMultiChannel, mockSketch, validateExport } from './groovesketch/export.ts';

type Access = { outputs: { values(): Iterable<OutputLike> }; onstatechange: unknown };

function Grid({ steps, active }: { steps: Step[]; active: number }) {
  return (
    <div className="grid" aria-label="pattern">
      {steps.map((s, i) => (
        <div key={i} className={`cell${s.note !== null ? ' on' : ''}${i === active ? ' active' : ''}`}>
          {s.note !== null ? noteName(s.note) : '·'}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const session = useMemo(() => new MidiSession(), []);
  const [status, setStatus] = useState<ConnectionStatus>(isWebMidiSupported() ? 'idle' : 'unsupported');
  const [outputs, setOutputs] = useState<OutputLike[]>([]);
  const [outputId, setOutputId] = useState('');
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [channel, setChannel] = useState(1);
  const [bpm, setBpm] = useState(120);
  const [stepCount, setStepCount] = useState<StepCount>(16);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<PlaybackResult | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState(36);
  const [program, setProgram] = useState(0);
  const [spp, setSpp] = useState(0);
  const [song, setSong] = useState(0);
  const [sync, setSync] = useState<SyncOptions>({ mode: 'start', spp: true, stopAtEnd: true });
  const [roles, setRoles] = useState<Record<string, boolean>>({ bass: true, chords: true, lead: true });
  const abort = useRef<AbortController | null>(null);
  const bassline = useMemo(() => generateBassline(stepCount), [stepCount]);

  useEffect(
    () => session.subscribe((e) => setTraffic((t) => [...t.slice(-299), e])),
    [session],
  );

  const refresh = (access: Access) => setOutputs(listOutputs(access));

  const connect = async () => {
    try {
      const access = (await navigator.requestMIDIAccess({ sysex: false })) as unknown as Access;
      access.onstatechange = () => refresh(access);
      refresh(access);
      setStatus('ready');
    } catch (e) {
      setStatus('denied');
      setError(String(e));
    }
  };

  const choose = (id: string) => {
    setOutputId(id);
    const out = outputs.find((o) => o.id === id) ?? null;
    session.select(out);
    setStatus(out ? 'connected' : 'ready');
  };

  const guard = (fn: () => void) => () => {
    try {
      setError('');
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async (messages: ReturnType<typeof buildMessages>) => {
    if (!session.selected) return setError('No MIDI output selected');
    setError('');
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const r = await playMessages(
      messages,
      (bytes, step) => {
        session.send(bytes);
        if (step >= 0) setActive(step);
      },
      undefined,
      ctl.signal,
    );
    setActive(-1);
    setResult(r);
  };

  const panic = () => {
    abort.current?.abort();
    if (!session.selected) return;
    for (let c = 1; c <= 16; c++) session.send([0xb0 | (c - 1), 123, 0]);
  };

  const sketch = mockSketch().filter((e) => roles[e.role]);
  const sketchProblems = sketch.flatMap(validateExport);

  return (
    <main>
      <h1>GrooveSketch Circuit Tracks Hardware Transfer Lab</h1>

      <section>
        <h2>1. Connectivity</h2>
        <p>Status: <strong data-testid="status">{status}</strong></p>
        {status === 'unsupported' && (
          <p className="warn">Web MIDI is not available. Use Chrome/Edge (desktop) or another browser with Web MIDI support.</p>
        )}
        <button onClick={connect} disabled={status === 'unsupported'}>Request MIDI access</button>
        <label>
          Output{' '}
          <select value={outputId} onChange={(e) => choose(e.target.value)}>
            <option value="">(none)</option>
            {outputs.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.id}</option>)}
          </select>
        </label>
        {error && <p className="warn" role="alert">{error}</p>}
        <h3>MIDI traffic monitor</h3>
        <div className="monitor" aria-label="traffic">
          {traffic.map((t, i) => (
            <div key={i}>{t.time.toFixed(1)} ms | {t.hex} | {t.text}</div>
          ))}
        </div>
        <button onClick={() => setTraffic([])}>Clear</button>
        <button onClick={panic}>Abort / All notes off</button>
      </section>

      <section>
        <h2>2. Programmer reference validation</h2>
        <div>
          <label>Channel <input type="number" min={1} max={16} value={channel} onChange={(e) => setChannel(+e.target.value)} /></label>
          <label>Note <input type="number" min={0} max={127} value={note} onChange={(e) => setNote(+e.target.value)} /></label>
          <button onClick={guard(() => session.send(noteOn(channel, note)))}>Note On</button>
          <button onClick={guard(() => session.send(noteOff(channel, note)))}>Note Off</button>
        </div>
        <div>
          <label>Program <input type="number" min={0} max={127} value={program} onChange={(e) => setProgram(+e.target.value)} /></label>
          <button onClick={guard(() => session.send(programChange(channel, program)))}>Program Change</button>
        </div>
        <div>
          <button onClick={guard(() => session.send(midiClock()))}>MIDI Clock</button>
          <button onClick={guard(() => session.send(start()))}>Start</button>
          <button onClick={guard(() => session.send(stop()))}>Stop</button>
          <button onClick={guard(() => session.send(continueMsg()))}>Continue</button>
        </div>
        <div>
          <label>SPP (MIDI beats) <input type="number" min={0} max={16383} value={spp} onChange={(e) => setSpp(+e.target.value)} /></label>
          <button onClick={guard(() => session.send(songPositionPointer(spp)))}>Song Position Pointer</button>
          <label>Song <input type="number" min={0} max={127} value={song} onChange={(e) => setSong(+e.target.value)} /></label>
          <button onClick={guard(() => session.send(songSelect(song)))}>Song Select</button>
        </div>
      </section>

      <section>
        <h2>3. Pattern transfer</h2>
        <label>BPM <input type="number" min={40} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} /></label>
        <label>Channel <input type="number" min={1} max={16} value={channel} onChange={(e) => setChannel(+e.target.value)} /></label>
        <label>
          Length{' '}
          <select value={stepCount} onChange={(e) => setStepCount(+e.target.value as StepCount)}>
            <option value={16}>16 steps</option>
            <option value={32}>32 steps</option>
          </select>
        </label>
        <Grid steps={bassline} active={active} />
        <h4>Scenario A: manual record-arm on the Circuit Tracks, then send</h4>
        <button onClick={() => run(buildMessages(bassline, channel, bpm))}>Send {stepCount}-Step Pattern</button>
        <h4>Scenario B: with SPP / Start / Continue / MIDI Clock</h4>
        <label>
          Transport{' '}
          <select value={sync.mode} onChange={(e) => setSync({ ...sync, mode: e.target.value as SyncOptions['mode'] })}>
            <option value="start">Start</option>
            <option value="continue">Continue</option>
          </select>
        </label>
        <label><input type="checkbox" checked={sync.spp} onChange={(e) => setSync({ ...sync, spp: e.target.checked })} />SPP 0 first</label>
        <label><input type="checkbox" checked={sync.stopAtEnd} onChange={(e) => setSync({ ...sync, stopAtEnd: e.target.checked })} />Stop at end</label>
        <button onClick={() => run(withSync(buildMessages(bassline, channel, bpm), stepCount, bpm, sync, 500))}>
          Send {stepCount}-Step Pattern with sync
        </button>
        {result && (
          <p data-testid="timing">
            Send-time jitter over {result.jitter.length} messages: mean {result.meanAbsJitter.toFixed(2)} ms, max {result.maxAbsJitter.toFixed(2)} ms
            (browser-side only; hardware capture accuracy must be judged by listening or recording).
          </p>
        )}
      </section>

      <section>
        <h2>4. Scenario C and GrooveSketch simulation (role to channel)</h2>
        {mockSketch().map((e) => (
          <div key={e.role}>
            <label>
              <input type="checkbox" checked={!!roles[e.role]} onChange={(ev) => setRoles({ ...roles, [e.role]: ev.target.checked })} />
              {e.role} → CH{DEFAULT_ROLE_CHANNEL[e.role]}
            </label>
            <Grid steps={e.steps} active={-1} />
          </div>
        ))}
        {sketchProblems.map((p) => <p key={p} className="warn">{p}</p>)}
        <button disabled={sketchProblems.length > 0} onClick={() => run(buildMultiChannel(sketch, bpm))}>
          Send selected roles simultaneously
        </button>
      </section>
    </main>
  );
}
