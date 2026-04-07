#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {
    ".git",
    "__pycache__",
    "venv",
    "build",
    "dist",
    "dist-installer",
}


def iter_python_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.py"):
        if any(part in EXCLUDED_PARTS for part in path.parts):
            continue
        files.append(path)
    files.sort()
    return files


def validate_python_syntax(root: Path) -> None:
    for path in iter_python_files(root):
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec")


def run_regression_suite(root: Path) -> None:
    subprocess.run(
        [sys.executable, "scripts/run_regression_suite.py", "--no-report"],
        cwd=root,
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate project syntax and optional regression checks.")
    parser.add_argument(
        "--regression",
        action="store_true",
        help="Run the parser regression suite after syntax validation.",
    )
    args = parser.parse_args()

    validate_python_syntax(PROJECT_ROOT)
    if args.regression:
        run_regression_suite(PROJECT_ROOT)
    print("validation ok")


if __name__ == "__main__":
    main()
