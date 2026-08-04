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
    """

    __slots__ = ("data", "name", "tag")

    def __init__(self, tag, data=None, name=""):
        self.tag = tag
        self.data = data
        self.name = name

    def __repr__(self):
        return f"<flang {type_name(self)}: {describe(self)}>"


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
    """Список из готового списка значений. Список переходит во владение."""
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
        return "список из " + str(len(value.data))
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
        if len(left.data) != len(right.data):
            return False
        return all(equal(a, b) for a, b in zip(left.data, right.data))
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


def match_fail(ctx, value):
    """Разбор не покрыл значение."""
    return fail(CODE_MATCH, f"разбор не покрывает значение {describe(value)}")


def require_list(ctx, value, label):
    """«свёртка», «отобразить» и «отфильтровать» работают только со списком."""
    if value.tag != TAG_LIST:
        raise fail(
            CODE_TYPE,
            f"«{label}» работает только со списком, получено {type_name(value)}",
        )
    return value.data


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
    return value.data


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
        return Value(TAG_NUMBER, float(len(value.data)))
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
        for index, item in enumerate(left.data):
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


def b_contains(ctx, left, right):
    """«содержит»: подстрока в строке либо значение в списке."""
    if left.tag == TAG_LIST:
        for item in left.data:
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
    if value.tag == TAG_LIST or value.tag == TAG_STRING:
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


def b_append(ctx, item, value):
    """«добавить … к …»: дописывает в конец, исходный список не меняется."""
    items = _expect_list("добавить", value, "второй аргумент")
    return Value(TAG_LIST, [*items, item])


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
