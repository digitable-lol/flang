# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
"""Исполнитель плана: цикл поручений.

Печатается целиком и только программе, у которой есть `план`. Это ПОРТ
исполнителя цели JavaScript (`flang/src/emit/js/flang_io.js`) на представление
значений рантайма Python, а не второй ввод-вывод: шаги стоят здесь в том же
порядке, с теми же именами и теми же исходами.

── Почему цикл вообще напечатан, а не оставлен хозяину ─────────────────────

Потому что он ОДИН и тот же у всякого хозяина. Хозяин отвечает на поручение —
это его работа и его среда; а «взять начальное состояние, позвать шаг,
разобрать продолжение, отдать поручение наружу и вернуться с откликом» —
работа языка, и написать её заново у каждого хозяина значило бы раздать
семантику плана по хозяевам.

── Чем этот исполнитель отличается от исполнителя JavaScript ───────────────

  • ХОЗЯИН ЗДЕСЬ СИНХРОННЫЙ. У JavaScript хозяин вправе вернуть обещание, и
    цикл ждёт его через `await`; в Python обещания нет ни у рантайма, ни у
    прогонщика (`flang_cli.py` — обычная функция `serve`), и заводить ради
    исполнителя `async def` значило бы заставить всякого хозяина завести цикл
    событий. Хозяин, которому нужна асинхронность, крутит цикл сам: `io_run`
    ничем не владеет, а описатель планов ему передают снаружи.
  • ЗНАЧЕНИЯ ЗДЕСЬ ОБЪЕКТЫ, А НЕ СЫРЫЕ. У JavaScript «ничто» — это `null`, и
    отсутствующее поле там `?? null`, то есть само собой становится «ничто».
    Здесь «ничто» — это `rt.NOTHING`, отдельное значение с тегом, и `io_field`
    возвращает ИМЕННО ЕГО, а не `None`: `None` — не значение flang, и уехав в
    итог плана, он сломал бы вывод на первой же попытке его напечатать.
  • ЖУРНАЛА ПО УМОЛЧАНИЮ НЕТ, и предел поручений снимается нулём — ровно то же
    правило и те же числа, что у JavaScript.

── Про импорт рантайма ─────────────────────────────────────────────────────

`import flang_runtime as rt` стоит здесь, хотя у JavaScript в том же файле
импортов нет вовсе: там исполнитель вклеивается ВНУТРЬ модуля, где рантайм уже
рядом. Этот файл обязан годиться и на вклейку, и на отдельный модуль, а лишний
`import` того же имени в уже импортированный модуль не стоит ничего — тогда
как отсутствие импорта делает файл незапускаемым в одиночку и непроверяемым.

── Чего здесь нет намеренно, и это НАЗВАННЫЙ ДОЛГ ──────────────────────────

Сверки значения с ОБЪЯВЛЕННЫМ типом на входе шага. Проверяется здесь ФОРМА:
отклик — это «Отклик», продолжение — это «Продолжение», поручение — это
«Поручение», но не типы полей. Долг тот же, что у JavaScript, и закрывается он
тем же переносом `check_entry` из `flang_cli.py` в общего соседа.

── Как файл едет к программе (ADR-0100) ────────────────────────────────────

Печать `flang/self/emit-python.flang` кладёт его рядом с модулем ТОЛЬКО
программе, у которой есть `план`, и вписывает в модуль таблицу `PLANS`: имя
плана, имя функции начального состояния и имя функции шага — исходными
именами flang. Функции зовутся через `call` модуля, тот же вход, которым
ходит прогонщик, и потому второго словаря имён здесь нет.

Запуск — тем же прогонщиком: `python3 flang_cli.py <модуль> --plan <имя>
[довод…]`; пустое имя — единственный план. Хозяин ниже (`io_host`) исполняет
девять родов поручений — файлы текстом и октетами, каталоги, среду и доводы,
— остальным отвечает отказом с кодом, называющим род.
"""

import os
import random
import string

import flang_runtime as rt

# Сколько поручений исполнитель выдаёт, прежде чем сдаться. То же число, что у
# свидетеля и у цели JavaScript.
IO_LIMIT = 10000

# Отклик, с которым план начинает: ещё ничего не случилось.
IO_START = "Пока ничего"

