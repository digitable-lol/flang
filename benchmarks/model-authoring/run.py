# -*- coding: utf-8 -*-
"""Прогон замера: задача → модель → компилятор.
#
# Условия подсказки, по возрастанию:
#   а — только задача
#   б — задача + выжимка синтаксиса (digest.md)
#   в — задача + выжимка + пять настоящих программ репозитория
#   г — та же выборка, что «в», плюс ОДИН круг исправления по ответу компилятора
#
# Условие «г» намеренно не порождает новой первой попытки: оно продолжает ту же
# самую попытку условия «в». Иначе разница «г минус в» смешивала бы стоимость
# обратной связи с разбросом генерации, а измерить надо первое.
#
# Службы моделей — чужие, их не поднимают и не гасят: сюда они приходят готовыми
# по 127.0.0.1 на карте, и обращение идёт через ssh-алиас gpu.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "/home/m/projects/flang-rest"
sys.path.insert(0, HERE)

from grade import grade, diagnostics_text  # noqa: E402
from tasks import TASKS  # noqa: E402

PORTS = {"M3": 8127, "M4": 8128}

# Пять программ репозитория для условия «в»: по одной на каждый вид задачи.
# Комментарии из них срезаны (в файлах они длиннее самих программ, а контекст
# 12288 токенов), сам код — байт в байт из рабочего дерева.
CORPUS = [
    "flang/examples/leetcode/509-fibonacci-number.flang",
    "flang/stdlib/lists.flang",
    "flang/examples/leetcode/104-maximum-depth-of-binary-tree.flang",
    "examples/utilities/discount.fts",
    "flang/conc/examples/budget.flang",
]
# У lists.flang берутся не все функции: целиком он длиннее остальных четырёх
# вместе, а «Длина» и «Обратить» — это задачи набора, показывать их ответом нельзя.
LISTS_KEEP = ["Соединить списки", "Отбросить первые"]


def strip_comments(text):
    out = []
    for line in text.split("\n"):
        if line.strip().startswith("//"):
            continue
        out.append(line)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


def cut_functions(text, keep):
    """Оставить в модуле только названные функции (для lists.flang)."""
    head = text.split("\n")[0]
    blocks = re.split(r"\n(?=тотальная функция |функция )", text)
    kept = [b for b in blocks[1:] if any(("«%s»" % name) in b.split("\n")[0] for name in keep)]
    return head + "\n\n" + "\n\n".join(b.strip() for b in kept) + "\n"


def corpus_text():
    parts = []
    for rel in CORPUS:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            body = strip_comments(f.read())
        if rel.endswith("lists.flang"):
            body = cut_functions(body, LISTS_KEEP)
        parts.append("── %s ──\n%s" % (rel, body))
    return "\n".join(parts)


DIGEST = open(os.path.join(HERE, "digest.md"), encoding="utf-8").read()
CORPUS_TEXT = corpus_text()

RULE = (
    "Ты пишешь программу на языке программирования flang. "
    "В ответе не должно быть ничего, кроме текста программы: один блок ```flang, "
    "внутри — вся программа целиком, без объяснений до и после."
)


def build_prompt(task, cond):
    """Сообщения для модели. Текст задачи во всех условиях ДОСЛОВНО один."""
    head = RULE
    if cond in ("б", "в", "г"):
        head += "\n\nВыжимка синтаксиса языка:\n\n" + DIGEST
    if cond in ("в", "г"):
        head += "\n\nПримеры настоящих программ из репозитория языка:\n\n" + CORPUS_TEXT
    return [
        {"role": "system", "content": head},
        {"role": "user", "content": "Задача.\n" + task["task"]},
    ]


FENCE = re.compile(r"```[a-zA-Zа-яА-Я]*\n(.*?)(?:```|\Z)", re.S)
START = re.compile(r"^(модуль|категория)\b", re.M)


def extract(text):
    """Программа из ответа модели.

    Правило одно и то же во всех условиях: если есть блок в тройных кавычках —
    берётся первый; иначе — от первой строки, начинающейся словом «модуль» или
    «категория», до конца. Ничего не дописывается и не правится.
    """
    m = FENCE.search(text)
    if m:
        body = m.group(1)
    else:
        m2 = START.search(text)
        body = text[m2.start():] if m2 else text
    return body.strip() + "\n"


def ask(model, messages, seed, max_tokens=1800, temperature=0.7, think=False):
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.95,
        "top_k": 40,
        "seed": seed,
        "chat_template_kwargs": {"enable_thinking": bool(think)},
    }
    url = "http://127.0.0.1:%d/v1/chat/completions" % PORTS[model]
    cmd = ["sudo", "-u", "m", "ssh", "gpu",
           "curl -s -m 600 %s -H 'Content-Type: application/json' -d @-" % url]
    for attempt in range(3):
        p = subprocess.run(cmd, input=json.dumps(payload, ensure_ascii=False),
                           capture_output=True, text=True, timeout=900)
        try:
            data = json.loads(p.stdout)
            return (data["choices"][0]["message"]["content"] or "",
                    data.get("usage", {}), data.get("timings", {}))
        except Exception:
            if attempt == 2:
                return "", {"error": p.stdout[:300] + p.stderr[:300]}, {}
            time.sleep(5)


def seed_of(*parts):
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:8], 16)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="M3")
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--conds", default="а,б,в")
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default="")
    # Отдельные плечи замера: «--think» включает рассуждение модели (у Qwen3 оно
    # отключаемое), «--label» переименовывает условие в ведомости, «--digest»
    # подменяет выжимку. Круг исправления в таких плечах не гоняется: они
    # сравниваются с условием «в», а не с «г».
    ap.add_argument("--think", action="store_true")
    ap.add_argument("--label", default="")
    ap.add_argument("--max-tokens", type=int, default=1800)
    ap.add_argument("--digest", default="")
    args = ap.parse_args()

    global DIGEST, CORPUS_TEXT
    if args.digest:
        DIGEST = open(args.digest, encoding="utf-8").read()

    conds = args.conds.split(",")
    tasks = [t for t in TASKS if not args.only or t["id"] in args.only.split(",")]
    outdir = args.out or os.path.join(HERE, "out", args.model)
    os.makedirs(outdir, exist_ok=True)
    ledger = open(os.path.join(outdir, "records.jsonl"), "a", encoding="utf-8")

    for rep in range(args.repeats):
        for task in tasks:
            ext = "fts" if task["surface"] == "fts" else "flang"
            for cond in conds:
                label = args.label or cond
                seed = seed_of(args.model, task["id"], cond, rep)
                t0 = time.time()
                text, usage, timings = ask(args.model, build_prompt(task, cond), seed,
                                           max_tokens=args.max_tokens, think=args.think)
                code = extract(text)
                d = os.path.join(outdir, label, "r%d" % rep)
                os.makedirs(d, exist_ok=True)
                path = os.path.join(d, task["id"] + "." + ext)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(code)
                v = grade(path, task)
                rec = dict(model=args.model, task=task["id"], kind=task["kind"], cond=label,
                           rep=rep, seed=seed, path=path, verdict=v, usage=usage,
                           think=bool(args.think), secs=round(time.time() - t0, 1))
                ledger.write(json.dumps(rec, ensure_ascii=False) + "\n")
                ledger.flush()
                print("%s %-20s %s r%d разбор=%d примеры=%d тотальная=%d печать=%d входы=%d %ds" % (
                    args.model, task["id"], label, rep, v["parse"], v["test"], v["total"],
                    v["emit"], v["sem"], rec["secs"]), flush=True)

                # ── условие «г»: тот же ответ плюс один круг по диагностике ──
                if cond != "в" or args.label:
                    continue
                full = v["parse"] and v["test"] and v["total"] and v["emit"]
                dg = os.path.join(outdir, "г", "r%d" % rep)
                os.makedirs(dg, exist_ok=True)
                path_g = os.path.join(dg, task["id"] + "." + ext)
                if full:
                    # Исправлять нечего: круг не тратится, ведомость та же.
                    with open(path_g, "w", encoding="utf-8") as f:
                        f.write(code)
                    rec_g = dict(rec, cond="г", path=path_g, repaired=False,
                                 usage2=None, secs2=0.0)
                    ledger.write(json.dumps(rec_g, ensure_ascii=False) + "\n")
                    ledger.flush()
                    print("  г %-20s круг не нужен" % task["id"], flush=True)
                    continue
                answer = diagnostics_text(path, task)
                msgs = build_prompt(task, "в") + [
                    {"role": "assistant", "content": "```flang\n" + code + "```"},
                    {"role": "user", "content":
                        "Компилятор отказал. Вот его ответ дословно:\n\n" + answer +
                        "\n\nИсправь программу. В ответе — только исправленная программа "
                        "целиком, один блок ```flang."},
                ]
                t1 = time.time()
                text2, usage2, _ = ask(args.model, msgs, seed_of(args.model, task["id"], "г", rep))
                code2 = extract(text2)
                with open(path_g, "w", encoding="utf-8") as f:
                    f.write(code2)
                v2 = grade(path_g, task)
                rec_g = dict(rec, cond="г", path=path_g, verdict=v2, repaired=True,
                             usage2=usage2, secs2=round(time.time() - t1, 1),
                             answer=answer[:1200])
                ledger.write(json.dumps(rec_g, ensure_ascii=False) + "\n")
                ledger.flush()
                print("  г %-20s разбор=%d примеры=%d тотальная=%d печать=%d входы=%d %ds" % (
                    task["id"], v2["parse"], v2["test"], v2["total"], v2["emit"], v2["sem"],
                    rec_g["secs2"]), flush=True)

    ledger.close()


if __name__ == "__main__":
    main()
