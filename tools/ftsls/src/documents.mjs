/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Хранилище открытых документов и перевод «позиция ↔ смещение».
 *
 * LSP считает колонки в кодовых единицах UTF-16 — ровно так же, как их
 * считает JavaScript при индексации строки. Поэтому здесь нет собственной
 * арифметики кодировок: индекс строки JS и есть колонка LSP, и русские
 * имена в «ёлочках» позиционируются точно.
 *
 * Синхронизация инкрементальная (TextDocumentSyncKind.Incremental): сервер
 * объявляет её в capabilities и применяет диапазонные правки как splice.
 */

export class TextDocument {
  #text
  #lineStarts

  /**
   * @param {string} uri
   * @param {string} languageId
   * @param {number} version
   * @param {string} text
   */
  constructor(uri, languageId, version, text) {
    this.uri = uri
    this.languageId = languageId
    this.version = version
    this.#text = text
    this.#lineStarts = computeLineStarts(text)
  }

  get text() {
    return this.#text
  }

  /**
   * Применить правки didChange: либо полный текст, либо диапазоны.
   * @param {Array<{ range?: { start: { line: number, character: number }, end: { line: number, character: number } }, text: string }>} changes
   * @param {number} [version]
   */
  update(changes, version) {
    for (const change of changes ?? []) {
      if (!change || typeof change.text !== "string") continue
      if (!change.range) {
        this.#text = change.text
      } else {
        const start = this.#offsetAt(change.range.start)
        const end = this.#offsetAt(change.range.end)
        this.#text = this.#text.slice(0, start) + change.text + this.#text.slice(Math.max(start, end))
      }
      this.#lineStarts = computeLineStarts(this.#text)
    }
    if (typeof version === "number") this.version = version
  }

  /** Смещение в строке текста по позиции LSP. @param {{ line: number, character: number }} position */
  #offsetAt(position) {
    const line = clamp(position?.line ?? 0, 0, this.#lineStarts.length - 1)
    const start = this.#lineStarts[line]
    const end = line + 1 < this.#lineStarts.length ? this.#lineStarts[line + 1] : this.#text.length
    return clamp(start + (position?.character ?? 0), start, end)
  }

  /** Текст строки без перевода строки. @param {number} line */
  lineText(line) {
    if (line < 0 || line >= this.#lineStarts.length) return ""
    const start = this.#lineStarts[line]
    const end = line + 1 < this.#lineStarts.length ? this.#lineStarts[line + 1] : this.#text.length
    return this.#text.slice(start, end).replace(/\r?\n$/u, "")
  }
}

export class DocumentStore {
  #documents = new Map()

  /** @param {{ uri: string, languageId?: string, version?: number, text: string }} item */
  open(item) {
    const document = new TextDocument(item.uri, item.languageId ?? "fts", item.version ?? 0, item.text ?? "")
    this.#documents.set(item.uri, document)
    return document
  }

  /** @param {string} uri */
  get(uri) {
    return this.#documents.get(uri)
  }

  /** @param {string} uri */
  close(uri) {
    this.#documents.delete(uri)
  }
}

function computeLineStarts(text) {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1)
  }
  return starts
}

function clamp(value, low, high) {
  if (!Number.isFinite(value)) return low
  return Math.min(Math.max(value, low), high)
}
