# `pull` у Unison привозит весь код, а не ссылки: хеш — способ не дублировать, а не способ не хранить

Прямой ответ на вопрос, ради которого затевался разбор: **хранится ли код у
пользователя целиком или подтягивается по хешу.** Целиком. Адресация по
содержимому у Unison экономит на дублях, а не на хранении.

**Что лежит на диске.** Кодовая база — один файл SQLite,
`.unison/v2/unison.sqlite3` (путь прямо в исходнике,
[`SqliteCodebase/Paths.hs`](https://github.com/unisonweb/unison/blob/trunk/parser-typechecker/src/Unison/Codebase/SqliteCodebase/Paths.hs)),
схема версии 26. Главная таблица — `object(id, primary_hash_id, type_id, bytes BLOB)`,
и видов blob'ов ровно четыре
([`ObjectType.hs`](https://github.com/unisonweb/unison/blob/trunk/codebase2/codebase-sqlite/U/Codebase/Sqlite/ObjectType.hs)):
`TermComponent`, `DeclComponent`, `Namespace`, `Patch`. **Текста исходников не
хранится вовсе** — он рендерится обратно из дерева и таблицы имён. Рядом: `hash`
(base32hex, с индексом для поиска по префиксу — оттуда короткие `#abc…`), `text`
(все строки кодбазы, дедуплицированные), `causal`/`causal_parent` (история),
`watch`/`watch_result` (**тот самый кеш результатов тестов**),
`find_type_index`/`dependents_index` (поиск по типу и по зависимостям).

**Что едет по сети.** Протокол — «entity sync», REST поверх HTTP, три эндпоинта
([`Sync/API.hs`](https://github.com/unisonweb/unison/blob/trunk/unison-share-api/src/Unison/Sync/API.hs)):
`path/get`, `entities/download`, `entities/upload`. Сущность — это `TermComponent`,
`DeclComponent`, `Patch`, `Namespace`, `Causal` и два вида диффов, то есть
**сериализованные определения, а не хеш-ссылки**.

**Почему выкачка обязана быть полной.** Инвариант базы, дословно из
[`001-temp-entity-tables.sql`](https://github.com/unisonweb/unison/blob/trunk/codebase2/codebase-sqlite/sql/001-temp-entity-tables.sql):

> «A "temp entity" is a term/decl/namespace/patch/causal that we cannot store in
> the database proper due to missing dependencies.»

Сущность физически не попадает в `object`, пока не сохранены **все** её
зависимости; недостающие лежат в `temp_entity` вместе с выданным Share токеном на
их докачку. В SyncV2 то же самое сделано топологической сортировкой. Значит после
успешного `pull` транзитивное замыкание лежит локально целиком.

**Живая проверка вложенности.** Обход `@unison/cloud/main` через API Share:
`lib/` содержит `unison_base_7_12_1` (8817 определений) и `unison_http_15_0_0`
(63 297), а внутри `lib/unison_http_15_0_0/lib/` — **свои** `unison_base_7_12_0`,
`systemfw_concurrent_8_2_0`, `unison_connection_pool_3_1_0` и другие; из 63 297
определений http на его собственный `lib` приходится 62 720. Это ровно вендоринг
как в npm, только дедуплицированный по хешу.

> Сравните с местным замером: кодовая база со стандартной библиотекой — **16,7
> МиБ** ([[unison-izmeren]]). Столько на диске и не могло бы лежать, если бы код
> «подтягивался по хешу».

**Сборка без сети — да, но выведена, а не процитирована.** Прямой фразы «works
fully offline» ни на сайте, ни в документации нет. Вывод стоит на трёх опорах:
инвариант полноты выше; кеш компиляции, который «never invalidated» и **является
частью формата кодовой базы** ([The Big
Idea](https://www.unison-lang.org/docs/the-big-idea/)); и наличие команды
`lib.install.local`, которая явно «skip the push/download network step»
([блог UCM 0.5.45](https://www.unison-lang.org/blog/ucm0545/)). Сеть нужна на
`pull`/`push`/`clone`/`lib.install` и для облака; `run`, `test`, тайпчек и
локальный UI берут всё из SQLite.

**Что из этого следует для нас.** Замысел «не хранить пакеты, они выводятся» не
подтверждается даже тем языком, который считается его воплощением: Unison хранит
**больше** обычного (все версии, всю историю, кеш компиляции), а хеш тратит на
то, чтобы не хранить одно и то же дважды. Это ровно та схема, что предложена в
[[chuzhie-pakety-nado-hranit]], и ровно тот довод, что в
[[iz-hesha-kod-ne-vyvoditsya]].

**Чем подтверждено.** Разбор исходников `unisonweb/unison` (ветка `trunk`) и
публичного API `api.unison-lang.org` 2026-08-18; ссылки построчно выше. Числа
16,7 МиБ и 9308 определений — прогон на этой машине 2026-08-15
([[unison-izmeren]]).

**Чем ограничено.**

- **Байты трафика не измерены.** Sync-эндпоинты требуют токен (`401 Invalid Token
  Signature`), анонимно скачать не вышло. Полнота выкачки установлена по
  устройству базы, а не взвешиванием.
- **Оффлайн-сборка — обоснованный вывод, а не цитата.** Опровергнуть можно одной
  попыткой: собрать проект с отключённой сетью.
- **Релиз и клон везут разное.** `clone` тянет всю историю causal'ов («takes a
  while — minutes for a large project»), релиз — сплющенный снимок без истории.
- **Схема живёт и ломается.** Версия схемы 26 при 22 инкрементальных миграциях, и
  каждая миграция оставляет полную копию файла рядом —
  [[romb-lomaetsya-ot-pravki-tipa]].

Связано: [[unison-izmeren]], [[romb-lomaetsya-ot-pravki-tipa]],
[[iz-hesha-kod-ne-vyvoditsya]], [[chuzhie-pakety-nado-hranit]],
[[adresatsiya-po-soderzhimomu]]
