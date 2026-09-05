#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
"""МЕРКА — одна линейка для flang и для C.

ВНЕСЕНА В ДЕРЕВО 5 сентября 2026 (задача ниже). До этого лежала во временном
каталоге, а КРИТЕРИЙ.md на её числа ссылался — та же порода, что закрыли в тот
же день у прибора кругооборота Г5 (задача 9751): число, невоспроизводимое из
репозитория, — не число.

ЗАЧЕМ ИМЕННО ОНА, если у дерева есть свой сторож потолка
(`flang/scripts/kernel-lines-to-trust.flang`):

  · тот меряет ТОЛЬКО flang. Эта — flang И C одной линейкой, и без неё
    обещание Г3 «чекер станет 3394 при ядре 4548, запас 1,34×» проверить
    НЕЧЕМ: чекер написан на C;
  · сверка двух приборов ловит описку в переписи. Замер 5 сентября на dev
    `2de1c726`: одиннадцать ключей, расхождений 0, ядроРешенийСтрок 4638
    у обоих.

ЧТО ОНА НЕ ЕСТЬ (повторено здесь, потому что шапка ниже об этом же):
НЕ второе мнение. Это перенос определения из kernel-lines-to-trust.flang;
ловит описку в переписи, но НЕ ошибку в самом определении.

ЧЕГО ОНА СТОИТ. Ещё один файл в «долг вне flang» (задача 9688: 103 файла при
потолке 63). Цена названа здесь нарочно: девять файлов долга завела одна
сессия 5 сентября, и ни у одного цену вслух не назвали.


ЗАЧЕМ. Весь замысел «доверие переезжает с 4548…6710 строк ядра на N строк
чекера» держится на том, что N померено ТОЙ ЖЕ линейкой, что и 4548. Пока N
меряется другой линейкой, утверждение непроверяемо: его нельзя ни подтвердить,
ни опровергнуть. Эта программа — линейка.

ПРОИСХОЖДЕНИЕ МЕРКИ. Дословный перенос `flang/scripts/kernel-lines-to-trust.flang`
(ветка `m/kernel-lines-declared-and-reasoning`, коммит f6ce365c), сверенный с
отметкой `flang/scripts/kernel-lines-to-trust-ceiling.json`.

СВЕРКА (снята 30 августа 2026; клоны и выемки — в этом же каталоге).
Входы всех прогонов ПОБАЙТОВО ОДНИ И ТЕ ЖЕ (md5: proofterm 71ed6b9f…,
proof-kernel bfbe62d3…, proof-initial 9ffc946c…, compiler.flang 5ae7c741…) —
значит дерево как переменная закреплено, меняется только линейка.

  входы (коммит)              потолок в дереве   линейка      расхождений
  c15f669f  ствол, 22:18      4628 / 7392        нынешняя      3   → 4548
  c15f669f  ствол, 22:18      4628 / 7392        --staraya     0   → 4628
  f6ce365c  ветка m           4548 / 7304        нынешняя      0   → 4548
  f6ce365c  ветка m           4548 / 7304        --staraya     3
  e4529f8e  main, 19:09       4628 / 7392        нынешняя      3   → 4548
  e4529f8e  main, 19:09       4628 / 7392        --staraya     0   → 4628

ЧИТАЕТСЯ ТАК. Мерка даёт 4548 знак в знак вместе со всеми одиннадцатью
остальными числами; трижды «расхождений: 3» — это не ошибка мерки, а
УСТАРЕВШИЙ ПОТОЛОК В ДЕРЕВЕ: правка «блочный комментарий — не код» живёт на
ветке m и в ствол ещё не влита, поэтому на стволе сторож с этой правкой обязан
дать код 1 (FLANG_VERIT_POTOLOK_USTAREL). Расходятся ровно три ключа, и все
три — вниз: код 7610→7522, достижимо 7392→7304, ядро 4628→4548.
Разница 4628 против 4548 — это смена ЛИНЕЙКИ, а не смена дерева, и здесь это
показано единственным способом, каким такое вообще показывается: дерево
закреплено, переключается только линейка.

ЧЕГО ЭТА МЕРКА НЕ ДОКАЗЫВАЕТ (сказано прямо, чтобы не выдали за большее):
  • Она НЕ независимое подтверждение. Это перенос определения из
    kernel-lines-to-trust.flang, той же породы, что shire.py: ловит описку в
    переписи, но НЕ ошибку в самом определении. Так и задумано — ячейке нужна
    ТА ЖЕ линейка, а не второе мнение. Независимый счёт — работа E1.
  • Она НЕ считает пул 602 и пол 3946. Эти два числа живут в прозе отметки
    («изЧегоСложено»), в двенадцать не входят, и E1 их не воспроизвела: у
    «124 голых ветвей» определения нет нигде. Мерка их не трогает вовсе, и
    сравнение чекера с ядром на них не опирается.
  • Двенадцать чисел названы поимённо в DVENADTSAT. Одиннадцать из них лежат
    в потолке; двенадцатое — «объявленоСтрок» (1904), сторож печатает его с
    30 августа, а в потолок не пишет.

═══════════════════════════════════════════════════════════════════════════
ЧЕМ МЕРЯЕТСЯ 4548 — ПРАВИЛА СЧЁТА ПОИМЁННО
═══════════════════════════════════════════════════════════════════════════
П1  ВСЕГО СТРОК   — текст режется по "\n"; последний перевод даёт пустой
                    кусок, отсюда +1 на файл (15282 по `wc -l` → 15285).
П2  ПУСТАЯ        — после удаления " ", "\t", "\r" ничего не осталось.
П3  КОММЕНТАРИЙ   — строка содержит "//", и до первой пары косых одни пробелы.
П4  БЛОЧНЫЙ       — `/* … */` живёт поперёк строк; снимается ДО разбора.
                    Строка, от которой не осталось живого, становится "//" —
                    то есть комментарием, не пустой, и границей не служит.
                    ЛОВУШКА: `/*` внутри строчного комментария (путь
                    `flang/self/*`) блок НЕ открывает.
П5  ОБЕЩАНИЕ      — сжатая строка начинается с `обеспечивает«`, `требует«`,
                    `пример«`, `дано`, `ожидается`. Довод: такая строка не
                    может ответить ДА вместо НЕТ — только остановить работу.
П6  КОД           — всего − комментарий − пусто − обещания. Разность, не сумма.
П7  ЗАГОЛОВОК     — с первой колонки `тотальная функция «` / `функция «`;
                    имя от первой ёлочки до БЛИЖАЙШЕЙ закрывающей.
П8  ГРАНИЦА       — строка, чей первый знак не " ", "\t", "/", "\r"; либо
                    следующий заголовок; либо конец файла.
П9  «код» функции — 1 (заголовок) + строки тела, прошедшие П6.
П10 ОБЪЯВЛЕНО     — заголовок + строки `принимает` / `возвращает`.
П11 ВОЗВРАТ       — первая строка тела с отступом, где до "возвращает " одни
                    пробелы, а после — `признак` | `строка` | `список строки`.
П12 ЗОВ           — имя в ёлочках в теле (литералы вычищены, комментарии и
                    обещания пропущены, своё имя не считается).
П13 ПОВЕРХНОСТЬ   — имена ядра, которые `compiler.flang` зовёт СВОИМ КОДОМ
                    (без комментариев и без блочных).
П14 ДОСТИЖИМО     — замыкание по зовам от поверхности; сумма «код».
П15 ЯДРО РЕШЕНИЙ  — замыкание от функций с возвратом `признак`; сумма «код».
                    ЭТО И ЕСТЬ 4548.
П16 ТОЛЬКО СЛОВА  — функции ВНЕ ядра, возвращающие строку: соврать могут лишь
                    текстом отказа.
П17 РАЗБОР ФОРМЫ  — строки ядра с одним из 15 имён разбора бесформенного узла.
П18 С «ЗНАЧЕНИЕМ» — «Значение» в заголовке или в первых пяти строках тела.
Молчаливое следствие П7/П8, важное для переноса: объявления ТИПОВ (`объект`,
`тип`) не приписаны ни одной функции и в ядро не входят никогда.

═══════════════════════════════════════════════════════════════════════════
ПЕРЕНОС МЕРКИ НА C — РЕШЕНИЯ ПОИМЁННО (Д1…Д17), С ДОВОДАМИ
Перенос не механический: у flang обещания и примеры — часть языка, у C их нет;
зато у C есть заголовки, макросы и препроцессор, которых нет у flang.
═══════════════════════════════════════════════════════════════════════════
Д1  СТРОКА — физическая, тот же `split("\n")`, тот же +1 на файл.
    Довод: мера отвечает на «сколько читать глазами», а глаза читают
    физические строки. Продолжение строки обратной косой логически склеивает
    строки, но читателю их всё равно две.
Д2  ПУСТАЯ — правило переносится без изменений.
Д3  КОММЕНТАРИЙ — у C ровно те же две формы, `//` и `/* */`; правило и его
    ловушка переносятся дословно. НО у flang `/*` внутри литерала не бывает
    (сторож это проверил и сказал вслух), а у C будет. Решение: линейку не
    менять (иначе она перестанет быть той же), а поставить СИГНАЛ: мерка
    печатает ⚠ ЛОВУШКА Д3, если увидит `/*`, `*/` внутри литерала. Молчаливого
    расхождения быть не может.
Д4  ОБЕЩАНИЯ. У C нет `обеспечивает`/`пример`, но есть та же ПОРОДА строк —
    те, что не могут ответить ДА вместо НЕТ, а могут лишь остановить работу:
    `assert`, `static_assert`, `_Static_assert`. Переносится ДОВОД, а не
    синтаксис. Оговорка против игры со счётом: assert с побочным действием
    (`=`, `++`, `--`) — это КОД. Примеры flang живут внутри функции и
    вычитаются; тесты C живут отдельными файлами и просто не входят в набор.
Д5  ЗАГОЛОВОК. У C нет ключевого слова. Правило: строка с первой колонки, в
    ней имя, за которым `(`, и она не кончается на `;`. Плюс СКЛЕЙКА: если
    строкой выше стоит голый тип (`static int` \n `imya(...)`), обе строки —
    заголовок. Довод: у flang заголовок однострочный по грамматике, у C
    двухстрочный стиль обычен, и без склейки счёт соврал бы вниз на строку
    с каждой функции. Число склеек печатается.
Д6  ГРАНИЦА ФУНКЦИИ. Самое большое расхождение, и оно названо числом.
    У flang граница ИСКЛЮЧАЮЩАЯ: строка-граница принадлежит следующему. У C
    тело закрывает `}` в первой колонке, и эта строка принадлежит ЭТОЙ
    функции. Довод: `}` читатель читает, у flang такой строки нет вовсе.
    Значит у C есть честный перекос +1 строка на функцию. Он не прячется:
    мерка печатает `строк на закрывающую фигурную`, и всякий может вычесть.
Д7  ВОЗВРАТ `признак`. У flang тип `признак` даёт круг решений даром. У C
    решение возвращает `bool` (<stdbool.h>). `int` ответом да/нет НЕ считается:
    он слишком многозначен и смёл бы в ядро всё подряд. Это КОНТРАКТ НА СТИЛЬ
    чекера, объявленный до замера: чекер, отвечающий `int`, надо мерить заново
    и об этом сказать. `char *` / `const char *` — это «строка», «только слова».
Д8  ПРЕПРОЦЕССОР, которого у flang нет вовсе.
    Д8а `#define ИМЯ(…)` — функциеподобный макрос считается ФУНКЦИЕЙ, его тело
        тянется по обратным косым. Довод — самый важный во всём переносе:
        БЕЗ ЭТОГО ПРАВИЛА чекер мог бы переложить всю решающую логику в
        макросы, и число ушло бы почти в ноль, ничего не сняв с доверия.
    Д8б `#if`/`#ifdef`/`#endif` внутри функции — её строки кода; функцию не
        закрывают (иначе одна `#endif` в первой колонке разорвала бы функцию).
    Д8в Считается ТЕКСТ, а не сборка: условная компиляция даёт надмножество
        любой конфигурации. Ошибка в БОЛЬШУЮ сторону — туда же, куда ошибается
        сторож flang («имя поля выглядит как вызов»).
Д9  ТИПЫ И ГЛОБАЛЬНЫЕ. `struct`, `typedef`, глобальные переменные — в КОД
    входят, ни к какой функции не приписаны, в ядро не попадают. Это ровно то
    же, что flang делает с `объект`/`тип`. Перекос одинаков у обоих — значит
    сравнению не мешает.
Д10 ЗОВ. У flang зов виден по ёлочкам. У C — объявленное имя как ЦЕЛОЕ СЛОВО,
    СО СКОБКОЙ И БЕЗ. Довод: чекер из A1 зовёт проверки правил указателями из
    таблицы; счёт «только со скобкой» показал бы пустой граф ровно там, где
    принимаются решения. Замыкание по МНОЖЕСТВУ, не по подстроке: у flang имя
    обёрнуто ёлочками и подстрокой другого не станет, у C `node` — подстрока
    `node_kind`, и счёт по подстроке был бы прямой ошибкой.
Д11 ПОВЕРХНОСТЬ. У flang зовущий — чужой файл `compiler.flang`. У чекера
    зовущий — он сам: поверхность = `main`. Если зовущий назван ключом
    `--zovushchiy`, берётся он, как у flang.
Д12 РАЗБОР ФОРМЫ и С «ЗНАЧЕНИЕМ» — НЕ ПЕРЕНОСЯТСЯ. Они меряют, сколько строк
    ТРОНЕТ названный ход по flang (типизированный терм вместо бесформенного
    «Значения»). Это вопрос про план для flang, а не свойство кода. Придумать
    им C-двойник значит положить в таблицу сравнения число, которое ничего не
    значит. Печатаются нулями и помечены `непереносится` — ноль тут не замер.
Д13 (снято: слилось с Д6.)
Д14 СТРУКТУРНЫЕ ПРОВЕРКИ (кончается ли строка на `;`) делаются по строке без
    литералов и без хвостового `//`; СЧИТАЕТСЯ строка нетронутой.
Д15 ЗАГОЛОВОЧНЫЕ ФАЙЛЫ. Прототип в `.h` — это в точности flang-ово
    `принимает`/`возвращает`: ошибка в нём значит «делает не то, что
    объявило». Решение: прототип ПРИПИСЫВАЕТСЯ одноимённому определению как
    +1 «код» и +1 «объявлено». Довод обязательный: иначе одно лишь дробление
    `.c` на `.c`+`.h` уменьшало бы число доверия, не убрав ни строки из того,
    что читатель обязан прочесть.
Д16 ФАЙЛОВЫЙ УРОВЕНЬ ПРОВОДИТ ИМЕНА. Строки вне функций (таблица правил,
    инициализатор массива указателей) приписать некому, но имя в программу они
    проводят. Их имена идут в ПОВЕРХНОСТЬ. Довод замерен на образце:
    без правила три проверки правил оказались недостижимы, `достижимоСтрок`
    172 вместо 192 — соврало вниз ровно на решающие функции.
Д17 ВНЕШНИЕ ИМЕНА (libc) — НАЗЫВАЮТСЯ ПОИМЁННО, НО НЕ ПЕРЕСЧИТЫВАЮТСЯ В
    СТРОКИ. Довод: у `memcmp` из glibc тысячи строк SIMD, их никто не читает
    глазами, и вписать их в число значит утопить его. Но и молчать нельзя:
    это верхний край полосы доверия чекера — ровно то же место, которое у
    flang занимают вычислитель и разбор в полосе 4548…6710. Зов через поле
    записи (`p->kak(…)`) внешним именем не считается и печатается отдельно.

═══════════════════════════════════════════════════════════════════════════
ЧТО В ЧЕКЕРЕ НА C СЧИТАЕТСЯ ДОВЕРИЕМ, А ЧТО НЕТ
═══════════════════════════════════════════════════════════════════════════
СЧИТАЕТСЯ (входит в `ядроРешенийСтрок` — число, сравнимое с 4548):
  • РАЗБОР JSON — да, целиком и без оговорок. Неверный разбор подсунет правилу
    не тот `вывод`, и вердикт станет неверным молча. Он внутри замыкания по
    построению: он производит те данные, которые видят правила.
    ⚠ ГЛАВНОЕ ПРАВИЛО ЧЕСТНОСТИ ВСЕГО СРАВНЕНИЯ: 4548 НЕ включает
    `parser.flang` — и потому занижено, о чём отметка говорит вслух. Если
    число чекера тоже вынести разбор за скобки, сравнение будет подтасовано
    в пользу C. Разбор — внутри.
  • ПРИВЕДЕНИЕ К ОБЩЕМУ ВИДУ — да. Оно решает, когда два вывода «одно и то
    же»; ошибка здесь доказывает ДРУГОЕ утверждение.
  • ТАБЛИЦА ПРАВИЛ — да, и данные, и проверки. Строка таблицы не пуста, не
    комментарий, не обещание — значит КОД по П6; а перепутанная строка
    таблицы запустит не ту проверку. Плюс Д16: таблица проводит имена.
  • МАКРОСЫ-ФУНКЦИИ — да (Д8а), иначе счёт обходится макросами.
  • ПРОТОТИПЫ в `.h` — да, как ОБЪЯВЛЕНО (Д15).
НЕ СЧИТАЕТСЯ (и это то же, что не считает flang):
  • комментарии — в них доводы, почему правило теорема; ошибиться в них нельзя;
  • пустые строки; `assert`/`static_assert` (Д4);
  • «только слова»: `--help`, печать отказа, красивый вывод сломанного узла —
    недостижимы от ответа да/нет и соврать могут лишь текстом (П16);
  • сам прувер (flang) — в этом весь переезд;
  • объявления типов (Д9).
НЕ СЧИТАЕТСЯ, НО ОБЯЗАНО БЫТЬ НАЗВАНО — ВТОРОЙ КРАЙ ПОЛОСЫ:
  • LIBC. Вопрос «считается ли libc» правильного ответа «да» или «нет» не
    имеет; правильный ответ — «называется поимённо и не пересчитывается в
    строки» (Д17). `memcmp`/`strcmp` — буквально сравнение выводов, вердикт
    висит на них. Честная запись доверия чекера — ПОЛОСА, как у ядра:
        N строк чекера … N + libc поимённо,
    против 4548…6710 у ядра. Хочется сузить полосу — чекер пишется freestanding
    со своими двадцатью строками `memcmp`, и libc ПЕРЕЕЗЖАЕТ ВНУТРЬ N.
    Это единственный честный способ уменьшить полосу.
  • КОМПИЛЯТОР C, ОС, ЖЕЛЕЗО. Не считаются — но у flang ровно так же не
    считаются его компилятор и семя. Исключение СИММЕТРИЧНО, сравнение не
    перекашивает; молчать о нём всё равно нельзя.
ЧЕГО ГОВОРИТЬ НЕЛЬЗЯ: «доверие сведено к N строкам». Честная запись:
  доверие переехало с [4548…6710 строк flang + компилятор flang + семя]
  на [N строк чекера + libc поимённо + компилятор C],
и выигрыш настоящий только если N сильно меньше 4548 И N вправду читается
глазами целиком.

═══════════════════════════════════════════════════════════════════════════
Запуск:
  merka.py --sverka [КОРЕНЬ] [--staraya-merka]   сверка с отметкой дерева
  merka.py [--narechie flang|c] [--zovushchiy ФАЙЛ] [--json] [--poimenno] ФАЙЛ…
"""
import sys, os, re, json, argparse

