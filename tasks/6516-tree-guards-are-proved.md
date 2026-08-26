---
номер: 6516
заголовок: Сторожа дерева доказаны — сорок шесть файлов, которых не считал никто
статус: в работе
исполнитель: u
ветка: u/guards-proved
команда: любая
карта: Сколько доказано на самом деле
рядом: 0016, 0044, 0053, 0054
---

# 6516. Сторожа дерева доказаны — сорок шесть файлов, которых не считал никто

`scripts/**` — **46 программ на flang**. Статический пересчёт 26 августа 2026:
**603 обещания и 1111 примеров** в `scripts/`, ещё **36 обещаний и 61 пример** в
`packaging/` (два файла). Итого 48 файлов, 639 обещаний, 1172 примера.

Это не библиотека и не примеры. Это **сторожа дерева**: `release-guard.flang`
(обещанный деревом выпуск существует на GitHub и ставится),
`homebrew-formula-guard.flang` (одна версия на три места и sha256),
`manpage-guard.flang`, `dictionary-guard.flang`, `emit-promises-guard.flang`,
`link-guard.flang`, `error-code-guard.flang` и остальные. Все они зовутся
ярлыками из `ярлыки.flang` и гоняются лентой — то есть от них зависит,
покраснеет дерево или нет.

Отсюда особая цена ошибки. Обычное ослабленное обещание — потерянное знание;
**ослабленное обещание сторожа — дыра в проверке всего дерева**. А ложное
обещание сторожа хуже отсутствующего вдвойне: недоказанное `обеспечивает` едет в
напечатанный код проверкой при работе, и упавший сторож красит ленту не там, где
беда.

## Чего в дереве нет

Отчёта о доказательствах по `scripts/**` **не снимал никто**. Ведомость
`доказательства:ведомость` считает всё дерево одним числом, а поимённого
разбора по этим 48 файлам — сколько утверждений, сколько доказано, сколько
сетка, сколько объявлено — в дереве нет ни в одном виде.

Первое, что здесь надо сделать, — снять эту ведомость. Она ценна сама по себе,
даже если ни одного обещания после неё не прибавится: без неё нельзя сказать,
верят сторожа дерева своим обещаниям или только объявляют их.

## Ведомость: снята 26 августа 2026, прогоном

Прогон: `PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
/srv/flang-rabota/w-predely/bootstrap/flang check <файл> --proof`, без ключа
`--предел-шагов`. Все прогоны шли по одному за раз, внутри одной заявки у ворот.

**Числа в таблице — по ЗАМЫКАНИЮ, а не по файлу.** `check` судит файл вместе со
всем, что тот ввозит, поэтому обещания `flang/stdlib` попадают в отчёт каждого
сторожа, который их зовёт, и складывать столбец по строкам НЕЛЬЗЯ: одни и те же
утверждения посчитаны по многу раз. Своя, непересекающаяся доля каждого файла —
во второй таблице.

**Столбец «запас шагов» читается так.** Вшитое умолчание — 1 000 000 000 витков
(`bootstrap/flang_runtime.h:11`), а строка «ЗАПАС ШАГОВ НА ИСХОДЕ» печатается
строго при `витков > предел / 2` (`bootstrap/flang_repl.c:1288`). Значит её
отсутствие — это ИЗМЕРЕННОЕ «ниже 50 %», а не молчание. Снимать базу с поднятым
пределом бессмысленно: порог предупреждения поднимается вместе с ним.

