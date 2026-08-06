/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Диаграмма проекта: категории, импорты и функторы между категориями.
 *
 * Граф модулей — первое, что спрашивают на код-ревью большого проекта на FTS:
 * какие предметные области есть и как они связаны. Текст mermaid печатается в
 * stdout, поэтому его можно вставить в pull request, статью курса или README.
 */
const identifier = (value) =>
  `n_${[...String(value)].map((character) => (/[a-z0-9]/i.test(character) ? character : `u${character.codePointAt(0).toString(16)}`)).join("")}`

const escape = (value) => String(value).replace(/"/g, "&quot;")

export function mermaid(program) {
  const lines = ["flowchart LR"]

  for (const module of program.modules) {
    const utilities = (module.document.utilities ?? []).length
    const structures = module.document.structures.length
    const morphisms = (module.document.functors ?? []).length
    lines.push(
      `  ${identifier(module.category)}["${escape(module.category)}<br/><small>объектов: ${structures} · утилит: ${utilities} · морфизмов: ${morphisms}</small>"]`,
    )
  }

  for (const module of program.modules) {
    for (const dependency of module.imports) {
      lines.push(`  ${identifier(module.category)} -.->|использует| ${identifier(dependency.category)}`)
    }
  }

  for (const functor of program.functors) {
    lines.push(`  ${identifier(functor.from)} ==>|"функтор ${escape(functor.name)}"| ${identifier(functor.to)}`)
  }

  return lines.join("\n")
}
