/**
 * Сборка исходного текста Elixir: реестр модулей/структур/полей, структуры
 * (defstruct), утилиты (правила + свойства + примеры) и функторы между
 * категориями. Здесь нет ничего, что решает «что означает FTS» — вся
 * семантика уже зафиксирована в expr.mjs (повторяет интерпретатор ядра) и
 * types.mjs (повторяет ts_compat ядра); этот файл только раскладывает готовые
 * решения в текст .ex/.exs.
 */
import { pascal, snake, createNamer, quote } from "../../naming.mjs"
import { parseType, specFromParsed, literalFor, RESERVED_KEYWORDS, RESERVED_MODULES } from "./types.mjs"
import { renderCondition, renderAction, renderPropertyCheck, propertiesUseInput } from "./expr.mjs"

/* Фиксированное имя общего типа ошибки. Не зависит от имени проекта — так оно
   гарантированно не столкнётся с транслитерацией пользовательских имён FTS
   (в отличие от модулей категорий, которые всегда живут под `<Проект>.`). */
export const ERROR_MODULE = "Ftsc.Runtime.Error"

function fileHeader(sourceLines) {
  return [
    "# СГЕНЕРИРОВАНО ftsc (бэкенд elixir, tools/ftsc/src/emit/elixir.mjs).",
    ...sourceLines.map((line) => `# ${line}`),
    "# Не редактировать руками — файл будет перезаписан при следующей генерации.",
  ].join("\n")
}

/* Экранирование маловероятного, но возможного совпадения текста имени FTS с
   ограничителем doc-строки Elixir. */