# ═══════════════════════════════════════════════════════════════════════════
#  ОБЩЕЕ ДЛЯ ОБОИХ НАРЕЧИЙ — правила, у которых перенос ничего не меняет
# ═══════════════════════════════════════════════════════════════════════════

def bez_probelov(s):
    """«Без пробелов»: пробел, табуляция, возврат каретки — насовсем."""
    return s.replace(" ", "").replace("\t", "").replace("\r", "")

def pustaya(s):
    """«Пустая строка»."""
    return len(bez_probelov(s)) == 0

def stroka_kommentariya(s):
    """«Строка комментария»: до первой пары косых — одни пробелы."""
    if "//" not in s:
        return False
    return len(bez_probelov(s.split("//")[0])) == 0

def snyat_bloki_v_stroke(strochka, vnutri):
    """«Снять блоки в строке». Что осталось живого и открыт ли блок к концу.

    ЛОВУШКА, названная сторожем: пара `/*` встречается ВНУТРИ строчного
    комментария (путь `flang/self/*` в обратных кавычках). Поэтому блок
    открывается ТОЛЬКО когда до `/*` на этой строке нет `//`.
    """
    for _ in range(200):
        if vnutri:
            if "*/" not in strochka:
                return "", True
            strochka = "*/".join(strochka.split("*/")[1:])
            vnutri = False
            continue
        if "/*" not in strochka:
            return strochka, False
        do = strochka.split("/*")[0]
        if "//" in do:
            return strochka, False
        # рекурсия сторожа развёрнута в цикл: копим живое слева
        hvost = "/*".join(strochka.split("/*")[1:])
        zhivoe, vn = snyat_bloki_v_stroke(hvost, True)
        return do + zhivoe, vn
    return "", vnutri

