#!/usr/bin/env python3
"""Scan the working tree and Git history for accidental private data.

This scanner intentionally uses only the Python standard library so it can run
before npm dependencies are installed and inside GitHub Actions.  It reports
locations and redacted evidence, never the value of a detected secret.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent.parent
MAX_TEXT_BYTES = 2_000_000

IGNORED_PARTS = {
    ".git",
    ".codex",
    ".cache",
    ".venv",
    "node_modules",
    "playwright-browsers",
    "output",
    "renders",
    "test-results",
}

MEDIA_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".mkv",
    ".avi",
    ".webm",
    ".wav",
    ".mp3",
    ".m4a",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
}

SUSPICIOUS_NAME = re.compile(
    r"(?i)(?:codex[-_ ]clipboard|粗剪|口播|玄策|xuance|个人|private|screenshot|screen[-_ ]?shot|录音|转写)"
)

SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("OpenAI-style token", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    (
        "credential assignment",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*[\"']?(?!\$\{|%[A-Z_]+%|<[^>]+>|your[_-]?|(?:process|environment)\.)[A-Za-z0-9_./+=-]{16,}"
        ),
    ),
)

WINDOWS_USER_PATH = re.compile(
    r"(?i)(?:[A-Za-z]:[\\/]+Users[\\/]+)(?!<|\$|%)([A-Za-z0-9][A-Za-z0-9._-]{1,})(?:[\\/]|$)"
)
UNIX_USER_PATH = re.compile(r"(?<![A-Za-z0-9:])(?:/Users|/home)/([A-Za-z0-9][A-Za-z0-9._-]{1,})(?:/|$)")
LOCAL_FOLDER = re.compile(r"(?i)(?:[\\/](?:AppData|Desktop|Downloads|Documents|Temp|私人素材)(?:[\\/]|$))")
EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]{1,64}@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![\w.-])")
PHONE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
ID_CARD = re.compile(r"(?<!\d)[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])\d{3}[\dXx](?!\d)")

ALLOWED_EMAIL_DOMAINS = {"example.com", "example.org", "example.net", "users.noreply.github.com"}


@dataclass(frozen=True)
class Finding:
    scope: str
    path: str
    kind: str
    line: int | None = None
    detail: str = ""


def _run_git(args: list[str], *, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=text,
    )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace") if isinstance(result.stderr, bytes) else result.stderr
        raise RuntimeError(f"git {' '.join(args)} failed: {message.strip()}")
    return result.stdout


def _mask(value: str) -> str:
    value = value.strip()
    if len(value) <= 8:
        return "[redacted]"
    return f"{value[:4]}…{value[-3:]}"


def _line_number(text: str, start: int) -> int:
    return text.count("\n", 0, start) + 1


def _path_is_ignored(relative: str) -> bool:
    return any(part in IGNORED_PARTS for part in Path(relative).parts)


def _git_repo_available() -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


def _name_findings(scope: str, relative: str) -> list[Finding]:
    findings: list[Finding] = []
    path = Path(relative)
    if path.suffix.lower() in MEDIA_EXTENSIONS:
        findings.append(Finding(scope, relative, "tracked media", detail="keep personal media outside the public repository"))
    if SUSPICIOUS_NAME.search(path.name):
        findings.append(Finding(scope, relative, "suspicious filename", detail="looks like personal media, a screenshot, or a local export"))
    return findings


def _text_from_bytes(data: bytes) -> str | None:
    if len(data) > MAX_TEXT_BYTES:
        # Large source files are still checked for binary markers and paths by
        # the caller, but avoiding a full decode keeps hooks fast.
        data = data[:MAX_TEXT_BYTES]
    if b"\x00" in data[:4096]:
        return None
    return data.decode("utf-8", "replace")


def _content_findings(scope: str, relative: str, data: bytes) -> list[Finding]:
    if len(data) > MAX_TEXT_BYTES:
        return [Finding(scope, relative, "oversized file not scanned", detail=f"file exceeds {MAX_TEXT_BYTES} bytes; review or keep it outside the repository")]
    text = _text_from_bytes(data)
    if text is None:
        return []
    findings: list[Finding] = []
    for kind, pattern in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            findings.append(Finding(scope, relative, kind, _line_number(text, match.start()), _mask(match.group(0))))
    for pattern, kind in (
        (WINDOWS_USER_PATH, "Windows user path"),
        (UNIX_USER_PATH, "Unix user path"),
        (LOCAL_FOLDER, "local folder path"),
        (PHONE, "phone number"),
        (ID_CARD, "Chinese ID number"),
    ):
        for match in pattern.finditer(text):
            findings.append(Finding(scope, relative, kind, _line_number(text, match.start()), _mask(match.group(0))))
    for match in EMAIL.finditer(text):
        domain = match.group(1).lower()
        if domain not in ALLOWED_EMAIL_DOMAINS:
            findings.append(Finding(scope, relative, "email address", _line_number(text, match.start()), _mask(match.group(0))))
    return findings


def _worktree_paths() -> list[str]:
    if _git_repo_available():
        output = _run_git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"], text=False)
        return [item.decode("utf-8", "surrogateescape") for item in output.split(b"\0") if item]
    # A GitHub ZIP has no index.  Walk the unpacked directory so setup can
    # still protect a beginner from accidentally publishing local material.
    paths: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if not _path_is_ignored(relative):
            paths.append(relative)
    return paths


def _staged_paths() -> list[str]:
    if not _git_repo_available():
        return []
    output = _run_git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], text=False)
    return [item.decode("utf-8", "surrogateescape") for item in output.split(b"\0") if item]


def _read_worktree(relative: str) -> bytes | None:
    path = ROOT / relative
    try:
        return path.read_bytes()
    except OSError:
        return None


def _read_staged(relative: str) -> bytes | None:
    result = subprocess.run(["git", "show", f":{relative}"], cwd=ROOT, capture_output=True, check=False)
    return result.stdout if result.returncode == 0 else None


def scan_worktree() -> list[Finding]:
    findings: list[Finding] = []
    for relative in _worktree_paths():
        if _path_is_ignored(relative):
            continue
        findings.extend(_name_findings("worktree", relative))
        data = _read_worktree(relative)
        if data is not None:
            findings.extend(_content_findings("worktree", relative, data))
    return findings


def scan_staged() -> list[Finding]:
    findings: list[Finding] = []
    for relative in _staged_paths():
        if _path_is_ignored(relative):
            continue
        findings.extend(_name_findings("staged", relative))
        data = _read_staged(relative)
        if data is not None:
            findings.extend(_content_findings("staged", relative, data))
    return findings


def scan_history() -> list[Finding]:
    """Scan every blob reachable from every local Git ref, deduplicated by SHA."""
    if not _git_repo_available():
        return []
    output = _run_git(["rev-list", "--objects", "--all"], text=True)
    findings: list[Finding] = []
    object_paths: dict[str, list[str]] = {}
    for line in output.splitlines():
        parts = line.split(" ", 1)
        if len(parts) != 2:
            continue
        object_id, relative = parts
        if _path_is_ignored(relative):
            continue
        object_paths.setdefault(object_id, []).append(relative)
    for object_id, paths in object_paths.items():
        object_type = str(_run_git(["cat-file", "-t", object_id], text=True)).strip()
        if object_type != "blob":
            continue
        data = _run_git(["cat-file", "-p", object_id], text=False)
        if isinstance(data, bytes):
            for relative in paths:
                findings.extend(_name_findings("history", relative))
                findings.extend(_content_findings("history", relative, data))
    return findings


def scan(*, include_history: bool = False, staged_only: bool = False) -> list[Finding]:
    findings = scan_staged() if staged_only else scan_worktree()
    if include_history:
        findings.extend(scan_history())
    # Keep output stable and avoid overwhelming a hook if the same match is
    # repeated in a generated file.
    unique: list[Finding] = []
    seen: set[Finding] = set()
    for finding in findings:
        if finding not in seen:
            seen.add(finding)
            unique.append(finding)
    return unique


def _print_findings(findings: Iterable[Finding], *, as_json: bool) -> None:
    findings = list(findings)
    if as_json:
        print(json.dumps([asdict(item) for item in findings], ensure_ascii=False, indent=2))
        return
    if not findings:
        print("Sensitive-data scan passed: no secrets, personal paths, PII, or unregistered media found.")
        return
    print(f"Sensitive-data scan failed: found {len(findings)} item(s); clean them before committing.")
    for item in findings:
        location = f"{item.path}:{item.line}" if item.line else item.path
        suffix = f" ({item.detail})" if item.detail else ""
        print(f"- [{item.scope}] {location} — {item.kind}{suffix}")
    print("Do not use git add . or git add -A; stage only the files explicitly intended for this change.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true", help="scan every blob reachable from local Git refs")
    parser.add_argument("--staged", action="store_true", help="scan the Git index only")
    parser.add_argument("--json", action="store_true", help="print JSON results")
    args = parser.parse_args(argv)
    try:
        findings = scan(include_history=args.history, staged_only=args.staged)
    except RuntimeError as exc:
        print(f"Sensitive-data scan could not run: {exc}", file=sys.stderr)
        return 2
    _print_findings(findings, as_json=args.json)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
