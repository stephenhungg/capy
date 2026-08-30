# schema contract

## format and versioning

schemas use JSON Schema draft 2020-12. version `1` identifiers are logical compatibility identifiers under `https://capy.network/schemas/trust/v1/`; capy must publish or permanently redirect those identifiers before external interchange.

records include `schemaVersion`, a typed opaque id, `recordedAt`, and `supersedes` where revision is allowed. immutable events are corrected by a new event, never overwritten. unknown properties are rejected to keep authorization inputs explicit.

ids use a type prefix plus a base64url-style random body, such as `ctr_2fH8mYwQ0gVxR9nP6aKd3B`. the prefix aids operations but must not encode identity, location, wallet, or sequence. id generation requires at least 128 bits of cryptographic randomness.

content digests use lowercase hex. implementations should canonicalize JSON with RFC 8785 before hashing or signing. the schema validates shape, not canonicalization, signature validity, chronology, cross-record referential integrity, authorization semantics, or legal sufficiency.

## schema inventory

- `common.schema.json`: shared ids, digests, evidence, jurisdictions, actors, decisions, and restrictions.
- `use-policy.schema.json`: purpose and action scope, prohibitions, recipients, territory, and expiry.
- `contributor-rights.schema.json`: notice, granular grants, lawful-basis review, licensing, sensitive-data flags, and withdrawal route.
- `facility-permission.schema.json`: authority, zones, modalities, safety, bystanders, third-party materials, and restrictions.
- `jurisdiction-assessment.schema.json`: processing locations and roles, risk flags, purpose-specific legal decisions, transfer routes, deadlines, and counsel approval.
- `license.schema.json`: rights-holder authority, license text/identifier, actions, territory, recipients, reservations, and termination.
- `redaction.schema.json`: review state, detected categories, transforms, verification, and derivative hash.
- `lineage.schema.json`: W3C PROV-shaped entity/activity graph for data, training, models, evaluation, receipts, and settlement.
- `revocation.schema.json`: request, immediate suspension, descendant impact, post-training disposition, notification, and closure.
- `dispute.schema.json`: intake, interim safeguards, review, outcome, remedy, and appeal.
- `evaluator-conflict.schema.json`: disclosures, decision, mitigation, and independent approval.
- `wallet-binding.schema.json`: restricted contributor-to-wallet binding, control verification, and disclosure acknowledgement.
- `payout.schema.json`: private mapping boundary, public settlement proof, disclosure, and mitigation record.
- `retention.schema.json`: purpose, trigger, deadlines, legal holds, disposal method, and evidence.
- `incident.schema.json`: incident scope, containment, notification decisions, recovery, and corrective actions.
- `trust-gate.schema.json`: fail-closed decision for collection, training, evaluation, publication, payout, or receipt issuance.

## integration rules beyond schema validation

the authorization service must perform these checks transactionally:

1. resolve the newest non-superseded records and verify signatures/digests;
2. verify every reference exists and the referenced type matches;
3. evaluate time, territory, actor/recipient, action, purpose, artifact type, license, and prohibitions;
4. ensure facility permission covers the collection context;
5. require accepted redaction and no unresolved revocation, dispute hold, incident block, or legal hold conflict;
6. traverse lineage for descendants and inherited restrictions;
7. require an evaluator-conflict decision for capability approval;
8. write the full input-version set into the gate decision; and
9. deny on missing, unknown, expired, unverifiable, or contradictory evidence.

schema-valid does not mean authorized. authorization tests need fixtures for boundary times, supersession, partial withdrawal, mixed-jurisdiction cohorts, license incompatibility, prohibited purpose, tainted descendant models, conflicted evaluators, and public/private payout joins.

database/application constraints must additionally enforce id and non-null payout-reference uniqueness, event chronology, `minimumDays <= maximumDays`, computed deletion deadlines, redaction `measuredScore >= acceptanceThreshold`, record supersession without cycles, entity/activity reference existence, acyclic derivation where required, cohort membership integrity, gate expiry, and a conflict decision-maker who is a different person from the evaluator. they must also parse SPDX expressions against the recorded SPDX License List version, validate decoded Solana address/reference lengths as 32 bytes and signatures as 64 bytes, verify token-account ownership and mint on the intended cluster, verify signatures, enforce append-only events, and make payout submission idempotent. these cannot be expressed completely in portable JSON Schema.

an `allow` gate requires the complete gate-specific evidence and named check set. a `deny` gate may intentionally retain a partial evidence set so that the system can record the earliest fail-closed decision without pretending missing evidence exists. every check's `evidenceRef` must resolve to the evidence snapshot or other immutable decision input that actually supports the result.

## validation

from the repository root:

```sh
npm install
npm run validate:trust
```

the validator compiles every schema against the draft 2020-12 meta-schema, resolves local references by `$id`, requires at least one accepted fixture for every instantiable schema under `examples/valid`, and requires every fixture under `examples/invalid` to fail its declared schema. fixtures prove contract behavior only; any Solana addresses in them are synthetic and must not be treated as verified accounts or payment instructions.
