/**
 * Воспроизводимый поток случайных чисел.
 *
 * Почему свой, а не Math.random: синтез обязан быть повторяемым. Одно семя —
 * один и тот же прогон, иначе ни отчёт, ни тест на воспроизводимость не имеют
 * смысла. Зависимостей у инструмента ноль, поэтому генератор здесь же.
 *
 * Алгоритм — mulberry32: 32 бита состояния, период 2^32, качества хватает для
 * эволюционного поиска и он тривиально переносим между рантаймами.
 */

// Почему FNV-1a: семя приходит из CLI строкой или числом, а состояние нужно
// 32-битное и хорошо перемешанное — иначе близкие семена дают близкие прогоны.
export function hashSeed(seed) {
  // «42» из командной строки и 42 из настроек по умолчанию обязаны давать один
  // прогон: иначе `--seed 42` молча отличался бы от значения по умолчанию.
  const numeric = typeof seed === "number" ? seed : Number(String(seed).trim())
  const source = Number.isFinite(numeric) && String(seed).trim() !== "" ? `n:${numeric}` : String(seed)
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function createRng(seed) {
  let state = hashSeed(seed)

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  const rng = {
    next,
    // Целое из [0, bound).
    int: (bound) => Math.floor(next() * bound),
    // Целое из [min, max] включительно.
    between: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
    shuffled: (items) => {
      const copy = items.slice()
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1))
        const swap = copy[index]
        copy[index] = copy[other]
        copy[other] = swap
      }
      return copy
    },
    // Отщепляемый независимый поток. Нужен, чтобы разбиение выборки не зависело
    // от того, сколько чисел израсходовала эволюция, и наоборот.
    fork: (label) => createRng(`${label}:${Math.floor(next() * 4294967296)}`),
  }
  return rng
}
