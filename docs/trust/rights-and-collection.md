# rights and collection policy

## separate evidence, separate decisions

every collection job must carry the following independent records:

- a `use-policy` defining exact actions, purposes, recipients, artifact classes, territories, and prohibited uses;
- a `contributor-rights` record for each contributor or represented data subject;
- a `facility-permission` record for every controlled facility, device, or third-party environment;
- a `trust-gate` decision authorizing collection; and
- after capture, a redaction decision and an authorization gate for each downstream action.

a contributor cannot grant rights they do not hold. a facility operator cannot consent for people in the scene. a copyright license does not establish a data-protection lawful basis. payment does not create consent. a C2PA signature does not prove any of these facts.

## contributor consent and notice

before collection, capy must present a versioned, hash-bound notice in a language and format the contributor can reasonably understand. the interface must:

1. name the controller or responsible operator and a contact channel;
2. describe each data modality, including video, audio, telemetry, robot state, approximate location, and any biometric or sensitive inferences;
3. offer separate affirmative choices for collection, training, evaluation, internal research, external sharing, publication, and promotional display;
4. identify the intended robot capabilities and foreseeable downstream model uses in concrete language;
5. list prohibited uses, recipients or recipient classes, territory, duration, and whether commercial use is allowed;
6. explain redaction limits, residual re-identification risk, retention, withdrawal, post-training revocation limits, dispute and appeal routes, and incident contact;
7. explain compensation independently from optional uses, and avoid making unnecessary processing a condition of payment or access;
8. disclose public-ledger consequences before a Solana wallet is linked; and
9. record the affirmative action, timestamp, notice version and digest, authorization evidence, and consent receipt delivery.

silence, inactivity, pre-checked boxes, bundled acceptance, or merely entering a facility are not consent. a grant must be as easy to withdraw as it was to give. if a power imbalance, employment relationship, incapacity, minority, or material language/accessibility barrier makes consent questionable, the record must be quarantined for counsel review.

capy must not collect biometric templates or use captures for unique identification unless the job explicitly requires it and counsel has approved the jurisdiction-specific notice, written consent, retention/destruction policy, security, and alternative path. ordinary video can still be personal or biometric information even when no template is intentionally created.

## contributor rights state

the authoritative rights record is append-only by version. corrections, renewed grants, and withdrawals create a new version referencing the prior one. operational state is computed from the newest valid event:

```text
draft -> active -> suspended -> active
                  -> withdrawn
                  -> expired
                  -> superseded
```

`active` means the evidence passed the recorded jurisdiction review; it does not mean every possible use is allowed. authorization always evaluates the requested action against the active granular grant.

## facility permission

facility permission must be signed or otherwise verifiably approved by a party whose authority was checked. it must identify:

- the facility and permitted zones using opaque references, not public addresses;
- permitted dates, equipment, robot embodiments, sensors, network access, and personnel;
- recording modalities and whether bystanders, displays, documents, voices, faces, badges, license plates, or confidential processes may appear;
- safety prerequisites, supervision, stop-work authority, and incident contacts;
- ownership and licensing of facility-provided data, calibration files, maps, and other materials;
- required redaction, publication restrictions, confidentiality, export-control or sector constraints; and
- a revocation and emergency shutdown route.

facility permission must not be reused across sites, materially different sensors, or purposes. if bystander consent cannot be obtained, collection must use exclusion zones, framing, real-time masking, sensor minimization, or be rejected. a post-capture blur is not always enough because raw footage was already processed.

## intended-use enforcement

all consumers must ask the authorization service with `{subject, action, purpose, actor, artifact, time, jurisdiction}`. the service must default to deny and return a decision record with the rights version, facility version, use-policy version, applicable restrictions, and explanation codes.

minimum action vocabulary:

- `collect`, `store`, `redact`, `normalize`;
- `train`, `fine_tune`, `evaluate`, `safety_test`;
- `share_internal`, `share_processor`, `share_third_party`;
- `publish_dataset`, `publish_media`, `publish_metrics`;
- `commercialize`, `derive`, `retain`, and `delete`.

new purposes, model classes, recipient classes, public release, or materially new safety risks require a new grant or another documented lawful basis approved by counsel. purpose labels such as "research" or "improve ai" are too broad to authorize use.

## quarantine and redaction

new captures begin as `unreviewed` in an isolated quarantine store. only a redaction worker may read raw content before acceptance. the worker records transformations and content hashes without putting sensitive values into logs.

allowed states are:

- `unreviewed`: no downstream use;
- `in_review`: access limited to named review purpose;
- `redacted`: required transforms completed and verified;
- `clear`: reviewed and no required transform found;
- `quarantined`: unresolved rights, privacy, safety, or integrity issue;
- `rejected`: use prohibited; deletion workflow started; or
- `tombstoned`: content deleted while minimal non-sensitive audit evidence remains.

redaction must be modality-aware. transforms may include face or badge masking, voice removal or transformation, text/display masking, spatial cropping, precise-location coarsening, metadata stripping, telemetry field suppression, and segment deletion. every derivative receives a new hash and lineage edge; the original is never silently overwritten. automated redaction must be sampled and measured against a job-specific acceptance threshold, with human review for high-risk or low-confidence material.

## licensing

each asset and cohort must record copyright, database, contractual, trade-secret, publicity/personality, and open-source or open-data constraints separately. use an SPDX identifier or expression only when it accurately names the license. custom terms require a stable URI plus a digest of the exact text.

`unknown`, missing metadata, online availability, possession, or a C2PA author assertion are not licenses. no default repository, dataset, or model license is implied. incompatible or unclear terms fail closed. counsel must approve:

- contributor and facility ownership language;
- work-made-for-hire or assignment clauses;
- database-right and text/data-mining reservations;
- publicity, voice, likeness, and moral-right treatment;
- sublicensing and model-output terms; and
- any conclusion that training is permitted without an express license.
