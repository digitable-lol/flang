# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause

"""
Рантайм flang для бэкенда Python.

Этот файл печатается бэкендом как есть, байт в байт: он лежит рядом настоящим
.py, а не строкой внутри emit/python.mjs, поэтому его проверяет сам Python
(и ruff, если он есть) прямо в репозитории, а правка рантайма не превращается в
правку экранирования внутри шаблона. Единственное, что бэкенд делает с ним, —
приписывает шапку «сгенерировано, не редактировать» перед этой строкой.

── Почему рантайм вообще нужен ─────────────────────────────────────────────
Python выглядит близким к flang (динамические значения, строки в кодовых
точках, произвольная точность у целых), и ровно поэтому печатать «в лоб» здесь
опаснее, чем в Go или C: расхождения не видны компилятору, они всплывают
значением. Их четыре, и все четыре закрыты здесь.

1. ЧИСЛА. В flang все числа — IEEE-754 double (SPEC, раздел 2). В Python есть
   отдельный тип int неограниченной точности, и `2 ** 70` там точное, а в flang
   нет. Поэтому число flang — всегда float, а печать числа идёт через
   number_text: правила ECMAScript Number::toString дословно. repr(1.0) даёт
   «1.0», str(1e21) — «1e+21», а Number::toString — «1» и «1e+21»; расхождение
   хотя бы в одном знаке — это расхождение наблюдаемого поведения с
   интерпретатором, потому что «к строке» от числа видно пользователю.

2. ДЕЛЕНИЕ НА НОЛЬ. В Python `1.0 / 0.0` возбуждает ZeroDivisionError, а flang
   обязан дать Infinity (SPEC, раздел 5: это значение IEEE-754, а не ошибка).
   Поэтому вся арифметика идёт через функции рантайма, и деление ловит
   исключение, а не полагается на процессор.

3. РАВЕНСТВО. Скаляры flang сравниваются как Object.is: NaN равен NaN, 0 не
   равен −0. В Python ровно наоборот: `nan == nan` ложно, `0.0 == -0.0`
   истинно. Плюс `True == 1` — истина, потому что bool наследник int. Поэтому
   значение размечено тегом, а равенство своё (см. equal и same_number).

4. РЕКУРСИЯ. У Python свой предел глубины (sys.setrecursionlimit) и свой стек
   потока. Он не имеет права подменять собой предел языка: программа обязана
   сказать FLANG_RECURSION_LIMIT там же, где его говорит интерпретатор, а не
   раньше и не RecursionError. Поэтому Ctx поднимает предел Python под свой
   max_depth (ensure_recursion_capacity), а прогонщик исполняет вычисление в
   потоке с большим стеком (call_with_deep_stack).

── Представление значения: класс с тегом ───────────────────────────────────
Значения flang (SPEC, раздел 2) — скаляр, список, запись, вариант. Соблазн
отобразить их на родные типы Python (str, float, bool, None, list, dict) велик,
но неисполним: bool в Python — подтип int, отдельного «варианта» нет вовсе, а
структурное равенство пришлось бы всё равно писать своё. Два представления
одного значения дают два набора расхождений с интерпретатором, поэтому
представление одно: тег плюс полезная нагрузка.

Типизированный слой поверх него печатает бэкенд — функциями-конструкторами: на
каждый вариант суммы и на каждую запись своя функция с именованными
параметрами.

── Ошибки ──────────────────────────────────────────────────────────────────
Диагностика flang — это код («FLANG_TYPE») и текст, дословно совпадающий с
интерпретатором. В Python это исключение FlangError: язык устроен так, что
ошибку здесь несут исключением, а не возвращаемым значением, и напечатанный код
от этого становится короче ровно на всю обработку ошибок, которая в бэкенде Go
занимает половину тела каждой функции.

Код — строка, а не перечисление: коды flang перечислимы, но код нарушенного
постусловия приезжает данными из AST («FTS_UTILITY_PROPERTY» у моделей FTS), и
перечисление перестало бы быть источником истины ровно там, где важнее всего
совпасть с ядром.
"""

import hashlib
import math
import sys
import threading
from decimal import Decimal

# ───────────────────────────── коды диагностик ─────────────────────────────

# Коды диагностик (SPEC, раздел 7) — константами, чтобы не разъехались опечатки.
CODE_TYPE = "FLANG_TYPE"
CODE_UNKNOWN_NAME = "FLANG_UNKNOWN_NAME"
CODE_MATCH = "FLANG_MATCH_NOT_EXHAUSTIVE"
CODE_BUILTIN_ARGS = "FLANG_BUILTIN_ARGS"
CODE_RECURSION_LIMIT = "FLANG_RECURSION_LIMIT"
CODE_PROPERTY = "FLANG_PROPERTY"
CODE_PARSE = "FLANG_PARSE"


