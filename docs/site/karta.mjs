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
      { адрес: 'nachalo.html', имя: 'Первая программа', из: 'docs/site/nachalo.md' },
    ],
  },
  {
    имя: 'Язык',
    страницы: [
      { адрес: 'yazyk.html', имя: 'Справка по языку', из: 'docs/rukovodstvo/language.ru.md' },
      { адрес: 'primery.html', имя: 'Примеры', из: 'docs/rukovodstvo/examples.ru.md' },
      { адрес: 'utility.html', имя: 'Исполняемые утилиты', из: 'docs/rukovodstvo/executable-utilities.ru.md' },
      { адрес: 'spec.html', имя: 'Спецификация языка', из: 'flang/SPEC.md' },
    ],
  },
  {
    имя: 'Доказательства',
    страницы: [
      { адрес: 'dokazatelstva.html', имя: 'Зачем и как', из: 'docs/site/dokazatelstva.md' },
      { адрес: 'spec-proof.html', имя: 'Спецификация ядра', из: 'flang/proof/SPEC.md' },
      { адрес: 'obzor.html', имя: 'Что доказано, а что проверено', из: 'docs/overview.ru.md' },
    ],
  },
  {
    имя: 'Почему так',
    страницы: [
      { адрес: 'odin-istochnik.html', имя: 'Один источник правды', из: 'docs/rukovodstvo/single-source.ru.md' },
      { адрес: 'totalnost.html', имя: 'Что даёт признак «тотальная»', из: 'docs/rukovodstvo/totality.ru.md' },
      { адрес: 'dve-realizacii.html', имя: 'Две реализации и неподвижная точка', из: 'docs/rukovodstvo/two-implementations.ru.md' },
      { адрес: 'razvitie.html', имя: 'Развитие языка', из: 'docs/rukovodstvo/developing.ru.md' },
      { адрес: 'ogranicheniya.html', имя: 'Известные ограничения', из: 'docs/rukovodstvo/limits.ru.md' },
    ],
  },
  {
    имя: 'Устройство',
    страницы: [
      { адрес: 'kak-rabotaet.html', имя: 'Как это работает', из: 'docs/rukovodstvo/how-it-works.ru.md' },
      { адрес: 'arhitektura.html', имя: 'Архитектура', из: 'docs/rukovodstvo/architecture.md' },
      { адрес: 'raskladka.html', имя: 'Раскладка репозитория', из: 'docs/rukovodstvo/project-layout.ru.md' },
      { адрес: 'zachem.html', имя: 'Зачем и встраивание', из: 'docs/rukovodstvo/why-and-integration.ru.md' },
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
      { адрес: 'zamer-skorosti.html', имя: 'Скорость против Python и Node', из: 'docs/zamer-skorosti.md' },
      { адрес: 'zamer-tseny.html', имя: 'Цена доказательства против тестов', из: 'docs/zamer-tseny-dokazatelstva.md' },
      { адрес: 'zamer-processov.html', имя: 'Сколько процессов тянет планировщик', из: 'docs/planirovshchik-zamer.md' },
      { адрес: 'pamyat.html', имя: 'Память и области', из: 'docs/pamyat-i-regiony.md' },
      { адрес: 'moduli.html', имя: 'Модульность и пакеты', из: 'docs/modulnost-i-pakety.md' },
      { адрес: 'wasm.html', имя: 'WebAssembly через C', из: 'docs/wasm-cherez-c.md' },
    ],
  },
];

/** Каталог базы знаний. Страницы оттуда собираются сами, по файлам. */
export const БАЗА_ЗНАНИЙ = {
  каталог: 'docs/zettel',
  указатель: 'docs/zettel/README.md',
  адресУказателя: 'znanie.html',
  имяРаздела: 'База знаний',
  // Имя страницы заметки: znanie-<слаг>.html. Так же их называет markdown.mjs
  // при разборе ссылок [[слаг]] — если менять, менять в обоих местах.
  адресЗаметки: (слаг) => `znanie-${слаг}.html`,
};

/** Живые примеры кода на главной. Берутся из дерева, а не переписываются. */
export const ПРИМЕРЫ_НА_ГЛАВНОЙ = [
  {
    файл: 'flang/examples/rosetta/factorial.flang',
    подпись: 'Факториал с доказанной завершаемостью',
  },
];
