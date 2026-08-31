#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
bundle_path="$script_dir/../fixtures/demo-v1/upload.json"
demo_url=${CAPY_DEMO_URL:-https://capy-i2rt-production.up.railway.app/v1/demo/sessions}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for the no-token demo upload" >&2
  exit 2
fi
if [[ ! -f "$bundle_path" ]]; then
  echo "canonical demo bundle not found: $bundle_path" >&2
  exit 2
fi

# This lane never reads or forwards the physical-ingest credential.
unset CAPY_INGEST_TOKEN

echo "uploading the canonical synthetic fixture; this is not physical evidence or payout-eligible data" >&2
curl \
  --fail-with-body \
  --silent \
  --show-error \
  --retry 2 \
  --header "content-type: application/vnd.capy.i2rt-demo+json" \
  --data-binary "@$bundle_path" \
  "$demo_url"
printf '\n'
