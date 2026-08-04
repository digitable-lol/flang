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
        return {"l": [encode_value(item) for item in value.data]}
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


def serve(program, source, sink):
    """Цикл «строка запроса → строка ответа». Ответ ровно один на запрос."""
    for line in source:
        line = line.strip()
        if not line:
            continue
        answer = run_request(program, line)
        sink.write(json.dumps(answer, ensure_ascii=False, separators=(",", ":")))
        sink.write("\n")
        sink.flush()


def main(argv):
    name = argv[1] if len(argv) > 1 else DEFAULT_PROGRAM_MODULE
    program = importlib.import_module(name)
    rt.call_with_deep_stack(lambda: serve(program, sys.stdin, sys.stdout))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
