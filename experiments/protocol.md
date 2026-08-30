# protocol: camera-free fixed-geometry YAM experiment

protocol id: `capy-yam-fixed-insertion-v1`

status: pre-hardware analysis scaffold

## question and estimand

at the same accepted collection cost, does failure-targeted teleoperation yield more held-out real-robot success-rate gain than random valid teleoperation?

the primary estimand is:

```text
(targeted held-out real success - baseline held-out real success) / targeted dollars
-------------------------------------------------------------------------------
(random held-out real success - baseline held-out real success) / random dollars
```

the analysis pools three pre-registered training seeds within each strategy. uncertainty comes from a failure-mode-stratified paired bootstrap over held-out scenario blocks. report the descriptive ratio, both numerator gains and their intervals, denominators, raw trial counts, and the interval for `targeted gain/$ - 1.25 * random gain/$`. do not report a truncated ratio interval when the random-gain denominator approaches or crosses zero.

## task and hardware boundary

one YAM follower arm moves a keyed peg from a fixed holder into a mechanically guided fixture. the robot base, holder, fixture, peg geometry, controller gains, calibration, and reset jig stay fixed. a reset card selects one of four pre-measured, bounded contact conditions without introducing an unobserved object pose:

- nominal;
- lateral approach offset;
- high-friction guide sleeve;
- compliance-edge contact.

there are no rgb, depth, or other camera inputs. policy observations are synchronized `joint_pos`, `joint_vel`, `joint_eff`, `gripper_pos`, `gripper_vel`, `gripper_eff`, controller state, and a forward-kinematic end-effector pose derived from the frozen calibration. capture must also add commanded joint/gripper targets; the current i2rt recorder should not be assumed to contain those commands.

success is a latched fixture switch plus final joint/gripper bounds, confirmed by a blinded human label. disagreements are adjudicated without showing policy or cohort identity. the fixture switch and manual label are both retained.

## baseline selection before treatment

candidate checkpoints are produced from the same base dataset. a candidate is eligible only if it:

1. uses the registered observation/action schema and policy family;
2. completed the registered compute budget;
3. has zero catastrophic events in the visible validation set;
4. stays at or below the visible-validation safety-event ceiling;
5. has no access to collection assignments or held-out scenario ids.

among eligible candidates, select the highest visible-validation success rate; break ties lexicographically by immutable policy id. freeze its weights, code hash, data hash, and selection table before cohort collection. `baseline_candidates.csv` makes this rule executable and the analyzer fails if the configured baseline is not the rule's result.

the first implementation uses a small proprioceptive behavioral-cloning policy because it can be trained identically across cohorts and does not require cameras. this is a design choice, not a claim that behavioral cloning is the best policy family.

## collection randomization and equal cost

collection uses blocked randomization before the first episode. within every operator-by-session block, an offline seeded permutation assigns equal slots to:

- `random`: valid full-task demonstrations sampled uniformly across the registered condition envelope, with no failure brief;
- `targeted`: full-task demonstrations allocated equally across failure strata identified from the frozen baseline's visible diagnostic rollouts.

operators can see the collection instruction but never the held-out scenario ids. contributors can participate in both strategies; assignment order, operator, session, and failure stratum remain in the export.

cost is frozen as accepted operator minutes multiplied by one registered loaded labor rate. rejected or aborted attempts consume budget and remain in the audit log; replacements are allowed only until both strategies hit the smaller of the same dollar cap and time cap. the confirmatory cohort uses equal accepted episodes and equal total dollars. any cost mismatch beyond the configured tolerance invalidates the primary ratio.

## training isolation

every strategy candidate starts from the frozen baseline initialization and adds only its assigned cohort. policy family, base data, optimizer, steps, batch construction, augmentations, compute cap, and training seed list are identical. dataset manifests, code, container, and output checkpoints are hashed.

the registered seeds are configuration, not seeds chosen after results are observed. failed training runs remain failures; they cannot be silently replaced.

## prospective power

the scaffold uses a one-sided normal approximation for the equal-cost linear contrast `(targeted - baseline) - 1.25 * (random - baseline)` as a planning calculation. all assumptions are explicit: alpha, desired power, and baseline/random/targeted success under the alternative. the generated report prints the required trials per policy and checks the actual held-out count.

this approximation aligns with the primary management contrast but assumes independent binomial policy proportions. it is not a substitute for simulation-based power under the final blocked design. before hardware collection, update assumptions using pilot variance and scenario correlation, rerun the calculation, and freeze the result. the inherited “30 or more trials” planning note is not treated as statistical justification.

## hidden real evaluation

the real evaluation manifest is generated and sealed before training. scenario identifiers and exact reset-card order are withheld from collectors and trainers. each serious policy receives the powered number of trials in the same failure-mode blocks. within every block, seeded randomization sets policy execution order. operators see only an opaque policy id; outcome reviewers see neither policy nor cohort.

record success, completion time, intervention, protective stop, limit violation, contact-force proxy breach, and catastrophic event. the aggregate safety flag must reconcile with its component flags. exclusions are limited to pre-registered infrastructure failures that occur before policy control; every excluded full-policy block records `policy_control_started=0`, an incident timestamp, an allowed reason, and one same-condition replacement block. excluded rows must have zero completion time and zero post-control outcome, intervention, and safety fields.

## simulation and settlement boundary

simulation receives a broader version of the same condition matrix. its role is candidate screening and regression discovery. report spearman rank correlation between per-policy simulated and real success. simulation may not drive payout settlement unless the proposed correlation gate passes on calibrated tasks. real held-out trials remain ground truth for this experiment.

## safety guardrail

for each strategy, compare the held-out real rate of any non-catastrophic safety event against baseline and report a paired-bootstrap risk-difference interval. a strategy fails safety if the interval's upper bound exceeds the proposed non-inferiority margin or if any catastrophic event occurs. success improvement never overrides this guardrail.

## attribution stability

the first settlement unit is the randomized cohort, not an individual episode. for every registered training seed, the analyzer directly bootstrap resamples held-out real trial blocks and estimates each cohort's marginal gain from those outcomes. rank stability is the fraction of seed-bootstrap replicates whose cohort ordering matches the consensus ordering. report the full score distribution and the probability each cohort ranks first; do not accept an externally supplied attribution score table.

this is a payout-sensitivity diagnostic, not exact causal credit. if stability misses the inherited gate, only acquisition and quality pay are permitted.

## observed-data capture contract

an observed dataset must include a hashed `capture_manifest.json` whose `data_origin` is `observed`. it freezes task and protocol ids, fixture geometry, robot calibration, reset procedure, controller, zero camera streams, the commanded-action stream, and required measured proprioceptive signals. the registration command refuses to relabel the committed synthetic manifest as observed.

## confirmatory decisions

- a first-task `provisional_pass` means the point estimate reaches `1.25x`, primary gains are positive, the registered planning sample size is met, cost balance is valid, and safety passes.
- a first-task `provisional_fail` means one or more of those conditions fail.
- neither outcome fires the inherited bounty-compiler kill criterion until the same registered mechanism is evaluated across three tasks.
- source-task kill criteria unrelated to this dataset are displayed as `not_evaluated`, never silently dropped.
