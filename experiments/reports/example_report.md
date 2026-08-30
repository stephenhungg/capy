# capy experiment report

| field | value |
|---|---|
| protocol | `capy-yam-fixed-insertion-v1` |
| task | `yam-keyed-peg-fixed-fixture-v1` |
| data class | `synthetic` |
| decision | `synthetic_fixture_only` |
| first-task signal | `provisional_pass` |

> warning: every number below is synthetic pipeline-fixture output. it is not hardware evidence and must not be quoted as capy performance.

## primary endpoint

| metric | estimate | stratified paired-bootstrap 95% interval |
|---|---:|---:|
| random absolute gain over baseline | 11.2% | 1.7% to 20.2% |
| targeted absolute gain over baseline | 23.1% | 14.2% to 31.9% |
| targeted/random gain per dollar | 2.056x | not reported; bootstrap denominator crosses or approaches zero |
| gain/$1k contrast above the 1.25x gate | 6.9% | 1.6% to 12.4% |

baseline held-out real success was 46.2%. both cohorts cost $1320.00; measured cost imbalance was 0.0%.
each cohort includes 132 paid attempts: 120 accepted and 12 rejected or aborted. all attempt cost is in the denominator.

the inherited `1.25x` threshold is a proposed management gate, not a sourced scientific constant. its full criterion requires three tasks, so this one-task result remains `not_evaluated` even when the first-task signal passes.

## prospective power and held-out real trials

the configured equal-cost gain-contrast approximation requires 127 trials per policy for the registered assumptions. this fixture has 160 randomized, hidden real-domain trials per policy across 160 paired scenario blocks. this aligns the planning contrast with the 1.25x gate, but final power must be updated with hardware block correlation.

| policy | cohort | seed | successes/trials | success rate |
|---|---|---:|---:|---:|
| `baseline_bc_003` | baseline | 0 | 74/160 | 46.2% |
| `random_bc_104729` | random | 104729 | 97/160 | 60.6% |
| `random_bc_130363` | random | 130363 | 95/160 | 59.4% |
| `random_bc_155921` | random | 155921 | 84/160 | 52.5% |
| `targeted_bc_104729` | targeted | 104729 | 110/160 | 68.8% |
| `targeted_bc_130363` | targeted | 130363 | 108/160 | 67.5% |
| `targeted_bc_155921` | targeted | 155921 | 115/160 | 71.9% |

## simulation-to-real ranking

spearman rank correlation across 7 policies is `0.821` with a trial-bootstrap interval of `0.559` to `0.964`. the proposed settlement gate is `0.600`; seven related policies can be dominated by between-cohort separation, and passing the synthetic fixture does not validate a simulator.

## safety regressions

| cohort | risk difference vs baseline | paired-bootstrap 95% interval | catastrophic events | guardrail |
|---|---:|---:|---:|---|
| random | -2.3% | -5.4% to 0.2% | 0 | pass |
| targeted | -2.7% | -5.6% to -0.4% | 0 | pass |

| cohort | component | baseline rate | candidate rate |
|---|---|---:|---:|
| random | protective_stop | 0.6% | 0.0% |
| random | limit_violation | 1.9% | 0.6% |
| random | contact_force_proxy_breach | 0.6% | 0.2% |
| targeted | protective_stop | 0.6% | 0.0% |
| targeted | limit_violation | 1.9% | 0.2% |
| targeted | contact_force_proxy_breach | 0.6% | 0.2% |

the `2 percentage point` upper risk-difference margin and zero-catastrophe rule are proposed management thresholds.

## bootstrap attribution stability

consensus ordering is `targeted > random`. ordering stability across 6000 training-seed/bootstrap replicates is `0.952` against the proposed `0.700` performance-pool gate.

| cohort | mean marginal gain | 95% interval | probability ranked first |
|---|---:|---:|---:|
| random | 11.3% | -1.3% to 23.8% | 4.8% |
| targeted | 23.1% | 11.9% to 34.4% | 95.2% |

this is cohort-level payout sensitivity, not exact causal credit for a person or episode.

## sourced claims

these narrow claims are tagged `sourced_claim`; none supplies a numeric capy gate.

| id | claim | primary or official source |
|---|---|---|
| `yam-interface` | YAM is a six-degree-of-freedom manipulator with Python SDK, MuJoCo simulation, and teleoperation support. | [i2rt YAM documentation](https://doc.i2rt.com/products/yam) |
| `i2rt-state` | The public i2rt interfaces expose measured joint state; the inspected simulator exposes joint and gripper position, velocity, and effort. | [i2rt repository](https://github.com/i2rt-robotics/i2rt) |
| `sim-rank` | Simulation-based robot-policy evaluation should be validated against relative real-policy performance rather than treated as an oracle. | [Li et al., Evaluating Real-World Robot Manipulation Policies in Simulation](https://arxiv.org/abs/2405.05941) |
| `data-shapley` | Data Shapley values data through marginal utility over subsets and exact evaluation requires repeated model training. | [Ghorbani and Zou, Data Shapley](https://proceedings.mlr.press/v97/ghorbani19c.html) |
| `attribution-instability` | Retraining-based data valuation can be expensive and sensitive to stochastic training. | [Wang et al., Data Shapley in One Training Run](https://proceedings.iclr.cc/paper_files/paper/2025/file/20fdaf67581e6d7157376d1ed584040a-Paper-Conference.pdf) |

## decision registry

every numeric gate below is explicitly labeled `proposed_management_threshold`.

| id | threshold | scope | status | action on failure |
|---|---:|---|---|---|
| `targeted_cost_efficiency` | `>= 1.25` | across_three_tasks | `not_evaluated` | kill bounty-compiler claim; sell data/evaluation tooling only |
| `sim_real_rank` | `>= 0.6` | calibrated_tasks | `synthetic_fixture_pass` | do not use simulation outcomes for settlement |
| `attribution_rank_stability` | `>= 0.7` | across_training_seeds_and_bootstrap_samples | `synthetic_fixture_pass` | pay acquisition and quality only; disable performance pool |
| `world_context_lift` | `> 0.0` | separate_ablation | `not_evaluated` | retain corpus only for ontology/evidence work |
| `rights_completeness` | `>= 0.95` | public_network_supply | `not_evaluated` | do not open a public contributor network |
| `paid_repeat` | `== True` | post_pilot_market_test | `not_evaluated` | do not claim market validation |
| `safety_noninferiority` | `<= 0.02` | held_out_real_trials | `synthetic_fixture_pass` | reject candidate regardless of success lift |
| `catastrophic_safety` | `== 0` | held_out_real_trials | `synthetic_fixture_pass` | stop evaluation and reject candidate |

## provenance and limitations

| artifact | sha256 |
|---|---|
| config | `50186e55d184712cb7408d0394d73935801c72359dcb4a98e8ae44e333c90715` |
| metadata | `050cde36f86e66fd274a62c0ddd6357dac84302d040c976e229019b549b7a9eb` |

- synthetic results are pipeline fixtures and cannot support a product or scientific claim
- binary fixture success does not capture every trajectory-quality dimension
- the normal-approximation power calculation ignores final hardware block correlation
- sim-to-real rank uses seven related policies and may be dominated by between-cohort separation
- cohort rank stability is not exact per-episode causal attribution

method and hardware facts with primary/official links are maintained separately in `experiments/claims_and_thresholds.md`; no cited work is presented as the source of capy's numeric gates.
