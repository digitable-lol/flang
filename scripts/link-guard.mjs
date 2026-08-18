#!/usr/bin/env node
// Сторож ссылок: ни одна ссылка на файл дерева не имеет права вести в никуда.
//
//   node scripts/link-guard.mjs          проверить всё дерево
//   node scripts/link-guard.mjs --list   заодно напечатать, сколько ссылок откуда
//
// Зачем отдельно от сборки сайта. `docs/site/build.mjs --check` проверяет ссылки
// на СТРАНИЦАХ САЙТА — а это 107 документов из 1509 файлов дерева. Ссылки в
// README, в шапках проверок, в спеках и в заметках, которые на сайт не попадают,
// не проверял никто. Переименование файла ломает их молча: имя пропадает, ссылка
// остаётся, и находит её читатель, а не дерево.
//
// Повод завести сторожа — переименование транслитных имён в английские слова
// 17 августа 2026: 106 файлов сменили имя за один заход. Без этой проверки цена
// такого захода — россыпь мёртвых ссылок, которую никто не считает.
//
// Что считается ссылкой: `[текст](путь)` в Markdown. Внешние (http, mailto),
// якоря (`#…`) и ссылки базы знаний `[[слаг]]` — не наше дело: первые проверить
// нельзя без сети, последние проверяет сборка сайта.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const СПИСОК = process.argv.includes('--list');

// -z и quotepath=false: в дереве есть пути кириллицей (`docs/спецификации/…`),
// и обычный `git ls-files` отдаёт их в кавычках с восьмеричными escape.
const файлы = execSync('git -c core.quotepath=false ls-files -z -- "*.md"', { cwd: КОРЕНЬ, encoding: 'utf8' })
  .split('\0')
  .filter((ф) => ф && !ф.startsWith('docs/site/out/'));

// Ссылка вида [текст](цель). Цель без пробелов — путь; с пробелами и кавычками
// внутри — заголовок ссылки, его отрезаем.
const ССЫЛКА = /\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const ВНЕШНЯЯ = /^(?:https?:|mailto:|ftp:|#|<)/;

const беды = [];
let всего = 0;

for (const файл of файлы) {
  const текст = readFileSync(join(КОРЕНЬ, файл), 'utf8');
  // Ссылки внутри блоков кода — пример, а не ссылка.
  const безКода = текст.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const м of безКода.matchAll(ССЫЛКА)) {
    const цель = м[1].split('#')[0];
    if (!цель || ВНЕШНЯЯ.test(м[1])) continue;
    всего++;
    const откуда = dirname(файл);
    // Страницы сайта (`getting-started.html` и прочие) живут только в собранном
    // виде — их проверяет docs/site/build.mjs, здесь пропускаем.
    if (цель.endsWith('.html') && !цель.includes('/')) continue;
    const варианты = [join(откуда, цель), цель, join('docs', цель)];
    if (!варианты.some((в) => existsSync(join(КОРЕНЬ, в)))) {
      беды.push(`${файл}: ссылка в никуда → ${цель}`);
    }
  }
}

if (СПИСОК) console.log(`Файлов Markdown: ${файлы.length}, ссылок на дерево: ${всего}.`);

if (беды.length) {
  console.error('Сторож ссылок ОТКАЗЫВАЕТ. Беды:');
  for (const б of беды) console.error('  · ' + б);
  console.error(`\nвсего битых ссылок: ${беды.length}`);
  process.exit(1);
}

console.log(`Сторож ссылок: файлов ${файлы.length}, ссылок ${всего}, битых 0.`);
