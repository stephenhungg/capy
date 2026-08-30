# evidence and decision registry

the system uses three labels everywhere:

- `sourced_claim`: a narrow factual or methodological statement backed by a linked primary/official source;
- `proposed_management_threshold`: a capy decision rule chosen to make the program falsifiable; it is not implied by the cited research;
- `design_choice`: a registered choice for this experiment, with no claim of universal optimality.

## sourced claims

| id | narrow claim | source |
|---|---|---|
| `yam-interface` | YAM is a six-degree-of-freedom manipulator with a Python SDK, MuJoCo simulation, and teleoperation support. | [i2rt YAM documentation](https://doc.i2rt.com/products/yam) |
| `i2rt-state` | the public i2rt interfaces expose measured joint state; the local simulator additionally exposes joint and gripper position, velocity, and effort. | [i2rt repository](https://github.com/i2rt-robotics/i2rt) and local inspected implementation |
| `sim-rank` | SIMPLER evaluates whether simulation preserves relative real-policy performance and argues that correlation/ranking, not simulation score alone, is the relevant validation target. | [Li et al., 2024](https://arxiv.org/abs/2405.05941) |
| `data-shapley` | classical Data Shapley defines data value through marginal utility over subsets and requires repeated training for exact evaluation. | [Ghorbani and Zou, 2019](https://proceedings.mlr.press/v97/ghorbani19c.html) |
| `attribution-instability` | retraining-based data valuation can be computationally expensive and sensitive to stochastic training; one-run methods change the attribution target rather than making every payout causally exact. | [Wang et al., 2025](https://proceedings.iclr.cc/paper_files/paper/2025/file/20fdaf67581e6d7157376d1ed584040a-Paper-Conference.pdf) |

none of these sources establishes capy's numeric decision thresholds.

## inherited proposed management thresholds

these came from the source task's `experience-network-master-research-plan-2026.md` under “proposed kill criteria.” they are reproduced in `config/experiment.json` so reports can evaluate them mechanically.

| id | proposed threshold and action |
|---|---|
| `targeted_cost_efficiency` | if targeted collection fails to improve capability gain per dollar by at least 25% over random collection across three tasks, kill the bounty-compiler claim and sell only data/evaluation tooling. |
| `sim_real_rank` | if simulation-to-real policy ranking stays below spearman 0.6 on calibrated tasks, do not use simulation outcomes for settlement. |
| `attribution_rank_stability` | if cohort rankings fall below 0.7 bootstrap rank stability across seeds, pay fixed acquisition and quality bonuses only; do not use a performance pool. |
| `world_context_lift` | if tier-0 World Context features show no measurable downstream lift, retain the corpus only for ontology/evidence work. |
| `rights_completeness` | if rights-complete collection cannot reach 95% without destroying supply economics, do not open a public contributor network. |
| `paid_repeat` | if an external robot team will not repeat a paid loop after a successful pilot, do not mistake technical novelty for a market. |

## experiment-specific proposed gates and design choices

- `0.02` is the proposed upper non-inferiority margin for absolute safety-event risk difference.
- zero catastrophic events is a proposed hard safety gate.
- `0.5%` is the allowed absolute collection-cost imbalance.
- behavioral cloning, four contact-condition strata, three training seeds, bootstrap count, labor rate, and power assumptions are design choices frozen for v1.
- the synthetic generator's effect sizes are fixtures selected to exercise pass/fail/report paths. they are not forecasts.
