/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Сервер языка FTS: диспетчер методов LSP.
 *
 * Ноль зависимостей: транспорт — `rpc.mjs`, документы — `documents.mjs`,
 * язык — ядро из `dist/src`. Сервер не парсит `.fts` сам и не дублирует
 * семантику; всё, что он добавляет, — координаты, кэш и дебаунс.
 *
 * Синхронизация инкрементальная. Анализ кэшируется по версии документа,
 * поэтому hover и inlay-подсказки не пересчитывают модель, если она не
 * менялась, а публикация диагностик отложена на 150 мс: компилировать на
 * каждую букву незачем.
 */
import { analyze } from "./analysis.mjs"
import { DocumentStore } from "./documents.mjs"
import { createConnection, RpcError } from "./rpc.mjs"
import { complete } from "./features/completion.mjs"
import { definition } from "./features/definition.mjs"
import { formatDocument } from "./features/format.mjs"
import { hover } from "./features/hover.mjs"
import { inlayHints } from "./features/inlay.mjs"
import { documentSymbols } from "./features/symbols.mjs"

export const SERVER_NAME = "ftsls"
export const SERVER_VERSION = "0.1.0"
const DEBOUNCE_MS = 150

/**
 * @param {{ input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, debounce?: number, exit?: (code: number) => void }} [options]
 */
export function createServer(options = {}) {
  const documents = new DocumentStore()
  const analyses = new Map()
  const timers = new Map()
  const debounce = options.debounce ?? DEBOUNCE_MS
  const exit = options.exit ?? ((code) => process.exit(code))
  let initialized = false
  let shuttingDown = false

  const connection = createConnection({
    input: options.input,
    output: options.output,
    onExit: () => exit(shuttingDown ? 0 : 1),
  })

  /** Анализ документа с кэшем по версии: одна компиляция на одно состояние. */
  function analysisOf(uri) {
    const document = documents.get(uri)
    if (!document) return null
    const cached = analyses.get(uri)
    if (cached && cached.version === document.version && cached.length === document.text.length) return cached.value
    const value = analyze(document.text)
    analyses.set(uri, { version: document.version, length: document.text.length, value })
    return value
  }

  function publish(uri) {
    const document = documents.get(uri)
    if (!document) return
    const analysis = analysisOf(uri)
    connection.sendNotification("textDocument/publishDiagnostics", {
      uri,
      version: document.version,
      diagnostics: analysis ? analysis.diagnostics : [],
    })
  }

  function schedule(uri) {
    clearTimeout(timers.get(uri))
    timers.set(uri, setTimeout(() => {
      timers.delete(uri)
      publish(uri)
    }, debounce))
  }

  function requireDocument(uri) {
    const document = documents.get(uri)
    if (!document) throw Object.assign(new Error(`документ '${uri}' не открыт`), { code: RpcError.invalidParams })
    return document
  }

  connection.onRequest("initialize", () => {
    initialized = true
    return {
      capabilities: {
        textDocumentSync: { openClose: true, change: 2 /* Incremental */, save: { includeText: false } },
        completionProvider: { resolveProvider: false, triggerCharacters: [" ", "«", '"', "'"] },
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        documentFormattingProvider: true,
        inlayHintProvider: { resolveProvider: false },
      },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    }
  })

  connection.onNotification("initialized", () => {})
  connection.onNotification("$/setTrace", () => {})
  connection.onNotification("$/cancelRequest", () => {})
  connection.onNotification("workspace/didChangeConfiguration", () => {})

  connection.onRequest("shutdown", () => {
    shuttingDown = true
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    return null
  })

  connection.onNotification("exit", () => {
    connection.dispose()
    exit(shuttingDown ? 0 : 1)
  })

  connection.onNotification("textDocument/didOpen", (params) => {
    const item = params.textDocument
    documents.open({ uri: item.uri, languageId: item.languageId, version: item.version, text: item.text })
    analyses.delete(item.uri)
    publish(item.uri) /* открытие — сразу, без дебаунса */
  })

  connection.onNotification("textDocument/didChange", (params) => {
    const document = documents.get(params.textDocument?.uri)
    if (!document) return
    document.update(params.contentChanges, params.textDocument.version)
    analyses.delete(document.uri)
    schedule(document.uri)
  })

  connection.onNotification("textDocument/didSave", (params) => {
    if (params?.textDocument?.uri) publish(params.textDocument.uri)
  })

  connection.onNotification("textDocument/didClose", (params) => {
    const uri = params.textDocument?.uri
    if (!uri) return
    clearTimeout(timers.get(uri))
    timers.delete(uri)
    documents.close(uri)
    analyses.delete(uri)
    connection.sendNotification("textDocument/publishDiagnostics", { uri, diagnostics: [] })
  })

  connection.onRequest("textDocument/hover", (params) => {
    requireDocument(params.textDocument.uri)
    return hover(analysisOf(params.textDocument.uri), params.position) ?? null
  })

  connection.onRequest("textDocument/completion", (params) => {
    const document = requireDocument(params.textDocument.uri)
    const items = complete(analysisOf(document.uri), document.lineText(params.position.line), params.position)
    return { isIncomplete: false, items }
  })

  connection.onRequest("textDocument/definition", (params) => {
    requireDocument(params.textDocument.uri)
    return definition(analysisOf(params.textDocument.uri), params.textDocument.uri, params.position) ?? null
  })

  connection.onRequest("textDocument/documentSymbol", (params) => {
    requireDocument(params.textDocument.uri)
    return documentSymbols(analysisOf(params.textDocument.uri))
  })

  connection.onRequest("textDocument/inlayHint", (params) => {
    requireDocument(params.textDocument.uri)
    return inlayHints(analysisOf(params.textDocument.uri), params.range ?? null)
  })

  connection.onRequest("textDocument/formatting", (params) => {
    const document = requireDocument(params.textDocument.uri)
    return formatDocument(analysisOf(document.uri), document.text, params.options ?? {})
  })

  return {
    connection,
    documents,
    listen() {
      connection.listen()
    },
    get initialized() {
      return initialized
    },
  }
}
