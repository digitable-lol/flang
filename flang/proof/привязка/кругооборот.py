# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
# -*- coding: utf-8 -*-
"""КРУГООБОРОТ: собрать текст обратно из потока токенов и сличить с исходником.

ЗАЧЕМ ЭТОТ ФАЙЛ ЛЕЖИТ В ДЕРЕВЕ. Число кругооборота печатается в
`docs/what-blocks-1-0.md` (раздел 4.4) с 31 августа, а прибор, который его
даёт, до 5 сентября лежал во ВРЕМЕННОМ каталоге, и документ отсылал читателя
туда абсолютным путём. Число, невоспроизводимое из репозитория, — не число:
ровно от этой породы уже лечили `привязка.py` в этой же папке. Здесь то же
лечение, во второй раз. Правило «оснастку не коммитим» нарушено НАРОЧНО и по
той же причине.

ЧТО МЕРИТ. Кругооборот `текст → flang tokens → текст`. `flang tokens --json`
даёт поток токенов, у каждого — `span` (строка, столбец) и поверхностный вид.
Текст СОБИРАЕТСЯ обратно: каждый токен кладётся на свою строку в свой столбец,
промежутки заполняются пробелами. Из исходника при сборке НЕ ЧИТАЕТСЯ ничего,
кроме числа строк.

ЧЕГО НЕ МЕРИТ, И ЭТО ГЛАВНАЯ ОГОВОРКА. Это НЕ ответ на гейт Г5. Г5
спрашивает, падает ли доверие к разбору с 5287 строк; снимает разбор с
границы только путь «печать из дерева разбора обратно в текст», а печатника
в flang нет вовсе. Кругооборот меряет ГОТОВНОСТЬ ИНГРЕДИЕНТА — довезли ли
токены то, из чего текст можно собрать. Число высокое и к вопросу гейта
отношения не имеет. Записать его ответом Г5 значило бы выдать готовность за
результат (задачи 7855 и эта).

КОРПУС — правилом, а не списком, чтобы не протухал:
    flang/proof/examples/*.flang   45
    flang/self/*.flang             58   (верхний уровень, без подкаталогов)
    examples/**/*.flang           193
                                  296

Поверхностный вид по видам токенов — правило названо, чтобы число было
проверяемо:
    keyword                   -> text
    name, quoted=true         -> «value»
    name, quoted=false        -> value
    number                    -> text
    string                    -> "text" с экранированием
    punct                     -> value
    newline/indent/dedent/eof -> ничего (разметка, не текст)

Сличение построчное, три разряда: «код» (непустая строка без `//`),
«комментарий» (есть `//`), «пусто».

КАК ЗВАТЬ:
    LC_ALL=C.UTF-8 python3 flang/proof/привязка/кругооборот.py
    LC_ALL=C.UTF-8 python3 flang/proof/привязка/кругооборот.py --причины
    LC_ALL=C.UTF-8 python3 flang/proof/привязка/кругооборот.py --файл ПУТЬ
Двоичный берётся `bootstrap/flang` от корня дерева. Прогон по всем 296 —
минуты; `--файл` — мгновенно.
"""
import json, os, re, subprocess, sys, tempfile

КОРЕНЬ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ДВОИЧНЫЙ = os.path.join(КОРЕНЬ, "bootstrap", "flang")

ШИРОКИЕ = "：，、；（）【】「」『』〈〉《》！？　０１２３４５６７８９"


def корпус():
    """Список файлов правилом. Порядок устойчив — сортировкой, не обходом."""
    из_ = []
    d = os.path.join(КОРЕНЬ, "flang", "proof", "examples")
    из_ += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".flang")]
    d = os.path.join(КОРЕНЬ, "flang", "self")
    из_ += [os.path.join(d, f) for f in os.listdir(d)
            if f.endswith(".flang") and os.path.isfile(os.path.join(d, f))]
    for корень, _, файлы in os.walk(os.path.join(КОРЕНЬ, "examples")):
        из_ += [os.path.join(корень, f) for f in файлы if f.endswith(".flang")]
    return sorted(из_)


def поверхность(т):
    в = т["kind"]
    if в in ("newline", "indent", "dedent", "eof"):
        return None
    if в == "keyword":
        return т.get("text", "")
    if в == "name":
        з = т.get("value", "")
        return ("«%s»" % з) if т.get("quoted") else з
    if в == "number":
        return т.get("text", "")
    if в == "string":
        з = т.get("value", "")
        if not isinstance(з, str):
            з = str(з)
        э = (з.replace("\\", "\\\\").replace('"', '\\"')
              .replace("\n", "\\n").replace("\t", "\\t").replace("\r", "\\r"))
        return '"' + э + '"'
    if в == "punct":
        з = т.get("value", "")
        return з if isinstance(з, str) else str(з)
    return т.get("text", "") or str(т.get("value", ""))


def собрать(токены, число_строк):
    сетка = {}
    неизвестные = set()
    for т in токены:
        с = поверхность(т)
        if с is None or с == "":
            if т["kind"] not in ("newline", "indent", "dedent", "eof"):
                неизвестные.add(т["kind"])
            continue
        сетка.setdefault(т["span"]["line"], []).append((т["span"]["column"], с))
    строки = []
    for н in range(1, число_строк + 1):
        буф = ""
        for столбец, с in sorted(сетка.get(н, [])):
            if len(буф) < столбец - 1:
                буф += " " * (столбец - 1 - len(буф))
            буф = буф[:столбец - 1] + с if len(буф) >= столбец - 1 else буф + с
        строки.append(буф)
    return строки, неизвестные