| файл | утв. | доказано | сетка | объявлено | запас шагов | код |
|---|---:|---:|---:|---:|---|---:|
| `scripts/variant-probe.flang` | — | — | — | — | не мерено | — |
| `scripts/vscode-highlighting.flang` | 31 | 25 | 6 | 0 | ниже 50 % | 0 |
| `scripts/vim-highlighting.flang` | 35 | 29 | 6 | 0 | ниже 50 % | 0 |
| `scripts/vim-rules.flang` | 26 | 20 | 6 | 0 | ниже 50 % | 0 |
| `scripts/string-measure.flang` | 8 | 5 | 3 | 0 | ниже 50 % | 0 |
| `scripts/vscode-highlight-check.flang` | 14 | 8 | 6 | 0 | ниже 50 % | 0 |
| `scripts/vscode-rules.flang` | 22 | 16 | 6 | 0 | ниже 50 % | 0 |
| `scripts/releases-page.flang` | — | — | — | — | не проверено (FLANG_RECURSION_LIMIT) | 1 |
| `scripts/language-words.flang` | 10 | 4 | 6 | 0 | ниже 50 % | 0 |
| `scripts/releases-page-verify.flang` | — | — | — | — | не проверено (FLANG_RECURSION_LIMIT) | 1 |
| `scripts/сторож-дарвина.flang` | 10 | 8 | 2 | 0 | ниже 50 % | 0 |
| `scripts/child-timeout.flang` | 4 | 3 | 1 | 0 | ниже 50 % | 0 |
| `scripts/tab-host-guard.flang` | — | — | — | — | не проверено (FLANG_EXAMPLE) | 1 |
| `scripts/lsp-check.flang` | 18 | 18 | 0 | 0 | ниже 50 % | 0 |
| `scripts/vim-highlight-check.flang` | 37 | 30 | 6 | 1 | ниже 50 % | 0 |
| `scripts/bootstrap-point-by-binary.flang` | 4 | 4 | 0 | 0 | ниже 50 % | 0 |
| `scripts/dictionary-guard.flang` | 15 | 9 | 6 | 0 | ниже 50 % | 0 |
| `scripts/surfaces-page.flang` | 12 | 12 | 0 | 0 | ниже 50 % | 0 |
| `scripts/releases.flang` | — | — | — | — | не проверено (FLANG_RECURSION_LIMIT) | 1 |
| `scripts/path-without-node.flang` | 11 | 11 | 0 | 0 | ниже 50 % | 0 |
| `scripts/occupancy-check.flang` | 5 | 5 | 0 | 0 | ниже 50 % | 0 |
| `scripts/asdf-plugin-published.flang` | 13 | 12 | 1 | 0 | ниже 50 % | 0 |
| `scripts/asdf-version-list.flang` | 10 | 10 | 0 | 0 | ниже 50 % | 0 |
| `scripts/bidi-control-guard.flang` | 15 | 15 | 0 | 0 | ниже 50 % | 0 |
| `scripts/license-guard.flang` | — | — | — | — | не проверено (FLANG_UNKNOWN_NAME) | 1 |
| `scripts/conc-link-emit.flang` | 25 | 16 | 9 | 0 | ниже 50 % | 0 |
| `scripts/registry-tool.flang` | 40 | 40 | 0 | 0 | ниже 50 % | 0 |
| `scripts/release-guard.flang` | 8 | 8 | 0 | 0 | ниже 50 % | 0 |
| `scripts/check-before-run.flang` | 14 | 14 | 0 | 0 | ниже 50 % | 0 |
| `packaging/install-parity.flang` | 6 | 6 | 0 | 0 | ниже 50 % | 0 |
| `scripts/link-guard.flang` | 31 | 13 | 16 | 2 | ниже 50 % | 0 |
| `scripts/manpage-guard.flang` | 11 | 11 | 0 | 0 | ниже 50 % | 0 |
| `scripts/input-boundary.flang` | — | — | — | — | не проверено (FLANG_EXAMPLE) | 1 |
| `scripts/commands-via-symlink.flang` | 33 | 22 | 10 | 1 | ниже 50 % | 0 |
| `scripts/emit-dictionary.flang` | 13 | 7 | 6 | 0 | ниже 50 % | 0 |
| `packaging/install-check.flang` | — | — | — | — | не проверено (FLANG_UNKNOWN_NAME) | 1 |
| `scripts/emit-promises-guard.flang` | — | — | — | — | не проверено (FLANG_EXAMPLE) | 1 |
| `scripts/name-splicing-guard.flang` | — | — | — | — | не проверено (FLANG_EXAMPLE) | 1 |
| `scripts/corpus-runner.flang` | 67 | 67 | 0 | 0 | ниже 50 % | 0 |
| `scripts/region-in-c-target.flang` | 14 | 14 | 0 | 0 | ниже 50 % | 0 |
| `scripts/plan-across-targets.flang` | — | — | — | — | не проверено (FLANG_EXAMPLE) | 1 |
| `scripts/occupied-names-guard.flang` | 22 | 22 | 0 | 0 | ниже 50 % | 0 |
| `scripts/emit-law.flang` | 48 | 42 | 3 | 3 | ниже 50 % | 0 |
| `scripts/homebrew-formula-guard.flang` | 45 | 28 | 9 | 8 | ниже 50 % | 0 |
| `scripts/emit-and-examples.flang` | 16 | 16 | 0 | 0 | ниже 50 % | 0 |
| `scripts/error-code-guard.flang` | 68 | 68 | 0 | 0 | ниже 50 % | 0 |
| `scripts/release-in-c.flang` | 33 | 31 | 2 | 0 | ниже 50 % | 0 |
| `scripts/name-collision-guard.flang` | 36 | 29 | 6 | 1 | ниже 50 % | 0 |
| **итого по отвечавшим** | **830** | **698** | **116** | **16** | | |

