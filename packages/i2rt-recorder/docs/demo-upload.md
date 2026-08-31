# no-token synthetic demo upload

this lane proves that a computer can send the canonical camera-free fixture to capy's railway service without an operator-managed secret. it is deliberately synthetic, nonpersistent, and never eligible for physical evidence, evaluation, attribution, or payout.

from a capy checkout, run:

```bash
packages/i2rt-recorder/scripts/demo-upload.sh
```

the script posts only the checked-in `fixtures/demo-v1/upload.json` contract. it does not read or forward `CAPY_INGEST_TOKEN`. set `CAPY_DEMO_URL` only when testing a different deployment.

from a fresh linux machine with only `curl`, use the pinned raw bundle url once it has been published:

```bash
curl --fail --silent --show-error --location BUNDLE_RAW_URL |
  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --header "content-type: application/vnd.capy.i2rt-demo+json" \
    --data-binary @- \
    https://capy-i2rt-production.up.railway.app/v1/demo/sessions
```

`BUNDLE_RAW_URL` must be replaced with the immutable, commit-pinned raw github url for `packages/i2rt-recorder/fixtures/demo-v1/upload.json`. do not point the command at a mutable branch.

the response is a stable verification receipt marked `synthetic_fixture`, `physicalEvidence: false`, `payoutEligible: false`, and `persisted: false`. the real physical uploader remains bearer-authenticated and uses [`upload-session.sh`](../scripts/upload-session.sh).
