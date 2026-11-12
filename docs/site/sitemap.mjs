// Карта сайта: какие страницы есть, из чего собираются, как называются.
//
// Один список — один источник правды. Добавить страницу значит дописать строку
// сюда; забыть вписать в оглавление невозможно, потому что оглавление строится
// отсюда же.
//
// Поле `из` — путь от корня репозитория. Если файла нет, сборка отказывает с
// именем — молча пропускать страницу нельзя, иначе сайт худеет незаметно.
//
// ДВУЯЗЫЧНОСТЬ выводится из имени файла, а не объявляется второй строкой: у
// `имя.ru.md` английская пара — соседний `имя.md`, ровно тот уклад, что уже
// работает у руководства. Английская страница встаёт по адресу `en/<имя>.html`.
//
// ПАРА ОБЯЗАТЕЛЬНА У КАЖДОЙ СТРАНИЦЫ ЭТОГО СПИСКА, из любого каталога:
// нет файла — сборка красная и называет путь. До 2 октября 2026 здесь стояло
// «для страниц вне `docs/site/` пара берётся по наличию» — граница без довода, из-за
// которой восемь страниц стояли без английской половины, а проверка молчала (задача 0037).
//
// СНЯТЬ ТРЕБОВАНИЕ МОЖНО ТОЛЬКО СЛОВАМИ, двумя полями:
//   `печатается: true` — страница из печати, её перевод придёт из печати же;
//   `безПары: '<довод>'` — английской половины нет, и сказано, почему.
// Пустой довод не довод, а объявление при появившейся паре — мусор: сборка краснеет и
// на том, и на другом. Сколько страниц сверено и сколько объявлено — в выводе
// `node docs/site/build.mjs --check` строкой «Английская пара», числами.

