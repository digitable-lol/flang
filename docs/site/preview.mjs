#!/usr/bin/env node
// Предпросмотр сайта одной самодостаточной страницей.
//
//   node docs/site/preview.mjs > /куда/предпросмотр.html
//
// Зачем отдельно от build.mjs: настоящий сайт — 84 страницы со ссылками между
// файлами, и показать его можно только выкачав. Предпросмотр показывает три
// написанные от руки страницы одним файлом, с тем же разборщиком и тем же
// оформлением, что и настоящий сайт, — иначе он показывал бы не то.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { разобрать, экранировать } from './markdown.mjs';
import { РАЗДЕЛЫ, БАЗА_ЗНАНИЙ } from './sitemap.mjs';

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const читать = (п) => readFileSync(join(КОРЕНЬ, п), 'utf8');

const ПОКАЗЫВАЕМ = [
  { якорь: 'chto-takoe', из: 'docs/site/index.md', имя: 'Что такое flang' },
  { якорь: 'nachalo', из: 'docs/site/getting-started.md', имя: 'Первая программа' },
  { якорь: 'dokazatelstva', из: 'docs/site/proofs.md', имя: 'Зачем и как' },
];

const адресаПоказанных = new Map([
  ['index.html', '#chto-takoe'],
  ['getting-started.html', '#nachalo'],
  ['proofs.html', '#dokazatelstva'],
]);

// Боковое меню: настоящая карта сайта. Страницы, которых нет в предпросмотре,
// показаны неактивными — врать про объём нельзя, их 84.
function боковое() {
  const части = [];
  for (const раздел of РАЗДЕЛЫ) {
    части.push(`<div class="nav-group"><div class="nav-title">${экранировать(раздел.имя)}</div><ul>`);
    for (const с of раздел.страницы) {
      const якорь = адресаПоказанных.get(с.адрес);
      части.push(
        якорь
          ? `<li><a href="${якорь}">${экранировать(с.имя)}</a></li>`
          : `<li><span class="nav-off" title="есть в собранном сайте">${экранировать(с.имя)}</span></li>`,
      );
    }
    части.push('</ul></div>');
  }
  части.push(
    `<div class="nav-group"><div class="nav-title">${экранировать(БАЗА_ЗНАНИЙ.имяРаздела)}</div>` +
      `<ul><li><span class="nav-off">Указатель</span></li><li class="nav-count">62 заметки</li></ul></div>`,
  );
  return части.join('');
}

const разделы = ПОКАЗЫВАЕМ.map((п) => {
  const { html } = разобрать(читать(п.из));
  // Ссылки между страницами превращаем в переходы внутри одного файла;
  // ссылки на непоказанные страницы обезвреживаем, чтобы не вести в никуда.
  const внутри = html.replace(/href="([a-z0-9-]+\.html)"/g, (совпало, адрес) => {
    const якорь = адресаПоказанных.get(адрес);
    return якорь ? `href="${якорь}"` : 'class="link-off" title="есть в собранном сайте" href="#"';
  });
  return `<section id="${п.якорь}">${внутри}</section>`;
}).join('\n<hr class="page-break">\n');

const стили = читать('docs/site/style.css');

process.stdout.write(`<title>Документация flang</title>
<style>
${стили}
/* Только для предпросмотра: одна страница вместо 84 файлов. */
body { margin: 0; }
.nav-off { display: block; padding: .26rem .5rem; margin-left: -.5rem; color: var(--faint); cursor: default; }
.link-off { color: var(--muted); text-decoration: underline dotted; cursor: help; }
.page-break { border: none; border-top: 1px solid var(--rule); margin: 4rem 0; }
.preview-note {
  background: var(--accent-bg); border-left: 3px solid var(--accent);
  padding: .9rem 1.1rem; margin: 0 0 2rem; font-size: .88rem; color: var(--muted);
}
.preview-note strong { color: var(--ink); }
.content section + section { margin-top: 0; }
</style>
<a class="skip" href="#soderzhanie">К содержанию</a>
<header class="top">
  <span class="brand">flang</span>
  <span class="tagline">язык, в котором спецификация исполняется</span>
  <button class="theme" type="button" aria-label="Сменить тему">◐</button>
</header>
<div class="shell">
  <nav class="side" aria-label="Разделы">${боковое()}</nav>
  <main id="soderzhanie" class="content">
    <p class="preview-note"><strong>Это предпросмотр.</strong> Здесь три страницы, написанные от руки; в собранном сайте их 84, включая 62 заметки базы знаний. Пункты меню без ссылки есть в собранном сайте — соберите его командой <code>npm run site</code>.</p>
    ${разделы}
  </main>
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
`);
