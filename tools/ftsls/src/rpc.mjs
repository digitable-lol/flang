/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * JSON-RPC 2.0 поверх stdio — транспорт Language Server Protocol.
 *
 * LSP не требует библиотеки: это JSON-RPC, кадрированный заголовком
 * `Content-Length`. Ядро FTS не имеет зависимостей, и сервер языка тоже:
 * кадрирование, разбор и отправка сообщений живут здесь и больше нигде.
 *
 * Длина считается в БАЙТАХ, а не в символах, поэтому буфер накапливается
 * как `Buffer`: кириллица в UTF-8 занимает два байта, и посимвольный
 * подсчёт разъехался бы на первой же русской модели.
 */

export const RpcError = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  serverNotInitialized: -32002,
}

const HEADER_SEPARATOR = "\r\n\r\n"

/**
 * Соединение по stdio.
 *
 * @param {{ input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, onExit?: () => void }} [options]
 */
export function createConnection(options = {}) {
  const input = options.input ?? process.stdin
  const output = options.output ?? process.stdout
  const requests = new Map()
  const notifications = new Map()
  let buffer = Buffer.alloc(0)
  let disposed = false

  function write(message) {
    if (disposed) return
    const body = Buffer.from(JSON.stringify(message), "utf8")
    output.write(`Content-Length: ${body.length}${HEADER_SEPARATOR}`)
    output.write(body)
  }

  function respond(id, result) {
    write({ jsonrpc: "2.0", id, result: result === undefined ? null : result })
  }

  function respondError(id, code, message) {
    write({ jsonrpc: "2.0", id, error: { code, message } })
  }

  async function dispatch(message) {
    if (message === null || typeof message !== "object" || Array.isArray(message)) {
      write({ jsonrpc: "2.0", id: null, error: { code: RpcError.invalidRequest, message: "ожидался объект JSON-RPC" } })
      return
    }

    const { id, method, params } = message
    if (typeof method !== "string") return /* ответ на запрос: сервер запросов не шлёт */

    if (id === undefined) {
      const handler = notifications.get(method)
      if (!handler) return /* неизвестное уведомление молча игнорируется — так требует LSP */
      try {
        await handler(params ?? {})
      } catch (error) {
        report(method, error)
      }
      return
    }

    const handler = requests.get(method)
    if (!handler) {
      respondError(id, RpcError.methodNotFound, `метод '${method}' не поддерживается`)
      return
    }
    try {
      respond(id, await handler(params ?? {}))
    } catch (error) {
      report(method, error)
      const code = typeof error?.code === "number" ? error.code : RpcError.internal
      respondError(id, code, error instanceof Error ? error.message : String(error))
    }
  }

  function report(method, error) {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(`ftsls: ошибка в обработчике '${method}': ${detail}\n`)
  }

  /**
   * Разобрать всё, что уже пришло. Неполное сообщение остаётся в буфере;
   * сломанный кадр отбрасывается, но соединение продолжает жить: редактор
   * не должен терять сервер из-за одного битого байта.
   */
  function drain() {
    for (;;) {
      const separator = buffer.indexOf(HEADER_SEPARATOR, 0, "ascii")
      if (separator < 0) return
      const header = buffer.subarray(0, separator).toString("ascii")
      const match = /content-length:\s*(\d+)/i.exec(header)
      if (!match) {
        buffer = buffer.subarray(separator + HEADER_SEPARATOR.length)
        write({ jsonrpc: "2.0", id: null, error: { code: RpcError.parse, message: "заголовок без Content-Length" } })
        continue
      }
      const length = Number(match[1])
      const start = separator + HEADER_SEPARATOR.length
      if (buffer.length < start + length) return
      const body = buffer.subarray(start, start + length)
      buffer = buffer.subarray(start + length)

      let message
      try {
        /* Невалидный UTF-8 не бросает исключение — Buffer подставляет U+FFFD,
           и разбор падает уже на JSON.parse. Оба случая обрабатываются одинаково. */
        message = JSON.parse(body.toString("utf8"))
      } catch (error) {
        write({
          jsonrpc: "2.0",
          id: null,
          error: { code: RpcError.parse, message: error instanceof Error ? error.message : String(error) },
        })
        continue
      }
      void dispatch(message)
    }
  }

  return {
    /** @param {string} method @param {(params: any) => any} handler */
    onRequest(method, handler) {
      requests.set(method, handler)
    },
    /** @param {string} method @param {(params: any) => any} handler */
    onNotification(method, handler) {
      notifications.set(method, handler)
    },
    /** @param {string} method @param {unknown} params */
    sendNotification(method, params) {
      write({ jsonrpc: "2.0", method, params })
    },
    listen() {
      input.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")])
        drain()
      })
      input.on("end", () => options.onExit?.())
      input.on("close", () => options.onExit?.())
      if (typeof input.resume === "function") input.resume()
    },
    dispose() {
      disposed = true
    },
  }
}
