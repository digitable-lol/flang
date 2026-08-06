/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { assertValid, compile, executeUtility, testUtilities } from "../../../dist/src/index.js"

export async function createDiscountService(modelFile) {
  const document = assertValid(compile(await readFile(modelFile, "utf8")))
  const tests = testUtilities(document)
  if (!tests.valid) throw new Error("FTS business examples failed")
  return (purchase) => executeUtility(document, "Рассчитать скидку", purchase)
}

export async function createDiscountServer(modelFile) {
  const calculate = await createDiscountService(modelFile)
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true })
      if (request.method !== "POST" || request.url !== "/discount") {
        return send(response, 404, { error: "use POST /discount" })
      }
      const purchase = JSON.parse(await readBody(request))
      return send(response, 200, { discount: calculate(purchase) })
    } catch (error) {
      return send(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error("request body exceeds 1 MB")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(`${JSON.stringify(body)}\n`)
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const modelFile = resolve(process.argv[2] ?? "examples/utilities/discount.fts")
  const port = Number.parseInt(process.env.FTS_HTTP_PORT ?? "8788", 10)
  const server = await createDiscountServer(modelFile)
  server.listen(port, "127.0.0.1", () => process.stdout.write(`Discount API: http://127.0.0.1:${port}\n`))
}