export const РАЗДЕЛЫ = [
  {
    имя: 'Начать', англ: 'Start',
    страницы: [
      { адрес: 'index.html', имя: 'Что такое flang', из: 'docs/site/index.ru.md' },
      { адрес: 'install.html', имя: 'Установка', из: 'docs/site/install.ru.md' },
      { адрес: 'getting-started.html', имя: 'Первая программа', из: 'docs/site/getting-started.ru.md' },
      { адрес: 'playground.html', имя: 'Песочница', из: 'docs/site/playground.ru.md' },
      { адрес: 'editor.html', имя: 'Настройка редактора', из: 'docs/site/editor.ru.md' },
      { адрес: 'troubleshooting.html', имя: 'Если не работает', из: 'docs/site/troubleshooting.ru.md' },
    ],
  },
  {
    имя: 'Тур по языку', англ: 'Language tour',
    страницы: [
      { адрес: 'tutorial.html', имя: 'Учебник', из: 'docs/site/tutorial.ru.md' },
      { адрес: 'surface-sugar.html', имя: 'Циклы, классы, интерфейсы', из: 'docs/guide/surface-sugar.ru.md' },
      { адрес: 'totality.html', имя: 'Тотальные функции', из: 'docs/guide/totality.ru.md' },
      { адрес: 'which-construct.html', имя: 'Какую конструкцию когда брать', из: 'docs/site/which-construct.ru.md' },
      { адрес: 'how-to-write-flang.html', имя: 'Как писать на flang', из: 'docs/guide/how-to-write-flang.ru.md' },
      { адрес: 'learning.html', имя: 'Что читать дальше', из: 'docs/site/learning.ru.md' },
    ],
  },
  {
    имя: 'Доказательства', англ: 'Proofs',
    страницы: [
      { адрес: 'proofs.html', имя: 'Зачем и как', из: 'docs/site/proofs.ru.md' },
      { адрес: 'how-proofs-work.html', имя: 'Как это доказывается', из: 'docs/site/how-proofs-work.ru.md' },
      { адрес: 'proof-refused.html', имя: 'Ядро отказало: чья это ошибка', из: 'docs/site/proof-refused.ru.md' },
      { адрес: 'what-the-kernel-accepts.html', имя: 'Что ядро доказывает само', из: 'docs/site/what-the-kernel-accepts.ru.md' },
      { адрес: 'manual-proofs.html', имя: 'Теоремы руками', из: 'docs/site/manual-proofs.ru.md' },
      { адрес: 'record-format.html', имя: 'Запись доказательства и сверщик', из: 'docs/site/record-format.ru.md' },
      { адрес: 'verdict-cache.html', имя: 'Кеш доказательств', из: 'docs/site/verdict-cache.ru.md' },
      { адрес: 'cost.html', имя: 'Цена функции до прогона', из: 'docs/guide/cost.ru.md' },
      { адрес: 'what-is-proved.html', имя: 'Что доказано, а что нет', из: 'docs/site/what-is-proved.ru.md' },
      { адрес: 'mathematics.html', имя: 'Сравнение с Coq и Lean', из: 'docs/site/mathematics.ru.md' },
    ],
  },
  {
    имя: 'Справочник', англ: 'Reference',
    страницы: [
      { адрес: 'language.html', имя: 'Конструкции языка', из: 'docs/site/language.ru.md' },
      { адрес: 'language-map.html', имя: 'Карта конструкций', из: 'docs/site/language-map.ru.md' },
      { адрес: 'operations.html', имя: 'Операции', из: 'docs/site/operations.ru.md' },
      { адрес: 'diagnostics.html', имя: 'Коды отказа', из: 'docs/site/diagnostics.ru.md' },
      { адрес: 'cli.html', имя: 'Команды', из: 'docs/site/cli.ru.md' },
      { адрес: 'settings.html', имя: 'Настройки: .flangrc', из: 'docs/guide/settings.ru.md' },
      { адрес: 'fspec.html', имя: 'Спеки: доказанное правило', из: 'docs/site/fspec.ru.md' },
      { адрес: 'spec-catalog.html', имя: 'Каталог спек', из: 'docs/site/spec-catalog.ru.md' },
      { адрес: 'ai-assistant.html', имя: 'Служба для ИИ-помощника', из: 'docs/site/ai-assistant.ru.md' },
      { адрес: 'glossary.html', имя: 'Словарь языка', из: 'docs/glossary.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'surfaces.html', имя: 'Четыре поверхности записи', из: 'docs/surfaces.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'limits.html', имя: 'Известные ограничения', из: 'docs/guide/limits.ru.md' },
    ],
  },
  {
    имя: 'Библиотека', англ: 'Library',
    страницы: [
      { адрес: 'stdlib.html', имя: 'Справочник библиотеки', из: 'docs/site/stdlib.ru.md' },
      { адрес: 'library-api.html', имя: 'API: каждая функция', из: 'docs/site/library-api.ru.md' },
      { адрес: 'packages.html', имя: 'Модули и пакеты', из: 'docs/site/packages.ru.md' },
      { адрес: 'processes.html', имя: 'Процессы и надзор', из: 'docs/site/processes.ru.md' },
      { адрес: 'database.html', имя: 'Базы данных', из: 'docs/site/database.ru.md' },
      { адрес: 'unicode-text.html', имя: 'Текст по Юникоду', из: 'docs/guide/unicode-text.ru.md' },
      { адрес: 'categories.html', имя: 'Категории и функторы', из: 'docs/site/categories.ru.md' },
    ],
  },
  {
    имя: 'Печать в другие языки', англ: 'Targets',
    страницы: [
      { адрес: 'emit-walkthrough.html', имя: 'Напечатать программу в C и JavaScript', из: 'docs/guide/emit-walkthrough.ru.md' },
      { адрес: 'typescript-target.html', имя: 'Цель TypeScript', из: 'docs/guide/typescript-target.ru.md' },
      { адрес: 'embedding.html', имя: 'Встроить в чужую программу', из: 'docs/site/embedding.ru.md' },
      { адрес: 'browser-app.html', имя: 'Приложение в браузере', из: 'docs/site/browser-app.ru.md' },
      { адрес: 'host-boundary.html', имя: 'Где кончается flang и начинается хозяин', из: 'docs/site/host-boundary.ru.md' },
    ],
  },
  {
    имя: 'Примеры', англ: 'Examples',
    страницы: [
      { адрес: 'examples.html', имя: 'Каталог примеров', из: 'docs/site/examples.ru.md' },
      { адрес: 'rosetta.html', имя: 'Rosetta Code', из: 'docs/site/rosetta.ru.md' },
      { адрес: 'case-studies.html', имя: 'Задачи с leetcode', из: 'docs/site/case-studies.ru.md' },
      { адрес: 'shortener.html', имя: 'Сокращатель ссылок: служба и клиент', из: 'docs/site/shortener.ru.md' },
      { адрес: 'wal.html', имя: 'Журнал упреждающей записи', из: 'docs/site/wal.ru.md' },
      { адрес: 'allocator.html', имя: 'Распределитель памяти', из: 'docs/site/allocator.ru.md' },
      { адрес: 'msi-driver.html', имя: 'Драйвер MSI', из: 'docs/site/msi-driver.ru.md' },
      { адрес: 'russian-grammar.html', имя: 'Грамматика русского на прегруппах', из: 'docs/site/russian-grammar.ru.md' },
      { адрес: 'russian-syntax.html', имя: 'Разбор высказывания по графу понятий', из: 'docs/site/russian-syntax.ru.md' },
    ],
  },
  {
    имя: 'Выпуски', англ: 'Releases',
    страницы: [
      { адрес: 'releases.html', имя: 'Выпуски', из: 'docs/site/releases.ru.md', печатается: true },
      { адрес: 'roadmap.html', имя: 'Дорога до 1.0', из: 'docs/site/roadmap.ru.md' },
    ],
  },
  {
    имя: 'Разработка', англ: 'Development', дляУчастников: true,
    страницы: [
      { адрес: 'contributing.html', имя: 'Тем, кто делает язык', из: 'docs/site/contributing.ru.md' },
      { адрес: 'developing.html', имя: 'Развитие языка', из: 'docs/guide/developing.ru.md' },
      { адрес: 'project-layout.html', имя: 'Раскладка репозитория', из: 'docs/guide/project-layout.ru.md' },
      { адрес: 'bootstrap-circle.html', имя: 'Компилятор собирает сам себя', из: 'docs/guide/bootstrap-circle.ru.md' },
      { адрес: 'single-source.html', имя: 'Один источник правды', из: 'docs/guide/single-source.ru.md' },
      { адрес: 'c-into-flang.html', имя: 'Код на C в flang', из: 'docs/guide/c-into-flang.ru.md' },
      /* Контракты: рабочие документы с кодами отказа и границами обещаний.
         Спецификация языка — контракт на 2149 строк.
         СНЯТО 2026-11-12 строк docs/flang/SPEC.md = 2149 (input of print batch 12: exact integers come only from literals and actions) */
      { адрес: 'spec.html', имя: 'Спецификация языка — контракт', из: 'docs/flang/SPEC.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'spec-proof.html', имя: 'Ядро доказательств — контракт', из: 'docs/flang/proof/SPEC.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'spec-cat.html', имя: 'Категории и функторы — контракт', из: 'docs/ct/spec.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'spec-conc.html', имя: 'Процессы и отказоустойчивость — контракт', из: 'docs/flang/concurrency/SPEC.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'spec-self.html', имя: 'Самоприменение: компилятор на flang — контракт', из: 'docs/flang/self/SPEC.md', безПары: 'английской редакции ещё нет — долг задачи 7660' },
      { адрес: 'changelog.html', имя: 'Журнал вливаний', из: 'docs/site/changelog.md', печатается: true },
      { адрес: 'journal.html', имя: 'Журнал коммитов', из: 'CHANGELOG.md', безПары: 'журнал коммитов, английской редакции ещё нет — долг задачи 7660' },
    ],
  },
];

