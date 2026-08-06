/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import type { FtsDocument, FtsProposition, FtsStructure, FtsValue, PathSegment } from "./model.js"

export function witnessDocument(options: {
  category: string
  structures: FtsStructure[]
  structure: string
  field: string
  selector?: Record<string, FtsValue>
  value?: FtsValue
  path?: PathSegment[]
  detail?: string
}): FtsDocument {
  const proposition: Extract<FtsProposition, { kind: "witness" }> = {
    kind: "witness",
    structure: options.structure,
    field: options.field,
  }
  if (options.selector !== undefined) proposition.selector = options.selector
  if (options.value !== undefined) proposition.value = options.value
  if (options.path !== undefined) proposition.path = options.path
  if (options.detail !== undefined) proposition.detail = options.detail
  return {
    category: options.category,
    structures: options.structures,
    functors: [],
    proposition,
    ts_compat: {},
  }
}

export function composeDocument(options: {
  category: string
  structures?: FtsStructure[]
  functors: FtsDocument["functors"]
  chain: string[]
  arg: FtsProposition
}): FtsDocument {
  return {
    category: options.category,
    structures: options.structures ?? [],
    functors: options.functors,
    proposition: { kind: "compose", functors: options.chain, arg: options.arg },
    ts_compat: {},
  }
}