# Варианты «Продолжение» — что шаг может ответить. Список — часть контракта.
IO_DO = "Сделать"
IO_END = "Конец работы"
IO_FAIL = "Провал"
# ЧЕТВЁРТЫЙ ИСХОД. «Провал» — «посмотрел и нашёл беду», «Не проверено» — «не
# смог посмотреть». Признак `сдался` ставится только первому: он и есть та
# отметка, по которой беда превращается в код 1. У «Не проверено» её нет, и
# потому оно уезжает кодом 3 — тем же, каким отвечает сломавшийся хозяин.
IO_NOT_CHECKED = "Не проверено"

# Поручения словаря языка. Набор — контракт между языком и хозяином, а не выбор
# автора программы, и потому написан здесь словами.
#
# ЭТО НЕ КОММЕНТАРИЙ, А ВОРОТА. Список стоит в `io_in_set` ПЕРЕД вызовом
# хозяина: поручение, которого здесь нет, до хозяина не доходит вовсе. У цели
# JavaScript в этом списке однажды стояло пятнадцать имён при двадцати двух в
# языке, и семь законных поручений она отвергала, НЕ НАЗЫВАЯ какое.
#
# СПИСОК ОБЯЗАН СХОДИТЬСЯ СО СЛОВАРЁМ, и это стережётся, а не обещается:
# приметы ниже сверяет `scripts/guards/prose-numbers-guard.sh`. Левая мерит словарь
# языка, правая — сам этот список; разойдись они, и сторож назовёт файл и
# строку.
#
# поручений в словаре языка 27 — СНЯТО 2026-10-12 список flang/self/parser.flang:6079 = 27
# поручений в этом списке   27 — СНЯТО 2026-10-12 список flang/src/emit/python/flang_io.py:101 = 27
IO_ORDERS = [
    "Прочитать файл",
    "Записать файл",
    "Прочитать октеты из файла",
    "Записать октеты в файл",
    "Запросить",
    "Текущее время",
    "Случайное число",
    "Случайные октеты",
    "Показать",
    "Ждать событие",
    "Перечислить каталог",
    "Запустить процесс",
    "Запустить процесс с вводом",
    "Запустить процесс с пределом",
    "Открыть соединение",
    "Принять соединение",
    "Прочитать из соединения",
    "Ответить в соединение",
    "Прочитать октеты из соединения",
    "Ответить октетами в соединение",
    "Удалить файл",
    "Завести временный каталог",
    "Прочитать переменную среды",
    "Прочитать доводы",
    "Размер экрана",
    "Отправить датаграмму",
    "Принять датаграмму",
]

# Отклики словаря языка. Тот же набор, с той же стороны договора, и те же
# ворота: отклик, которого здесь нет, объявляется НЕ откликом, чей бы он ни был.
#
# откликов в словаре языка 23 — СНЯТО 2026-10-12 список flang/self/parser.flang:6101 = 23
# откликов в этом списке   23 — СНЯТО 2026-10-12 список flang/src/emit/python/flang_io.py:136 = 23
IO_RESPONSES = [
    "Пока ничего",
    "Прочитано",
    "Записано",
    "Ответ сети",
    "Отметка времени",
    "Выпало",
    "Показано",
    "Случилось",
    "Срок вышел",
    "Перечислено",
    "Процесс завершён",
    "Процесс убит",
    "Процесс оборван",
    "Соединение открыто",
    "Октеты",
    "Сбой",
    "Убрано",
    "Заведено",
    "Значение среды",
    "Переменной среды нет",
    "Доводы",
    "Экран",
    "Датаграмма",
]


def io_find(io, name):
    """План по имени; без имени — единственный объявленный.

    Ровно то же правило, что у свидетеля (`findPlan`), и то же по причине: имя
    плана — это то, что называет ЗАПУСКАЮЩИЙ, а не программа, и при одном плане
    заставлять его повторять имя незачем.
    """
    plans = io["планы"]
    if len(plans) == 0:
        raise rt.fail("FLANG_UNKNOWN_PLAN", "в программе нет ни одного плана: исполнять нечего")
    if name is None or name == "":
        if len(plans) == 1:
            return plans[0]
        names = ", ".join("«" + plan["имя"] + "»" for plan in plans)
        raise rt.fail("FLANG_UNKNOWN_PLAN", "планов несколько (" + names + ") — назовите нужный")
    for plan in plans:
        if plan["имя"] == name:
            return plan
    raise rt.fail("FLANG_UNKNOWN_PLAN", "не найден план «" + name + "»")


