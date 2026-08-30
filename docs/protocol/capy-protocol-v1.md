# capy protocol 1.0

status: canonical protocol specification

protocol version: `1.0.0`

schema version: `1.0.0`

published: 2026-08-30

## 1. scope

capy is an experience network for physical intelligence. it starts with a specific, evidenced robot failure; requests experience targeted at that failure; verifies improvement on a committed held-out evaluation; attributes the improvement to eligible contributors; and settles the resulting allocation.

this document defines the five signed objects and the validation rules required to make that chain inspectable:

1. capability manifest;
2. episode cohort;
3. evaluation receipt;
4. attribution result;
5. Solana payout manifest.

capy does not define a robot middleware, log container, training dataset layout, transform system, token standard, or general-purpose identity system. implementations reuse ROS 2, MCAP, LeRobot Dataset v3, Ed25519, and SPL Token interfaces at those layers.

the words **must**, **must not**, **required**, **should**, **should not**, and **may** are normative as described by [BCP 14](https://www.rfc-editor.org/rfc/rfc8174.html).

## 2. invariants

a conforming capy network preserves these invariants:

- every accepted object is immutable, schema-valid, content-digested, signed, and linked to predecessors by both identifier and digest;
- raw robot evidence remains available as MCAP; a LeRobot v3 dataset is a derived training view, never a replacement for raw evidence;
- ROS 2 message types, topic semantics, clocks, QoS, and tf2 frames describe robot I/O rather than capy-specific equivalents;
- training data and hidden evaluation items do not overlap, and candidate builders cannot observe hidden item identities or item-level outcomes;
- rights, consent, and revocation are checked at ingest, training, evaluation, attribution, and immediately before payout;
- attribution inputs and code are pinned, allocation conserves the payout pool exactly in token base units, and rounding is declared;
- personal data, licenses, consent records, raw episodes, hidden-set contents, model artifacts, and attribution traces stay offchain;
- Solana receives only the minimum settlement facts: public addresses, token amounts, a manifest identifier memo, and transaction signatures;
- a schema-valid object is not automatically trustworthy. signature authorization, artifact retrieval, semantic validation, and external-state checks are separate required layers.

## 3. roles and trust boundaries

| role | responsibility | must not be trusted for |
| --- | --- | --- |
| capability requester | defines the failure, interfaces, collection target, and evaluation gates | hidden evaluation outcomes |
| collector | records and normalizes episodes, contributor assignments, rights, and consent | self-approving quality or evaluation |
| contributor | supplies operation, annotation, hardware, environment, simulation, or other contracted value | unilateral attribution |
| rights registry | serves current revocation state and immutable evidence | evaluation scoring |
| hidden-set custodian | commits, stores, and reveals hidden-set evidence according to policy | candidate training or attribution |
| evaluator | runs baseline and candidate under the committed protocol and signs the receipt | changing gates after seeing results |
| attributor | runs the pinned contribution method and signs conserved allocations | changing the payout pool or eligibility snapshot |
| payout authority | validates and executes the signed allocation on the named Solana cluster | creating attribution or overriding revocation |
| resolver/content store | returns objects and artifacts that match requested digests | deciding whether content is authorized |

one organization may operate multiple roles in a prototype, but production policy should separate requester, evaluator, and payout authority. role separation is an acceptance-policy property; the JSON schemas identify roles but cannot prove organizational independence.

## 4. object graph and lifecycle

```text
capability manifest
  -> episode cohort(s)
    -> candidate training
      -> evaluation receipt
        -> attribution result
          -> planned payout manifest
            -> submitted/finalized superseding payout manifest
```

edges always carry an `object_id`, `object_type`, and `object_digest`. an implementation must reject a reference if any one of those values differs from the resolved object.

objects are append-only. corrections and state transitions produce a new object with a new `object_id` and a `supersedes` reference to the prior object. a resolver must retain both objects. it must not replace bytes at an existing identifier.

for a fork where two objects supersede the same predecessor, neither child silently wins. acceptance policy must select a child based on authorized signers, issuance time, dispute state, or an explicit adjudication record outside protocol 1.0.

## 5. common envelope

all five objects use this envelope:

```json
{
  "$schema": "https://capy.network/schemas/v1/<type>.schema.json",
  "protocol_version": "1.0.0",
  "schema_version": "1.0.0",
  "object_type": "<type>",
  "object_id": "urn:uuid:<uuid>",
  "issued_at": "2026-08-30T18:00:00Z",
  "supersedes": {
    "object_id": "urn:uuid:<prior>",
    "object_type": "<type>",
    "object_digest": "sha256:<64 lowercase hex>"
  },
  "payload": {},
  "integrity": {
    "canonicalization": "RFC8785",
    "hash_algorithm": "sha-256",
    "digest_scope": "object-without-integrity-or-signatures",
    "object_digest": "sha256:<64 lowercase hex>"
  },
  "signatures": []
}
```

`supersedes` is omitted for the first revision.

### 5.1 identifiers and timestamps

`object_id` must be an absolute URI and should be a UUID URN generated according to [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html). identifiers are opaque and must not encode personal data, wallet addresses, task names, or mutable state.

timestamps use RFC 3339. publishers must emit UTC with `Z`, include seconds, and must not use an unknown local offset. schema validation accepts the broader RFC format; network acceptance narrows publication to UTC.

### 5.2 canonical digest

the object digest is computed exactly as follows:

1. parse the object as I-JSON. reject duplicate keys, unpaired Unicode surrogates, non-finite numbers, and negative zero;
2. remove the top-level `integrity` and `signatures` members. do not remove `$schema`, identifiers, versions, timestamps, `supersedes`, or `payload`;
3. serialize the remaining object with the JSON Canonicalization Scheme in [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html);
4. hash the canonical UTF-8 bytes with SHA-256 from [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final);
5. lowercase-hex encode the 32-byte digest and prefix it with `sha256:`.

protocol quantities that may exceed IEEE-754 exact integer range, including token base units, slots, byte lengths, and large counters, are decimal strings. measured values are also decimal strings so producers do not accidentally change hashes through binary floating-point serialization. bounded structural integers such as counts and `weight_ppm` remain JSON integers.

### 5.3 signatures

protocol 1.0 uses Ed25519 as specified by [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.html). first construct this signature statement:

```json
{
  "context": "capy-protocol-v1",
  "created_at": "<signature.created_at>",
  "key_id": "<signature.key_id>",
  "signed_digest": "<signature.signed_digest>"
}
```

the signature message is the RFC 8785 canonical UTF-8 encoding of that statement. this binds the key reference and claimed creation time as well as the object digest. the 64-byte signature is unpadded base64url. `signed_digest` must exactly equal `integrity.object_digest`. `key_id` must resolve through the deployment trust registry to a 32-byte Ed25519 public key and an authorization binding for the object type and actor role. a valid signature from an unauthorized key is invalid.

key rotation creates a new `key_id`; old signatures continue to verify against the historical key record. compromised or retired keys must be marked with effective timestamps in the trust registry. protocol 1.0 does not define that registry's transport.

the included examples contain syntactically valid, intentionally non-verifying signature placeholders. they are fixtures, not network-acceptable attestations.

### 5.4 versioning

`protocol_version` versions lifecycle semantics. `schema_version` versions one object's JSON contract. both use semantic versioning.

- a major version may change meaning or compatibility;
- a minor version may add optional behavior but gets a new immutable schema `$id` and an explicit compatibility profile;
- a patch version may clarify constraints without changing valid-instance meaning, but still gets a new `$id` if schema bytes change;
- published schema bytes at an existing `$id` must never change;
- a 1.0 validator must reject unknown object and schema versions unless a configured compatibility adapter validates and records the conversion.

MCAP, ROS 2, LeRobot, model, evaluator, attribution, and chain versions are pinned independently. changing one does not implicitly change the capy protocol version.

## 6. artifacts and content identity

large or sensitive content is represented by an artifact reference: URI, media type, SHA-256 digest of retrieved bytes, optional byte length, and optional encryption metadata.

an artifact consumer must:

1. authorize access before retrieval;
2. stream with a configured size limit;
3. hash the received bytes before parsing or execution;
4. compare byte length when present;
5. reject redirects to disallowed schemes or networks;
6. scan untrusted archives and executable content in isolation;
7. preserve the originally verified bytes or a storage receipt that proves durable retention.

directory artifacts such as LeRobot datasets must be packaged as a byte-addressed archive and include a logical file manifest. that manifest is a JCS object containing sorted relative paths, byte lengths, and per-file SHA-256 digests. paths must be normalized UTF-8, must not be absolute, and must not contain `..`. `normalized_dataset.dataset_revision` is the SHA-256 digest of the JCS manifest; `artifact.digest` is the digest of the archive bytes. this gives both logical dataset identity and transport-archive integrity.

artifact URIs are locations, not identities. mirrors may change the URI while retaining the same digest. credentials and signed query parameters must not be embedded in protocol objects.

## 7. robotics data profile

### 7.1 ROS 2 is the interface vocabulary

capy follows the ROS 2 split between topics for streams, services for short request/response operations, and actions for long-running cancellable operations. recorded evidence identifies concrete `.msg` types and QoS. frame relationships use tf2, including `/tf` and `/tf_static`; capy does not create a second frame graph.

continuous state, action commands, task inputs, success events, transforms, and diagnostics required to reproduce an episode must be recorded as topics. if a service or action affects an episode, its request, feedback, cancellation, and result events must also appear in the evidence log through the ROS 2 recording conventions used by that deployment.

QoS is part of the capability contract. a recorder must subscribe compatibly and document any loss. best-effort sensor data is permitted when declared; control commands, static task inputs, success events, and safety diagnostics should be reliable. static task inputs and `/tf_static` should use transient-local durability.

`time_basis` is either `system_time` or `ros_time`. when `ros_time` is used, `/clock` is required in raw evidence. producers must preserve source message timestamps and MCAP log/publish timestamps. backward time jumps split an episode; normalization must not silently reorder across a jump. clock synchronization method and measured uncertainty belong in the collection quality report.

### 7.2 MCAP is the raw evidence container

raw recordings use MCAP major version 0, ordinarily written by the ROS 2 `rosbag2_storage_mcap` plugin with CDR message encoding.

an accepted cohort must have:

- every required schema, channel, and message stream needed by the capability;
- chunk and message indices for seeking and topic-selective reads;
- CRC verification after ingest;
- a topics digest covering topic names, ROS types, serialization, QoS, and message counts;
- monotonic per-episode normalized timestamps;
- calibration, robot description, and fixture metadata as hashed external artifacts or MCAP attachments;
- no reliance on private MCAP records for required interoperable semantics.

resource-constrained capture may temporarily use rosbag2's `fastwrite` profile. before cohort issuance, the collector must post-process it into an indexed MCAP, enable integrity checks, verify the resulting file, and retain lineage from source bytes to accepted bytes. a `fastwrite` file cannot directly satisfy the cohort schema's `indexed: true` and `crc_verified: true` assertions.

### 7.3 LeRobot Dataset v3 is the normalized training view

normalized cohorts use LeRobot Dataset v3.0: frame-level tabular data in Parquet, relational episode metadata, task metadata, and optional per-camera MP4 shards. the cohort pins the producing `lerobot` package version and source revision because implementation behavior can change while the dataset format remains `v3.0`.

normalization must:

- preserve stable episode identifiers and a mapping to source MCAP message ranges;
- declare each feature key, dtype, shape, ordered dimension names, FPS, and source topic lineage;
- record the exact transform implementation and configuration as an artifact;
- derive timestamps from the declared clock and document interpolation, resampling, dropped frames, clipping, and unit conversion;
- preserve task IDs and episode boundaries through LeRobot v3 metadata rather than inferring them from filenames;
- never discard the source MCAP after producing Parquet or video.

when `use_videos` is false, no `videos/` directory, `image` or `video` dtype, or `observation.images.*` feature may exist. a capability with `visual_features_allowed: false` must reject a cohort containing any visual feature even if rights would permit it.

## 8. protocol objects

### 8.1 capability manifest

the capability manifest is the immutable job and evaluation contract. it binds:

- requester and validity window;
- embodiment, robot/fixture descriptions, controlled joint order, and tf2 frames;
- task instruction, initial conditions, machine-readable success signal, failure conditions, and duration;
- ROS 2 middleware, required MCAP channels, message encodings, QoS, and clock;
- exact LeRobot v3 features and whether vision is allowed;
- baseline policy, baseline failure evidence, failure rate, and sample size;
- collection source, minimum counts, required variations, and prohibited modalities;
- hidden-set commitment, custodian, access and reveal policy;
- metric definitions, thresholds, split rules, decision rule, and minimum trials;
- safety limits, abort topics, human stop, and allowed violations;
- rights purposes every accepted cohort must grant.

the requester must publish the manifest and hidden-set commitment before candidate collection or training begins. gates cannot be relaxed after results are observed. a changed task, embodiment joint order, observation/action feature, hidden set, metric, threshold, or safety rule requires a superseding capability and a fresh evaluation chain.

### 8.2 episode cohort

an episode cohort is an immutable selection of episodes admitted together for training and attribution. it binds:

- the exact capability revision;
- collector, collection window, acceptance status, and collection job;
- pseudonymous contributor IDs, roles, episode assignment digests, and payout eligibility;
- episode count, success count, ordered episode-ID digest, and detailed manifest;
- one or more indexed, CRC-verified MCAP recordings;
- one LeRobot v3 normalized dataset and its exact raw-recording lineage;
- quality measurements and rejected episode IDs;
- license grants, consent records, current revocation snapshot, and privacy assertions.

the detailed episode manifest is authoritative for selection. `episode_ids_digest` is the SHA-256 digest of a JCS array of episode IDs in ascending UTF-16 code-unit order. contributor assignment artifacts use the same IDs. an episode rejected by quality control must not appear in the normalized dataset or a contributor's payable assignment.

`status: accepted` means syntactic, artifact, quality, rights, and consent checks passed at issuance. `quarantined` preserves evidence but forbids new training, evaluation, attribution, or payout. `rejected` remains auditable and is not usable.

### 8.3 evaluation receipt

the evaluation receipt attests to one baseline/candidate comparison under the capability's committed evaluation protocol. it binds:

- capability, evaluator, evaluation time, exact baseline and candidate model artifacts;
- code revision, configuration, and training-run evidence for both policies;
- exact training cohorts and a rights/consent/revocation snapshot;
- hidden-set ID and commitment, custodian, access log, overlap result, sealed item results, and reveal status;
- evaluator harness, hardware, software environment, random-seed commitment, trial count, and raw MCAP logs;
- aggregate metrics, sample sizes, confidence intervals, gate results, safety result, and final decision.

the evaluator must verify the hidden-set manifest commitment before executing the first trial. baseline and candidate must use the same committed trial items and scoring code. ordering should be randomized or counterbalanced, and the random seed must be committed before unblinding outcomes.

hidden-set contents, raw hidden logs, and item-level results remain encrypted for the custodian. the public receipt exposes commitments and aggregate metrics only. `candidate_access` and `training_overlap_detected` must both be false for a passing receipt.

a receipt may document a failed or disputed evaluation, but it cannot authorize attribution unless `decision.passed` and `safety.passed` are true and every training cohort is eligible at the evaluation cutoff.

### 8.4 attribution result

the attribution result turns a passing evaluation into a deterministic, conserved allocation. it binds:

- the exact evaluation receipt and input cohorts;
- attributor and calculation time;
- method name, semantic version, executable implementation, score semantics, negative-score policy, and randomness commitment;
- contributor/cohort/role allocations, raw scores, integer millionth weights, token base-unit amounts, and eligibility snapshots;
- asset, mint, decimals, pool amount, rounding, and conservation totals;
- input snapshot, counterfactual results, and calculation trace.

protocol 1.0 does not claim one attribution method is universally causal. the governing capability program or collection contract must select the method before evaluation. `contract_defined` is permitted only when the executable artifact and human-readable score semantics are both pinned.

attribution conformance requires:

- every input cohort appears in the passing receipt's training lineage;
- every allocation names a contributor declared by that cohort;
- ineligible allocations have zero weight and zero amount;
- eligible `weight_ppm` values sum to exactly `1,000,000`;
- allocation amounts plus unallocated remainder equal the payout pool exactly;
- the chosen rounding policy is deterministic;
- the revocation registry is rechecked after evaluation and before signing attribution.

for largest-remainder rounding, compute each exact rational share in base units, floor all shares, then distribute remaining units by descending fractional remainder. ties break by ascending `allocation_id` using raw UTF-8 byte order.

### 8.5 Solana payout manifest

the Solana payout manifest is a signed offchain instruction plan and settlement record. it binds:

- exact attribution result;
- payout authority;
- cluster name, genesis hash, and RPC reference;
- token symbol, mint, decimals, and Token Program;
- treasury owner and source token account;
- recipient owner/token accounts, attribution allocation IDs, and base-unit amounts;
- transaction batches using SPL Token `TransferChecked` and the SPL Memo program;
- finalized commitment, preflight rules, idempotency behavior, settlement state, and observed transactions;
- the explicit list of facts permitted onchain.

the planned manifest is immutable. its memo must be `capy:payout:<planned object_id>`. submitted, finalized, failed, or cancelled state is represented by a new payout manifest that supersedes the planned object and retains its transaction plan and memo. finalized transaction evidence therefore points back to the original intent even though the settlement record has a new object ID.

before signing or submitting a batch, the executor must:

1. resolve and verify the complete chain through the capability;
2. require a passing evaluation and conserved attribution;
3. recheck current rights, consent, disputes, and revocations;
4. query the cluster genesis hash and compare it to the manifest;
5. fetch the mint and verify decimals and owning Token Program;
6. verify treasury authority, balance, and source token account mint;
7. verify each recipient token account exists and matches recipient owner, mint, and Token Program, or create it only under an explicit separately authorized policy;
8. verify every allocation appears once, every amount matches attribution, and totals match;
9. reserve each transfer in an idempotency ledger before submission;
10. simulate/preflight the exact signed transaction.

each batch includes `TransferChecked` instructions and one memo. a Solana transaction is atomic within the batch; multiple batches are not atomic together. retries must contain only unsettled batches. the idempotency key is `(genesis_hash, mint, planned_manifest_id, transfer_id)`. a memo is observable evidence, not duplicate-payment enforcement.

settlement is complete only when every batch is returned by a trusted RPC at `finalized` commitment, has no execution error, contains the expected memo and transfer instructions, and produces the expected token balance deltas. RPC responses must be verified against at least one independent endpoint for production payouts.

protocol 1.0 uses standard SPL Token and Memo programs and no capy onchain program. that keeps chain state small but means duplicate prevention, multi-batch coordination, revocation gating, and manifest authorization remain offchain.

## 9. hidden evaluation protocol

the custodian creates a secret manifest containing:

- set ID and version;
- a fresh 32-byte random commitment nonce;
- stable opaque item IDs;
- hashed reset state, fixture/environment configuration, randomization seed, scorer configuration, and expected observation/action contract for each item;
- creation time and authorizing custodian key.

the commitment is `sha256:` plus SHA-256 of the RFC 8785 canonical manifest. including an unpredictable nonce prevents dictionary attacks against a small set of fixture configurations. the nonce and manifest remain sealed.

before candidate training, the custodian signs an access log entry proving creation and no candidate-builder access. at evaluation, the custodian recomputes the commitment, checks every item against the manifest, and records all reads. the evaluator checks overlap using episode IDs, source artifact digests, reset-state hashes, fixture hashes, and randomization-seed hashes. a detected overlap fails the evaluation; removing the overlapping items after observing outcomes is not allowed.

aggregate public metrics must use the full committed set unless the capability predeclares a deterministic exclusion rule. any excluded trial, retry, hardware fault, or scorer failure is preserved in the sealed item results and summarized publicly.

`never` reveal means item identities remain sealed indefinitely. `dispute_only` allows access only under the governing dispute policy. `after_program_close` permits release only after collection, training, evaluation, attribution, and payout challenges have closed. a reveal creates a new public artifact; it does not mutate prior commitments.

## 10. rights, consent, and revocation

rights and consent are separate:

- a rights grant states what the licensor permits the grantee to do with an episode cohort, including purpose, commercial use, derivatives, sublicensing, validity, territory, and restrictions;
- a consent record states what a human or property controller agreed could be captured and processed, how to withdraw, and when consent expires;
- a privacy declaration states what was actually captured;
- a revocation registry states current changes to those permissions.

the raw signed license and consent records remain encrypted offchain. protocol objects expose pseudonymous actors, scope, timestamps, and artifact digests. collectors must not put names, email addresses, employment IDs, free-form consent text, or withdrawal reasons into public objects.

revocation is checked at five gates:

| gate | required action when revoked or disputed |
| --- | --- |
| cohort ingest | reject or quarantine affected episodes |
| training start | exclude affected episodes and rebuild the dataset revision |
| evaluation start | stop; retrain without affected data or resolve the dispute |
| attribution | mark affected allocations ineligible and recompute all weights and amounts |
| payout preflight | stop unsettled transfers and issue a superseding attribution/payout chain |

an event's declared effect controls handling:

- `quarantine`: block all new use pending review;
- `stop_future_use`: stop new processing from `effective_at`; prior use is handled by the governing contract;
- `delete_offchain_artifacts`: delete or cryptographically erase accessible offchain copies and derived caches where legally and technically permitted, while retaining a minimal non-personal audit tombstone;
- `contract_defined_remediation`: follow the hashed governing terms and record the outcome externally.

revocation cannot rewrite an immutable audit object, reverse a finalized blockchain transfer, prove model unlearning, or erase data already obtained by an unauthorized party. if a trained model incorporated later-revoked data, the deployment must quarantine the model until the governing terms determine retraining, machine unlearning evidence, distribution withdrawal, or other remediation. protocol 1.0 records that decision but does not pretend the technical problem is solved.

## 11. offchain/onchain boundary

| data | location | reason |
| --- | --- | --- |
| signed protocol JSON and schema | offchain, content-addressed | rich validation and versioning |
| MCAP raw logs and attachments | encrypted offchain | volume, confidentiality, replay |
| LeRobot v3 datasets | encrypted offchain | training access and revocation controls |
| licenses and consent records | encrypted offchain | personal/legal data |
| revocation registry and snapshots | offchain | mutable current status plus immutable evidence |
| hidden manifests, access logs, item results | sealed offchain | prevent evaluation leakage |
| models, code, configurations, traces | offchain | size and reproducibility |
| attribution calculations | offchain | method complexity and auditability |
| wallet/token accounts and transfer amounts | Solana | settlement |
| planned manifest object ID | Solana memo log | public reconciliation handle |
| transaction signature and slot | Solana and finalized payout object | settlement proof |

only hashes and opaque identifiers cross boundaries. a hash may still enable correlation or disclosure when the input space is small, which is why hidden-set manifests include a random nonce and personal records are encrypted rather than merely hashed.

## 12. conformance

an implementation must perform all relevant layers. passing an earlier layer does not waive a later one.

### 12.1 schema layer

- parse strict JSON and validate against the exact JSON Schema draft 2020-12 `$id`;
- enable format assertion for URI and date-time;
- reject unknown properties, unknown enums, and unsupported versions;
- validate the schema itself against the draft 2020-12 metaschema.

### 12.2 integrity and authorization layer

- recompute the RFC 8785/SHA-256 object digest;
- require every signature's `signed_digest` to match;
- resolve historical keys and verify Ed25519 signatures over the defined message;
- require an authorized signer for the object type and role;
- reject revoked keys according to the signature creation time and trust policy.

### 12.3 graph layer

- resolve every object reference by ID and digest;
- reject cycles and type mismatches;
- require the expected lifecycle ordering;
- retain superseded revisions and detect forks.

### 12.4 artifact layer

- fetch with limits, hash before use, compare media type and byte length, and isolate parsing;
- validate MCAP structure, schemas, channels, indices, CRCs, and required message coverage;
- validate the LeRobot v3 logical manifest, feature schema, episode mapping, and raw lineage;
- verify models, code, configurations, and sealed evidence are available under the retention policy.

### 12.5 semantic layer

- compare cohort counts/features/embodiment/rights to capability requirements;
- recheck hidden commitments, split isolation, metric arithmetic, gates, and decision;
- require attribution input lineage, contributor membership, eligibility, exact weights, rounding, and base-unit conservation;
- require payout transfer/allocation equality, cluster and token checks, complete batching, and idempotency.

### 12.6 external-state layer

- query current rights, consent expiry, disputes, revocations, key status, artifact retention, and Solana state;
- record the snapshot digest and time used for each decision;
- fail closed when a required registry, artifact, evaluator, or RPC result is unavailable.

the repository validator covers schema validity, example validation, object digests, example reference integrity, camera-free constraints, hidden-set commitment continuity, attribution conservation, and payout equality. it intentionally does not verify placeholder signatures, retrieve artifacts, adjudicate rights, run a robot, or query recipient accounts.

## 13. minimum storage and resolver behavior

a conforming object store should provide atomic create-if-absent semantics keyed by `object_id` and index by `object_digest`, `object_type`, predecessor digest, actor, and issuance time. submitting different bytes for an existing ID is a conflict, never an update.

the minimum acceptance transaction is:

1. receive bytes with a strict size limit;
2. parse and validate schema;
3. verify digest and signatures;
4. resolve references and validate semantic prerequisites;
5. atomically persist original bytes, canonical bytes, verification report, and acceptance-policy version;
6. emit an append-only acceptance event.

transport is intentionally unspecified. HTTP, object storage, a message bus, or a peer protocol may carry the same signed bytes. transport authentication does not replace object signatures.

## 14. security and privacy considerations

### 14.1 untrusted content

all objects, artifacts, ROS messages, MCAP attachments, Parquet files, archives, model weights, WASM, and Python code are untrusted. validators need byte, nesting, array, decompression, and execution limits. executable attribution or normalization artifacts must run without ambient credentials or unrestricted network/file access.

### 14.2 replay and equivocation

immutable IDs, content digests, validity windows, supersession, cluster genesis hashes, and payout idempotency keys limit replay. they do not stop an authorized signer from issuing conflicting objects. stores must surface forks and acceptance policy must not silently choose the newest timestamp.

### 14.3 hidden-set leakage

commitments prove consistency, not secrecy or correct execution. custodian access controls, process isolation, audit logs, encrypted artifacts, blinded execution, and organizational separation are still required. repeated evaluation against the same set can overfit through aggregate feedback; capability programs should limit attempts and rotate hidden sets with a superseding manifest.

### 14.4 data poisoning and contribution gaming

signed provenance does not make episodes useful. quality checks, duplicate/near-duplicate detection, cross-cohort contamination tests, policy-independent task signals, and counterfactual attribution are required. contributor identity and payout eligibility need sybil controls outside protocol 1.0.

### 14.5 physical safety

capy receipts are evidence, not machinery safety certification. robot-native limits, watchdogs, emergency stops, supervised rollouts, workspace exclusion, and hardware risk assessment remain mandatory. an evaluation that improves success but violates a safety gate fails.

### 14.6 telemetry privacy

camera-free data can still identify an operator through timing, motion style, device serials, network metadata, or rare task patterns. pseudonymize actors, strip hostnames and serials, minimize retained topics, encrypt raw logs, separate identity mapping, and apply access and retention policies.

### 14.7 settlement

base58 syntax does not prove account ownership or token semantics. executors must inspect onchain accounts. compromised payout keys, malicious RPCs, wrong clusters, counterfeit mints, closed token accounts, insufficient funds, and duplicate retries are explicit threats. mainnet deployment requires hardware-backed keys or multisig policy, independent RPC confirmation, spend limits, and human review above a configured threshold.

## 15. camera-free I2RT YAM example

the linked fixture chain under [`examples/`](./examples/) models a right-arm I2RT YAM pressing a guarded button with:

- six arm joints plus a linear gripper;
- ROS 2 joint state/effort, target pose, switch, tf2, command, and diagnostic topics;
- indexed MCAP raw evidence written through rosbag2;
- LeRobot v3 Parquet features with `use_videos: false` and no visual feature keys;
- 120 teleoperated episodes, explicit operator and fixture-provider rights, consent, and revocation snapshots;
- a 40-trial sealed evaluation improving success from `0.35` to `0.75` with zero candidate safety violations;
- deterministic 75/25 contributor attribution of a 100 USDC devnet pool;
- a planned SPL Token `TransferChecked` batch using Circle's devnet USDC mint and an SPL Memo reconciliation ID.

artifact locations, actors, keys, model hashes, and recipient accounts are synthetic. the devnet genesis hash and Circle-published devnet USDC mint are real identifiers used to make the boundary concrete. no example transaction is submitted.

## 16. decisions

1. raw evidence is MCAP, normalized training data is LeRobot v3, and live semantics are ROS 2. capy only defines the cross-system contract.
2. protocol objects are immutable signed JSON; SHA-256 over RFC 8785 canonical bytes binds content while references bind the graph.
3. object ID and digest are separate to avoid a self-hash cycle and to support supersession.
4. hidden evaluation publishes a pre-training salted commitment, access evidence, and aggregates; item contents stay sealed.
5. rights, consent, capture facts, and revocation are distinct fields and are rechecked throughout the lifecycle.
6. attribution method is program-selected and executable, not hardcoded as one allegedly universal causal formula.
7. token quantities use integer base-unit strings and millionth weights so accounting is exact and portable.
8. protocol 1.0 uses standard SPL Token and Memo instructions with an offchain idempotency ledger instead of a new Solana program.
9. settlement facts are public; personal, legal, robotics, evaluation, and model data stay offchain.
10. published schemas are strict and immutable. behavioral evolution uses explicit versions and superseding objects.

## 17. known risks

- contribution scores can be gamed and may not identify true causal value, especially across interacting cohorts;
- a later revocation may require retraining or model withdrawal, and practical unlearning remains unresolved;
- a hidden-set custodian can leak, substitute execution, or collude even when the published commitment is correct;
- repeated aggregate evaluation can leak enough signal to overfit a fixed hidden set;
- high-rate robot telemetry can fingerprint humans despite having no camera or audio;
- ROS 2 distribution, message package, MCAP writer, and LeRobot implementation drift can change derived bytes or timing;
- artifact storage loss breaks auditability even though object hashes remain;
- standard SPL transfers cannot enforce capy authorization or prevent duplicate payment onchain; protocol 1.0 relies on operational controls;
- rights, consent, employment, tax, sanctions, and payout rules vary by jurisdiction and need governing terms outside this technical protocol;
- the fixture signatures prove wire shape only; interoperability tests still need a published trust root and real cryptographic vectors.

## 18. next implementation slice

the next slice should be one narrow, executable loop rather than a general marketplace:

1. build `capy verify` to perform strict parsing, JSON Schema validation, RFC 8785 hashing, Ed25519 verification, graph resolution, and semantic checks with machine-readable error codes;
2. add an immutable local object/artifact store with create-if-absent IDs, digest indexing, supersession/fork detection, and revocation snapshots;
3. implement MCAP ingest validation plus one deterministic MCAP-to-LeRobot-v3 transform for the camera-free YAM feature contract;
4. implement a sealed evaluator runner that verifies the precommitted set, runs paired baseline/candidate trials, and emits the evaluation receipt;
5. implement the deterministic example attribution method and conservation checks;
6. implement a devnet-only payout executor with account preflight, dry-run simulation, idempotency ledger, Memo plus `TransferChecked`, and finalized reconciliation;
7. run the whole chain first against MuJoCo YAM plus a simulated switch, then repeat on one supervised physical YAM station.

the slice is done when a clean checkout can ingest one MCAP cohort, reproduce the LeRobot dataset revision, train or load the two pinned policies, evaluate against a sealed fixture set, reproduce attribution byte-for-byte, simulate and optionally execute the devnet payout, and verify the resulting superseding finalized manifest without manual JSON edits.

## 19. primary references

all sources were checked on 2026-08-30.

- [MCAP format specification](https://mcap.dev/spec)
- [MCAP format registry](https://mcap.dev/spec/registry)
- [ROS 2 interfaces: topics, services, and actions](https://docs.ros.org/en/ros2_documentation/rolling/Concepts/Basic/Interfaces-Topics-Services-Actions.html)
- [ROS 2 QoS settings](https://docs.ros.org/en/humble/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ROS 2 clock and time design](https://design.ros2.org/articles/clock_and_time.html)
- [ROS 2 tf2 concepts](https://docs.ros.org/en/galactic/Concepts/About-Tf2.html)
- [rosbag2 MCAP storage plugin](https://docs.ros.org/en/ros2_packages/kilted/api/rosbag2_storage_mcap/)
- [LeRobot Dataset v3.0](https://huggingface.co/docs/lerobot/lerobot-dataset-v3)
- [LeRobot Dataset v3 source](https://github.com/huggingface/lerobot/blob/main/docs/source/lerobot-dataset-v3.mdx)
- [I2RT Python API and YAM examples](https://github.com/i2rt-robotics/i2rt)
- [MuJoCo Menagerie I2RT YAM model](https://github.com/google-deepmind/mujoco_menagerie/tree/main/i2rt_yam)
- [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
- [FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [RFC 8032: Ed25519 and Ed448](https://www.rfc-editor.org/rfc/rfc8032.html)
- [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html)
- [Solana SPL Token basics](https://solana.com/docs/tokens/basics)
- [Solana SPL Memo program](https://www.solana-program.com/docs/memo)
- [Solana `getTransaction` RPC](https://solana.com/docs/rpc/http/gettransaction)
- [Solana `getSignatureStatuses` RPC](https://solana.com/docs/rpc/http/getsignaturestatuses)
- [Circle USDC contract and mint addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
