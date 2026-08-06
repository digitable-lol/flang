/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import { diagnosticError } from "./diagnostics.js"
import { certify } from "./certificate.js"
import { prove } from "./interpreter.js"
import type { FtsDocument, PipelineInput, PipelineResult } from "./model.js"
import { compile, normalizeDocument } from "./parser.js"
import { assertValid } from "./validate.js"
import { visualize } from "./visualize.js"

export function pipeline(input: PipelineInput): PipelineResult {
  let rawDocument: FtsDocument
  if (typeof input.source === "string") {
    rawDocument = compile(input.source)
  } else if (input.document !== undefined) {
    rawDocument = normalizeDocument(input.document)
  } else {
    throw diagnosticError("FTS_PIPELINE_INPUT", "provide source or document")
  }

  const document = assertValid(rawDocument)
  const proof = document.proposition === null ? null : prove(document, input.context)
  const certificate = document.proposition === null ? null : certify(document, input.context)
  const viz = visualize(document, proof, input.viz ?? "all")
  return { document, proof, certificate, viz }
}
