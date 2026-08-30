# official references

reviewed 2026-08-30. network constants and operational assumptions should be rechecked before every mainnet release.

- circle, [usdc contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses): solana mainnet `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`; solana devnet `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.
- solana, [clusters and public rpc endpoints](https://solana.com/docs/references/clusters): devnet/mainnet endpoint purposes, devnet reset risk, and the warning that public endpoints are rate-limited and not intended for production.
- solana, [transactions](https://solana.com/docs/core/transactions): atomic execution, 1,232-byte legacy limit, 64-account limit, and 150-slot blockhash lifetime.
- solana, [create a token account](https://solana.com/docs/tokens/basics/create-token-account): deterministic ata derivation, separate account-creation payer, and `createidempotent` behavior.
- solana, [transfer tokens](https://solana.com/docs/tokens/basics/transfer-tokens): `transferchecked` validates the mint and decimals.
- solana, [fee abstraction](https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction): a sponsor can be the fee payer while the token owner separately authorizes the transfer.
- solana, [compute budget](https://solana.com/docs/core/fees/compute-budget): simulate, add a ten-percent margin, and cap legacy transactions at 1.4 million compute units.
- solana, [`getgenesishash`](https://solana.com/docs/rpc/http/getgenesishash): cluster identity rpc method.