def bez_blochnyh(tekst):
    """«Без блочных». Число строк сохраняется знак в знак: строка, от которой
    после снятия блока не осталось живого, становится «//» — то есть считается
    КОММЕНТАРИЕМ, а не пустой, и границей функции не служит."""
    out = []
    vnutri = False
    for s in tekst.split("\n"):
        zhivoe, vnutri = snyat_bloki_v_stroke(s, vnutri)
        if pustaya(zhivoe) and not pustaya(s):
            out.append("//")
        else:
            out.append(zhivoe)
    return "\n".join(out)

def bez_kommentariev(tekst):
    """«Без комментариев»: выбросить строки-комментарии целиком."""
    return "\n".join(l for l in tekst.split("\n") if not stroka_kommentariya(l))

def hvost_kosyh_nechyoten(kusok):
    t = kusok.split("\\")[1:]
    cnt = 0
    for part in t:
        cnt = cnt + 1 if len(part) == 0 else 0
    return cnt % 2 == 1

def bez_literalov(tekst):
    """«Без литералов»: содержимое строковых литералов -> "". Незакрытый
    литерал остаётся как есть."""
    kuski = tekst.split('"')
    gotovo = ""; vnutri = False; syroe = ""; prezhniy = ""; nomer = 0
    for kusok in kuski:
        if nomer == 0:
            gotovo = kusok; vnutri = False; syroe = ""; prezhniy = kusok; nomer = 1
        elif not vnutri:
            vnutri = True; syroe = '"' + kusok; prezhniy = kusok; nomer += 1
        elif hvost_kosyh_nechyoten(prezhniy):
            syroe = syroe + '"' + kusok; prezhniy = kusok; nomer += 1
        else:
            gotovo = gotovo + '""' + kusok; vnutri = False; syroe = ""; prezhniy = kusok; nomer += 1
    return gotovo + syroe if vnutri else gotovo

