/**
 * Бэкенд кодогенерации ftsc → Elixir (Erlang/OTP 29).
 *
 * Контракт бэкенда — tools/ftsc/SPEC.md, раздел 5. Коротко, что делает этот
 * файл (детали — в src/emit/elixir/*.mjs):
 *
 *   1. Каждая структура IR — вложенный `defmodule` с `defstruct`/`@type t`;
 *      опциональное поле («X | undefined») — `| nil` в типе.
 *   2. Каждая утилита — функция модуля. Правила — конвейер `|>` вместо
 *      `cond`/`case`: это единственная форма, где порядок правил и требование
 *      «выполняются все правила с истинным условием» видны без чтения
 *      описания — см. комментарий в src/emit/elixir/render.mjs.
 *   3. Свойства (постусловия) — `{:ok, значение} | {:error, %Ftsc.Runtime.Error{}}`
 *      из обычной функции плюс `!`-вариант, который бросает исключение.
 *   4. Примеры — тесты ExUnit (`test/<проект>/<модуль>_test.exs`).
 *   5. Ноль зависимостей: только стандартная библиотека Elixir/Erlang.
 *   6. Детерминированность: вход — только IR (никаких дат/случайности/обхода
 *      объектов в порядке хеш-таблицы — только массивы IR по порядку).
 *   7. Идентификаторы — src/naming.mjs; коллизии транслитерации — ошибка
 *      генерации (throw), не молчаливое переименование.
 *   8. Функтор между категориями — функция `A → B` в отдельном модуле.
 */
import { pascal, snake, createNamer } from "../naming.mjs"
import { escapeBidiBraced, escapeBidiInFiles } from "../bidi.mjs"
import { RESERVED_MODULES } from "./elixir/types.mjs"
import {
  buildRegistry,
  renderErrorModule,
  renderModuleFile,
  renderModuleTestFile,
  renderFunctorFile,
  renderFunctorTestFile,
} from "./elixir/render.mjs"

export const target = {
  id: "elixir",
  name: "Elixir",
  extension: ".ex",
  toolchain: {
    probe: ["elixir", "--version"],
    /* Проект не использует mix (генератор не печатает mix.exs — это не нужно
       для «нуля зависимостей» из SPEC.md). Компиляция и прогон тестов делаются
       напрямую инструментами Elixir:
         elixirc --warnings-as-errors -o <каталог для .beam> <все .ex из lib, рекурсивно>
       (порядок файлов в одном вызове elixirc неважен — компилятор сам находит
       и разрешает ссылки между ними за несколько проходов), а затем для
       каждого файла *_test.exs из test (рекурсивно) отдельно:
         elixir -pa <каталог с .beam> <файл теста>
       (отдельно — потому что ExUnit.start() внутри файла теста не рассчитан
       на повторный вызов в одном процессе). Ровно так это и проверяется в
       tools/ftsc/test/emit-elixir.test.mjs. Здесь — только иллюстративная
       команда для ftsc test. */
    test: ["elixir", "-pa", "_build", "test/**/*_test.exs"],
  },
}

/**
 * @param {object} program — IR (см. tools/ftsc/SPEC.md, раздел 4)
 * @param {{ projectName: string }} options
 * @returns {Array<{ path: string, content: string }>}
 */
export function emit(program, options) {
  if (program.ir !== 1) {
    throw new Error(`бэкенд elixir не понимает версию IR: ${program.ir}`)
  }

  const projectName = options?.projectName ?? program.project
  const projectPascal = pascal(projectName)
  const projectSnake = snake(projectName)

  /* Один именователь на модули категорий И на функторы: оба становятся
     соседними модулями `<Проект>.<Имя>`, поэтому коллизия между именем
     категории и именем функтора обязана быть поймана так же, как коллизия
     между двумя категориями. */
  const moduleNamer = createNamer(pascal, RESERVED_MODULES)
  const registry = buildRegistry(program, moduleNamer)

  const hasAnyUtility = program.modules.some((entry) => (entry.document.utilities ?? []).length > 0)

  const files = []

  /* Общий тип ошибки нужен, только если хоть одна утилита может вернуть
     {:error, _}; для чистых деклараций типов/морфизмов (test/fixtures/shipment)
     он был бы мёртвым кодом. */
  if (hasAnyUtility) {
    files.push({ path: "lib/ftsc/runtime/error.ex", content: renderErrorModule() })
  }

  for (const entry of program.modules) {
    const info = registry.get(entry.name)
    files.push({
      path: `lib/${projectSnake}/${info.snakeName}.ex`,
      content: renderModuleFile(entry, registry, projectPascal),
    })

    const testContent = renderModuleTestFile(entry, registry, projectPascal)
    if (testContent !== null) {
      files.push({
        path: `test/${projectSnake}/${info.snakeName}_test.exs`,
        content: testContent,
      })
    }
  }

  for (const functor of program.functors ?? []) {
    const functorPascal = moduleNamer(functor.name)
    const functorSnake = snake(functor.name)
    files.push({
      path: `lib/${projectSnake}/${functorSnake}.ex`,
      content: renderFunctorFile(functor, registry, projectPascal, functorPascal),
    })
    files.push({
      path: `test/${projectSnake}/${functorSnake}_test.exs`,
      content: renderFunctorTestFile(functor, registry, projectPascal, functorPascal),
    })
  }

  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий («# Правило «…».»), и в строковый литерал (имя примера в
     test/2 ExUnit, текст ошибки свойства). Для elixirc это отказ разбора и там, и
     там («invalid bidirectional formatting character in comment/string»): до этого
     фильтра напечатанный проект с таким именем не собирался вовсе. Форма Elixir —
     `\u{X…}`, её же предлагает сам компилятор в тексте отказа. */
  return escapeBidiInFiles(files, escapeBidiBraced)
}
