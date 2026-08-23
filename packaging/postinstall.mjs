#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Сборка двоичного компилятора при установке пакета.
 *
 * ЗАЧЕМ. До 20 августа 2026 человек, поставивший язык через npm, получал НЕ ту
 * программу, что человек, поставивший через brew: из npm приезжала вторая
 * реализация на JavaScript. Разошлись они на 54 вызовах из 59 — замер
 * `packaging/sverka-ustanovok.flang`, ветка `vypusk/npm-dvoichnyy`. Пакет обязан
 * везти ТОТ ЖЕ компилятор, а не вторую его реализацию.
 *
 * ЧТО ЗДЕСЬ ПРОИСХОДИТ. В пакете лежит `bootstrap/` — компилятор, напечатанный
 * в самодостаточный C99, тот же самый, что уезжает в релизный архив (печатает
 * их одна функция, см. шапку `scripts/vypusk-v-c.flang`). Этот скрипт зовёт
 * `make` и кладёт собранный бинарник в `dvoichnyy/flang` внутри пакета.
 *
 * ПОЧЕМУ ИМЕННО `dvoichnyy/` РЯДОМ С КОРНЕМ ПАКЕТА, А НЕ ГДЕ УГОДНО. Бинарнику
 * для `emit --target c --out` нужны ИСХОДНИКИ рантайма C, и ищет он их сам —
 * `dirname(каталог бинарника)/flang/src/emit/c` (`emit_runtime_dir` в
 * `flang/src/emit/c/flang_repl.c`). Из `<пакет>/dvoichnyy/flang` это ровно
 * `<пакет>/flang/src/emit/c`, который в пакете есть. Положи бинарник на уровень
 * выше или ниже — и печать в C перестала бы работать молча.
 *
 * ПОЧЕМУ СБОРКА ИДЁТ ВО ВРЕМЕННОМ КАТАЛОГЕ. `make` кладёт объектные файлы рядом
 * с исходниками; это 60 МБ мусора в `node_modules` и грязное дерево при работе в
 * репозитории. Во временный каталог копируются семь файлов, там собирается, и
 * наружу выходит один бинарник.
 *
 * ПОЧЕМУ ОТКАЗ НЕ РОНЯЕТ УСТАНОВКУ. `npm install`, упавший на postinstall,
 * оставляет пакет наполовину поставленным, и человек не получает НИЧЕГО — ни
 * языкового сервера, ни печати в семь целей, которые Node даёт и без бинарника.
 * Поэтому отказ здесь громкий, но не смертельный: сообщение называет причину и
 * что делать, а `flang` потом откажется работать с тем же текстом.
 *
 * Ключи среды:
 *   FLANG_BEZ_SBORKI=1   не собирать вовсе (для окружений, где нужен только Node)
 *   CC=…                 чем собирать (по умолчанию `cc`)
 *   MAKE=…               чем звать make (по умолчанию `make`)
 */
import { spawnSync } from "node:child_process"
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { availableParallelism, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const корень = dirname(dirname(fileURLToPath(import.meta.url)))
const источники = join(корень, "bootstrap")
const каталогБинарника = join(корень, "dvoichnyy")
const бинарник = join(каталогБинарника, process.platform === "win32" ? "flang.exe" : "flang")

/** Есть ли программа в PATH. Проверяется запуском, а не поиском по каталогам. */
const естьВПути = (программа) =>
  spawnSync(программа, ["--version"], { stdio: "ignore" }).error === undefined

const сказать = (строки) => process.stderr.write(`${строки.join("\n")}\n`)

/*
 * Единственный текст отказа на весь пакет. Он же печатается запускателем, когда
 * бинарника нет: два разных текста про одну беду человек читает как две беды.
 * Меняется только первая строка — та, что называет ПРИЧИНУ.
 *
 * ВАЖНО ПРО ВИДИМОСТЬ. При установке этот текст человек, скорее всего, НЕ
 * УВИДИТ: npm начиная с 7-й версии прячет вывод удавшихся скриптов установки
 * (показывает его `npm install --foreground-scripts`). Проверено на npm 11.19.0.
 * Поэтому настоящая страховка — не здесь, а в запускателе: тот же текст
 * печатается при первом же вызове `flang`, и там его не спрятать.
 */
export const ОТКАЗ = (почему) => [
  "",
  `flang: двоичный компилятор не собран — ${почему}.`,
  "",
  "  Пакет @digitable-lol/flang везёт компилятор исходником на C99 и собирает",
  "  его при установке — как это делают sass и node-gyp. Нужны две вещи: C99",
  "  и make.",
  "",
  "  Что делать:",
  "    Debian/Ubuntu   sudo apt install build-essential",
  "    Fedora/RHEL     sudo dnf install gcc make",
  "    Alpine          apk add build-base",
  "    macOS           xcode-select --install",
  "    затем           npm rebuild @digitable-lol/flang",
  "",
  "  Готовый бинарник без сборки: https://github.com/digitable-lol/flang/releases",
  "  или brew install digitable-lol/tap/flang",
  "",
]

export function собрать() {
  if (process.env.FLANG_BEZ_SBORKI === "1") return { сделано: false, почему: "FLANG_BEZ_SBORKI=1" }
  if (!existsSync(join(источники, "Makefile"))) {
    return { сделано: false, почему: "в пакете нет bootstrap/Makefile" }
  }
  const компилятор = process.env.CC ?? "cc"
  const make = process.env.MAKE ?? "make"
  for (const [программа, чего] of [
    [компилятор, компилятор],
    [make, make],
  ]) {
    if (!естьВПути(программа)) {
      сказать(ОТКАЗ(`в PATH нет «${чего}»`))
      return { сделано: false, почему: `нет ${чего}` }
    }
  }

  const начало = Date.now()
  const стройка = mkdtempSync(join(tmpdir(), "flang-sborka-"))
  try {
    cpSync(источники, стройка, { recursive: true })
    const потоков = Math.max(1, Math.min(8, availableParallelism()))
    const итог = spawnSync(make, [`-j${потоков}`, "flang"], {
      cwd: стройка,
      stdio: "inherit",
      env: { ...process.env, CC: компилятор },
    })
    if (итог.status !== 0) {
      сказать([
        "",
        "flang: сборка двоичного компилятора не удалась.",
        "",
        `  Собирали: ${make} -j${потоков} flang  (CC=${компилятор})`,
        "  Вывод компилятора — выше. Сообщите его в",
        "  https://github.com/digitable-lol/flang/issues",
        "",
        "  Пока не собрано, команды flang откажут. Готовый бинарник:",
        "  https://github.com/digitable-lol/flang/releases",
        "",
      ])
      return { сделано: false, почему: `make вернул ${итог.status}` }
    }
    mkdirSync(каталогБинарника, { recursive: true })
    copyFileSync(join(стройка, "flang"), бинарник)
    const секунд = (Date.now() - начало) / 1000
    const мегабайт = statSync(бинарник).size / 1024 / 1024
    сказать([
      `flang: двоичный компилятор собран за ${секунд.toFixed(1)} с, ${мегабайт.toFixed(1)} МБ — ${бинарник}`,
    ])
    return { сделано: true, секунд, байт: statSync(бинарник).size }
  } finally {
    rmSync(стройка, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) собрать()