# ── набор имён живёт СТРОКОЙ, как у сторожа ────────────────────────────────
# Не множеством: сторож проверяет вхождение подстрокой, и там, где имя одного
# работника окажется подстрокой другого, множество дало бы другой ответ.
# Мерка обязана ошибаться там же, где ошибается сторож.

def dobavit_v_nabor(nabor, metka):
    return nabor if metka in nabor else nabor + metka

# ═══════════════════════════════════════════════════════════════════════════
#  НАРЕЧИЕ FLANG — дословный перенос сторожа
# ═══════════════════════════════════════════════════════════════════════════

SLOVA_FORMY_FLANG = ["«Это запись»", "«Это список»", "«Это строка»", "«Это ничто»",
    "«Есть поле у узла»", "«Взять поле»", "«Вид узла»", "«Строка поля»",
    "«Элементы поля»", "«Поля узла»", "«Элементы узла»", "«Строка узла»",
    "«Число узла»", "«Первое из полей»", "«Поле узла»"]

def f_stroka_obeshchaniya(s):
    z = bez_probelov(s)
    return (z.startswith("обеспечивает«") or z.startswith("требует«")
            or z.startswith("пример«") or z.startswith("дано") or z.startswith("ожидается"))

def f_stroka_obyavleniya(s):
    z = bez_probelov(s)
    return z.startswith("принимает") or z.startswith("возвращает")

def f_sleva_ne_probel(s):
    if len(s) == 0:
        return False
    return s[0] not in (" ", "\t", "/", "\r")

def f_zagolovok(s):
    if not (s.startswith("тотальная функция «") or s.startswith("функция «")):
        return ""
    hvostik = "«".join(s.split("«")[1:])
    if "»" not in hvostik:
        return ""
    goloe = hvostik.split("»")[0]
    return "" if len(goloe) == 0 else "«" + goloe + "»"

def f_obyavlennyy_vozvrat(s):
    if not s.startswith(" "):
        return ""
    if "возвращает " not in s:
        return ""
    if len(bez_probelov(s.split("возвращает ")[0])) != 0:
        return ""
    szh = bez_probelov("возвращает ".join(s.split("возвращает ")[1:]))
    return {"признак": "признак", "строка": "строка", "списокстроки": "список строки"}.get(szh, "")

def f_imena_v_tekste(tekst):
    """«Имена в тексте»: имя от ёлочки до БЛИЖАЙШЕЙ закрывающей, поэтому
    вложенная открывающая попадает внутрь имени. Ответ — набор-строка."""
    kuski = tekst.split("»")
    vsego = len(kuski)
    imena = ""
    for i, kusok in enumerate(kuski):
        if i + 1 == vsego:
            break
        if "«" not in kusok:
            continue
        goloe = "«".join(kusok.split("«")[1:])
        if len(goloe) == 0:
            continue
        imena = dobavit_v_nabor(imena, "«" + goloe + "»")
    return imena

def f_ostavit_izvestnye(nachalo, naydennye, imena, krome):
    akk = nachalo
    for kusok in naydennye.split("»"):
        if len(kusok) == 0:
            continue
        metka = kusok + "»"
        if metka in imena and metka != krome:
            akk = dobavit_v_nabor(akk, metka)
    return akk

def f_razobrat(teksty, slova_formy):
    """Первый проход: границы функций и всё, что считается по своим строкам."""
    rabotniki = []
    h = dict(всего=0, комментарий=0, пусто=0, обещания=0)
    idyot = False; metka = ""; vozvrat = ""
    kod = 0; obyavleno = 0; razbor = 0; podpis = 0; shest = 0
    stroki = []
    lines_of = {}

    def sprashivaet_formu(s):
        return any(w in s for w in slova_formy)

    def ulozhit():
        if idyot:
            rabotniki.append(dict(метка=metka, возврат=vozvrat, код=kod,
                                  объявлено=obyavleno, разбор=razbor, подпись=podpis))
            lines_of.setdefault(metka, []).extend(stroki)

    for tekst in teksty:
        for s in tekst.split("\n"):
            h["всего"] += 1
            p = pustaya(s)
            k = False if p else stroka_kommentariya(s)
            if p: h["пусто"] += 1
            if k: h["комментарий"] += 1
            ob = False if (p or k) else f_stroka_obeshchaniya(s)
            if ob: h["обещания"] += 1
            zag = f_zagolovok(s)
            if len(zag) != 0:
                ulozhit()
                idyot = True; metka = zag; vozvrat = ""
                kod = 1; obyavleno = 1
                razbor = 1 if sprashivaet_formu(s) else 0
                podpis = 1 if "«Значение»" in s else 0
                shest = 1; stroki = [s]
            elif idyot and f_sleva_ne_probel(s):
                ulozhit()
                idyot = False; metka = ""; vozvrat = ""
                kod = obyavleno = razbor = podpis = shest = 0; stroki = []
            elif not idyot:
                pass
            else:
                if len(vozvrat) == 0:
                    vozvrat = f_obyavlennyy_vozvrat(s)
                kodovaya = (not p) and (not k) and (not ob)
                if kodovaya:
                    kod += 1; stroki.append(s)
                    if f_stroka_obyavleniya(s): obyavleno += 1
                    if sprashivaet_formu(s): razbor += 1
                if shest < 6 and "«Значение»" in s:
                    podpis = 1
                shest += 1
        ulozhit()
        idyot = False; metka = ""; vozvrat = ""
        kod = obyavleno = razbor = podpis = shest = 0; stroki = []
    return rabotniki, h, lines_of

def f_zovy(teksty, imena):
    out = []
    idyot = False; metka = ""; zovyot = ""
    def ulozhit():
        if idyot:
            out.append((metka, zovyot))
    for tekst in teksty:
        for s in tekst.split("\n"):
            zag = f_zagolovok(s)
            if len(zag) != 0:
                ulozhit()
                idyot = True; metka = zag
                zovyot = f_ostavit_izvestnye("", f_imena_v_tekste(bez_literalov(s)), imena, zag)
            elif idyot and f_sleva_ne_probel(s):
                ulozhit(); idyot = False; metka = ""; zovyot = ""
            elif (not idyot) or stroka_kommentariya(s) or f_stroka_obeshchaniya(s):
                pass
            else:
                zovyot = f_ostavit_izvestnye(zovyot, f_imena_v_tekste(bez_literalov(s)), imena, metka)
        ulozhit(); idyot = False; metka = ""; zovyot = ""
    return out

