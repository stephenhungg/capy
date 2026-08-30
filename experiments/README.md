# capy experiment 001: fixed-fixture insertion

this directory is a runnable pre-registration and analysis scaffold for capy's first camera-free YAM experiment. it compares random valid teleoperation with failure-targeted teleoperation at equal collection cost. the committed dataset is synthetic and exists only to exercise the pipeline before hardware is available.

## run it

python 3.10 or newer is the only dependency.

```bash
python3 experiments/run.py clean
python3 experiments/run.py all
python3 -m unittest discover -s experiments/tests -v
python3 experiments/run.py verify
```

`all` regenerates the synthetic csv files, validates the experiment invariants, and writes `reports/example_report.md` plus `reports/example_report.json`. `verify` performs the full build twice in temporary directories and fails if any artifact hash changes.

the synthetic directory contains a hashed sentinel and cannot be registered as observed data. genuine hardware exports must start in a clean directory with an observed capture manifest.

for real hardware, place schema-compatible exports in a separate directory, register their hashes as observed data, and analyze them explicitly:

```bash
python3 experiments/run.py register-observed \
  --data-dir /absolute/path/to/observed-export
python3 experiments/run.py analyze \
  --data-dir /absolute/path/to/observed-export \
  --report-dir /absolute/path/to/report
```

## what is frozen

- `config/experiment.json` contains seeds, policy eligibility, power assumptions, endpoints, and decision thresholds.
- `protocol.md` defines collection, training, randomization, held-out evaluation, and exclusions.
- `claims_and_thresholds.md` separates literature or implementation facts from capy's proposed management gates.
- data schemas are documented in `data_dictionary.md` and enforced by the analyzer.

the primary result is held-out real success-rate gain over the frozen baseline per collection dollar. the primary contrast is targeted gain-per-dollar divided by random gain-per-dollar. safety is a non-inferiority guardrail, not something that can be traded for task success.

## honest interpretation

the included example report is a pipeline fixture, not evidence that targeted data works. even a future observed pass on this task is only a first-task result. capy's inherited `1.25x` kill gate explicitly requires replication across three tasks.
