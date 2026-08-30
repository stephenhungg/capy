# capy: category thesis and 90-day execution plan

status: operating plan

research cutoff: 2026-08-30

timebox: 13 weeks / 91 days

companion evidence: [`source-ledger.md`](source-ledger.md)

## executive verdict

the market is real, but the obvious company is dead on arrival.

“a marketplace where people upload robot data and get crypto” is already crowded by scaled collection networks, vertically integrated robot companies, physical-AI marketplaces, evaluation vendors, and standard payment rails. capy cannot win by having more upload buttons, a token, a prettier dataset browser, or a generic claim that failures are useful.

the narrower thesis worth testing is:

> capy is a capability clearinghouse for physical intelligence. a buyer funds a precisely measured robot failure; capy procures matched experience; an evaluator isolated from collection and training measures held-out capability lift; contributors receive guaranteed acquisition pay plus cohort-level performance bonuses in native USDC on Solana; and the complete lineage closes into a capability receipt.

the immediate product is not a network. it is a managed capability contract for one buyer, one embodiment, one failure distribution, and one evaluation protocol. the network becomes real only if repeated contracts learn a portable mapping from failure context to experience source to measured capability gain.

the first 90 days must answer two questions in order:

1. scientific: does failure-conditioned collection produce more held-out camera-free capability gain per fully loaded dollar than matched random collection?
2. commercial: will a robotics team fund a capability outcome and permit a sufficiently independent evaluation, rather than simply buying labor hours or keeping the loop internal?

if either answer is no, do not build a marketplace. sell the surviving component—recorder, experiment/evaluation infrastructure, or payout operations—or stop.

## the 10-star destination and the first inch

### destination: the experience network

at category scale, a robotics team should be able to submit a versioned capability gap instead of commissioning a bespoke data project:

```text
failure evidence
    ↓
capability contract + hidden evaluation protocol + funded budget
    ↓
experience router
    ├── human demonstrations
    ├── deployed robot interventions
    ├── specialist facilities
    ├── simulation and synthetic variation
    └── independent evaluation cells
    ↓
controlled training and cohort ablation
    ↓
capability receipt
    ├── measured lift and regressions
    ├── data/model/eval lineage
    ├── rights and disputes
    └── reconciled native USDC settlement
    ↓
network learns which experience closes which failures
```

the compounding asset is not public raw data. it is a privacy-preserving outcome graph:

```text
(failure context, embodiment, task, environment)
        × (collection source, cohort properties, cost)
        → (measured lift, regressions, uncertainty, evaluator reliability)
```

that graph could route the next dollar better across buyers even when raw episodes and weights never leave customer boundaries.

### first inch: one falsifiable loop

the first proof is deliberately tiny:

- one verified YAM configuration;
- one camera-free, fixed-geometry, contact-rich task;
- one baseline policy with a repeatable but nontrivial failure distribution;
- one matched random collection cohort;
- one failure-targeted collection cohort at equal fully loaded collection cost;
- one frozen training recipe per cohort;
- one hidden, paired real-robot evaluation;
- one cohort-level attribution calculation;
- one reconciled native USDC payout on Solana Devnet;
- one inspectable capability receipt.

this proves a transaction primitive, not a network and not general physical intelligence.

## what is genuinely differentiated

### potentially differentiated

1. **the traded object is a capability delta, not an hour or file.** the contract begins with a baseline, target distribution, safety envelope, evaluation budget, and termination rule.
2. **procurement and evaluation are bound before collection.** the hidden test design, candidate comparison, regression metrics, and payout rule are committed before contributors can optimize against them.
3. **performance money is cohort-level and evidence-backed.** accepted work is always paid; only a bounded performance pool depends on held-out lift. capy does not pretend to know the permanent causal value of one trajectory.
4. **the receipt crosses organizational boundaries.** a buyer, collector, trainer, evaluator, and treasury can retain private internals while agreeing on hashes, versions, outcomes, approvals, and settlement.
5. **the long-term routing model learns yield, not volume.** the useful network effect is measured capability gain per dollar by failure/experience context.

at maturity, a capability contract may admit an experience cohort, recovery policy, controller, simulation package, fixture adaptation, or training recipe. the 90-day proof intentionally restricts the changed input to matched experience cohorts so the experiment isolates capy's stated data-selection thesis. expanding artifact types before that proof would make a win uninterpretable.

### crowded or commodity

- paid human or robot data collection;
- task quotas, deduplication, fraud review, and diversity scoring;
- deciding what data to collect next as a research idea;
- MCAP logs and normalized robot datasets;
- real-hardware evaluation as a service;
- provenance and licensing metadata;
- stablecoin transfers and public transaction metadata;
- a public marketplace, contributor reputation, or “data flywheel” language.

### the uncomfortable truth

capy's differentiated integration is easy to describe and initially easy to copy. defensibility arrives only after several buyers trust the contract, independent cells reproduce results, and capy accumulates proprietary effect metadata that competitors cannot infer from raw hours. until then, this is a scientific services company with a protocol, not a network business.

## system boundaries

### trust-separated architecture

```text
buyer boundary                 capy coordination                  independent boundary
──────────────                 ─────────────────                  ────────────────────
failure traces ──hash/ref──▶   capability contract
policy/checkpoint              bounty compiler
training environment ◀──────   cohort manifests
private raw data               rights + consent ledger
candidate model ──sealed───▶                                ▶     evaluator
                              receipt builder ◀──────────────     hidden tests
contributor wallets ◀────────  approved payout manifest           signed results
                                      │
                                      ▼
                              native USDC on Solana
```

independence is a governance property, not a brand adjective. capy may operate the first physical cell for debugging, but a result is “independently evaluated” only when the evaluator:

- did not select or collect the treatment data;
- did not train the candidate policies;
- did not see performance-pool allocations before scoring;
- controls or seals the hidden initial-condition schedule;
- signs the result and discloses conflicts;
- is paid a fixed evaluation fee, not a success-contingent fee.

until an external cell is available, describe the first result as **functionally separated internal evaluation**, not independent evaluation.