function escapeDoc(text) {
  return String(text).replace(/"""/g, '\\"\\"\\"')
}

function safeLocalName(name) {
  return RESERVED_KEYWORDS.includes(name) ? `${name}_` : name
}

function sampleLiteral(kind, index) {
  switch (kind) {
    case "number":
      return String(index + 1)
    case "string":
      return quote(`znachenie-${index}`)
    case "boolean":
    case "state":
      return index % 2 === 0 ? "true" : "false"
    default:
      throw new Error(`неизвестный вид типа: ${kind}`)
  }
}

/**
 * Реестр транслитераций для всей программы: модуль/функтор → Pascal-имя,
 * структура → Pascal-имя (в рамках модуля), поле → snake-имя (в рамках
 * структуры), утилита → snake-имя (в рамках модуля). Все коллизии — после
 * транслитерации двух разных имён FTS в один идентификатор — обязаны упасть
 * здесь (naming.createNamer), а не превратиться в молча сломанный код
 * (SPEC.md, раздел 5, пункт 7).
 *
 * @param {object} program — IR
 * @param {(value: string) => string} moduleNamer — общий на модули и функторы
 */
export function buildRegistry(program, moduleNamer) {
  const registry = new Map()
  for (const entry of program.modules) {
    const pascalName = moduleNamer(entry.name)
    const snakeName = snake(entry.name)

    const structNamer = createNamer(pascal, RESERVED_MODULES)
    const structures = new Map()
    for (const structure of entry.document.structures ?? []) {
      const structPascal = structNamer(structure.name)
      const fieldNamer = createNamer(snake, RESERVED_KEYWORDS)
      const fields = new Map()
      const fieldOrder = []
      for (const field of structure.fields ?? []) {
        const identifier = fieldNamer(field.name)
        fields.set(field.name, { snakeName: identifier, type: parseType(field.type) })
        fieldOrder.push(field.name)
      }
      structures.set(structure.name, { pascalName: structPascal, fields, fieldOrder })
    }

    const utilityNamer = createNamer(snake, RESERVED_KEYWORDS)
    const utilities = (entry.document.utilities ?? []).map((utility) => ({
      utility,
      snakeName: utilityNamer(utility.name),
    }))

    registry.set(entry.name, {
      pascalName,
      snakeName,
      source: entry.source,
      category: entry.category,
      structures,
      utilities,
    })
  }
  return registry
}

function renderStructModule(structureName, structInfo) {
  const ids = structInfo.fieldOrder.map((name) => structInfo.fields.get(name).snakeName)
  const required = structInfo.fieldOrder
    .filter((name) => !structInfo.fields.get(name).type.optional)
    .map((name) => structInfo.fields.get(name).snakeName)

  const lines = []
  lines.push(`  defmodule ${structInfo.pascalName} do`)
  lines.push('    @moduledoc """')
  lines.push(`    Структура FTS «${escapeDoc(structureName)}».`)
  lines.push('    """')
  lines.push("")
  if (required.length > 0) {
    lines.push(`    @enforce_keys [${required.map((id) => `:${id}`).join(", ")}]`)
  }
  lines.push(`    defstruct [${ids.map((id) => `:${id}`).join(", ")}]`)
  lines.push("")
  lines.push("    @type t :: %__MODULE__{")
  const fieldSpecs = structInfo.fieldOrder.map((name, index) => {
    const field = structInfo.fields.get(name)
    const suffix = index === structInfo.fieldOrder.length - 1 ? "" : ","
    return `            ${field.snakeName}: ${specFromParsed(field.type)}${suffix}`
  })
  lines.push(fieldSpecs.join("\n"))
  lines.push("          }")
  lines.push("  end")
  return lines.join("\n")
}

/* Правила утилиты образуют конвейер |>: каждое правило — функция
   результат → результат, вызываемая по очереди для предыдущего результата.
   Порядок правил, обязательный по SPEC.md (раздел 5, пункт 2 — выполняются
   ВСЕ правила с истинным условием, по порядку, без `else`), при таком стиле
   виден прямо в тексте функции сверху вниз. `cond`/`case` для этого не
   годятся: там срабатывает только первая подошедшая ветка, а здесь условия
   правил не исключают друг друга — могут сработать сразу несколько. */
function renderUtility(moduleInfo, utility, utilitySnake) {
  const structInfo = moduleInfo.structures.get(utility.input)
  if (!structInfo) {
    throw new Error(`утилита «${utility.name}» ссылается на неизвестную входную структуру «${utility.input}»`)
  }
  const inputVar = safeLocalName(snake(utility.input))
  const fieldsMap = new Map([...structInfo.fields.entries()].map(([original, field]) => [original, field.snakeName]))

  const outputType = parseType(utility.output)
  const outputSpec = specFromParsed(outputType)
  const hasProperties = utility.properties.length > 0
  const errorSpec = hasProperties ? ` | {:error, FtsError.t()}` : ""

  const ruleCtx = { inputVar, resultVar: "result", fields: fieldsMap }
  const ruleFns = utility.rules.map((rule, index) => {
    const fnName = `${utilitySnake}_rule_${index + 1}_${snake(rule.name)}`
    const condition = renderCondition(rule.when, ruleCtx)
    const action = renderAction(rule.action, ruleCtx)
    const code = [
      `  # Правило «${escapeDoc(rule.name)}».`,
      `  defp ${fnName}(result, ${inputVar}) do`,
      `    if ${condition} do`,
      `      ${action}`,
      "    else",
      "      result",
      "    end",
      "  end",
    ].join("\n")
    return { name: fnName, code }
  })

  const propsFnName = `${utilitySnake}_properties`
  const usesInput = propertiesUseInput(utility.properties)
  const propInputParam = usesInput ? inputVar : `_${inputVar}`
  let propsCode
  if (!hasProperties) {
    propsCode = [`  defp ${propsFnName}(raw, ${propInputParam}) do`, "    {:ok, raw}", "  end"].join("\n")
  } else {
    const propCtx = { inputVar, resultVar: "raw", fields: fieldsMap }
    const clauses = utility.properties.map((property) => {
      const check = renderPropertyCheck(property, propCtx)
      const message = `нарушено свойство «${property.name}» утилиты «${utility.name}»`
      return [
        `      not (${check}) ->`,
        `        {:error, %FtsError{message: ${quote(message)}, utility: ${quote(utility.name)}, property: ${quote(property.name)}, structure: ${quote(utility.input)}}}`,
      ].join("\n")
    })
    propsCode = [
      `  # Свойства (постусловия) утилиты «${escapeDoc(utility.name)}»: нарушение прекращает`,
      "  # успешное выполнение — возвращаем {:error, _} вместо результата.",
      `  defp ${propsFnName}(raw, ${propInputParam}) do`,
      "    cond do",
      clauses.join("\n\n"),
      "",
      "      true ->",
      "        {:ok, raw}",
      "    end",
      "  end",
    ].join("\n")
  }

  const initialLiteral = literalFor(outputType.kind, utility.initial)
  const pipelineLines = [
    `      ${initialLiteral}`,
    ...ruleFns.map((fn) => `      |> ${fn.name}(${inputVar})`),
    `      |> ${propsFnName}(${inputVar})`,
  ]

  const publicCode = [
    '  @doc """',
    `  Утилита FTS «${escapeDoc(utility.name)}»: «${escapeDoc(utility.input)}» → «${escapeDoc(utility.output)}».`,
    "",
    "  Правила образуют конвейер |>: каждое правило — функция результат → результат,",
    "  применяемая по очереди к предыдущему результату. Так порядок правил (обязаны",
    "  сработать ВСЕ правила с истинным условием, по порядку, без «иначе») виден прямо",
    "  в тексте функции — в отличие от cond/case, где выполнилась бы только первая",
    "  подошедшая ветка.",
    '  """',
    `  @spec ${utilitySnake}(${structInfo.pascalName}.t()) :: {:ok, ${outputSpec}}${errorSpec}`,
    `  def ${utilitySnake}(%${structInfo.pascalName}{} = ${inputVar}) do`,
    pipelineLines.join("\n"),
    "  end",
    "",
    '  @doc """',
    `  То же, что «${utilitySnake}/1», но при нарушении свойства бросает исключение`,
    `  ${ERROR_MODULE} вместо возврата {:error, _} — на случай, когда вызывающему коду`,
    "  удобнее исключение, чем разбор кортежа результата.",
    '  """',
    `  @spec ${utilitySnake}!(${structInfo.pascalName}.t()) :: ${outputSpec}`,
    `  def ${utilitySnake}!(%${structInfo.pascalName}{} = ${inputVar}) do`,
    `    case ${utilitySnake}(${inputVar}) do`,
    "      {:ok, value} -> value",
    "      {:error, error} -> raise error",
    "    end",
    "  end",
  ].join("\n")

  return [publicCode, ...ruleFns.map((fn) => fn.code), propsCode].join("\n\n")
}

function renderCategoryNotes(document) {
  const lines = []
  const morphisms = document.functors ?? []
  if (morphisms.length > 0) {
    lines.push("", "  Морфизмы категории (доказаны ядром при сборке, см. tools/ftsc/SPEC.md):")
    for (const morphism of morphisms) {
      lines.push(`    - «${escapeDoc(morphism.name)}»: «${escapeDoc(morphism.domain)}» → «${escapeDoc(morphism.codomain)}»`)
    }
  }
  if (document.proposition) {
    const detail = document.proposition.detail ?? ""
    lines.push("", "  Теорема, проверенная ядром при сборке:")
    lines.push(`    ${detail || "(без описания)"}`)
  }
  return lines
}

/** Модуль категории FTS: вложенные структуры + утилиты. */
export function renderModuleFile(entry, registry, projectPascal) {
  const info = registry.get(entry.name)
  const structures = entry.document.structures ?? []
  const structBlocks = structures.map((structure) => renderStructModule(structure.name, info.structures.get(structure.name)))

  const hasErrorAlias = info.utilities.some(({ utility }) => utility.properties.length > 0)
  const utilBlocks = info.utilities.map(({ utility, snakeName }) => renderUtility(info, utility, snakeName))

  const moduleDocLines = [`  Категория FTS «${escapeDoc(entry.category)}».`, ...renderCategoryNotes(entry.document)]

  const bodyBlocks = [...structBlocks]
  if (hasErrorAlias) bodyBlocks.push(`  alias ${ERROR_MODULE}, as: FtsError`)
  bodyBlocks.push(...utilBlocks)

  return `${fileHeader([`Источник: модуль «${entry.name}» (категория «${entry.category}»), ${entry.source}.`])}

defmodule ${projectPascal}.${info.pascalName} do
  @moduledoc """
${moduleDocLines.join("\n")}
  """

${bodyBlocks.join("\n\n")}
end
`
}

/** Тесты примеров утилит модуля — по одному ExUnit-тесту на пример FTS. */
export function renderModuleTestFile(entry, registry, projectPascal) {
  const info = registry.get(entry.name)
  const testable = info.utilities.filter(({ utility }) => (utility.examples ?? []).length > 0)
  if (testable.length === 0) return null

  const moduleFull = `${projectPascal}.${info.pascalName}`
  const usedStructs = [...new Set(testable.map(({ utility }) => utility.input))]

  const aliasLines = [
    `  alias ${moduleFull}`,
    ...usedStructs.map((name) => `  alias ${moduleFull}.${info.structures.get(name).pascalName}`),
  ]

  const describeBlocks = testable.map(({ utility, snakeName }) => {
    const structInfo = info.structures.get(utility.input)
    const outputType = parseType(utility.output)

    const testCases = (utility.examples ?? []).map((example) => {
      const fieldLiterals = structInfo.fieldOrder.map((original) => {
        const field = structInfo.fields.get(original)
        const present = Object.prototype.hasOwnProperty.call(example.input, original)
        if (!present && !field.type.optional) {
          throw new Error(`пример «${example.name}» утилиты «${utility.name}» не задаёт обязательное поле «${original}»`)
        }
        const value = present ? example.input[original] : undefined
        return `${field.snakeName}: ${literalFor(field.type.kind, value)}`
      })
      const expected = literalFor(outputType.kind, example.expected)
      return [
        `    test ${quote(example.name)} do`,
        `      value = %${structInfo.pascalName}{${fieldLiterals.join(", ")}}`,
        `      assert ${info.pascalName}.${snakeName}(value) == {:ok, ${expected}}`,
        "    end",
      ].join("\n")
    })

    return [`  describe ${quote(utility.name)} do`, testCases.join("\n\n"), "  end"].join("\n")
  })

  return `${fileHeader([`Тесты примеров утилит модуля «${entry.name}» (категория «${entry.category}»).`])}
ExUnit.start()

defmodule ${moduleFull}Test do
  use ExUnit.Case, async: true

${aliasLines.join("\n")}

${describeBlocks.join("\n\n")}
end
`
}

function functorAliasName(moduleInfo, structInfo) {
  return `${moduleInfo.pascalName}${structInfo.pascalName}`
}

/** Функция преобразования F: A → B для функтора между категориями (SPEC.md, раздел 5, пункт 8). */
export function renderFunctorFile(functor, registry, projectPascal, functorPascal) {
  const fromInfo = registry.get(functor.from)
  const toInfo = registry.get(functor.to)
  if (!fromInfo || !toInfo) {
    throw new Error(`функтор «${functor.name}» ссылается на неизвестный модуль («${functor.from}» → «${functor.to}»)`)
  }

  const aliasMap = new Map()
  const seenFnNames = new Set()

  const fnBlocks = functor.objects.map((mapping) => {
    const fromStruct = fromInfo.structures.get(mapping.from)
    const toStruct = toInfo.structures.get(mapping.to)
    if (!fromStruct || !toStruct) {
      throw new Error(`функтор «${functor.name}»: не найден объект «${mapping.from}» → «${mapping.to}»`)
    }
    const fromAs = functorAliasName(fromInfo, fromStruct)
    const toAs = functorAliasName(toInfo, toStruct)
    aliasMap.set(`${projectPascal}.${fromInfo.pascalName}.${fromStruct.pascalName}`, fromAs)
    aliasMap.set(`${projectPascal}.${toInfo.pascalName}.${toStruct.pascalName}`, toAs)

    const fnName = `${snake(mapping.from)}_to_${snake(mapping.to)}`
    if (seenFnNames.has(fnName)) {
      throw new Error(`функтор «${functor.name}»: два отображения объектов дают одинаковое имя функции «${fnName}»`)
    }
    seenFnNames.add(fnName)

    const fromVar = safeLocalName(snake(mapping.from))
    const fieldAssignments = mapping.fields.map((fieldMapping) => {
      const fromField = fromStruct.fields.get(fieldMapping.from)
      const toField = toStruct.fields.get(fieldMapping.to)
      if (!fromField || !toField) {
        throw new Error(`функтор «${functor.name}»: неизвестное поле в отображении «${mapping.from}» → «${mapping.to}»`)
      }
      return `      ${toField.snakeName}: ${fromVar}.${fromField.snakeName}`
    })

    return [
      '  @doc """',
      `  Отображает объект «${escapeDoc(mapping.from)}» в объект «${escapeDoc(mapping.to)}»:`,
      "",
      ...mapping.fields.map((f) => `    - поле «${escapeDoc(f.from)}» → поле «${escapeDoc(f.to)}»`),
      '  """',
      `  @spec ${fnName}(${fromAs}.t()) :: ${toAs}.t()`,
      `  def ${fnName}(%${fromAs}{} = ${fromVar}) do`,
      `    %${toAs}{`,
      fieldAssignments.join(",\n"),
      "    }",
      "  end",
    ].join("\n")
  })

  const morphismNotes = (functor.morphisms ?? []).map((m) => `    - «${escapeDoc(m.from)}» ⤳ «${escapeDoc(m.to)}»`)
  const morphismBlock = morphismNotes.length > 0 ? `\n\n  Сохраняемые морфизмы:\n${morphismNotes.join("\n")}` : ""

  const aliasLines = [...aliasMap.entries()].map(([full, as]) => `  alias ${full}, as: ${as}`)

  return `${fileHeader([`Функтор «${functor.name}»: «${functor.from}» → «${functor.to}».`])}

defmodule ${projectPascal}.${functorPascal} do
  @moduledoc """
  Функтор FTS «${escapeDoc(functor.name)}»: категория «${escapeDoc(functor.from)}» → категория «${escapeDoc(functor.to)}».

  Функтор — проверяемое отображение одной категории в другую (SPEC.md, раздел 3):
  тотальность на объектах/полях и согласованность типов уже проверены компилятором
  ftsc при сборке IR. Эта функция — только само отображение данных на Elixir.${morphismBlock}
  """

${aliasLines.join("\n")}

${fnBlocks.join("\n\n")}
end
`
}

/** Тест функтора: закон переноса поля — образ поля равен полю прообраза (переименование, не преобразование значения). */
export function renderFunctorTestFile(functor, registry, projectPascal, functorPascal) {
  const fromInfo = registry.get(functor.from)
  const toInfo = registry.get(functor.to)
  const moduleFull = `${projectPascal}.${functorPascal}`

  const aliasMap = new Map()
  const testBlocks = functor.objects.map((mapping) => {
    const fromStruct = fromInfo.structures.get(mapping.from)
    const toStruct = toInfo.structures.get(mapping.to)
    const fromAs = functorAliasName(fromInfo, fromStruct)
    aliasMap.set(`${projectPascal}.${fromInfo.pascalName}.${fromStruct.pascalName}`, fromAs)

    const fnName = `${snake(mapping.from)}_to_${snake(mapping.to)}`
    const sampleFields = fromStruct.fieldOrder.map((original, index) => {
      const field = fromStruct.fields.get(original)
      return `${field.snakeName}: ${sampleLiteral(field.type.kind, index)}`
    })
    const assertions = mapping.fields.map((fieldMapping) => {
      const fromField = fromStruct.fields.get(fieldMapping.from)
      const toField = toStruct.fields.get(fieldMapping.to)
      return `      assert image.${toField.snakeName} == source.${fromField.snakeName}`
    })

    return [
      `  test ${quote(`«${mapping.from}» → «${mapping.to}»: поля переносятся без изменения значения`)} do`,
      `    source = %${fromAs}{${sampleFields.join(", ")}}`,
      `    image = ${functorPascal}.${fnName}(source)`,
      "",
      assertions.join("\n"),
      "  end",
    ].join("\n")
  })

  const aliasLines = [`  alias ${moduleFull}`, ...[...aliasMap.entries()].map(([full, as]) => `  alias ${full}, as: ${as}`)]

  return `${fileHeader([`Тест функтора «${functor.name}»: «${functor.from}» → «${functor.to}».`])}
ExUnit.start()

defmodule ${moduleFull}Test do
  use ExUnit.Case, async: true

${aliasLines.join("\n")}

${testBlocks.join("\n\n")}
end
`
}

/** Общий модуль ошибки утилит — печатается один раз на программу (если есть хоть одна утилита). */
export function renderErrorModule() {
  return `${fileHeader([
    "Общий тип ошибки для утилит всех сгенерированных модулей проекта.",
    "Имя зафиксировано и не зависит от имени проекта — не может столкнуться",
    "с транслитерацией пользовательских имён FTS.",
  ])}

defmodule ${ERROR_MODULE} do
  @moduledoc """
  Нарушение свойства (постусловия) FTS-утилиты.

  Свойство в FTS — это постусловие: если оно ложно, утилита не может считаться
  завершённой успешно (SPEC.md, раздел 5, пункт 3). В Elixir для этого
  идиоматичны два способа: вернуть {:error, _} из обычной функции или бросить
  исключение. Каждая сгенерированная утилита даёт оба варианта: «имя/1»
  возвращает {:ok, значение} | {:error, %${ERROR_MODULE}{}}, а «имя!/1» — то
  же значение либо бросает это исключение.
  """

  defexception [:message, :utility, :property, :structure]

  @type t :: %__MODULE__{
          message: String.t(),
          utility: String.t(),
          property: String.t(),
          structure: String.t() | nil
        }
end
`
}
