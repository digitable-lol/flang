[К README](../../README.ru.md) · [Указатель документации](../README.md)

# Развитие языка

Эталонная реализация на JavaScript остаётся навсегда: относительно неё проверяется неподвижная
точка, и её удаление сделало бы проверку невозможной. Работа над ней идёт в клоне:

```bash
npm install                          # ничего не ставит: у пакета ноль зависимостей —
                                     # он только кладёт `flang` в node_modules/.bin
node scripts/build-release-c.mjs     # печатает релизный C и собирает его
```

Шага сборки нет: язык читает свои исходники. Свежий клон отвечает на
`node flang/bin/flang.mjs` ещё до того, как позвали `npm`.

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

Модель `.fts` язык **больше не читает**. Этот путь шёл через мост совместимости к ядру старого
проекта на TypeScript; 16 августа 2026 проект вынесен из репозитория, и мост остался без второй
стороны, так что команды ниже сохранены лишь как след того, чем этот путь был, — сегодня отказ
внятный и называет, где взять убранное:

```bash
flang check examples/utilities/discount.fts --pretty
flang emit examples/utilities/discount.fts --target go --out ./out-go
```

Собственный CLI FTS — для моделей:

```bash
fts pipeline examples/real-world/order-shipment.fts --pretty
fts test examples/utilities/discount.fts --pretty
fts run examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
fts certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
fts generate examples/utilities/discount.fts --out generated
```

Тесты:

```bash
npm test              # прогон один: flang/test/*.test.mjs — парсер, типы, тотальность,
                      # восемь целей печати, ядро и компилятор на flang
```

Каждая команда пишет JSON в stdout, диагностику в stderr и возвращает ненулевой код при отказе —
один и тот же контракт везде, и именно он делает всё это пригодным для CI, редакторов и агентов.
Единственное исключение — `flang repl`, который разговаривает с человеком.