# ═══════════════════════════════════════════════════════════════════════════
#  НАРЕЧИЕ C — та же мерка, перенесённая
#  Каждое решение о переносе помечено Д-номером; доводы — в ПЕРЕНОС.md
# ═══════════════════════════════════════════════════════════════════════════

C_KLYUCHEVYE = {"if", "while", "for", "switch", "return", "sizeof", "do", "else",
                "defined", "case", "goto", "break", "continue", "typedef",
                "struct", "union", "enum", "static_assert", "_Static_assert",
                "assert", "va_start", "va_arg", "va_end"}
IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
VYZOV = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(")

def c_bez_hvosta_kommentariya(s):
    """Д14. Для СТРУКТУРНЫХ проверок (кончается ли строка на `;` или `{`)
    хвостовой `//`-комментарий снимается; для СЧЁТА строка не трогается."""
    t = bez_literalov(s)
    if "//" in t:
        t = t.split("//")[0]
    return t

def c_stroka_obeshchaniya(s):
    """Д4. У C нет `обеспечивает`/`пример`, но есть та же ПОРОДА строк: те,
    что не могут ответить ДА вместо НЕТ, а могут только остановить работу.
    Это `assert`, `static_assert`, `_Static_assert`.
    Оговорка против игры со счётом: assert с побочным действием (`=`, `++`,
    `--`) — это КОД, а не обещание."""
    z = bez_probelov(s)
    if not (z.startswith("assert(") or z.startswith("static_assert(")
            or z.startswith("_Static_assert(")):
        return False
    telo = s[s.find("(") + 1:]
    telo = telo.replace("==", "").replace("!=", "").replace("<=", "").replace(">=", "")
    if "=" in telo or "++" in telo or "--" in telo:
        return False          # побочное действие — это код
    return True

def c_col1(s):
    return len(s) > 0 and s[0] not in (" ", "\t", "\r")

def c_imya_opredeleniya(struct_line):
    """Имя из строки-заголовка: первое имя, за которым стоит `(`."""
    for m in VYZOV.finditer(struct_line):
        if m.group(1) not in C_KLYUCHEVYE:
            return m.group(1), m.start(1), m.end(1)
    return "", -1, -1

def c_vozvrat(pered_imenem):
    """Д7. `bool` — это `признак`. `int` НЕ считается ответом да/нет: он
    слишком многозначен, и счёт по нему смёл бы в ядро всё подряд.
    `char *` / `const char *` — это «строка» («только слова»)."""
    t = re.sub(r"\b(static|inline|extern|_Noreturn|const)\b", " ", pered_imenem)
    t = bez_probelov(t)
    if t in ("bool", "_Bool"):
        return "признак"
    if t in ("char*", "char**"):
        return "строка"
    return ""

def c_razobrat(teksty, slova_formy):
    """Первый проход по C. Возвращает то же, что f_razobrat."""
    rabotniki = []
    h = dict(всего=0, комментарий=0, пусто=0, обещания=0)
    prototipy = []            # (имя, «объявлено»-строк) — Д15
    diagnostika = dict(фигурныхСтрок=0, макросовФункций=0, склеенныхЗаголовков=0,
                       прототипов=0, ловушкаЛитерала=[])
    tek = None                # текущая функция
    glubina = 0               # глубина скобок в списке параметров (>0 — ещё объявлено)
    v_makro = False
    zhdyot_prodolzheniya = False
    tip_stroka = None         # Д5: висящая строка типа перед заголовком

    def sprashivaet_formu(s):
        return any(w in s for w in slova_formy)

    def otkryt(metka, vozvrat, kod, obyavleno, s):
        return dict(метка=metka, возврат=vozvrat, код=kod, объявлено=obyavleno,
                    разбор=(1 if sprashivaet_formu(s) else 0), подпись=0, шестёрка=1)

    def ulozhit():
        nonlocal tek
        if tek is not None:
            rabotniki.append({k: tek[k] for k in ("метка", "возврат", "код",
                                                  "объявлено", "разбор", "подпись")})
        tek = None

    for put_i, tekst in enumerate(teksty):
        for s in tekst.split("\n"):
            h["всего"] += 1
            p = pustaya(s)
            k = False if p else stroka_kommentariya(s)
            if p: h["пусто"] += 1
            if k: h["комментарий"] += 1
            ob = False if (p or k) else c_stroka_obeshchaniya(s)
            if ob: h["обещания"] += 1
            kodovaya = (not p) and (not k) and (not ob)
            struct = c_bez_hvosta_kommentariya(s)
            szh = bez_probelov(struct)

            # ── ловушка Д3: `/*`, `*/` или ведущий `//` внутри литерала ──
            syroy = s
            if ('"' in syroy) and (bez_literalov(syroy) != syroy):
                vyrez = syroy
                # то, что литерал СЪЕЛ
                if ("/*" in vyrez or "*/" in vyrez) and \
                   ("/*" not in bez_literalov(vyrez) and "*/" not in bez_literalov(vyrez)):
                    diagnostika["ловушкаЛитерала"].append(s.strip()[:60])

            # ── Д8: продолжение макроса-функции ──
            if v_makro:
                if zhdyot_prodolzheniya:
                    if kodovaya and tek is not None:
                        tek["код"] += 1
                        if sprashivaet_formu(s): tek["разбор"] += 1
                    zhdyot_prodolzheniya = struct.rstrip().endswith("\\")
                    continue
                else:
                    ulozhit(); v_makro = False

            # ── Д8: `#define ИМЯ(` — макрос-функция считается ФУНКЦИЕЙ ──
            if c_col1(s) and szh.startswith("#define"):
                m = re.match(r"\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)\(", struct)
                if m:
                    ulozhit()
                    tek = otkryt(m.group(1), "", 1, 1, s)
                    diagnostika["макросовФункций"] += 1
                    v_makro = True
                    zhdyot_prodolzheniya = struct.rstrip().endswith("\\")
                    glubina = 0
                    tip_stroka = None
                    continue

            # ── Д8: прочие строки препроцессора границей функции не служат ──
            if c_col1(s) and szh.startswith("#"):
                if tek is not None and kodovaya:
                    tek["код"] += 1
                    if sprashivaet_formu(s): tek["разбор"] += 1
                tip_stroka = None
                continue

            if k or p:
                # комментарий и пустая: ни границы, ни кода
                continue

            # ── Д6: граница функции — `}` в первой колонке, ВКЛЮЧИТЕЛЬНО ──
            if c_col1(s) and s.lstrip().startswith("}"):
                if tek is not None:
                    if kodovaya:
                        tek["код"] += 1
                        diagnostika["фигурныхСтрок"] += 1
                        if sprashivaet_formu(s): tek["разбор"] += 1
                    ulozhit()
                glubina = 0; tip_stroka = None
                continue

            if c_col1(s):
                # ── Д5: висящая строка типа (`static int` \n `имя(...)`) ──
                if ("(" not in struct) and (";" not in struct) and ("{" not in struct) \
                   and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_ \t\*]*", struct.strip() or "\0"):
                    tip_stroka = s
                    continue
                imya, i0, i1 = c_imya_opredeleniya(struct)
                if imya:
                    otkr = struct.count("(") - struct.count(")")
                    est_tochka = struct.rstrip().endswith(";")
                    if est_tochka and otkr <= 0:
                        # ── Д15: ПРОТОТИП. Не открывает функцию; его строки
                        # позже приписываются одноимённой функции как ОБЪЯВЛЕНО.
                        prototipy.append(imya)
                        diagnostika["прототипов"] += 1
                        tip_stroka = None
                        continue
                    ulozhit()
                    pered = (tip_stroka + " " if tip_stroka else "") + struct[:i0]
                    kod0 = 2 if tip_stroka else 1
                    if tip_stroka:
                        diagnostika["склеенныхЗаголовков"] += 1
                    tek = otkryt(imya, c_vozvrat(pered), kod0, kod0, s)
                    glubina = max(0, otkr)
                    tip_stroka = None
                    continue
                tip_stroka = None
                # строка верхнего уровня, не заголовок: типы, глобальные —
                # в КОД идёт, ни к какой функции не приписана (как `объект` у flang)
                continue

            tip_stroka = None
            if tek is None:
                continue
            # ── тело ──
            if kodovaya:
                tek["код"] += 1
                if glubina > 0:
                    tek["объявлено"] += 1
                if sprashivaet_formu(s): tek["разбор"] += 1
            if glubina > 0:
                glubina += struct.count("(") - struct.count(")")
                if glubina < 0: glubina = 0
            if tek["шестёрка"] < 6 and any(w in s for w in slova_formy):
                pass
            tek["шестёрка"] += 1
        ulozhit(); v_makro = False; glubina = 0; tip_stroka = None

    # ── Д15: прототип приписывается одноимённой функции ──
    po_imeni = {}
    for r in rabotniki:
        po_imeni.setdefault(r["метка"], r)
    for imya in prototipy:
        if imya in po_imeni:
            po_imeni[imya]["код"] += 1
            po_imeni[imya]["объявлено"] += 1
    return rabotniki, h, diagnostika

