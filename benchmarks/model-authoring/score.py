# -*- coding: utf-8 -*-
"""Свод замера: доли по условиям, разброс по повторам, частые ошибки.

Разброс печатается не «плюс-минус на глазок», а размахом по повторам: у каждого
повтора своя доля (по 24 задачам), и в таблице стоят минимум и максимум этих
долей рядом со средним. Разница между условиями объявляется значимой только
если она больше размаха обоих условий.
"""

import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tasks import TASKS  # noqa: E402

CONDS = ["а", "б", "в", "г"]
NAMES = {
    "а": "а: только задача",
    "б": "б: задача + выжимка",
    "в": "в: выжимка + примеры",
    "г": "г: то же + круг по диагностике",
}
STAGES = [("parse", "разобралось"), ("test", "прошло примеры"),
          ("total", "принято тотальным"), ("emit", "напечаталось в C"),
          ("sem", "сошлось на скрытых входах")]


def load(model):
    path = os.path.join(HERE, "out", model, "records.jsonl")
    recs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                recs.append(json.loads(line))
    # На случай повторного запуска: последняя запись по (задача, условие, повтор).
    uniq = {}
    for r in recs:
        uniq[(r["task"], r["cond"], r["rep"])] = r
    recs = list(uniq.values())
    # Неполные повторы в доли не идут: доля по 7 задачам и доля по 24 — разные
    # числа, и смешивать их значило бы печатать разброс, которого нет.
    ntasks = len(TASKS)
    full = set()
    for cond in {r["cond"] for r in recs}:
        for rep in {r["rep"] for r in recs}:
            if len([r for r in recs if r["cond"] == cond and r["rep"] == rep]) == ntasks:
                full.add((cond, rep))
    return [r for r in recs if (r["cond"], r["rep"]) in full]


def pct(n, d):
    return 0.0 if d == 0 else 100.0 * n / d


def table(recs, ntasks):
    reps = sorted({r["rep"] for r in recs})
    print("%-32s | %s" % ("условие", " | ".join("%-18s" % s[1][:18] for s in STAGES)))
    for cond in CONDS:
        cells = []
        for key, _ in STAGES:
            per_rep = []
            for rep in reps:
                sub = [r for r in recs if r["cond"] == cond and r["rep"] == rep]
                if sub:
                    per_rep.append(pct(sum(1 for r in sub if r["verdict"][key]), len(sub)))
            per_rep = per_rep or [0.0]
            mean = sum(per_rep) / len(per_rep)
            cells.append("%5.1f%% [%.0f…%.0f]" % (mean, min(per_rep), max(per_rep)))
        print("%-32s | %s" % (NAMES.get(cond, cond), " | ".join("%-18s" % c for c in cells)))
    print()
    print("в долях от %d задач, %d повторов; в скобках размах по повторам" % (ntasks, len(reps)))


def by_kind(recs):
    kinds = ["счёт", "список", "сумма", "свойство", "процесс"]
    print("\nпо видам задач (доля «прошло примеры И тотальная И напечаталось И входы»):")
    print("вид        задач | " + " | ".join("%-6s" % c for c in CONDS))
    for kind in kinds:
        row = []
        n = len({r["task"] for r in recs if r["kind"] == kind})
        for cond in CONDS:
            sub = [r for r in recs if r["cond"] == cond and r["kind"] == kind]
            good = sum(1 for r in sub if all(r["verdict"][k] for k, _ in STAGES))
            row.append("%5.0f%%" % pct(good, len(sub) or 1))
        print("%-10s %5d | %s" % (kind, n, " | ".join(row)))


def full_pass(recs):
    print("\nполный проход (все пять проверок сразу):")
    reps = sorted({r["rep"] for r in recs})
    for cond in CONDS:
        per_rep = []
        for rep in reps:
            sub = [r for r in recs if r["cond"] == cond and r["rep"] == rep]
            per_rep.append(pct(sum(1 for r in sub if all(r["verdict"][k] for k, _ in STAGES)), len(sub) or 1))
        mean = sum(per_rep) / len(per_rep)
        print("  %-32s %5.1f%%  размах %.0f…%.0f" % (NAMES[cond], mean, min(per_rep), max(per_rep)))


