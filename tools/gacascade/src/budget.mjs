/**
 * Бюджет вычислений как явная величина.
 *
 * Источник: раздел 2.4 диссертации — N_max входит в само отображение каскада
 * D(t), G_t, X⁺, Θ, N_max → X*, θ*, c*, reason; раздел 2.4.1 — «Число оценок
 * увеличивается ровно на размер новой популяции. Это делает бюджет
 * сопоставимым между разными конфигурациями и менее зависимым от
 * быстродействия вычислительной среды»; раздел 2.4.3 — «Пилотные оценки GA1
 * входят в N*, поэтому каскад не получает дополнительного скрытого бюджета».
 *
 * ПОЧЕМУ БЮДЖЕТ — ОБЪЕКТ, А НЕ СЧЁТЧИК В ЦИКЛЕ. Бюджет один на весь прогон и
 * делится между уровнями. Пилоты GA1 и финальный GA2 списывают из одного и
 * того же кошелька, и никакой уровень не может «дозаказать» оценок. Если бы
 * каждый уровень вёл собственный счётчик, сравнение режимов пришлось бы
 * строить на доверии к арифметике в отчёте.
 *
 * ЧТО СЧИТАЕТСЯ ОЦЕНКОЙ. Одна оценка — один построенный и оценённый план,
 * независимо от того, сколько раз при этом вызван интерпретатор FTS и сколько
 * оценок пришло из кэша. Раздел 2.4.1 говорит «ровно на размер новой
 * популяции», то есть элитные особи, перенесённые без изменений, ТОЖЕ входят
 * в счёт. Так и сделано: это делает бюджет функцией размера популяции и числа
 * поколений, а не функцией удачливости кэша.
 */

export class Budget {
  /**
   * @param limit  N_max — общий бюджет оценок целевой функции
   * @param label  имя для сообщений об ошибках
   */
  constructor(limit, label = "бюджет") {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("бюджет должен быть положительным целым числом оценок")
    this.limit = limit
    this.spent = 0
    this.label = label
    this.ledger = []
  }

  get remaining() {
    return this.limit - this.spent
  }

  /** Хватит ли остатка на порцию из `amount` оценок. */
  canAfford(amount) {
    return amount > 0 && this.spent + amount <= this.limit
  }

  /**
   * Списание. Перерасход — это ошибка программиста, а не ситуация,
   * которую надо аккуратно обработать: он означает, что сравнение режимов
   * велось при разных N_max и таблица недействительна.
   */
  spend(amount, reason = "") {
    if (!Number.isInteger(amount) || amount < 0) throw new Error("списание бюджета должно быть неотрицательным целым")
    if (this.spent + amount > this.limit) {
      throw new Error(`${this.label}: перерасход ${this.spent + amount} при пределе ${this.limit}${reason ? ` (${reason})` : ""}`)
    }
    this.spent += amount
    if (reason) this.ledger.push({ "статья": reason, "оценок": amount })
    return this.spent
  }

  /**
   * Подбюджет с собственным пределом, списывающий из этого же кошелька.
   *
   * Нужен пилотам GA1: у каждого свой потолок, но общий кошелёк один.
   * Неизрасходованный остаток подбюджета (например, когда 128 оценок не
   * делятся нацело на популяцию 48) НЕ пропадает — он просто не был списан
   * с родителя и достаётся финальному GA2.
   */
  sub(limit, label) {
    return new SubBudget(this, Math.min(limit, this.remaining), label)
  }

  toJSON() {
    return { "предел": this.limit, "израсходовано": this.spent, "остаток": this.remaining, "статьи": this.ledger }
  }
}

class SubBudget {
  constructor(parent, limit, label) {
    this.parent = parent
    this.limit = limit
    this.label = label
    this.spent = 0
  }

  get remaining() {
    return this.limit - this.spent
  }

  canAfford(amount) {
    return amount > 0 && this.spent + amount <= this.limit
  }

  spend(amount) {
    if (this.spent + amount > this.limit) throw new Error(`${this.label}: перерасход подбюджета`)
    this.spent += amount
    this.parent.spend(amount, this.label)
    return this.spent
  }
}

/**
 * Распределение бюджета между уровнями каскада.
 *
 * Раздел 2.4.2: «На пилот каждому варианту выделяется не менее 128 оценок и
 * около 8% общего бюджета». Отсюда доля на один пилот:
 *
 *   N_pilot = max( pilotMin, round(pilotShare · N_max) ).
 *
 * Оба числа — ПАРАМЕТРЫ, а не константы в коде: распределение бюджета между
 * уровнями заявлено предметом эксперимента, и зашитая константа сделала бы
 * этот эксперимент невозможным. Значения по умолчанию взяты из текста.
 */
export const DEFAULT_PILOT_SHARE = 0.08
export const DEFAULT_PILOT_MIN = 128

export function planBudget({ total, configurations, pilotShare = DEFAULT_PILOT_SHARE, pilotMin = DEFAULT_PILOT_MIN }) {
  if (!Number.isInteger(total) || total < 1) throw new Error("общий бюджет должен быть положительным целым")
  if (!(pilotShare >= 0 && pilotShare <= 1)) throw new Error("доля пилота должна лежать в [0;1]")
  if (!Number.isInteger(pilotMin) || pilotMin < 0) throw new Error("минимум пилота должен быть неотрицательным целым")

  const perPilot = Math.max(pilotMin, Math.round(pilotShare * total))
  const pilotTotal = perPilot * configurations

  if (pilotTotal >= total) {
    throw new Error(
      `на пилоты GA1 приходится ${pilotTotal} оценок при общем бюджете ${total}: ` +
      "финальному GA2 не остаётся ничего; уменьшите --pilot-share/--pilot-min или увеличьте --budget",
    )
  }

  return {
    "общий бюджет": total,
    "на один пилот": perPilot,
    "на все пилоты": pilotTotal,
    "минимум финалу": total - pilotTotal,
    "доля пилота": pilotShare,
    "минимум пилота": pilotMin,
  }
}