### canonical objects

| object | required contents | owner of truth |
|---|---|---|
| failure bundle | robot/config hash, policy hash, trace refs, observed failure cluster, uncertainty, redactions | buyer |
| capability contract | baseline, target, task distribution, allowed data, budget, rights, evaluation protocol hash, payout formula, stop conditions | buyer + capy |
| collection job | observable instructions, eligibility, fixture/config distribution, acceptance tests, guaranteed compensation | capy |
| episode manifest | MCAP hash, clock report, command/state channels, lifecycle labels, fixture config, operator/robot pseudonyms, rights | collector + capy validator |
| training run | code/container hash, seed, base policy, cohort ids, hyperparameters, compute, resulting checkpoint hash | trainer |
| evaluation receipt | hidden-set commitment, evaluator identity/conflict statement, rollout rows, uncertainty, safety regressions, signed verdict | evaluator |
| attribution result | eligible cohorts, ablation method, stability, exclusions, approved acquisition/quality/performance amounts | capy + buyer approver |
| payout manifest | cluster, native USDC mint, opaque recipient refs, wallet destinations, amounts, idempotency keys, approvals | treasury |
| capability receipt | immutable references to every object above plus Solana signatures and dispute status | capy registry |

raw data, personal identity, checkpoints, detailed failure traces, and private commercial terms remain offchain. only ordinary native USDC transfers and opaque reconciliation references need to touch Solana.

## the role of each existing asset

### camera-free i2rt YAM: tier 1 physical truth

the user's current rig has no cameras. that is a hard constraint, not a backlog item to hand-wave away.

the initial observation/action record may include only signals proven available or verified in week 1:

- monotonic and hardware/source timestamps;
- commanded joint position/velocity/torque terms and gains;
- measured joint position, velocity, effort/current proxy, and temperatures;
- required/model torque if emitted by the controller;
- gripper command and measured gripper state;
- raw leader/teleoperation input;
- control mode, enable state, timeouts, faults, e-stop, and interventions;
- episode start, attempt, abort, outcome, reset, and end events;
- fixed fixture version and measured initial-condition id;
- manual labels plus non-camera fixture-sensor evidence.

the existing local i2rt MCAP recorder captures joint feedback, required torques, and temperatures. it does **not** yet constitute a learning/evaluation record because commands, teleoperator inputs, lifecycle, outcome, reset, fixture, and safety semantics are incomplete. its current second-resolution recording directories can also collide when multiple devices start together, and independently timestamped leader/follower files are not a synchronized session. the first engineering object must be one session owner with run/episode/device ids, sequence/drop counters, monotonic timestamps, UTC correlation, and one coordinated output or signed cross-file clock map.

motor effort can be a contact proxy, but never call it calibrated force. add a cheap non-camera success sensor—such as a fixture microswitch, beam break, or load cell—if the task permits. retain manual double-labeling until sensor agreement is measured.

the rig cannot support claims about object detection, arbitrary object pose, visual generalization, or VLA performance. the first policy should be a proprioceptive trajectory/residual policy, not a vision-language-action model.

### World Context: tier 0 only

World Context is seed material for language and structure:

- task names and a first industrial ontology;
- hypothesized temporal phases and human workflow vocabulary;
- VIMA retrieval/evidence examples;
- contributor instruction design;
- possible human-motion priors for later research.

it is not robot action data. it has no robot commands, joint states, verified outcomes, temporal keysteps, or shared embodiment. it remains outside the treatment cohort in the first proof.

a later registered ablation may test whether a World Context-derived prior improves sample efficiency. if it shows no lift, retain the corpus only as ontology/evidence. do not let a cool dataset contaminate the primary claim.

### local VIMA: video evidence memory only

the local VIMA system creates object-event/spatial memory and cited answers from video-bearing evidence. its honest role is:

- index World Context examples and future external video;
- retrieve cited evidence for task definitions and human-workflow hypotheses;
- produce inspectable proof-frame references for human reviewers;
- support a future bridge when the robot cell gains an authorized external video source.

VIMA is not the robot policy, the bounty compiler, the evaluator, or a camera-free failure detector. it cannot inspect current i2rt rollouts because there are no frames. camera-free telemetry gets a separate deterministic event extractor; both evidence types may normalize into the same failure bundle without pretending they share a sensor model.

also avoid a naming trap: ICML 2023 VIMA is a different multimodal-prompt robot agent. capy references the local evidence-memory repository unless explicitly stated otherwise.

### native USDC on Solana: settlement, not science

v0 uses standard token transfers of Circle-issued native USDC:

- hard-allowlist Solana Devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` and mainnet mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` from Circle's current registry; never infer either from user input;
- use the original SPL Token Program, `TransferChecked`, and six decimals for the canonical mint; verify these properties onchain before enabling a cluster;
- no capy token, points-to-token promise, bridged USDC, custom mint, or custom Solana program;
- capy sponsors transaction fees so contributors do not need SOL;
- payout rows use application-level idempotency before submission;
- opaque off-chain references support reconciliation without exposing capability details on-chain;
- every row persists submitted, confirmed, finalized, or failed status and transaction signature;
- treasury approval, sanctions/tax/KYC decisions, disputes, and attribution stay offchain;
- public wallet/amount linkage is disclosed to contributors before wallet enrollment.

Devnet closes the engineering proof. mainnet is allowed only after counsel/treasury review, contributor consent, key-management controls, and a small-value canary.

## first scientific proof

### registered question

> at equal fully loaded collection cost on one camera-free fixed-geometry YAM task, does a failure-conditioned teleoperation cohort produce more held-out capability gain than a randomly sampled teleoperation cohort, without worsening the safety envelope?

### task selection gate

choose one task only after week-1 hardware characterization. preferred shape:

**guided insertion or fixed-holder pick-and-place into a sensorized fixture**

keep the first proof single-follower-arm. a leader arm may supply teleoperation input, but bimanual scope is explicitly out: it multiplies CAN, clock, calibration, reset, hardware-variance, and credit-assignment failure modes before the first claim exists.

