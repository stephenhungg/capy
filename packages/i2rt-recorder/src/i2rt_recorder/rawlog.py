from __future__ import annotations

import json
import os
import queue
import threading
from collections.abc import Iterator
from pathlib import Path
from typing import Any, TextIO

from i2rt_recorder.jsonutil import canonical_json, pretty_json

MANIFEST_NAME = "manifest.json"
EVENTS_NAME = "events.ndjson"


class RawLogWriter:
    """Append canonical events; each flushed line is independently recoverable."""

    def __init__(
        self,
        root: Path,
        manifest: dict[str, Any],
        *,
        fsync: bool = False,
        queue_capacity: int = 4096,
    ) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=False)
        self._fsync = fsync
        manifest_path = self.root / MANIFEST_NAME
        manifest_path.write_text(pretty_json(manifest), encoding="utf-8")
        self._stream: TextIO = (self.root / EVENTS_NAME).open("x", encoding="utf-8", newline="\n")
        self._next_sequence = 0
        self._closed = False
        self._lock = threading.Lock()
        self._queue: queue.Queue[dict[str, Any] | object] = queue.Queue(maxsize=queue_capacity)
        self._stop = object()
        self._writer_error: BaseException | None = None
        self._thread = threading.Thread(target=self._write_loop, name="i2rt_raw_log_writer")
        self._thread.start()

    def append(self, event: dict[str, Any]) -> dict[str, Any]:
        if self._closed:
            raise RuntimeError("raw log is closed")
        if self._writer_error is not None:
            raise RuntimeError("raw log writer failed") from self._writer_error
        with self._lock:
            complete = {"sequence": self._next_sequence, **event}
            try:
                self._queue.put_nowait(complete)
            except queue.Full as exc:
                raise RuntimeError(
                    "raw log queue overflowed; stop the episode because the recording is incomplete"
                ) from exc
            self._next_sequence += 1
        return complete

    def _write_loop(self) -> None:
        try:
            while True:
                item = self._queue.get()
                if item is self._stop:
                    return
                assert isinstance(item, dict)
                self._stream.write(canonical_json(item) + "\n")
                self._stream.flush()
                if self._fsync:
                    os.fsync(self._stream.fileno())
        except BaseException as exc:
            self._writer_error = exc
        finally:
            self._stream.close()

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            while self._writer_error is None and self._thread.is_alive():
                try:
                    self._queue.put(self._stop, timeout=0.1)
                    break
                except queue.Full:
                    continue
            self._thread.join()
            if self._writer_error is not None:
                raise RuntimeError("raw log writer failed") from self._writer_error

    def __enter__(self) -> RawLogWriter:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()


def read_manifest(root: Path) -> dict[str, Any]:
    with (root / MANIFEST_NAME).open(encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise ValueError("manifest must be a JSON object")
    return value


def iter_events(root: Path) -> Iterator[dict[str, Any]]:
    with (root / EVENTS_NAME).open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSON on events line {line_number}: {exc}") from exc
            if not isinstance(value, dict):
                raise ValueError(f"events line {line_number} is not an object")
            yield value


def load_events(root: Path) -> list[dict[str, Any]]:
    return list(iter_events(root))