/**
 * Переезды: старый адрес → новый.
 *
 * 17 августа 2026 страницы переименованы из транслита в английские слова
 * (`nachalo.html` → `getting-started.html`). Внешняя ссылка на старый адрес
 * ломается навсегда, и починить её мы не можем — она в чужой закладке, в чужом
 * письме, в чужом посте. Поэтому по каждому старому адресу лежит страница в
 * одну строку, уводящая на новый. Стоит она байты, а теряется без неё читатель.
 *
 * Список закрыт: сюда попадают только адреса, которые уже были опубликованы.
 * Новая страница переезда не заводит — ей неоткуда переезжать.
 */
export const ПЕРЕЕЗДЫ = {
  'nachalo.html': 'getting-started.html',
  'izmeneniya.html': 'releases.html',
  'zhurnal.html': 'journal.html',
  'dokazatelstva.html': 'proofs.html',
  'obzor.html': 'what-is-proved.html',
  'odin-istochnik.html': 'single-source.html',
  'totalnost.html': 'totality.html',
  'dve-realizacii.html': 'bootstrap-circle.html',
  'two-implementations.html': 'bootstrap-circle.html',
  'razvitie.html': 'developing.html',
  'ogranicheniya.html': 'limits.html',
  'raskladka.html': 'project-layout.html',
  'zamer-skorosti.html': 'contributing.html',
  'zamer-tseny.html': 'proofs.html',
  'zamer-processov.html': 'processes.html',
  'pamyat.html': 'contributing.html',
  'moduli.html': 'packages.html',
  'registry.html': 'packages.html',
  'znanie.html': 'contributing.html',
  'knowledge.html': 'contributing.html',
  // Страница «Чем проверена установка» снята: это был журнал прогонов
  // выпуска 0.5.1, и разработчику он не нужен. Адрес был опубликован —
  // значит, по нему остаётся строка, уводящая на «Установку».
  'install-evidence.html': 'install.html',
  // 17 сентября 2026: имена без транслита (задача 1428, часть 2).
  'kak-dokazat.html': 'what-the-kernel-accepts.html',
  'matematika.html': 'mathematics.html',
  'dlya-ii.html': 'ai-assistant.html',
  'overview.html': 'what-is-proved.html',
  'benchmark-speed.html': 'contributing.html',
  'benchmark-proof-cost.html': 'proofs.html',
  'benchmark-proof-cost-2.html': 'proofs.html',
  'benchmark-processes.html': 'processes.html',
  'memory.html': 'contributing.html',
  'modules.html': 'packages.html',
  'wasm.html': 'embedding.html',
};

