/**
 * Эталон для НАПЕЧАТАННОГО ПРОГОНЩИКА — это `flang run`, а не голый вычислитель.
 *
 * Зачем понадобилось различать. У напечатанной программы два входа, и обещания
 * у них разные:
 *
 *   • библиотечный (`<префикс>_call`, `program::call`, `Flang.call`) — это
 *     вычислитель, и он обязан совпадать с `interpret` значение в значение;
 *   • прогонщик (`flang_cli`) — это вход ИЗВНЕ, и у него, как у `flang run`,
 *     стоит граница: значения приезжают JSON-ом, программой не являются и
 *     сверяются с объявленными типами ДО вычисления.
 *
 * Граница заведена не ради аккуратности. Доказательство завершения `тотальной`
 * стоит НА ТИПЕ: у `нат` есть потолок 2^53−1, ниже которого `н минус 1` точно
 * меньше `н`, и сторож убывания в такую функцию не печатается ВОВСЕ. Значение
 * вне типа выносит вместе с типом и доказательство — `1e300 минус 1` равно
 * `1e300`, цепочка вечна, и поймать её нечем.
 *
 * Поэтому сверка «напечатанное против эталона» на входах, которые снаружи
 * приходят, обязана идти через ту же дверь. Одна функция на все бэкенды:
 * разойдись они в том, что считать эталоном, — и «совпало» перестало бы
 * что-либо значить.
 */
import { errorCode } from "../src/compat.mjs"
import { evaluate as interpret } from "../src/interpret.mjs"
import { checkArguments } from "../src/types.mjs"

/** Имена параметров функции в объявленном порядке. */
function имена(program, functionName) {
  const fn = (program?.functions ?? []).find((item) => item?.name === functionName)
  return (fn?.params ?? []).map((param) => (typeof param === "string" ? param : param?.name))
}

/**
 * Исход вызова через границу входа: сначала объявленные типы, потом вычисление.
 *
 * @param {object} program AST программы
 * @param {string} functionName имя вызываемой функции
 * @param {object[]|object} args значения по порядку параметров либо по их именам
 * @param {object} [limits] пределы шагов и глубины для вычислителя
 * @returns {{ ok: true, value: unknown } | { ok: false, code: string, message: string }}
 */
export function черезГраницу(program, functionName, args, limits = {}) {
  const поИменам = {}
  if (Array.isArray(args)) {
    имена(program, functionName).forEach((имя, место) => {
      поИменам[имя] = args[место]
    })
  } else {
    Object.assign(поИменам, args ?? {})
  }
  const дверь = checkArguments(program, functionName, поИменам)
  if (!дверь.ok) {
    return { ok: false, code: дверь.diagnostics[0].code, message: дверь.diagnostics[0].message }
  }
  try {
    return { ok: true, value: interpret(program, functionName, args, limits) }
  } catch (error) {
    return { ok: false, code: errorCode(error), message: error instanceof Error ? error.message : String(error) }
  }
}
