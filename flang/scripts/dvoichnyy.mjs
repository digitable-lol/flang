/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ЧЕМ СТОРОЖА ЧИТАЮТ `.flang` ПОСЛЕ УДАЛЕНИЯ РЕАЛИЗАЦИИ НА JAVASCRIPT.
 *
 * До 20 августа 2026 сторожа звали `parse` из `flang/src/parser.mjs` и читали
 * дерево в своём же процессе. Реализации на JavaScript больше нет — компилятор
 * один, двоичный, собранный из `bootstrap/`. Второй разбор `.flang` заводить
 * нельзя: он и есть то, что владелец велел убрать, и разойдётся с настоящим на
 * первой же правке языка.
 *
 * Поэтому здесь ровно один приём: СПРОСИТЬ ДВОИЧНЫЙ и прочитать его JSON.
 *
 *   flang ast <файл>                дерево, разобранное и СВЯЗАННОЕ
 *   flang check <файл> --proof --json   ведомость доказательств
 *   flang test <корпус> --json          прогон примеров числами
 *
 * ── Связывание, и почему из-за него нужна ВЫЧИТАЛКА ─────────────────────────
 *
 * `flang ast` отдаёт дерево ПОСЛЕ связывания: у файла с «использует … из "…"»
 * в `functions` лежат и чужие функции — те, что приехали из подключённых
 * файлов. Сторожу имён это испортило бы счёт (чужая функция посчиталась бы
 * столько раз, сколько файлов её подключили), а места указали бы на строки
 * ЧУЖОГО файла: собственных строк у приезжей функции в этом файле нет.
 *
 * Отделить своё от чужого можно точно, и без разбора: `legacy` того же дерева
 * содержит шапку модуля со списком подключений. Значит,
 *
 *     своё(Ф) = функции(дерево(Ф)) МИНУС ⋃ функции(дерево(П)) по подключениям П
 *
 * — и это верно ровно потому, что дерево подключённого файла тоже связано:
 * оно уже содержит всё, что тот файл притащил за собой. Столкновение имён
 * здесь не мешает: связывание его само и отвергает.
 *
 * ── Цена ───────────────────────────────────────────────────────────────────
 *
 * Один вызов — один процесс. Запуск двоичного стоит 7 мс, разбор — от 5 мс на
 * коротком файле до 600 мс на `flang/stdlib/lists.flang` (758 строк). Разбор и
 * есть цена, и она та же, что была у `parse`. Поэтому здесь ПАМЯТЬ на путь:
 * `flang/stdlib/lists.flang` подключают 30 файлов, и без памяти сторож имён
 * разбирал бы его тридцать раз.
 */
import { spawnSync } from "node:child_process"
import { cpus, tmpdir } from "node:os"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const КОРЕНЬ = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

/** Где двоичный. `FLANG_BINARY` — для прогона против другой сборки. */
export function путьДвоичного() {
  const назван = process.env.FLANG_BINARY
  if (назван) return назван
  const свой = join(КОРЕНЬ, "bootstrap/flang")
  if (existsSync(свой)) return свой
  throw new Error(
    `двоичного нет: ${свой}. Соберите — make -C bootstrap -j8 — или назовите свой в FLANG_BINARY.`,
  )
}

/** Позвать двоичный. Возвращает `{код, вывод, ошибки}` и НЕ бросает на коде ≠ 0. */
export function позвать(аргументы, настройки = {}) {
  const итог = spawnSync(путьДвоичного(), аргументы, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
    cwd: настройки.каталог ?? КОРЕНЬ,
    input: настройки.вход,
    timeout: настройки.предел ?? 30 * 60 * 1000,
  })
  if (итог.error) throw итог.error
  return { код: итог.status ?? 1, вывод: итог.stdout ?? "", ошибки: итог.stderr ?? "" }
}

const памятьДеревьев = new Map()
const памятьВедомостей = new Map()

/**
 * ПРОГРЕВ: разобрать много файлов СРАЗУ, в несколько процессов.
 *
 * Один `flang ast` на `flang/self/emit-c.flang` идёт десятки секунд: файл
 * подключает половину компилятора, и связанное дерево выходит в тридцать тысяч
 * строк. Сторожу имён таких файлов 226, и по одному он шёл больше десяти минут
 * — то есть его перестали бы звать, а сторож, которого не зовут, ничем не
 * отличается от снятого.
 *
 * Параллельность взята НЕ обещаниями Node: `долгКорпуса` и `связывания` зовут
 * тесты обычным вызовом, и переписать их в `await` значило бы тронуть чужой
 * файл ради скорости. Поэтому прогрев синхронен снаружи и параллелен внутри:
 * `xargs -P` разводит вызовы по ядрам, ответы ложатся в отдельные файлы, и
 * дальше всё читается из памяти. Если `xargs` нет, прогрев молча ничего не
 * делает — дерево тогда возьмётся по одному, как и раньше.
 */
