# Ромб у Unison ломается не от подъёма версии, а от правки типа: за семь версий `base` не изменился ни один тип

Поправка к [[unison-izmeren]], и она в пользу Unison. Замер прогоном там верен, но
поставлен на **худший случай**: тип нарочно переписали (`Money Nat` →
`Money Nat Text`), и ошибка типов на границе — правильный ответ на такую правку.
Вопрос, который замер не задал: **как часто версия вообще меняет тип.**

**Ответ — почти никогда, и это проверено по хешам в Unison Share.**

| что сравнивали | различающихся типов |
|---|---:|
| `@unison/base` 7.12.0 против 7.19.2 (семь минорных версий) | **0** |
| в том числе `data.List` — 170 сущностей | **0** (изменился один терм документации) |
| в том числе `Text` — 108 сущностей | **0** (два терма, три добавленных) |
| `systemfw_concurrent` 8.2.0 против 9.0.0 (**мажор**) | **0**: `ConcurrentMap`, `Signal`, `Threads` — хеш в хеш |

**Причина названа самим Unison и она нарочная.** Заголовок их же теста
[`unique-type-churn.md`](https://github.com/unisonweb/unison/blob/trunk/unison-src/transcripts/idempotent/unique-type-churn.md):
«unique types no longer always get a fresh GUID: they share GUIDs with already-saved
unique types of the same name». Пол Кьюзано формулирует правило
([unison#2196](https://github.com/unisonweb/unison/issues/2196#issuecomment-1268875171)):
«if the type has the same structure and the same name, it gets the same guid and hash».

Иначе говоря, чисто структурная адресация типов оказалась негодной, туда
подмешали GUID — а потом обнаружили, что случайный GUID тоже негоден, и
привязали его к **имени**. Круг замкнулся: **идентичность типа в языке,
построенном на содержимом, определяется именем и структурой**. Это стоит
запомнить прежде, чем повторять их схему у себя ([[chto-vhodit-v-hash]] говорит о
том же с другой стороны).

**Второй демпфер:** базовые типы `base` — `structural` (`Optional`, `Either`,
кортежи), а structural хешируется чисто по форме и потому одинаков во всех
версиях всех библиотек.

**Честный итог по ромбу, в три строки.**

- Конфликт **имён** Unison действительно убирает — обещание
  «dependency conflicts … are just not a thing» верно ровно про имена.
- Конфликт **типов** остаётся, и признан вскользь, в скобке той же страницы:
  «you can … even write ordinary functions to convert between one and the other»
  ([The Big Idea](https://www.unison-lang.org/docs/the-big-idea/)). Переходник
  нужен потому, что типы не сходятся.
- Но случается это редко, потому что **бамп версии сам по себе тип не форкает**.
  Ломается только реально изменённый тип и всё, что от него зависит.

**И три вещи, которые обещание не покрывает вовсе.**

1. **`upgrade` чинит только ваш код.** Дословно из
   [PR 4386](https://github.com/unisonweb/unison/pull/4386): перепарсить и
   перепроверить «all of their dependents … **outside `lib`**». Если библиотека A
   внутри себя держит `lib.a.lib.c_v1`, ваш `upgrade` до `c_v2` на неё не влияет
   никак — надо форкать A. Механизм при этом не миграция типов, а **перепривязка
   имён через текст**: код рендерится в исходник и парсится заново в окружении с
   новыми именами.
2. **Сборщика мусора нет.** Официальный
   [FAQ](https://www.unison-lang.org/docs/usage-topics/general-faqs/):
   «The codebase stores its complete history … **In the future, we may introduce a
   "prune" operation**». Команд `gc`, `prune`, `compact`, `vacuum` в
   `InputPatterns.hs` не существует. Единственное средство — сплющивание истории
   при релизе. Отчёт пользователя:
   «my sqlite file is currently just above 500MB»
   ([unison#5544](https://github.com/unisonweb/unison/issues/5544), открыт с
   января 2025) — там же беда, что каждая миграция схемы оставляет **полную копию**
   файла рядом и не убирает её.
3. **Разрешения совместимости у Unison Share нет.** Хранилище нормализовано по
   хешу содержимого (Postgres, таблица `bytes` с `content_hash`), а сверху —
   обычный SemVer отдельными колонками `major_version/minor_version/patch_version`
   ([share-api](https://github.com/unisoncomputing/share-api/blob/main/sql/2023-05-09-00-00_release_versioning.sql)),
   тип в компиляторе жёсткий: `data Semver = Semver !Int !Int !Int`. Но
   **диапазонов версий, решателя ограничений и замка нет**: версия только
   упорядочивает, она не контракт. Живая проверка: `latestRelease` у
   `@unison/base` — `7.19.2`, то есть **шесть ломающих мажоров** у стандартной
   библиотеки языка, который «избавился от версий».

**Чем подтверждено.** Разбор внешних источников 2026-08-18: сравнение хешей типов
через публичный API `api.unison-lang.org` по двум парам версий; цитаты и ссылки
приведены построчно выше. Замер на этой машине (`ucm release/1.3.0`, 2026-08-15)
не отменяется — он про другой случай.

**Чем ограничено.**

- **Сравнение хешей — по двум парам библиотек, не по выборке.** «Ни один тип за
  семь версий» — это про `@unison/base` 7.12.0→7.19.2 и `systemfw_concurrent`
  8.2.0→9.0.0, а не про экосистему.
- **Прямого признания командой проблемы идентичности типов найти не удалось** ни
  на сайте, ни в блоге, ни в задачах. Есть скобка в The Big Idea, сторонняя
  формулировка и симптом в дикой природе:
  [unison#5021](https://github.com/unisonweb/unison/issues/5021) — «I've run into
  it 3 times today with `Http.handler` coming transitively through several libs».
- **Объём трафика при `lib.install` не измерен**: sync-эндпоинты требуют токен.
  Полнота выкачки установлена по устройству, а не по байтам, — см.
  [[pull-privozit-ves-kod]].
- **Для flang эта поправка ничего не меняет по существу.** У нас две версии не
  уживаются при любой адресации ([[imena-a-ne-hashi]]), так что «ромб ломается
  редко» — довод в пользу Unison, а не в пользу его копирования.

Связано: [[unison-izmeren]], [[pull-privozit-ves-kod]], [[chto-vhodit-v-hash]],
[[imena-a-ne-hashi]], [[chuzhie-pakety-nado-hranit]]