def io_is_variant(value):
    """Вариант ли значение — терпимо к тому, что значением не является вовсе.

    `rt.is_variant` читает поле `tag`, и на `None` или на питоновской строке от
    самодельного хозяина падает AttributeError вместо отказа с кодом. Отказ на
    границе с хозяином обязан быть диагностикой flang, а не следом стека.
    """
    return isinstance(value, rt.Value) and rt.is_variant(value)


def io_in_set(value, names):
    """Значение — вариант с этим именем из этого набора?"""
    return io_is_variant(value) and value.name in names


def io_field(value, name):
    """Поле варианта; поля нет — «ничто», а не `None` (см. шапку файла)."""
    return value.data.get(name, rt.NOTHING)


def io_say(value, spare, allow_empty):
    """Текст поля «код» или «сообщение», а не тем — запасной.

    Пустой код запасным ПОДМЕНЯЕТСЯ, пустое сообщение — нет: программа вправе
    сдаться молча, но безымянный код превратил бы отказ в неотличимый от
    других. Та же пара правил стоит у цели JavaScript.
    """
    if isinstance(value, rt.Value) and value.tag == rt.TAG_STRING and (allow_empty or value.data != ""):
        return value.data
    return spare


def io_run(io, name, perform, orders=None, log_wanted=False):
    """Прогнать план, отдавая поручения наружу.

    `perform` — функция хозяина: поручение → отклик. Ни одного эффекта сам
    исполнитель не делает, и в этом весь смысл: подставь список заготовленных
    откликов — и тот же план прогоняется без экрана, без файлов и без сети.
    """
    plan = io_find(io, name)
    if not callable(perform):
        raise rt.fail("FLANG_IO", "исполнителю плана нужна функция «выполнить поручение»")
    limit = IO_LIMIT if orders is None else orders
    no_limit = not limit > 0
    log = []
    given = 0

    state = plan["начало"]()
    response = io["вариант"](IO_START, {})

    while True:
        step = plan["шаг"](state, response)
        if not io_in_set(step, (IO_DO, IO_END, IO_FAIL, IO_NOT_CHECKED)):
            raise rt.fail("FLANG_IO", "шаг плана «" + plan["имя"] + "» вернул не «Продолжение»")

        if step.name == IO_END:
            return {"значение": io_field(step, "значение"), "поручений": given, "журнал": log}

        if step.name == IO_FAIL:
            # Код берётся у программы, а не назначается здесь: программа сдаётся
            # сама, и она же лучше знает, чем именно. Признак `сдался` ставится
            # РЯДОМ с бедой и только здесь — только здесь известно, что решение
            # принято программой, а не сломался исполнитель. Читает его тот, кто
            # превращает беду в код выхода.
            bad = rt.fail(
                io_say(io_field(step, "код"), "FLANG_IO_FAILED", False),
                io_say(io_field(step, "сообщение"), "план «" + plan["имя"] + "» отказался продолжать", True),
            )
            bad.сдался = True
            raise bad

        if step.name == IO_NOT_CHECKED:
            raise rt.fail(
                io_say(io_field(step, "код"), "FLANG_IO_NOT_CHECKED", False),
                io_say(io_field(step, "сообщение"), "план «" + plan["имя"] + "» не смог проверить предмет", True),
            )

        if not no_limit and given >= limit:
            raise rt.fail(
                "FLANG_IO_LIMIT",
                "план «" + plan["имя"] + "» исчерпал предел поручений (" + str(limit) + ")",
            )

        order = io_field(step, "поручение")
        if not io_in_set(order, IO_ORDERS):
            # ОТКАЗ ОБЯЗАН НАЗЫВАТЬ: имя варианта у значения есть всегда; когда
            # его нет вовсе, так и сказано.
            what = "вариант «" + order.name + "»" if io_is_variant(order) else "не вариант суммы"
            raise rt.fail("FLANG_IO", "план «" + plan["имя"] + "» просит выполнить не поручение: " + what)
        state = io_field(step, "потом")
        answer = perform(order)
        if not io_in_set(answer, IO_RESPONSES):
            raise rt.fail(
                "FLANG_IO",
                "хозяин вернул не «Отклик» на поручение «" + order.name + "» плана «" + plan["имя"] + "»",
            )
        response = answer
        given += 1
        if log_wanted:
            log.append({"поручение": order, "отклик": response})


# ───────────────────────────── описатель планов модуля ─────────────────────


