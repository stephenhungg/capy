# capy i2rt ingress

this is the machine-facing, camera-free ingestion boundary between an i2rt edge recorder and capy's human-facing control plane. it accepts completed evidence bundles; it does not expose robot commands or participate in the robot safety loop.

## trust and data flow

1. the edge recorder closes its crash-safe local journal and computes every artifact's byte length and sha-256.
2. `POST /v1/sessions` validates and immutably binds a `sessionId` to the canonical manifest. an exact retry is idempotent; any drift returns `409 manifest_drift`.
3. the service returns short-lived, conditional presigned `PUT` urls. bytes move directly from the edge to the private s3-compatible railway bucket.
4. `POST /v1/sessions/:sessionId/finalize` streams every object back through sha-256 and byte-count verification. only then does one postgres transaction mark all artifacts and the session verified.
5. capy's dashboard reads the safe public aggregate. a server holding the separate control-plane token can list manifests and mint short-lived download urls.

the contract requires `cameraFree: true`, `cameraStreams: 0`, a completed time range, and at least one `journal` artifact. it rejects `image/*` and `video/*` media, camera/image/rgb/depth/video terms in artifact ids or names and metadata keys, and all unknown manifest fields. filenames and identifiers cannot contain path separators. accepted manifests are canonicalized before object keys are content-addressed by the manifest and artifact digests. this closes obvious visual-channel mistakes; no metadata-only service can prove that deliberately mislabeled opaque bytes are nonvisual.

the outer `schemaVersion: "1.0"` belongs to this transport envelope; it does not replace the recorder's `capy.i2rt.camera_free.v1` source schema. for the checked-in i2rt recorder, validate the closed recording first, upload `events.ndjson` as the required `journal` artifact, upload `manifest.json` as `metadata`, and optionally upload the deterministic indexed mcap as `telemetry`. keep the recorder's own manifest and event stream as separate byte-addressed artifacts because the evidence bridge verifies both source digests.

## api

| endpoint | auth | purpose |
| --- | --- | --- |
| `GET /health` | public | postgres and private-bucket railway health check |
| `GET /v1/public/status` | public | safe counts only; no ids, manifests, or urls |
| `GET /v1/status` | public | alias for the aggregate status |
| `POST /v1/sessions` | ingest bearer | register a manifest and mint upload urls |
| `POST /v1/sessions/:id/finalize` | ingest bearer | stream-verify all objects and atomically finalize |
| `GET /v1/sessions` | control bearer | cursor-paginated control-plane session list |
| `GET /v1/sessions/:id` | control bearer | manifest, verification state, and verified downloads |

the public status response is deliberately fixed and small:

```json
{
  "state": "ready",
  "cameraFree": true,
  "cameraStreams": 0,
  "sessions": { "total": 12, "verified": 11 },
  "artifacts": { "verified": 37 },
  "lastIngestedAt": "2026-08-30T19:01:05.000Z"
}
```

## railway configuration

deploy this directory as one service with the included `Dockerfile` and `railway.json`. attach a private railway postgres database and an s3-compatible railway bucket, then provide:

- `DATABASE_URL`
- `S3_ENDPOINT` (or `AWS_ENDPOINT_URL`)
- `S3_REGION` (or `AWS_REGION` / `AWS_DEFAULT_REGION`)
- `S3_BUCKET` (or `BUCKET`)
- `S3_ACCESS_KEY_ID` (or `AWS_ACCESS_KEY_ID`)
- `S3_SECRET_ACCESS_KEY` (or `AWS_SECRET_ACCESS_KEY`)
- `INGEST_TOKEN`: a random 32+ character machine secret
- `CONTROL_PLANE_TOKEN`: a different random 32+ character server-side secret
- `CORS_ALLOWED_ORIGINS`: comma-separated exact dashboard origins; never `*`

optional limits are in [`.env.example`](./.env.example). upload and download url lifetimes are capped at 15 minutes. keep both bearer tokens server-side; the public dashboard status needs neither.

the service creates only additive `capy_i2rt_sessions` and `capy_i2rt_artifacts` tables and indexes under a postgres advisory lock at startup. it never drops or rewrites a table.

## local verification

```bash
npm install
npm run typecheck
npm test
npm run build
```

run postgres and an s3-compatible store, copy `.env.example` to `.env`, replace every secret, then:

```bash
set -a
source .env
set +a
npm start
```

## edge upload

for a closed recording produced by the checked-in recorder, use the fail-closed packager and uploader from the repository root:

```bash
packages/i2rt-recorder/scripts/upload-session.sh \
  /data/capy/<physical-session-directory> \
  cap-yam-fixed-insertion-v1 \
  first-physical-yam-run
```

the physical runbook and private-token handoff are documented in [`packages/i2rt-recorder/docs/first-physical-session.md`](../../packages/i2rt-recorder/docs/first-physical-session.md).

## no-token synthetic demo

the anonymous demo route accepts only capy's byte-exact, checked-in synthetic fixture. it returns a nonpersistent receipt and cannot create physical evidence or payout-eligible data. from a repository checkout:

```bash
packages/i2rt-recorder/scripts/demo-upload.sh
```

from a fresh linux machine with `curl`, pipe the immutable bundle directly to railway:

```bash
curl --fail --silent --show-error --location \
  https://raw.githubusercontent.com/stephenhungg/capy/b1987b6342492eb71f8cf5b94f0704ce783760d7/packages/i2rt-recorder/fixtures/demo-v1/upload.json |
  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --header "content-type: application/vnd.capy.i2rt-demo+json" \
    --data-binary @- \
    https://capy-i2rt-production.up.railway.app/v1/demo/sessions
```

the full contract and safety boundary are in [`packages/i2rt-recorder/docs/demo-upload.md`](../../packages/i2rt-recorder/docs/demo-upload.md). neither command sends an authorization header; the physical endpoints below still require the ingest bearer.

the manifest's artifact names resolve beside the manifest file. create the journal and manifest with real sizes and digests, then run:

```bash
CAPY_INGEST_URL=https://your-ingress.example \
CAPY_INGEST_TOKEN="$INGEST_TOKEN" \
node examples/upload-session.mjs ./evidence/manifest.json
```

or register directly:

```bash
curl --fail-with-body \
  -H "authorization: Bearer $INGEST_TOKEN" \
  -H "content-type: application/json" \
  --data-binary @examples/manifest.example.json \
  "$CAPY_INGEST_URL/v1/sessions"
```

use every returned `requiredHeaders` value on its matching `PUT`. retrying the same manifest safely returns fresh upload urls. after a session is verified, registration remains idempotent but no new upload urls are issued.

## deliberate boundaries

- `cameraFree: true` and `cameraStreams: 0` are both mandatory; obvious visual artifacts fail closed
- no control, command, actuation, or low-latency robot paths
- no bearer tokens in browser javascript
- no public session ids, robot ids, object keys, manifests, or presigned urls
- no trust in s3 metadata alone: finalization hashes the streamed bytes itself