## Своя доля каждого файла

Здесь посчитаны только те утверждения, что стоят на функциях САМОГО файла:
отчёт называет каждое постусловие вместе с функцией, и по имени функции его
можно вернуть в свой файл. Эти числа складывать можно.

| файл | своих утв. | доказано | сетка | объявлено |
|---|---:|---:|---:|---:|
| `scripts/variant-probe.flang` | не мерено | | | |
| `scripts/vscode-highlighting.flang` | 9 | 9 | 0 | 0 |
| `scripts/vim-highlighting.flang` | 9 | 9 | 0 | 0 |
| `scripts/vim-rules.flang` | 16 | 16 | 0 | 0 |
| `scripts/string-measure.flang` | 8 | 5 | 3 | 0 |
| `scripts/vscode-highlight-check.flang` | 3 | 3 | 0 | 0 |
| `scripts/vscode-rules.flang` | 12 | 12 | 0 | 0 |
| `scripts/releases-page.flang` | 0 | 0 | 0 | 0 |
| `scripts/language-words.flang` | 1 | 1 | 0 | 0 |
| `scripts/releases-page-verify.flang` | 0 | 0 | 0 | 0 |
| `scripts/сторож-дарвина.flang` | 10 | 8 | 2 | 0 |
| `scripts/child-timeout.flang` | 4 | 3 | 1 | 0 |
| `scripts/tab-host-guard.flang` | 0 | 0 | 0 | 0 |
| `scripts/lsp-check.flang` | 18 | 18 | 0 | 0 |
| `scripts/vim-highlight-check.flang` | 11 | 10 | 0 | 1 |
| `scripts/bootstrap-point-by-binary.flang` | 4 | 4 | 0 | 0 |
| `scripts/dictionary-guard.flang` | 6 | 6 | 0 | 0 |
| `scripts/surfaces-page.flang` | 12 | 12 | 0 | 0 |
| `scripts/releases.flang` | 0 | 0 | 0 | 0 |
| `scripts/path-without-node.flang` | 11 | 11 | 0 | 0 |
| `scripts/occupancy-check.flang` | 5 | 5 | 0 | 0 |
| `scripts/asdf-plugin-published.flang` | 13 | 12 | 1 | 0 |
| `scripts/asdf-version-list.flang` | 10 | 10 | 0 | 0 |
| `scripts/bidi-control-guard.flang` | 15 | 15 | 0 | 0 |
| `scripts/license-guard.flang` | 0 | 0 | 0 | 0 |
| `scripts/conc-link-emit.flang` | 25 | 16 | 9 | 0 |
| `scripts/registry-tool.flang` | 20 | 20 | 0 | 0 |
| `scripts/release-guard.flang` | 8 | 8 | 0 | 0 |
| `scripts/check-before-run.flang` | 14 | 14 | 0 | 0 |
| `packaging/install-parity.flang` | 6 | 6 | 0 | 0 |
| `scripts/link-guard.flang` | 31 | 13 | 16 | 2 |
| `scripts/manpage-guard.flang` | 11 | 11 | 0 | 0 |
| `scripts/input-boundary.flang` | 0 | 0 | 0 | 0 |
| `scripts/commands-via-symlink.flang` | 33 | 22 | 10 | 1 |
| `scripts/emit-dictionary.flang` | 1 | 1 | 0 | 0 |
| `packaging/install-check.flang` | 0 | 0 | 0 | 0 |
| `scripts/emit-promises-guard.flang` | 0 | 0 | 0 | 0 |
| `scripts/name-splicing-guard.flang` | 0 | 0 | 0 | 0 |
| `scripts/corpus-runner.flang` | 67 | 67 | 0 | 0 |
| `scripts/region-in-c-target.flang` | 14 | 14 | 0 | 0 |
| `scripts/plan-across-targets.flang` | 0 | 0 | 0 | 0 |
| `scripts/occupied-names-guard.flang` | 22 | 22 | 0 | 0 |
| `scripts/emit-law.flang` | 48 | 42 | 3 | 3 |
| `scripts/homebrew-formula-guard.flang` | 45 | 28 | 9 | 8 |
| `scripts/emit-and-examples.flang` | 16 | 16 | 0 | 0 |
| `scripts/error-code-guard.flang` | 68 | 68 | 0 | 0 |
| `scripts/release-in-c.flang` | 24 | 22 | 2 | 0 |
| `scripts/name-collision-guard.flang` | 27 | 26 | 0 | 1 |
| **итого своей доли** | **657** | **585** | **56** | **16** |

