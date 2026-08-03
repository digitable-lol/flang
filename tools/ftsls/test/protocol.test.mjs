/**
 * Тесты сервера языка: разговор по протоколу с настоящим подпроцессом.
 *
 * Запуск: node --test tools/ftsls/test/protocol.test.mjs
 * (нужен собранный `dist/src`: npm run build)
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { after, test } from "node:test"

import { startClient } from "./client.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")

const MODEL = [
  "категория «Продажи»",
  "",
  "  объект Покупка",
  "    сумма является деньгами",
  "    «постоянный клиент» является признаком",
  "",
  "  утилита «Рассчитать скидку»",
  "    принимает Покупка",
  "    возвращает деньги",
  "    начинает с 0",
  "",
  "    правило «Большая покупка»",
  "      если сумма не меньше 10000",
  "      то добавить 10 процентов от поля сумма",
  "",
  "    пример «Большая покупка»",
  "      дано сумма равна 20000",
  "      дано «постоянный клиент» равен нет",
  "      ожидается результат равен 2000",
  "",
].join("\n")

const EXPECTED_LINE = 18
const clients = []

function client() {
  const item = startClient()
  clients.push(item)
  return item
}

after(() => {
  for (const item of clients) item.kill()
})

test("initialize возвращает корректные capabilities", async () => {
  const lsp = client()
  const result = await lsp.initialize()
  const capabilities = result.capabilities
  assert.equal(result.serverInfo.name, "ftsls")
  assert.equal(capabilities.textDocumentSync.openClose, true)
  assert.equal(capabilities.textDocumentSync.change, 2, "объявлена инкрементальная синхронизация")
  assert.equal(capabilities.hoverProvider, true)
  assert.equal(capabilities.definitionProvider, true)
  assert.equal(capabilities.documentSymbolProvider, true)
  assert.equal(capabilities.documentFormattingProvider, true)
  assert.ok(capabilities.inlayHintProvider)
  assert.ok(capabilities.completionProvider.triggerCharacters.includes(" "))
})

test("валидная модель открывается без диагностик", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///discount.fts"
  lsp.open(uri, readFileSync(resolve(repo, "examples/utilities/discount.fts"), "utf8"))
  const published = await lsp.diagnostics(uri)
  assert.deepEqual(published.params.diagnostics, [])
})

test("ошибка разбора получает строку и колонку из содержимого строки", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///broken.fts"
  const source = MODEL.replace("      если сумма не меньше 10000", "      еслиx сумма не меньше 10000")
  lsp.open(uri, source)
  const published = await lsp.diagnostics(uri)
  const [diagnostic] = published.params.diagnostics
  assert.ok(diagnostic, "диагностика есть")
  assert.equal(diagnostic.code, "FTS_UTILITY_RULE")
  assert.equal(diagnostic.source, "fts")
  assert.equal(diagnostic.severity, 1)

  /* Ядро сообщает `path: "строка 13"` — та же строка, но 1-based. */
  const { compile } = await import(resolve(repo, "dist/src/index.js"))
  const core = (() => {
    try {
      compile(source)
      return null
    } catch (error) {
      return error.diagnostics[0]
    }
  })()
  assert.equal(core.path, "строка 13")
  assert.equal(diagnostic.range.start.line, 12, "строка ядра минус единица")
  assert.equal(diagnostic.range.start.character, 6, "подчёркивание начинается после отступа")
  assert.equal(diagnostic.range.end.character, source.split("\n")[12].length)
})

test("ошибка проверки указывает на конкретное имя поля", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///unknown-field.fts"
  const source = MODEL.replace("если сумма не меньше", "если суммаX не меньше")
  lsp.open(uri, source)
  const published = await lsp.diagnostics(uri)
  const [diagnostic] = published.params.diagnostics
  assert.equal(diagnostic.code, "FTS_UTILITY_FIELD")
  assert.equal(diagnostic.range.start.line, 12)
  const line = source.split("\n")[12]
  assert.equal(line.slice(diagnostic.range.start.character, diagnostic.range.end.character), "суммаX")
})

