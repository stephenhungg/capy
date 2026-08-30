#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import shutil
import tempfile
from pathlib import Path

from capy_eval.analysis import analyze_dataset
from capy_eval.generate import generate_dataset, write_metadata
from capy_eval.report import write_reports


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config" / "experiment.json"
DEFAULT_DATA = ROOT / "data" / "synthetic"
DEFAULT_REPORTS = ROOT / "reports"


def _artifact_hashes(directory: Path) -> dict[str, str]:
    return {
        str(path.relative_to(directory)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(directory.rglob("*"))
        if path.is_file()
    }


def _generate(config: Path, data_dir: Path) -> None:
    generate_dataset(config, data_dir)
    print(f"generated deterministic dataset in {data_dir}")


def _analyze(config: Path, data_dir: Path, report_dir: Path) -> None:
    result = analyze_dataset(config, data_dir)
    write_reports(result, report_dir)
    print(
        "analysis complete: "
        f"decision={result['overall_decision']} "
        f"first_task_signal={result['first_task_signal']} "
        f"report={report_dir / 'example_report.md'}"
    )


def _clean(data_dir: Path, report_dir: Path) -> None:
    if data_dir.resolve() != DEFAULT_DATA.resolve() or report_dir.resolve() != DEFAULT_REPORTS.resolve():
        raise SystemExit("clean only removes the default generated data and report directories")
    for directory in (data_dir, report_dir):
        if directory.is_dir():
            shutil.rmtree(directory)
    print("removed generated dataset and reports")


def _verify(config: Path) -> None:
    builds: list[dict[str, str]] = []
    with tempfile.TemporaryDirectory(prefix="capy-eval-verify-") as temporary:
        root = Path(temporary)
        for index in range(2):
            build = root / f"build-{index}"
            data = build / "data"
            reports = build / "reports"
            generate_dataset(config, data)
            write_reports(analyze_dataset(config, data), reports)
            builds.append(_artifact_hashes(build))
        if builds[0] != builds[1]:
            raise SystemExit("reproducibility check failed: clean builds differ")
        if config.resolve() == DEFAULT_CONFIG.resolve() and DEFAULT_DATA.is_dir() and DEFAULT_REPORTS.is_dir():
            committed = {
                **{f"data/{key}": value for key, value in _artifact_hashes(DEFAULT_DATA).items()},
                **{
                    f"reports/{key}": value
                    for key, value in _artifact_hashes(DEFAULT_REPORTS).items()
                },
            }
            if committed != builds[0]:
                raise SystemExit(
                    "reproducibility check failed: committed artifacts are stale; run `python3 experiments/run.py all`"
                )
    print(f"reproducibility verified for {len(builds[0])} artifacts across two clean builds")


def main() -> None:
    parser = argparse.ArgumentParser(description="capy experiment generation and analysis")
    parser.add_argument(
        "command",
        choices=["clean", "generate", "register-observed", "analyze", "all", "verify"],
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORTS)
    args = parser.parse_args()
    if args.command == "clean":
        _clean(args.data_dir, args.report_dir)
    elif args.command == "generate":
        _generate(args.config, args.data_dir)
    elif args.command == "register-observed":
        write_metadata(args.config, args.data_dir, "observed")
        print(f"registered observed dataset hashes in {args.data_dir / 'metadata.json'}")
    elif args.command == "analyze":
        _analyze(args.config, args.data_dir, args.report_dir)
    elif args.command == "all":
        _generate(args.config, args.data_dir)
        _analyze(args.config, args.data_dir, args.report_dir)
    elif args.command == "verify":
        _verify(args.config)


if __name__ == "__main__":
    main()
