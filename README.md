# capy

capy is an evidence and settlement network for physical intelligence.

robots fail in specific ways. capy turns a failure into a signed capability contract, accepts camera-free experience from a local robot boundary, measures whether the experience produced a real capability gain, attributes that gain, and authorizes contributor payouts in native USDC on Solana.

```text
failure → contract → experience → evaluation → attribution → payout
              signed evidence and trust gates all the way through
```

## what works

- an authenticated, role-separated web platform for buyers, contributors, evaluators, and operators;
- a same-origin Vercel dashboard that reports the live camera-free Railway ingest without exposing ingest credentials;
- durable D1 workflow state, memberships, invitations, idempotent commands, audit events, and executor handoffs;
- immutable protocol objects in R2 with storage-byte and RFC 8785 object-digest verification;
- a direct, camera-free i2rt recorder contract using synchronized JSON MCAP channels;
- an authenticated Railway ingress that binds immutable manifests, issues direct object uploads, and re-hashes every artifact before finalization;
- an i2rt journal-to-evidence bridge that hashes source bytes and preserves safety and intervention events;
- a falsifiable hidden-trial evaluation laboratory;
- a deterministic bounty compiler with conserved cohort attribution;
- a memo-less Solana USDC payout planner and isolated executor state machine;
- public receipts that resolve and verify the stored protocol chain before returning results.

mainnet execution is intentionally disabled. the current capability and evaluation data are labeled synthetic, and no live robot or camera is connected.

## architecture

```text
i2rt edge                 Railway ingress                capy control plane              isolated payout rail
─────────                 ───────────────                ──────────────────              ────────────────────
motor + safety loop       bearer-auth manifest          authenticated workflow          signed authorization
crash-safe journal  ───▶  direct object upload    ───▶  evidence + evaluation    ───▶  memo-less USDC plan
camera-free MCAP          Postgres + hash verify         D1 state + R2 objects           Solana executor

the cloud never commands the robot. the public chain never receives contributor ids.
```

## live services

- landing: [capy.stephenhung.me](https://capy.stephenhung.me)
- live dashboard: [capy.stephenhung.me/dashboard](https://capy.stephenhung.me/dashboard)
- authenticated legacy control plane: [capy-network.stephenhung.chatgpt.site](https://capy-network.stephenhung.chatgpt.site)
- camera-free ingress health: [capy-i2rt-production.up.railway.app/health](https://capy-i2rt-production.up.railway.app/health)

## protocol spine

every transition is joined by immutable identifiers and digests:

1. capability manifest
2. episode cohort
3. evaluation receipt
4. attribution result
5. Solana payout manifest

the canonical schemas and linked example objects live in [`schemas/`](./schemas) and [`docs/protocol/`](./docs/protocol).

## repo map

- `app/dashboard` — Vercel-native minimal operator surface backed by the Railway public aggregate
- `apps/web` — authenticated Sites application, D1 schema, R2 object store, workflow, receipts, and operations UI
- `services/i2rt-ingest` — Railway Postgres + object-storage boundary for authenticated, integrity-verified camera-free sessions
- `packages/i2rt-recorder` — camera-free i2rt journal and MCAP export
- `packages/evidence-bridge` — VIMA / World Context projections into the capy evidence contract
- `packages/eval-lab` — registered hidden-trial evaluation harness
- `packages/bounty-engine` — deterministic allocation and payout compilation
- `packages/solana-payouts` — signed authorization adapter, transfer planner, executor, and reconciliation state
- `docs/architecture` — edge/control/executor boundaries and service contracts
- `docs/governance` — rights, privacy, provenance, disputes, and treasury policy

## run the web surfaces

the canonical landing and live dashboard are one Next.js deployment:

```bash
npm install
npm run dev
```

the authenticated control-plane workspace still runs separately while its D1, R2, and identity adapters are migrated:

```bash
cd apps/web
npm install
npm run db:migrate:local
npm run dev
```

the local Sites identity is provided by the development runtime. sign in through the supplied local flow.

## verify the repository

```bash
npm test

cd apps/web
npm run lint
npm run typecheck
npm run build

cd ../../services/i2rt-ingest
npm run typecheck
npm test
npm run build

cd ../../packages/solana-payouts
npm run check
npm test

cd ../bounty-engine
npm test

cd ../evidence-bridge
python -m unittest discover -s tests -v
```

## current boundary

this is production-shaped infrastructure with a working synthetic end-to-end workflow and a live camera-free cloud ingestion path. that ingress has been exercised with a validated hardware-free recorder fixture; no physical rig session is claimed. real model training, live hidden-set evaluation, treasury funding, and mainnet settlement remain explicit integrations—not claims hidden behind a polished dashboard.