def io_descriptor(program):
    """Описатель планов напечатанного модуля: тот же вид, что ждёт `io_run`.

    Каждый шаг зовётся в СВЕЖЕМ контексте модуля: пределы шагов и глубины —
    на одно обращение плана, как у `flang io`, а не на весь прогон.
    """
    plans = []
    for name, initial, step in getattr(program, "PLANS", []):
        plans.append({
            "имя": name,
            "начало": (lambda initial=initial: program.call(program.new_context(), initial, [])),
            "шаг": (lambda state, response, step=step: program.call(program.new_context(), step, [state, response])),
        })
    return {"планы": plans, "вариант": lambda name, fields: rt.variant(name, fields)}


# ───────────────────────────── хозяин ──────────────────────────────────────

# Роды словаря, которые этот хозяин знает, но не заводит. Отказ на них —
# FLANG_IO_NOT_WIRED: род известен, Python его умеет, хозяин — нет; исполняет
# их сегодня двоичный `flang io`.
IO_NOT_WIRED = (
    "Запросить",
    "Текущее время", "Случайное число", "Случайные октеты",
    "Запустить процесс", "Запустить процесс с вводом", "Запустить процесс с пределом",
    "Открыть соединение", "Принять соединение", "Прочитать из соединения",
    "Ответить в соединение", "Прочитать октеты из соединения", "Ответить октетами в соединение",
)

# Роды экрана: у процесса нет мест и событий, тот же отказ, что у Node.
IO_NO_SCREEN = ("Показать", "Ждать событие", "Размер экрана")


def io_text_field(order, name):
    value = order.data.get(name, rt.NOTHING)
    if isinstance(value, rt.Value) and value.tag == rt.TAG_STRING:
        return value.data
    return None


def io_host(root, args):
    """Хозяин: функция «поручение → отклик» над каталогом `root`."""

    def fault(code, message):
        return rt.variant("Сбой", {"код": rt.text(code), "сообщение": rt.text(message)})

    def why(error):
        return os.strerror(error.errno) if getattr(error, "errno", None) else str(error)

    def full(order, field):
        given = io_text_field(order, field)
        if given is None or given == "":
            return None, fault("FLANG_IO_PATH", "поручению нужен непустой путь")
        return os.path.join(root, given), None

    def perform(order):
        kind = order.name
        if kind == "Прочитать файл":
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                with open(path, "rb") as handle:
                    octets = handle.read()
            except OSError as error:
                return fault("FLANG_IO_READ", "файл не прочитан: " + why(error))
            try:
                return rt.variant("Прочитано", {"содержимое": rt.text(octets.decode("utf-8"))})
            except UnicodeDecodeError:
                return fault(
                    "FLANG_IO_NOT_TEXT",
                    "файл не текст: " + str(len(octets)) + " октет(ов) не складываются в UTF-8; "
                    "октеты возит «Прочитать октеты из файла»",
                )
        if kind == "Записать файл":
            body = io_text_field(order, "содержимое") or ""
            try:
                octets = body.encode("utf-8")
            except UnicodeEncodeError:
                return fault("FLANG_IO_NOT_TEXT", "содержимое не текст: одинокая половина суррогатной пары")
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                with open(path, "wb") as handle:
                    handle.write(octets)
            except OSError as error:
                return fault("FLANG_IO_WRITE", "файл не записан: " + why(error))
            # Кодовые точки, а не октеты: «сколько» обязано совпасть с `длина`.
            return rt.variant("Записано", {"сколько": rt.number(float(len(body)))})
        if kind == "Прочитать октеты из файла":
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                with open(path, "rb") as handle:
                    octets = handle.read()
            except OSError as error:
                return fault("FLANG_IO_READ", "файл не прочитан: " + why(error))
            return rt.variant("Октеты", {"октеты": rt.list_of([rt.number(float(octet)) for octet in octets])})
        if kind == "Записать октеты в файл":
            given = order.data.get("октеты", rt.NOTHING)
            if not (isinstance(given, rt.Value) and given.tag == rt.TAG_LIST):
                return fault("FLANG_IO_OCTETS", "поручению нужен список октетов, а дан не список")
            octets = bytearray()
            for at, item in enumerate(rt.list_items(given)):
                number = item.data if item.tag == rt.TAG_NUMBER else -1.0
                if not (0 <= number <= 255 and float(number).is_integer()):
                    return fault("FLANG_IO_OCTETS", "октет " + str(at + 1) + " не годится: нужно целое от 0 до 255")
                octets.append(int(number))
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                with open(path, "wb") as handle:
                    handle.write(bytes(octets))
            except OSError as error:
                return fault("FLANG_IO_WRITE", "файл не записан: " + why(error))
            return rt.variant("Записано", {"сколько": rt.number(float(len(octets)))})
        if kind == "Перечислить каталог":
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                names = os.listdir(path)
            except OSError as error:
                return fault("FLANG_IO_LIST", "каталог не открыт: " + why(error))
            # По кодовым точкам — тот же порядок, что у двоичного хозяина.
            names.sort()
            return rt.variant("Перечислено", {"имена": rt.list_of([rt.text(name) for name in names])})
        if kind == "Удалить файл":
            path, bad = full(order, "путь")
            if bad is not None:
                return bad
            try:
                if os.path.isdir(path) and not os.path.islink(path):
                    os.rmdir(path)
                else:
                    os.remove(path)
            except OSError as error:
                return fault("FLANG_IO_REMOVE", "имя не убрано: " + why(error))
            return rt.variant("Убрано", {})
        if kind == "Завести временный каталог":
            given = io_text_field(order, "образец")
            path, bad = full(order, "образец")
            if bad is not None:
                return bad
            letters = string.ascii_letters + string.digits
            for _ in range(100):
                tail = "".join(random.choice(letters) for _ in range(6))
                try:
                    os.mkdir(path + tail, 0o700)
                except FileExistsError:
                    continue
                except OSError as error:
                    return fault("FLANG_IO_TEMPDIR", "временный каталог не заведён: " + why(error))
                # Обратно — образец плюс хвост, в координатах плана.
                return rt.variant("Заведено", {"путь": rt.text(given + tail)})
            return fault("FLANG_IO_TEMPDIR", "временный каталог не заведён: имена заняты")
        if kind == "Прочитать переменную среды":
            name = io_text_field(order, "имя")
            if name is None or name == "":
                return fault("FLANG_IO_ENV", "поручению нужно непустое имя переменной")
            if name not in os.environ:
                return rt.variant("Переменной среды нет", {})
            return rt.variant("Значение среды", {"значение": rt.text(os.environ[name])})
        if kind == "Прочитать доводы":
            return rt.variant("Доводы", {"доводы": rt.list_of([rt.text(arg) for arg in args])})
        if kind in IO_NO_SCREEN:
            return fault("FLANG_IO_NO_SCREEN", "у хозяина Python нет экрана: поручение «" + kind + "» исполнить нечем")
        if kind in IO_NOT_WIRED:
            return fault(
                "FLANG_IO_NOT_WIRED",
                "поручение «" + kind + "» в этом хозяине не заведено; исполните план двоичным: flang io <файл.flang>",
            )
        return fault("FLANG_IO_UNKNOWN", "хозяин не знает поручения «" + kind + "»")

    return perform


