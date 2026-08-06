/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import type { FtsDocument, FtsFunctor, FtsProposition, FtsStructure } from "./model.js"

export type FtsObject = FtsStructure
export type FtsMorphism = FtsFunctor
export type FtsTheorem = FtsProposition

/** Human-facing object view over the version-1 canonical wire model. */
export function objects(document: FtsDocument): readonly FtsObject[] {
  return document.structures
}

/** Human-facing morphism view over the legacy `functors` wire field. */
export function morphisms(document: FtsDocument): readonly FtsMorphism[] {
  return document.functors
}

/** Human-facing theorem view over the legacy `proposition` wire field. */
export function theorem(document: FtsDocument): FtsTheorem | null {
  return document.proposition
}
