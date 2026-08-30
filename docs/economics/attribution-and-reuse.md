# cohort attribution and reuse dividends

## pool model

one funded bounty is split in basis points that sum to 10,000:

- **acceptance pool:** pays for accepted, rights-cleared supply using quality/scarcity weights;
- **performance pool:** pays only for preregistered held-out improvement;
- **reuse pool:** pays lineage participants under a declared reuse event;
- **dispute reserve:** remains in escrow until the challenge window closes.

all token amounts are unsigned 64-bit-compatible decimal strings. pool and contributor rounding uses deterministic largest remainder allocation with lexical ids as the final tie breaker.

## held-out lift

the aggregate gate uses a conservative lower bound:

```text
lower_bound_lift_bps = max(0, candidate_score - baseline_score - uncertainty)
```

if the lower bound is below `minimumLiftBps`, none of the performance pool is earned. otherwise:

```text
earned_performance = performance_pool
  × min(lower_bound_lift_bps, targetLiftBps)
  / targetLiftBps
```

the floor division remainder stays in escrow. safety regressions and preregistered guardrail failures should override the scalar metric and fail the gate before this calculator runs.

## who shares performance

train the registered full candidate and the preregistered leave-one-cohort-out candidates using identical code, compute budgets, seeds, and evaluation protocol. for each cohort:

```text
cohort_lower_bound_lift = max(0, full_score - without_cohort_score - uncertainty)
```

the earned performance pool is split across positive-lift cohorts by that value, then within a cohort by acceptance weights. negative values are zeroed rather than charged to contributors. if every cohort value is zero, the earned amount remains unallocated in escrow.

this is deliberately **cohort-level evidence**, not exact per-clip causality. correlated data, optimizer randomness, interactions among cohorts, and alternate training paths violate that interpretation. Data Shapley gives a principled performance-dependent valuation for fixed datasets ([Ghorbani and Zou, 2019](https://proceedings.mlr.press/v97/ghorbani19c.html)), while distributional Shapley improves stability outside one fixed sample ([Ghorbani, Kim, and Zou, 2020](https://proceedings.mlr.press/v119/ghorbani20a.html)). exact or approximate clip Shapley is not part of v0.1: it is costly, sensitive to the declared learner and metric, and could present noisy estimates as ground truth. randomized cohorts are the auditable unit capy can currently defend.

## reuse dividends

a reuse dividend is a contract rule over verified lineage, not a retroactive assertion that one clip caused a later model improvement.

each future training or licensing event declares a reuse pool and a lineage snapshot before evaluation. eligible prior contributions receive `reuseCreditBps` from the event policy:

- 10,000 for material inclusion in the training mixture;
- a lower preregistered value for distillation, replay selection, or licensed availability;
- zero for evaluation-only access, rejected data, or data outside the granted license.

the prototype weight is `accepted_units × reuse_credit_bps`. a future version should allocate first across source cohorts and then within cohorts, enforce per-event and lifetime caps, and publish the lineage receipt. identical or derivative datasets share one lineage node, preventing copy-and-reimport loops from multiplying dividends.

reuse payouts require a new signed manifest. the old manifest is immutable; no executor silently changes a settled transfer.