def repair_delta(recs):
    """Чего стоит один круг обратной связи: пары «в»→«г» по одной выборке."""
    pairs = {}
    for r in recs:
        if r["cond"] in ("в", "г"):
            pairs.setdefault((r["task"], r["rep"]), {})[r["cond"]] = r
    both = [p for p in pairs.values() if "в" in p and "г" in p]
    print("\nстоимость одного круга обратной связи (пары по одной и той же выборке, n=%d):" % len(both))
    for key, label in STAGES:
        was = sum(1 for p in both if p["в"]["verdict"][key])
        now = sum(1 for p in both if p["г"]["verdict"][key])
        fixed = sum(1 for p in both if not p["в"]["verdict"][key] and p["г"]["verdict"][key])
        broke = sum(1 for p in both if p["в"]["verdict"][key] and not p["г"]["verdict"][key])
        print("  %-26s в=%5.1f%%  г=%5.1f%%  +%.1f п.п. (исправлено %d, испорчено %d)" % (
            label, pct(was, len(both)), pct(now, len(both)), pct(now, len(both)) - pct(was, len(both)),
            fixed, broke))
    used = [p for p in both if p["г"].get("repaired")]
    fixed_full = sum(1 for p in used
                     if not all(p["в"]["verdict"][k] for k, _ in STAGES)
                     and all(p["г"]["verdict"][k] for k, _ in STAGES))
    print("  круг понадобился %d выборкам из %d; полностью выправил %d из них (%.0f%%)" % (
        len(used), len(both), fixed_full, pct(fixed_full, len(used) or 1)))
    # Сколько раз модель, получив диагностику, вернула ТО ЖЕ САМОЕ — байт в байт.
    same = 0
    for p in used:
        try:
            a = open(p["в"]["path"], encoding="utf-8").read().strip()
            b = open(p["г"]["path"], encoding="utf-8").read().strip()
            same += 1 if a == b else 0
        except Exception:
            pass
    print("  из них вернули программу байт в байт прежней: %d (%.0f%%)" % (same, pct(same, len(used) or 1)))


def codes(recs):
    print("\nчастые ошибки по кодам диагностики (первый код каждой упавшей выборки):")
    for cond in ("б", "в", "г"):
        cnt = collections.Counter()
        tasks_by_code = collections.defaultdict(set)
        sub = [r for r in recs if r["cond"] == cond]
        bad = [r for r in sub if not all(r["verdict"][k] for k, _ in STAGES)]
        for r in bad:
            c = (r["verdict"]["codes"] or ["без-кода"])[0]
            cnt[c] += 1
            tasks_by_code[c].add(r["task"])
        print("  условие «%s»: упало %d из %d" % (cond, len(bad), len(sub)))
        for code, n in cnt.most_common(12):
            print("      %-26s %3d  (%.0f%% падений)  задачи: %s" % (
                code, n, pct(n, len(bad) or 1), ", ".join(sorted(tasks_by_code[code])[:6])))


def worst_tasks(recs):
    print("\nзадачи, которые не решились ни разу ни в одном условии:")
    for t in TASKS:
        sub = [r for r in recs if r["task"] == t["id"]]
        if sub and not any(all(r["verdict"][k] for k, _ in STAGES) for r in sub):
            print("  %-20s (%s)" % (t["id"], t["kind"]))


def main():
    global CONDS
    model = sys.argv[1] if len(sys.argv) > 1 else "M3"
    recs = load(model)
    extra = sorted({r["cond"] for r in recs} - set(CONDS))
    CONDS = CONDS + extra
    print("=" * 100)
    print("модель %s, записей %d" % (model, len(recs)))
    print("=" * 100)
    table(recs, len({r["task"] for r in recs}))
    full_pass(recs)
    by_kind(recs)
    repair_delta(recs)
    codes(recs)
    worst_tasks(recs)


if __name__ == "__main__":
    main()
