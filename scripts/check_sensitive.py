#!/usr/bin/env python3
"""Dependency-free release safety scanner for this repository.

The scanner deliberately has one implementation and explicit modes:
``--worktree-only`` checks tracked and non-ignored untracked files,
``--history`` checks every commit reachable from local refs, and
``--pre-push`` checks the commit ranges Git is about to send. Findings only
contain source, path, rule, and commit; matched values are never printed.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Sequence


ROOT = Path(__file__).resolve().parent.parent
MAX_FILE_BYTES = 2_000_000
ZERO_SHA = "0" * 40

IGNORED_PARTS = {
    ".git",
    ".codex",
    ".cache",
    ".venv",
    "__pycache__",
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
    ".gif",
    ".webp",
    ".bmp",
    ".ico",
    ".pdf",
    ".zip",
}

SUSPICIOUS_NAME = re.compile(
    r"(?i)(?:codex[-_ ]clipboard|粗剪|口播|玄策|xuance|个人|private|screenshot|screen[-_ ]?shot|录音|转写)"
)

SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("openai-token", re.compile(r"\bsk-[A-Za-z0-9][A-Za-z0-9_-]{19,}\b")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{18,}\b")),
    ("bearer-token", re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{20,}")),
    ("basic-auth", re.compile(r"(?i)\bBasic\s+[A-Za-z0-9+/=]{20,}")),
    ("cookie-header", re.compile(r"(?i)\b(?:Cookie|Set-Cookie)\s*[:=]\s*[^\s]{16,}")),
    (
        "credential-assignment",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*[\"']?(?!\$\{|%[A-Z_]+%|<[^>]+>|your[_-]?|(?:process|environment)\.)[A-Za-z0-9_./+=-]{16,}"
        ),
    ),
)

WINDOWS_USER_PATH = re.compile(
    r"(?i)(?:[A-Za-z]:[\\/]+Users[\\/]+)(?!<|\$|%)(?:[A-Za-z0-9][A-Za-z0-9._-]{1,})(?:[\\/]|$)"
)
UNIX_USER_PATH = re.compile(r"(?<![A-Za-z0-9:])(?:/Users|/home)/[A-Za-z0-9][A-Za-z0-9._-]{1,}(?:/|$)")
LOCAL_FOLDER_PATH = re.compile(r"(?i)(?:[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+[\\/]+(?:AppData|Desktop|Downloads|Documents|Temp)[\\/])")
EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]{1,64}@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![\w.-])")
PHONE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
ID_CARD = re.compile(r"(?<!\d)[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])\d{3}[\dXx](?!\d)")
EMBEDDED_IMAGE = re.compile(r"(?i)data:image/(?:png|jpe?g|gif|webp|bmp|ico);base64,[A-Za-z0-9+/]{100,}={0,2}")

ALLOWED_EMAIL_DOMAINS = {"example.com", "example.org", "example.net", "example.invalid", "users.noreply.github.com"}

MAGIC_HEADERS: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "png-header"),
    (b"\xff\xd8\xff", "jpeg-header"),
    (b"GIF87a", "gif-header"),
    (b"GIF89a", "gif-header"),
    (b"%PDF-", "pdf-header"),
    (b"PK\x03\x04", "zip-header"),
    (b"PK\x05\x06", "zip-header"),
    (b"\x00\x00\x01\x00", "ico-header"),
)


@dataclass(frozen=True)
class Finding:
    source: str
    path: str
    rule: str
    commit: str


def _run_git(args: Sequence[str], *, text: bool = True) -> str | bytes:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=text, check=False)
    if result.returncode != 0:
        raise RuntimeError("git command failed")
    return result.stdout


def _git_repo_available() -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


def _path_is_ignored(relative: str) -> bool:
    return any(part in IGNORED_PARTS for part in Path(relative).parts)


def _finding(source: str, path: str, rule: str, commit: str) -> Finding:
    return Finding(source=source, path=path, rule=rule, commit=commit)


def _name_findings(source: str, relative: str, commit: str) -> list[Finding]:
    findings: list[Finding] = []
    if Path(relative).suffix.lower() in MEDIA_EXTENSIONS:
        findings.append(_finding(source, relative, "media-extension", commit))
    if SUSPICIOUS_NAME.search(Path(relative).name):
        findings.append(_finding(source, relative, "suspicious-filename", commit))
    return findings


def _magic_rule(data: bytes) -> str | None:
    for header, rule in MAGIC_HEADERS:
        if data.startswith(header):
            return rule
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] in {b"WAVE", b"AVI ", b"WEBP"}:
        return "riff-media-header"
    return None


def _content_findings(source: str, relative: str, commit: str, data: bytes) -> list[Finding]:
    findings: list[Finding] = []
    if len(data) > MAX_FILE_BYTES:
        findings.append(_finding(source, relative, "oversized-file", commit))
        data = data[:MAX_FILE_BYTES]
    magic = _magic_rule(data)
    if magic:
        findings.append(_finding(source, relative, magic, commit))
    if b"\x00" in data:
        findings.append(_finding(source, relative, "nul-byte-binary", commit))
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        findings.append(_finding(source, relative, "non-utf8-binary", commit))
        text = data.decode("utf-8", "replace")
    for rule, pattern in SECRET_PATTERNS:
        if pattern.search(text):
            findings.append(_finding(source, relative, rule, commit))
    for pattern, rule in (
        (WINDOWS_USER_PATH, "windows-private-path"),
        (UNIX_USER_PATH, "unix-private-path"),
        (LOCAL_FOLDER_PATH, "local-private-folder"),
        (PHONE, "phone-number"),
        (ID_CARD, "id-number"),
        (EMBEDDED_IMAGE, "embedded-base64-image"),
    ):
        if pattern.search(text):
            findings.append(_finding(source, relative, rule, commit))
    if any(domain.lower() not in ALLOWED_EMAIL_DOMAINS for domain in EMAIL.findall(text)):
        findings.append(_finding(source, relative, "email-address", commit))
    return findings


def _worktree_paths() -> list[str]:
    if _git_repo_available():
        output = _run_git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"], text=False)
        return [item.decode("utf-8", "surrogateescape") for item in output.split(b"\0") if item]
    paths: list[str] = []
    for path in ROOT.rglob("*"):
        if path.is_file():
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
    try:
        with (ROOT / relative).open("rb") as handle:
            return handle.read(MAX_FILE_BYTES + 1)
    except OSError:
        return None


def _read_staged(relative: str) -> bytes | None:
    result = subprocess.run(["git", "show", f":{relative}"], cwd=ROOT, capture_output=True, check=False)
    return result.stdout if result.returncode == 0 else None


def scan_worktree(*, staged_only: bool = False) -> list[Finding]:
    findings: list[Finding] = []
    paths = _staged_paths() if staged_only else _worktree_paths()
    source = "staged" if staged_only else "worktree"
    commit = "INDEX" if staged_only else "WORKTREE"
    for relative in paths:
        if _path_is_ignored(relative):
            continue
        findings.extend(_name_findings(source, relative, commit))
        data = _read_staged(relative) if staged_only else _read_worktree(relative)
        if data is not None:
            findings.extend(_content_findings(source, relative, commit, data))
    return findings


def _commit_tree(commit: str, source: str, blob_cache: dict[str, bytes]) -> list[Finding]:
    output = _run_git(["ls-tree", "-r", "-z", "--full-tree", commit], text=False)
    findings: list[Finding] = []
    for entry in output.split(b"\0"):
        if not entry or b"\t" not in entry:
            continue
        metadata, path_bytes = entry.split(b"\t", 1)
        parts = metadata.split()
        if len(parts) < 3 or parts[1] != b"blob":
            continue
        relative = path_bytes.decode("utf-8", "surrogateescape")
        if _path_is_ignored(relative):
            continue
        blob = parts[2].decode("ascii")
        if blob not in blob_cache:
            blob_cache[blob] = _run_git(["cat-file", "-p", blob], text=False)  # type: ignore[assignment]
        findings.extend(_name_findings(source, relative, commit))
        findings.extend(_content_findings(source, relative, commit, blob_cache[blob]))
    return findings


def _history_commits() -> list[str]:
    if not _git_repo_available():
        return []
    output = _run_git(["rev-list", "--all", "--reverse"], text=True)
    return [line.strip() for line in output.splitlines() if line.strip()]


def scan_history() -> list[Finding]:
    cache: dict[str, bytes] = {}
    findings: list[Finding] = []
    for commit in _history_commits():
        findings.extend(_commit_tree(commit, "history", cache))
    return findings


def _pre_push_commits(stdin_text: str) -> list[str]:
    if not _git_repo_available():
        return []
    commits: list[str] = []
    lines = [line.split() for line in stdin_text.splitlines() if line.split()]
    if not lines:
        head = str(_run_git(["rev-parse", "HEAD"], text=True)).strip()
        return [head] if head else []
    for parts in lines:
        if len(parts) < 4:
            continue
        local_sha, remote_sha = parts[1], parts[3]
        if local_sha == ZERO_SHA:
            continue
        revision = local_sha if remote_sha == ZERO_SHA else f"{remote_sha}..{local_sha}"
        output = _run_git(["rev-list", "--reverse", revision], text=True)
        commits.extend(line.strip() for line in output.splitlines() if line.strip())
    return list(dict.fromkeys(commits))


def scan_pre_push(stdin_text: str) -> list[Finding]:
    cache: dict[str, bytes] = {}
    findings = scan_worktree()
    for commit in _pre_push_commits(stdin_text):
        findings.extend(_commit_tree(commit, "pre-push", cache))
    return findings


def _dedupe(findings: Iterable[Finding]) -> list[Finding]:
    unique: list[Finding] = []
    seen: set[Finding] = set()
    for finding in findings:
        if finding not in seen:
            seen.add(finding)
            unique.append(finding)
    return unique


def _print_findings(findings: Iterable[Finding], *, as_json: bool) -> None:
    items = _dedupe(findings)
    if as_json:
        print(json.dumps([asdict(item) for item in items], ensure_ascii=False, indent=2))
        return
    if not items:
        print("Sensitive-data scan passed.")
        return
    for item in items:
        print(f"source={item.source} path={item.path} rule={item.rule} commit={item.commit}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--history", action="store_true", help="scan worktree and all reachable Git history")
    mode.add_argument("--worktree-only", action="store_true", help="scan tracked and non-ignored untracked files")
    mode.add_argument("--pre-push", action="store_true", help="scan worktree and commit ranges received on stdin")
    mode.add_argument("--staged", action="store_true", help="compatibility alias for scanning the Git index")
    parser.add_argument("--repo", type=Path, default=None, help="repository root to scan (defaults to this project)")
    parser.add_argument("--json", action="store_true", help="print JSON findings")
    args = parser.parse_args(argv)
    global ROOT
    if args.repo is not None:
        ROOT = args.repo.expanduser().resolve()
    try:
        if args.pre_push:
            findings = scan_pre_push(sys.stdin.read())
        elif args.history:
            findings = scan_worktree() + scan_history()
        elif args.staged:
            findings = scan_worktree(staged_only=True)
        else:
            findings = scan_worktree()
    except (OSError, RuntimeError) as exc:
        print(f"Sensitive-data scan could not run: {exc}", file=sys.stderr)
        return 2
    _print_findings(findings, as_json=args.json)
    return 1 if _dedupe(findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
