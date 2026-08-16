#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Пиковая память на тех же пяти задачах.
 *
 * Меряется `/usr/bin/time -v` — «Maximum resident set size», то есть то, что
 * процесс реально занял у системы. Память здесь не менее важна времени: арена
 * рантайма не отдаёт НИЧЕГО до конца вызова, и это видно не в процентах, а в
 * разах.
 *
 * Запуск: node benchmarks/zamer-skorosti/pamyat.mjs КАТАЛОГ-СБОРКИ
 */
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const программы = fileURLToPath(new URL("./programs/", import.meta.url))
const сборка = process.argv[2]
if (сборка === undefined) {
  process.stderr.write("нужен каталог сборки\n")
  process.exit(2)
}

const ЗАДАЧИ = [
  { имя: "коллатц", размер: 50000, фн: "Коллатц" },
  { имя: "нод", размер: 300000, фн: "НОД обычный счёт" },
  { имя: "сортировка", размер: 100000, фн: "Сортировка обычная" },
  { имя: "дерево", размер: 100000, фн: "Обход дерева" },
  { имя: "строки", размер: 18, фн: "Разбор строк" },
]

/*
 * `env` между `time` и программой — не украшение. Без него `/usr/bin/time`
 * отдаёт по напечатанному бинарнику ноль: расчёт идёт на отдельном потоке с
 * явно заданным стеком, и ru_maxrss до `time` не доезжает. С лишним exec'ом
 * доезжает, и число сходится с тем, что показывает `/usr/bin/time -v` на
 * задачах, где оно и так было ненулевым. Ставится всем участникам одинаково.
 */
function пик(команда, аргс, вход) {
  const итог = spawnSync("/usr/bin/time", ["-f", "%M", "env", команда, ...аргс], {
    input: вход,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, LC_ALL: "C.UTF-8" },
  })
  const строки = (итог.stderr ?? "").trim().split("\n")
  const кибибайт = Number(строки[строки.length - 1])
  return Math.round((кибибайт / 1024) * 10) / 10
}

const таблица = {}
for (const з of ЗАДАЧИ) {
  const запрос = `{"fn":"${з.фн}","args":[{"n":"${з.размер}"}]}\n`
  таблица[`${з.имя} (${з.размер})`] = {
    "flang, МиБ": пик(`${сборка}/base/flang_cli`, ["--json"], запрос),
    "эталон-c, МиБ": пик(`${сборка}/etalon`, [з.имя, String(з.размер)], ""),
    "python, МиБ": пик("python3", [`${программы}zadachi.py`, з.имя, String(з.размер)], ""),
    "node, МиБ": пик("node", [`${программы}zadachi.mjs`, з.имя, String(з.размер)], ""),
  }
}

process.stdout.write(`${JSON.stringify(таблица, null, 2)}\n`)
