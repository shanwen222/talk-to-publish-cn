#!/usr/bin/env python3
"""Install this repository's pre-push hook without overwriting unknown hooks."""

from __future__ import annotations

import argparse
import shutil
import stat
import subprocess
import sys
from pathlib import Path


def git_dir(repo: Path) -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        cwd=repo,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("the --repo path is not a Git working tree")
    value = Path(result.stdout.strip())
    return value if value.is_absolute() else (repo / value).resolve()


def install(repo: Path, *, force: bool) -> tuple[bool, str]:
    source = repo / "hooks" / "pre-push"
    if not source.is_file():
        raise RuntimeError("hooks/pre-push is missing from this repository")
    destination = git_dir(repo) / "hooks" / "pre-push"
    destination.parent.mkdir(parents=True, exist_ok=True)
    source_bytes = source.read_bytes()
    if destination.exists():
        if destination.read_bytes() == source_bytes:
            return False, str(destination)
        if not force:
            raise RuntimeError("an unknown .git/hooks/pre-push exists; rerun with --force only after reviewing it")
    shutil.copyfile(source, destination)
    current_mode = destination.stat().st_mode
    destination.chmod(current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return True, str(destination)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=None, help="repository root (defaults to this project)")
    parser.add_argument("--force", action="store_true", help="replace an existing hook after reviewing it")
    args = parser.parse_args(argv)
    repo = (args.repo or Path(__file__).resolve().parent.parent).expanduser().resolve()
    try:
        changed, destination = install(repo, force=args.force)
    except (OSError, RuntimeError) as exc:
        print(f"Pre-push hook was not installed: {exc}", file=sys.stderr)
        return 1
    if changed:
        print(f"Installed pre-push safety hook at {destination}")
    else:
        print(f"Pre-push safety hook already matches {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
