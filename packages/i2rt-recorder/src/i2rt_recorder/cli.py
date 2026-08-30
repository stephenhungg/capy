from __future__ import annotations

import argparse
import sys
from pathlib import Path

from i2rt_recorder.export_lerobot import export_lerobot
from i2rt_recorder.export_mcap import export_mcap
from i2rt_recorder.fixture import create_fixed_geometry_fixture
from i2rt_recorder.jsonutil import pretty_json
from i2rt_recorder.validation import validate_raw_log


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="i2rt-recorder")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="validate a canonical raw recording")
    validate.add_argument("recording", type=Path)
    mcap = commands.add_parser("export-mcap", help="export a raw recording to deterministic MCAP")
    mcap.add_argument("recording", type=Path)
    mcap.add_argument("output", type=Path)
    lerobot = commands.add_parser("export-lerobot", help="export completed episodes to camera-free LeRobot v3")
    lerobot.add_argument("recording", type=Path)
    lerobot.add_argument("output", type=Path)
    fixture = commands.add_parser("make-fixture", help="create a hardware-free fixed-geometry recording")
    fixture.add_argument("output", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "validate":
        report = validate_raw_log(args.recording)
        result = {
            "valid": report.valid,
            "errors": report.errors,
            "warnings": report.warnings,
            "metrics": report.metrics,
        }
        print(pretty_json(result), end="")
        return 0 if report.valid else 1
    if args.command == "export-mcap":
        print(export_mcap(args.recording, args.output))
        return 0
    if args.command == "export-lerobot":
        print(export_lerobot(args.recording, args.output))
        return 0
    if args.command == "make-fixture":
        print(create_fixed_geometry_fixture(args.output))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
