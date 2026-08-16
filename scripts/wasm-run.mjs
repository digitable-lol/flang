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
*/

import { WASI } from 'node:wasi';
import { readFile } from 'node:fs/promises';
import { argv, env, exit, cwd } from 'node:process';

const wasmPath = argv[2];
if (!wasmPath) {
  process.stderr.write('использование: node scripts/wasm-run.mjs модуль.wasm [аргументы...]\n');
  exit(2);
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
exit(wasi.start(instance) ?? 0);
