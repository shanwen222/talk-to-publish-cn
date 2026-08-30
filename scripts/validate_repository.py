#!/usr/bin/env python3
"""Repository-level release gate.

Unlike the fast pre-push hook, this command always scans the complete history
reachable from local refs.  CI calls it on every push and pull request.
"""

from __future__ import annotations

import argparse
import sys

from check_sensitive import _print_findings, scan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="print JSON results")
    args = parser.parse_args(argv)
    try:
        findings = scan(include_history=True)
    except RuntimeError as exc:
        print(f"Repository security validation could not run: {exc}", file=sys.stderr)
        return 2
    _print_findings(findings, as_json=args.json)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
