/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Диагностики ftsvm.
 *
 * Коды и тексты намеренно совпадают с ядром (src/utility.ts):
 * исполнитель обязан быть неотличим от ядра не только результатом, но и
 * отказом. Если бы ftsvm сообщал о нарушении свойства своим кодом, любая
 * внешняя обработка ошибок (лог, ретрай, алерт) вела бы себя по-разному
 * в зависимости от того, каким движком исполнили одну и ту же утилиту, —
 * а это ровно то расхождение, которое тесты эквивалентности ищут.
 *
 * Класс свой, а не импортированный из ядра: исполнитель не должен зависеть
 * от вендорной сборки в рантайме — она нужна только тестам и бенчмарку,
 * которые сверяют ftsvm с эталоном.
 */

export class FtsvmError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message)
    this.name = "FtsvmError"
    this.code = code
    // Тот же массив диагностик, что кладёт ядро: вызывающий код,
    // читающий error.diagnostics[0].code, не заметит подмены движка.
    this.diagnostics = [{ code, message, severity: "error" }]
  }
}

/** @param {string} code @param {string} message */
export function vmError(code, message) {
  return new FtsvmError(code, message)
}

/**
 * Код диагностики из ошибки любого происхождения — ядра (FtsError)
 * или ftsvm. Нужен тестам, которые сравнивают отказы трёх движков.
 * @param {unknown} error
 * @returns {string | null}
 */
export function errorCode(error) {
  if (!error || typeof error !== "object") return null
  const direct = /** @type {{ code?: unknown }} */ (error).code
  if (typeof direct === "string") return direct
  const diagnostics = /** @type {{ diagnostics?: Array<{ code?: unknown }> }} */ (error).diagnostics
  const first = Array.isArray(diagnostics) ? diagnostics[0]?.code : null
  return typeof first === "string" ? first : null
}
