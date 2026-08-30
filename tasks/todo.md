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
- [ ] implement buyer capability requests and funded collection jobs
- [ ] implement contributor job discovery, submissions, quality status, and payouts
- [ ] implement evaluator hidden-trial workflow and capability receipts
- [ ] implement operator review, audit, dispute, and treasury surfaces
- [ ] connect the physical camera-free i2rt edge agent for automatic post-session upload
- [ ] connect bounty, evaluation, receipt, and Solana payout services
- [ ] validate, deploy, and operate the first permanent end-to-end workflow

## product rule

the fixed-geometry YAM experiment is the first production workflow inside capy, not a standalone demo. early code must remain reusable platform infrastructure with durable data, real authorization, inspectable evidence, and production operations.

## review

- the synthetic fixed-geometry workflow now enforces buyer → contributor → evaluator → operator ordering.
- trust decisions and work commands are versioned, actor-bound, request-digest-bound, and idempotent.
- settlement authorization produces a digest-bound executor outbox record; it does not silently execute a transfer.
- d1 rows are tenant-scoped and r2 bytes are checked against both storage and canonical object digests.
- first-user bootstrap is limited to a single organization owner; later members require an explicit email invitation.
- the dashboard is intentionally minimal; full protocol objects, gates, and audit history live in the signed-record drill-down.
- the public landing is live at `capy.stephenhung.me` on Vercel and `/dashboard` hands off to the existing owner-only Sites deployment.
- the Railway ingress accepts only explicit zero-camera manifests, uses conditional direct uploads, and marks a session complete only after streaming byte-length and sha-256 verification.
- a validated hardware-free i2rt journal plus deterministic MCAP completed the live Railway registration, retry, upload, finalization, and aggregate-status path.
- remaining product work is real job creation, submission ingestion, live hidden trials, hardware sessions, funded treasury operation, and a connected Solana executor.
