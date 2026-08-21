#!/bin/bash
# Прогон `flang check` по всем файлам, переданным аргументами.
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
for f in "$@"; do
  printf "%-40s " "$f"
  if bootstrap/flang check "$f" > benchmarks/zamer-tseny/out.txt 2> benchmarks/zamer-tseny/err.txt; then
    echo "OK"
  else
    head -c 300 benchmarks/zamer-tseny/err.txt | tr '\n' ' '
    echo
  fi
done
