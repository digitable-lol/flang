#!/bin/bash
# Плечо с рассуждением запускается ПОСЛЕ основных прогонов: три службы на карте
# чужие, и занимать больше двух слотов из четырёх нельзя.
cd /home/m/projects/flang-rest/benchmarks/model-authoring
until [ "$(pgrep -u m -fc 'run.py')" = "0" ]; do sleep 60; done
sudo -u m -H python3 -u run.py --model M3 --repeats 3 --conds в --label 'в+думает' --think --max-tokens 4000 > run-M3-think.log 2>&1
echo THINK_ARM_DONE >> run-M3-think.log
