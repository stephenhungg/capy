# acceptance, scarcity, and cohorts

## submission state machine

```text
uploaded -> quarantined -> accepted -> cohort-locked -> evaluated -> payable
                    \-> rejected
                    \-> disputed -> accepted or rejected
```

an accepted episode needs verified provenance, collection rights, all required synchronized modalities, a passing task-integrity score, and no evaluator leakage. exact duplicates are rejected. near duplicates are quarantined for cluster review.

## quality and scarcity are different

quality is a weighted integer score from 0 to 10,000. a job-specific rubric can include sensor health, synchronization, annotation agreement, safety compliance, and whether the intended transition actually occurred. all component values and weights are retained; only the deterministic weighted result reaches the payout engine.

scarcity is also 0 to 10,000, but measures supply relative to the committed target distribution. a suitable first formula is:

```text
bucket scarcity = clamp(target accepted count / max(current accepted count, 1), floor, cap)
```

the production scorer should compute it from the acceptance ledger at a declared cutoff and then freeze it. scarcity cannot rescue data below the quality threshold. once a bucket fills, later interchangeable episodes get a lower scarcity score. an operator cannot choose their own bucket; an independent classifier plus spot audit assigns it.

the acceptance-pool weight used by the prototype is:

```text
accepted_units × quality_bps × scarcity_bps
```

integer multiplication preserves ranking without floating-point drift. it is a procurement weight, not a claim about causal model value.

## duplicate handling

three layers are required:

- exact content hashes reject byte-identical normalized episodes;
- modality-specific fingerprints cluster near-identical video, state trajectories, action traces, timestamps, and simulation seeds;
- semantic review catches rerenders, time shifts, crops, and coordinated recollection of the same underlying event.

all members of a duplicate cluster share one `independenceGroupId`. accepted marginal variants may split the cluster's fixed credit; creating more files cannot increase its total scarcity. fingerprint sampling is motivated by Broder's primary work on [resemblance and containment](https://www.cs.princeton.edu/courses/archive/spring13/cos598C/broder97resemblance.pdf), but robot episodes need trajectory- and sensor-aware fingerprints rather than document shingles alone.

## randomized cohorts

`constructCohorts` assigns independence groups, not clips, so one operator/device/duplicate/collusion cluster never lands on both sides of an ablation. before collection closes, governance publishes `hash(seed || nonce)`; after closure it reveals the seed. the protocol hash, reveal, accepted ledger root, and assignment output are retained.

the prototype sorts groups by a sha-256 pseudorandom key and greedily chooses the cohort that minimizes the sum of squared projected stratum loads. hash-based tie breakers make assignment reproducible. this yields practical covariate balance but is not a proof of statistical equivalence. production evaluation must publish balance diagnostics, minimum group counts, and rerandomization criteria before revealing outcomes.

cohorts should be large enough that one contributor cannot dominate them. when that is impossible, capy should merge cohorts, cap concentration, or decline performance attribution instead of emitting a deceptively precise payout.