the task must satisfy every condition:

- success is mechanically measurable without a camera;
- initial conditions can be reset and enumerated;
- baseline success can be tuned into roughly 30–70%, avoiding floor/ceiling effects;
- failures have at least one stable telemetry signature or explicit operator label;
- the object cannot become an unobserved projectile;
- reset time is short enough for a powered evaluation;
- one trained operator can reproduce demonstrations;
- the policy never needs to infer an unobserved arbitrary pose.

if no task satisfies this by day 14, the scientific proof is blocked and camera-free capability procurement is not yet testable on this rig.

### treatment and control

| arm | collection request | matched controls |
|---|---|---|
| control | collect demonstrations uniformly across the registered train-condition grid, without seeing baseline failure density | same operator pool, accepted minutes, reset count, fixture versions, quality bar, and wall-clock window |
| treatment | oversample registered failure clusters and boundary conditions using baseline traces; request demonstrations/recoveries that cover those states | same controls plus identical training recipe and hyperparameter budget |

do not compare “careful experts” against “random novices.” random means random condition selection, not low-quality work.

### baseline and candidate policy

use the simplest policy that can expose the data-selection effect:

1. deterministic nominal trajectory or behavior-cloning baseline using joint/gripper state and explicit task-condition id;
2. identical learner initialized from the same baseline for each cohort;
3. frozen architecture, optimizer, training steps, augmentation, and tuning budget;
4. at least three training seeds per cohort;
5. candidate checkpoint selected without looking at the hidden real-robot test.

a giant VLA would confound the experiment with missing vision, model instability, and compute. earn the right to scale model complexity later.

### pre-registered splits

- `train-grid`: conditions available to collectors and trainers;
- `validation-grid`: conditions available for checkpoint selection, disjoint by reset block;
- `hidden-test-grid`: sealed initial-condition schedule controlled by the evaluator;
- `stress-grid`: safety and boundary conditions that cannot release positive performance money but can veto payout.

hash the full protocol and hidden schedule commitment before treatment collection. reveal the salt only after candidate hashes are frozen.

### evaluation design

- paired blocks: baseline, random-cohort candidate, and targeted-cohort candidate see the same initial-condition block in randomized order;
- evaluator is blind to candidate label where the interface permits;
- success comes from fixture sensor plus manual label; disagreements are adjudicated before unblinding;
- primary analysis uses paired outcome differences with confidence intervals;
- time-to-success/censoring, intervention count, path length, peak effort proxy, tracking error, and fault/e-stop rate remain full distributions;
- determine sample size from the observed baseline and smallest worthwhile effect in week 3; do not backfill a convenient `n` after seeing results;
- report every exclusion with a reason and repeat only protocol-defined invalid trials.

### primary metric

```text
capability gain per fully loaded collection dollar
  = (hidden-test success_rate_candidate - success_rate_baseline)
    / (operator pay + reset labor + rig time + validation labor + attributable training compute)
```

also report gain per accepted episode and gain per collection minute, but do not optimize on them because they hide operational cost.

### proof success threshold

the 90-day proof passes only if all are true:

1. the targeted cohort has a positive paired hidden-test lift over the random cohort;
2. the lower bound of the pre-registered uncertainty interval for the targeted-versus-random gain-per-dollar contrast is above zero, or a sequential design reaches its pre-registered success boundary;
3. targeted gain per dollar is at least 25% higher than random as a **management threshold**, not a literature-derived constant;
4. no safety veto metric crosses its pre-registered non-inferiority margin;
5. results reproduce across at least three training seeds and one repeated physical evaluation block;
6. the entire receipt and payout reconcile without manual database edits.

one pass justifies a second task. it does not justify a network claim. category evidence requires at least three tasks, two physical cells, and two buyer contexts.

### payout experiment

the first performance pool is intentionally simple:

- 70% guaranteed acquisition pay for accepted work;
- 20% quality/scarcity pool using pre-registered observable checks;
- 10% cohort performance pool released only after held-out evaluation;

these are 90-day test weights, not permanent economics. contributors see the formula before work. no contributor can lose guaranteed pay due to model performance. distribute the performance pool at cohort level, with capped within-cohort quality weights; publish stability under leave-one-cohort-out ablations.

use at least two separately identified contributors/operators so payout and cohort accounting are not a fake single-wallet demo. if safe operation requires capy-supervised access, that is acceptable; remote permissionless collection is not required for the proof.

## dependency spine

```text
verified hardware inventory
  → complete synchronized recorder
  → repeatable task + measurable outcome
  → stable baseline failure distribution
  → frozen protocol + hidden-test commitment
  → matched collection cohorts
  → deterministic training runs
  → blind paired hardware evaluation
  → cohort attribution
  → approved payout manifest
  → reconciled USDC
  → capability receipt
  → buyer pilot decision
```

no downstream demo is allowed to paper over a missing upstream gate.

## 13-week execution plan

### week 1 — establish physical and market truth

**depends on:** access to the actual rig and source code.

**build**

- inventory arm count, exact YAM variant, gripper, leader device, CAN adapters, compute host, e-stop, fixture candidates, spares, and physical workspace;
- measure available state/command rates and clock sources under a safe no-load trajectory;
- document every recorder channel actually emitted; mark absent fields rather than inventing them;
- shortlist two camera-free tasks and one non-camera outcome sensor for each;
- create a 30-account buyer map segmented by robot-foundation-model team, industrial integrator, and deployed-fleet operator.

**buyer validation**

- conduct five problem interviews with people who own or directly influence robot data/evaluation budgets;
- ask for one redacted example of a capability gap, current collection/evaluation workflow, delay cost, and buying unit;
- do not pitch Solana until the current workflow and budget owner are understood.

**demo**

- a live telemetry trace showing commands and measured state on one clock, or an explicit gap report if commands are missing.

**gate**

- proceed only if safe rig control and at least joint position/velocity/effort plus commanded action can be captured or added.

### week 2 — make an episode auditable

**depends on:** week-1 signal map and task shortlist.

