# mainnet-readiness checklist

mainnet mint validation and dry-run planning exist, but `submissionEnabled` is false for `mainnet-beta`. do not flip it until every gate below has an owner and evidence.

## custody and approvals

- [ ] replace local key files with an audited hsm/mpc/multisig adapter
- [ ] require independent manifest approval and signer quorum
- [ ] decode and display the final compiled message to approvers, including mint, source, every recipient ata, amount, fee payer, compute budget, and memo
- [ ] enforce per-payout, per-manifest, daily, and treasury-balance limits outside operator-controlled cli flags
- [ ] document key rotation, signer loss, emergency pause, and compromise response

## idempotency and data

- [ ] move state to durable transactional storage with unique constraints on manifest hash, batch id, and signature
- [ ] add a reviewed recovery workflow for `failed` and `expired_unknown`, requiring two independent archival rpc checks
- [ ] store capability-receipt attachment records atomically with finalized settlement state
- [ ] back up and restore journals in a disaster-recovery exercise
- [ ] define retention and access controls for wallet linkage and payout records

## rpc and transaction delivery

- [ ] use at least two production rpc vendors; solana says public endpoints are not for production
- [ ] verify genesis, latest blockhash, balances, simulation, submission, and history across independent providers
- [ ] add adaptive priority-fee policy with a hard lamport ceiling and observability
- [ ] load-test batching, rate limits, retries, and finalization latency with mainnet-shaped devnet traffic
- [ ] alert on rpc disagreement, simulation drift, failed batches, expiry, sponsor balance, and low treasury balance

## correctness and security

- [ ] run local-validator or litesvm integration tests against the exact released dependencies
- [ ] test missing/existing atas, sponsor separation, frozen accounts, insufficient balances, stale blockhashes, duplicate submissions, rpc timeouts, and process crashes at every journal boundary
- [ ] commission external review of manifest validation, instruction construction, custody adapter, and recovery process
- [ ] pin builds with provenance, dependency review, lockfile integrity, secret scanning, and reproducible release artifacts
- [ ] verify circle's current mainnet mint from an independent release-time source and require a code review for allowlist changes
- [ ] exercise privacy, accounting, tax, compliance, and incident-response procedures

## rollout

- [ ] ship a mainnet read-only/reconcile phase first
- [ ] canary with a capped treasury and known internal recipients
- [ ] require manual post-settlement token-balance and receipt verification for early batches
- [ ] define rollback as disabling new manifests; never attempt to reverse an irreversible finalized transfer automatically