C_NE_ZOV = C_KLYUCHEVYE | {"sizeof", "offsetof", "alignof", "_Alignof",
                           "int", "char", "long", "short", "void", "float",
                           "double", "unsigned", "signed", "bool", "_Bool",
                           "const", "static", "inline", "extern", "register",
                           "volatile", "restrict"}

def c_vneshnie(teksty, imena_mn):
    """Д17. Имена, которые чекер зовёт, но САМ НЕ ОБЪЯВЛЯЕТ, — это libc и
    всё прочее снаружи файлового набора. В строки их не пересчитать (у
    memcmp из glibc тысячи строк на SIMD, и глазами их никто не читает), но
    НАЗВАТЬ ПОИМЁННО обязано: это верхний край полосы доверия чекера, ровно
    как «вычислитель и разбор» — верхний край полосы 4548…6710."""
    schyot = {}
    polya = {}
    for tekst in teksty:
        for s in tekst.split("\n"):
            if pustaya(s) or stroka_kommentariya(s):
                continue
            t = c_bez_hvosta_kommentariya(s)
            if bez_probelov(t).startswith("#"):
                continue
            for m in VYZOV.finditer(t):
                n = m.group(1)
                if n in imena_mn or n in C_NE_ZOV:
                    continue
                do = t[:m.start(1)].rstrip()
                if do.endswith(".") or do.endswith("->"):
                    # зов через поле записи (указатель на проверку из таблицы):
                    # это НЕ внешнее имя. Сторож flang такой случай считает
                    # вызовом и ошибается В БОЛЬШУЮ сторону; здесь он назван.
                    polya[n] = polya.get(n, 0) + 1
                    continue
                schyot[n] = schyot.get(n, 0) + 1
    return schyot, polya

def c_fajlovyy_uroven(teksty, imena_mn):
    """Д16. Строки ВЕРХНЕГО УРОВНЯ, не принадлежащие ни одной функции
    (таблица правил, инициализатор, массив указателей), имён никому не
    приписывают — приписать некому. Но они ПРОВОДЯТ имя в программу: без
    этого правила таблица правил из A1 сделала бы каждую проверку правила
    недостижимой, и `достижимоСтрок` соврал бы вниз ровно на те функции,
    которые и принимают решения. Поэтому их имена идут в ПОВЕРХНОСТЬ."""
    naydeno = set()
    for tekst in teksty:
        v_funktsii = False
        v_makro = False
        zhdyot = False
        for s in tekst.split("\n"):
            if pustaya(s) or stroka_kommentariya(s):
                continue
            struct = c_bez_hvosta_kommentariya(s)
            szh = bez_probelov(struct)
            if v_makro:
                if zhdyot:
                    zhdyot = struct.rstrip().endswith("\\")
                    continue
                v_makro = False
            if c_col1(s) and szh.startswith("#"):
                if re.match(r"\s*#\s*define\s+[A-Za-z_][A-Za-z0-9_]*\(", struct):
                    v_makro = True
                    zhdyot = struct.rstrip().endswith("\\")
                continue
            if c_col1(s) and s.lstrip().startswith("}"):
                v_funktsii = False
                continue
            if c_col1(s):
                imya, i0, i1 = c_imya_opredeleniya(struct)
                if imya and not (struct.rstrip().endswith(";")
                                 and struct.count("(") - struct.count(")") <= 0):
                    v_funktsii = True
                    continue
                if imya:            # прототип: объявляет, но не зовёт
                    continue
                if not v_funktsii:
                    naydeno |= {n for n in IDENT.findall(bez_literalov(struct))
                                if n in imena_mn}
                continue
            if not v_funktsii:
                naydeno |= {n for n in IDENT.findall(bez_literalov(struct))
                            if n in imena_mn}
    return naydeno

def c_zovy(teksty, imena_mn):
    """Д10. Зов — ЛЮБОЕ вхождение объявленного имени как целого слова, со
    скобкой и без. Без скобки — потому что таблица правил зовёт проверки
    указателями, и счёт «только со скобкой» показал бы пустой граф."""
    out = []
    tek = None; zovyot = set()
    v_makro = False; zhdyot = False
    tip_stroka = None

    def ulozhit():
        nonlocal tek
        if tek is not None:
            out.append((tek, set(zovyot)))
        tek = None

    def imena_stroki(s, svoya):
        t = bez_literalov(s)
        if "//" in t and len(bez_probelov(t.split("//")[0])) == 0:
            return set()
        t = t.split("//")[0] if "//" in t else t
        return {n for n in IDENT.findall(t) if n in imena_mn and n != svoya}

    for tekst in teksty:
        for s in tekst.split("\n"):
            p = pustaya(s); k = False if p else stroka_kommentariya(s)
            struct = c_bez_hvosta_kommentariya(s)
            szh = bez_probelov(struct)
            if v_makro:
                if zhdyot:
                    if tek is not None and not (p or k):
                        zovyot |= imena_stroki(s, tek)
                    zhdyot = struct.rstrip().endswith("\\")
                    continue
                else:
                    ulozhit(); zovyot = set(); v_makro = False
            if c_col1(s) and szh.startswith("#define"):
                m = re.match(r"\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)\(", struct)
                if m:
                    ulozhit(); tek = m.group(1)
                    zovyot = imena_stroki(s, tek)
                    v_makro = True; zhdyot = struct.rstrip().endswith("\\")
                    tip_stroka = None
                    continue
            if c_col1(s) and szh.startswith("#"):
                if tek is not None and not (p or k):
                    zovyot |= imena_stroki(s, tek)
                continue
            if p or k:
                continue
            if c_col1(s) and s.lstrip().startswith("}"):
                if tek is not None:
                    zovyot |= imena_stroki(s, tek)
                    ulozhit(); zovyot = set()
                tip_stroka = None
                continue
            if c_col1(s):
                if ("(" not in struct) and (";" not in struct) and ("{" not in struct) \
                   and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_ \t\*]*", struct.strip() or "\0"):
                    tip_stroka = s
                    continue
                imya, i0, i1 = c_imya_opredeleniya(struct)
                if imya:
                    otkr = struct.count("(") - struct.count(")")
                    if struct.rstrip().endswith(";") and otkr <= 0:
                        tip_stroka = None
                        continue
                    ulozhit(); tek = imya
                    zovyot = imena_stroki(s, tek)
                    if tip_stroka:
                        zovyot |= imena_stroki(tip_stroka, tek)
                    tip_stroka = None
                    continue
                tip_stroka = None
                continue
            tip_stroka = None
            if tek is None:
                continue
            zovyot |= imena_stroki(s, tek)
        ulozhit(); zovyot = set(); v_makro = False
    return out

