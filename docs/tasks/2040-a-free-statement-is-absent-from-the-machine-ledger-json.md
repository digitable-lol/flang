---
номер: 2040
заголовок: Счётчик доли файла относит свободное утверждение к ввезённым и печатает «доказано 0 из 0»
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: первая
карта: Сколько доказано на самом деле
рядом: 9526, 6203
нужность: у файлов со свободными утверждениями в перечне долей стоят кресты вместо чисел, хотя двоичный эти утверждения доказывает
---

# 2040. Счётчик доли файла относит свободное утверждение к ввезённым и печатает «доказано 0 из 0»

## Шаги воспроизведения

1. Файл с двумя свободными утверждениями (утверждение вне функции) лежит в
   дереве: `flang/proof/checker/tests/families/own-type/natural.flang`.
2. Снять машинный отчёт о доказательствах и подать его счётчику доли:

```
bootstrap/flang check flang/proof/checker/tests/families/own-type/natural.flang --proof --json > <каталог>/out.json
bootstrap/flang io scripts/ledgers/proved-share-of-a-file.fscript --plan Share --trust --timeout 600000 \
  -- ../../flang/proof/checker/tests/families/own-type/natural.flang ../../<каталог>/out.json
```

Счётчик читает пути от своего каталога `scripts/ledgers/`, поэтому оба довода
даны с `../../`, а `<каталог>` лежит в дереве.

3. Посмотреть строки этой семьи в перечне долей:

```
grep -an 'own-type' scripts/ledgers/proved-share-ledger.txt
```

## Что происходит

```
$ bootstrap/flang check …/own-type/natural.flang --proof --json > <каталог>/out.json
                                                                        код 0
  (в отчёте: claims 2, obligations 2, totals.claims.total 2, proved 2,
   оба утверждения — "kind": "утверждение", "of": null, "verdict": "proved-induction")
$ bootstrap/flang io scripts/ledgers/proved-share-of-a-file.fscript --plan Share --trust -- …/natural.flang …/out.json
…/own-type/natural.flang: написано 0 (постусловий 0, без приговора 0); приговоров своих 0, ввезённых 2
  доказано 0 (цепочкой 0, индукцией 0), сетка 0, объявлено 0
  два счёта сошлись: доказано 0 из 0 = 0,0 %                           код 0
$ grep -an 'own-type' scripts/ledgers/proved-share-ledger.txt
1228:fe1c85c8bcff3ec8d97f6f817fa23f67|2|×|×|×|0|flang/proof/checker/tests/families/own-type/natural.flang
1229:7872cceb7f330d8be0a2d279eb89fb30|3|×|×|×|0|flang/proof/checker/tests/families/own-type/corrupt/lie-without-theorem.flang
```

Версия: flang 0.7.23. Дата прогона: 2 октября 2026.

Двоичный свободные утверждения в машинный отчёт уже кладёт. Ошибается счётчик:
он считает приговор своим, только если поле `of` называет функцию файла, а у
свободного утверждения `of` пусто; «написано» он считает по строкам
`обеспечивает`, которых у такого файла нет. Поэтому два доказанных утверждения
уходят в «ввезённые», а в перечне долей у файла остаются кресты.

## Что должно быть

Счётчик считает свободное утверждение файла своим: на файле из шага 1 —
«написано 2, приговоров своих 2, доказано 2 из 2 = 100,0 %». Строки перечня
долей для этой семьи несут числа, снятые прогоном, а не кресты: перечень сам
говорит, что крест стоит до тех пор, пока счёт счётчика и счёт обязательств не
сойдутся.

## Обходной путь

Читать `totals.claims` прямо из вывода `bootstrap/flang check <файл> --proof --json`.

## Когда задача сделана

```
$ bootstrap/flang io scripts/ledgers/proved-share-of-a-file.fscript --plan Share --trust -- …/natural.flang …/out.json
… написано 2 …; приговоров своих 2, ввезённых 0
  два счёта сошлись: доказано 2 из 2 = 100,0 %                         код 0
```

В `scripts/ledgers/proved-share-ledger.txt` у двух строк семьи `own-type` числа
вместо крестов, пояснение о задаче 2040 над ними снято, и
`sh scripts/guards/proved-share-vs-tree.sh` отвечает кодом 0. На файле без
свободных утверждений, `flang/proof/examples/corpus-hof.flang`, счётчик
печатает те же числа, что до правки.

## Где живёт правка

`scripts/ledgers/proved-share-of-a-file.fscript`: функции «Сколько обязательств»
(считать строки `утверждение «…»` написанными) и «Учесть приговор» с «Ввезённый»
(приговор с `"kind": "утверждение"` и пустым `of` относить к файлу по имени
утверждения);
`scripts/ledgers/proved-share-ledger.txt`. Пересборка семени (bootstrap
regeneration) не нужна.
