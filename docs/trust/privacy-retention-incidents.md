# privacy, retention, and incident policy

## data separation

capy uses opaque random references across trust records. the following stores must be logically separated with least-privilege access and independent audit logs:

1. identity/contact and age/capacity evidence;
2. rights notices, signatures, and facility proof;
3. raw quarantined captures;
4. redacted/normalized data and lineage;
5. evaluation data and results;
6. wallet-to-person, tax, sanctions, and payment operations;
7. public capability receipts and settlement proofs; and
8. disputes, legal holds, and incidents.

opaque references must be generated with at least 128 bits of randomness. they must not be a wallet hash, email hash, contributor id plus timestamp, sequential database key, or other guessable/deterministic value. mapping tables must be encrypted, access-scoped, and excluded from analytics and logs. hashing a small or knowable identifier is pseudonymization, not anonymization.

## Solana wallet privacy

ordinary native USDC transfers on Solana are public. transaction data exposes account participation; token balance metadata can expose mint, owner, and pre/post amounts. a transaction signature makes the transfer easy to retrieve. anyone who learns that an address belongs to a contributor may correlate its USDC transfers, balances, counterparties, timing, and repeated use. a shared capy treasury also makes other likely payouts easier to cluster.

before wallet enrollment, capy must plainly disclose that:

- capy cannot erase or redact a confirmed public transaction;
- a new address reduces direct reuse but does not guarantee anonymity because funding, withdrawals, exchange records, device/network data, and behavioral patterns can relink it;
- omitting a memo prevents one extra label but does not hide addresses or amount;
- publishing a capability receipt with a transaction signature creates a direct public join to the settlement; and
- native USDC on Solana does not become private because capy stores its internal mapping securely.

the default design is:

- generate a random `payout_ref` unrelated to contributor, job, cohort, wallet, or amount;
- keep `{payout_ref -> contributor_ref -> destination address}` only in the restricted payment vault;
- place no contributor, job, capability, email, invoice, or `payout_ref` in a public memo;
- keep public receipts to a settlement status or transaction signature only when needed, with the contributor's separate disclosure choice and a warning that the signature exposes the on-chain transfer;
- never publish the private mapping, address, amount, or explorer URL in a dataset or model lineage record; and
- rotate treasury operational accounts where useful for security and accounting, while never marketing rotation as anonymity.

if a payment integration cannot operate without a public Solana Pay-style reference, capy must generate a fresh cryptographically random 32-byte value for that payout attempt and keep the mapping restricted. the reference must never be reused across a retry, contributor, batch, or environment. deterministic recovery is a last resort: use a versioned, domain-separated `HMAC-SHA-256` over an already-random internal attempt id with a rotatable secret, publish all 32 output bytes, and treat the result as pseudonymous and publicly searchable. never use an unkeyed hash or encrypt personal data into durable chain data.

optional mitigations require legal, tax, sanctions, custody, accessibility, and threat-model review:

- let contributors provide a dedicated address and teach them its limited protection;
- offer a regulated off-chain payout, custodial balance, bank payout, or processor so a contributor is not forced onto a public ledger;
- aggregate one contributor's earned amount over a disclosed settlement window where payment-timing law permits; do not put multiple contributors in one transaction when co-recipient linkage is a material risk, because batching makes their accounts and amounts co-visible;
- minimize distinctive amounts and timing only when this does not change earned compensation or create deceptive records;
- use separate transactions and, if justified, rotating treasury accounts only as weak correlation reduction; a common funding/sweep graph can relink them;
- evaluate Solana privacy tools or Token-2022 confidential balances for a separately supported asset. confidential balances can hide amounts while accounts and participation remain public, and this does not imply compatibility with native USDC;
- use an institution-operated private channel only after assessing operator trust, withdrawal visibility, availability, and regulatory obligations.

capy must not use mixers, false memos, nominee addresses, transaction splitting to evade reporting, or claims of anonymity. privacy mitigations must never obstruct sanctions, tax, labor, consumer, or financial compliance.

the settlement database must enforce uniqueness for non-null provider transfer ids, transaction signatures, and public references. after an ambiguous submission, the payout worker must poll the provider and chain before creating a new attempt; retries must not create duplicate payment. base58 shape checks in JSON Schema are not enough: application code must decode Solana addresses/references to 32 bytes and transaction signatures to 64 bytes, verify the destination token account's owner and native-USDC mint, and keep integer amounts in base units.

## retention

every stored object must resolve to a `retention` record at creation. the production schedule requires counsel approval. until then, these are conservative prototype ceilings, shortened where deletion is safe:

| data class | trigger and prototype ceiling | notes |
| --- | --- | --- |
| rejected or withdrawn raw capture | 30 days after closure | immediate access block; legal hold can pause deletion |
| accepted raw identifiable capture | 90 days after redacted derivative verification | extension needs recorded necessity and privacy approval |
| redacted/normalized episode | intended-use expiry plus 12 months | review descendants before deletion |
| transient redaction work files | 7 days after verification | automated purge |
| rights and facility evidence | last authorized use plus 7 years | provisional; counsel must set by jurisdiction/claim period |
| lineage, gate, and deletion evidence | artifact life plus 7 years | must exclude raw personal data |
| evaluation results | model life plus 3 years | held-out raw data follows its own schedule |
| wallet mapping | relationship end plus 7 years | provisional financial/tax rule; segregated |
| disputes and incidents | closure plus 7 years | provisional; preserve only necessary evidence |
| ordinary backups | 35 days | deletion propagates by expiry; no restore to active use |

the retention engine must compute `delete_at`, emit reminders, prevent unapproved extension, suspend deletion under a scoped legal hold, delete replicas and derived caches, and create non-sensitive deletion evidence. cryptographic erasure is acceptable only when keys are unique to the deletion scope and backup/replica behavior is verified.

## incident response

an incident includes unauthorized access or disclosure, rights-gate bypass, collection without permission, redaction failure, lineage corruption, false provenance, use after withdrawal, model memorization/extraction concern, evaluator conflict, payout-address exposure, incorrect settlement linkage, retention failure, or physical safety/privacy harm.

capy follows the `govern/identify/protect/detect/respond/recover` structure of NIST CSF 2.0 and the lifecycle recommendations of NIST SP 800-61 rev. 3. the on-call responder must:

1. open an `incident` record, preserve evidence, and assign severity;
2. contain access and stop affected collection, training, evaluation, publication, or payout joins;
3. identify affected people, facilities, assets, datasets, models, receipts, processors, wallets, and jurisdictions using lineage;
4. notify the incident commander, privacy owner, security owner, safety owner, and counsel as applicable;
5. have counsel determine regulatory, contractual, insurer, law-enforcement, facility, contributor, and public notification duties and clocks;
6. communicate verified facts without exposing more personal or security-sensitive data;
7. eradicate the cause, recover from known-good state, validate restored rights gates and lineage, and monitor recurrence;
8. issue corrective actions, owner, due date, and effectiveness check; and
9. close only after required notifications, remediation, and retrospective review are evidenced.

severity `sev0` covers ongoing threat to life or catastrophic widespread compromise; `sev1` covers likely material harm, active sensitive-data exposure, or widespread unauthorized model/data use; `sev2` covers contained material control failure; `sev3` covers limited low-impact failure; `sev4` is a near miss. severity does not determine legal notification by itself.

notification deadlines vary and can begin before facts are complete. no universal number belongs in code. the incident record therefore requires a jurisdiction-specific deadline register and counsel decision whenever personal data, protected rights, financial data, physical safety, or regulated parties may be involved.
