# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause

"""
Прогонщик программы flang: JSON на входе, JSON на выходе.

Зачем он есть. Напечатанный модуль на Python — это библиотека, и вызвать её
можно только из Python. Но проверить кодогенератор нужно ровно одним способом —
сверкой с интерпретатором на сетке из тысяч входов, а поднимать интерпретатор
Python ради каждой точки сетки — это тысячи запусков процесса. Поэтому бэкенд
печатает ещё и прогонщик: один запуск, дальше поток запросов через трубу.

Побочная польза больше основной: точно так же программу на flang вызывает любой
язык, у которого есть трубы, — Node, shell, Go. Ни FFI, ни расширений C.

── Протокол (тот же, что у бэкендов C и Go) ────────────────────────────────
Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
Ответ  — одна строка:  {"ok":true,"value":…}
                       {"ok":false,"code":"FLANG_TYPE","message":"…"}

Значения размечены тегами, потому что JSON беднее flang:

    null            «ничто»
    true / false    признак
    {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
                    (по той же причине строкой едут «depth» и «steps»)
    {"s":"текст"}   строка
    {"l":[…]}       список
    {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
    {"v":"Имя","f":[["поле",…]]}       вариант

── Какой модуль исполнять ──────────────────────────────────────────────────
Имя модуля программы приходит первым аргументом командной строки: файл
программы называется по имени модуля flang, а прогонщик печатается байт в байт
и знать этого имени заранее не может. Без аргумента берётся «flang_program».

── Почему поток ────────────────────────────────────────────────────────────
Предел глубины вызовов flang по умолчанию 10⁴, и упереться в него обязан
счётчик языка, а не стек интерпретатора: исчерпание стека C — это не
исключение, а падение процесса. Поэтому вычисление живёт в потоке с явно
заданным большим стеком (rt.call_with_deep_stack), а не в главном, чей стек
задан при запуске процесса и обычно равен 8 МиБ.
"""

import importlib
import json
import math
import sys

import flang_runtime as rt

DEFAULT_PROGRAM_MODULE = "flang_program"


# ───────────────────────────── чтение значений ─────────────────────────────


def decode_value(node):
    """Значение из размеченного JSON."""
    if node is None:
        return rt.nothing()
    if node is True or node is False:
        return rt.flag(node)
    if not isinstance(node, dict):
        raise TypeError(f"нечего декодировать: {node!r}")
    if "n" in node:
        return rt.number(parse_number(node["n"]))
    if "s" in node:
        return rt.text(node["s"])
    if "l" in node:
        return rt.list_of([decode_value(item) for item in node["l"]])
    if "r" in node:
        return rt.record(decode_pairs(node["r"]))
    if "v" in node:
        return rt.variant(node["v"], decode_pairs(node.get("f", [])))
    raise ValueError(f"нечего декодировать: {node!r}")


def decode_pairs(pairs):
    """Поля записи или варианта: список пар «имя, значение»."""
    fields = {}
    for pair in pairs:
        if len(pair) != 2:
            raise ValueError("пара «имя, значение» обязана быть из двух элементов")
        fields[pair[0]] = decode_value(pair[1])
    return fields


def parse_number(value):
    """Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля."""
    if value == "NaN":
        return math.nan
    if value == "Infinity":
        return math.inf
    if value == "-Infinity":
        return -math.inf
    try:
        return float(value)
    except ValueError:
        return math.nan


# ───────────────────────────── печать значений ─────────────────────────────


def encode_value(value):
    """Значение в размеченный JSON."""
    tag = value.tag
    if tag == rt.TAG_NOTHING:
        return None
    if tag == rt.TAG_FLAG:
        return bool(value.data)
    if tag == rt.TAG_NUMBER:
        # −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно.
        if value.data == 0.0 and math.copysign(1.0, value.data) < 0:
            return {"n": "-0"}
        return {"n": rt.number_text(value.data)}
    if tag == rt.TAG_STRING:
        return {"s": value.data}
    if tag == rt.TAG_LIST:
        # Через list_items, а не через .data: список, выданный «добавить»,
        # делит массив с другими, и его содержимое это data[:end].
        return {"l": [encode_value(item) for item in rt.list_items(value)]}
    if tag == rt.TAG_RECORD:
        return {"r": [[name, encode_value(item)] for name, item in value.data.items()]}
    if tag == rt.TAG_VARIANT:
        return {
            "v": value.name,
            "f": [[name, encode_value(item)] for name, item in value.data.items()],
        }
    return None


# ───────────────────────────── запрос ─────────────────────────────


def failure(code, message):
    return {"ok": False, "code": code, "message": message}


