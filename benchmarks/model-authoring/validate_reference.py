# -*- coding: utf-8 -*-
"""Эталоны автора замера прогоняются тем же грейдером, что и ответы модели.
Пока здесь не 24 из 24, набор задач не годится: ноль у модели было бы не видно
от нуля у задачи.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from grade import grade  # noqa: E402
from tasks import TASKS  # noqa: E402

REF = os.path.join(HERE, "reference")
os.makedirs(REF, exist_ok=True)

ok = 0
for t in TASKS:
    ext = "fts" if t["surface"] == "fts" else "flang"
    path = os.path.join(REF, t["id"] + "." + ext)
    with open(path, "w", encoding="utf-8") as f:
        f.write(t["reference"])
    v = grade(path, t)
    good = v["parse"] and v["test"] and v["total"] and v["emit"] and v["sem"]
    ok += 1 if good else 0
    print("%-20s %s разбор=%d примеры=%d(%d) тотальная=%d печать=%d входы=%d %s" % (
        t["id"], "OK " if good else "БЕДА",
        v["parse"], v["test"], v["examples"], v["total"], v["emit"], v["sem"],
        "" if good else (",".join(v["codes"]) + " | " + v["detail"].replace("\n", " ")[:300])))

print("\nэталонов прошло: %d из %d" % (ok, len(TASKS)))
sys.exit(0 if ok == len(TASKS) else 1)
