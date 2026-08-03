/**
 * `tools/locate` — общая разметка документа FTS и приведение диагностик
 * к координатам в файле.
 *
 * Одну и ту же задачу — «в какой строке и колонке эта ошибка» — до сих пор
 * решали заново в языковом сервере (`tools/ftsls`) и в GitHub Action
 * (`.github/actions/fts-check`), и решения успели разойтись. Здесь она решена
 * один раз.
 *
 * Две функции составляют весь смысл модуля:
 *
 *   outline(source)                  — разметка документа с координатами
 *   locate(diagnostic, outline, opt) — диагностика → { line, column, ... }
 *
 * Остальное — примитивы поверхности, на которых держится разметка; они
 * открыты, потому что редакторским возможностям (автодополнение, наведение,
 * форматирование) нужны те же правила чтения имён и ключевых фраз, что и
 * разметке, и второй их копии заводить не следует.
 *
 * Зависимостей нет — ни внешних, ни на ядро: модуль читает только текст.
 * Именно поэтому им может пользоваться и языковой сервер, работающий с
 * несохранённым буфером, и Action, работающий с файлом на диске.
 */
export { outline } from "./src/outline.mjs"
export { classifyPath, locate, resolvePath, toLspRange } from "./src/locate.mjs"
export {
  BUILTIN_TYPES,
  COMPARISONS,
  PHRASES,
  canonicalType,
  matchComparison,
  matchPhrase,
  readName,
  scanLines,
  stripModuleHeader,
} from "./src/surface.mjs"