def разряд(строка):
    голая = строка.replace(" ", "").replace("\t", "").replace("\r", "")
    if голая == "":
        return "пусто"
    if "//" in строка:
        return "комментарий"
    return "код"


def причина(исходная, собранная):
    if "//" in исходная:
        return "строчный комментарий"
    if "/*" in исходная or "*/" in исходная:
        return "блочный комментарий"
    if собранная.strip() == "" and исходная.strip() != "":
        return "строка пропала целиком"
    if "\\u" in исходная or "\\x" in исходная:
        return "форма экранирования \\uXXXX"
    if any(з in исходная for з in ШИРОКИЕ):
        return "широкая пунктуация"
    if re.search(r'\\[nrt0abfv\\"/]', исходная):
        return "форма экранирования короткая"
    return "прочее"


def токены_файла(путь, каталог):
    """Снять токены двоичным. Код возврата берётся ДО всякого конвейера."""
    ключ = os.path.relpath(путь, КОРЕНЬ).replace("/", "__")[:-6]
    цель = os.path.join(каталог, ключ + ".json")
    with open(цель, "wb") as вых:
        код = subprocess.call([ДВОИЧНЫЙ, "tokens", путь, "--json"],
                              stdout=вых, stderr=subprocess.DEVNULL, cwd=КОРЕНЬ)
    if код != 0:
        return None, код
    try:
        with open(цель, encoding="utf-8") as ф:
            return json.load(ф), 0
    except Exception:
        return None, -1


def сличить(путь, дерево):
    текст = open(путь, encoding="utf-8").read()
    строки = текст.split("\n")
    if строки and строки[-1] == "":
        строки = строки[:-1]
    собранные, неизв = собрать(дерево["tokens"], len(строки))
    счёт = {"код": [0, 0], "комментарий": [0, 0], "пусто": [0, 0]}
    расхождения = []
    for н, (о, в) in enumerate(zip(строки, собранные), 1):
        р = разряд(о)
        счёт[р][0] += 1
        if о == в:
            счёт[р][1] += 1
        else:
            расхождения.append((н, о, в))
    целиком = all(с[0] == с[1] for с in счёт.values())
    return счёт, целиком, неизв, расхождения


def главная():
    лад = "свод"
    один = None
    доводы = sys.argv[1:]
    while доводы:
        д = доводы.pop(0)
        if д == "--причины":
            лад = "причины"
        elif д == "--файл":
            if not доводы:
                sys.stderr.write("--файл назван без пути\n")
                return 2
            один = доводы.pop(0)
        else:
            sys.stderr.write("непонятный ключ: %s (знаю --причины и --файл)\n" % д)
            return 2

    if not os.path.exists(ДВОИЧНЫЙ):
        sys.stderr.write("нет двоичного %s — собрать: make -C bootstrap\n" % ДВОИЧНЫЙ)
        return 5

    файлы = [os.path.abspath(один)] if один else корпус()
    итог = {"код": [0, 0], "комментарий": [0, 0], "пусто": [0, 0]}
    целиком_сошлось = 0
    отказов = []
    своды_причин = {}
    примеры = {}
    неизвестные_виды = set()

    with tempfile.TemporaryDirectory(prefix="krugooborot.",
                                     dir=os.environ.get("FLANG_TMP", "/srv/tmp")) as кат:
        for путь in файлы:
            дерево, код = токены_файла(путь, кат)
            if дерево is None:
                отказов.append((os.path.relpath(путь, КОРЕНЬ), код))
                continue
            счёт, целиком, неизв, расх = сличить(путь, дерево)
            неизвестные_виды |= неизв
            for р in итог:
                итог[р][0] += счёт[р][0]
                итог[р][1] += счёт[р][1]
            целиком_сошлось += 1 if целиком else 0
            if лад == "причины" or один:
                for н, о, в in расх:
                    п = причина(о, в)
                    своды_причин[п] = своды_причин.get(п, 0) + 1
                    примеры.setdefault(п, "%s:%d" % (os.path.basename(путь), н))

    if лад == "причины":
        print("причина\tстрок\tпример")
        for п, с in sorted(своды_причин.items(), key=lambda x: -x[1]):
            print("%s\t%d\t%s" % (п, с, примеры[п]))
        print("ИТОГО\t%d\t-" % sum(своды_причин.values()))
        return 0

    def доля(пара):
        return (100.0 * пара[1] / пара[0]) if пара[0] else 100.0

    print("КРУГООБОРОТ: текст → flang tokens → текст")
    print("  файлов в корпусе        %d" % len(файлы))
    if отказов:
        print("  токены НЕ СНЯЛИСЬ       %d" % len(отказов))
        for имя, код in отказов[:5]:
            print("      %s (код %s)" % (имя, код))
    print()
    print("  разряд        строк     собрано байт в байт")
    for р in ("код", "пусто", "комментарий"):
        print("  %-12s %7d     %7d (%.2f %%)" % (р, итог[р][0], итог[р][1], доля(итог[р])))
    print()
    print("  файлов ЦЕЛИКОМ байт в байт   %d из %d" % (целиком_сошлось, len(файлы)))
    if неизвестные_виды:
        print("  виды токенов без правила     %s" % ", ".join(sorted(неизвестные_виды)))
    print()
    print("  ЭТО НЕ ОТВЕТ ГЕЙТА Г5 — см. шапку файла: меряется готовность")
    print("  ингредиента, а не падение доверия к разбору.")
    return 1 if отказов else 0


if __name__ == "__main__":
    sys.exit(главная())
