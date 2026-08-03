/**
 * Воспроизводимый источник случайности с расщеплением потоков.
 *
 * Зачем это отдельный модуль. В SBSE нерепродуцируемость результатов —
 * известная болезнь: статья сообщает «ГА нашёл решение», а повторить прогон
 * нельзя, потому что случайность бралась из Math.random и зависела от порядка
 * вычислений. Здесь случайность — это данные: целое семя плюс имя потока.
 *
 * Почему splitmix64. Нужен генератор, у которого (а) состояние — одно 64-битное
 * слово, (б) есть дешёвая функция перемешивания, годная и как финализатор для
 * порождения дочерних семян. splitmix64 удовлетворяет обоим требованиям и
 * проходит статистические тесты, будучи при этом воспроизводимым до бита на
 * любой платформе — арифметика ведётся в BigInt с явной маской в 64 бита, а не
 * в double, где 2^53 сломало бы точность.
 *
 * Почему расщепление, а не один поток. Если вся эволюция черпает числа из
 * одного потока, результат зависит от ПОРЯДКА обращений: поменяли местами
 * мутацию и кроссовер — получили другой прогон при том же семени. Поэтому
 * каждой сущности (поколению, особи, операции) выдаётся собственный подпоток,
 * выведенный из имени: `fork("поколение:7").fork("мутация:3")`. Имя — это путь,
 * и он не зависит ни от порядка обхода, ни от того, сколько чисел взял сосед.
 * Следствие: параллельная реализация дала бы тот же ответ.
 */

const MASK = (1n << 64n) - 1n
const GAMMA = 0x9e3779b97f4a7c15n
const MIX_A = 0xbf58476d1ce4e5b9n
const MIX_B = 0x94d049bb133111ebn

/** Финализатор splitmix64: лавинообразно перемешивает 64 бита. */
function avalanche(value) {
  let z = value & MASK
  z = ((z ^ (z >> 30n)) * MIX_A) & MASK
  z = ((z ^ (z >> 27n)) * MIX_B) & MASK
  return (z ^ (z >> 31n)) & MASK
}

/**
 * FNV-1a по кодовым точкам имени потока.
 *
 * Кодовые точки, а не байты UTF-8, — потому что имена потоков русские, и
 * привязываться к кодировке незачем: нужна только детерминированная функция
 * строки в 64 бита.
 */
function hashLabel(label) {
  let hash = 0xcbf29ce484222325n
  const text = String(label)
  for (const character of text) {
    hash = (hash ^ BigInt(character.codePointAt(0))) & MASK
    hash = (hash * 0x100000001b3n) & MASK
  }
  return hash
}

/** Приведение произвольного семени к 64-битному слову без потери определённости. */
export function normalizeSeed(seed) {
  if (typeof seed === "bigint") return seed & MASK
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) throw new Error("семя должно быть конечным числом")
    if (!Number.isInteger(seed)) throw new Error("семя должно быть целым числом")
    return BigInt.asUintN(64, BigInt(seed))
  }
  if (typeof seed === "string") return hashLabel(seed)
  throw new Error("семя должно быть целым числом, BigInt или строкой")
}

/**
 * Поток псевдослучайных чисел.
 *
 * Курсор внутри потока мутируется — это осознанно: альтернатива (передавать
 * состояние наружу) превратила бы каждый оператор в возврат пары
 * «результат, новое состояние» и утопила бы читаемость. Гарантия сохраняется
 * другим способом: поток НИКОГДА не разделяется между двумя операциями, каждая
 * получает свой fork. Поэтому «чистота» операторов означает здесь: результат
 * однозначно определяется аргументами, включая имя потока.
 */
class Stream {
  constructor(seed) {
    this.seed = normalizeSeed(seed)
    this.cursor = 0n
  }

  /** Дочерний поток, однозначно определённый именем. Порядок вызовов не важен. */
  fork(label) {
    return new Stream(avalanche(this.seed ^ hashLabel(label) ^ GAMMA))
  }

  /** Копия потока в текущей позиции: нужна тестам, чтобы повторить выдачу. */
  clone() {
    const copy = new Stream(this.seed)
    copy.cursor = this.cursor
    return copy
  }

  nextUint64() {
    this.cursor = (this.cursor + GAMMA) & MASK
    return avalanche(this.seed + this.cursor)
  }

  /**
   * Равномерное [0, 1). Берутся старшие 53 бита — ровно мантисса double,
   * поэтому деление на 2^53 точно и не теряет младший бит.
   */
  nextFloat() {
    return Number(this.nextUint64() >> 11n) / 9007199254740992
  }

  /**
   * Целое из [min, max] включительно, без смещения.
   *
   * Обычное `next % range` смещает распределение к младшим значениям, когда
   * range не делит 2^64. Отбрасываем хвост, который не укладывается целым
   * числом раз, — цена в среднем меньше одного лишнего обращения.
   */
  nextInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("границы nextInt должны быть целыми")
    if (max < min) throw new Error("верхняя граница nextInt меньше нижней")
    const range = BigInt(max - min + 1)
    const limit = MASK - (MASK % range)
    let draw = this.nextUint64()
    while (draw > limit) draw = this.nextUint64()
    return min + Number(draw % range)
  }

  /** Признак с заданной вероятностью «да». */
  nextBool(probability = 0.5) {
    return this.nextFloat() < probability
  }

  /**
   * Стандартная нормаль по Бокс–Мюллеру.
   *
   * Вторая величина пары намеренно выбрасывается: кэш «остатка» — это скрытое
   * состояние, из-за которого выдача зависела бы от чётности числа вызовов, а
   * значит от истории потока. Один вызов = ровно два обращения к генератору.
   */
  nextGaussian() {
    let uniform = this.nextFloat()
    while (uniform <= Number.MIN_VALUE) uniform = this.nextFloat()
    const angle = 2 * Math.PI * this.nextFloat()
    return Math.sqrt(-2 * Math.log(uniform)) * Math.cos(angle)
  }

  /** Равновероятный элемент непустого массива. */
  pick(items) {
    if (!Array.isArray(items) || items.length === 0) throw new Error("pick требует непустой массив")
    return items[this.nextInt(0, items.length - 1)]
  }
}

/** Корневой поток прогона. Всё остальное получается из него через fork. */
export function createStream(seed) {
  return new Stream(seed)
}

export { Stream }
