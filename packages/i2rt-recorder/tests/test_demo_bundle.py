from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from i2rt_recorder.export_mcap import export_mcap
from i2rt_recorder.fixture import create_fixed_geometry_fixture

BUNDLE_PATH = Path(__file__).parents[1] / "fixtures/demo-v1/upload.json"
EXPECTED_ARTIFACTS = {
    "events.ndjson": (11_418, "f6c87359d61463a5230c1da5f61618e834eef36df411667d89b1536b3258569f"),
    "geometry.json": (580, "046370cfb5ca7494b59a1a5c67f5d3791484aed12164e6217bac2bdfed30c676"),
    "manifest.json": (1_619, "796b2bc82419e67f70997e7e63e19cfb0893f757e82c9a32c2fe70d9d7ec4cca"),
    "session.mcap": (15_594, "dd65c6bdce68432991cbc08f6916649401ef3f3dcfce09a012fa251a0b421f36"),
}


def test_demo_upload_bundle_matches_the_deterministic_fixture(tmp_path: Path) -> None:
    bundle = json.loads(BUNDLE_PATH.read_text(encoding="utf-8"))
    assert set(bundle) == {"schemaVersion", "fixtureVersion", "artifacts"}
    assert bundle["schemaVersion"] == "capy.i2rt.synthetic-demo.v1"
    assert bundle["fixtureVersion"] == "fixed-square-peg-v1@1"
    assert set(bundle["artifacts"]) == set(EXPECTED_ARTIFACTS)

    recording = create_fixed_geometry_fixture(tmp_path / "recording")
    export_mcap(recording, recording / "session.mcap")

    for name, (expected_size, expected_sha256) in EXPECTED_ARTIFACTS.items():
        encoded = bundle["artifacts"][name]
        decoded = base64.b64decode(encoded, validate=True)
        assert base64.b64encode(decoded).decode("ascii") == encoded
        assert len(decoded) == expected_size
        assert hashlib.sha256(decoded).hexdigest() == expected_sha256
        assert decoded == (recording / name).read_bytes()

    source_manifest = json.loads(base64.b64decode(bundle["artifacts"]["manifest.json"], validate=True))
    assert source_manifest["extra"]["fixture"] is True
    assert source_manifest["camera_streams"] == []
