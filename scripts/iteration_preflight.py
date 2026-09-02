"""Enforce the mandatory experience/style load for every talking-head video task."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTEXT_NAME = "iteration-context.json"
STYLE_PROFILE = "previous-editorial-v1"
LAYOUT_PROFILE = "previous-editorial-v1-layout"
REQUIRED_SOURCES = (
    "SKILL.md",
    "docs/production-lessons.md",
    "docs/approved-visual-baseline.md",
    "docs/approved-visual-standard.md",
    "docs/transcript-fidelity-standard.md",
    "references/iteration-system.md",
    "references/semantic-design.md",
)


def fail(message: str) -> None:
    print(f"ERROR: iteration preflight: {message}", file=sys.stderr)
    raise SystemExit(1)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_project(raw: str) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    try:
        project = candidate.resolve()
        project.relative_to(ROOT)
    except ValueError:
        fail("project must be inside the repository")
    if not project.is_dir():
        fail(f"project directory does not exist: {raw}")
    return project


def load_sources() -> dict[str, dict[str, str]]:
    sources: dict[str, dict[str, str]] = {}
    for relative in REQUIRED_SOURCES:
        path = ROOT / relative
        if not path.is_file():
            fail(f"required experience source is missing: {relative}")
        if not path.read_text(encoding="utf-8").strip():
            fail(f"required experience source is empty: {relative}")
        sources[relative] = {"sha256": sha256(path)}
    return sources


def read_context(project: Path) -> dict:
    path = project / CONTEXT_NAME
    if not path.is_file():
        fail(f"{CONTEXT_NAME} is missing; run --phase start first")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{CONTEXT_NAME} is invalid JSON: {exc}")


def assert_context_current(project: Path, sources: dict[str, dict[str, str]]) -> dict:
    context = read_context(project)
    if context.get("schemaVersion") != "iteration-context-v1":
        fail("unsupported iteration context schema")
    if context.get("styleProfile") != STYLE_PROFILE:
        fail(f"style profile must be {STYLE_PROFILE}")
    if context.get("layoutProfile") != LAYOUT_PROFILE:
        fail(f"layout profile must be {LAYOUT_PROFILE}")
    recorded = context.get("loadedSources")
    if recorded != sources:
        fail("experience sources changed or were not loaded again; rerun --phase start")
    return context


def require_marker(project: Path, filename: str, markers: tuple[str, ...]) -> None:
    path = project / filename
    if not path.is_file():
        fail(f"{filename} is required before render")
    text = path.read_text(encoding="utf-8").lower()
    missing = [marker for marker in markers if marker.lower() not in text]
    if missing:
        fail(f"{filename} is missing required iteration markers: {', '.join(missing)}")


def start(project: Path, sources: dict[str, dict[str, str]]) -> None:
    context = {
        "schemaVersion": "iteration-context-v1",
        "project": project.relative_to(ROOT).as_posix(),
        "styleProfile": STYLE_PROFILE,
        "layoutProfile": LAYOUT_PROFILE,
        "loadedAt": datetime.now(timezone.utc).isoformat(),
        "loadedSources": sources,
        "priority": [
            "explicit-user-request",
            STYLE_PROFILE,
            LAYOUT_PROFILE,
            "approved-visual-baseline",
            "approved-visual-standard",
            "project-design",
            "generic-defaults",
        ],
        "mandatoryChecks": [
            "large-caption",
            "layout-anchor-grid",
            "keyword-highlight",
            "narration-reveal",
            "hook-structure-focus-when-structured-hook",
            "staggered-material-entry",
            "caption-safe-area",
            "mask-center-and-no-black-edge-when-mask-used",
            "frame-synced-mask-source-when-mask-used",
            "persistent-mask-when-required",
            "full-component-regression",
        ],
    }
    (project / CONTEXT_NAME).write_text(
        json.dumps(context, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Iteration preflight passed: {project.relative_to(ROOT)}")
    print(f"Loaded style profile: {STYLE_PROFILE}")
    print(f"Wrote: {project / CONTEXT_NAME}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, help="project directory inside the repository")
    parser.add_argument("--phase", choices=("start", "render"), default="start")
    args = parser.parse_args()

    project = resolve_project(args.project)
    sources = load_sources()
    if args.phase == "start":
        start(project, sources)
        return

    assert_context_current(project, sources)
    require_marker(
        project,
        "DESIGN.md",
        (
            "iteration-system: loaded",
            "style-profile: previous-editorial-v1",
            "layout-profile: previous-editorial-v1-layout",
            "rhythm-profile:",
            "mask-profile:",
        ),
    )
    require_marker(
        project,
        "QA.md",
        (
            "iteration-system: loaded",
            "style-profile: previous-editorial-v1",
            "layout-profile: previous-editorial-v1-layout",
            "rhythm-profile:",
            "mask-profile:",
        ),
    )
    print(f"Iteration render gate passed: {project.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
