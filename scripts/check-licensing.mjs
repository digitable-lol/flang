#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
  Лицензионный гейт flang.

  В отличие от digitwm, it-tools и blender-mcp, этот репозиторий не форк:
  весь код здесь написан Digitable и выходит под BSD-2-Clause. Чужих шапок,
  в которые нельзя дописывать своё авторство, тут нет — поэтому критерий
  «SPDX-License-Identifier в каждом файле» выполним, и гейт его требует.

  Область — то, что уезжает пользователю. Идентификатор лицензии существует
  ради получателя: он говорит, на каких условиях тот держит файл в руках.
  У файла, который никогда не покидает репозиторий, получателя нет, поэтому
  проверяются ровно каталоги из поля `files` в package.json, за вычетом
  тестов (их `files` исключает явно) и вендоренных копий нашей же сборки.

  Что проверяется:

    1. Каждый публикуемый исходник несёт SPDX-License-Identifier и строку
       копирайта. Набор файлов выводится из дерева, а не записан списком:
       новый файл без шапки падает здесь, а не становится первым непомеченным.

    2. В `.ts` заголовок отделён от первого оператора пустой строкой. Правило
       не косметическое: `src/**` уезжает пользователю не сам, а скомпилированным
       в `dist/src`, и tsc, стирая `import type`, уносит прилипший к нему
       ведущий комментарий. Так восемь из двадцати модулей библиотеки уехали
       без SPDX, пока гейт смотрел на исходники и показывал зелёное.

    3. Идентификатор совпадает с полем `license` в package.json. Разойтись
       они могут молча: лицензию меняют в манифесте, а сотня шапок остаётся
       со старой, и файл на диске начинает противоречить пакету.

    4. LICENSE на месте, назван в package.json и несёт строку копирайта.

  Чего гейт НЕ покрывает: `dist/src/*.d.ts`. Ведущие комментарии tsc в файлы
  деклараций не переносит вовсе, и правкой исходника это не чинится — нужен
  шаг сборки, дописывающий шапку. Осталось открытым.

  Запуск:  node scripts/check-licensing.mjs
  Выходит с 1 и называет каждый файл, который не прошёл.
*/

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Каталоги из package.json `files`, содержащие исходный код.
const SHIPPED_DIRS = ['src/', 'flang/', 'tools/', 'examples/', 'editors/'];
const SUFFIXES = ['.ts', '.mjs', '.js', '.cjs'];

const read = relative => readFileSync(join(root, relative), 'utf8');

// Начало файла — там, где заголовок либо есть, либо его нет. Намеренно не
// «первые 2 КБ»: файл, который в своей же прозе цитирует строку
// SPDX-License-Identifier, проходил бы проверку и с удалённым настоящим
// заголовком. На двух других гейтах этой задачи так и вышло. Заголовок
// стоит наверху или это не заголовок.
const headerOf = relative => read(relative).split('\n').slice(0, 15).join('\n');

const isExcluded = relative =>
  relative.includes('/vendor/')
  || relative.includes('/test/')
  || relative.startsWith('test/')
  || /\.test\.(mjs|ts|js)$/.test(relative);

const tracked = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
  .split('\n')
  .filter(Boolean);

if (tracked.length === 0) {
  console.error('FAIL  git ls-files ничего не вернул — это не рабочая копия?');
  process.exit(1);
}

const manifest = JSON.parse(read('package.json'));
const declared = manifest.license;

const shipped = tracked.filter(
  relative =>
    SHIPPED_DIRS.some(dir => relative.startsWith(dir))
    && SUFFIXES.some(suffix => relative.endsWith(suffix))
    && !isExcluded(relative),
);

const failures = [];
const passed = [];

// 1 и 2. Шапка есть, и её идентификатор совпадает с манифестом.
const missing = [];
const mismatched = [];
const detached = [];

for (const relative of shipped) {
  const head = headerOf(relative);
  const match = head.match(/SPDX-License-Identifier:\s*(\S+)/);

  if (!match) {
    missing.push(`${relative}: нет SPDX-License-Identifier в начале файла`);
    continue;
  }
  if (match[1] !== declared) {
    mismatched.push(
      `${relative}: SPDX-License-Identifier: ${match[1]}, `
      + `а package.json объявляет ${declared}`,
    );
    continue;
  }
  if (!head.includes('SPDX-FileCopyrightText:')) {
    missing.push(`${relative}: нет строки SPDX-FileCopyrightText в начале файла`);
    continue;
  }

  // В .ts заголовок обязан быть отделён пустой строкой от первого оператора.
  // Причина не косметическая: tsc стирает `import type`, а вместе с
  // оператором уносит прилипший к нему ведущий комментарий. Так восемь из
  // двадцати модулей библиотеки уехали в dist/src без SPDX, пока гейт
  // смотрел на src и показывал зелёное. Пустая строка отцепляет заголовок,
  // и он переживает компиляцию.
  if (relative.endsWith('.ts')) {
    const lines = read(relative).split('\n');
    const last = lines.reduce(
      (found, line, index) => (line.includes('SPDX-') ? index : found),
      -1,
    );
    if (last >= 0 && lines[last + 1] !== undefined && lines[last + 1].trim() !== '') {
      detached.push(
        `${relative}: за SPDX-заголовком сразу идёт оператор. Нужна пустая `
        + `строка: иначе tsc, стирая \`import type\`, унесёт заголовок с ним, `
        + `и файл уедет в dist/src без лицензии`,
      );
    }
  }
}

if (missing.length > 0) {
  failures.push(...missing);
}
else {
  passed.push(`все ${shipped.length} публикуемых исходников несут SPDX-заголовок`);
}

if (detached.length > 0) {
  failures.push(...detached);
}
else if (missing.length === 0) {
  passed.push('заголовок в .ts отцеплён пустой строкой и переживает компиляцию в dist/src');
}

if (mismatched.length > 0) {
  failures.push(...mismatched);
}
else if (missing.length === 0) {
  passed.push(`идентификатор во всех шапках совпадает с package.json (${declared})`);
}

// 3. LICENSE на месте и согласован с манифестом.
if (!existsSync(join(root, 'LICENSE'))) {
  failures.push('LICENSE: файла нет, а package.json объявляет лицензию');
}
else {
  const license = read('LICENSE');
  if (!license.includes('Digitable')) {
    failures.push('LICENSE: пропала строка копирайта Digitable');
  }
  else if (declared === 'BSD-2-Clause' && !license.includes('BSD 2-Clause')) {
    failures.push(
      `LICENSE: package.json объявляет ${declared}, а текст LICENSE это не подтверждает`,
    );
  }
  else {
    passed.push('LICENSE на месте, с копирайтом и текстом заявленной лицензии');
  }
}

for (const name of passed) {
  console.log(`ok    ${name}`);
}
for (const failure of failures) {
  console.error(`FAIL  ${failure}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} нарушени(е/я) лицензионной разметки.`);
  process.exit(1);
}

console.log(`\n${passed.length} проверк(и) пройдено, ${shipped.length} файлов просмотрено, 0 отказов.`);
