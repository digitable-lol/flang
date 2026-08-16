# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause

"""Use FTS from Python through its stable JSON CLI boundary."""

import json
import subprocess
import sys
from pathlib import Path


def calculate(model: Path, input_file: Path) -> dict:
    repo = Path(__file__).resolve().parents[3]
    local_cli = repo / "dist" / "src" / "cli.js"
    command = [sys.executable, "-c", "raise SystemExit('fts build is missing')"]
    if local_cli.exists():
        command = ["node", str(local_cli)]
    else:
        command = ["fts"]
    result = subprocess.run(
        command
        + ["run", str(model), "--utility", "Рассчитать скидку", "--input", str(input_file)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[3]
    model = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "examples/utilities/discount.fts"
    input_file = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "examples/utilities/discount.input.json"
    print(json.dumps(calculate(model, input_file), ensure_ascii=False, indent=2))