# ───────────────────────────── итог плана словами flang io ────────────────


def io_plain(value):
    """Значение в JSON того же вида, каким `flang io` печатает итог плана."""
    tag = value.tag
    if tag == rt.TAG_NOTHING:
        return None
    if tag == rt.TAG_FLAG:
        return bool(value.data)
    if tag == rt.TAG_NUMBER:
        return io_number(value.data)
    if tag == rt.TAG_STRING:
        return value.data
    if tag == rt.TAG_WORD:
        return rt.word_int(value)
    if tag == rt.TAG_LIST:
        return [io_plain(item) for item in rt.list_items(value)]
    if tag == rt.TAG_RECORD:
        return {name: io_plain(item) for name, item in value.data.items()}
    if tag == rt.TAG_VARIANT:
        return {"variant": value.name, "fields": {name: io_plain(item) for name, item in value.data.items()}}
    return None


def io_number(number):
    """Число так, как его печатает `flang io`: целое — без «.0»."""
    if number == number and abs(number) < 2.0 ** 53 and float(number).is_integer():
        return int(number)
    return number


def io_main(program, name, args, out, err):
    """Прогнать план модуля и сказать итог; код возврата — как у `flang io`."""
    import json

    def say(stream, payload):
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        stream.write(text + "\n")
        stream.flush()

    try:
        outcome = io_run(io_descriptor(program), name, io_host(os.getcwd(), args))
    except rt.FlangError as bad:
        say(err, {"error": str(getattr(bad, "message", bad)), "code": getattr(bad, "code", "FLANG_IO")})
        return 1 if getattr(bad, "сдался", False) else 3
    say(out, {"result": io_plain(outcome["значение"]), "orders": outcome["поручений"]})
    return 0
