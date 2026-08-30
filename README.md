# capy

capy is the experience network for physical intelligence.

robots fail in specific ways. capy turns those failures into targeted data requests, verifies whether the resulting experience improves a policy, and pays the contributors responsible for the improvement.

## how it works

```text
robot failure
  -> capability specification
  -> targeted human, robot, or simulated experience
  -> policy training
  -> held-out simulation and real-robot evaluation
  -> capability receipt
  -> contributor payout in USDC on Solana
```

## the core object

a capability receipt connects:

- the robot failure and supporting evidence;
- the requested capability and evaluation protocol;
- the data cohorts and their usage rights;
- the model, training lineage, and held-out results;
- the contribution calculation and Solana settlement proof.

## current research stack

- `VIMA` for evidence memory, object events, and failure localization;
- `i2rt YAM` for teleoperation, embodiment-grounded collection, and real evaluation;
- `MCAP` for synchronized raw robot logs;
- `LeRobot Dataset v3` for normalized training data;
- simulation for cheap breadth and real hardware for ground truth;
- native `USDC` on Solana for contributor payouts.

## status

capy is at the research and closed-loop prototype stage. the first falsifiable claim is that failure-targeted collection can produce more verified capability gain per dollar than random teleoperation.

the immediate milestone is one inspectable loop: one failure, one targeted collection job, one trained candidate, one held-out capability improvement, and one reconciled Solana payout.
