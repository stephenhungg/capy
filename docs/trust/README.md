# capy trust control plane

status: implementation design, version `0.1.0`, reviewed 2026-08-30.

this directory defines the minimum rights, privacy, provenance, and governance controls for capy's closed-loop prototype. these are proposed requirements, not a claim that the controls are deployed or that capy complies with every law.

## non-negotiable invariants

1. no collection starts without an active contributor rights record and, when collection occurs at a controlled site, active facility permission.
2. no asset enters a training, evaluation, publication, or payout calculation unless the requested action is allowed by a specific intended-use grant.
3. consent, facility authority, copyright or database rights, data-protection lawful basis, and provenance are independent checks. one never proves another.
4. raw identity, contact, government-id, tax, and wallet-to-person mappings stay outside capability receipts, datasets, model artifacts, C2PA manifests, logs, and public ledgers.
5. every accepted asset, dataset build, training run, model, evaluation, capability receipt, revocation, and settlement is connected by content-addressed lineage.
6. revocation stops future use immediately while capy assesses already-trained outputs. capy never promises that revocation automatically removes learned influence or erases an immutable ledger.
7. an evaluator with an unmanaged conflict cannot approve a capability receipt.
8. a public Solana transfer exposes transaction participants and, for ordinary native USDC transfers, token and amount relationships. capy must say this before wallet enrollment.
9. retention has an owner, purpose, event trigger, computed deletion date, and deletion evidence. "keep forever" is not a valid default.
10. legal, safety, rights, or security uncertainty fails closed into quarantine.

## control flow

```text
job proposed
  -> jurisdiction and intended-use review
  -> contributor notice + granular rights grants
  -> facility permission + safety authorization
  -> collection into quarantine
  -> redaction and rights verification
  -> accepted data cohort
  -> training lineage + output restrictions
  -> independent evaluation + conflict decision
  -> capability receipt
  -> private payout mapping
  -> public Solana settlement proof (with explicit disclosure)
```

the executable gate states are defined in [`trust-gate.schema.json`](../../schemas/trust/trust-gate.schema.json). a gate is an authorization decision over referenced evidence, not a substitute for that evidence.

## documents

- [rights and collection](rights-and-collection.md): contributor consent, facility permission, intended use, redaction, and licensing.
- [lineage and revocation](lineage-and-revocation.md): dataset/model lineage, post-training revocation, and capability receipt integrity.
- [governance](governance.md): jurisdiction review, disputes, evaluator conflicts, and decision authority.
- [privacy, retention, and incidents](privacy-retention-incidents.md): data separation, wallet privacy, retention, and incident response.
- [standards and regulatory map](standards-map.md): primary sources, mappings, limits, and counsel gates.
- [schema contract](schema-contract.md): identifiers, validation, state transitions, and integration rules.

## authority and language

`must` and `must not` describe capy's proposed control-plane behavior. `should` describes a default that may be changed by a recorded risk decision. `may` describes an option. these documents are engineering requirements, not legal advice.

before production collection, qualified counsel must approve the jurisdiction matrix, contributor agreement and notices, facility forms, licensing posture, biometric/recording analysis, worker classification and compensation terms, tax and sanctions flow, retention schedule, cross-border transfer mechanisms, dispute terms, and incident-notification matrix.
