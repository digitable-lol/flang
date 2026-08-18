#!/usr/bin/env node
// Сборка сайта документации flang.
//
//   node docs/site/build.mjs            собрать в docs/site/out
//   node docs/site/build.mjs --check    собрать и проверить ссылки, не записывая
//
// Зависимостей нет ни одной — намеренно. В этой среде `node_modules` ставится
// не всегда, и сайт, который не собирается без интернета, бесполезен ровно
// тогда, когда нужен.
//
// Сборка ОТКАЗЫВАЕТ, а не предупреждает, если: исходного файла нет; ссылка ведёт
// в никуда; заметка базы знаний не вписана в указатель. Молчаливое ухудшение —
// то, ради чего этот проект вообще существует.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { разобрать, экранировать } from './markdown.mjs';
import { РАЗДЕЛЫ, БАЗА_ЗНАНИЙ, ПРИМЕРЫ_НА_ГЛАВНОЙ, ПЕРЕЕЗДЫ, ПЕРЕЕЗДЫ_ЗАМЕТОК } from './sitemap.mjs';

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ВЫХОД = join(КОРЕНЬ, 'docs', 'site', 'out');
const ТОЛЬКО_ПРОВЕРКА = process.argv.includes('--check');

const беды = [];
const читать = (путь) => {
  const полный = join(КОРЕНЬ, путь);
  if (!existsSync(полный)) {
    беды.push(`нет исходного файла: ${путь}`);
    return null;
  }
  return readFileSync(полный, 'utf8');
};

