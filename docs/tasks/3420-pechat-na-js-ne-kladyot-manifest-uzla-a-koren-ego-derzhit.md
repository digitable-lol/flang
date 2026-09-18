---
номер: 3420
заголовок: Цель JS не кладёт манифест узла рядом с выводом, и корневой package.json держит за неё
статус: в работе (манифест печатается с этой ветки; выброс корневого файла ОТКЛОНЁН — держится, см. ниже)
исполнитель: Marat
ветка: r/bez-package-json
команда: первая
карта: Куда идём
рядом: 8649, 1745
нужность: 2 — напечатанное на JS не запускается у человека без файла, который он не печатал
---

# 3420. Цель JS не кладёт манифест узла рядом с выводом

> ℹ Правка в `flang/self/**` доедет до собранного двоичного только следующей
> перепечаткой семени: до неё прогон по семени её не увидит.

Владелец 13 сентября 2026: «name тоже перенеси в flangrc… а вот сам
package.json надо выбросить».

## Что сделано

**Цель JS печатает `package.json` рядом с выводом** — тем же приёмом, каким
цель C печатает `Makefile`, а TS `tsconfig.json`: сопутствующим файлом из
литерала (`«Манифест узла JS»` в `flang/self/emit-js.flang`). Содержимое —
`{"type": "module"}`. Печатается всегда, а не только с прогонщиком: `import` и
`export` стоят и в самом модуле.

**Почему это нужно — замер, а не осторожность.** Прогон 13 сентября 2026,
двоичный 0.7.19, вывод `--target js` вне дерева:

```
$ node flang_cli.js ./factorial.js            # рядом {"type":"commonjs"}
SyntaxError: Cannot use import statement outside a module
$ node --no-experimental-detect-module flang_cli.js ./factorial.js
SyntaxError: Cannot use import statement outside a module
```

`import`/`export` в напечатанном: `factorial.js` — 9 строк, `flang_cli.js` — 5.
На Node 26 без манифеста прогон проходит, и это обманчиво: спасает
распознавание по виду исходника, которого на Node 20 нет вовсе, а `engines`
дерева обещают `>=20`, и CI гоняет набор на 20, 22 и 24.

**Это знание уже было в дереве — четырьмя копиями.** Манифест дописывала
оснастка, каждая своими руками: `flang/scripts/node-across-targets.fscript`
(строка «рядом» у цели js), `flang/concurrency/bench/hot-swap.sh`,
`flang/concurrency/bench/node-death.sh`, `flang/test/uzel-osnastka.mjs`. Ни одна из
четырёх не достаётся человеку, который просто напечатал программу и позвал
`node`.

**В `.flangrc` заведены ключи `версия` и `имя`** — не как новый источник, а как
производные места: число и имя разносит туда `./ярлык версия <N>`, а сверяет
`scripts/guards/version-derivations-guard.sh`. Второго источника версии не
заведено нарочно: именно от двух источников разъезжались числа в задачах 9983 и
4970.

## Чего НЕ сделано: корневой `package.json` не выброшен

Он держится тремя вещами, и каждая измерена.

**1. `"type": "module"` нужен файлам, которые никакой печатник не печатает.**
В дереве лежат ESM-`.js`, не являющиеся выводом компилятора:

| файл | строк `import`/`export` | кто зовёт |
| --- | --- | --- |
| `flang/concurrency/scheduler.js` | 113 | `flang/test/planirovshchik-celi.test.mjs` |
| `flang/concurrency/link.js` | 43 | `flang/test/svyaz-celi.test.mjs` |
| `flang/concurrency/wire.js` | 54 | там же, через связь |
| `flang/concurrency/bin/node.js` | 3 | хозяин узла цели js, восьмой из восьми |
| `docs/examples/frameworks/react-invoice/printed/*.js` | 17+5 | README примера |
| `docs/examples/frameworks/vue-roman/printed/*.js` | 12+5 | README примера |

Набор проверок — это `node --test flang/test/*.test.mjs`, и два теста из него
ввозят `../concurrency/scheduler.js` и `../concurrency/link.js`. Без корневого манифеста на
Node 20 они не ввозятся вовсе. Лечится это не печатью манифеста, а манифестами
по каталогам или переименованием в `.mjs` — и то и другое трогает
`flang/concurrency/**` и `flang/test/**`.

**2. Читается не два поля, а пять.** Кроме `version` (17 мест) и `name` (8)
читаются `license`, `repository.url` и `bugs.url`:
`scripts/guards/license-guard.fscript` судит по `license` шапку SPDX каждого
публикуемого файла, а `docs/site/build.mjs` и `docs/site/build.flang`
ОТКАЗЫВАЮТ, если не нашли адресов и лицензии, — подвал сайта собирается из них.
`node docs/site/build.mjs --check` сегодня зелен ровно потому, что файл есть.

**3. Правка печатника доезжает только перепечаткой семени.**
`bootstrap/flang` собирается из напечатанного семени `bootstrap/compiler_flang.c`
(35 МБ); `make -C bootstrap` компилирует семя, а не выводит его заново из
`flang/self/**`. Печать семени — часы (шапка `scripts/raskrutka.sh` называет
восемь и вилку до 16,8). До неё цель JS манифеста не печатает, и снимать
корневой файл нечем.

## Порядок, если владелец решит выбрасывать

1. Перепечатать семя — без этого шага цель JS манифеста не кладёт.
2. Перевести `flang/concurrency/*.js` и оба теста-свидетеля на `.mjs` либо положить
   `flang/concurrency/package.json`; то же для двух примеров во `frameworks`.
3. Решить, откуда сборка сайта возьмёт лицензию и два адреса, а
   `license-guard.fscript` — опознаватель лицензии.
4. Перевести читателей `version` на `.flangrc` (ключ уже есть) и снять
   `scripts/release/emit-package.flang` вместе с ярлыками `пакет`,
   `пакет:проверка` и двумя подлогами в `ci.yml` и `install-path.yml`.
5. И только потом удалить файл.