test("несходящийся пример — диагностика на строке «ожидается» с обоими значениями", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///mismatch.fts"
  const source = MODEL.replace("ожидается результат равен 2000", "ожидается результат равен 3000")
  lsp.open(uri, source)
  const published = await lsp.diagnostics(uri)
  const [diagnostic] = published.params.diagnostics
  assert.equal(diagnostic.code, "FTS_UTILITY_EXAMPLE_MISMATCH")
  assert.equal(diagnostic.range.start.line, EXPECTED_LINE)
  assert.match(diagnostic.message, /ожидается 3000/u)
  assert.match(diagnostic.message, /фактически 2000/u)
  const line = source.split("\n")[EXPECTED_LINE]
  assert.equal(line.slice(diagnostic.range.start.character, diagnostic.range.end.character), "3000")
})

test("inlay-подсказки показывают фактический результат примера", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///hints.fts"
  const source = MODEL.replace("ожидается результат равен 2000", "ожидается результат равен 3000")
  lsp.open(uri, source)
  await lsp.diagnostics(uri)
  const hints = await lsp.request("textDocument/inlayHint", {
    textDocument: { uri },
    range: { start: { line: 0, character: 0 }, end: { line: 40, character: 0 } },
  })
  const onExpected = hints.find((hint) => hint.position.line === EXPECTED_LINE)
  assert.ok(onExpected, "подсказка стоит на строке «ожидается»")
  assert.match(onExpected.label, /2000/u, "показан фактический результат")
  assert.match(onExpected.tooltip.value, /ожидается 3000, фактически 2000/u)

  const onUtility = hints.find((hint) => hint.position.line === 6)
  assert.ok(onUtility, "у утилиты есть сводка по примерам")
  assert.match(onUtility.label, /0\/1/u)
})

test("hover: на поле — тип, на утилите — сигнатура и статистика", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///hover.fts"
  lsp.open(uri, MODEL)
  await lsp.diagnostics(uri)

  const field = await lsp.request("textDocument/hover", { textDocument: { uri }, position: { line: 3, character: 6 } })
  assert.match(field.contents.value, /поле/u)
  assert.match(field.contents.value, /Деньги/u)

  const utility = await lsp.request("textDocument/hover", { textDocument: { uri }, position: { line: 6, character: 15 } })
  assert.match(utility.contents.value, /принимает Покупка/u)
  assert.match(utility.contents.value, /возвращает Деньги/u)
  assert.match(utility.contents.value, /сходятся 1\/1/u)

  const reference = await lsp.request("textDocument/hover", { textDocument: { uri }, position: { line: 12, character: 12 } })
  assert.match(reference.contents.value, /Деньги/u, "поле в условии тоже знает свой тип")
})

test("автодополнение после «если» предлагает поля принимаемого объекта", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///completion.fts"
  const lines = MODEL.split("\n")
  lines.splice(13, 0, "      если ")
  lsp.open(uri, lines.join("\n"))
  const completion = await lsp.request("textDocument/completion", {
    textDocument: { uri },
    position: { line: 13, character: 11 },
  })
  const labels = completion.items.map((item) => item.label)
  assert.ok(labels.includes("сумма"), `поля объекта предложены: ${labels.join(", ")}`)
  assert.ok(labels.includes("«постоянный клиент»"), "имя с пробелом предлагается в кавычках")
  const field = completion.items.find((item) => item.label === "сумма")
  assert.equal(field.detail, "Деньги")
})

test("автодополнение идёт по шагам условия: поле → сравнение → операнд", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///completion-steps.fts"
  const lines = MODEL.split("\n")
  lines.splice(13, 0, "      если сумма не меньше ")
  lsp.open(uri, lines.join("\n"))

  const afterField = await lsp.request("textDocument/completion", {
    textDocument: { uri },
    position: { line: 13, character: "      если сумма ".length },
  })
  const comparisons = afterField.items.map((item) => item.label)
  assert.ok(comparisons.includes("не меньше"), `сравнения предложены: ${comparisons.join(", ")}`)
  assert.ok(!comparisons.includes("сумма"), "поле уже набрано, второй раз не предлагаем")

  const afterComparison = await lsp.request("textDocument/completion", {
    textDocument: { uri },
    position: { line: 13, character: "      если сумма не меньше ".length },
  })
  const operands = afterComparison.items.map((item) => item.label)
  assert.ok(operands.includes("поле"), "операндом может быть поле")
  assert.ok(operands.includes("процентов от поля"), "и процент от поля")
  assert.ok(operands.includes("да"), "и литерал")
})