class FlangError(Exception):
    """Диагностика flang: код и текст, дословно совпадающие с интерпретатором."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def fail(code, message):
    """Собирает диагностику. Возвращает исключение — возбуждает вызывающий."""
    return FlangError(code, message)


# ───────────────────────────── значения ─────────────────────────────

# Виды значений (SPEC, раздел 2). Порядок значения не имеет: тег сравнивается
# только на равенство.
TAG_NOTHING = 0
TAG_NUMBER = 1
TAG_FLAG = 2
TAG_STRING = 3
TAG_LIST = 4
TAG_RECORD = 5
TAG_VARIANT = 6


class Value:
    """Значение flang: тег плюс полезная нагрузка.

    data — по тегу: None у «ничто», float у числа, bool у признака, str у
    строки, list[Value] у списка, dict[str, Value] у записи и варианта. name —
    имя варианта (у остальных пустая строка). Порядок полей сохраняется: он
    наблюдаем при печати значения наружу, хотя на равенство и не влияет
    (в dict Python порядок вставки гарантирован языком с версии 3.7).

    Значения неизменяемы по договору: ни рантайм, ни напечатанный код не правят
    ни список, ни словарь после создания, поэтому «хвост» и «добавить» могут
    делить память с исходным значением там, где это ничего не меняет.

    ── end: длина списка, когда список делит массив с другими ──────────────
    Список бывает в двух состояниях, и различает их именно end.

    * ТОЧНЫЙ (end is None) — data и есть содержимое, ровно своей длины. Так
      выглядят литералы, «отобразить», «отфильтровать», «разделить», «символы»
      и всё, что построено с нуля.
    * РАСТУЩИЙ (end — целое) — содержимое это data[:end], а сам список data
      общий: его конец могут занимать элементы уже ДРУГОГО списка. Так
      выглядит только то, что выдало «добавить» (см. b_append).

    Инвариант, он же доказательство неизменяемости: элементы data никто не
    перезаписывает — единственная правка это append В КОНЕЦ, и право на неё
    имеет ровно один список, тот, чей end совпал с len(data). После append
    len(data) вырос, значит прежний владелец право потерял НАВСЕГДА (len только
    растёт), а получил его ровно один новый список. Отсюда: ячейки внутри
    списка не пишет никто, ячейка за концом занимается не более одного раза, а
    ветвление двух «добавить» от одного значения даёт два независимых списка —
    второе «добавить» видит end < len(data) и уходит на копию.

    Зачем это нужно: без общего массива накопление списка n вызовами «добавить»
    стоит O(n²), потому что каждый вызов копирует весь список. Тогда один шаг
    вычисления стоит O(длины), и объявленный предел шагов перестаёт ограничивать
    работу: точка «Строить скобки» от 42 и 0 и 0 и "" и [] при объявленных
    5 000 000 шагов не отвечала и за 60 с. Тот же приём и по той же причине
    стоит в бэкендах C (fl_b_dobavit), Rust (Items::grown) и Go (BAppend).

    Читать содержимое списка напрямую через .data нельзя — только через
    list_items (точная длина) или require_list (то же плюс запрет на рост под
    ногами обхода).
    """

    __slots__ = ("data", "end", "name", "tag")

    def __init__(self, tag, data=None, name="", end=None):
        self.tag = tag
        self.data = data
        self.name = name
        self.end = end

    def __repr__(self):
        return f"<flang {type_name(self)}: {describe(self)}>"


def list_items(value):
    """Содержимое списка ровно своей длины.

    У точного списка это сам data и стоит ничего. У растущего, который уже
    потерял право на рост (за его концом лежит чужой элемент), содержимое
    обрезается копией — один раз за жизнь значения: копия тут же становится
    точной, и второе чтение снова стоит ничего.

    Вызывать только на списке: тег проверяет вызывающий.
    """
    end = value.end
    if end is None:
        return value.data
    items = value.data
    if end == len(items):
        return items
    trimmed = items[:end]
    value.data = trimmed
    value.end = None
    return trimmed


def list_length(value):
    """Длина списка. Вызывать только на списке: тег проверяет вызывающий."""
    end = value.end
    return len(value.data) if end is None else end


NOTHING = Value(TAG_NOTHING)
TRUE = Value(TAG_FLAG, True)
FALSE = Value(TAG_FLAG, False)


def nothing():
    """«ничто»."""
    return NOTHING


def number(value):
    """Число. Всегда float: целых чисел в flang нет (SPEC, раздел 2)."""
    return Value(TAG_NUMBER, float(value))


def flag(value):
    """Признак."""
    return TRUE if value else FALSE


def text(value):
    """Строка."""
    return Value(TAG_STRING, value)


def list_of(items):
    """Список из готового списка значений. Список переходит во владение.

    Выдаётся ТОЧНЫМ (end is None), права дописывать в конец не получает: тот,
    кто собрал items, мог оставить себе ссылку на них, и продление на месте
    испортило бы ему значение. Право на рост раздаёт одно место — «добавить»,
    и только своей же свежей копии (см. b_append).
    """
    return Value(TAG_LIST, items)


def record(fields):
    """Запись из словаря «имя поля → значение»."""
    return Value(TAG_RECORD, fields)


def variant(name, fields):
    """Вариант суммы типов."""
    return Value(TAG_VARIANT, fields, name)


def is_scalar(value):
    """Скаляр ли значение (SPEC, раздел 2: строка, число, признак, ничто)."""
    return value.tag <= TAG_STRING


def is_list(value):
    """Список ли значение."""
    return value.tag == TAG_LIST


def is_record(value):
    """Запись ли значение."""
    return value.tag == TAG_RECORD


# Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост» разбирают обе.
# У строки ровно два случая, пустая и «первый символ и остаток», третьего нет.
# По кодовым точкам: str Python и есть последовательность кодовых точек, поэтому
# срез здесь совпадает с «символ» и «символы» без дополнительных усилий.
def chain_empty(value):
    """Пустая ли цепочка — пустой список или пустая строка."""
    if value.tag == TAG_STRING:
        return len(value.data) == 0
    return value.tag == TAG_LIST and list_length(value) == 0


def chain_cons(value):
    """Непустая ли цепочка."""
    if value.tag == TAG_STRING:
        return len(value.data) > 0
    return value.tag == TAG_LIST and list_length(value) > 0


def chain_head(value):
    """Голова цепочки: первый элемент списка или первый символ строки.

    data[0] годится и у растущего списка: нулевая ячейка лежит внутри
    содержимого всегда, когда цепочка непуста (это проверил chain_cons).
    """
    if value.tag == TAG_STRING:
        return text(value.data[0])
    return value.data[0]


def chain_tail(value):
    """Хвост цепочки: остаток списка или остаток строки."""
    if value.tag == TAG_STRING:
        return text(value.data[1:])
    return list_of(list_items(value)[1:])


def is_variant(value):
    """Вариант ли значение."""
    return value.tag == TAG_VARIANT


def variant_is(value, name):
    """Вариант ли значение с именно этим именем (проверка дискриминанта)."""
    return value.tag == TAG_VARIANT and value.name == name


def type_name(value):
    """Имя типа значения для диагностик (typeName интерпретатора)."""
    tag = value.tag
    if tag == TAG_NOTHING:
        return "ничто"
    if tag == TAG_STRING:
        return "строка"
    if tag == TAG_NUMBER:
        return "число"
    if tag == TAG_FLAG:
        return "признак"
    if tag == TAG_LIST:
        return "список"
    if tag == TAG_VARIANT:
        return "вариант «" + value.name + "»"
    if tag == TAG_RECORD:
        return "запись"
    return "неизвестное значение"


def describe(value):
    """Короткое описание значения для диагностик (describeValue интерпретатора).

    Порядок проверок повторяет оригинал: строка, вариант, список, запись,
    «ничто», признак, число.
    """
    tag = value.tag
    if tag == TAG_STRING:
        return quote_json(value.data)
    if tag == TAG_VARIANT:
        if not value.data:
            return value.name
        return value.name + "(" + ", ".join(value.data.keys()) + ")"
    if tag == TAG_LIST:
        return "список из " + str(list_length(value))
    if tag == TAG_RECORD:
        return "запись {" + ", ".join(value.data.keys()) + "}"
    if tag == TAG_NOTHING:
        return "ничто"
    if tag == TAG_FLAG:
        return "да" if value.data else "нет"
    return number_text(value.data)


# ───────────────────────────── равенство ─────────────────────────────


def same_number(left, right):
    """Object.is для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).

    Это не придирка: ядро FTS сравнивает значения именно так, и «0.1 плюс 0.2
    равно 0.3» обязано быть ложью в обоих движках. В Python `nan == nan` ложно,
    а `0.0 == -0.0` истинно — то есть родное равенство расходится с языком в
    обе стороны сразу.
    """
    if math.isnan(left):
        return math.isnan(right)
    if left == 0.0 and right == 0.0:
        return math.copysign(1.0, left) == math.copysign(1.0, right)
    return left == right


def equal(left, right):
    """Равенство значений: скаляры как Object.is, составные структурно.

    Рекурсия здесь по данным, а не по программе: её глубина ограничена
    вложенностью значения, а не длиной вычисления.
    """
    if is_scalar(left) or is_scalar(right):
        if not is_scalar(left) or not is_scalar(right) or left.tag != right.tag:
            return False
        if left.tag == TAG_NUMBER:
            return same_number(left.data, right.data)
        if left.tag == TAG_FLAG:
            return left.data == right.data
        if left.tag == TAG_STRING:
            return left.data == right.data
        return True  # оба «ничто»
    if left.tag == TAG_LIST and right.tag == TAG_LIST:
        a_items = list_items(left)
        b_items = list_items(right)
        if len(a_items) != len(b_items):
            return False
        return all(equal(a, b) for a, b in zip(a_items, b_items))
    if left.tag == TAG_VARIANT and right.tag == TAG_VARIANT:
        return left.name == right.name and fields_equal(left.data, right.data)
    if left.tag == TAG_RECORD and right.tag == TAG_RECORD:
        return fields_equal(left.data, right.data)
    return False


def fields_equal(left, right):
    """Равенство записей: по именам полей, а не по их порядку."""
    if len(left) != len(right):
        return False
    for name, value in left.items():
        if name not in right or not equal(value, right[name]):
            return False
    return True


# ───────────────────────────── число в текст ─────────────────────────────


def number_text(value):
    """Печатает число ровно по правилам ECMAScript Number::toString.

    Это не украшение: «к строке» от числа и тексты диагностик содержат числа, и
    расхождение хотя бы в одном знаке — расхождение наблюдаемого поведения с
    интерпретатором. Ни str(), ни repr(), ни format(value, "g") не годятся:
    repr(1.0) это «1.0», а не «1», repr(1e-7) это «1e-07», а не «1e-7», и пороги
    перехода к экспоненте у Python свои, а у ECMAScript свои (n > 21 и n ≤ −6).

    Кратчайшая запись берётся у repr: он по построению даёт наименьшее число
    цифр, читающееся обратно тем же double, — ровно то «s», о котором говорит
    спецификация («k как можно меньше»). Decimal разбирает её на цифры и
    порядок точно, без второго округления.
    """
    if math.isnan(value):
        return "NaN"
    if value == 0:
        # str(-0.0) это «-0.0», а Number::toString(-0) это «0»: знак нуля не
        # печатается, хотя Object.is его различает.
        return "0"
    sign = ""
    if value < 0:
        sign = "-"
        value = -value
    if math.isinf(value):
        return sign + "Infinity"

    _, raw, exponent = Decimal(repr(value)).as_tuple()
    digits = list(raw)
    while len(digits) > 1 and digits[-1] == 0:
        digits.pop()
        exponent += 1
    k = len(digits)
    n = exponent + k
    body = "".join(str(digit) for digit in digits)

    if k <= n <= 21:
        return sign + body + "0" * (n - k)
    if 0 < n <= 21:
        return sign + body[:n] + "." + body[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + body

    power = n - 1
    mark = "+"
    if power < 0:
        mark = "-"
        power = -power
    tail = "e" + mark + str(power)
    if k == 1:
        return sign + body + tail
    return sign + body[:1] + "." + body[1:] + tail


_JSON_ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
}


def quote_json(value):
    """Строка в кавычках по правилам JSON.stringify.

    Ею пользуется describeValue интерпретатора, и тексты диагностик обязаны
    совпасть. json.dumps здесь не годится: он по умолчанию экранирует всё, что
    вне ASCII, то есть кириллицу — а JSON.stringify не экранирует.
    """
    out = ['"']
    for symbol in value:
        escaped = _JSON_ESCAPES.get(symbol)
        if escaped is not None:
            out.append(escaped)
        elif symbol < " ":
            out.append(f"\\u{ord(symbol):04x}")
        else:
            out.append(symbol)
    out.append('"')
    return "".join(out)


# ───────────────────────────── контекст вызова ─────────────────────────────

# Значения по умолчанию — те же, что у интерпретатора (interpret.mjs).
DEFAULT_MAX_DEPTH = 10000
DEFAULT_MAX_STEPS = 1000000
DEFAULT_BASE = 1

# Во сколько кадров Python обходится один вызов функции flang. Кадр самой
# функции — один; запас взят на кадры рантайма (равенство вложенных значений,
# батут) и на то, что предел Python считает вообще все кадры потока, включая
# кадры прогонщика над вычислением.
FRAMES_PER_CALL = 6

# Выше этого предел Python не поднимается, даже если max_depth просит больше:
# предел без стека под него — это не диагностика, а падение процесса. Программе
# с такой глубиной честнее упереться в RecursionError, чем сегфолтнуться.
MAX_RECURSION_LIMIT = 1000000

# Стек потока, в котором прогонщик считает вычисление. Предел глубины flang по
# умолчанию 10⁴, и восьми мегабайт стека по умолчанию на это не хватает.
DEEP_STACK_BYTES = 256 * 1024 * 1024


def ensure_recursion_capacity(max_depth):
    """Поднимает предел рекурсии Python под предел глубины flang.

    Предел языка обязан срабатывать первым: интерпретатор говорит
    FLANG_RECURSION_LIMIT, и напечатанная программа обязана сказать то же самое,
    а не RecursionError на своей, ничего не значащей для пользователя глубине.
    Предел только поднимается и никогда не опускается: чужие настройки процесса
    (а рантайм могли импортировать в чужую программу) не наше дело.
    """
    wanted = min(MAX_RECURSION_LIMIT, 1000 + int(max_depth) * FRAMES_PER_CALL)
    if sys.getrecursionlimit() < wanted:
        sys.setrecursionlimit(wanted)


def call_with_deep_stack(work, stack_bytes=DEEP_STACK_BYTES):
    """Исполняет work() в потоке с большим стеком и возвращает его результат.

    Поднятого sys.setrecursionlimit мало. У главного потока стек задан при
    запуске процесса (обычно 8 МиБ), и он не резиновый, а исчерпание стека C —
    это не исключение, а падение процесса: диагностику языка на нём не построишь.
    CPython 3.11 и новее вызов «питон из питона» по стеку C не разворачивает, и
    там глубина 10⁴ проходит и в главном потоке, — но опираться на это значит
    поставить FLANG_RECURSION_LIMIT в зависимость от версии и реализации
    интерпретатора. Поток с явно заданным стеком снимает вопрос везде.
    """
    box = {}

    def run():
        try:
            box["value"] = work()
        except BaseException as error:  # noqa: BLE001 — ошибка едет вызывающему
            box["error"] = error

    try:
        threading.stack_size(stack_bytes)
    except (ValueError, RuntimeError):
        pass  # платформа не даёт такой стек — считаем с тем, что есть
    worker = threading.Thread(target=run)
    worker.start()
    worker.join()
    if "error" in box:
        raise box["error"]
    return box.get("value")


class Ctx:
    """Счётчики пределов и настройка индексации строк.

    Пределы — не украшение. Обычная (не тотальная) функция flang может не
    завершаться, и интерпретатор ловит это лимитом шагов и глубины. Без
    счётчиков напечатанная программа в том же месте либо крутилась бы вечно,
    либо падала бы по стеку — то есть давала бы не FLANG_RECURSION_LIMIT, а
    зависание или RecursionError.

    Оговорка о шаге. Шаг интерпретатора — итерация его машины, а не вызов
    функции: одно применение функции стоит там многих шагов. Здесь шагом
    считается вход в функцию, виток цикла хвостового самовызова и отскок
    батута. Значит счётчик здесь всегда МЕНЬШЕ счётчика интерпретатора при том
    же вычислении, и при одинаковом пределе интерпретатор упирается в лимит
    первым. Расхождение, таким образом, одностороннее и безопасное:
    напечатанный код не объявит исчерпанным то, что интерпретатор досчитал.
    """

    __slots__ = ("_max_depth", "depth", "index_base", "max_steps", "steps")

    def __init__(self):
        self.depth = 0
        self.steps = 0
        self.max_steps = DEFAULT_MAX_STEPS
        self.index_base = DEFAULT_BASE
        self._max_depth = 0
        self.max_depth = DEFAULT_MAX_DEPTH

    @property
    def max_depth(self):
        """Предел глубины вызовов flang."""
        return self._max_depth

    @max_depth.setter
    def max_depth(self, value):
        self._max_depth = value
        ensure_recursion_capacity(value)

    def enter(self, function):
        """Вход в функцию, способную к рекурсии."""
        self.step(function)
        if self._max_depth > 0 and self.depth + 1 > self._max_depth:
            raise fail(
                CODE_RECURSION_LIMIT,
                f"функция «{function}» превысила предел глубины вызовов"
                f" ({self._max_depth}) на глубине {self.depth + 1}",
            )
        self.depth += 1

    def leave(self):
        """Выход из функции.

        Вызывается и на ошибке: счётчик глубины обязан вернуться назад, иначе
        первая же пойманная ошибка навсегда съела бы предел.
        """
        self.depth -= 1

    def step(self, function):
        """Виток вычисления: вход в функцию, цикл самовызова, отскок батута.

        Считается отдельно от глубины: хвостовая рекурсия глубину не растит, но
        завершаться от этого не начинает.
        """
        self.steps += 1
        if self.max_steps > 0 and self.steps > self.max_steps:
            raise fail(
                CODE_RECURSION_LIMIT,
                f"функция «{function}» исчерпала лимит шагов ({self.max_steps})"
                f" на глубине вызовов {self.depth}",
            )


def new_ctx():
    """Контекст с пределами интерпретатора и индексацией строк с 1."""
    return Ctx()


# ───────────────────────────── батут ─────────────────────────────


class Bounce:
    """Отскок: следующая функция компоненты и её аргументы.

    Взаимная хвостовая рекурсия («Чётное»/«Нечётное») у интерпретатора идёт в
    постоянной глубине — он переиспользует кадр возврата. Обычный вызов Python
    рос бы по стеку и упёрся бы в предел там, где интерпретатор считает штатно.
    """

    __slots__ = ("args", "next")

    def __init__(self):
        self.next = None
        self.args = None


def trampoline(ctx, step, args, function):
    """Крутит отскоки в цикле, пока шаг не вернёт значение."""
    bounce = Bounce()
    while True:
        bounce.next = None
        bounce.args = None
        value = step(ctx, args, bounce)
        if bounce.next is None:
            return value
        ctx.step(function)
        step = bounce.next
        args = bounce.args


# ───────────────────────────── операции языка ─────────────────────────────


def field_get(ctx, target, name):
    """Доступ к полю записи."""
    if target.tag == TAG_VARIANT:
        # Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более.
        if name in target.data:
            return target.data[name]
        raise fail(
            CODE_TYPE,
            f"поле «{name}» нельзя взять у варианта «{target.name}» — нужен разбор",
        )
    if target.tag != TAG_RECORD:
        raise fail(
            CODE_TYPE,
            f"поле «{name}» можно взять только у записи, получено {type_name(target)}",
        )
    if name not in target.data:
        raise fail(CODE_UNKNOWN_NAME, f"запись не содержит поле «{name}»")
    return target.data[name]


def variant_field(ctx, target, name):
    """Поле варианта при сопоставлении с образцом.

    Отсутствующее поле — ошибка прямо здесь, а не «случай не подошёл»: так же
    ведёт себя matchPattern интерпретатора.
    """
    if name not in target.data:
        raise fail(
            CODE_UNKNOWN_NAME,
            f"вариант «{target.name}» не содержит поле «{name}»",
        )
    return target.data[name]


def cond(ctx, value):
    """Условие «если»: обязано быть признаком."""
    if value.tag != TAG_FLAG:
        raise fail(
            CODE_TYPE,
            f"условие «если» должно быть признаком, получено {type_name(value)}",
        )
    return value.data


def keep(ctx, value):
    """Условие «отфильтровать»: обязано быть признаком."""
    if value.tag != TAG_FLAG:
        raise fail(
            CODE_TYPE,
            f"условие «отфильтровать» должно быть признаком, получено {type_name(value)}",
        )
    return value.data


def post(ctx, value, property_name, function):
    """Значение постусловия: обязано быть признаком."""
    if value.tag != TAG_FLAG:
        raise fail(
            CODE_TYPE,
            f"постусловие «{property_name}» функции «{function}» должно давать признак,"
            f" получено {type_name(value)}",
        )
    return value.data


def pre(ctx, value, property_name, function):
    """Значение предусловия: обязано быть признаком.

    Отдельно от `post`, а не тот же помощник со вторым текстом: слова отказа
    дословно те же, что у интерпретатора (`checkPreconditions` в
    flang/src/interpret.mjs), и одно сообщение на две разные вещи разошлось бы
    молча. Зовёт это ТОЛЬКО дверь программы — вызов по имени (`call`): внутри
    программы предусловие снял вызывающий на проверке, и проверять его там
    значило бы платить временем за доказанное.
    """
    if value.tag != TAG_FLAG:
        raise fail(
            CODE_TYPE,
            f"предусловие «{property_name}» функции «{function}» должно давать признак,"
            f" получено {type_name(value)}",
        )
    return value.data


def match_fail(ctx, value):
    """Разбор не покрыл значение."""
    return fail(CODE_MATCH, f"разбор не покрывает значение {describe(value)}")


def require_list(ctx, value, label):
    """«свёртка», «отобразить» и «отфильтровать» работают только со списком.

    Отдаёт содержимое, которое не вырастет под ногами обхода. Разница с
    list_items здесь принципиальная: тело свёртки — ЧУЖОЙ код, и он вправе
    позвать «добавить» к тому же значению, по которому идёт обход. У растущего
    списка «добавить» дописывает в общий массив, и `for … in` увидел бы
    дописанное — обход пошёл бы дальше собственного конца. Поэтому у растущего
    берётся копия (она же снимает право на рост), а у точного — сам массив: его
    вырасти нечему.
    """
    if value.tag != TAG_LIST:
        raise fail(
            CODE_TYPE,
            f"«{label}» работает только со списком, получено {type_name(value)}",
        )
    end = value.end
    if end is None:
        return value.data
    frozen = value.data[:end]
    value.data = frozen
    value.end = None
    return frozen


# ───────────────────────────── арифметика ─────────────────────────────


def _arithmetic(op, left, right):
    if left.tag != TAG_NUMBER or right.tag != TAG_NUMBER:
        raise fail(
            CODE_TYPE,
            f"операция «{op}» допустима только для чисел,"
            f" получено {type_name(left)} и {type_name(right)}",
        )
    return left.data, right.data


def _ordered(left, right):
    # Сообщение дословно как в ядре FTS (src/utility.ts, compare).
    if left.tag != TAG_NUMBER or right.tag != TAG_NUMBER:
        raise fail(CODE_TYPE, "сравнения порядка допустимы только для чисел")
    return left.data, right.data


def add(ctx, left, right):
    """«плюс»."""
    a, b = _arithmetic("add", left, right)
    return Value(TAG_NUMBER, a + b)


def sub(ctx, left, right):
    """«минус»."""
    a, b = _arithmetic("sub", left, right)
    return Value(TAG_NUMBER, a - b)


def mul(ctx, left, right):
    """«умножить на»."""
    a, b = _arithmetic("mul", left, right)
    return Value(TAG_NUMBER, a * b)


def divide_raw(a, b):
    """Деление IEEE-754: на ноль даёт ±Infinity, ноль на ноль — NaN.

    Единственное место, где Python расходится с flang не в представлении, а в
    поведении: `1.0 / 0.0` там ZeroDivisionError, а по SPEC (раздел 5) деление
    на ноль это значение, а не ошибка. Знак берётся от обоих операндов, как в
    IEEE-754: 1 / −0 это −Infinity, а не Infinity.
    """
    try:
        return a / b
    except ZeroDivisionError:
        if math.isnan(a) or a == 0.0:
            return math.nan
        return math.copysign(math.inf, a) * math.copysign(1.0, b)


def div(ctx, left, right):
    """«делить на»."""
    a, b = _arithmetic("div", left, right)
    return Value(TAG_NUMBER, divide_raw(a, b))


def remainder_raw(a, b):
    """Остаток по правилам оператора % из ECMAScript.

    Родной `%` Python не годится дважды: знак он берёт от делителя (`-7 % 3`
    там 2, а в JS −1), а на нулевом делителе возбуждает ZeroDivisionError
    вместо NaN. math.fmod — это C fmod, то есть ровно оператор ECMAScript, но
    он возбуждает ValueError на тех же входах, где JS даёт NaN.
    """
    if math.isnan(a) or math.isnan(b) or math.isinf(a) or b == 0.0:
        return math.nan
    if math.isinf(b):
        return a
    return math.fmod(a, b)


def mod(ctx, left, right):
    """«остаток от» как двуместная операция."""
    a, b = _arithmetic("mod", left, right)
    return Value(TAG_NUMBER, remainder_raw(a, b))


def percent(ctx, left, right):
    """«процентов от». Порядок операций ядра: (процент / 100) * значение.

    Переписать в значение * процент / 100 нельзя — меняется последний бит
    мантиссы.
    """
    a, b = _arithmetic("percent", left, right)
    return Value(TAG_NUMBER, (a / 100) * b)


def gt(ctx, left, right):
    """«больше»."""
    a, b = _ordered(left, right)
    return TRUE if a > b else FALSE


def lt(ctx, left, right):
    """«меньше»."""
    a, b = _ordered(left, right)
    return TRUE if a < b else FALSE


def gte(ctx, left, right):
    """«не меньше»."""
    a, b = _ordered(left, right)
    return TRUE if a >= b else FALSE


def lte(ctx, left, right):
    """«не больше»."""
    a, b = _ordered(left, right)
    return TRUE if a <= b else FALSE


def concat(ctx, left, right):
    """«соединить» как двуместная операция над строками."""
    if left.tag != TAG_STRING or right.tag != TAG_STRING:
        raise fail(
            CODE_TYPE,
            f"«соединить» допустимо только для строк,"
            f" получено {type_name(left)} и {type_name(right)}",
        )
    return Value(TAG_STRING, left.data + right.data)


# ───────────────────────────── проверки аргументов ─────────────────────────


def _expect_string(name, value, role):
    if value.tag != TAG_STRING:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«{name}»: {role} должна быть строкой, получено {type_name(value)}",
        )
    return value.data


def _expect_number(name, value, role):
    if value.tag != TAG_NUMBER:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«{name}»: {role} должно быть числом, получено {type_name(value)}",
        )
    return value.data


def _expect_integer(name, value, role):
    result = _expect_number(name, value, role)
    # Number.isInteger: ни NaN, ни бесконечность целыми не считаются.
    if math.isnan(result) or math.isinf(result) or result != math.trunc(result):
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«{name}»: {role} должно быть целым числом,"
            f" получено {number_text(result)}",
        )
    return result


def _expect_list(name, value, role):
    if value.tag != TAG_LIST:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«{name}»: {role} должен быть списком, получено {type_name(value)}",
        )
    return list_items(value)


# ───────────────────────────── встроенные формы ─────────────────────────────


def b_length(ctx, value):
    """«длина»: строка в кодовых точках, список в элементах.

    Кодовые точки здесь достаются даром: строка Python — последовательность
    кодовых точек, а не единиц UTF-16 (как в JS) и не байтов (как в Go), и
    len("мир 🌍") это 5 без единой поправки.
    """
    if value.tag == TAG_STRING:
        return Value(TAG_NUMBER, float(len(value.data)))
    if value.tag == TAG_LIST:
        return Value(TAG_NUMBER, float(list_length(value)))
    raise fail(
        CODE_BUILTIN_ARGS,
        f"«длина»: ожидается строка или список, получено {type_name(value)}",
    )


def b_char(ctx, index, source):
    """«символ … в …». Индексация с 1 и включительно (SPEC, раздел 5)."""
    position = _expect_integer("символ", index, "индекс")
    value = _expect_string("символ", source, "строка")
    at = position - ctx.index_base
    if at < 0 or at >= len(value):
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«символ»: индекс {number_text(position)} вне строки длиной {len(value)}",
        )
    return Value(TAG_STRING, value[int(at)])


def b_substring(ctx, source, from_value, to_value):
    """«подстрока … с … по …»: оба конца включительно при базе 1."""
    value = _expect_string("подстрока", source, "строка")
    start = _expect_integer("подстрока", from_value, "начало")
    end = _expect_integer("подстрока", to_value, "конец")
    length = len(value)
    begin = start - ctx.index_base
    if begin < 0 or begin > length:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«подстрока»: начало {number_text(start)} вне строки длиной {length}",
        )
    if end < begin or end > length:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«подстрока»: конец {number_text(end)}"
            f" вне диапазона [{number_text(start)}, {length}]",
        )
    return Value(TAG_STRING, value[int(begin) : int(end)])


def b_join(ctx, left, right):
    """«соединить». Две формы: строка со строкой и список с разделителем.

    Различаются по типу первого аргумента, как в builtins.mjs.
    """
    if left.tag == TAG_LIST:
        separator = _expect_string("соединить", right, "разделитель")
        parts = []
        for index, item in enumerate(list_items(left)):
            if item.tag != TAG_STRING:
                raise fail(
                    CODE_BUILTIN_ARGS,
                    f"«соединить»: элемент {index + 1} списка должен быть строкой,"
                    f" получено {type_name(item)}",
                )
            parts.append(item.data)
        return Value(TAG_STRING, separator.join(parts))
    first = _expect_string("соединить", left, "первая строка")
    second = _expect_string("соединить", right, "вторая строка")
    return Value(TAG_STRING, first + second)


def b_split(ctx, source, separator):
    """«разделить … по …»."""
    value = _expect_string("разделить", source, "строка")
    mark = _expect_string("разделить", separator, "разделитель")
    if mark == "":
        raise fail(CODE_BUILTIN_ARGS, "«разделить»: разделитель не может быть пустым")
    return Value(TAG_LIST, [Value(TAG_STRING, part) for part in value.split(mark)])


def b_characters(ctx, source):
    """«символы»: разложение строки в список односимвольных строк.

    Строка в Python — последовательность кодовых точек, поэтому итерация даёт
    ровно то же деление, что «длина» и «подстрока». Пустая строка даёт пустой
    список.
    """
    value = _expect_string("символы", source, "строка")
    return Value(TAG_LIST, [Value(TAG_STRING, point) for point in value])


def b_char_code(ctx, source):
    """«код символа»: кодовая точка первого символа строки.

    Строка в Python — последовательность кодовых точек, поэтому ord(value[0])
    даёт ровно ту же точку, что Array.from(text)[0].codePointAt(0) в свидетеле.
    """
    value = _expect_string("код символа", source, "строка")
    if value == "":
        raise fail(CODE_BUILTIN_ARGS, "«код символа»: строка пуста")
    return Value(TAG_NUMBER, float(ord(value[0])))


def b_char_from_code(ctx, code):
    """«символ по коду»: строка ровно из одного символа.

    chr() в Python суррогат построить умеет, и потому проверка стоит ЯВНО:
    строка в четырёх целях печати из восьми — UTF-8, где половина пары не
    записывается вовсе, а язык обещает у восьми целей одинаковые значения.
    """
    point = _expect_integer("символ по коду", code, "код")
    if point < 0 or point > 1114111:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«символ по коду»: код {number_text(point)} вне диапазона Unicode [0, 1114111]",
        )
    if 55296 <= point <= 57343:
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«символ по коду»: код {number_text(point)} — половина суррогатной пары, а не символ",
        )
    return Value(TAG_STRING, chr(int(point)))


def b_hash256(ctx, text):
    """«хеш256»: SHA-256 байтов строки шестнадцатеричной записью.

    Берётся `hashlib` стандартной библиотеки: своей зависимости он не приносит,
    а восьмая рукописная копия FIPS 180-4 была бы восьмым местом, где можно
    ошибиться поодиночке. Строка Python — кодовые точки, поэтому байты берутся
    явной кодировкой UTF-8: ровно те же байты, что хеширует C, и оттого
    отпечаток совпадает с `sha256sum` и с прочими восемью целями знак в знак.
    """
    body = _expect_string("хеш256", text, "строка")
    return Value(TAG_STRING, hashlib.sha256(body.encode("utf-8")).hexdigest())


def b_contains(ctx, left, right):
    """«содержит»: подстрока в строке либо значение в списке."""
    if left.tag == TAG_LIST:
        for item in list_items(left):
            if equal(item, right):
                return TRUE
        return FALSE
    value = _expect_string("содержит", left, "строка или список")
    part = _expect_string("содержит", right, "искомая подстрока")
    return TRUE if part in value else FALSE


def b_starts_with(ctx, source, prefix):
    """«начинается с»."""
    value = _expect_string("начинается с", source, "строка")
    start = _expect_string("начинается с", prefix, "префикс")
    return TRUE if value.startswith(start) else FALSE


# Пробел по правилам ECMAScript String.prototype.trim.
#
# str.strip() Python не подходит: он считает пробелом U+0085 (NEL) и U+001C…
# U+001F, которых в наборе ECMAScript нет, и не считает U+FEFF, который там
# есть. Разошлись бы ровно на тех входах, ради которых «к числу» и проверяется.
_JS_SPACE = "".join(
    chr(code)
    for code in (
        0x0009,  # табуляция
        0x000A,  # перевод строки
        0x000B,  # вертикальная табуляция
        0x000C,  # перевод страницы
        0x000D,  # возврат каретки
        0x0020,  # пробел
        0x00A0,  # неразрывный пробел
        0x1680,
        0x2028,  # разделитель строк
        0x2029,  # разделитель абзацев
        0x202F,
        0x205F,
        0x3000,
        0xFEFF,  # метка порядка байтов: в наборе ECMAScript есть, в Python нет
        *range(0x2000, 0x200B),
    )
)


def _trim_js(value):
    return value.strip(_JS_SPACE)


# Строгий разбор «к числу»: без Infinity, NaN, шестнадцатеричных и пустой
# строки, иначе форма молча превращает мусор в значение. Цифры перечислены
# явно: \d в Python — это любая десятичная цифра Unicode (в том числе
# арабо-индийская), а регулярное выражение builtins.mjs стоит под флагом «u»,
# где \d — только ASCII.
def _looks_like_number(value):
    index = 0
    size = len(value)
    if index < size and value[index] in "+-":
        index += 1
    before = 0
    while index < size and "0" <= value[index] <= "9":
        index += 1
        before += 1
    after = 0
    if index < size and value[index] == ".":
        index += 1
        while index < size and "0" <= value[index] <= "9":
            index += 1
            after += 1
        # «1.» и «.» недопустимы: после точки обязана быть хотя бы одна цифра,
        # а «.5» допустимо только потому, что цифры есть после точки.
        if after == 0:
            return False
    if before == 0 and after == 0:
        return False
    if index < size and value[index] in "eE":
        index += 1
        if index < size and value[index] in "+-":
            index += 1
        digits = 0
        while index < size and "0" <= value[index] <= "9":
            index += 1
            digits += 1
        if digits == 0:
            return False
    return index == size


def b_to_number(ctx, source):
    """«к числу»."""
    value = _expect_string("к числу", source, "строка")
    trimmed = _trim_js(value)
    if not _looks_like_number(trimmed):
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«к числу»: строка {quote_json(value)} не является числом",
        )
    # Переполнение (1e999) даёт ±inf и ловится следующей проверкой: текст
    # разобран, но конечным числом не является.
    result = float(trimmed)
    if math.isnan(result) or math.isinf(result):
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«к числу»: строка {quote_json(value)} не является конечным числом",
        )
    return Value(TAG_NUMBER, result)


def b_to_number_or_failure(ctx, source):
    """«к числу или беда»: отказ, ставший значением.

    Обоснование формы — в builtins.mjs, раздел «отказ, ставший значением».
    Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
    интерпретатором, и единственный способ гарантировать это — один разбор на
    обе формы. Отказать эта форма не может вовсе.
    """
    try:
        return variant("Разобрано", {"значение": b_to_number(ctx, source)})
    except FlangError as failure:
        return variant(
            "Не разобрано",
            {"код": text(failure.code), "сообщение": text(failure.message)},
        )


def b_to_string(ctx, value):
    """«к строке».

    Признак печатается по-русски («да»/«нет»), «ничто» — словом «ничто»:
    поверхность языка русская, и кодогенераторы обязаны это повторять, а не
    печатать True/False (SPEC, раздел 5).
    """
    tag = value.tag
    if tag == TAG_STRING:
        return value
    if tag == TAG_NUMBER:
        return Value(TAG_STRING, number_text(value.data))
    if tag == TAG_FLAG:
        return Value(TAG_STRING, "да" if value.data else "нет")
    if tag == TAG_NOTHING:
        return Value(TAG_STRING, "ничто")
    raise fail(
        CODE_BUILTIN_ARGS,
        f"«к строке»: ожидается скаляр, получено {type_name(value)}",
    )


def b_empty(ctx, value):
    """«пусто»."""
    if value.tag == TAG_LIST:
        return TRUE if list_length(value) == 0 else FALSE
    if value.tag == TAG_STRING:
        return TRUE if len(value.data) == 0 else FALSE
    raise fail(
        CODE_BUILTIN_ARGS,
        f"«пусто»: ожидается строка или список, получено {type_name(value)}",
    )


def b_head(ctx, value):
    """«голова»."""
    items = _expect_list("голова", value, "аргумент")
    if not items:
        raise fail(CODE_BUILTIN_ARGS, "«голова»: список пуст")
    return items[0]


def b_tail(ctx, value):
    """«хвост».

    Копирует, как и в JS: срез списка Python — новый список. Значит рекурсия
    «голова и хвост» по длинному списку квадратична, ровно как у интерпретатора;
    для больших данных язык даёт линейные «свёртка», «отобразить» и
    «отфильтровать», которые ничего не копируют.
    """
    items = _expect_list("хвост", value, "аргумент")
    if not items:
        raise fail(CODE_BUILTIN_ARGS, "«хвост»: список пуст")
    return Value(TAG_LIST, items[1:])


# ── Доказанный путь четырёх форм: то же действие без сторожа частичности ────
#
# Частичная форма отказывает не всегда, а на пустом. Там, где непустота
# ДОКАЗАНА проверкой типов (flang/src/types.mjs, «длинаНиз»), узел приезжает с
# отметкой «доказана», и печать зовёт эти функции. Сверка типа остаётся:
# _expect_list ловит не пустоту, а другой вид значения.
def b_split_proven(ctx, source, separator):
    """«разделить … по …» с доказанно непустым разделителем."""
    value = _expect_string("разделить", source, "строка")
    mark = _expect_string("разделить", separator, "разделитель")
    return Value(TAG_LIST, [Value(TAG_STRING, part) for part in value.split(mark)])


def b_char_code_proven(ctx, source):
    """«код символа» доказанно непустой строки."""
    return Value(TAG_NUMBER, float(ord(_expect_string("код символа", source, "строка")[0])))


def b_head_proven(ctx, value):
    """«голова» доказанно непустого списка."""
    return _expect_list("голова", value, "аргумент")[0]


def b_tail_proven(ctx, value):
    """«хвост» доказанно непустого списка."""
    return Value(TAG_LIST, _expect_list("хвост", value, "аргумент")[1:])


def b_element(ctx, index, value):
    """«элемент N в СПИСОК».

    Список Python — массив, поэтому N-й элемент стоит того же, что первый:
    обхода нет. Границы и текст отказа повторяют вычислитель дословно — их
    сверяет дифференциальная проверка, и «похоже» тут не годится.
    """
    position = _expect_integer("элемент", index, "индекс")
    items = _expect_list("элемент", value, "список")
    at = position - ctx.index_base
    if at < 0 or at >= len(items):
        raise fail(
            CODE_BUILTIN_ARGS,
            f"«элемент»: индекс {number_text(position)} вне списка длиной {len(items)}",
        )
    return items[int(at)]


def b_append(ctx, item, value):
    """«добавить … к …»: дописывает в конец, исходный список не меняется.

    За постоянное время, когда ячейка за концом ещё ничья, и копией во всех
    остальных случаях. Разбор приёма и доказательство неизменяемости — при
    классе Value, поле end. Безусловная копия была верна, но делала накопление
    списка квадратичным, а вместе с ним и предел шагов — не сроком, а числом на
    бумаге.

    Голый items.append(item) здесь недопустим: у Python append амортизирован сам
    по себе, но массив у списков ОБЩИЙ, и дописать в него вправе единственный
    список — тот, чей end совпал с len. Разрешение спрашивается у end, а не у
    длины массива.
    """
    if value.tag == TAG_LIST:
        end = value.end
        if end is not None and end == len(value.data):
            value.data.append(item)
            return Value(TAG_LIST, value.data, "", end + 1)
    # Копия — и она сразу получает право дописывать в конец: за n «добавить»
    # копий будет столько, сколько было ветвлений, а не n.
    items = _expect_list("добавить", value, "второй аргумент")
    grown = [*items, item]
    return Value(TAG_LIST, grown, "", len(grown))


def b_prepend(ctx, item, value):
    """«приписать … к …»: тот же список с элементом впереди.

    Копия, и постоянного времени здесь быть не может: список Python — непрерывный
    массив, ячейки ПЕРЕД началом у него нет, значит запаса спереди в нём не
    завести. Зато копия ОДНА на вызов, а не одна на элемент, как у свёртки,
    которой приписывание в начало писали до появления формы. Цена по всем восьми
    целям — в SPEC, раздел «Стоимость встроенных форм».
    """
    items = _expect_list("приписать", value, "второй аргумент")
    return Value(TAG_LIST, [item, *items])


def b_remainder(ctx, left, right):
    """«остаток от»."""
    a = _expect_number("остаток от", left, "делимое")
    b = _expect_number("остаток от", right, "делитель")
    return Value(TAG_NUMBER, remainder_raw(a, b))


def b_percent_of(ctx, left, right):
    """«процентов от»: (процент / 100) * значение, порядок ядра."""
    a = _expect_number("процентов от", left, "процент")
    b = _expect_number("процентов от", right, "значение")
    return Value(TAG_NUMBER, (a / 100) * b)


# ───────────────────────────── граница входа ─────────────────────────────
#
# Объявленные типы параметров — ДАННЫМИ. Прогонщик сверяет по ним значения,
# пришедшие снаружи, ДО вызова функции.
#
# Зачем это здесь, а не в самих функциях. Доказательство завершения `тотальной`
# стоит НА ТИПЕ: у `неотрицательное` есть дно 0 и потолок 2^53−1, ниже которого `н минус 1`
# точно меньше `н`, и сторож убывания в такую функцию не печатается вовсе.
# Значение вне типа выносит вместе с типом и доказательство: `1e300 минус 1`
# равно `1e300`, цепочка вечна, а ловить её нечем. Дверь одна и стоит она ДО
# вычисления.
#
# Таблицу печатает бэкенд вместе с программой (`entry`), а строит её
# `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
# подходит типу», каким сверяется `flang run --args`.

# Виды объявленного типа. TYPE_UNKNOWN — значение-функция, параметр
# полиморфизма и применение типа с аргументами: одной таблицы им мало, и они не
# сверяются вовсе.
TYPE_UNKNOWN = 0
TYPE_NUMBER = 1
TYPE_TEXT = 2
TYPE_FLAG = 3
TYPE_NULL = 4
TYPE_LIST = 5
TYPE_RECORD = 6
TYPE_SUM = 7


class EntryTable:
    """Граница входа программы: типы, поля, варианты и параметры.

    Поля и варианты лежат сплошными отрезками общих списков, а тип называет
    своё начало и длину. Каждый тип — кортеж
    (вид, имя, владелец, ничто, целое, отрезок, низ, верх, элемент,
     поле с, полей, вариант с, вариантов);
    поле — (имя, тип); вариант — (имя, поле с, полей);
    параметр — (функция, имя, тип).
    """

    __slots__ = ("fields", "params", "types", "variants")

    def __init__(self, types, fields, variants, params):
        self.types = types
        self.fields = fields
        self.variants = variants
        self.params = params


def _check_number_type(spec, value, label):
    name = spec[1]
    if value.tag != TAG_NUMBER or not math.isfinite(value.data):
        raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
    # Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
    # порядок, и второй отказ на одном значении был бы вторым текстом про одну
    # беду.
    if spec[4] and math.floor(value.data) != value.data:
        raise fail(CODE_TYPE, f"{label}: {number_text(value.data)} не целое, а тип {name} — целый")
    if spec[5] and (value.data < spec[6] or value.data > spec[7]):
        raise fail(CODE_TYPE, f"{label}: {number_text(value.data)} вне {name}")


def _check_fields(table, start, count, given, label, owner, of_variant):
    for index in range(count):
        name, at = table.fields[start + index]
        if name not in given:
            # Необязательное поле можно не задавать: отсутствие — это «ничто».
            if table.types[at][3]:
                continue
            if of_variant:
                raise fail(CODE_TYPE, f"{label}: вариант «{owner}» требует поле «{name}»")
            raise fail(CODE_TYPE, f"{label}: не задано поле «{name}» записи «{owner}»")
        _check_typed(table, at, given[name], f"{label}.{name}")


def _check_typed(table, index, value, label):
    if index < 0 or index >= len(table.types):
        return
    spec = table.types[index]
    kind = spec[0]
    name = spec[1]
    owner = spec[2]
    # Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
    # пропуск. Так же считает и ядро FTS.
    if spec[3] and value.tag == TAG_NOTHING:
        return
    if kind == TYPE_UNKNOWN:
        return
    if kind == TYPE_NUMBER:
        _check_number_type(spec, value, label)
        return
    if kind == TYPE_TEXT:
        if value.tag != TAG_STRING:
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        return
    if kind == TYPE_FLAG:
        if value.tag != TAG_FLAG:
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        return
    if kind == TYPE_NULL:
        if value.tag != TAG_NOTHING:
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        return
    if kind == TYPE_LIST:
        if value.tag != TAG_LIST:
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        for at, item in enumerate(value.data):
            _check_typed(table, spec[8], item, f"{label}[{at}]")
        return
    if kind == TYPE_RECORD:
        if value.tag != TAG_RECORD:
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        _check_fields(table, spec[9], spec[10], value.data, label, owner, False)
        # Лишнее поле — тоже несоответствие типу: запись flang тотальна, и поля
        # сверх объявленных в ней взяться неоткуда.
        declared = {table.fields[spec[9] + at][0] for at in range(spec[10])}
        for given in value.data:
            if given not in declared:
                raise fail(CODE_TYPE, f"{label}: запись «{owner}» не имеет поля «{given}»")
        return
    if kind == TYPE_SUM:
        if value.tag not in (TAG_VARIANT, TAG_RECORD):
            raise fail(CODE_TYPE, f"{label} не соответствует типу {name}")
        found = None
        if value.tag == TAG_VARIANT:
            for at in range(spec[12]):
                if table.variants[spec[11] + at][0] == value.name:
                    found = table.variants[spec[11] + at]
                    break
        if found is None:
            raise fail(CODE_TYPE, f"{label}: ожидался вариант типа «{owner}»")
        _check_fields(table, found[1], found[2], value.data, label, found[0], True)
        return


def check_entry(table, name, args):
    """Сверка набора значений с объявленными типами параметров функции.

    Молчит там, где сверять нечем: имени в таблице нет, число значений с числом
    параметров не сошлось (об этом скажет диспетчер своим текстом), тип приехал
    видом TYPE_UNKNOWN. Тексты отказов дословно те же, что у `checkValue`
    свидетеля: расхождение здесь означало бы, что у языка два ответа на вопрос
    «подходит ли значение типу».
    """
    declared = [param for param in table.params if param[0] == name]
    if not declared or len(declared) != len(args):
        return
    for at, param in enumerate(declared):
        _check_typed(table, param[2], args[at], f"вызов функции «{name}»: аргумент «{param[1]}»")