**build**

- extend raw MCAP capture with commanded actions, teleop input, controller state, lifecycle, outcome, fixture config, intervention, and safety events;
- map monotonic/source time to session UTC, measure jitter/dropout, and fail validation on non-monotonic timestamps or channel gaps;
- build deterministic MCAP inspection and LeRobot v3 camera-free export;
- fabricate the simplest sensorized fixture and write a repeatable reset procedure;
- choose the task using measurability, baseline tunability, safety, and reset throughput.

**buyer validation**

- complete five more interviews;
- test two contract framings: fixed-fee dataset delivery versus fixed fee plus bounded performance pool;
- obtain two candidate failure manifests from friendly teams, even if capy cannot yet ingest them.

**demo**

- record, inspect, export, and replay the metadata for ten episodes with zero fabricated camera fields.

**gate**

- 100% of ten test episodes pass schema, clock, lifecycle, and outcome checks; sensor/manual outcome agreement is measured.

### week 3 — freeze the scientific contract

**depends on:** validated recorder and repeatable task.

**build**

- run enough baseline trials across the condition grid to estimate success distribution, reset variance, operator effect, and safety envelope;
- choose the failure taxonomy using only observable telemetry/manual evidence;
- select the baseline learner and run a dry training round;
- calculate the required paired evaluation budget and publish the statistical analysis plan;
- freeze the capability contract, treatment/control selection rule, hidden-test commitment, exclusion policy, and payout formula.

**buyer validation**

- review the contract with three qualified research/data leads and one procurement or operations person;
- ask each to identify the clause that would prevent signature.

**demo**

- “failure to job”: select a baseline failure cluster and compile a concrete collection instruction with acceptance tests.

**gate**

- baseline must be measurable, repeatable, safe, and away from floor/ceiling; otherwise change the task once and repeat week 3.

### week 4 — run the matched collection experiment

**depends on:** frozen protocol and qualified operators.

**build**

- randomize collection order and allocate equal fully loaded budgets;
- collect control and treatment cohorts with live QC but no midstream change to selection logic;
- record operator time, reset labor, invalid attempts, rig occupancy, and acceptance reasons;
- hash accepted cohort manifests and quarantine rejected data.

**buyer validation**

- send a sanitized live collection report to two design prospects;
- ask whether the evidence is enough to approve/deny an invoice milestone.

**demo**

- two matched cohort dashboards with cost and coverage, still blinded to downstream result.

**gate**

- cohorts remain balanced on all registered nuisance variables; otherwise declare the mismatch before training and use the pre-registered correction or restart.

### week 5 — train without moving the goalposts

**depends on:** accepted locked cohorts.

**build**

- run baseline, random-cohort, and targeted-cohort training across registered seeds;
- persist code, container, base model, data, config, seed, compute, and candidate hashes;
- run validation-grid selection and safety checks;
- prepare sealed candidates for evaluation without viewing hidden results.

**buyer validation**

- show the reproducible run manifest to two buyer-side ML engineers;
- identify which lineage fields their internal review actually needs.

**demo**

- deterministic rebuild of one candidate from a receipt reference.

**gate**

- seed variance and validation behavior must be low enough to distinguish a collection effect; otherwise simplify the learner before physical evaluation.

### week 6 — execute the blind paired evaluation

**depends on:** frozen candidate hashes and sealed schedule.

**build**

- have the evaluation operator run randomized paired blocks;
- capture sensor/manual outcome, full telemetry, time-to-success, intervention, effort proxy, tracking error, faults, and exclusions;
- reveal candidate labels only after the evaluation file is finalized and signed;
- compute registered confidence intervals and safety vetoes.

**buyer validation**

- have one external roboticist audit the protocol and a sample of raw rollouts;
- ask one prospect whether they would trust this separation model or require a third-party cell.

**demo**

- live sealed-model evaluation followed by reveal and signed result.

**gate**

- if the proof fails, do not tune on the hidden test. perform the registered root-cause audit and allow one protocol-preserving replication only.

### week 7 — close attribution and Devnet settlement

**depends on:** finalized evaluation.

**build**

- calculate acquisition, quality/scarcity, and cohort performance pools;
- run leave-one-cohort-out and bootstrap stability checks;
- generate an approved payout manifest with hardcoded cluster/mint allowlists and idempotency keys;
- execute sponsored native test-USDC payouts on Solana Devnet and reconcile every row to finalized status;
- build capability receipt v0.

**buyer validation**

- show the full redacted receipt to buyer legal/finance/ML stakeholders;
- ask which evidence they would permit to be portable and which must remain private.

**demo**

- click from receipt to episode hashes, training runs, signed eval, payout rows, and transaction signatures.

**gate**

- no duplicate, wrong-mint, wrong-cluster, orphaned, or unreconciled payout rows.

### week 8 — adversarial replication and product hardening

**depends on:** first closed loop.

**build**

- repeat one physical evaluation block on a different day after re-calibration;
- attempt evaluator leakage, duplicate episode submission, timestamp tampering, replayed payout, wallet substitution, and result-edit attacks;
- implement dispute states and immutable superseding receipts rather than mutation;
- measure operator/evaluator agreement and cross-day drift.

**buyer validation**

- run a 60-minute design-partner tabletop using a prospect's redacted failure;
- require them to price the current pain and name the approval path.

**demo**

- attack-and-recovery demo where invalid evidence or payout is blocked and explained.

**gate**

- scientific result survives the registered replication; critical receipt/payout attacks fail closed.

### week 9 — package the managed capability contract

**depends on:** valid proof or explicit negative result.

**build**

- turn the internal protocol into a buyer-facing statement of work, security/data-boundary diagram, pricing model, and evidence sample;
- define three delivery modes: buyer-hosted training, capy clean room, or evaluator-only;
- define evaluator conflict policy and partner requirements;
- calculate fully loaded pilot cost and minimum non-subsidized price.

**buyer validation**

- present to five qualified accounts;
- ask for a paid discovery/evaluation milestone, not a vague letter of support.

**demo**