test("автодополнение знает ключевые слова блока утилиты", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///completion-utility.fts"
  const lines = MODEL.split("\n")
  lines.splice(10, 0, "    ")
  lsp.open(uri, lines.join("\n"))
  const completion = await lsp.request("textDocument/completion", {
    textDocument: { uri },
    position: { line: 10, character: 4 },
  })
  const labels = completion.items.map((item) => item.label)
  for (const expected of ["принимает", "возвращает", "начинает с", "правило", "свойство", "пример"]) {
    assert.ok(labels.includes(expected), `${expected} предложено`)
  }
})

test("переход к определению ведёт от использования к объявлению", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///definition.fts"
  lsp.open(uri, MODEL)
  await lsp.diagnostics(uri)

  const field = await lsp.request("textDocument/definition", { textDocument: { uri }, position: { line: 12, character: 12 } })
  assert.equal(field.uri, uri)
  assert.equal(field.range.start.line, 3, "поле объявлено в объекте")

  const object = await lsp.request("textDocument/definition", { textDocument: { uri }, position: { line: 7, character: 16 } })
  assert.equal(object.range.start.line, 2, "принимаемый объект")
})

test("символы документа образуют дерево категории", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///symbols.fts"
  lsp.open(uri, MODEL)
  await lsp.diagnostics(uri)
  const symbols = await lsp.request("textDocument/documentSymbol", { textDocument: { uri } })
  assert.equal(symbols.length, 1)
  assert.equal(symbols[0].name, "Продажи")
  const names = symbols[0].children.map((child) => child.name)
  assert.deepEqual(names, ["Покупка", "Рассчитать скидку"])
  const object = symbols[0].children[0]
  assert.deepEqual(object.children.map((child) => child.name), ["сумма", "постоянный клиент"])
  assert.equal(object.children[0].detail, "Деньги")
  const utility = symbols[0].children[1]
  assert.deepEqual(utility.children.map((child) => child.name), ["Большая покупка", "Большая покупка"])
})

test("форматирование нормализует отступы и не меняет имена", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///format.fts"
  const messy = MODEL.split("\n").map((line, index) => (index === 3 ? `        ${line.trim()}   ` : line)).join("\n")
  lsp.open(uri, messy)
  await lsp.diagnostics(uri)
  const edits = await lsp.request("textDocument/formatting", { textDocument: { uri }, options: { tabSize: 2, insertSpaces: true } })
  assert.equal(edits.length, 1)
  assert.equal(edits[0].newText.split("\n")[3], "    сумма является деньгами")
  assert.equal(edits[0].newText.split("\n")[4], "    «постоянный клиент» является признаком")
})

test("didChange пересчитывает диагностики", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///change.fts"
  lsp.open(uri, MODEL)
  const first = await lsp.diagnostics(uri)
  assert.deepEqual(first.params.diagnostics, [])

  /* Инкрементальная правка: заменяем только число в строке «ожидается». */
  const character = MODEL.split("\n")[EXPECTED_LINE].indexOf("2000")
  lsp.changeRange(
    uri,
    { start: { line: EXPECTED_LINE, character }, end: { line: EXPECTED_LINE, character: character + 4 } },
    "9999",
    2,
  )
  const second = await lsp.diagnostics(uri, 1)
  assert.equal(second.params.version, 2)
  assert.equal(second.params.diagnostics.length, 1)
  assert.match(second.params.diagnostics[0].message, /ожидается 9999, фактически 2000/u)

  lsp.changeRange(
    uri,
    { start: { line: EXPECTED_LINE, character }, end: { line: EXPECTED_LINE, character: character + 4 } },
    "2000",
    3,
  )
  const third = await lsp.diagnostics(uri, 2)
  assert.deepEqual(third.params.diagnostics, [])
})

