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

Тип зовётся «неотрицательное». Имя «нат» стоит в перечнях допустимых имён как
синоним.

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

Версия: flang 0.7.25, прогон 11 октября 2026. Те же числа: `|нат|` — 1, 1 и 11; в
`flang/proof/checker/checker.c` слово стоит в перечне имён строки 367, в
`flang/proof/lean/RecordReader.lean` — 5 упоминаний; файлов под `flang/proof`, где
`нат` стоит отдельным словом, — 64.

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
- `flang/proof/checker/checker.c`, перечень имён в строке 367: правка доверенной
  базы, нужно отдельное решение владельца;
- таблица `flang/proof/tables/segments.tsv` (строка `нат`) — её и массив ядра
  `flang/proof/tables-guard.fscript` сличает в обе стороны, поэтому снимать
  имя надо из обеих сразу;
- второй сверщик на Lean: тот же перечень имён в
  `flang/proof/lean/RecordReader.lean` (функция «натуральноеИмя», строка 399) и
  упоминания в `Record.lean` и `Rules.lean`;
- пробы и корпус, где `нат` стоит нарочно: 64 файла под `flang/proof` (три
  файла Lean выше в их числе), из них 9 записей, привязанных к sha256 исходника; список
  снимается командой
  `grep -rlP '(?<![\p{L}\p{N}_])нат(?![\p{L}\p{N}_])' flang/proof`. Среди них
  `flang/proof/examples/corpus-nat-names.flang`, семьи `recursion-step` и
  `recursion-step-grows`, все семь пар `tests/records/case-split-segment/`.

Правка в `flang/self/**` требует перепечатки самосборной части.

**Следующий шаг.** Решение владельца о сроке (0.8.0 или перед 1.0), затем перечни
`"|неотрицательное|нат|…|"` в `flang/self/types.flang`, `flang/self/proof-kernel.flang`
и `flang/self/totality.flang` — вместе с `checker.c:367`, `RecordReader.lean:399` и
`flang/proof/tables/segments.tsv`. Проба, которая краснеет сегодня, —
`bootstrap/flang check nat.flang`: «проверено … замечаний нет», код 0 вместо
`FLANG_UNKNOWN_NAME`.
