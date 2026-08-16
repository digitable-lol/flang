#!/bin/bash
# Прогон `flang check` по всем файлам, переданным аргументами.
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
for f in "$@"; do
  printf "%-40s " "$f"
  if node flang/bin/flang.mjs check "$f" > .rab/out.txt 2> .rab/err.txt; then
    echo "OK"
  else
    head -c 300 .rab/err.txt | tr '\n' ' '
    echo
  fi
done
