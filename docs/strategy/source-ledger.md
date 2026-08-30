# capy primary-source evidence ledger

research cutoff: 2026-08-30

purpose: distinguish observed facts from capy hypotheses and management thresholds

## reading rules

- a vendor statement proves that the vendor makes the statement; it does not prove an audited financial or performance result.
- a paper proves only what its experiment covers. simulation results are not evidence of real-robot performance.
- “potentially novel” below means differentiated in the reviewed public landscape, not a patentability or freedom-to-operate opinion.
- World Context figures come from a local package audit because the package itself is the primary artifact. They are not generalized beyond that release.
- the local VIMA repository and the ICML 2023 VIMA agent are unrelated systems that share a name. capy uses the local evidence-memory system.

## market evidence

| source | primary claim | caveat | implication for capy |
|---|---|---|---|
| [Figure, “Introducing Index” (2026-08-25)](https://www.figure.ai/news/introducing-index) | Figure reports 264,000 app downloads, 44,000 weekly active contributors, 16 million uploaded videos, $15 million paid to creators, and a commitment to spend more than $1 billion on data and compute over the next year. Its pipeline filters, fraud-checks, deduplicates, rebalances, and annotates contributions. | company-reported and Figure-exclusive; no public causal policy-lift audit | contributor supply, paid collection, task quotas, fraud review, and diversity routing are already real at massive scale. “crowdsourced robot data” is not a category wedge. |
| [Scale Physical AI](https://scale.com/physical-ai) | Scale markets a global collection network, data factories, robotless egocentric collection, internal policy fine-tuning/evaluation, and more than 1,000 demonstration hours uploaded daily. It names Generalist and Physical Intelligence among supported labs. | marketing claims; no disclosed buyer contract values or evaluation protocol | managed collection plus model-improvement evaluation is occupied. capy must sell a different control point, not a thinner data factory. |
| [Scale + Universal Robots (2026-03-16)](https://scale.com/blog/scale-ai-universal-robots-physical-ai) | the companies announced direct production-robot collection with visual and force data and future release of an industrial dataset; UR hardware is described as present in more than 100,000 industrial deployments. | announced integration and future dataset, not evidence of delivered policy lift | incumbents can distribute capture software through production OEMs. a hardware-agnostic upload network has weak defensibility. |
| [Lightwheel, Q1 orders (2026-05-06)](https://www.lightwheel.ai/media/q1-orders-physical-ai) | Lightwheel reports about $100 million of Q1 2026 orders spanning world reconstruction, data generation, evaluation, and deployment systems. | self-reported orders; terms, revenue recognition, and customer mix are undisclosed | simulation-to-evaluation-to-deployment is already sold as an integrated stack. |
| [RobotData](https://robotdata.com/) | RobotData says its engine helps teams decide what data to collect, debug behavior down to training data, and use in-field data for continual learning. | early product site with no public outcome study | even “understand which data improves performance” is explicitly occupied positioning. capy must prove procurement and settlement create additional value. |
| [Node Data, launch (2026-05-25)](https://www.nodedata.dev/news/node-data-is-live) | Node Data markets a physical-AI marketplace for datasets, models, and environments, an everyday-task collection app, provenance/licensing, and creator payouts through Stripe Connect. | product claims; marketplace liquidity is not disclosed | marketplace, licensing, mobile contribution, and creator payouts are crowded. blockchain is not needed to reproduce this surface. |
| [Sunday Robotics, Series B (2026-03-12)](https://www.sunday.ai/blog/series-b) | Sunday says it grew Data Operations fivefold and owns the loop from its Skill Capture Glove and collection through hardware, manufacturing, and robot-fleet data. | company narrative, not audited operational data | vertically integrated robot firms can internalize the loop. capy must beat build-in-house on time-to-capability, trust, or marginal cost. |
| [Actor Labs](https://labs.actor/) | Actor reports sensors across 50 deployed machines and more than 63 million recorded frames, using real operating sites as its learning loop. | live counter/company report; no independent performance audit | deployment fleets naturally become proprietary data flywheels, reducing willingness to export raw experience. |
| [ABC, “Scalable Behavior Cloning” (2026)](https://abc.bot/) | ABC releases 134,806 episodes/3,553 real hours across 195 bimanual tasks, 400 simulation hours, more than 100 real-evaluation hours, hardware/training code, and fixed 50-trial rubrics. It reports failure-triggered DAgger rounds moving box-folding mean progress from 24% to 85%. | research-team report; camera-heavy bimanual stack and task-specific intervention result | this is the sharpest technical collision: open scaled collection, evaluation, simulation, and failure-triggered improvement already exist. capy's claim must be procurement/evaluator separation/economics, not the learning loop itself. |
| [DROID (2024/2025)](https://arxiv.org/abs/2403.12945) | DROID reports 76,000 trajectories/350 hours across 564 scenes and 84 tasks, collected by 50 collectors on three continents; data, learning code, and hardware guide are open. | one standardized collection platform and research program, not a buyer marketplace | distributed real-robot collection and reproducible hardware cells are established primitives. |
| [World Context](https://worldcontext.org/) | World Context markets visual/sensor human-work datasets for training, edge cases, and machine testing, including bespoke collection. | public site exposes limited schema, license, volume, customer, and causal-lift detail | World Context is an upstream supplier/asset, not capy's category or evaluator. its local package remains tier 0. |

## evaluation competition and precedent

| source | primary claim | caveat | implication for capy |
|---|---|---|---|
| [RoboArena, CoRL 2025](https://proceedings.mlr.press/v305/atreya25a.html) | distributed evaluators at seven institutions ran more than 600 double-blind pairwise real-robot episodes across seven policies; the authors report more accurate rankings than conventional centralized evaluation. | DROID network and pairwise ranking scope; not procurement or data attribution | distributed independent evaluation is scientifically credible and already public. capy should reuse blind/pairwise ideas and avoid claiming the evaluation network alone as novel. |
| [ARC VLA](https://arcvla.com/) | ARC markets independently operated physical cells, signed and replayable raw observations, public protocols, adversarial perturbations, and typed failure traces. | public pages distinguish reference figures from live ARC scores; commercial traction is not disclosed | “somebody else grades the robot” is an emerging company category. capy should partner with independent cells rather than pretend its own cell is independent. |
| [Proving Ground](https://www.teleoprobot.com/) | Proving Ground markets reproducible real-world robot-policy evaluation and outsourced rigs/operators/resets/test infrastructure. | product-site claims without published customer outcomes | evaluation-as-a-service is crowded enough that capy must treat it as a supply role in the network. |
| [PhAIL paper (2026)](https://arxiv.org/abs/2605.29710) | PhAIL argues that common real-world VLA evaluations use small samples and binary success rates without confidence intervals; it proposes time-to-success distributions and separated comparison/qualification jobs. | recent preprint; one benchmark embodiment | capy must pre-register sample sizes, retain episode distributions, and report uncertainty rather than a single success number. |
| [Open X-Embodiment](https://robotic-transformer-x.github.io/) | 1M+ trajectories from 22 embodiments and 60 datasets were standardized; RT-X showed positive transfer in the reported experiments. | the project also makes embodiment-specific action-space choices; positive transfer is not universal transfer | standardized multi-embodiment data is mature prior art. capability receipts should point to existing formats rather than invent a new tensor format. |
| [NIST assembly metrics and task boards](https://www.nist.gov/el/intelligent-systems-division-73500/robotic-grasping-and-manipulation-assembly/assembly) | NIST develops modular task-based assembly tests, replicable artifacts, repeated-trial/statistical guidance, and boards covering peg/connector insertion and other competencies. | standards/metrology program rather than a fast commercial procurement network | neutral physical artifacts and repeated capability measurement are prior art; capy should reuse their discipline and can consider a NIST-style insertion board instead of inventing a flashy demo. |

## learning and attribution primitives

| source | primary claim | limit | capy decision |
|---|---|---|---|
| [DAgger, AISTATS 2011](https://proceedings.mlr.press/v15/ross11a.html) | sequential imitation learning violates i.i.d. assumptions because actions change future observations; iterative data aggregation trains on the policy-induced state distribution. | does not define a marketplace, payouts, or failure-bounty economics | collecting around policy failures/state visitation is foundational prior art, not capy's invention. the proof must compare selection efficiency, not merely show that targeted examples help. |
| [Data Shapley, ICML 2019](https://proceedings.mlr.press/v97/ghorbani19c.html) | data value is conditional on a fixed learning algorithm and evaluation metric; Monte Carlo/gradient approximations can estimate per-datum values. | supervised-learning experiments, expensive approximation, and no universal value | never mint a permanent “value” for an episode. version attribution against a specified model, training recipe, cohort, and held-out evaluation. |
| [Hidden Cost of Data Valuation, 2025](https://openreview.net/forum?id=6ONN8xLTmk&noteId=eB11sWUJWH) | data must be acquired and assessed before low marginal value is known, so pure marginal-value payouts can leave contributors uncompensated for real acquisition cost. | conceptual/game-theoretic study with limited empirical setting | split guaranteed accepted-work pay from quality/scarcity and cohort performance bonuses. do not use exact per-clip causality as payroll. |
| [World-model policy evaluation (2025)](https://arxiv.org/abs/2506.00613) | reported world-model evaluation preserved relative policy rankings in studied settings while underestimating in-distribution values and overestimating out-of-distribution values; object interaction remained difficult. | video/action world model, not camera-free YAM; preprint | simulation may triage candidates only after measured sim-to-real rank correlation. it cannot release a performance pool by itself. |

## capy stack primitives

| source | observed capability | missing or dangerous assumption | capy role |
|---|---|---|---|
| [i2rt official repository](https://github.com/i2rt-robotics/i2rt) | YAM support includes real-time CAN control, MuJoCo models, bimanual teleoperation, trajectory record/replay, joint position commands, gripper control, and a documented 400 ms motor safety timeout. | the user's rig has no cameras. the installed recorder writes feedback but not the complete command, operator-input, outcome, reset, fixture, and safety lifecycle needed for learning/evaluation. `RobotMcapRecorder.create()` also uses second-resolution directories under `~/.i2rt` and independent files, so simultaneous devices can collide and stock files are not a synchronized multi-device session. current hardware inventory and arm count must be verified physically. | camera-free reference collection and evaluation cell; first build a session owner that records all devices/sensors/events with monotonic + UTC mappings, explicit ids, drop counters, and hashes. |
| [MCAP overview](https://mcap.dev/guides/getting-started/) | MCAP supplies multi-language readers/writers, ROS 1/2 support, inspection, indexing, and visualization paths. | a container does not guarantee clock quality, semantic completeness, or rights/provenance | immutable synchronized raw episode log. add capy manifests around it instead of forking the format. |
| [LeRobotDataset v3](https://huggingface.co/docs/lerobot/lerobot-dataset-v3) | v3 standardizes high-frequency sensorimotor Parquet, episode metadata, task ids, optional video shards, streaming, and fewer/larger files. | examples often include cameras, but the tabular format supports camera-free data; it is a training format, not raw audit truth | deterministic derived training export from validated MCAP. no fabricated or empty camera channels. |
| [local VIMA repository](https://github.com/philip-chen6/vima) | the active path turns video frames into masks/depth/object-event episodic memory and cited answers; its own README calls its eval a lightweight sanity check, not a benchmark. | it requires video-bearing evidence and is not a robot policy, a calibrated world model, or proof of i2rt failure causality | evidence memory for World Context and any future external video. it may retrieve cited human-task evidence, but it must not be placed in the camera-free control/evaluation loop. |
| [ICML 2023 VIMA](https://vimalabs.github.io/) | the unrelated academic VIMA is a multimodal-prompt robot agent trained in a procedurally generated tabletop benchmark that outputs motor actions. | name collision with local VIMA | explicitly disambiguate it in docs and code. capy uses “VIMA evidence memory” to mean the local repository only. |
| local `WORLD_CONTEXT_HACKATHON_V3_PUBLIC` v3.1.1 audit, 2026-08-30 | audited package: 424 five-minute egocentric videos, 35.335 hours, 50 clip-level industrial task labels, synchronized ~200 Hz IMU, no actions/outcomes/temporal keysteps, and heavy textile concentration. | no public stable source URL in the package; not robot action data; group diversity and calibration are limited | tier 0 only: task ontology, phase hypotheses, vocabulary, human-workflow priors, and VIMA evidence corpus. it never enters the primary robot-policy treatment unless a later registered ablation earns that role. |
| [Solana payout/disbursement docs](https://docs.platform.solana.com/docs/payments/send-payouts) | official guidance describes per-recipient transfers, application-level idempotency, memo-based batch ids, modest concurrency, status persistence, and final reconciliation. | chain settlement does not validate data, attribution, identity, tax, sanctions, or disputes | treasury payout rail and public settlement proof after an offchain approval manifest. |
| [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) | Circle publishes distinct native USDC mint addresses for Solana mainnet and devnet. | wrong-network or wrong-mint payments are irreversible; test USDC has no value | hard allowlist cluster and mint. use native USDC only; no bridged lookalikes and no capy token. |
| [Solana fee abstraction](https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction) | a separate fee payer can sponsor SOL fees; production sponsorship needs wallet management, rate limits, and security controls. | sponsor abuse and account-creation rent remain operational costs | capy sponsors contributor fees from a bounded treasury; contributors should not need SOL. |

## adjacent category analogue

[HackerOne's bug-bounty product](https://www.hackerone.com/product/bug-bounty-platform) directs a qualified external community toward scoped assets, validates and prioritizes submissions, manages the report-to-remediation lifecycle, and pays useful findings. this is a stronger strategic analogue than a generic data marketplace:

```text
software vulnerability     → physical capability failure
scope + safe harbor        → embodiment + safety envelope + rights
researcher report          → experience cohort or capability artifact
triage + reproduction      → independent physical evaluation
remediation evidence       → held-out capability delta
bounty                     → guaranteed pay + bounded performance pool
```

the analogy breaks where hardware access, resets, safety, hidden state, and causal training effects make reproduction slower and more expensive. capy's opportunity is to make this transaction repeatable for physical systems; the bounty pattern itself is old.

## crowded versus differentiated

| component | status | evidence-backed judgment |
|---|---|---|
| paid distributed human collection | red ocean | Figure and Scale operate at scale; Node Data also recruits creators. |
| robot/egocentric data marketplace | red ocean | Node Data and multiple collection vendors already use the marketplace framing. |
| task quotas, deduplication, fraud review, diversity routing | incumbent feature | Figure describes all four. |
| deciding what data to collect next | occupied research/product territory | DAgger is foundational; RobotData and Scale position around targeted specifications and impact. |
| failure-triggered robot improvement | explicitly demonstrated | ABC reports large gains after DAgger intervention rounds on a hard task. capy cannot claim “collect at failure” as the invention. |
| real-robot independent evaluation | fast-forming category | RoboArena, ARC, Proving Ground, PhAIL, and other labs/vendors are converging on it. |
| provenance/licensing | table stakes | existing marketplaces advertise it; standards and legal controls matter more than a new ledger. |
| stablecoin contributor payout | commodity rail | Solana and Circle expose standard primitives. it improves cross-border programmability but is not the product. |
| exact per-episode causal payout | scientifically suspect | value depends on model/metric/cohort; acquisition cost exists before value is known. |
| failure-conditioned capability contract | potentially differentiated integration | no reviewed primary source publicly couples a buyer-funded failure specification, pre-registered hidden evaluation, matched experience procurement, cohort ablation, and contributor settlement in one contract. each component has precedent. |
| capability receipt spanning failure → data lineage → evaluation → payout | potentially differentiated protocol object | useful as an audit and market object, but novelty is unproven and copyability is high until repeated contracts create proprietary routing/effect data. |
| cross-buyer experience-yield model without centralizing raw data | plausible long-term moat | the compounding asset would be task/failure/collection/effect metadata and evaluator reliability, not raw video volume or an onchain token. this is still a hypothesis. |

## claims capy may make after one successful proof

- “on one fixed, camera-free YAM task, the registered failure-targeted cohort produced X capability gain per fully loaded collection dollar versus a matched random cohort.”
- “the result was measured on hidden, pre-registered initial-condition blocks by an evaluator who did not train the candidates.”
- “every accepted episode, training run, evaluation result, attribution decision, and native USDC payout reconciles to one versioned capability receipt.”

## claims capy may not make after one proof

- that targeted collection works across tasks, embodiments, operators, or buyers;
- that World Context caused robot-policy improvement unless a separate registered ablation shows it;
- that VIMA analyzed camera-free i2rt failures;
- that motor current is calibrated contact force;
- that simulation predicts real-robot performance without measured rank correlation;
- that a cohort bonus is exact causal value for any contributor;
- that onchain settlement makes the evaluation independent or the data trustworthy;
- that capy is already a network rather than a managed single-cell experiment.

## evidence gaps to close with buyer calls

1. who owns the collection-budget decision: research lead, data operations, deployment, or procurement?
2. is the budget approved per hour, per dataset, per milestone, or per deployed capability?
3. will a buyer expose a failing policy/checkpoint to an independent evaluator, or only run a capy harness inside its boundary?
4. which artifacts may leave the buyer: raw episodes, embeddings, failure taxonomy, aggregate scores, hashes, or nothing?
5. what is the cost of an unresolved capability gap in delayed deployment, operator interventions, and rig time?
6. does the buyer accept a performance pool, or do procurement and legal require fixed-fee work?
7. are native USDC payouts operationally useful to contributors, merely tolerable, or a compliance blocker?
