# threat model

## protected assets

- treasury usdc and sponsor sol
- signing authority and signer policy
- payout correctness, uniqueness, and auditability
- contributor identity and the offchain mapping from people to wallets
- capability receipt integrity

## trust assumptions

- circle's allowlisted solana usdc mints and the original spl token program are correct.
- the operator reviews the manifest through an independent approval path before submission.
- at least one honest rpc or explorer is available for ambiguous-history investigation.
- the host, node runtime, installed dependencies, and key custody boundary are not compromised.

## threats and controls

| threat | controls | residual risk |
| --- | --- | --- |
| wrong or counterfeit token | network-specific circle mint allowlist, six-decimal mint inspection, original token program check, `transferchecked` | allowlist changes require a reviewed release |
| wrong cluster or malicious rpc | explicit network, https and hostname allowlists, genesis comparison with official rpc | two colluding/compromised rpc paths can still lie about state |
| duplicate or inflated payout | strict schema, duplicate opaque-id rejection, exact decimal parsing, checked total and u64 bounds | duplicated business intent under two different ids must be caught upstream |
| recipient substitution | ata derivation from the reviewed wallet and canonical programs; dry-run exposes both addresses | a valid but attacker-controlled wallet in the approved manifest remains payable |
| ata race or missing ata | idempotent ata creation in the same atomic transaction as transfer; sponsor pays rent | sponsor may recover no rent when recipient later closes the ata |
| fee drain | bounded priority price, simulation-derived compute limit, measured batching, preflight fee/rent balance | repeated failed submissions still pay transaction fees once they land |
| replay or double pay after crash | signed-byte write-ahead journal, deterministic batch ids, signature history lookup, same-byte retries | a missing signature after expiry is ambiguous and needs manual investigation |
| partial batch payment | solana transaction atomicity | separate batches can finalize independently |
| key theft or leakage | no embedded keys, no secret output, `0600` devnet key files, no key loading in dry-run/reconcile | local files remain unsuitable for production custody |
| identity leakage | strict manifest rejects metadata; memo contains only batch/hash references | wallet and amount linkage is inherently public; timing analysis remains possible |
| state tampering | raw transaction sha-256 and signature verification, strict state schema, `0600` atomic writes | an attacker controlling both state and executable can still alter a future run |
| dependency compromise | pinned lockfile, modern official solana packages, production audit gate | registry or build-system compromise remains a supply-chain risk |
| multisig bypass | mainnet disabled; explicit signer integration boundary | a bad adapter could sign a different message unless independently decoded and approved |

## out of scope for this scaffold

kyc/aml, tax reporting, sanctions decisions, contributor authentication, exchange-rate calculation, treasury funding, signer quorum policy, production secret management, rpc vendor availability, and incident response are organizational controls outside this package.
