#!/bin/bash
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
for f in docs/benchmark2/*.flang; do
  printf "%-42s " "$f"
  node flang/bin/flang.mjs test "$f" --no-check 2>&1 | node -e '
    let s = ""
    process.stdin.on("data", (c) => (s += c))
    process.stdin.on("end", () => {
      try { const j = JSON.parse(s); console.log("всего", j.total, "зелёных", j.passed, "красных", j.failed) }
      catch { console.log("НЕ РАЗОБРАЛСЯ:", s.slice(0, 90)) }
    })'
done
