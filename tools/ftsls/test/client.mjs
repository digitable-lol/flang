/**
 * Минимальный клиент LSP для тестов: поднимает `bin/ftsls.mjs` подпроцессом
 * и разговаривает с ним по протоколу, а не через внутренние функции.
 *
 * Так проверяется именно то, что увидит редактор: кадрирование, порядок
 * сообщений, коды ошибок и завершение по `shutdown`/`exit`.
 */
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const BIN = resolve(fileURLToPath(new URL(".", import.meta.url)), "../bin/ftsls.mjs")

export function startClient(options = {}) {
  const child = spawn(process.execPath, [BIN, "--stdio"], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...options.env } })
  const pending = new Map()
  const notifications = []
  const waiters = []
  let stderr = ""
  let buffer = Buffer.alloc(0)
  let nextId = 1

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8")
  })

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const separator = buffer.indexOf("\r\n\r\n", 0, "ascii")
      if (separator < 0) return
      const match = /content-length:\s*(\d+)/i.exec(buffer.subarray(0, separator).toString("ascii"))
      if (!match) {
        buffer = buffer.subarray(separator + 4)
        continue
      }
      const length = Number(match[1])
      const start = separator + 4
      if (buffer.length < start + length) return
      const message = JSON.parse(buffer.subarray(start, start + length).toString("utf8"))
      buffer = buffer.subarray(start + length)
      deliver(message)
    }
  })

  function deliver(message) {
    if (message.id !== undefined && message.id !== null && pending.has(message.id)) {
      const { resolve: settle, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(Object.assign(new Error(message.error.message), { code: message.error.code, rpc: message.error }))
      else settle(message.result)
      return
    }
    notifications.push(message)
    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1)
        waiter.resolve(message)
      }
    }
  }

  function send(message) {
    const body = Buffer.from(JSON.stringify(message), "utf8")
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
    child.stdin.write(body)
  }

  return {
    child,
    get stderr() {
      return stderr
    },
    get notifications() {
      return notifications
    },
    request(method, params) {
      const id = nextId++
      const promise = new Promise((settle, reject) => pending.set(id, { resolve: settle, reject }))
      send({ jsonrpc: "2.0", id, method, params })
      return promise
    },
    notify(method, params) {
      send({ jsonrpc: "2.0", method, params })
    },
    /** Отправить произвольные байты — для проверки устойчивости транспорта. */
    raw(bytes) {
      child.stdin.write(bytes)
    },
    /** Дождаться уведомления, удовлетворяющего предикату. */
    wait(predicate, timeout = 5000) {
      const found = notifications.find(predicate)
      if (found) return Promise.resolve(found)
      return new Promise((settle, reject) => {
        const timer = setTimeout(() => reject(new Error("уведомление не пришло за отведённое время")), timeout)
        waiters.push({
          predicate,
          resolve: (message) => {
            clearTimeout(timer)
            settle(message)
          },
        })
      })
    },
    /** Дождаться следующей публикации диагностик для uri. */
    diagnostics(uri, after = 0) {
      let seen = 0
      return this.wait((message) => {
        if (message.method !== "textDocument/publishDiagnostics" || message.params.uri !== uri) return false
        seen += 1
        return seen > after
      })
    },
    exited() {
      return new Promise((settle) => {
        if (child.exitCode !== null) settle(child.exitCode)
        else child.on("exit", (code) => settle(code))
      })
    },
    async initialize(params = {}) {
      const result = await this.request("initialize", {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
        ...params,
      })
      this.notify("initialized", {})
      return result
    },
    open(uri, text, version = 1) {
      this.notify("textDocument/didOpen", { textDocument: { uri, languageId: "fts", version, text } })
    },
    change(uri, text, version) {
      this.notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: [{ text }] })
    },
    changeRange(uri, range, text, version) {
      this.notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: [{ range, text }] })
    },
    kill() {
      child.kill("SIGKILL")
    },
  }
}
