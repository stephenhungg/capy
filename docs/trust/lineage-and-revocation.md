# lineage and revocation policy

## one graph, multiple evidence layers

capy models lineage as entities, activities, agents, and typed relations, compatible with the core shape of W3C PROV. the graph must cover:

```text
raw capture
  -> redacted/normalized episode
  -> data cohort + immutable membership manifest
  -> training run
  -> model checkpoint
  -> held-out evaluation
  -> capability receipt
  -> contribution calculation
  -> settlement proof
```

every entity must have an opaque id, artifact type, creation time, content digest or a documented reason one cannot be computed, storage classification, rights and retention references, and current availability state. every activity must record inputs and outputs, responsible service or person reference, code/configuration/environment digests, start/end times, and an outcome.

training records must additionally include dataset/cohort versions, split manifests, random seeds where meaningful, base-model identity and license, code revision, dependency or container digest, hyperparameter artifact digest, output checkpoint digest, rights gate decision, and any privacy or safety transforms. secrets and raw personal data belong in referenced restricted records, never in the lineage graph.

evaluation records must identify the fixed protocol, held-out cohort, simulator/hardware configuration, metric implementation, raw result digest, evaluator disclosure, and independence decision. training and evaluation cohorts must not overlap unless the protocol explicitly permits and reports it.

## capability receipt rule

a capability receipt may claim only what its referenced evidence supports. its trust section should contain opaque references and digests for:

- the capability specification and failure evidence;
- accepted data cohort manifests and effective rights decisions;
- training activity and produced model;
- held-out evaluation activity, results, and evaluator-conflict decision;
- contribution calculation; and
- payout reference and optional Solana transaction signature.

the receipt must surface later status changes such as a revoked input, superseded evaluation, disputed contribution, retired model, or reversed settlement. immutable copies remain historical evidence and must not be presented as current authorization.

## provenance integrity

lineage events are append-only. corrections create superseding events. canonicalized records should be hashed before signing; keys must have scoped signing authority, rotation, and revocation procedures. an append-only log or transparency service can improve detection of rewriting but does not prove that an input claim was truthful.

C2PA Content Credentials may bind media assets to signed capture/edit assertions and ingredient chains. they are useful evidence for asset integrity and edit history. they do not establish contributor consent, facility authority, lawful basis, ownership, a valid license, dataset membership, model training influence, or truth. capy therefore stores any C2PA manifest reference and validation result alongside, never instead of, rights records.

## revocation before training

on receipt of a credible withdrawal, rights objection, facility revocation, license termination, or dispute, capy must immediately:

1. create a `revocation` record and suspend matching uses;
2. resolve the requested scope against lineage;
3. quarantine affected raw assets, derivatives, and unstarted cohorts;
4. cancel queued activities whose authorization no longer passes;
5. delete or retain under legal hold according to the approved decision; and
6. notify processors or recipients that received the affected material.

no new training, evaluation, release, or publication may start while scope is unresolved.

## revocation after training

withdrawal is effective for future processing but does not magically reverse completed computation. capy must not tell contributors that deleting a file guarantees removal of learned influence from a checkpoint. instead, the revocation owner must create an impact assessment for each descendant model or output and choose a recorded disposition:

- `unaffected`: supported by evidence that the item was not used;
- `restricted`: freeze new distribution/deployment while assessment continues;
- `unlearn`: run a defined removal method and evaluate residual influence;
- `retrain`: rebuild without affected inputs and compare behavior;
- `retire`: stop deployment and distribution;
- `continue_by_exception`: only when a documented legal basis permits it, risks are accepted by authorized governance, and counsel approves; or
- `unable_to_remediate`: escalate, disclose the limitation to the requester, and block expansion of use.

the decision must consider legal obligations, technical feasibility, contribution weight, memorization or extraction risk, model distribution, downstream recipients, safety impact of withdrawal, and whether a less harmful substitute exists. unlearning claims require a named method, test protocol, thresholds, and residual-risk result; file deletion alone is not unlearning.

public ledgers, already-delivered artifacts, and third-party copies may be impossible for capy to erase. capy must stop its own future disclosure, request downstream action where contractually available, retain proof of the request, and explain limits precisely.

earned payment is not clawed back merely because a contributor later withdraws. fraud, duplicate contribution, sanctions, court orders, or payment error follow separate counsel-approved dispute and recovery rules.
