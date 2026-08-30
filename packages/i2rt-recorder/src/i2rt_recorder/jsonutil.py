from __future__ import annotations

import dataclasses
import enum
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any


def jsonable(value: Any) -> Any:
    """Convert recorder values to strict, stable JSON-compatible values."""
    if dataclasses.is_dataclass(value):
        return jsonable(dataclasses.asdict(value))
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [jsonable(item) for item in value]
    if hasattr(value, "item") and callable(value.item):
        return jsonable(value.item())
    if hasattr(value, "tolist") and callable(value.tolist):
        return jsonable(value.tolist())
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(
        jsonable(value),
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def pretty_json(value: Any) -> str:
    return json.dumps(jsonable(value), allow_nan=False, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