## Восемь файлов из сорока восьми не проверяются вовсе

И это не следствие правок — семь из восьми стояли так до начала работы.

**Два — из-за отставания общего двоичного, а не из-за файла.**
`scripts/license-guard.flang:98` и `packaging/install-check.flang:102,136`
объявляют тип `неотрицательное`, а напечатанное семя такого слова не знает:
`FLANG_UNKNOWN_NAME: неизвестный тип «неотрицательное»`. Это ровно та беда,
о которой говорит AGENTS.md в правиле «ввести слово и применить его — РАЗНЫЕ
изменения»: слово введено в исходники компилятора, а доедет до двоичного только
перепечаткой. Файлы верны; судить их сегодня нечем.

**Пять — из-за ЛОЖНЫХ обещаний в самих сторожах.** Разобрано ниже.

**Один — `scripts/tab-host-guard.flang`** — из-за примеров, отставших от
словаря поручений: примеры писались при шестнадцати поручениях, а в
`flang/cat/SPEC.md` их теперь двадцать.

## Ложные обещания у сторожей: найдено шесть, все о длине постоянной

Самая дорогая находка этой работы, и она не про число доказанных.

Шесть сторожей обещали `(длина результат) равен N` о своей же постоянной
строке, и N НЕ СОВПАДАЛ с длиной этой строки. Недоказанное `обеспечивает`
уезжает в напечатанный код проверкой при работе — то есть сторож, поставленный
беречь дерево, падал бы сам на первом же вызове этой функции.

| файл | функция | обещано | на деле | как обнаружено |
|---|---|---:|---:|---|
| `scripts/input-boundary.flang` | «Хвост» | 24 | **36** | `FLANG_PROPERTY` на прогоне примеров |
| `scripts/input-boundary.flang` | «Образец» | 39 | **33** | `FLANG_PROPERTY` на прогоне примеров |
| `scripts/emit-promises-guard.flang` | «Программа улика» | 59 | **53** | `FLANG_PROPERTY` на прогоне примеров |
| `scripts/name-splicing-guard.flang` | «Файл долга» | 37 | **32** | `FLANG_PROPERTY` на прогоне примеров |
| `scripts/plan-across-targets.flang` | «Файл» | 39 | **33** | `FLANG_PROPERTY` на прогоне примеров |
| `scripts/vim-highlight-check.flang` | «Куда слова» | 33 | **31** | **молчало**: пересчётом длин по всем 48 файлам |

Последняя строка важнее пяти первых. Пять падают на прогоне примеров, потому
что примеры зовут эти функции. Шестая **не падала и не могла упасть**: у
«Куда слова» примера нет ни одного, значит проверка при работе никогда не
доходила до вызова, а ядро её просто не доказало — в отчёте она и стояла тем
единственным «объявлено, не доказано», которое числилось за
`vim-highlight-check.flang`. Ложное обещание пряталось в отчёте под видом
недоказанного.

Отсюда правило, которого в дереве не было: **«объявлено, не доказано» у цели
вида «длина постоянной равна N» — это не «ядру не хватило правила», а повод
пересчитать N.** Замкнутую цель ядро просто вычисляет (`«Вычислить замкнутую»`),
и не доказать её оно может ровно в одном случае — если она ложна.

## Как понять, что сделано

```sh
PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
  /srv/flang-rabota/w-predely/bootstrap/flang check scripts/<файл>.flang --proof
```

Ведомость по всем 48 файлам снята и лежит в дереве строкой отчёта дословно;
у каждого правленого файла названы «доказано до → после» и «сетка до → после»;
каждая прибавка отнесена к приёму со страницы `docs/site/kak-dokazat.ru.md`;
каждый неудавшийся приём назван вместе с прогоном, который его опроверг.
