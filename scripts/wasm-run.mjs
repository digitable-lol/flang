#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
  Прогонщик wasm-модулей WASI поверх `node:wasi`.

  Нужен потому, что напечатанный бэкендом C прогонщик (`flang_cli`), собранный
  в `wasm32-wasi`, — это не исполняемый файл операционной системы: запустить
  его может только среда, дающая ему WASI. Здесь такой средой служит сам Node:
  `node:wasi` реализует preview1, а `preopens` открывает модулю каталоги,
  потому что в WebAssembly файловой системы нет вовсе и модуль видит ровно то,
  что ему выдали.

  Использование:
    node scripts/wasm-run.mjs модуль.wasm [аргументы...]   # stdin → stdout

  Код возврата модуля становится кодом возврата этого процесса: сверка кодов
  отказа с обычной сборкой иначе была бы невозможна.

  FLANG_WASM_PAMYAT=1 — напечатать в stderr, до скольки доросла линейная память
  модуля. Это ЧЕСТНОЕ число для wasm, в отличие от RSS процесса: RSS меряет ещё
  и сам Node (полсотни мегабайт), а у модуля вся память — одна линейная область,
  и её размер виден прямо.
*/

import { WASI } from 'node:wasi';
import { readFile } from 'node:fs/promises';
import { argv, env, cwd } from 'node:process';

const wasmPath = argv[2];
if (!wasmPath) {
  process.stderr.write('использование: node scripts/wasm-run.mjs модуль.wasm [аргументы...]\n');
  process.exitCode = 2;
}

const wasi = new WASI({
  version: 'preview1',
  args: [wasmPath, ...argv.slice(3)],
  env: { ...env },
  /* Модуль видит корень и текущий каталог. Это не «песочница нараспашку»:
     список открытых каталогов задаётся здесь и модулем не расширяем. */
  preopens: { '/': '/', '.': cwd() },
  returnOnExit: true,
});

const module_ = await WebAssembly.compile(await readFile(wasmPath));
const instance = await WebAssembly.instantiate(module_, wasi.getImportObject());

/*
 * Код возврата ставится полем, а НЕ `process.exit()`, и это не стилистика.
 * Когда stdout — труба, Node пишет в неё асинхронно, а `process.exit()`
 * обрывает процесс, не дожидаясь слива: вывод обрезается в случайном месте.
 * Измерено на этом самом файле — 8 прогонов одного и того же модуля через
 * `execFileSync` дали 171819 байт пять раз и 158167, 163072, 166220 остальные
 * три, тогда как обычный бинарник давал 171819 все восемь раз. Обрыв был
 * дефектом ПРОГОНЩИКА и выглядел как расхождение wasm с обычной сборкой, то
 * есть ровно как то, что этот замер и должен был найти.
 */
process.exitCode = wasi.start(instance) ?? 0;

if (env.FLANG_WASM_PAMYAT === '1') {
  const memory = instance.exports.memory;
  const bytes = memory === undefined ? 0 : memory.buffer.byteLength;
  process.stderr.write(`линейная память wasm: ${bytes} байт (${(bytes / 1048576).toFixed(1)} МиБ)\n`);
}
