#!/bin/bash
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
bootstrap/flang check "$1" --proof --pretty 2>&1 | grep -v '"total": true' | head -${2:-60}
date +%s
