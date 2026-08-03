/**
 * Что делать, когда тулчейна целевого языка нет.
 *
 * Тест бэкенда доказывает кодогенерацию единственным способом: настоящий
 * компилятор принял порождённый код и примеры сошлись. Компилятора может не
 * быть — держать восемь тулчейнов на машине разработчика неразумно, — и тогда
 * тест честно пропускается, а не притворяется пройденным.
 *
 * Беда в том, что «пропущено» читается как «всё хорошо». Пока CI ставил один
 * лишь Node и не ставил ни Go, ни Rust, ни Elixir, ни .NET, девять тестов
 * пропускались молча: набор был зелёный, а кодогенерация под четыре языка не
 * проверялась автоматикой ни разу. Зелёный набор, который ничего не проверил, —
 * худший вид поломки: он выглядит как успех.
 *
 * Поэтому джоба, которая тулчейн ставит, обязана требовать его наличия. Ровно
 * это делает `FTS_REQUIRE_TOOLCHAINS`: пропуск превращается в падение с именем
 * языка, и по красному квадратику видно, чего именно не хватило.
 *
 *   FTS_REQUIRE_TOOLCHAINS=1        — обязательны все бэкенды («all», «true», «yes» — синонимы)
 *   FTS_REQUIRE_TOOLCHAINS=rust,go  — обязательны только перечисленные
 *   переменная не задана            — прежнее поведение: честный пропуск
 *
 * Идентификаторы — это `id` бэкендов из tools/ftsc/src/emit/*.mjs:
 * c, csharp, elixir, go, java, python, rust, typescript.
 */
import assert from "node:assert/strict"

const EVERYTHING = new Set(["1", "all", "true", "yes"])

/** Бэкенды, тулчейн которых обязан присутствовать в этом прогоне. */
export function requiredToolchains() {
  return String(process.env.FTS_REQUIRE_TOOLCHAINS ?? "")
    .split(/[,\s]+/u)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

/** Обязан ли тулчейн бэкенда `id` быть в системе. */
export function toolchainRequired(id) {
  const required = requiredToolchains()
  return required.some((item) => EVERYTHING.has(item) || item === String(id).toLowerCase())
}

/**
 * Единственная точка, где решается судьба отсутствующего тулчейна: пропуск или
 * падение. `reason` — прежнее человеческое объяснение; оно же попадает в текст
 * ошибки, чтобы по логу было понятно, что и где поставить.
 */
export function missingToolchain(t, id, reason) {
  if (toolchainRequired(id)) {
    assert.fail(
      `тулчейн «${id}» обязан быть в этой джобе (FTS_REQUIRE_TOOLCHAINS=${process.env.FTS_REQUIRE_TOOLCHAINS}), ` +
        `но его нет: ${reason}. Поставьте тулчейн, укажите каталог в FTS_TOOLCHAIN_PATH или уберите «${id}» ` +
        `из FTS_REQUIRE_TOOLCHAINS — молча пропустить этот тест нельзя.`,
    )
  }
  return t.skip(reason)
}