# ═══════════════════════════════════════════════════════════════════════════
#  СЧЁТ (общая часть): замыкание и двенадцать чисел
# ═══════════════════════════════════════════════════════════════════════════

def zamykanie_stroka(zovy, nabor):
    """«Замыкание» по набору-строке — как у сторожа."""
    for _ in range(1000):
        dalshe = nabor
        for metka, zovyot in zovy:
            if metka in dalshe:
                for kusok in zovyot.split("»"):
                    if len(kusok) == 0:
                        continue
                    dalshe = dobavit_v_nabor(dalshe, kusok + "»")
        if len(dalshe) == len(nabor):
            return nabor
        nabor = dalshe
    return nabor

def zamykanie_mn(zovy, nabor):
    """Замыкание по множеству — для C, где имена не обёрнуты ёлочками и
    подстрочное вхождение было бы прямой ошибкой (`node` в `node_kind`)."""
    nabor = set(nabor)
    karta = {}
    for metka, zovyot in zovy:
        karta.setdefault(metka, set()).update(zovyot)
    for _ in range(1000):
        add = set()
        for m in nabor:
            add |= karta.get(m, set())
        if add <= nabor:
            return nabor
        nabor |= add
    return nabor

def poschitat(puti, narechie, zovushchiy=None, slova_formy=None, koren=None,
              blochnye=True):
    """blochnye=False — СТАРАЯ мерка сторожа (до 30 августа): блочный
    комментарий считался кодом. Нужна ровно для одного: показать, что
    расхождение 4628 против 4548 — это смена ЛИНЕЙКИ, а не смена дерева."""
    teksty_syrye = [open(p, encoding="utf-8").read() for p in puti]
    chistye = [bez_blochnyh(t) if blochnye else t for t in teksty_syrye]
    diag = {}
    if narechie == "flang":
        sf = SLOVA_FORMY_FLANG if slova_formy is None else slova_formy
        rabotniki, h, _ = f_razobrat(chistye, sf)
        imena = ""
        for r in rabotniki:
            imena = dobavit_v_nabor(imena, r["метка"])
        zovy = f_zovy(chistye, imena)
        if zovushchiy:
            zov_tekst = open(zovushchiy, encoding="utf-8").read()
            zov_chist = bez_blochnyh(zov_tekst) if blochnye else zov_tekst
            poverhnost = f_ostavit_izvestnye(
                "", f_imena_v_tekste(bez_literalov(bez_kommentariev(zov_chist))),
                imena, "")
        else:
            poverhnost = ""
        resheniya = ""
        for r in rabotniki:
            if r["возврат"] == "признак":
                resheniya = dobavit_v_nabor(resheniya, r["метка"])
        dostizhimo = zamykanie_stroka(zovy, poverhnost)
        yadro = zamykanie_stroka(zovy, resheniya)
        v = lambda nabor, m: m in nabor
    else:
        sf = [] if slova_formy is None else slova_formy
        rabotniki, h, diag = c_razobrat(chistye, sf)
        imena_mn = {r["метка"] for r in rabotniki}
        zovy = c_zovy(chistye, imena_mn)
        if zovushchiy and os.path.exists(zovushchiy):
            zt = bez_blochnyh(open(zovushchiy, encoding="utf-8").read())
            zt = bez_kommentariev(zt)
            poverhnost = {n for n in IDENT.findall(bez_literalov(zt)) if n in imena_mn}
        elif "main" in imena_mn:
            # Д11: поверхность чекера — его собственный вход
            poverhnost = {"main"}
        else:
            poverhnost = set()
        s_fajla = c_fajlovyy_uroven(chistye, imena_mn)      # Д16
        diag["сФайловогоУровня"] = sorted(s_fajla - poverhnost)
        poverhnost = poverhnost | s_fajla
        vn_, pol_ = c_vneshnie(chistye, imena_mn)             # Д17
        diag["внешниеЗовы"] = vn_
        diag["зовыЧерезПоле"] = pol_
        resheniya = {r["метка"] for r in rabotniki if r["возврат"] == "признак"}
        dostizhimo = zamykanie_mn(zovy, poverhnost)
        yadro = zamykanie_mn(zovy, resheniya)
        v = lambda nabor, m: m in nabor

    S = lambda pole, nabor: sum(r[pole] for r in rabotniki if v(nabor, r["метка"]))
    N = lambda nabor: sum(1 for r in rabotniki if v(nabor, r["метка"]))
    tolko_slova_s = sum(r["код"] for r in rabotniki
                        if (not v(yadro, r["метка"])) and r["возврат"] in ("строка", "список строки"))
    tolko_slova_f = sum(1 for r in rabotniki
                        if (not v(yadro, r["метка"])) and r["возврат"] in ("строка", "список строки"))
    schyot = {
        "всегоСтрок": h["всего"],
        "комментарий": h["комментарий"],
        "пусто": h["пусто"],
        "обещанияСтрок": h["обещания"],
        "код": h["всего"] - h["комментарий"] - h["пусто"] - h["обещания"],
        "функций": len(rabotniki),
        "поверхность": N(poverhnost),
        "достижимоСтрок": S("код", dostizhimo),
        "ядроРешенийФункций": N(yadro),
        "ядроРешенийСтрок": S("код", yadro),
        "объявленоСтрок": S("объявлено", yadro),
        "толькоСловаСтрок": tolko_slova_s,
        "толькоСловаФункций": tolko_slova_f,
        "разборФормыСтрок": S("разбор", yadro),
        "сПодписьюУзла": S("подпись", yadro),
    }
    schyot["рассуждениеСтрок"] = schyot["ядроРешенийСтрок"] - schyot["объявленоСтрок"]
    return schyot, rabotniki, yadro, dostizhimo, diag

DVENADTSAT = ["всегоСтрок", "обещанияСтрок", "код", "функций", "поверхность",
              "достижимоСтрок", "ядроРешенийФункций", "ядроРешенийСтрок",
              "объявленоСтрок", "толькоСловаСтрок", "разборФормыСтрок", "сПодписьюУзла"]

NE_PERENOSITSYA = {"разборФормыСтрок", "сПодписьюУзла"}

def dolya(chislitel, delitel):
    if delitel == 0:
        return 0
    tochno = (100 * chislitel) / delitel + 0.5
    return int(tochno)

