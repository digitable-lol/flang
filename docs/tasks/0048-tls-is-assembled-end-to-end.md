---
номер: 0048
заголовок: Запрос по https ведёт внешний curl — рукопожатие TLS на flang обрывается после ServerHello
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 0047
нужность: язык считает все части защищённого соединения, но само соединение отдаёт чужой программе
---

# 0048. Запрос по https ведёт внешний curl — рукопожатие TLS на flang обрывается после ServerHello

## Шаги воспроизведения

1. Программа из дерева: `docs/examples/https/tls-hello-to-a-real-host.flang`
   (открывает соединение к example.com:443, шлёт свой ClientHello, читает ответ).
2. Команды:

```
bootstrap/flang io docs/examples/https/tls-hello-to-a-real-host.flang --plan 'Привет узлу' --trust
grep -a -n 'define IO_TLS_PROGRAM' bootstrap/flang_repl.c
grep -a -c -i 'pss' flang/stdlib/rsa.flang
```

3. Смотреть: докуда доходит рукопожатие и чем исполняется поручение «Запросить»
   с адресом https.

## Что происходит

```
$ bootstrap/flang io docs/examples/https/tls-hello-to-a-real-host.flang --plan 'Привет узлу' --trust
{"plan":"Привет узлу","result":"октетов принято 1448, целых записей 2; первая
 запись: тип Handshake, версия TLS 1.2, длина 90; ServerHello, версия TLS 1.3,
 набор TLS_AES_128_GCM_SHA256, группа ecdh_x25519, ключ сервера CBB6…EC2B",
 "orders":3,…}                                                   код 0, 27 с
$ grep -a -n 'define IO_TLS_PROGRAM' bootstrap/flang_repl.c
15390:#define IO_TLS_PROGRAM "curl"                               код 0
$ grep -a -c -i 'pss' flang/stdlib/rsa.flang
0                                                                 код 1
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

ServerHello разобран, дальше рукопожатие не идёт. Мешают четыре вещи:

- обмен ключами не связан с рукопожатием: «Умножить точку» из
  `flang/stdlib/x25519.flang` в `flang/stdlib/tls.flang` не ввозится, имя «Нули»
  есть в обоих модулях;
- подпись сервера проверить нечем: CertificateVerify подписан RSA-PSS, а в
  `flang/stdlib/rsa.flang` есть только PKCS#1 v1.5;
- тайный ключ взять неоткуда: поручение «Случайное число» без `--seed` зовёт
  `rand()` без `srand()` и даёт одно и то же число в каждом прогоне;
- счёт медленный: расшифровка одной записи AES-128-GCM толкователем занимает
  десятки секунд, сервер закрывает соединение раньше.

## Что должно быть

Программа на flang сама проходит рукопожатие TLS 1.3 (RFC 8446), проверяет
цепочку сертификата по корням, выбранным по ADR-0012
(`docs/adr/0012-trust-roots.md`), и получает ответ на запрос по https. Внешняя
программа в этом не участвует.

## Обходной путь

Поручение «Запросить» с адресом https: его исполняет curl, он же проверяет
сертификат. Без curl на машине — отказ `FLANG_IO_NO_TLS`.

## Когда задача сделана

```
bootstrap/flang io <программа> --plan '<план>'
```

печатает ответ настоящего узла по https с кодом 0; в журнале поручений есть
только «Открыть соединение», чтение и запись октетов; сертификат узла проверен,
а на узле с чужим сертификатом тот же план кончается провалом. Прогон идёт на
машине, где curl убран из PATH. Пример лежит в `docs/examples/https/` и его
счётная часть сверена с векторами RFC 8448
(`docs/examples/https/rfc8448-records.flang`).

## Где живёт правка

`flang/stdlib/tls.flang`, `flang/stdlib/tls-handshake.flang`,
`flang/stdlib/x25519.flang`, `flang/stdlib/rsa.flang`,
`flang/stdlib/trust-store.flang` — читаются двоичным с диска, пересборка семени
(bootstrap regeneration) не нужна. Новое поручение за настоящей случайностью —
`flang/src/emit/c/flang_repl.c` (`io_random` и разбор поручений), до двоичного
доезжает только пересборкой семени.
