#!/bin/bash
cd /home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc
export LC_ALL=C.UTF-8
bootstrap/flang test "$1" --pretty 2>&1 | head -${2:-40}
date +%s
