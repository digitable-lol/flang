/**
 * ftsvm — исполнитель программ FTS.
 *
 * Публичная поверхность:
 *   run(program, module, utility, input)      — интерпретация по IR
 *   compileUtility(program, module, utility)  — JIT: функция (input) => результат
 *   listUtilities(program, module?)           — что в программе вообще исполнимо
 *
 * Чего здесь нет и не будет: процессов, планировщика, почтовых ящиков,
 * таймеров, ввода-вывода. ftsvm исполняет чистые правила; всё, что связано
 * со временем и эффектами, — снаружи. См. README.md.
 */
export { FtsvmError, errorCode, vmError } from "./errors.mjs"
export { checkInput, findModule, findUtility, isOptional, listModules, listUtilities, matchesRuntimeType } from "./program.mjs"
export { evaluate, run } from "./interpreter.mjs"
export { compileUtility, generateSource, resetJitCache, runCompiled, sourceOf } from "./jit.mjs"

/* load-fts.mjs намеренно не реэкспортируется: он тянет вендорную сборку
   компилятора ядра, а исполнителю она не нужна. Кому нужен разбор `.fts`
   (тестам, бенчмарку), импортирует './load-fts.mjs' напрямую. */
