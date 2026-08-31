#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "usage: $0 RECORDING_DIR CAPABILITY_ID [RUN_ID]" >&2
  exit 2
fi

recording_dir=$1
capability_id=$2
run_id=${3:-}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd "$script_dir/../../.." && pwd)
recorder_bin=${CAPY_RECORDER_BIN:-i2rt-recorder}
ingest_url=${CAPY_INGEST_URL:-https://capy-i2rt-production.up.railway.app}

if [[ -z "${CAPY_INGEST_TOKEN:-}" ]]; then
  echo "CAPY_INGEST_TOKEN is required" >&2
  exit 2
fi
if ! command -v "$recorder_bin" >/dev/null 2>&1; then
  echo "i2rt-recorder is not installed; install packages/i2rt-recorder first" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node is required for the streaming uploader" >&2
  exit 2
fi

manifest_path="$recording_dir/ingest-manifest.json"
prepare_args=(
  prepare-ingest
  "$recording_dir"
  --capability-id "$capability_id"
  --output "$manifest_path"
)
if [[ -n "$run_id" ]]; then
  prepare_args+=(--run-id "$run_id")
fi

"$recorder_bin" validate "$recording_dir"
"$recorder_bin" "${prepare_args[@]}"

CAPY_INGEST_URL="$ingest_url" \
CAPY_INGEST_TOKEN="$CAPY_INGEST_TOKEN" \
node "$repo_root/services/i2rt-ingest/examples/upload-session.mjs" "$manifest_path"
