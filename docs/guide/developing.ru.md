[К README](../../README.ru.md) · [Указатель документации](../README.md)

# Развитие языка

Свидетельская реализация на JavaScript остаётся навсегда: относительно неё проверяется неподвижная
точка, и её удаление сделало бы проверку невозможной. Работа над ней идёт в клоне, и ставить в
нём нечего: зависимостей у пакета нет и собирать нечего, поэтому скрипты запускаются сразу после
`git clone`.

```bash
node scripts/build-release-c.mjs     # печатает релизный C и собирает его
```

Правка компилятора в `flang/self/` обязана перепечатать точку раскрутки тем же коммитом, иначе
`bootstrap/` начнёт собирать прошлый компилятор молча:

```bash
node scripts/bootstrap-c.mjs           # перепечатать bootstrap/ (≈10 с процессорного времени)
node scripts/bootstrap-c.mjs --check   # сверить с исходниками побайтово, код 1 при расхождении
```

Стережёт это тест «точка раскрутки `bootstrap/` совпадает с печатью текущих исходников,
побайтово» в `flang/test/self-bootstrap.test.mjs`. Компилятор C ему не нужен, поэтому он идёт
всегда — в отличие от самой неподвижной точки, которой нужен `cc` и которую в CI включает
`FTS_REQUIRE_TOOLCHAINS=c`.

Команды, на которые язык отвечает:

```bash
# разобрать, проверить типы, доказать тотальность
flang check flang/examples/leetcode/035-search-insert-position.flang --pretty

# прогнать примеры, объявленные внутри функций
flang test flang/examples/leetcode/035-search-insert-position.flang --pretty

# вызвать функцию
flang run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# напечатать — цели: c | csharp | elixir | go | java | js | python | rust
flang emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

**Команд в дереве ровно две.** В `flang/bin/` лежат `flang` и `flang-lsp`, и больше ничего;
`npm link` кладёт в `$PATH` их же.

Тесты:

```bash
npm test              # прогон один: flang/test/*.test.mjs, весь язык
npm run test:backends # восемь целей печати отдельно
```

Каждая команда пишет JSON в stdout, диагностику в stderr и возвращает ненулевой код при отказе —
один и тот же контракт везде, и именно он делает всё это пригодным для CI, редакторов и агентов.
Единственное исключение — `flang repl`, который разговаривает с человеком.