def otchyot(s, puti, narechie, diag):
    L = []
    L.append("файлы (%d): %s" % (len(puti), ", ".join(puti)))
    L.append("наречие мерки: %s" % narechie)
    L.append("  всего строк:                       %d" % s["всегоСтрок"])
    L.append("  из них комментарий:                %d" % s["комментарий"])
    L.append("  из них пустых:                     %d" % s["пусто"])
    L.append("  из них обещаний и примеров:        %d" % s["обещанияСтрок"])
    L.append("  КОД:                               %d   (функций %d)" % (s["код"], s["функций"]))
    L.append("  достижимо от поверхности:          %d   (поверхность — %d имён)" % (s["достижимоСтрок"], s["поверхность"]))
    L.append("  ЯДРО РЕШЕНИЙ — верить надо ему:    %d   (функций %d)" % (s["ядроРешенийСтрок"], s["ядроРешенийФункций"]))
    L.append("    из них ОБЪЯВЛЕНО (подпись):      %d   (%d%%)" % (s["объявленоСтрок"], dolya(s["объявленоСтрок"], s["ядроРешенийСтрок"])))
    L.append("    из них РАССУЖДЕНИЕ (тело):       %d   (%d%%)" % (s["рассуждениеСтрок"], dolya(s["рассуждениеСтрок"], s["ядроРешенийСтрок"])))
    L.append("  только слова (текст отказов):      %d   (функций %d)" % (s["толькоСловаСтрок"], s["толькоСловаФункций"]))
    if narechie == "flang":
        L.append("  из ядра решений — разбор формы:    %d   (%d%% ядра решений)" % (s["разборФормыСтрок"], dolya(s["разборФормыСтрок"], s["ядроРешенийСтрок"])))
        L.append("  функций с «Значением» в подписи:   %d из %d" % (s["сПодписьюУзла"], s["ядроРешенийФункций"]))
    else:
        L.append("  разбор формы / с «Значением»:      НЕ ПЕРЕНОСИТСЯ (Д12) — печатается 0, замером не считать")
        L.append("  ── C-наречие, отдельно: ──")
        L.append("     строк на закрывающую фигурную:  %d   (у flang такой строки нет вовсе — Д6)" % diag.get("фигурныхСтрок", 0))
        L.append("     макросов-функций:               %d   (считаны функциями — Д8)" % diag.get("макросовФункций", 0))
        L.append("     прототипов приписано:           %d   (Д15)" % diag.get("прототипов", 0))
        L.append("     склеенных заголовков:           %d   (Д5)" % diag.get("склеенныхЗаголовков", 0))
        sf = diag.get("сФайловогоУровня", [])
        L.append("     имён с файлового уровня:        %d   (таблица правил и прочее — Д16)%s"
                 % (len(sf), (": " + ", ".join(sf[:8])) if sf else ""))
        vn = diag.get("внешниеЗовы", {})
        L.append("  ── ВТОРОЙ КРАЙ ПОЛОСЫ: чем чекер пользуется, но чего не объявляет ──")
        L.append("     внешних имён (libc и прочее): %d   (в строки НЕ пересчитаны — Д17)" % len(vn))
        for n in sorted(vn, key=lambda x: (-vn[x], x)):
            L.append("        %-16s %d" % (n, vn[n]))
        pol = diag.get("зовыЧерезПоле", {})
        if pol:
            L.append("     зовов через поле записи (не внешние): %s"
                     % ", ".join("%s×%d" % (k, pol[k]) for k in sorted(pol)))
        if diag.get("ловушкаЛитерала"):
            L.append("     ⚠ ЛОВУШКА Д3: `/*` или `*/` внутри литерала — счёт комментариев неверен:")
            for x in diag["ловушкаЛитерала"][:5]:
                L.append("        %s" % x)
    L.append("")
    L.append("  ГРАНИЦА СЧЁТА: считаны ТОЛЬКО перечисленные файлы. То, на что они")
    L.append("  опираются (у flang — вычислитель и разбор, у C — libc и сам")
    L.append("  компилятор), в число НЕ входит: как ответ на «чему мы верим на")
    L.append("  слово» оно ЗАНИЖЕНО. Полным ответом это число не считать.")
    return "\n".join(L)

# ═══════════════════════════════════════════════════════════════════════════

def sverka(koren, blochnye=True):
    puti = [os.path.join(koren, p) for p in
            ["flang/self/proofterm.flang", "flang/self/proof-kernel.flang",
             "flang/self/proof-initial.flang"]]
    zov = os.path.join(koren, "flang/self/bootstrap/compiler.flang")
    potolok = os.path.join(koren, "flang/scripts/kernel-lines-to-trust-ceiling.json")
    s, rab, yadro, dost, diag = poschitat(puti, "flang", zovushchiy=zov, blochnye=blochnye)
    print("мерка: %s" % ("нынешняя (блочный комментарий — не код)" if blochnye
                        else "СТАРАЯ, до 30 августа (блочный комментарий считался кодом)"))
    print(otchyot(s, puti, "flang", diag))
    print()
    if not os.path.exists(potolok):
        print("отметки нет: %s" % potolok)
        return 2
    p = json.load(open(potolok, encoding="utf-8"))
    print("СВЕРКА С ОТМЕТКОЙ %s" % potolok)
    bed = 0
    for k in DVENADTSAT:
        est = s[k]
        if k not in p:
            print("  %-22s мерка %-7d отметка —  (ключа в отметке нет)" % (k, est))
            continue
        bylo = p[k]
        znak = "сошлось" if est == bylo else "РАСХОЖДЕНИЕ"
        if est != bylo:
            bed += 1
        print("  %-22s мерка %-7d отметка %-7d %s" % (k, est, bylo, znak))
    print()
    print("расхождений: %d" % bed)
    return 0 if bed == 0 else 1

def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--narechie", choices=["flang", "c"], default=None)
    ap.add_argument("--zovushchiy", default=None)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--poimenno", action="store_true")
    ap.add_argument("--sverka", default=None, nargs="?", const="__default__")
    ap.add_argument("--staraya-merka", action="store_true",
                    help="блочный комментарий считать кодом (мерка до 30 августа)")
    ap.add_argument("puti", nargs="*")
    a = ap.parse_args()
    if a.sverka:
        koren = a.sverka if a.sverka != "__default__" else \
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "flang")
        return sverka(koren, blochnye=not a.staraya_merka)
    if not a.puti:
        ap.print_help()
        return 2
    narechie = a.narechie
    if narechie is None:
        narechie = "flang" if a.puti[0].endswith(".flang") else "c"
    s, rab, yadro, dost, diag = poschitat(a.puti, narechie, zovushchiy=a.zovushchiy,
                                          blochnye=not a.staraya_merka)
    if a.json:
        out = {k: s[k] for k in DVENADTSAT}
        out["комментарий"] = s["комментарий"]
        out["пусто"] = s["пусто"]
        out["толькоСловаФункций"] = s["толькоСловаФункций"]
        out["рассуждениеСтрок"] = s["рассуждениеСтрок"]
        out["наречие"] = narechie
        if narechie == "c":
            out["непереносится"] = sorted(NE_PERENOSITSYA)
            out["C-наречие"] = {k: v for k, v in diag.items()
                                if k not in ("ловушкаЛитерала", "внешниеЗовы",
                                             "сФайловогоУровня", "зовыЧерезПоле")}
            out["внешниеЗовы"] = diag.get("внешниеЗовы", {})
            out["сФайловогоУровня"] = diag.get("сФайловогоУровня", [])
            out["зовыЧерезПоле"] = diag.get("зовыЧерезПоле", {})
            out["ловушкаЛитерала"] = diag.get("ловушкаЛитерала", [])
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        print(otchyot(s, a.puti, narechie, diag))
    if a.poimenno:
        print("\nядро решений поимённо:")
        for r in rab:
            if (r["метка"] in yadro) if isinstance(yadro, set) else (r["метка"] in yadro):
                print("  %4d  %s" % (r["код"], r["метка"]))
    return 0

if __name__ == "__main__":
    sys.exit(main())
