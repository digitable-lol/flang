/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Разрывы покрытия: правило, которое не активирует ни один пример.
 *
 * Почему это важно до реализации: пример в FTS — это единственное место, где
 * автор требования говорит, чего он ждёт на конкретных числах. Правило без
 * примера не проверено ничем, и разработчик реализует его по своему пониманию.
 *
 * Как считаем — исполнением через ядро, а не повторной реализацией сравнений.
 * Приём: строим утилиту-зонд из правил `0..i`, где у правила `i` действие
 * заменено на «положить метку». Если ядро вернуло метку, значит условие
 * правила `i` на этом примере истинно. Правила `0..i-1` сохранены нетронутыми,
 * потому что условие может ссылаться на накопленный `результат`.
 */
import { evaluateUtility } from "../../../dist/src/index.js"

import { codes } from "./corpus.mjs"

const MARK = "ftspec: правило сработало"

/**
 * @returns {boolean|null} `null` — определить не удалось (ядро отвергло вход)
 */
export function ruleFires(utility, index, input) {
  const probe = {
    ...utility,
    rules: utility.rules
      .slice(0, index + 1)
      .map((rule, position) =>
        position === index ? { ...rule, action: { kind: "set", value: { kind: "value", value: MARK } } } : rule,
      ),
    properties: [],
  }
  try {
    return Object.is(evaluateUtility(probe, input), MARK)
  } catch {
    return null
  }
}

export function checkCoverage(corpus) {
  const diagnostics = []
  const stats = { rules: 0, covered: 0, undecided: 0 }

  for (const spec of corpus.specs) {
    for (const utility of spec.document.utilities ?? []) {
      const examples = utility.examples ?? []
      utility.rules.forEach((rule, index) => {
        stats.rules += 1
        let undecided = false
        const covering = []
        for (const example of examples) {
          const fired = ruleFires(utility, index, example.input)
          if (fired === null) undecided = true
          else if (fired) covering.push(example.name)
        }
        if (covering.length) {
          stats.covered += 1
          return
        }
        if (undecided) stats.undecided += 1

        diagnostics.push({
          code: codes.uncovered,
          message:
            `правило «${rule.name}» утилиты «${utility.name}» из ${spec.source} не активируется ни одним примером` +
            (examples.length ? "" : " (у утилиты нет примеров)"),
          severity: "warning",
          path: spec.source,
          specs: [spec.specId],
          details: {
            spec: spec.specId,
            utility: utility.name,
            rule: rule.name,
            index,
            examples: examples.map((example) => example.name),
            undecided,
          },
        })
      })
    }
  }

  return { diagnostics, stats }
}