// ── Заголовок страницы берётся из первого заголовка первого уровня ──────────
const первыйЗаголовок = (текст) => {
  const м = /^#\s+(.+)$/m.exec(текст || '');
  return м ? м[1].trim().replace(/`/g, '') : null;
};

// ── Сбор страниц ────────────────────────────────────────────────────────────
const страницы = [];

for (const раздел of РАЗДЕЛЫ) {
  for (const с of раздел.страницы) {
    const исходник = читать(с.из);
    if (исходник === null) continue;
    страницы.push({ ...с, раздел: раздел.имя, исходник });
  }
}

// База знаний: указатель плюс страница на каждую заметку
const заметки = [];
{
  const каталог = join(КОРЕНЬ, БАЗА_ЗНАНИЙ.каталог);
  if (!existsSync(каталог)) {
    беды.push(`нет каталога базы знаний: ${БАЗА_ЗНАНИЙ.каталог}`);
  } else {
    const указатель = читать(БАЗА_ЗНАНИЙ.указатель);
    if (указатель !== null) {
      страницы.push({
        адрес: БАЗА_ЗНАНИЙ.адресУказателя,
        имя: 'Указатель',
        раздел: БАЗА_ЗНАНИЙ.имяРаздела,
        исходник: указатель,
      });
    }
    for (const файл of readdirSync(каталог).sort()) {
      if (!файл.endsWith('.md') || файл === 'README.md') continue;
      const слаг = basename(файл, '.md');
      const исходник = readFileSync(join(каталог, файл), 'utf8');
      const запись = {
        адрес: БАЗА_ЗНАНИЙ.адресЗаметки(слаг),
        имя: первыйЗаголовок(исходник) || слаг,
        раздел: БАЗА_ЗНАНИЙ.имяРаздела,
        исходник,
        слаг,
        заметка: true,
      };
      страницы.push(запись);
      заметки.push(запись);
      // Заметка, не вписанная в указатель, недостижима при чтении по ссылкам.
      if (указатель && !указатель.includes(`(${файл})`)) {
        беды.push(`заметка не вписана в указатель базы знаний: ${файл}`);
      }
    }
  }
}

const адресаСтраниц = new Set(страницы.map((с) => с.адрес));

// ── Разбор ──────────────────────────────────────────────────────────────────
for (const с of страницы) {
  const { html, оглавление, ссылки, беды: бедыРазбора } = разобрать(с.исходник);
  с.html = html;
  с.оглавление = оглавление;
  с.ссылки = ссылки;
  // Схема, которую не удалось разобрать, — такой же отказ, как битая ссылка.
  for (const б of бедыРазбора) беды.push(`${б} — на странице ${с.адрес}`);
  if (!с.имя) с.имя = первыйЗаголовок(с.исходник) || с.адрес;
}

// ── Проверка ссылок ─────────────────────────────────────────────────────────
// Ссылка базы знаний [[слаг]] обязана вести на существующую заметку.
// Ссылка на файл репозитория проверяется по дереву: документы ссылаются друг на
// друга путями, и они обязаны существовать, даже если страницы для них нет.
const слагиЗаметок = new Set(заметки.map((з) => з.слаг));
for (const с of страницы) {
  for (const ссылка of с.ссылки) {
    if (ссылка.вид === 'зеттель') {
      if (!слагиЗаметок.has(ссылка.цель)) беды.push(`битая ссылка базы знаний [[${ссылка.цель}]] на странице ${с.адрес}`);
      continue;
    }
    if (ссылка.цель.endsWith('.html')) {
      if (!адресаСтраниц.has(ссылка.цель)) беды.push(`ссылка на несуществующую страницу ${ссылка.цель} на ${с.адрес}`);
      continue;
    }
    // Ссылка на файл репозитория. Считаем от каталога САМОГО документа — иначе
    // проверка ругается на ссылку между соседями, стоит документам переехать
    // в подкаталог. Так и вышло, когда руководство уехало в docs/rukovodstvo.
    const свойКаталог = с.из ? dirname(с.из) : 'docs';
    const варианты = [
      join(свойКаталог, ссылка.цель),
      ссылка.цель,
      join('docs', ссылка.цель),
      join('docs', 'zettel', ссылка.цель),
    ];
    if (!варианты.some((в) => existsSync(join(КОРЕНЬ, в)))) {
      беды.push(`ссылка в никуда: ${ссылка.цель} на странице ${с.адрес}`);
    }
  }
}

// ── Оболочка страницы ───────────────────────────────────────────────────────
const порядокРазделов = [...РАЗДЕЛЫ.map((р) => р.имя), БАЗА_ЗНАНИЙ.имяРаздела];

function боковое(текущий) {
  const части = [];
  for (const имяРаздела of порядокРазделов) {
    const свои = страницы.filter((с) => с.раздел === имяРаздела && !с.заметка);
    if (!свои.length) continue;
    части.push(`<div class="nav-group"><div class="nav-title">${экранировать(имяРаздела)}</div><ul>`);
    for (const с of свои) {
      const текущая = с.адрес === текущий ? ' class="here"' : '';
      части.push(`<li><a${текущая} href="${с.адрес}">${экранировать(с.имя)}</a></li>`);
    }
    if (имяРаздела === БАЗА_ЗНАНИЙ.имяРаздела) {
      части.push(`<li class="nav-count">${заметки.length} заметок</li>`);
    }
    части.push('</ul></div>');
  }
  return части.join('');
}

function оглавлениеСправа(пункты) {
  if (пункты.length < 3) return '';
  return (
    '<nav class="toc" aria-label="На этой странице"><div class="toc-title">На этой странице</div><ul>' +
    пункты
      .map((п) => `<li class="lvl${п.уровень}"><a href="#${п.якорь}">${экранировать(п.текст)}</a></li>`)
      .join('') +
    '</ul></nav>'
  );
}

function страницаЦеликом(с) {
  const заголовок = `${с.имя} · flang`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${экранировать(заголовок)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip" href="#soderzhanie">К содержанию</a>
<header class="top">
  <a class="brand" href="index.html">flang</a>
  <span class="tagline">язык, в котором спецификация исполняется</span>
  <button class="theme" type="button" aria-label="Сменить тему">◐</button>
</header>
<div class="shell">
  <nav class="side" aria-label="Разделы">${боковое(с.адрес)}</nav>
  <main id="soderzhanie" class="content">${с.html}</main>
  ${оглавлениеСправа(с.оглавление)}
</div>
<footer class="bottom">
  <p>Собрано из репозитория командой <code>node docs/site/build.mjs</code>. Тексты живут в <code>docs/</code> — правьте их, а не эту страницу.</p>
</footer>
<script>
(function () {
  var к = document.documentElement;
  var с = localStorage.getItem('flang-tema');
  if (с) к.setAttribute('data-theme', с);
  document.querySelector('.theme').addEventListener('click', function () {
    var было = к.getAttribute('data-theme');
    var тёмная = было ? было === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var стало = тёмная ? 'light' : 'dark';
    к.setAttribute('data-theme', стало);
    localStorage.setItem('flang-tema', стало);
  });
})();
</script>
</body>
</html>
`;
}

// ── Запись ──────────────────────────────────────────────────────────────────
if (беды.length) {
  console.error('Сборка сайта ОТКАЗЫВАЕТ. Беды:');
  for (const б of беды) console.error('  · ' + б);
  console.error(`\nвсего бед: ${беды.length}`);
  process.exit(1);
}

// ── Переезды ────────────────────────────────────────────────────────────────
// Старый адрес обязан вести на СУЩЕСТВУЮЩУЮ страницу, иначе переезд — это
// вторая битая ссылка вместо одной. И он не имеет права занимать адрес живой
// страницы: тогда страница молча пропадёт под перенаправлением.
const переезды = { ...ПЕРЕЕЗДЫ, ...ПЕРЕЕЗДЫ_ЗАМЕТОК };
for (const [старый, новый] of Object.entries(переезды)) {
  if (!адресаСтраниц.has(новый)) беды.push(`переезд ${старый} ведёт в никуда: ${новый}`);
  if (адресаСтраниц.has(старый)) беды.push(`переезд ${старый} занимает адрес живой страницы`);
}

if (беды.length) {
  console.error('Сборка сайта ОТКАЗЫВАЕТ. Беды:');
  for (const б of беды) console.error('  · ' + б);
  console.error(`\nвсего бед: ${беды.length}`);
  process.exit(1);
}

if (ТОЛЬКО_ПРОВЕРКА) {
  console.log(`Проверка прошла: страниц ${страницы.length} (из них заметок ${заметки.length}), переездов ${Object.keys(переезды).length}, битых ссылок 0.`);
  process.exit(0);
}

rmSync(ВЫХОД, { recursive: true, force: true });
mkdirSync(ВЫХОД, { recursive: true });
for (const с of страницы) writeFileSync(join(ВЫХОД, с.адрес), страницаЦеликом(с));
copyFileSync(join(КОРЕНЬ, 'docs', 'site', 'style.css'), join(ВЫХОД, 'style.css'));

// Переезд — одна строка: и мгновенное перенаправление, и ссылка руками на
// случай, если <meta refresh> выключен.
for (const [старый, новый] of Object.entries(переезды)) {
  writeFileSync(join(ВЫХОД, старый), `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Страница переехала · flang</title><link rel="canonical" href="${новый}"><meta http-equiv="refresh" content="0; url=${новый}"></head><body><p>Страница переехала: <a href="${новый}">${новый}</a></p></body></html>\n`);
}

console.log(`Собрано: страниц ${страницы.length}, из них заметок базы знаний ${заметки.length}; переездов ${Object.keys(переезды).length}.`);
console.log(`Лежит в docs/site/out — откройте index.html.`);
