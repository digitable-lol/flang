#!/usr/bin/env node
/**
 * ftsls — сервер языка FTS (Language Server Protocol) поверх stdio.
 *
 * Один сервер обслуживает все редакторы: VS Code, Neovim, JetBrains, Zed,
 * Emacs и Helix. Запускается редактором, разговаривает по JSON-RPC на
 * stdin/stdout; stdout занят протоколом, поэтому всё человеческое —
 * в stderr.
 *
 *   ftsls            запустить сервер на stdio
 *   ftsls --stdio    то же самое (флаг принимают все редакторы)
 *   ftsls --version  версия сервера
 */
import { SERVER_NAME, SERVER_VERSION, createServer } from "../src/server.mjs"

const argv = process.argv.slice(2)

if (argv.includes("--version") || argv.includes("-v")) {
  process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`)
  process.exit(0)
}

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("ftsls [--stdio] — сервер языка FTS на stdio\n")
  process.exit(0)
}

const server = createServer()
server.listen()
process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION}: слушаю stdio\n`)