test("дебаунс: очередь правок даёт одну публикацию", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///debounce.fts"
  const character = MODEL.split("\n")[EXPECTED_LINE].indexOf("2000")
  lsp.open(uri, MODEL)
  await lsp.diagnostics(uri)

  for (const [index, value] of ["1000", "3000", "2000"].entries()) {
    lsp.changeRange(
      uri,
      { start: { line: EXPECTED_LINE, character }, end: { line: EXPECTED_LINE, character: character + 4 } },
      value,
      index + 2,
    )
  }
  await lsp.diagnostics(uri, 1)
  await new Promise((settle) => setTimeout(settle, 400))
  const published = lsp.notifications.filter(
    (message) => message.method === "textDocument/publishDiagnostics" && message.params.uri === uri,
  )
  assert.equal(published.length, 2, "открытие и одна отложенная публикация")
  assert.equal(published[1].params.version, 4, "опубликовано последнее состояние")
  assert.deepEqual(published[1].params.diagnostics, [])
})

test("запрос к неоткрытому документу — ошибка параметров, а не падение", async () => {
  const lsp = client()
  await lsp.initialize()
  await assert.rejects(
    () => lsp.request("textDocument/hover", { textDocument: { uri: "file:///missing.fts" }, position: { line: 0, character: 0 } }),
    (error) => {
      assert.equal(error.code, -32602)
      return true
    },
  )
})

test("didClose гасит диагностики", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///closed.fts"
  lsp.open(uri, MODEL.replace("ожидается результат равен 2000", "ожидается результат равен 3000"))
  const opened = await lsp.diagnostics(uri)
  assert.equal(opened.params.diagnostics.length, 1)
  lsp.notify("textDocument/didClose", { textDocument: { uri } })
  const closed = await lsp.diagnostics(uri, 1)
  assert.deepEqual(closed.params.diagnostics, [])
})

test("пустой файл не даёт ни диагностик, ни падения", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///empty.fts"
  lsp.open(uri, "")
  const published = await lsp.diagnostics(uri)
  assert.deepEqual(published.params.diagnostics, [])
  const hints = await lsp.request("textDocument/inlayHint", { textDocument: { uri }, range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } })
  assert.deepEqual(hints, [])
  const hover = await lsp.request("textDocument/hover", { textDocument: { uri }, position: { line: 0, character: 0 } })
  assert.equal(hover, null)
})

test("невалидный UTF-8 в кадре не роняет сервер", async () => {
  const lsp = client()
  await lsp.initialize()
  const body = Buffer.from([0xff, 0xfe, 0x80, 0x9f])
  lsp.raw(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]))
  const error = await lsp.wait((message) => message.error?.code === -32700)
  assert.ok(error, "сервер ответил ошибкой разбора")

  const uri = "file:///after-garbage.fts"
  lsp.open(uri, MODEL)
  const published = await lsp.diagnostics(uri)
  assert.deepEqual(published.params.diagnostics, [], "сервер продолжает работать")
  assert.equal(lsp.child.exitCode, null)
})

test("одинокий суррогат в тексте документа не роняет сервер", async () => {
  const lsp = client()
  await lsp.initialize()
  const uri = "file:///surrogate.fts"
  lsp.raw(frame({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, languageId: "fts", version: 1, text: "категория \ud800\n  объект \udfff" } },
  }))
  const published = await lsp.diagnostics(uri)
  assert.ok(Array.isArray(published.params.diagnostics))
  assert.equal(lsp.child.exitCode, null)
})

test("неизвестный метод получает -32601, уведомление игнорируется", async () => {
  const lsp = client()
  await lsp.initialize()
  await assert.rejects(() => lsp.request("textDocument/codeLens", { textDocument: { uri: "file:///x.fts" } }), (error) => {
    assert.equal(error.code, -32601)
    return true
  })
  lsp.notify("telemetry/somethingUnknown", {})
  const result = await lsp.request("initialize", { capabilities: {} })
  assert.ok(result.capabilities, "сервер жив")
})

test("shutdown и exit завершают процесс с нулевым кодом", async () => {
  const lsp = client()
  await lsp.initialize()
  assert.equal(await lsp.request("shutdown", {}), null)
  lsp.notify("exit", {})
  assert.equal(await lsp.exited(), 0)
})

test("exit без shutdown завершает процесс с кодом 1", async () => {
  const lsp = client()
  await lsp.initialize()
  lsp.notify("exit", {})
  assert.equal(await lsp.exited(), 1)
})

function frame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8")
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body])
}
