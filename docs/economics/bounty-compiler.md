# bounty compiler protocol

## purpose

the compiler turns a robot failure into an immutable, falsifiable collection contract. it does not accept a prose request like “collect more grasping.” it requires enough information to decide whether an episode belongs, whether it is safe to collect, and whether the resulting policy fixed the original failure.

the prototype implementation is `compileCollectionJob` in `packages/bounty-engine/src/compiler.js`.

## compilation pipeline

1. **seal the failure evidence.** record a failure id, timestamp, evidence hash, baseline model hash, expected outcome, observed outcome, and machine-readable failing predicate. raw logs remain in the evidence store; the job carries commitments.
2. **name one capability boundary.** bind the request to an embodiment, task, success predicate, and safety envelope. a job that needs two unrelated success predicates is two jobs.
3. **compile the target distribution.** each requested axis has explicit buckets, such as object geometry, lighting, initial state, recovery phase, or operator skill. minimum episode count and maximum duration bound scope and cost.
4. **freeze acceptance before collection.** the rubric version, required modalities and annotations, exact/near-duplicate policy, quality threshold, and license are part of the job commitment.
5. **freeze evaluation before collection.** commit the metric, baseline artifact, held-out set, and minimum detectable lift. the holdout contents stay hidden from collectors and trainers.

the job id is a sha-256-derived id over canonical json. arrays that are sets are sorted by the compiler. timestamps are inputs, never generated during compilation, so the same semantic request compiles identically.

## rejection conditions

a compiler or reviewer must reject a job when:

- the failure cannot be expressed as an observable predicate;
- collection would leave the declared safety envelope;
- success can only be judged on training data;
- a modality required to establish provenance or task success is absent;
- distribution buckets are open-ended or can be chosen after results are known;
- the baseline, rubric, or holdout commitment is missing.

## active selection

the request queue should prioritize candidate situations using three separately logged terms:

```text
selection priority = uncertainty × failure relevance × coverage gap
```

uncertainty asks where the current policy is unsure, failure relevance keeps acquisition tied to the bounty predicate, and coverage gap rewards diversity rather than a pile of nearly identical hard cases. the score proposes collection; it never decides acceptance or payout. this separation prevents a collector from manufacturing high model uncertainty and getting paid for junk.

the design borrows the diversity/coverage view from [core-set active learning](https://openreview.net/forum?id=H1aIuk-RW) and the joint uncertainty/diversity view from [BADGE](https://openreview.net/forum?id=ryghZJBKPS). neither paper validates this robotics-specific acquisition function; capy must compare it against random teleoperation in preregistered experiments.