export function прогреть(пути, потоков = 0) {
  const нужны = [...new Set(пути.map((п) => resolve(КОРЕНЬ, п)))].filter((п) => !памятьДеревьев.has(п))
  if (нужны.length < 2) return
  const сколько = потоков || Math.max(1, Math.min(64, cpus().length))
  const где = mkdtempSync(join(tmpdir(), "flang-progrev-"))
  try {
    const задания = нужны.map((путь, и) => `${путь}\0${join(где, `${и}.json`)}\0`).join("")
    const итог = spawnSync(
      "xargs",
      ["-0", "-n", "2", "-P", String(сколько), "sh", "-c", `exec ${JSON.stringify(путьДвоичного())} ast "$1" >"$2" 2>"$2.err"`, "sh"],
      { input: задания, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
    )
    if (итог.error) return /* xargs нет — прогрева не будет, разбор пойдёт по одному */
    нужны.forEach((путь, и) => {
      const файл = join(где, `${и}.json`)
      let ответ
      try {
        ответ = { ok: true, дерево: JSON.parse(readFileSync(файл, "utf8")) }
      } catch {
        let почему = ""
        try {
          почему = `${readFileSync(`${файл}.err`, "utf8")}${readFileSync(файл, "utf8")}`.trim()
        } catch {
          почему = "двоичный не ответил"
        }
        ответ = { ok: false, why: почему }
      }
      памятьДеревьев.set(путь, ответ)
    })
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
}


/**
 * СВЯЗАННОЕ дерево файла — то же, что видит печать в целевой язык.
 * Отказывает только на разборе и на связывании: типов и завершаемости
 * `flang ast` не судит намеренно.
 */
export function дерево(путь) {
  const ключ = resolve(КОРЕНЬ, путь)
  if (памятьДеревьев.has(ключ)) return памятьДеревьев.get(ключ)
  const { код, вывод, ошибки } = позвать(["ast", ключ])
  let ответ
  if (код !== 0) {
    ответ = { ok: false, why: (ошибки || вывод).trim() }
  } else {
    try {
      ответ = { ok: true, дерево: JSON.parse(вывод) }
    } catch (беда) {
      ответ = { ok: false, why: `дерево не разобралось как JSON: ${беда.message}` }
    }
  }
  памятьДеревьев.set(ключ, ответ)
  return ответ
}

/** То же дерево для ИСХОДНИКА, которого нет на диске: через временный файл.
    Каталог заводится РЯДОМ с образцом, а не в `/tmp`: относительные пути в
    «использует … из "…"» считаются от места файла, и проба, унесённая в
    системный временный каталог, не связалась бы. */
export function деревоИсходника(исходник, рядомС) {
  const где = рядомС ? dirname(resolve(КОРЕНЬ, рядомС)) : КОРЕНЬ
  const каталог = mkdtempSync(join(где, ".flang-storozh-"))
  const файл = join(каталог, "проба.flang")
  try {
    writeFileSync(файл, исходник)
    const { код, вывод, ошибки } = позвать(["ast", файл])
    if (код !== 0) return { ok: false, why: (ошибки || вывод).trim() }
    return { ok: true, дерево: JSON.parse(вывод) }
  } catch (беда) {
    return { ok: false, why: беда.message }
  } finally {
    rmSync(каталог, { recursive: true, force: true })
  }
}

/** Подключения файла — из шапки модуля, лежащей в `legacy` дерева. */
export function подключения(д) {
  const шапка = (д?.legacy ?? []).find((з) => з?.construct === "moduleHeader")
  return (шапка?.value?.imports ?? []).map((и) => и.from).filter((п) => typeof п === "string")
}

/**
 * ТОЛЬКО СВОИ объявления файла: связанное дерево минус всё, что приехало
 * подключениями. Возвращает `{ok, module, types, functions, legacy, why}`.
 */
export function своё(путь) {
  const полный = resolve(КОРЕНЬ, путь)
  const д = дерево(полный)
  if (!д.ok) return { ok: false, why: д.why }
  return { ok: true, ...отсеятьЧужое(д.дерево, полный) }
}

/** Та же вычиталка для дерева, уже взятого на руки (например, у куска файла). */
export function отсеятьЧужое(д, откуда) {
  const чужиеФункции = new Set()
  const чужиеТипы = new Set()
  for (const путь of подключения(д)) {
    const сосед = resolve(dirname(resolve(КОРЕНЬ, откуда)), путь)
    const их = дерево(сосед)
    if (!их.ok) continue
    for (const ф of их.дерево.functions ?? []) чужиеФункции.add(ф.name)
    for (const т of их.дерево.types ?? []) чужиеТипы.add(т.name)
  }
  return {
    module: д.module,
    types: (д.types ?? []).filter((т) => !чужиеТипы.has(т.name)),
    functions: (д.functions ?? []).filter((ф) => !чужиеФункции.has(ф.name)),
    legacy: д.legacy ?? [],
    measures: д.measures ?? [],
  }
}

/**
 * ПРОГРЕВ ВЕДОМОСТЕЙ — тем же приёмом и по той же причине, что прогрев деревьев.
 *
 * `flang check --proof` считает типы, завершаемость и ядро доказательства; на
 * корпусе из 277 файлов по одному это часы. Разводится по ядрам тем же
 * `xargs -P`. Код возврата у `check` значащий (1 — программа не прошла, 2 —
 * названный пробел), поэтому он сохраняется рядом с выводом и читается отсюда.
 */
export function прогретьВедомости(пути, потоков = 0) {
  const нужны = [...new Set(пути.map((п) => resolve(КОРЕНЬ, п)))].filter((п) => !памятьВедомостей.has(п))
  if (нужны.length < 2) return
  const сколько = потоков || Math.max(1, Math.min(64, cpus().length))
  const где = mkdtempSync(join(tmpdir(), "flang-vedomosti-"))
  try {
    const задания = нужны.map((путь, и) => `${путь}\0${join(где, `${и}`)}\0`).join("")
    const итог = spawnSync(
      "xargs",
      ["-0", "-n", "2", "-P", String(сколько), "sh", "-c",
        `${JSON.stringify(путьДвоичного())} check "$1" --proof --json >"$2.json" 2>"$2.err"; echo $? >"$2.kod"`, "sh"],
      { input: задания, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
    )
    if (итог.error) return
    нужны.forEach((путь, и) => {
      const имя = join(где, `${и}`)
      let код = 1
      try {
        код = Number.parseInt(readFileSync(`${имя}.kod`, "utf8").trim(), 10)
      } catch {
        return /* xargs до этого файла не дошёл — возьмётся по одному */
      }
      let ответ
      try {
        ответ = { ok: код === 0, код, ведомость: JSON.parse(readFileSync(`${имя}.json`, "utf8")), why: код === 0 ? null : readFileSync(`${имя}.err`, "utf8").trim() }
      } catch {
        let почему = ""
        try {
          почему = `${readFileSync(`${имя}.err`, "utf8")}${readFileSync(`${имя}.json`, "utf8")}`.trim()
        } catch {
          почему = "двоичный не ответил"
        }
        ответ = { ok: false, код, why: почему }
      }
      памятьВедомостей.set(путь, ответ)
    })
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
}

/** Ведомость доказательств: `flang check --proof --json`. */
export function ведомость(путь) {
  const ключ = resolve(КОРЕНЬ, путь)
  if (памятьВедомостей.has(ключ)) return памятьВедомостей.get(ключ)
  const { код, вывод, ошибки } = позвать(["check", ключ, "--proof", "--json"])
  let ответ
  try {
    ответ = { ok: код === 0, код, ведомость: JSON.parse(вывод), why: код === 0 ? null : (ошибки || "").trim() }
  } catch {
    ответ = { ok: false, код, why: (ошибки || вывод).trim() }
  }
  памятьВедомостей.set(ключ, ответ)
  return ответ
}

/** Ведомость для ИСХОДНИКА, которого нет на диске: через временный файл рядом. */
export function ведомостьИсходника(текст, рядомС) {
  const где = рядомС ? dirname(resolve(КОРЕНЬ, рядомС)) : КОРЕНЬ
  const каталог = mkdtempSync(join(где, ".flang-storozh-"))
  const файл = join(каталог, "проба.flang")
  try {
    writeFileSync(файл, текст)
    const { код, вывод, ошибки } = позвать(["check", файл, "--proof", "--json"])
    try {
      return { ok: код === 0, код, ведомость: JSON.parse(вывод) }
    } catch {
      return { ok: false, код, why: (ошибки || вывод).trim() }
    }
  } finally {
    rmSync(каталог, { recursive: true, force: true })
  }
}

/** Проверка без ведомости: `flang check`. Замечания приходят текстом. */
export function проверка(путь) {
  const { код, вывод, ошибки } = позвать(["check", resolve(КОРЕНЬ, путь)])
  return { ok: код === 0, код, текст: `${вывод}${ошибки}`.trim() }
}

/** Прогон примеров корпуса: `flang test <маска> --json`. */
export function прогон(маска, ключи = []) {
  const { код, вывод, ошибки } = позвать(["test", маска, "--json", ...ключи])
  try {
    return { код, итог: JSON.parse(вывод) }
  } catch {
    return { код, why: (ошибки || вывод).trim() }
  }
}

/** Исходник файла — рядом, чтобы сторожу не заводить свой `readFileSync`. */
export function исходник(путь) {
  return readFileSync(resolve(КОРЕНЬ, путь), "utf8")
}