- 12-minute narrative: failure → collection job → measured lift → receipt → payout.

**gate**

- at least two accounts advance with named technical and budget stakeholders.

### week 10 — test portability, not scale theater

**depends on:** one credible design prospect and stable first task.

**build**

- ingest a second, synthetic or partner-redacted failure bundle through the same contract compiler;
- prove schema/receipt portability without claiming policy transfer;
- map a second embodiment through metadata only if a real owner participates;
- draft external evaluator adapter and sealed artifact handoff.

**buyer validation**

- negotiate data-access, evaluation-independence, success criteria, and payment terms with the lead prospect;
- seek a paid pilot or paid design phase.

**demo**

- compile two materially different failure bundles through the same protocol, with no new hardcoded schema branch.

**gate**

- buyer must accept a measurable outcome and evidence boundary; otherwise the wedge is evaluation/data tooling, not a capability market.

### week 11 — externalize evaluation and operational controls

**depends on:** external-cell candidate and finalized protocol.

**build**

- dry-run signed evaluator onboarding, hardware fingerprinting, hidden schedule handling, conflicts, fixed compensation, and receipt submission;
- conduct treasury threat model, key separation, daily limits, destination review, and incident drill;
- conduct contributor rights/privacy review, including public wallet-amount disclosure;
- prepare mainnet checklist without transferring value.

**buyer validation**

- ask the lead prospect to approve the external evaluation design;
- get written feedback from finance/legal on USDC versus fiat/ACH fallback.

**demo**

- evaluator in a separate account/process signs a result that capy verifies but cannot silently edit.

**gate**

- no “independent” claim until conflict and access controls are real; Solana remains backend-only if buyers/contributors reject it.

### week 12 — pilot commitment and small-value canary

**depends on:** counsel/treasury readiness and a qualified contributor.

**build**

- resolve pilot contract redlines and lock customer success metrics;
- if all compliance/key/privacy gates pass, execute one explicitly consented small-value native USDC mainnet canary and reconcile it; otherwise stay on Devnet;
- freeze receipt v1 and document migration/supersession policy;
- publish the negative results and limitations internally, not just the winning chart.

**buyer validation**

- obtain a signed paid pilot/design phase or a documented no with reason and budget timing.

**demo**

- buyer-specific shadow capability contract using their redacted inputs.

**gate**

- no mainnet transfer without every control; no free “pilot” that lacks a budget owner and decision date.

### week 13 — decide, do not celebrate

**depends on:** full evidence package.

**build**

- reproduce all metrics from immutable artifacts;
- have an uninvolved reviewer audit the scientific claim, commercial evidence, risk register, and cash plan;
- choose one of four paths: double down, run one bounded replication, pivot to tooling/evaluation, or stop;
- sequence the next two tasks/cells only if the relevant gates passed.

**buyer validation**

- close one paid next step and schedule the buyer's internal kickoff, or record the thesis failure.

**demo**

- end-to-end receipt plus a brutally honest “what this does not prove” slide.

**gate**

- founder signs the day-91 decision memo against the kill criteria below. sunk cost gets no vote.

## staffing assumptions

### minimum credible team: 5.6–5.8 full-time equivalents

| role | allocation | 90-day accountability |
|---|---:|---|
| founder / product / enterprise sales | 1.0 | buyer discovery, category, contracts, capital gates, partner recruitment |
| robot-learning research lead | 1.0 | experimental design, policy baseline, training, causal humility, analysis |
| robotics / controls engineer | 1.0 | i2rt integration, safe control, recorder, fixtures, hardware uptime |
| data / protocol engineer | 1.0 | MCAP/LeRobot pipeline, manifests, lineage, receipt, reproducibility |
| evaluation and lab-ops lead | 1.0 | resets, blinding, trial operations, QC, hardware scheduling, external-cell playbook |
| payments / security engineer | 0.3–0.5 | payout manifest, treasury controls, idempotency, reconciliation, threat model |
| statistician / methods advisor | 0.2 | power, sequential design, paired analysis, uncertainty review |
| privacy/payments counsel | 0.1 | contributor terms, data rights, sanctions/tax/payment review; advice, not engineering |

the founder cannot also be the sole collector, trainer, evaluator, and salesperson. that setup would make the “independent evaluation” thesis bullshit and starve buyer validation.

### if only three people exist

cut scope, not rigor:

- founder owns sales/product and payout operations;
- robotics/research lead owns experiment/training but cannot operate the final evaluation;
- controls/data engineer owns recorder/protocol;
- hire a fixed-fee external operator/statistical reviewer for the evaluation;
- drop mainnet, second-bundle portability, and external-cell adapter from the 90-day target.

## hardware and operating constraints

| constraint | consequence | week-1 verification / mitigation |
|---|---|---|
| no cameras on the user's i2rt rig | no VLA, arbitrary-pose manipulation, visual failure localization, or VIMA-on-rollout claims | choose fixed geometry; explicit condition ids; non-camera fixture sensor; separate telemetry event extractor |
| arm count and exact YAM revision are not yet verified in this repo | cannot assume bimanual tasks or model compatibility | photograph/inventory labels locally, query configuration, hash URDF/MJCF and controller versions |
| stock i2rt recorders create independent second-resolution sessions | simultaneous leader/follower starts can collide and wall-clock alignment can be corrupted | build one session recorder; record monotonic + UTC mappings, source timestamps, device ids, sequence/drop counters, and explicit command streams |
| one physical cell is a serial bottleneck | collection, tuning, and evaluation compete for the same rig and can leak information | reserve evaluation blocks, freeze candidates before tests, track rig hours, recruit external cell early |
| motor effort is not calibrated contact force | contact/safety conclusions may be wrong | call it effort/current proxy; characterize no-load baselines; add load cell or mechanical success sensor if needed |
| fixed-geometry task can hide generalization failure | a clean result may be a trajectory memorization result | state the scope; use held-out enumerated fixture offsets/config ids the policy can observe; add second task later |
| reset drift can dominate policy differences | false treatment effect | written reset procedure, fixture hard stops, sensor checks, randomized paired blocks, drift log |
| CAN/host timestamps may not share a trustworthy clock | invalid alignment and failure localization | record source + host monotonic time, clock-fit residual, dropout, queue lag, and validation thresholds |
| hardware wear and thermal drift | declining performance and unsafe trials | warm-up/calibration protocol, temperature capture, maintenance window, spare gripper/fixtures, stop limits |
| e-stop/safety coverage may be incomplete | unacceptable human/hardware risk | physical e-stop test, exclusion zone, speed/torque limits, two-person high-risk changes, incident log |
| outcome sensor may be gameable or flaky | evaluator leakage and label noise | dual sensor/manual labels, calibration checks, blinded adjudication, tamper-evident fixture version |
| local compute may be modest | giant models slow iteration and confound the proof | use small proprioceptive policies; rent bounded GPU only after deterministic data export |

