# devnet operator guide

## install and verify

from this package directory:

```sh
npm ci
npm run check
npm test
npm run build
npm audit --omit=dev
```

validate a manifest without rpc access:

```sh
npm run cli -- validate examples/manifest.v1.json
```

produce an offline dry-run. this is the default and loads no private key:

```sh
npm run cli -- run examples/manifest.v1.json \
  --network devnet \
  --treasury-authority GmAuCdpJyNwps8jwj4WQ8vE542s52MG3D2sU8coSLa55
```

## devnet submission

use separate, devnet-only key files. never commit them. the treasury key authorizes usdc movement; an optional sponsor pays transaction fees and ata rent.

```sh
chmod 600 /secure/devnet-treasury.json /secure/devnet-sponsor.json
npm run cli -- run /secure/payout-manifest.json \
  --network devnet \
  --treasury-keypair /secure/devnet-treasury.json \
  --fee-payer-keypair /secure/devnet-sponsor.json \
  --state-file /secure/payout-state.json \
  --submit
```

the default rpc is solana's rate-limited public devnet endpoint. for a private endpoint, keep the url and any api key out of shell history and configure only its exact hostname on the command line:

```sh
export CAPY_SOLANA_RPC_URL="https://devnet.example-rpc.invalid/?api-key=${RPC_API_KEY}"
npm run cli -- run /secure/payout-manifest.json \
  --network devnet \
  --allowed-rpc-host devnet.example-rpc.invalid \
  --treasury-keypair /secure/devnet-treasury.json \
  --state-file /secure/payout-state.json \
  --submit
```

the cli compares the selected endpoint's genesis hash to solana's official endpoint before reading balances or submitting.

## resume and reconcile

rerunning the same command with the same state file never creates a new transaction for a journaled batch. it checks the journaled signature and resends the exact bytes only while their blockhash remains valid.

reconciliation does not load keys or submit anything:

```sh
npm run cli -- reconcile /secure/payout-manifest.json \
  --network devnet \
  --state-file /secure/payout-state.json
```

`finalized` signatures are ready for capability receipts. `submitted` means retry reconciliation. `failed` is safe from partial token movement because a solana transaction is atomic, but replacement still requires review. `expired_unknown` is a hard stop requiring an independent archival rpc and token-history investigation.

## fee sponsorship

if `--fee-payer-keypair` is omitted, the treasury signer pays sol fees and missing ata rent. when supplied, the sponsor becomes the transaction fee payer and ata creation payer; the treasury still signs each usdc transfer. both signatures are committed to the journaled transaction.
