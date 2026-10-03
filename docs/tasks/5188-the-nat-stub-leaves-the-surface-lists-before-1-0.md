---
номер: 5188
заголовок: Имя типа «нат» всё ещё принимается, а снять его после 1.0 будет ломающим изменением
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Куда идём
рядом: 8309, 8281
нужность: ломающее изменение обязано случиться до выпуска 1.0
---

# 5188. Имя типа «нат» всё ещё принимается, а снять его после 1.0 будет ломающим изменением

Тип переименован в «неотрицательное». Старое имя «нат» оставлено в перечнях
допустимых имён на время перехода и до сих пор не снято.

## Шаги воспроизведения

1. Файл-проба nat.flang:

   ```
   функция «Проба»
     принимает «н»: нат
     возвращает нат
     «н»
   ```

2. `bootstrap/flang check nat.flang`
3. `grep -c '|нат|' flang/self/types.flang flang/self/proof-kernel.flang flang/self/totality.flang`

## Что происходит

```
$ bootstrap/flang check nat.flang
nat.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет     код 0
$ grep -c '|нат|' flang/self/types.flang flang/self/proof-kernel.flang flang/self/totality.flang
flang/self/types.flang:1
flang/self/proof-kernel.flang:1
flang/self/totality.flang:11
```

Версия: flang 0.7.23, 3 октября 2026.

## Что должно быть

`flang check` на файле с типом `нат` отвечает `FLANG_UNKNOWN_NAME` и кодом 1,
как на любом неизвестном имени типа. Изменение ломает чужие файлы, поэтому
делается в 0.8.0 или прямо перед 1.0, но не после (`docs/road-to-1-0.md`).

## Обходной путь

Не нужен: оба имени работают.

## Когда задача сделана

- ни один перечень имён типов не содержит `нат`;
- `bootstrap/flang check nat.flang` отвечает `FLANG_UNKNOWN_NAME`, код 1;
- утверждения о числе имён пересчитаны: «числовых имён ровно десять» в
  `emit-js.flang` становится девять, пример «Перечень точных имён: шесть
  написаний натурального числа» в `totality.flang` и пример «шесть имён на
  четырёх поверхностях» в `flang/proof/examples/corpus-nat-names.flang`
  (он же в трёх теоремах при нём) — пять;
- заголовок коммита помечен ломающим (`!` перед двоеточием,
  `docs/commit-messages.md`), и перепечатанный `CHANGELOG.md` эту строку несёт;
  руками журнал не правят — его печатает
  `bootstrap/flang run-script changelog:build`.

## Где живёт правка

- перечни `"|неотрицательное|нат|натуральное|nat|naturo|自然数|"` в
  `flang/self/types.flang`, `flang/self/proof-kernel.flang`,
  `flang/self/totality.flang` (вместе с примерами на `"|нат|"`);
- списки числовых имён в `flang/self/io.flang` и `flang/self/emit-js.flang`;
- `flang/scripts/word-guard.fscript`, `flang/scripts/emptiness-guard.fscript`;
- `flang/proof/checker/checker.c`, перечень имён в строке 658: правка доверенной
  базы, нужно отдельное решение владельца;
- таблица `flang/proof/tables/segments.tsv` (строка `нат`) — её и массив ядра
  `flang/proof/tables-guard.fscript` сличает в обе стороны, поэтому снимать
  имя надо из обеих сразу;
- пробы и корпус, где `нат` стоит нарочно: 61 файл под `flang/proof`, из них 9
  записей, привязанных к sha256 исходника (список снимается командой
  `grep -rlP '(?<![\p{L}\p{N}_])нат(?![\p{L}\p{N}_])' flang/proof`);
  среди них `flang/proof/examples/corpus-nat-names.flang`, семьи
  `recursion-step` и `recursion-step-grows`, все семь пар
  `tests/records/case-split-segment/`.

Правка в `flang/self/**` требует перепечатки самосборной части.
