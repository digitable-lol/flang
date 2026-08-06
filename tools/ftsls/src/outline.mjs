/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Разметка документа — из общего модуля `tools/locate`.
 *
 * Раньше она жила здесь целиком. Ту же самую задачу — «в какой строке и
 * колонке эта диагностика» — решали заново в GitHub Action, и решения успели
 * разойтись; теперь разметка одна на всех, а этот файл остался точкой, через
 * которую её видит сервер. Возможностям редактора (`features/*`) и поиску
 * (`lookup.mjs`) нужны те же правила чтения имён и ключевых фраз, что и
 * разметке, поэтому примитивы поверхности проходят насквозь.
 *
 * `scanDocument` — прежнее имя `outline`: сервер и его тесты знают разметку
 * под ним, и переименование ничего бы не добавило.
 */
export {
  COMPARISONS,
  PHRASES,
  canonicalType,
  locate,
  matchComparison,
  matchPhrase,
  outline,
  outline as scanDocument,
  readName,
  resolvePath,
  scanLines,
  toLspRange,
} from "../../locate/index.mjs"
