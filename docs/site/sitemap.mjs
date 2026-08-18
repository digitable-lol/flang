// Карта сайта: какие страницы есть, из чего собираются, как называются.
//
// Один список — один источник правды. Добавить страницу значит дописать строку
// сюда; забыть вписать в оглавление невозможно, потому что оглавление строится
// отсюда же.
//
// Поле `из` — путь от корня репозитория. Если файла нет, сборка отказывает с
// именем — молча пропускать страницу нельзя, иначе сайт худеет незаметно.

export const РАЗДЕЛЫ = [
  {
    имя: 'Начало',
    страницы: [
      { адрес: 'index.html', имя: 'Что такое flang', из: 'docs/site/index.md' },
      { адрес: 'getting-started.html', имя: 'Первая программа', из: 'docs/site/getting-started.md' },
    ],
  },
  {
    // Раздел стоит вторым намеренно: заходящий второй раз ищет не «что это
    // такое», а «что приехало с прошлого раза», и искать это в конце списка
    // ему пришлось бы дольше, чем читать.
    имя: 'Что изменилось',
    страницы: [
      { адрес: 'changelog.html', имя: 'Что изменилось', из: 'docs/site/changelog.md' },
      { адрес: 'journal.html', имя: 'Журнал изменений', из: 'CHANGELOG.md' },
    ],
  },
  {
    имя: 'Язык',
    страницы: [
      { адрес: 'spec.html', имя: 'Спецификация языка', из: 'flang/SPEC.md' },
    ],
  },
  {
    имя: 'Доказательства',
    страницы: [
      { адрес: 'proofs.html', имя: 'Зачем и как', из: 'docs/site/proofs.md' },
      { адрес: 'spec-proof.html', имя: 'Спецификация ядра', из: 'flang/proof/SPEC.md' },
      { адрес: 'overview.html', имя: 'Что доказано, а что проверено', из: 'docs/overview.ru.md' },
    ],
  },
  {
    имя: 'Почему так',
    страницы: [
      { адрес: 'single-source.html', имя: 'Один источник правды', из: 'docs/rukovodstvo/single-source.ru.md' },
      { адрес: 'totality.html', имя: 'Что даёт признак «тотальная»', из: 'docs/rukovodstvo/totality.ru.md' },
      { адрес: 'two-implementations.html', имя: 'Две реализации и неподвижная точка', из: 'docs/rukovodstvo/two-implementations.ru.md' },
      { адрес: 'developing.html', имя: 'Развитие языка', из: 'docs/rukovodstvo/developing.ru.md' },
      { адрес: 'limits.html', имя: 'Известные ограничения', из: 'docs/rukovodstvo/limits.ru.md' },
    ],
  },
  {
    имя: 'Устройство',
    страницы: [
      { адрес: 'project-layout.html', имя: 'Раскладка репозитория', из: 'docs/rukovodstvo/project-layout.ru.md' },
    ],
  },
  {
    имя: 'Категорная поверхность',
    страницы: [
      { адрес: 'spec-cat.html', имя: 'Категории и функторы', из: 'flang/cat/SPEC.md' },
      { адрес: 'spec-conc.html', имя: 'Процессы и отказоустойчивость', из: 'flang/conc/SPEC.md' },
    ],
  },
  {
    имя: 'Замеры',
    страницы: [
      { адрес: 'benchmark-speed.html', имя: 'Скорость против Python и Node', из: 'docs/benchmark-speed.md' },
      { адрес: 'benchmark-proof-cost.html', имя: 'Цена доказательства против тестов', из: 'docs/benchmark-proof-cost.md' },
      { адрес: 'benchmark-processes.html', имя: 'Сколько процессов тянет планировщик', из: 'docs/scheduler-benchmark.md' },
      { адрес: 'memory.html', имя: 'Память и области', из: 'docs/memory-and-regions.md' },
      { адрес: 'modules.html', имя: 'Модульность и пакеты', из: 'docs/modularity-and-packages.md' },
      { адрес: 'wasm.html', имя: 'WebAssembly через C', из: 'docs/wasm-via-c.md' },
    ],
  },
];

/** Каталог базы знаний. Страницы оттуда собираются сами, по файлам. */
export const БАЗА_ЗНАНИЙ = {
  каталог: 'docs/zettel',
  указатель: 'docs/zettel/README.md',
  адресУказателя: 'knowledge.html',
  имяРаздела: 'База знаний',
  // Имя страницы заметки: knowledge-<слаг>.html. Так же их называет markdown.mjs
  // при разборе ссылок [[слаг]] — если менять, менять в обоих местах.
  адресЗаметки: (слаг) => `knowledge-${слаг}.html`,
};

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
  'izmeneniya.html': 'changelog.html',
  'zhurnal.html': 'journal.html',
  'dokazatelstva.html': 'proofs.html',
  'obzor.html': 'overview.html',
  'odin-istochnik.html': 'single-source.html',
  'totalnost.html': 'totality.html',
  'dve-realizacii.html': 'two-implementations.html',
  'razvitie.html': 'developing.html',
  'ogranicheniya.html': 'limits.html',
  'raskladka.html': 'project-layout.html',
  'zamer-skorosti.html': 'benchmark-speed.html',
  'zamer-tseny.html': 'benchmark-proof-cost.html',
  'zamer-processov.html': 'benchmark-processes.html',
  'pamyat.html': 'memory.html',
  'moduli.html': 'modules.html',
  'znanie.html': 'knowledge.html',
};

/** Живые примеры кода на главной. Берутся из дерева, а не переписываются. */
export const ПРИМЕРЫ_НА_ГЛАВНОЙ = [
  {
    файл: 'flang/examples/rosetta/factorial.flang',
    подпись: 'Факториал с доказанной завершаемостью',
  },
];

/**
 * Переезды страниц базы знаний: старый адрес `znanie-<транслит>.html` → новый
 * `knowledge-<английские слова>.html`. Заполняется вместе с переименованием
 * заметок; пустой список законен — значит, ничего ещё не переезжало.
 */
export const ПЕРЕЕЗДЫ_ЗАМЕТОК = {};
