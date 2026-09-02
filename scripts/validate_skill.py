"""Dependency-free checks for the public Codex skill package."""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


skill_path = ROOT / "SKILL.md"
if not skill_path.exists():
    fail("SKILL.md is missing")

text = skill_path.read_text(encoding="utf-8")
if not text.startswith("---\n"):
    fail("SKILL.md must start with YAML frontmatter")
frontmatter, separator, body = text[4:].partition("\n---\n")
if not separator:
    fail("SKILL.md frontmatter is not closed")

name_match = re.search(r"^name:\s*([a-z0-9-]+)\s*$", frontmatter, re.MULTILINE)
description_match = re.search(r"^description:\s*(.+)$", frontmatter, re.MULTILINE)
if not name_match or name_match.group(1) != "talk-to-publish-cn":
    fail("frontmatter name must be talk-to-publish-cn")
if not description_match or not description_match.group(1).strip():
    fail("frontmatter description is required")
if "TODO" in text or "C:\\Users\\" in text or "C:/Users/" in text:
    fail("placeholder or local absolute path found")

if not (ROOT / "agents" / "openai.yaml").exists():
    fail("agents/openai.yaml is missing")

for required_file in [
    "package.json",
    "package-lock.json",
    "requirements-whisper.txt",
    "scripts/setup.ps1",
    "scripts/doctor.ps1",
    "scripts/doctor.mjs",
    "scripts/whisper.ps1",
    "scripts/iteration_preflight.py",
    "references/dependencies.json",
    "references/iteration-system.md",
]:
    if not (ROOT / required_file).exists():
        fail(f"runtime file is missing: {required_file}")

dependencies = ROOT / "references" / "dependencies.json"
try:
    import json
    manifest = json.loads(dependencies.read_text(encoding="utf-8"))
except (OSError, ValueError) as exc:
    fail(f"dependencies.json is invalid: {exc}")
if not isinstance(manifest.get("dependencies"), list) or not manifest["dependencies"]:
    fail("dependencies.json must declare dependencies")
for dependency in manifest["dependencies"]:
    for field in ("name", "source", "source_url", "ref", "install", "verification", "scope"):
        if not dependency.get(field):
            fail(f"dependency manifest entry is missing {field}")
    if not isinstance(dependency.get("required"), bool):
        fail(f"dependency required flag must be boolean: {dependency.get('name')}")
if not any(dependency.get("required") is True for dependency in manifest["dependencies"]):
    fail("dependency manifest must contain at least one required entry")

for marker in ("blocked_by_dependencies", "hyperframes:hyperframes", "hyperframes:gsap", "remotion:remotion-best-practices", "iteration_preflight.py", "iteration-system.md", "layout-profile"):
    if marker not in text:
        fail(f"mandatory capability gate marker is missing: {marker}")

for reference in re.findall(r"\]\((references/[^)]+)\)", body):
    if not (ROOT / reference).exists():
        fail(f"missing linked reference: {reference}")

ignored_dirs = {
    ".git",
    ".venv",
    "node_modules",
    "projects",
    "output",
    "renders",
    "test-results",
    "playwright-report",
    ".cache",
    ".tmp",
    "tmp",
}
ignored_path_prefixes = {
    ("remotion", "public"),
}
for path in ROOT.rglob("*"):
    relative_parts = path.relative_to(ROOT).parts
    if any(part in ignored_dirs for part in relative_parts):
        continue
    if any(relative_parts[: len(prefix)] == prefix for prefix in ignored_path_prefixes):
        continue
    if path.is_file() and path.stat().st_size > 10 * 1024 * 1024:
        fail(f"unexpected large file: {path.relative_to(ROOT)}")

print("Skill package is valid")