planning capacity assumptions must be replaced with measurements in week 1. do not promise an episode count before reset time, safe duty cycle, and maintenance load are observed.

## demonstrations that matter

| demo | audience | proof delivered | forbidden theater |
|---|---|---|---|
| truth trace | robotics engineer | synchronized command, state, lifecycle, outcome, safety, and fixture record | animated dashboard fed by synthetic data |
| failure-to-job compiler | research/data lead | one failure cluster becomes a precise collectable request and frozen eval | LLM-generated prose with no measurable acceptance rule |
| matched cohort ledger | scientist | treatment/control cost and nuisance balance before outcome | selecting the winning cohort after evaluation |
| sealed evaluation reveal | buyer/evaluator | candidate hashes and hidden schedule commit precede paired results | capy training team operating and grading its own final test |
| capability receipt | ML, legal, finance | lineage, uncertainty, rights, approvals, and payout reconcile | putting raw data or identity onchain |
| adversarial rejection | security/ops | duplicate/tampered evidence and replayed payout fail closed | claiming blockchain prevents fraudulent collection |
| buyer shadow contract | executive sponsor | their failure and economics fit the protocol | a generic marketplace mockup with imaginary liquidity |

## buyer-validation program

### ideal first buyer

- has a deployed or near-deployed manipulation system, not only a research demo;
- owns a repeatable task with a painful 20–80% failure band;
- already spends on teleoperation, resets, evaluation, or data operations;
- can expose a checkpoint or run a supplied harness inside its boundary;
- has a named research/data lead and a budget owner;
- values time-to-capability or independent evidence enough to pay for an outcome;
- accepts a narrow pilot before cross-embodiment promises.

### disqualifiers

- wants generic egocentric video by the hour;
- has no measurable success condition or physical test access;
- will not reveal even aggregate baseline/evaluation results;
- wants capy to finance all collection and training without a paid milestone;
- treats a token or “decentralization” as the core value;
- requires camera-driven open-world behavior for the first i2rt proof;
- calls a founder-run internal demo “independent.”

### interview scoreboard

count only qualified conversations with a person who operates the workflow or controls/influences budget.

by day 30:

- 15 qualified interviews;
- 8 quantified current workflows;
- 5 redacted failure examples;
- 3 contract/protocol reviews;
- 2 accounts with both technical and budget stakeholders.

by day 60:

- 20 qualified interviews total;
- 3 buyer-specific shadow contracts;
- 2 security/data-boundary reviews;
- 1 verbal agreement on a measurable paid scope.

by day 91:

- one signed paid pilot or paid design/evaluation phase;
- one backup account with named next step and decision date;
- a loss log categorizing “no” by trust, access, timing, price, scientific value, procurement, and payout rail.

letters of support, waitlist emails, hackathon applause, and investor enthusiasm do not count as buyer validation.

## metrics and operating dashboard

### north-star learning metric

**incremental verified capability gain per fully loaded procurement dollar**, with uncertainty and safety constraints.

### scientific metrics

- paired hidden-test success delta: targeted vs random vs baseline;
- confidence/credible interval and pre-registered decision boundary;
- time-to-success distribution and timeout rate;
- intervention, fault, e-stop, peak effort proxy, tracking error, and path-length distributions;
- effect consistency across seeds, evaluation blocks, operators, and fixture conditions;
- sim-to-real rank correlation only if simulation is used;
- label agreement among fixture sensor, operator, and adjudicator;
- attribution stability under bootstrap and leave-one-cohort-out.

### collection/operations metrics

- accepted episodes and minutes per paid hour;
- invalid/rejected rate by reason;
- reset minutes and rig occupancy per accepted episode;
- telemetry dropout, clock residual, and incomplete lifecycle rate;
- collector yield: verified lift attributable to a cohort per paid dollar;
- hardware uptime, thermal stops, faults, incidents, and maintenance hours.

### market metrics

- qualified interviews and quantified pains;
- redacted failure bundles shared;
- contract reviews completed;
- opportunities with technical + budget owner;
- paid conversion, pilot contract value, sales cycle stage, and procurement blockers;
- quoted willingness to pay relative to fully loaded delivery cost;
- percentage of prospects permitting third-party or functionally separated evaluation.

### trust/settlement metrics

- percent of receipt references reproducible from immutable artifacts;
- evaluator conflict disclosures and protocol deviations;
- payout rows finalized without manual correction;
- duplicate/replay/wrong-mint/wrong-cluster blocks;
- time from buyer approval to contributor-visible finalization;
- disputes per payout batch and median resolution time;
- contributor preference for USDC versus fiat fallback.

### anti-metrics

do not optimize raw uploaded hours, wallet count, token volume, registered contributors, model parameter count, or simulated success alone. they reward scale theater before evidence.

## kill and pivot criteria

these are management thresholds. they are deliberately harsh and should be signed before the relevant result exists.

