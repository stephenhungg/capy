# governance policy

## roles and separation of duties

the prototype must assign these roles, even if one person temporarily holds more than one role:

- `job_owner`: defines the capability and requested use;
- `rights_steward`: verifies contributor and facility evidence;
- `privacy_owner`: approves minimization, redaction, retention, and high-risk assessment;
- `safety_owner`: approves physical collection and stop-work controls;
- `lineage_owner`: assures artifact and activity completeness;
- `evaluator`: executes the fixed held-out protocol;
- `evaluation_approver`: decides whether evidence supports the claim;
- `payout_operator`: executes settlement without access to unnecessary identity data;
- `incident_commander`: coordinates response; and
- `appeal_reviewer`: has no role in the disputed original decision.

the same individual must not both produce a model and solely approve its capability receipt. the payout operator must not receive raw captures. public-receipt generation must not receive identity or wallet-to-person mappings.

## jurisdiction review

jurisdiction is a property of the processing, not just the contributor. before collection, the rights steward must record:

- contributor/data-subject residence or location at collection, at country and subdivision granularity when needed;
- facility and capy establishment locations;
- collection, storage, training, evaluation, recipient, and publication locations;
- controller, processor, joint-controller, employer/contractor, and facility roles;
- data categories, recording/biometric issues, age/capacity, worker status, sector rules, export controls, and cross-border transfers;
- asserted lawful basis and special-category condition for each purpose; and
- the approved notices, contracts, transfer mechanism, rights-response deadlines, retention rules, and incident-notification matrix.

software may route rules but must not invent legal conclusions. `unknown`, conflicting facts, a new country/subdivision, minor or represented person, biometric identification, workplace monitoring, surreptitious recording, health/children/education data, public-space capture, or a new cross-border transfer must fail closed for counsel.

the first production jurisdiction matrix requires counsel. it must be versioned, reviewed at least quarterly and on material legal change, and record effective dates rather than overwriting history.

## evaluator conflicts

before accessing held-out results, each evaluator and approver must disclose:

- authorship or material involvement in the candidate model, training data, collection job, metric, or protocol;
- reporting-line, compensation, token, equity, grant, customer, vendor, or other financial interests affected by the outcome;
- close personal or household relationships with contributors, job owners, or model teams;
- prior advocacy, public commitments, disputes, or competitive interests that could impair impartiality; and
- access to contributor identity or training-cohort membership that defeats intended blinding.

the governance owner records `none`, `managed`, or `disqualifying`, with mitigation such as recusal, blinded analysis, independent replication, second approval, or protocol pre-registration. self-attestation alone cannot manage a material financial or authorship conflict. a disqualifying conflict blocks the receipt.

## disputes and appeals

capy must provide a human-accessible channel for consent, attribution, facility, license, privacy, safety, evaluation, contribution, and payout disputes. filing a good-faith dispute must not trigger retaliation or loss of undisputed payment.

on intake, capy must:

1. issue an opaque case reference and acknowledgement;
2. classify urgency and applicable jurisdiction deadlines;
3. preserve relevant evidence while minimizing new access;
4. apply interim safeguards, including use suspension, content removal, payout hold only for the disputed portion, or model restriction;
5. assign a reviewer and check conflicts;
6. give the parties a clear statement of issues and a chance to provide evidence;
7. issue a reasoned outcome with evidence references, remedies, deadlines, and appeal route; and
8. log completion and verify remediation.

target service levels, unless a shorter law or safety need applies, are acknowledgement in 3 business days, initial risk decision in 5 business days, substantive outcome in 30 calendar days, and appeal in 30 calendar days. these targets do not replace statutory deadlines.

appeals must be reviewed by someone independent of the original decision. external arbitration, class waivers, governing-law clauses, limitation periods, worker remedies, and consumer terms require jurisdiction-specific counsel and must not be hard-coded as universal rules.

## governance review

a monthly trust review should sample gate decisions, withdrawals, redaction failures, lineage gaps, evaluator mitigations, payout disclosures, deletion evidence, disputes, and incidents. material exceptions require an owner, expiry, compensating controls, and executive acceptance. permanent exceptions are prohibited.
