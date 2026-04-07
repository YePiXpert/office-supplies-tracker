from __future__ import annotations

import argparse
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO_ROOT / "VERSION"


def parse_version(raw: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", raw.strip())
    if not match:
        raise ValueError(f"Invalid semantic version: {raw!r}")
    return tuple(int(part) for part in match.groups())


def format_version(parts: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in parts)


def bump_version(version: str, bump_type: str) -> str:
    major, minor, patch = parse_version(version)
    if bump_type == "major":
        return format_version((major + 1, 0, 0))
    if bump_type == "minor":
        return format_version((major, minor + 1, 0))
    if bump_type == "patch":
        return format_version((major, minor, patch + 1))
    raise ValueError(f"Unsupported bump type: {bump_type}")


def replace_pattern(path: Path, pattern: str, replacement: str, *, expected_count: int | None = 1) -> None:
    content = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, content, flags=re.MULTILINE)
    if expected_count is not None and count != expected_count:
        raise ValueError(f"Unexpected replacement count for {path}: expected {expected_count}, got {count}")
    path.write_text(updated, encoding="utf-8")


def sync_version(version: str) -> None:
    VERSION_FILE.write_text(f"{version}\n", encoding="utf-8")

    replace_pattern(
        REPO_ROOT / "main.py",
        r'^(APP_VERSION = ")[^"]+(")$',
        rf'\g<1>{version}\g<2>',
    )
    replace_pattern(
        REPO_ROOT / "static" / "state.js",
        r"(appVersion:\s*')[^']+(')",
        rf'\g<1>{version}\g<2>',
    )
    replace_pattern(
        REPO_ROOT / "static" / "index.html",
        r"(\?v=)\d+\.\d+\.\d+",
        rf"\g<1>{version}",
        expected_count=4,
    )
    replace_pattern(
        REPO_ROOT / "installer.iss",
        r"^(AppVersion=).*$",
        rf"\g<1>{version}",
    )
    replace_pattern(
        REPO_ROOT / "installer" / "OfficeSuppliesTracker.iss",
        r'^(  #define MyAppVersion ")[^"]+(")$',
        rf'\g<1>{version}\g<2>',
    )
    replace_pattern(
        REPO_ROOT / "README.md",
        r"(当前版本：`)[^`]+(`)",
        rf"\g<1>{version}\g<2>",
    )
    replace_pattern(
        REPO_ROOT / "USAGE.md",
        r"(当前版本 `)[^`]+(`)",
        rf"\g<1>{version}\g<2>",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Bump and sync the project version.")
    parser.add_argument(
        "--bump",
        choices=("patch", "minor", "major"),
        help="Increment the specified semantic version component.",
    )
    parser.add_argument(
        "--set",
        dest="set_version",
        help="Set an explicit semantic version instead of bumping.",
    )
    args = parser.parse_args()

    if bool(args.bump) == bool(args.set_version):
        raise SystemExit("Specify exactly one of --bump or --set.")

    current_version = VERSION_FILE.read_text(encoding="utf-8").strip()
    next_version = args.set_version or bump_version(current_version, args.bump)
    parse_version(next_version)
    sync_version(next_version)
    print(next_version)


if __name__ == "__main__":
    main()
