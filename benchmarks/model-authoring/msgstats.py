# -*- coding: utf-8 -*-
"""Частые ошибки не по коду, а по СМЫСЛУ: код FLANG_PARSE стоит на семи разных
промахах, и «править диагностику» без этого разделения значит не знать, какую.

Классы ниже — это подстроки сообщений самого компилятора. Ни одна строка не
придумана: она либо встречается в сообщении, либо класс не срабатывает.
"""

import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tasks import TASKS  # noqa: E402

KEYWORDS = set()
for m in re.finditer(r"ru:\s*\[([^\]]*)\]", open("/home/m/projects/flang-rest/flang/src/lexer.mjs", encoding="utf-8").read()):
    for w in re.findall(r'"([^"]+)"', m.group(1)):
        KEYWORDS.add(w)


def unexpected_word(rec):
    """Слово, на котором отказал разбор, и роль, в которой оно стояло."""
    m = re.search(r"неожиданное '([^']+)'", rec["verdict"]["detail"] or "")
    if not m:
        return None, None
    word = m.group(1)
    try:
        src = open(rec["path"], encoding="utf-8").read()
    except Exception:
        src = ""
    w = re.escape(word)
    # Слово стояло ИМЕНЕМ, если программа его где-то объявляет: параметром,
    # связкой, образцом или полем. Проверяется по всему файлу, а не по одной
    # строке: отказ приходит на ИСПОЛЬЗОВАНИИ, а объявление стоит выше.
    name_role = bool(re.search(r"(принимает[^\n]*?|,\s*)«?%s»?\s*:" % w, src)
                     or re.search(r"(пусть|как)\s+«?%s»?\b" % w, src)
                     or re.search(r"^\s*«?%s»?\s*:" % w, src, re.M))
    return word, ("имя" if name_role else "форма")


CLASSES = [
    ("отступ: объявления сдвинуты под «модуль»", r"ожидались 'экспортирует' или 'использует'"),
    ("неожиданное слово: форма собрана не так", r"не разобрана конструкция: неожиданное '"),
    ("разбор числа вместо «если»", r"ожидался образец|ожидалось литеральное значение"),
    ("нижняя граница числа не доказана", r"а нужно не меньше 0|не убывает"),
    ("мера не объявлена или не годится", r"FLANG_MEASURE|мера"),
    ("имя не связано (инфикс написан префиксом)", r"имя «[^»]+» не связано"),
    ("не то число аргументов", r"принимает \d+ арг"),
    ("тип не сошёлся", r"ожидался .*, получен |ожидалось .*, получено "),
    ("разбор не исчерпывающий", r"MATCH_NOT_EXHAUSTIVE|исчерпыва"),
    ("падеж после «является» (поверхность FTS)", r"FTS_NATURAL_NAME|ожидалось имя"),
    ("имя из задания не объявлено", r"нет тотальной|нет-функции|не найдена функция"),
    ("тело функции отсутствует или лишнее", r"больше одного тела|нет тела|ожидался конец блока"),
    ("пример не сошёлся с телом", r"^пример-не-сошёлся$"),
    ("примеров нет вовсе", r"^нет-примеров$"),
]


def classify(rec):
    v = rec["verdict"]
    hay = " ".join(v["codes"]) + " " + (v["detail"] or "")
    word, role = unexpected_word(rec)
    if word is not None:
        if role == "имя" and word in KEYWORDS:
            return "имя совпало с ключевым словом («%s» и подобные)" % word
        return "неожиданное слово в форме («%s»)" % word
    for name, pattern in CLASSES:
        if re.search(pattern, hay):
            return name
    return "прочее: " + (v["codes"] or ["без кода"])[0]


def merge(name):
    """Сводит одноимённые классы, у которых в скобках разные слова."""
    return re.sub(r" \(«[^)]*\)", "", name)


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "M3"
    conds = sys.argv[2].split(",") if len(sys.argv) > 2 else ["б", "в", "г"]
    path = os.path.join(HERE, "out", model, "records.jsonl")
    recs = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line:
            r = json.loads(line)
            recs[(r["task"], r["cond"], r["rep"])] = r
    recs = list(recs.values())
    keys = ["parse", "test", "total", "emit", "sem"]
    for cond in conds:
        sub = [r for r in recs if r["cond"] == cond]
        bad = [r for r in sub if not all(r["verdict"][k] for k in keys)]
        print("\n%s: условие «%s», упало %d из %d выборок" % (model, cond, len(bad), len(sub)))
        cnt = collections.Counter(merge(classify(r)) for r in bad)
        tasks = collections.defaultdict(collections.Counter)
        words = collections.defaultdict(collections.Counter)
        for r in bad:
            c = classify(r)
            tasks[merge(c)][r["task"]] += 1
            if c.startswith(("имя совпало", "неожиданное слово")):
                w = re.search(r"«([^»]+)»", c)
                if w:
                    words[merge(c)][w.group(1)] += 1
        for name, n in cnt.most_common():
            top = ", ".join("%s×%d" % (t, c) for t, c in tasks[name].most_common(4))
            ws = words.get(name)
            print("   %-42s %3d  %4.0f%%   %s%s" % (
                name, n, 100.0 * n / len(bad), top,
                ("  слова: " + ", ".join("%s×%d" % (w, c) for w, c in ws.most_common(5))) if ws else ""))


if __name__ == "__main__":
    main()
