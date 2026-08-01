import { createServer } from "node:http"
import { pathToFileURL } from "node:url"
import { execute } from "./service.mjs"

const operations = new Set(["compile", "check", "certify", "verify"])

export function createFtsServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method !== "POST") return send(response, 405, { error: "use POST" })
      const operation = request.url?.match(/^\/v1\/(compile|check|certify|verify)$/)?.[1]
      if (!operation || !operations.has(operation)) return send(response, 404, { error: "unknown FTS endpoint" })
      const payload = JSON.parse(await readBody(request))
      return send(response, 200, execute(operation, payload))
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
  const port = Number.parseInt(process.env.FTS_HTTP_PORT ?? "8787", 10)
  createFtsServer().listen(port, "127.0.0.1", () => {
    process.stdout.write(`FTS HTTP server: http://127.0.0.1:${port}\n`)
  })
}
