---
номер: 0048
заголовок: Двоичный ствола ведёт https через curl — клиент TLS на flang входит в него только перепечаткой семени
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 6375
нужность: язык считает все части защищённого соединения, но само соединение отдаёт чужой программе
---

# 0048. Двоичный ствола ведёт https через curl — клиент TLS на flang входит в него только перепечаткой семени

## Шаги воспроизведения

1. Набор `flang/proof/probes/network/` (команды строк собирает `run.fscript`,
   ожидания — `expected.tsv`; нужен `openssl`, внешняя сеть не нужна).
2. Команды:

```
bootstrap/flang io flang/proof/probes/network/run.fscript --plan Binary --timeout 120000
FLANG_BIN=<двоичный, собранный с рантаймом из исходников> bootstrap/flang io flang/proof/probes/network/run.fscript --plan Binary --timeout 120000
```

## Что происходит

Исходники рантайма (`flang/src/emit/c/flang_repl.c`, `io_https`) исполняют
«Запросить» по `https` клиентом TLS 1.3 из `flang/stdlib/tls-client.flang`,
напечатанным в C и собранным в двоичный; curl из хозяина убран
([ADR-0101](../adr/0101-the-binary-host-speaks-tls-with-the-printed-language-client.md)).
Печать двигателя в `bootstrap/` заведена в `scripts/bootstrap-reprint.sh`, но
перепечатки ещё не было. Прогон 12 октября 2026: двоичный ствола — «проб 5,
разошлось 5» (`непонятный ключ «--trust-roots»`, датаграммы —
`FLANG_UNKNOWN_NAME`); частная сборка (семя ствола с рантаймом из исходников
и напечатанным двигателем) — «проб 5, разошлось 1»: четыре строки TLS сошлись,
строка датаграмм упирается в печатный компилятор ствола, который слов
«Отправить датаграмму» и «Датаграмма» не знает.

## Что должно быть

`bootstrap/flang` после перепечатки отвечает на набор `network` «проб 5,
разошлось 0» на машине без curl в PATH, а `--plan Forgery` — «подлог
отвергнут: … проб 5, разошлось 5».

## Обходной путь

До перепечатки — двоичный ствола (`https` через curl) или частная сборка по
разделу «Замер» ADR-0101.

## Когда задача сделана

```
bootstrap/flang io flang/proof/probes/network/run.fscript --plan Binary --timeout 120000
```

кончается кодом 0, сторож `seed-runtime-is-source` зелёный.

## Где живёт правка

Правка лежит в исходниках: `flang/src/emit/c/flang_repl.c`,
`flang/stdlib/tls-client.flang`, `flang/self/parser.flang`,
`scripts/bootstrap-reprint.sh`. Остаётся перепечатка семени.

Следующий шаг — перепечатка (`sh scripts/bootstrap-reprint.sh`): она печатает
`tls_client.c` и `tls_client.h` в `bootstrap/`, и `flang_repl.c` включает их сам.
После неё — прогон набора `network` двоичным ствола; строка датаграмм проверена
до этого только по частям (исполнение — обвязкой на C, разбор и типы —
исходным компилятором).
