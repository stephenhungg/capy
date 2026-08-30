# inspected source audit

this scaffold was designed against local, read-only source material on 2026-08-30. paths are recorded for reproducibility on the originating workstation; the package has no runtime dependency on them.

## world context audit material

primary audit:

- `/Users/stephenhung/Documents/Codex/2026-08-30/https-github-com-max-titov-berkeley/outputs/world-context-data-audit.md`
- sha-256: `d2a1c9ca472b14da8bddf485ce6c3c0b85d8ba3c597550e3d52b60833ec08a8e`

the implementation relies on its audited findings that the v3.1.1 package contains 424 five-minute clips, 50 clip-level task labels, about 35.3 hours, and synchronized imu, while lacking keysteps, action boundaries, active objects, outcomes, mistakes, and proficiency labels. the sections “what we can build now,” “what requires annotation before it is real,” and “bad fits and claims to avoid” establish the provenance boundary used here.

research-plan contract:

- `/Users/stephenhung/Documents/Codex/2026-08-30/https-github-com-max-titov-berkeley/outputs/experience-network-master-research-plan-2026.md`

its “evidence plane,” “episode plane,” and “capability graph” sections define world context as tier-0 human video/imu, vima as evidence memory, and the representative `place_panel_in_fixture@1` graph/predicates used by the fixture.

supporting stack thesis:

- `/Users/stephenhung/Documents/Codex/2026-08-30/https-github-com-max-titov-berkeley/outputs/blockchain-thesis-world-context-vima-i2rt.md`
- sha-256: `33d52849fca3d94d365793f31d2b083082b93ed4ee49d92fa10dbb75fb64bc94`

## vima repository

repository inspected:

- `/Users/stephenhung/Documents/GitHub/vima`
- git head: `ee0eac9a9e0a3418149ecf22576685c73dacf449`

relevant implementation surfaces:

- `backend/episodic_memory.py`: groups frame events and serializes episode id/type, time range, evidence frames, tracks, labels, relations, heuristic confidence, observations, and spatial facts;
- `backend/memory_retrieval.py`: compacts and lexically ranks episodes;
- `backend/answer_from_memory.py`: answers from retrieved episode context and asks the model to cite episode/frame ids;
- `demo/episodic_memory.json`: representative export used to shape the test fixture;
- `docs/YOLODEX_MEMORY.md`: describes episodic retrieval and cited answer flow.

important observed gaps drive adapter validation: episode rows have frame basenames but no stable source-video id/uri/hash, extraction version, frame hash, or calibrated confidence. the adapter therefore requires capy-owned source identity and a video uri, and preserves the vima artifact separately.

## camera-free i2rt recorder

repository package inspected:

- `packages/i2rt-recorder/src/i2rt_recorder/recorder.py`: session/episode lifecycle, frame, intervention, safety, clock-issue, and manual outcome events;
- `packages/i2rt-recorder/src/i2rt_recorder/rawlog.py`: canonical append-only `events.ndjson` and `manifest.json` source journal;
- `packages/i2rt-recorder/src/i2rt_recorder/model.py`: `capy.i2rt.camera_free.v1` manifest, robot layout, capture quality, and manual outcome values;
- `packages/i2rt-recorder/src/i2rt_recorder/validation.py`: sequence, time, boundary, shape, and camera-free invariants;
- `packages/i2rt-recorder/src/i2rt_recorder/export_mcap.py`: deterministic MCAP export and `capy_source_journal` digest metadata.

the evidence adapter mirrors those journal boundaries while retaining a separate trust boundary: recorder instructions are not protocol task ids, terminal outcomes are manual assertions rather than independent evaluation results, and a valid journal does not by itself prove that its derived MCAP is indexed or crc-verified.
