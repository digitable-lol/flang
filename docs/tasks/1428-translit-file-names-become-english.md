---
номер: 1428
заголовок: В дереве остаются файлы с именами транслитом и ссылки на старое имя скрипта пересборки
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: первая
карта: Куда идём
рядом: 1427, 5821
нужность: имя файла либо английское, либо русское; транслит читают только свои, и человеку со стороны он ничего не говорит
---

# 1428. В дереве остаются файлы с именами транслитом и ссылки на старое имя скрипта пересборки

## Шаги воспроизведения

1. Посчитать имена, записанные в долг проверки транслита, и разложить их по
   каталогам:

```
bootstrap/flang io scripts/guards/translit-file-names-guard.fscript --plan Проверка
grep -av "^#" scripts/ledgers/translit-file-names-debt.txt | grep -ac .
grep -av "^#" scripts/ledgers/translit-file-names-debt.txt | grep -a . | cut -d/ -f1-3 | sort | uniq -c
```

2. Найти живые ссылки на старое имя скрипта пересборки семени:

```
git grep -n "raskrutka\.sh" -- bootstrap/README.md flang/self/bootstrap/compiler.flang
```

## Что происходит

```
$ bootstrap/flang io scripts/guards/translit-file-names-guard.fscript --plan Проверка
… "result":"транслит в именах файлов: латинских имён 2254, с чужими словами 104 — все в ведомости, новых нет" …
                                                                  код 0, 15 с
$ grep -av "^#" scripts/ledgers/translit-file-names-debt.txt | grep -ac .
104
$ … | cut -d/ -f1-3 | sort | uniq -c
     57 flang/test/fixtures
     40 flang/proof/checker
      5 flang/test/…            (uzel-osnastka.flang, uzel-osnastka.mjs и три *-uzla, *-celi .test.mjs)
      2 docs/zettel/…
$ git grep -n "raskrutka\.sh" -- bootstrap/README.md flang/self/bootstrap/compiler.flang
bootstrap/README.md:67: … `sh scripts/raskrutka.sh --check` …
bootstrap/README.md:96:sh scripts/raskrutka.sh           # перепечатать …
bootstrap/README.md:97:sh scripts/raskrutka.sh --check   # сверить с исходниками …
bootstrap/README.md:98:sh scripts/raskrutka.sh --stroki  # …
bootstrap/README.md:187: … `sh scripts/raskrutka.sh --check` останется
flang/self/bootstrap/compiler.flang:83:// … сверяет `sh scripts/raskrutka.sh --check`,
flang/self/bootstrap/compiler.flang:1157:// … записан в шапке scripts/raskrutka.sh словами
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Сам скрипт уже называется `scripts/bootstrap-reprint.sh`; семь строк выше зовут
файл, которого нет. Имена в долге держатся не осторожностью, а связями:

- 57 файлов в `flang/test/fixtures` и 40 записей в `flang/proof/checker` — имя
  файла служит ключом записи доказательства и снимков (`record-oracle.json`,
  `record-grid.json`), запись повторяет имя исходника;
- оснастка узла и три пробы на Node названы в `flang/self/emit-js.flang` и в
  документации по конкурентности;
- на две заметки в `docs/zettel` ссылается `flang/self/proof-kernel.flang`.

Проверке транслита на этот прогон нужно чуть больше 8 ГиБ памяти: под пределом
`ulimit -v 8388608` она отвечает «FLANG_MEMORY: недостаточно памяти», код 1.

## Что должно быть

В области проверки транслита нет ни одного латинского имени из русских слов,
записанных латиницей: долг пуст либо в нём остались только собственные имена
(например `zhi-shi.fts` — название правила орфографии). Ни один живой файл не
зовёт скрипт пересборки старым именем.

## Обходной путь

Не нужен: имена работают. Новое транслитное имя проверка не пропускает, старые
перечислены в `scripts/ledgers/translit-file-names-debt.txt` с причиной.

## Когда задача сделана

```
grep -av "^#" scripts/ledgers/translit-file-names-debt.txt | grep -ac .
```

печатает 0 или число собственных имён, у каждого из которых причина названа;
`bootstrap/flang run-script transliteration:check` отвечает кодом 0, `bootstrap/flang run-script transliteration:forgery` — кодом 1;

```
git grep -l "raskrutka\.sh" -- . ':!CHANGELOG.md' ':!changelog.json' ':!docs/site' ':!docs/release-notes.json' ':!docs/tasks'
```

не находит ничего. Переименование каждой группы идёт одним коммитом вместе со
всеми ссылками, записями и снимками — половина переименования оставляет
проверки зовущими несуществующий файл.

## Где живёт правка

- `flang/test/fixtures/**` вместе с `flang/proof/checker/tests/records/corpus/**`,
  `flang/proof/forgeries/manifest.tsv` и снимками — снимки правятся пересъёмкой;
- `flang/test/*.mjs`, `flang/test/uzel-osnastka.flang` и их упоминания;
- две заметки в `docs/zettel/`;
- `bootstrap/README.md` — пять строк, правятся сразу, в тело семени файл не входит;
- `scripts/ledgers/translit-file-names-debt.txt` — строка уходит вместе с файлом.

Комментарии в `flang/self/bootstrap/compiler.flang`, имена в
`flang/self/emit-js.flang` и `flang/self/proof-kernel.flang` — самосборная часть:
их правка доезжает только пересборкой семени (bootstrap regeneration), поэтому
её стоит класть в ту партию, где пересборка и так назначена.

Отдельная задача, здесь не решается: перенос скриптов оболочки из `scripts/` на
flang — задача 5821.
