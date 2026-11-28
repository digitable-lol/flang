[К README](../README.ru.md) · [Указатель документации](../README.md)

# Развитие языка

Компилятор один, написан на самом flang и собирается в двоичный файл. Работа над ним идёт в
клоне, и ставить в нём нечего: зависимостей у пакета нет, поэтому команды запускаются сразу после
`git clone`.

Правка компилятора в `flang/self/` перепечатывает `bootstrap/` тем же коммитом. Иначе из
`bootstrap/` соберётся прежний компилятор, и сообщения об этом не будет:

```bash
sh scripts/bootstrap-reprint.sh           # перепечатать bootstrap/ (часы)
sh scripts/bootstrap-reprint.sh --check   # сверить с исходниками побайтово, код 1 при расхождении
sh scripts/bootstrap-reprint.sh --stroki  # меньше секунды: все строковые литералы рантайма C закрыты
```

Печатает эти байты сам двоичный компилятор (`bootstrap/flang emit … --target c`); если двоичного
нет, скрипт сначала соберёт его из `bootstrap/`.

Сверка печатает заново и идёт столько же, сколько печать (часы), плюс `make`, если двоичный не
собран. Запускайте `--check` перед слиянием правки в `flang/self/` или `flang/src/emit/c/`, а не
на каждое сохранение.

Чтобы до печати проверить правленый исходник компилятора на одной программе, собранный
двоичный исполняет исходники интерпретатором: `flang/self/bootstrap/check-with-source-compiler.flang` проверяет
ими один файл и печатает отчёт о доказательствах словами и запись доказательства. `--trust` пропускает проверку доказательств
по самому компилятору; маленькая программа стоит около десяти минут и 12 ГиБ:

```bash
bootstrap/flang run flang/self/bootstrap/check-with-source-compiler.flang \
  --function 'Проверить исходным компилятором' --trust --max-steps 2000000000 \
  --args "$(jq -n --arg path FILE --rawfile text FILE '{"путь": $path, "текст": $text}')"
```

Порядок ввоза в этом модуле значим: связывание берёт объявления модуля через того, кто ввёз его
первым, вместе с его списком `только`, поэтому «Compiler flang» стоит первым, как в
`compiler.flang`. С «Печать в C» на первом месте проверяемая программа с `требует` останавливается
на `FLANG_UNKNOWN_NAME` о «Печать значения».

Команды компилятора:

```bash
# разобрать, проверить типы, доказать тотальность
flang check docs/examples/leetcode/035-search-insert-position.flang

# прогнать примеры, объявленные внутри функций
flang test docs/examples/leetcode/035-search-insert-position.flang

# то же по набору файлов: каталог или маска вместо файла.
# Печатается каждый не прошедший пример и каждый не взятый файл, прошедшие —
# числом; код возврата 0 — всё прошло, 1 — пример не прошёл или файл не взят, 2 — ошибка в вызове.
flang test flang/stdlib/
flang test 'docs/examples/**/*.flang' --json

# вызвать функцию: --args берёт объект JSON, списки и записи тоже
flang run docs/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы": [1,3,5,6], "цель": 5}'

# напечатать — цели: c | cpp | csharp | elixir | go | java | js | python | rust | ts
flang emit docs/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Проверки:

```bash
sh flang/test/обход.sh          # проверки обходчика двоичным
sh flang/test/обход-примеров.sh # все примеры дерева
sh scripts/bootstrap-reprint.sh --check  # семя против того, что печатают исходники
bootstrap/flang run-script                                  # список коротких команд дерева и что каждая запускает
bootstrap/flang run-script tests                            # связывание, планировщик и надзор на целях печати
```

Отдельная проверка запускается по имени из этого списка: `bootstrap/flang run-script specs:check`,
`bootstrap/flang run-script links:check`, `bootstrap/flang run-script site:check`. Код возврата 0 —
ошибок нет; при ненулевом вывод называет, что не прошло.

Команды печатают итог текстом в stdout, а сообщения об ошибках — в stderr, и возвращают
ненулевой код при ошибке. JSON вместо текста дают `flang test --json` и `flang check --proof --json`;
`flang io` и `flang run-script` печатают запись о запуске строкой JSON.