/**
 * Живые примеры кода на главной. Берутся из дерева, а не переписываются.
 *
 * Раньше этот список был объявлен и не использован ни разу: код на главной был
 * НАБРАН руками, а обещание «пример из дерева» держалось на честном слове.
 * Теперь сборка вырезает названное объявление из названного файла и подставляет
 * на место метки `@@пример:КЛЮЧ@@`. Переименовали функцию или переехал файл —
 * сборка отказывает с именем, а не печатает устаревший код.
 *
 * `объявление` — имя в ёлочках без ёлочек. `ключ` — то, что стоит в метке.
 * `подпись` печатается строкой под блоком, и путь к файлу сборка дописывает
 * сама: набранный руками путь протухает молча, а этот — нет.
 */
export const ПРИМЕРЫ_НА_ГЛАВНОЙ = [
  {
    ключ: 'факториал',
    файл: 'docs/examples/rosetta/factorial.flang',
    объявление: 'Факториал',
    подпись: 'Взято из дерева целиком, знак в знак —',
  },
  {
    ключ: 'factorial',
    файл: 'docs/examples/rosetta/factorial-english.flang',
    объявление: 'Factorial',
    подпись: 'Taken from the tree verbatim —',
  },
  /* Сборка сообщения протокола PostgreSQL. Пример выбран не за красоту: на нём
     разом видно постусловие с именем, пример внутри функции и то, что вся
     работа с байтами — обычная тотальная функция. Русская и английская записи
     ссылаются на ОДНО объявление: английской поверхности у этого модуля нет, и
     выдумывать вторую копию значило бы завести расхождение на пустом месте. */
  {
    ключ: 'простой-запрос',
    файл: 'flang/stdlib/postgres.flang',
    объявление: 'Простой запрос',
    подпись: 'Взято из дерева целиком, знак в знак —',
  },
  {
    ключ: 'simple-query',
    файл: 'flang/stdlib/postgres.flang',
    объявление: 'Простой запрос',
    подпись: 'Taken from the tree verbatim —',
  },
];

