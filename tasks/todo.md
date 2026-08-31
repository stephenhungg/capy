# capy foundation

## completed foundations

- [x] preserve and verify the existing capy marketing site
- [x] define capy protocol v1, canonical schemas, and a linked camera-free YAM example chain
- [x] integrate the camera-free i2rt recorder
- [x] integrate the falsifiable YAM evaluation laboratory
- [x] integrate the Solana `USDC` payout rail
- [x] integrate the bounty compiler and cohort attribution engine
- [x] integrate the VIMA / World Context evidence bridge
- [x] integrate rights, privacy, provenance, and governance contracts
- [x] integrate the 90-day category strategy and risk register

## production web platform

- [x] scaffold the production Sites application with shadcn, authentication, D1, and R2
- [x] reduce the authenticated dashboard to one state, one next action, and one compact proof trail
- [x] deploy the public landing on Vercel with a stable `/dashboard` handoff to the authenticated product
- [x] deploy a bearer-authenticated camera-free i2rt ingress on Railway with Postgres and private object storage
- [x] connect the dashboard to live ingress status without adding a fourth proof signal
- [x] implement tenant-scoped organizations, memberships, invitations, and role-aware authorization
- [x] replace the cross-origin dashboard redirect with a real Vercel `/dashboard` route
- [x] expose a same-origin health endpoint backed by the live Railway ingress
- [x] verify the canonical domain serves both landing and dashboard without a redirect
- [ ] implement buyer capability requests and funded collection jobs
- [ ] implement contributor job discovery, submissions, quality status, and payouts
- [ ] implement evaluator hidden-trial workflow and capability receipts
- [ ] implement operator review, audit, dispute, and treasury surfaces
- [ ] connect the physical camera-free i2rt edge agent for automatic post-session upload
- [ ] connect bounty, evaluation, receipt, and Solana payout services
- [ ] validate, deploy, and operate the first permanent end-to-end workflow

## first physical YAM session

- [x] package a closed physical recorder journal into a strict Railway ingest manifest
- [x] reject fixture, incomplete, best-effort, unknown-rig, and non-camera-free recordings before upload
- [x] provide the friend-hosted i2rt computer one post-session upload command with no inbound networking
- [ ] provision the ingest credential through a private handoff; never commit or paste it into browser code
- [ ] capture one human-supervised physical episode and record its manual outcome
- [ ] upload, hash-verify, finalize, and confirm the new physical session in the public aggregate

## no-token demo lane

- [x] add a public, rate-limited verifier that accepts only the canonical synthetic fixture contract
- [x] keep anonymous demo requests quarantined from storage, physical evidence, evaluation, and payout eligibility
- [x] provide one command that uploads the fixture without an operator-managed secret
- [x] prove physical manifests and arbitrary artifacts cannot enter through the demo lane
- [x] deploy and verify the anonymous fixture flow against production Railway

## public user dashboard demo

- [x] route the marketing site into a no-login, read-only user dashboard walkthrough
- [x] show a coherent contributor job, submission evidence, review state, and projected payout using synthetic data
- [x] make demo mode unmistakable and disable uploads, wallet actions, payouts, and other mutations
- [x] preserve the minimal dashboard hierarchy and responsive behavior
- [x] test, deploy to Vercel, and verify the complete landing-to-demo route

## product rule

the fixed-geometry YAM experiment is the first production workflow inside capy, not a standalone demo. early code must remain reusable platform infrastructure with durable data, real authorization, inspectable evidence, and production operations.

## review

- the synthetic fixed-geometry workflow now enforces buyer → contributor → evaluator → operator ordering.
- trust decisions and work commands are versioned, actor-bound, request-digest-bound, and idempotent.
- settlement authorization produces a digest-bound executor outbox record; it does not silently execute a transfer.
- d1 rows are tenant-scoped and r2 bytes are checked against both storage and canonical object digests.
- first-user bootstrap is limited to a single organization owner; later members require an explicit email invitation.
- the dashboard is intentionally minimal; full protocol objects, gates, and audit history live in the signed-record drill-down.
- the canonical Vercel app now owns both `/` and the minimal live `/dashboard`; the owner-only Sites deployment remains the legacy authenticated workflow while its D1, R2, and identity adapters are migrated.
- production verification returned `200` for `/`, `/dashboard`, and `/api/health`; `/dashboard` emitted no cross-origin redirect and rendered the live Railway aggregate with zero browser errors.
- the Railway ingress accepts only explicit zero-camera manifests, uses conditional direct uploads, and marks a session complete only after streaming byte-length and sha-256 verification.
- a validated hardware-free i2rt journal plus deterministic MCAP completed the live Railway registration, retry, upload, finalization, and aggregate-status path.
- the friend-hosted edge path now converts only closed exact-cycle physical journals into immutable ingest envelopes and safely resumes partial write-once uploads.
- physical provenance is explicitly operator-declared until signed per-rig attestation and server-side journal validation exist.
- the no-token lane verifies one byte-exact synthetic fixture in memory and returns an explicitly nonpersistent, nonphysical, non-payout receipt; it never opens anonymous production ingestion.
- Railway deployment `f03c5ce2-c7c0-4a7f-83f3-d6d51525f610` returned `SUCCESS`; both the repository script and immutable two-curl flow produced the same production receipt while durable counts stayed unchanged and the physical route remained `401` without its bearer.
- `/dashboard` is now the public, no-login contributor walkthrough; the live Railway and physical-rig view remains available separately at `/status`.
- the public page is a static server component fed by an allowlisted fixture projection, and its regression gate rejects client handlers, forms, API paths, or failed evaluation copy that would imply unsafe actions or success.
- Vercel deployment `dpl_ABbpzMY9j3jwxq23XLggQHAwEBK6` returned `Ready`; `/`, `/dashboard`, and `/status` each returned a direct `200`, and a production browser completed the landing-to-dashboard-to-status route with no console warnings or errors.
- remaining product work is real job creation, submission ingestion, live hidden trials, hardware sessions, funded treasury operation, and a connected Solana executor.
