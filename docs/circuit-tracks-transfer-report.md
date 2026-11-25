# Circuit Tracks Pattern Transfer Report

**Status: lab built; hardware observations NOT yet recorded.**
This report was produced without a Novation Circuit Tracks attached. Nothing below
marked "Documented" or "Hypothesis" has been observed. Rows marked **TBD** must be filled in by
running the lab against real hardware. Do not treat unverified rows as findings.

## How to run

```
npm install
npm run dev     # open in Chrome/Edge, click "Request MIDI access", choose the Circuit Tracks output
npm test        # unit tests (message encoding, session/traffic log, scheduling, workflow, export model)
```

Connect Circuit Tracks via USB. Use channels per its Programmer's Reference (synth tracks and MIDI tracks
have configurable receive channels; defaults assumed in the lab: bass=1, chords=2, lead=3, drums=10).

## What was verified without hardware (automated)

- MIDI message encoding (Note On/Off, Program Change, Clock, Start, Stop, Continue, SPP, Song Select).
- Quantised 16/32-step bassline generation and Note On/Off timeline (gate 80% of a 16th).
- Scenario B stream builder (SPP, Start/Continue, 24 PPQN clock, Stop).
- Scheduler logic against a virtual clock; GrooveSketch role/channel export model and validation.
- Session logging of every transmitted message.

## Research questions and results

| Question | Result |
|---|---|
| Web MIDI can communicate with Circuit Tracks | TBD (expected via USB-MIDI class-compliant device; Hypothesis) |
| Incoming notes captured into a pattern | TBD |
| Recording can be armed remotely | TBD. The lab has no record-arm message to send; Circuit Tracks documents no MIDI command for it (Hypothesis, verify in Programmer's Reference). Treat manual arming as required until observed otherwise |
| Transport assists workflow | TBD |
| Independent multi-channel transfer | TBD (Scenario C) |
| Browser timing accuracy | Send-side jitter is measured and shown in the UI (TBD values). Hardware-side capture accuracy requires listening/recording |

## Experiment log (fill in)

### Phase 2: Programmer reference validation

| Message | Documented support | Observed behaviour |
|---|---|---|
| Note On / Off | Yes | TBD |
| Program Change | Yes | TBD |
| MIDI Clock | Yes (sync) | TBD |
| Start | Yes | TBD |
| Stop | Yes | TBD |
| Continue | TBD | TBD |
| Song Position Pointer | TBD | TBD |
| Song Select | TBD | TBD |

### Scenario A (manual arm, then send), 10 runs per length

| Length | BPM | Success rate | Timing accuracy | Missing notes | Quantisation issues |
|---|---|---|---|---|---|
| 16 | 120 | TBD | TBD | TBD | TBD |
| 32 | 120 | TBD | TBD | TBD | TBD |

### Scenario B (SPP / Start or Continue / Clock before notes)

Compare against Scenario A for: does recording begin at the pattern start, does the step grid lock to the
sent clock, does the capture change. TBD.

### Scenario C (CH1–CH4 simultaneously)

Use the "Send selected roles" panel (roles bass/chords/lead on CH1–3). Validate each track captured only its
channel's notes. TBD.

## Supported / unsupported workflows

- Supported (by the lab, pending hardware confirmation): manual arm + one-shot note stream per channel.
- Unsupported / unknown: remote record arm, song transfer, patterns longer than 32 steps, reading back from the device.

## Response summary (TBD)

- Start/Stop/Continue: TBD
- MIDI Clock: TBD
- Song Position Pointer: TBD
- Song Select: TBD
- Remote recording control: TBD
- Manual arming required: assumed yes until observed
- Timing observations: TBD

## Browser compatibility

Web MIDI is available in Chromium-based desktop browsers (Chrome, Edge, Opera) and Firefox (permission prompt
add-on flow); Safari does not support it. Chrome requires a secure context (https or localhost). Unverified in this lab.

## Recommended GrooveSketch integration design (provisional)

1. Export model `{ role, channel, steps }` per role, reusing GrooveSketch routing; validate 16/32 steps and channel
   before enabling "Send to Hardware" (see `src/groovesketch/export.ts`).
2. Guided workflow: user selects the target pattern on the device and arms recording; the app sends the notes in real time
   at the chosen BPM, optionally preceded by Start/clock if Scenario B proves beneficial.
3. Send all selected roles in one merged stream so tracks stay aligned.
4. Keep MIDI file export as fallback for phrases longer than 32 steps or unsupported behaviour.

Final recommendation depends on completing the TBD experiments above.
