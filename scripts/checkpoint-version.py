#!/usr/bin/env python3
"""Save a portable source + built-editor checkpoint without changing Git history."""

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile
from zoneinfo import ZoneInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="For example 01-filled-shapes")
    parser.add_argument("--validation", required=True, help="Checks and audit completed")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9]{2}-[a-z0-9-]+", args.name):
        parser.error("Use a numbered lowercase name, such as 01-filled-shapes")

    root = Path(__file__).resolve().parents[1]
    if not (root / "dest/prod/index.html").is_file():
        parser.error("Build the editor before saving a runnable checkpoint")
    destination = root.parent / "outputs" / "piskel-versions"
    destination.mkdir(parents=True, exist_ok=True)
    output = destination / f"{args.name}.zip"
    if output.exists():
        parser.error(f"Checkpoint already exists and will not be overwritten: {output}")

    metadata = {
        "name": args.name,
        "created": datetime.now(ZoneInfo("America/New_York")).isoformat(),
        "upstream_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True
        ).strip(),
        "validation": args.validation,
        "restore": "Extract to a separate folder and run Launch Piskel.command. Close the existing local server first.",
    }
    excluded = {".git", "node_modules", ".tools", "__pycache__", "cache"}
    with zipfile.ZipFile(output, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for current, directories, files in os.walk(root):
            relative = Path(current).relative_to(root)
            directories[:] = [name for name in directories if name not in excluded]
            if relative == Path("tests/e2e/playwright"):
                directories[:] = [name for name in directories if not name.startswith("tmp")]
            for name in sorted(files):
                if name != ".DS_Store":
                    archive.write(Path(current) / name, Path("Piskel") / relative / name)
        archive.writestr("Piskel/checkpoint.json", json.dumps(metadata, indent=2) + "\n")
    with zipfile.ZipFile(output) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise RuntimeError(f"Checkpoint verification failed: {corrupt}")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(".zip.sha256").write_text(f"{digest}  {output.name}\n")
    print(f"Saved {output} ({output.stat().st_size:,} bytes)")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
