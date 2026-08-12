# -*- coding: utf-8 -*-
"""Оценка одной программы четырьмя командами самого компилятора.
#
# Ни одного числа, посчитанного здесь, нет мимо CLI: каждая строчка ведомости —
# это код возврата и JSON от `flang check`, `flang test`, `flang run`,
# `flang emit --target c`. Разбирается только их вывод.
#
#   parse   — check прошёл, диагностик нет
#   test    — test прошёл, примеров больше нуля, упавших нет
#   total   — check назвал целевую функцию тотальной
#   emit    — печать в C прошла (она сама зовёт check и печатает только проверенное)
#   sem     — скрытые входы: run дал ровно ожидаемое значение (модель их не видит)
"""

import json
import os
import subprocess

ROOT = "/home/m/projects/flang-rest"
FLANG = [ "node", os.path.join(ROOT, "flang/bin/flang.mjs") ]


def _run(args, timeout=120):
    try:
        p = subprocess.run(FLANG + args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "TIMEOUT"


def _codes(text):
    """Коды диагностик из JSON-вывода команды; при неразборном выводе — пусто."""
    out = []
    try:
        data = json.loads(text)
    except Exception:
        return out
    for d in data.get("diagnostics", []) or []:
        if isinstance(d, dict) and d.get("code"):
            out.append(d["code"])
    return out


def _same(actual, expected):
    if isinstance(expected, bool) or isinstance(actual, bool):
        return actual is expected
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(actual - expected) < 1e-9
    if isinstance(expected, list) and isinstance(actual, list):
        return len(actual) == len(expected) and all(_same(a, e) for a, e in zip(actual, expected))
    if isinstance(expected, dict) and isinstance(actual, dict):
        if set(expected.keys()) != set(actual.keys()):
            return False
        return all(_same(actual[k], expected[k]) for k in expected)
    return actual == expected


def grade(path, task):
    """Ведомость по одной программе. path — абсолютный путь к файлу."""
    v = dict(parse=False, test=False, total=False, emit=False, sem=False,
             examples=0, failed=0, codes=[], stage="check", detail="")

    rc, out, err = _run(["check", path])
    if rc != 0:
        v["codes"] = _codes(err) or ["FLANG_NO_JSON"]
        v["detail"] = (err or out)[:2000]
        return v
    v["parse"] = True
    try:
        chk = json.loads(out)
    except Exception:
        v["codes"] = ["FLANG_NO_JSON"]
        v["detail"] = out[:2000]
        v["parse"] = False
        return v

    names = {f["name"]: f.get("total") is True for f in chk.get("functions", [])}
    v["total"] = names.get(task["fn"], False) is True
    if not v["total"]:
        # Своих кодов у этих случаев в языке нет — они видны только сравнением с
        # заданием. Пишутся строчными буквами, чтобы не путались с FLANG_*.
        v["codes"].append("нет-тотальной" if task["fn"] in names else "нет-функции-задания")
        # Функция могла быть названа иначе — это тоже провал условия, и его надо
        # видеть в разборе ошибок, а не только в итоговой доле.
        v["detail"] = "нет тотальной «%s»; есть: %s" % (task["fn"], ", ".join(sorted(names)) or "—")

    v["stage"] = "test"
    rc, out, err = _run(["test", path])
    body = out if rc == 0 else err
    try:
        tst = json.loads(body)
        v["examples"] = tst.get("total", 0)
        v["failed"] = tst.get("failed", 0)
        v["test"] = rc == 0 and v["examples"] > 0 and v["failed"] == 0
        if not v["test"]:
            if _codes(body):
                v["codes"] = v["codes"] + _codes(body)
            elif v["examples"] == 0:
                v["codes"].append("нет-примеров")
            else:
                v["codes"].append("пример-не-сошёлся")
    except Exception:
        v["codes"] = v["codes"] + (_codes(body) or ["FLANG_NO_JSON"])
        v["test"] = False
    if not v["test"] and not v["detail"]:
        v["detail"] = body[:2000]

    v["stage"] = "emit"
    rc, out, err = _run(["emit", path, "--target", "c"])
    v["emit"] = rc == 0
    if not v["emit"]:
        v["codes"] = v["codes"] + (_codes(err) or ["FLANG_EMIT_FAIL"])
        if not v["detail"]:
            v["detail"] = err[:2000]

    v["stage"] = "run"
    checks = task.get("checks") or []
    if not checks:
        # У процессных задач скрытых входов нет: их правильность проверяет
        # «прогон» внутри `flang test`, и второй раз считать её нечем.
        v["sem"] = v["test"]
    else:
        ok = True
        for args, expect in checks:
            rc, out, err = _run(["run", path, "--function", task["fn"], "--args", json.dumps(args, ensure_ascii=False)])
            if rc != 0:
                ok = False
                v["codes"] = v["codes"] + (_codes(err) or ["FLANG_RUN_FAIL"])
                if not v["detail"]:
                    v["detail"] = err[:800]
                break
            try:
                got = json.loads(out)["result"]
            except Exception:
                ok = False
                break
            if not _same(got, expect):
                ok = False
                v["codes"].append("вход-не-сошёлся")
                if not v["detail"]:
                    v["detail"] = "вход %s дал %s, ожидалось %s" % (
                        json.dumps(args, ensure_ascii=False), json.dumps(got, ensure_ascii=False),
                        json.dumps(expect, ensure_ascii=False))
                break
        v["sem"] = ok
    # Коды диагностик — только уникальные, в порядке появления.
    seen, uniq = set(), []
    for c in v["codes"]:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    v["codes"] = uniq
    return v


def diagnostics_text(path, task):
    """Ответ компилятора для круга исправления (условие «г»).

    Возвращается вывод ПЕРВОЙ команды, которая отказала, — ровно тот текст,
    который получил бы человек. Ничего не пересказывается своими словами.
    """
    rc, out, err = _run(["check", path])
    if rc != 0:
        return "flang check " + os.path.basename(path) + "\n" + (err or out)[:2500]
    rc, out, err = _run(["test", path])
    if rc != 0:
        return "flang test " + os.path.basename(path) + "\n" + (err or out)[:2500]
    rc2, out2, err2 = _run(["check", path])
    names = {}
    try:
        names = {f["name"]: f.get("total") is True for f in json.loads(out2).get("functions", [])}
    except Exception:
        pass
    if names.get(task["fn"]) is not True:
        return ("flang check " + os.path.basename(path) + "\n"
                + "разобралось, но тотальной функции «%s» в программе нет; объявлены: %s"
                % (task["fn"], ", ".join(sorted(names)) or "ни одной"))
    rc, out, err = _run(["emit", path, "--target", "c"])
    if rc != 0:
        return "flang emit --target c " + os.path.basename(path) + "\n" + (err or out)[:2500]
    # Скрытые входы в круг исправления НЕ едут: они не диагностика компилятора, и
    # показать их модели значило бы измерять другое.
    return ""
