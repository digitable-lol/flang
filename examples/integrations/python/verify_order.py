#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause

"""Use FTS from Python through its stable JSON CLI boundary."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def run(*args: str) -> dict:
    process = subprocess.run(args, check=True, text=True, capture_output=True)
    return json.loads(process.stdout)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("context", type=Path)
    parser.add_argument("--fts-bin", default="fts")
    options = parser.parse_args()

    certificate = run(
        options.fts_bin,
        "certify",
        str(options.model),
        "--context",
        str(options.context),
    )
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as proof:
        json.dump(certificate, proof, ensure_ascii=False)
        proof.flush()
        verification = run(
            options.fts_bin,
            "verify",
            str(options.model),
            "--context",
            str(options.context),
            "--certificate",
            proof.name,
        )
    print(json.dumps(verification, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
