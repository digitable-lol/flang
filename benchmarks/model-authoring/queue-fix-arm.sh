#!/bin/bash
# Плечо «б+правка»: та же выжимка плюс ОДИН абзац про нулевой отступ. Разница с
# «б» — это цена одной строчки документации (или одной диагностики компилятора).
cd /home/m/projects/flang-rest/benchmarks/model-authoring
until [ "$(pgrep -u m -fc 'run.py')" = "0" ]; do sleep 60; done
sudo -u m -H python3 -u run.py --model M3 --repeats 3 --conds б --label 'б+правка' \
  --digest /home/m/projects/flang-rest/benchmarks/model-authoring/digest-indent.md > run-M3-fix.log 2>&1
echo FIX_ARM_DONE >> run-M3-fix.log