| checkpoint | kill condition | action |
|---|---|---|
| day 7: hardware truth | commanded actions and measured state cannot be captured safely on a common timeline | stop the experiment; build/fix recorder only |
| day 14: task truth | no camera-free task has objective outcome, safe failure band, controlled resets, and sufficient throughput | stop the capability claim on this rig; add non-camera sensing or obtain a different cell |
| day 21: failure truth | baseline failures are not repeatable enough to define a stable cluster or are dominated by reset/operator noise | change task once; after second failure, pivot to instrumentation/evaluation tooling |
| day 45: collection integrity | treatment/control cannot be matched on operator, time, conditions, quality, and cost | invalidate the comparison; do not publish a lift claim |
| day 60: scientific result | after one pre-registered replication, targeted collection does not beat random on gain per dollar, or crosses a safety veto | kill “bounty compiler improves yield”; retain recorder/eval/receipt products only |
| day 60: attribution | cohort bonus rankings are unstable under modest resampling/ablation | pay guaranteed amounts, return the performance pool pro rata, and kill causal payout marketing |
| day 60: buyer access | fewer than 5 of 20 qualified prospects share a usable redacted failure or permit a measurable evaluation | demand cannot feed the protocol; pivot to buyer-hosted evaluation tooling or stop |
| day 75: willingness to pay | no prospect will fund at least a paid design/evaluation milestone after seeing the receipt | stop network/platform work; sell services only if gross margin and founder intent make sense |
| day 75: independence | prospects will not permit external or functionally separated evaluation | remove “independent” from the category; offer internal evidence infrastructure or stop |
| day 82: settlement usefulness | contributors/buyers treat USDC as a compliance/privacy burden and gain no operational benefit | keep Solana optional or remove it from the product surface; never let the rail sink the company |
| day 91: contract | no signed paid next step with a budget owner and decision date | do not raise on network claims; run at most one explicitly justified sales-cycle extension |
| after task 3 | targeted gain-per-dollar advantage is below 25% on two of three tasks or disappears in a second cell | kill the general routing thesis; sell task-specific tooling/evaluation |
| after buyer 2 | effect metadata cannot be normalized or shared even in aggregate across buyers | there is no cross-buyer data moat; price as enterprise software/services, not a network |

## brutal risk register

probability and impact are current qualitative judgments, not model outputs.

| id | risk | probability | impact | leading indicator | mitigation / contingency | owner |
|---|---|---:|---:|---|---|---|
| r1 | targeted data does not outperform matched random data | high | fatal to core wedge | small/unstable validation contrast; failure clusters move between runs | pre-register, simplify task/learner, allow one replication, then kill bounty claim | research lead |
| r2 | “failure-conditioned procurement” is just DAgger plus contracting language | high | high | buyers compare it to internal active learning and see no switching value | prove shorter time-to-capability, independent evidence, and multi-source procurement; otherwise sell tooling | founder |
| r3 | Scale/robot OEMs bundle the same loop | high | high | incumbent adds outcome pricing or receipt/eval features | focus on neutral cross-vendor evaluation and effect metadata; partner where possible | founder |
| r4 | buyers refuse to share models, traces, or results | high | fatal to network | security review blocks artifact movement | buyer-hosted runner, sealed containers, hashes/aggregates only; pivot if even results cannot leave | protocol lead |
| r5 | capy cannot honestly claim evaluator independence | high | high | same people collect, train, score, and get paid on success | fixed-fee external evaluator, role separation, conflicts, sealed schedule; downgrade claim until real | eval lead |
| r6 | one camera-free cell proves a toy trajectory, not physical intelligence | certain | medium | task relies on exact coordinates and condition id | state scope, add second task/cell only after first proof; never use VLA/generalization language | research lead |
| r7 | no-camera evidence is insufficient to diagnose object-level failure | high | high | manual labels dominate; telemetry clusters do not map to causes | constrain task, add non-camera fixture sensing, treat diagnosis as label-assisted; obtain video later only with consent | controls lead |
| r8 | motor-current contact proxy is misleading | medium | high | high effort without contact or missed contacts | no-load characterization, load cell/fixture sensor, call it proxy, safety veto on uncertainty | controls lead |
| r9 | reset/operator drift creates a fake treatment effect | high | high | outcome changes by day/operator more than cohort | randomized paired blocks, hard-stop fixture, drift covariates, blinded evaluator, replication | eval lead |
| r10 | treatment/control leakage or hidden-set leakage | medium | fatal to claim | collector sees schedule; repeated test improves candidate | role/access controls, commit/reveal, one-time blocks, audit logs, rotate conditions | eval lead |
| r11 | training seed/hyperparameter variance overwhelms data effect | high | high | candidate ranking flips across seeds | small deterministic learner, frozen budget, multiple seeds, report distribution | research lead |
| r12 | attribution is unstable or gameable | high | high | bonus allocation flips under bootstrap; duplicate trajectories earn more | cohort-level pools, guaranteed pay, caps, dedup, stability disclosure; eliminate performance allocation if unstable | research lead |
| r13 | guaranteed pay plus evaluation makes unit economics worse than ordinary contracting | medium | fatal to business | delivery cost approaches/exceeds buyer value; long eval tail | measure full cost, charge paid milestones, automate only repeated steps, stop subsidized pilots | founder |
| r14 | network cold start: no buyer without supply, no supply without funded jobs | high | high | generic contributor recruiting precedes contracts | single-buyer managed contract first; recruit only against funded jobs | founder |
| r15 | vertical robot firms keep the best data/evals internal | high | high | prospects want labor but reject portable receipts | sell neutral evaluation, overflow/specialist coverage, or cross-site proof; avoid raw-data moat thesis | founder |
| r16 | World Context distracts the team and contributes no robot lift | high | medium | weeks spent embedding video before recorder works | tier-0 firewall; ontology/evidence only until a separate ablation is funded | product lead |
| r17 | VIMA name/role confusion creates false technical claims | medium | medium | docs call VIMA a robot policy or camera-free analyzer | explicit local-VIMA qualifier, sensor-boundary tests, architecture review | protocol lead |
| r18 | MCAP/LeRobot export silently loses timing or semantics | medium | high | round-trip counts/timestamps differ | immutable raw MCAP, deterministic converter, validation report, golden fixtures | data lead |
| r19 | public Solana payouts expose sensitive wallet/amount relationships | high | high | contributor objects after first transfer; wallets cluster | explicit consent, wallet separation guidance, opaque refs, fiat fallback, keep identities offchain | payments lead |
| r20 | wrong mint/cluster/address or retry causes irreversible payment | medium | high | config drift, unresolved status, duplicated job | hard allowlists, dry-run, dual approval, idempotency, balance/recipient checks, small canary | payments lead |
| r21 | treasury key compromise or sponsor abuse | medium | fatal | unexpected fee/payout pattern | hardware-backed/multisig custody, limits, isolated sponsor, monitoring, incident freeze | payments lead |
| r22 | sanctions, tax, labor, money-transmission, or data-rights obligations are mishandled | medium | fatal | counsel flags contributor geography or payout flow | jurisdiction-limited pilot, counsel, vendor KYC/tax workflow, terms/consent; no permissionless launch | founder |
| r23 | contributors optimize sensor success without useful behavior | medium | high | fixture passes while trajectory quality/safety degrades | safety veto, trajectory QC, hidden perturbations, delayed performance pool | eval lead |
| r24 | evaluator collusion or buyer pressure changes results | medium | fatal to trust | protocol deviations correlate with payout | fixed evaluator pay, signed raw artifacts, dual audit, rotation, conflict disclosures | eval lead |
| r25 | hardware failure consumes the 90-day window | medium | high | rising temperature/faults and scarce spares | preventive maintenance, spares, conservative duty cycle, simulator for pipeline only, backup cell search | controls lead |
| r26 | a successful first task does not transfer to other tasks/cells | high | fatal to network | routing features are task-specific; second task loses advantage | require three-task/two-cell gate before category claim; modularize effect schema | research lead |
| r27 | buyers value evaluation but not contributor payout innovation | high | medium | sales calls engage on eval and ignore settlement | let payouts be invisible infrastructure; sell the capability evidence, not crypto | founder |
| r28 | an external evaluator becomes the customer relationship owner | medium | high | evaluator bundles collection and procurement | contract for neutral interfaces; develop multi-evaluator network; own contract/receipt and routing data | founder |
| r29 | effect metadata cannot be shared across buyers for legal/privacy reasons | high | fatal to network moat | every field is customer-confidential | define minimum aggregate schema, differential disclosure, customer-owned raw; reprice as enterprise tool if impossible | protocol lead |
| r30 | the team raises/builds on a positive but underpowered result | high | fatal to credibility | headline precedes uncertainty and replication | pre-registered gate, outside methods audit, publish limitations beside result | founder |

