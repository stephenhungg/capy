# threat model and payout disputes

## defenses by attack

| attack | prevention and detection | payout consequence |
| --- | --- | --- |
| low-quality gaming | immutable rubric, raw-signal attestation, sensor checks, task replay, random audit | reject or claw back before final settlement |
| exact/near duplicates | normalized hashes, multimodal fingerprints, trajectory similarity, shared duplicate clusters | exact reject; marginal credit shared by cluster |
| sybil splitting | verified payout destination, device/operator provenance, rate limits, stake where lawful, graph clustering, one independence group per linked cluster | cohort together, concentration cap, or quarantine |
| contributor collusion | hidden seed until close, independent group clustering, balanced cohorts, canary jobs, cross-contributor similarity and timing analysis | freeze linked cohort and reserve |
| trainer/evaluator collusion | role separation, signed containers, reproducible seeds, evaluator quorum, artifact and log commitments | invalidate evaluation and rerun with a fresh holdout |
| evaluator leakage | encrypted holdout, least-privilege access, preregistration, query budget, canary scenarios, delayed coarse result release | fail leaked run; rotate holdout |
| payout-address substitution | contributor-to-address binding, signed address change, pre-execution account checks | hold affected transfer only |
| rounding/order manipulation | canonical json, bigint arithmetic, largest remainder, lexical tie break | identical input produces identical manifest |

identity clustering is a cost-raising control, not a proof that identities are independent. Douceur's [sybil attack](https://nymity.ch/sybilhunting/pdf/Douceur2002a.pdf) shows why an open system cannot get that guarantee from self-asserted identities. capy therefore limits how much identity count matters: related submissions stay in one cohort and data volume alone does not unlock performance.

repeatedly tuning against one holdout leaks information even without raw examples. the evaluator needs a query ledger, bounded disclosures, fresh final sets, and statistical controls. the reusable-holdout work by [Dwork et al.](https://pubmed.ncbi.nlm.nih.gov/26250683/) is the basis for treating adaptive reuse as a formal risk, not merely an access-control problem. v0.1 records commitments and uncertainty but does not implement a differentially private reusable holdout.

## dispute protocol

1. the engine emits an unsigned manifest and keeps the dispute reserve plus every unearned/unallocated amount in escrow.
2. a challenge window opens against a specific contribution, score component, cohort assignment, evaluation artifact, or destination address.
3. a challenger submits evidence hashes and a bond. the adjudicator sees committed raw evidence, never an editable dashboard summary.
4. deterministic calculation errors produce a replacement manifest referencing the voided id. evidence disputes require a signed ruling with reason code and adjudicator quorum.
5. uncontested transfers execute after the window. a dispute should hold the smallest affected transfer unless leakage, collusion, or protocol corruption invalidates the whole evaluation.
6. the settlement receipt records transaction signatures, final token accounts, and any failed transfer. failed address/account checks return funds to escrow; they never reroute automatically.

appeals have a fixed deadline and one independent review. no private support decision may mutate the ledger. emergency freezes are time-limited, signed, and publicly auditable.
