# solana payout manifest v0.1

the json schema lives at `packages/bounty-engine/schema/payout-manifest.schema.json`. `calculatePayoutManifest` produces the schema's temporary off-chain interface.

## execution boundary

v0.1 is intentionally unsigned. a settlement service must:

1. parse and validate the schema, recompute the canonical input and manifest ids, and check governance/evaluator signatures kept with the capability receipt;
2. verify the source token account exists, is owned by the declared token program, uses the declared mint, and has enough balance;
3. verify each recipient owner on chain, derive the associated token account for the declared mint/program, and create it idempotently when absent;
4. issue `TransferChecked` with the manifest's mint, decimals, and atomic amount;
5. attach the manifest id as a memo or settlement-ledger reference and record transaction signatures per transfer;
6. never execute more than once for a `transferId`.

Solana's official payment guidance requires deriving and checking the recipient associated token account rather than assuming the owner address is itself a token account ([verify address](https://solana.com/docs/payments/send-payments/verify-address)). `TransferChecked` verifies the mint and decimals during transfer ([token CPI](https://solana.com/docs/tokens/advanced/cpi)). that is why the manifest carries owner addresses, leaves `recipientTokenAccount` null until execution, and uses integer atomic amounts.

## commitments and determinism

`manifestId` hashes the canonical manifest body. `inputHash` hashes the normalized economic input. contribution and evaluation arrays are sorted before hashing. `canonicalJson` is the exact body signing payload; it excludes `manifestId` and itself to avoid circularity.

the schema's base58 regex is only a syntax prefilter. the engine also decodes each address to exactly 32 bytes. the settlement service remains responsible for ownership, executable-account, mint, freeze, sanctions/compliance, and balance checks against the selected cluster.

## withheld funds

`withheld` reconciles exactly to total funding minus transfers. it breaks out dispute reserve, unearned performance, and any pool that could not be allocated because all eligible weights were zero. withheld funds require a later authorized manifest or an escrow refund; they are not silently redistributed.