def run_request(program, line):
    """Один запрос: разбор, вызов, ответ. Исключения наружу не выпускаются."""
    try:
        query = json.loads(line)
    except ValueError:
        return failure("CLI", "неразборчивый запрос")
    if not isinstance(query, dict) or not query.get("fn"):
        return failure("CLI", "в запросе нет имени функции")

    ctx = program.new_context()
    if query.get("depth"):
        ctx.max_depth = int(parse_number(query["depth"]))
    if query.get("steps"):
        ctx.max_steps = int(parse_number(query["steps"]))

    try:
        args = [decode_value(item) for item in query.get("args", [])]
    except (ValueError, TypeError, KeyError):
        return failure("CLI", "неразборчивые аргументы")

    try:
        # Граница входа — ДО вызова: значения приехали снаружи, программой не
        # являются и сверяются с объявленными типами. Значение вне типа выносит
        # вместе с типом и доказательство завершения `тотальной`, а поймать
        # вечную цепочку потом нечем — сторожа в тотальной функции нет.
        rt.check_entry(program.entry(), query["fn"], args)
        result = program.call(ctx, query["fn"], args)
    except rt.FlangError as error:
        return failure(error.code, error.message)
    except RecursionError:
        # Предел Python сработал раньше предела языка: так бывает только при
        # заведомо запредельном max_depth (см. MAX_RECURSION_LIMIT рантайма).
        # Молчать об этом нельзя — но и притворяться диагностикой языка тоже.
        return failure(
            rt.CODE_RECURSION_LIMIT,
            "предел рекурсии Python исчерпан раньше предела глубины flang",
        )
    return {"ok": True, "value": encode_value(result)}


# ───────────────────────── строка, которая не текст ─────────────────────────
#
# Запрос протокола — строка, а строка в этом языке UTF-8 (SPEC, раздел 5). До
# 22 августа 2026 негодный октет проходил сквозь восемь прогонщиков ПЯТЬЮ
# разными способами, и отказом не был ни один. Python падал трассировкой
# UnicodeDecodeError: чужой рантайм рассказывал о своём устройстве вместо того,
# чтобы язык назвал октет. Замер и таблица —
# scripts/bad-octet-guard.sh.
#
# Теперь у семи целей из восьми одно: диагностика FLANG_IO_NOT_TEXT в поток
# ошибок, код возврата 1, разбора нет. Строки ДО негодной уже отвечены и
# остаются отвеченными. Восьмая, js, названа долгом вслух: её прогонщик —
# рукописный JavaScript, править который в этом дереве запрещено.
#
# Строки с негодным октетом в Python не бывает вовсе — str хранит кодовые точки,
# а не октеты. Поэтому вход читается ОКТЕТАМИ (sys.stdin.buffer), и отказ стоит
# на входе, до всякого декодирования: иначе судить было бы уже нечего.


def not_text_at(raw):
    """Первый октет, не складывающийся в UTF-8, — номером с единицы; 0 — текст.

    Свой разбор, а не bytes.decode: ответ нужен НОМЕРОМ, и правила обязаны
    совпасть с `fl_utf8_not_text_at` рантайма C до пересокращённой записи и
    суррогатов включительно.
    """
    at = 0
    size = len(raw)
    while at < size:
        lead = raw[at]
        if lead < 0x80:
            at += 1
            continue
        if lead & 0xE0 == 0xC0:
            more, point = 1, lead & 0x1F
        elif lead & 0xF0 == 0xE0:
            more, point = 2, lead & 0x0F
        elif lead & 0xF8 == 0xF0:
            more, point = 3, lead & 0x07
        else:
            return at + 1
        if at + more >= size:
            return at + 1
        for step in range(1, more + 1):
            following = raw[at + step]
            if following & 0xC0 != 0x80:
                return at + 1
            point = (point << 6) | (following & 0x3F)
        # Пересокращённая запись, суррогат и всё выше U+10FFFF — тоже не текст:
        # иначе у одного знака было бы два написания, и счёт разошёлся бы.
        if (
            (more == 1 and point < 0x80)
            or (more == 2 and point < 0x800)
            or (more == 3 and point < 0x10000)
            or point > 0x10FFFF
            or 0xD800 <= point <= 0xDFFF
        ):
            return at + 1
        at += more + 1
    return 0


def refuse_not_text(number, raw, at):
    """Отказ «строка не текст»: номер строки, номер октета в ней (с единицы),
    длина строки в октетах и значение негодного октета. Текст один на семь
    целей — сторож сверяет его байт в байт."""
    sys.stderr.write(
        f"FLANG_IO_NOT_TEXT: строка {number} не текст: октет {at} из {len(raw)} "
        f"(0x{raw[at - 1]:02X}) не складывается в UTF-8; запрос обязан ехать в UTF-8\n"
    )
    sys.stderr.flush()


def serve(program, source, sink):
    """Цикл «строка запроса → строка ответа». Ответ ровно один на запрос.

    Возвращает код возврата процесса: 0 — вход кончился, 1 — вход не текст.
    """
    number = 0
    for raw in source:
        number += 1
        # Хвостовой «\r» снимается ТОЛЬКО для счёта: он ASCII и текстом быть не
        # мешает, а число «из скольких» обязано совпасть с теми целями, чей
        # построчный читатель снимает его сам (Go, Java, C#).
        raw = raw.rstrip(b"\r\n")
        at = not_text_at(raw)
        if at > 0:
            sink.flush()
            refuse_not_text(number, raw, at)
            return 1
        line = raw.decode("utf-8").strip()
        if not line:
            continue
        answer = run_request(program, line)
        sink.write(json.dumps(answer, ensure_ascii=False, separators=(",", ":")))
        sink.write("\n")
        sink.flush()
    return 0


def main(argv):
    name = argv[1] if len(argv) > 1 else DEFAULT_PROGRAM_MODULE
    program = importlib.import_module(name)
    # Вход — октетами, вывод — знаками: судить о UTF-8 можно только там, где
    # октеты ещё есть.
    return rt.call_with_deep_stack(
        lambda: serve(program, sys.stdin.buffer, sys.stdout)
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv))