## unit economics to measure, not assume

for each contract track:

```text
buyer price
  - contributor acquisition pay
  - quality/scarcity pool
  - performance pool
  - rig + fixture depreciation/repair
  - operator + reset labor
  - evaluation cell fee
  - training compute
  - data review and disputes
  - payment/compliance operations
  = contribution margin
```

also track buyer value proxies:

- deployment delay avoided;
- engineer/robot-operator weeks avoided;
- intervention reduction;
- throughput or task success gained;
- avoided duplicate collection;
- audit/evaluation evidence created.

do not price as a percentage of a speculative capability value until a buyer can measure that value and procurement accepts the structure. the first paid scopes should combine fixed milestones with a small bounded performance pool.

## day-91 decision matrix

| science | demand | decision |
|---|---|---|
| pass | paid | run task 2 with an external cell and buyer failure; hire toward repeatability |
| pass | unpaid | cap sales extension at one defined cycle; do not build network supply |
| fail | paid for eval/tooling | pivot to recorder/evaluation/receipt infrastructure; remove outcome-routing claim |
| fail | unpaid | stop |

Solana preference does not change this matrix. World Context/VIMA enthusiasm does not change this matrix. investor interest does not change this matrix.

## what happens after the proof

only after the day-91 pass:

### stage 2: replicate the transaction

- three tasks with distinct failure physics;
- two independent physical cells;
- at least two operator pools;
- one real buyer-owned failure;
- compare capy routing against buyer's incumbent collection process;
- test whether effect metadata normalizes across task/embodiment boundaries.

### stage 3: open the supply side carefully

- certify collectors and evaluator cells against funded jobs;
- portable contributor/facility reliability based on accepted quality and measured cohort yield;
- rights-aware private data exchange, not default public upload;
- fiat and native USDC settlement choices with identical receipt semantics;
- evaluator rotation, staking/penalties only if ordinary contracts cannot solve observed misconduct—never a speculative token.

### stage 4: become the clearinghouse

- buyers submit capability contracts through a standard interface;
- routers price expected lift, uncertainty, time, and safety risk across experience sources;
- evaluators compete on reproducibility, turnaround, hardware coverage, and independence;
- receipts become portable evidence for procurement, deployment gates, insurers, and regulators;
- the network funds the next highest-value failure instead of the next undifferentiated hour.

the ocean-scale destination is valid only if each local transaction is scientifically honest, economically positive, and trusted by parties who do not already trust one another.

## non-goals for the first 90 days

- no public marketplace;
- no capy token or custom Solana program;
- no raw video or telemetry onchain;
- no VLA or vision generalization claim;
- no fabricated camera channels;
- no promise of exact per-trajectory causal value;
- no World Context policy-training claim;
- no simulation-only release of performance money;
- no “independent” label for founder-run evaluation;
- no multi-embodiment abstraction before one complete receipt works;
- no contributor growth campaign before a funded job exists.

## day-91 deliverables

1. a camera-free i2rt episode recorder and validation report;
2. one pre-registered matched collection experiment with immutable artifacts;
3. baseline, random, and failure-targeted candidates across registered seeds;
4. paired hidden real-robot evaluation with uncertainty and safety metrics;
5. cohort attribution stability report;
6. one complete capability receipt;
7. fully reconciled native USDC Devnet payouts and, only if cleared, one small mainnet canary;
8. an evaluator-independence and external-cell plan;
9. 20+ qualified buyer conversations with a structured loss log;
10. one paid next step or an explicit thesis kill/pivot memo.
