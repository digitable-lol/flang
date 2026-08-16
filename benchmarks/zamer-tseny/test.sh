#!/bin/bash
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
node flang/bin/flang.mjs test "$1" --pretty 2>&1 | head -${2:-40}
date +%s
