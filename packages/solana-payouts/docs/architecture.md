# architecture

this package is the first capy contributor settlement rail. it transfers circle-issued native usdc with the original spl token program; it never creates a mint, wraps a token, bridges an asset, or accepts an arbitrary mint.

## flow

1. parse a strict `capy.payout-manifest.v1` document. unknown fields are rejected, amounts must have exactly six decimals, ids must be unique, and the declared total must equal the base-unit sum.
2. require the manifest network and mint to match the compiled allowlist. mainnet dry-runs are supported, but mainnet submission is intentionally disabled.
3. derive the treasury and recipient associated token accounts from the original token program. off-curve recipients are rejected pending a separately reviewed custody flow.
4. build `createassociatedtokenidempotent` plus `transferchecked` for every payout. the fee payer funds missing atas and may differ from the treasury authority.
5. add one non-sensitive batch memo. it contains a truncated manifest hash and batch id, never a contributor name, email, job id, capability id, or individual payout id.
6. add payouts until the compiled legacy transaction would exceed 1,232 bytes, 64 accounts, or the operator's lower batch cap. hash the final plan so changing batching, signer roles, source account, or priority-fee policy cannot reuse an existing journal.
7. before submission, verify rpc cluster identity against solana's official endpoint, inspect the mint and source token account, check usdc and sol balances, simulate, and set the compute limit to consumed units plus ten percent.
8. sign the final bytes, atomically persist them with their expected signature, and only then submit. retries resend those exact bytes.
9. reconcile every signature with transaction history. a missing signature after blockhash expiry becomes `expired_unknown` and cannot be silently rebuilt.

transactions are atomic per batch, not across the full manifest. the settlement output maps each opaque payout id to its batch signature for attachment to a capability receipt.

## privacy boundary

the manifest schema permits only opaque ids, recipient public keys, and amounts. contributor identity, contact information, capability evidence, tax data, sanctions review, contracts, and contribution calculations belong in capy's access-controlled offchain systems. wallet addresses and amounts are public once paid; do not pretend otherwise.

the write-ahead journal is also offchain and links opaque payout ids to public transaction signatures. it is created with mode `0600` and should live on encrypted storage with the same retention policy as settlement records.

## integration boundaries

- `PayoutRpc` isolates rpc access and is mockable.
- `StateStore` isolates the write-ahead journal. a production implementation can use a transactional database with a uniqueness constraint on manifest hash and batch id.
- the current cli's local keypair loader is devnet-only and requires mode `0600`. it is not a production custody solution.
- multisig, mpc, hsm, remote sponsor, and squads integrations should replace `KeyPairSigner` at the execution boundary. the planner already accepts a distinct treasury authority, source token account, and fee payer. an adapter must preserve the exact planned message, return all required signatures, and journal the fully signed bytes before broadcast.
- an spl-token multisig needs a dedicated instruction adapter because `transferchecked` must include its signer accounts. it must not be approximated by handing the cli multiple key files.

## idempotency guarantee

the guarantee is process-level exactly-once submission of a specific signed transaction, not global exactly-once business settlement. a transaction signature commits to its message and recent blockhash. the signed bytes and signature are fsynced before broadcast; restarts look up that signature and resend only the same bytes while valid.

if an rpc cannot find the signature after expiry, the system stops. an operator must check an independent archival rpc and treasury/destination token history before a replacement manifest or explicit recovery tool is authorized. this conservative ambiguity is deliberate.
