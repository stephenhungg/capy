# evidence bridge design

## purpose

this package normalizes evidence for capy's `failure.supporting_evidence` boundary. it does not decide that a robot failed, identify a root cause, or turn human video into robot actions. its job is narrower: preserve what each source can actually support, attach provenance, and make conservative candidate failure claims inspectable.

the bridge deliberately has three lanes:

```text
world context release metadata
  -> task label + provenance-tagged workflow prior
  -> no robot outcome claim

video-bearing source -> vima episodic export
  -> derived visual observation + resolvable frame/time citations
  -> no camera-free fallback and no automatic failure claim

camera-free i2rt run -> synchronized telemetry + fixture state + labels
  -> signal-specific evidence -> candidate/corroborated failure claims
  -> no invented video evidence
```

## source contracts

### world context

world context supplies a tier-0 human-task prior. the released semantic fact is a five-minute clip's task label. the bridge uses that label to anchor a normalized task id, candidate temporal phases, object roles, predicates, and a likely human workflow.

the distinction matters: the audited release does **not** contain temporal keysteps, active-object labels, action boundaries, outcomes, mistakes, proficiency, or approved procedures. consequently:

- `release_fact.provenance` is `observed`;
- phase, object, predicate, and task-graph entries must be `derived`, `manual`, or `approved_procedure`;
- a world context prior cannot establish that a robot executed an action, that a human followed the correct procedure, or that a failure occurred;
- approved SOP truth belongs in a separate procedure record even when a world context clip looks similar.

the representative fixture uses the research-plan example `panel-fitting-placement` -> `place_panel_in_fixture@1`. it is an ontology scaffold, not a claim that this exact derived graph ships in the dataset.

### vima

vima is accepted only for a source that actually bears video. the adapter requires all of the following:

- a capy-owned source record id;
- an explicit video uri;
- episode start/end time;
- at least one evidence-frame reference;
- an observation and vima episode/event id.

the normalized record retains involved tracks, labels, relations, spatial facts, vima artifact provenance, and citations back to the video. source and artifact hashes are strongly recommended because vima's checked-in episode rows do not contain globally resolvable video ids or hashes themselves.

vima outputs are `derived` observations. its local episodic confidences are heuristic rather than calibrated probabilities; tracks use simple label/box association; spatial relations are 2d-box-derived; depth may be relative and non-metric; timestamps may come from sampled-frame order; and lexical retrieval can return a high-confidence episode even when no query term matches. for those reasons this bridge does not turn a vima observation directly into a failure claim. a future visual failure rule must carry its own validation, rule version, and human-review state.

### camera-free i2rt telemetry

the i2rt adapter requires `camera_present: false`; true or unknown status is rejected. this is a guard against accidentally suggesting that the adapter handled or synchronized a camera stream. a later multimodal adapter may correlate camera and telemetry, but camera absence does not reduce telemetry to second-class evidence.

all i2rt evidence retains a shared run id, task id, monotonic-relative time span, source telemetry uri, rule version, and phase. correlation is permitted only inside one run and one clock.

## how signals become failure evidence

| input | emitted evidence | candidate interpretation | what it does not prove |
|---|---|---|---|
| sustained motor current outside a declared envelope | `motor_current_event`, with actuator, baseline, threshold, peak, duration, samples, and rule version | unexpected resistance, contact, overload, or stall candidate | which cause occurred, or whether the load was unintended |
| sustained commanded-to-observed trajectory error | `trajectory_error`, with channel, unit, frame, tolerance, controller mode, peak, and rule version | tracking deviation or stall candidate | collision versus saturation, tuning, bad commands, latency, or calibration error |
| fresh fixed-fixture state different from the expected state at a declared deadline | `fixture_state`, with expected/observed state, sample time/age, sensing method, deadline, and state-machine version | outcome or phase-transition mismatch | uninstrumented object state, visual alignment, or sensor correctness |
| attributed human annotation | `manual_label`, with taxonomy label, role/id, confidence, notes, and review state | a candidate semantic failure assertion | objective sensor truth or reviewer agreement |

a single record creates a `candidate` failure claim. two different machine evidence types that overlap within the same run create a `corroborated` multi-signal anomaly. the bridge never emits `confirmed`: confirmation requires an evaluation protocol or review authority outside this adapter.

threshold crossings must be sustained for `min_duration_s`, and a gap larger than `max_sample_gap_s` breaks the window. this prevents two distant samples from masquerading as one continuous event. thresholds are configuration, not universal hardware truth, so deployments must version and validate them for their embodiment, controller, task, and sampling rate.

## temporal and object alignment

`TemporalPhase` is a small capy normalization: `setup`, `approach`, `engage`, `execute`, `inspect`, `recover`, `complete`, or `unknown`. world context can propose phase priors; vima can attach cited observations to a phase; i2rt can attach measured anomalies to a phase supplied by its episode/controller state. phase agreement is useful for retrieval, but it is not proof that two source domains are behaviorally equivalent.

objects cross the bridge through roles and predicates, not fabricated identity. for example, the human prior may propose `panel_inside_fixture`; a fixed limit switch may observe its own `panel_nest=seated` state. those facts can be mapped by an explicit capability manifest, but the adapter does not silently declare them identical.

## capability-receipt integration

the package output is intended to sit below this future receipt shape:

```json
{
  "failure": {
    "claim": {},
    "supporting_evidence": []
  },
  "capability": {
    "task_id": "place_panel_in_fixture@1",
    "evaluation_protocol": "fixture_placement_eval@3"
  }
}
```

raw synchronized robot logs should remain in MCAP, with bridge records pointing to bounded spans rather than copying high-rate arrays. a later LeRobot adapter can reference normalized training episodes through the same evidence envelope. neither format is reimplemented here.

## verification

the package uses only the python standard library. run its representative contract tests from the capy repository root:

```bash
PYTHONPATH=packages/evidence-bridge/src python3 -m unittest discover -s packages/evidence-bridge/tests -v
```

## limitations and next work

- the package consumes representative JSON mappings; it is not an MCAP reader, vima service client, or world context SDK integration;
- the world context fixture is research-plan-derived and does not enumerate the full 50-label release ontology;
- thresholds are hand-configured and have no learned baseline, temperature compensation, hysteresis, or uncertainty model;
- fixture state evaluation uses the freshest channel-specific sample inside a declared window and suppresses missing or stale observations; it does not diagnose sensor health;
- manual labels do not yet carry reviewer agreement or cryptographic identity;
- temporal correlation is interval overlap, not causal inference;
- vima frame references remain meaningful only if the capy source record makes them resolvable against the exact video/extraction run;
- no signal in this package alone is enough for worker scoring, safety-critical automation, payout, or policy-lift attribution.
