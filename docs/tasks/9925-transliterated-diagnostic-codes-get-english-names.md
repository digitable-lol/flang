---
номер: 9925
заголовок: Часть кодов FLANG_* — русские слова латиницей, и пять из них стоят в таблице устойчивых кодов
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: —
рядом: 1428, 8211, 7203
нужность: код диагностики читают программы и люди, не знающие русского; `FLANG_PECHAT_OTKAZ` не понятен ни тем, ни другим
---

# 9925. Часть кодов FLANG_* — русские слова латиницей, и пять из них стоят в таблице устойчивых кодов

Имена файлов, ключи и коды в дереве пишутся по-английски. Коды `FLANG_*` этому
правилу следуют не все: часть составлена из русских слов, записанных латиницей
(`FLANG_PECHAT_OTKAZ`, `FLANG_MANPAGE_RAZOSHLAS`, `FLANG_SLOVAR_NEPOLON`).
Сторожа на это нет: `transliteration:check` смотрит только имена файлов.

Коды делятся на две неравные части, и переход у них разный.

## Шаги воспроизведения

1. Коды таблицы устойчивых кодов, составленные латиницей из русских слов:

```
grep -nE '^FLANG_(PECHAT_BEDY|PECHAT_OTKAZ|VITKI|ZAKAZ|KESH_PRIGOVOROV|FACTCHECK_НЕТ_ОТВЕТА)' flang/proof/tables/diagnostic-codes.tsv
```

2. Где компилятор и рантайм их выдают:

```
git grep -nE 'FLANG_(PECHAT_BEDY|PECHAT_OTKAZ|VITKI|ZAKAZ)' -- flang/self flang/src/emit/c
```

3. Коды скриптов и сторожей с самыми частыми русскими словами:

```
git grep -ohE 'FLANG_[A-Z0-9_]*(NECHEM|PODLOG|VYPUSK|PECHAT|RAZOSHL|REESTR|STOROZH)[A-Z0-9_]*' -- scripts flang/scripts .github | sort -u | wc -l
```

## Что происходит

```
$ grep -nE '^FLANG_(PECHAT_BEDY|…)' flang/proof/tables/diagnostic-codes.tsv
39:FLANG_FACTCHECK_НЕТ_ОТВЕТА	0.5.0	устойчив
134:FLANG_PECHAT_BEDY	0.7.15	устойчив
135:FLANG_PECHAT_OTKAZ	0.7.15	устойчив
201:FLANG_VITKI	0.7.11	устойчив
204:FLANG_ZAKAZ	0.7.15	устойчив
205:FLANG_KESH_PRIGOVOROV	0.7.25	снят
$ git grep -nE 'FLANG_(PECHAT_BEDY|PECHAT_OTKAZ|VITKI|ZAKAZ)' -- flang/self flang/src/emit/c
flang/self/bootstrap/emit-from-source.flang:112: … "FLANG_PECHAT_OTKAZ" …
flang/self/bootstrap/emit-from-source.flang:115: … "FLANG_PECHAT_BEDY" …
flang/self/bootstrap/emit-from-source.flang:132: … "FLANG_ZAKAZ" …
flang/src/emit/c/flang_repl.c:2439:  if (!repl_call_quiet && getenv("FLANG_VITKI") != NULL) {
```

Версия: flang 0.7.34, прогон 10 ноября 2026.

**В таблице** — шесть строк из 207: четыре устойчивых кода латиницей, один
устойчивый код со словами кириллицей и один снятый. `FLANG_VITKI` — не код
диагностики, а переменная среды, которую читает рантайм.

**Вне таблицы** — коды, которые выдают планы и сторожа в `scripts/`,
`flang/scripts/` и работах CI. Перепись 10 ноября 2026 насчитала в дереве вне
`bootstrap/` 321 такое имя из 1112 разных слов `FLANG_*`; из них в `scripts/`
встречаются 217, в `flang/scripts/` — 70. Обещания устойчивости на них нет:
таблица их не называет, двоичный их не выдаёт.

## Что должно быть

Каждый код `FLANG_*` составлен из английских слов. Старое имя кода из таблицы
живёт синонимом один выпуск и только потом снимается.

Предложение имён для таблицы:

| сегодня | предлагается, после приставки `FLANG_` | что значит | где выдаётся |
|---|---|---|---|
| `FLANG_PECHAT_OTKAZ` | `PRINT_REFUSED` | печать исходника отказана проверкой | `flang/self/bootstrap/emit-from-source.flang` |
| `FLANG_PECHAT_BEDY` | `PRINT_DIAGNOSTICS` | печать остановлена замечаниями | там же |
| `FLANG_ZAKAZ` | `EMPTY_ORDER` | заказ на печать пуст | там же |
| `FLANG_VITKI` | `TICKS` | переменная среды: печатать число витков | `flang/src/emit/c/flang_repl.c` |
| `FLANG_FACTCHECK_НЕТ_ОТВЕТА` | `FACTCHECK_NO_ANSWER` | хозяин не дал ответа вычислителя | `flang/self/factcheck.flang` |
| `FLANG_KESH_PRIGOVOROV` | не переименовывать | снят в 0.7.25 | — |

Порядок перехода для таблицы:

1. Выпуск N: компилятор выдаёт новое имя; в таблице новая строка со статусом
   `устойчив` и версией N, старая строка получает статус `синоним` с именем
   преемника. `FLANG_VITKI` рантайм читает под обоими именами. Заметка о выпуске
   называет пары «старое — новое».
2. Выпуск N+1: старые строки получают статус `снят`; рантайм читает только
   новое имя.
3. Правка идёт под `flang/self/**` и `flang/src/emit/c/**`, значит доезжает до
   двоичного печатью семени — в одной партии с другими правками, отдельной
   печати она не стоит.

Порядок для кодов вне таблицы: обещания нет, поэтому синонимы не нужны. Код
переименовывается одним коммитом на файл сторожа вместе со всеми местами, где
его ждут (работы CI, пробы порчи, ведомости, задачи). Слова берутся из одного
словаря, чтобы два сторожа не назвали одно и то же по-разному:

| русское слово латиницей | английское |
|---|---|
| `NECHEM_SMOTRET`, `NECHEM_MERIT`, `NECHEM` | `NOT_MEASURED` (так уже названы `FLANG_SHARE_SELF_TEST_NOT_MEASURED`, `FLANG_REPLAY_SHARE_NOT_MEASURED`) |
| `PODLOG`, `PODDELKA` | `FORGERY` |
| `PORCHA` | `CORRUPTION` |
| `RAZOSHLIS`, `RAZOSHLAS`, `RAZOSHYOLSYA`, `RASKHOZHDENIE` | `MISMATCH` |
| `VYPUSK`, `VYPUSKI` | `RELEASE` |
| `PECHAT` | `PRINT` |
| `REESTR` | `REGISTRY` |
| `STOROZH` | `GUARD` |
| `SLOVAR` | `DICTIONARY` |
| `OPIS` | `INVENTORY` |
| `ZHURNAL` | `JOURNAL` |
| `DOLG` | `DEBT` |
| `STRANICA` | `PAGE` |
| `ZAMER` | `MEASUREMENT` |
| `USTANOVKA` | `INSTALL` |
| `KORPUS` | `CORPUS` |
| `UZEL` | `NODE` |

## Обходной путь

Читать код вместе с русским сообщением рядом с ним: сообщение говорит то же
словами.

## Когда задача сделана

1. Шаг 1 воспроизведения показывает старые имена только со статусом `синоним`
   или `снят`; `bootstrap/flang run-script diagnostic-codes:check` и
   `record-format:check` зелёные.
2. Шаг 3 воспроизведения отвечает нулём.
3. Сторож транслита смотрит и коды: подложенный в скрипт код
   с русским словом латиницей краснит его, после уборки он зелёный.
4. `bootstrap/flang run-script codes:check` зелёный.

## Где живёт правка

`flang/proof/tables/diagnostic-codes.tsv`, `flang/self/bootstrap/emit-from-source.flang`,
`flang/self/factcheck.flang`, `flang/src/emit/c/flang_repl.c` — таблица и двоичный.
`scripts/**`, `flang/scripts/**`, `.github/workflows/**` — коды сторожей.
`scripts/guards/translit-file-names-guard.fscript` — сторож.
