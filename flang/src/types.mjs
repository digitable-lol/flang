/**
 * types.mjs — проверка и вывод типов flang.
 *
 * Вход — AST из SPEC.md, раздел 5 (формат менять нельзя). Выход — диагностики
 * в формате ядра FTS (`{ code, message, severity, span }`, см. src/validate.ts)
 * и таблица сигнатур функций.
 *
 * Почему здесь нет Хиндли — Милнера. Функции в flang не являются значениями
 * первого класса (SPEC, раздел 3), поэтому единственные места, где тип
 * действительно неизвестен, — это локальное `пусть`, элемент списка,
 * накопитель свёртки и пустой список. Всё остальное задано объявленной
 * сигнатурой. Унификация с переменными типов дала бы ту же силу вывода, но
 * сообщения об ошибках стали бы говорить о «t7 против t12» вместо «ветви
 * «если» разных типов» — для языка, где типы объявляются, это чистый проигрыш.
 * Поэтому проверка двунаправленная (bidirectional): `inferExpr(узел, среда,
 * ожидаемый)`. Ожидаемый тип течёт сверху вниз и решает единственный
 * по-настоящему неоднозначный случай — пустой список: `[]` в контексте
 * `список строки` получает тип `список строки`, а без контекста —
 * `список неизвестного`, который совместим с чем угодно и потому не даёт
 * каскада ложных ошибок.
 */

import { ACTION_TYPE_NAME, ADDRESSED_ACTIONS, STRATEGIES } from "./conc.mjs"

/** Тип-джокер: совместим со всем. Им гасятся каскады после первой ошибки. */
const UNKNOWN = Object.freeze({ kind: "unknown" })
const NUMBER = Object.freeze({ kind: "number" })
const STRING = Object.freeze({ kind: "string" })
const BOOLEAN = Object.freeze({ kind: "boolean" })
const NOTHING = Object.freeze({ kind: "null" })

/**
 * Псевдонимы имён скалярных типов. Английская и русская поверхности
 * компилируются в один AST (SPEC, раздел 4), а мост из FTS (`compat.mjs`)
 * приносит имена ядра — «Число», «Деньги», «Строка», «Дата», «Признак».
 * Все они означают ровно один тип, поэтому нормализуются здесь, а не в
 * каждом сравнении.
 */
const SCALAR_ALIASES = new Map([
  ["number", NUMBER], ["число", NUMBER], ["Число", NUMBER], ["Деньги", NUMBER],
  ["string", STRING], ["строка", STRING], ["Строка", STRING], ["Дата", STRING],
  ["boolean", BOOLEAN], ["признак", BOOLEAN], ["Признак", BOOLEAN], ["bool", BOOLEAN], ["flag", BOOLEAN],
  ["null", NOTHING], ["ничто", NOTHING], ["nothing", NOTHING], ["unit", NOTHING],
])

const LIST_KINDS = new Set(["list", "список"])
const NAMED_KINDS = new Set(["named", "ref", "record", "sum", "type", "запись", "сумма"])
/**
 * Вид типа, о котором сказать нечего. Не ошибка: мост из FTS (`compat.mjs`)
 * так переводит имена состояний («Скоринг пройден») — это маркеры
 * доказательств, а не значения, и ядро FTS их тоже не проверяет
 * (`matchesRuntimeType`). Отвергать их значило бы отвергать существующие
 * модели, что запрещено (SPEC, раздел 9).
 */
const WILDCARD_KINDS = new Set(["unknown", "any", "любое"])

const ARITHMETIC = new Set(["add", "sub", "mul", "div", "mod", "percent"])
const ORDERING = new Set(["gt", "lt", "gte", "lte"])
const EQUALITY = new Set(["eq", "neq"])

/** Встроенные формы: канонические имена и английские псевдонимы. */
const BUILTIN_ALIASES = new Map([
  ["длина", "длина"], ["length", "длина"],
  ["символ", "символ"], ["char", "символ"],
  ["символы", "символы"], ["разложить", "символы"], ["decompose", "символы"],
  ["подстрока", "подстрока"], ["substring", "подстрока"],
  ["соединить", "соединить"], ["join", "соединить"],
  ["разделить", "разделить"], ["split", "разделить"],
  ["содержит", "содержит"], ["contains", "содержит"],
  ["начинается с", "начинается с"], ["начинается", "начинается с"], ["startsWith", "начинается с"],
  ["к числу", "к числу"], ["toNumber", "к числу"],
  ["к строке", "к строке"], ["toString", "к строке"],
  ["голова", "голова"], ["head", "голова"],
  ["хвост", "хвост"], ["tail", "хвост"],
  ["пусто", "пусто"], ["isEmpty", "пусто"],
  ["добавить", "добавить"], ["append", "добавить"],
  // Арифметика приходит из парсера узлом `binary`, но в `builtins.mjs` те же
  // два действия есть и как формы: принимаем оба написания.
  ["остаток от", "остаток от"], ["modulo", "остаток от"],
  ["процентов от", "процентов от"], ["percent", "процентов от"],
])

/**
 * Проверка типов всей программы.
 *
 * @param {object} program AST модуля (SPEC, раздел 5)
 * @returns {{ ok: boolean, diagnostics: object[], types: Map<string, object> }}
 *   `types` — сигнатура каждой функции: `{ params, returns, total }` уже в
 *   нормализованных типах, чтобы вызывающему коду не пришлось разбирать AST
 *   типов второй раз.
 */
export function checkTypes(program) {
  const diagnostics = []
  const report = (code, message, node) => {
    diagnostics.push({ code, message, severity: "error", span: spanOf(node) })
  }

  const ctx = {
    report,
    records: new Map(),      // имя записи → Map<поле, Тип>
    sums: new Map(),         // имя суммы → Map<вариант, Map<поле, Тип>>
    variantOwner: new Map(), // имя варианта → имя суммы
    aliases: new Map(),      // имя псевдонима → объявление (узел `alias`)
    aliasTypes: new Map(),   // имя псевдонима → развёрнутый тип (мемоизация)
    aliasOpen: new Set(),    // псевдонимы в процессе развёртывания — ловушка цикла
    signatures: new Map(),
  }

  collectTypes(program, ctx)
  collectSignatures(program, ctx)
  /* Процессы собираются ДО проверки тел: адресат действия «отправить»
     сверяется с объявленными процессами прямо в теле обработчика, и знать о
     них к этому моменту уже надо. */
  checkProcesses(program, ctx)

  for (const fn of listFunctions(program)) {
    if (!isName(fn?.name)) continue
    checkFunction(fn, ctx)
  }

  checkMorphisms(program, ctx)
  checkFunctors(program, ctx)
  checkSupervisors(program, ctx)
  checkRuns(program, ctx)

  return { ok: diagnostics.length === 0, diagnostics, types: ctx.signatures }
}

/* ------------------------------------------------------------------ */
/* Морфизмы: стрелки категорий и их композиция                         */
/* ------------------------------------------------------------------ */

/**
 * Стыковка композиции — то немногое в теоркате, что компилятор ДОКАЗЫВАЕТ, а не
 * проверяет на примерах: `«в» это «б» после «а»` собирается тогда и только
 * тогда, когда кодомен «а» совпадает с доменом «б». Это утверждение обо всех
 * входах, и оно не требует ни сетки, ни решателя.
 *
 * Порядок математический: правая применяется первой. Отсюда домен композиции —
 * домен правой, кодомен — кодомен левой.
 *
 * Объекты категории — это типы, поэтому домен и кодомен обязаны быть
 * объявленной записью, суммой или псевдонимом: стрелка в несуществующий объект
 * бессмысленна, и молчать об этом нельзя.
 */
function checkMorphisms(program, ctx) {
  const морфизмы = Array.isArray(program?.morphisms) ? program.morphisms : []
  if (морфизмы.length === 0) return

  const стрелки = new Map()
  const объявлен = (имя) =>
    ctx.records.has(имя) || ctx.sums.has(имя) || ctx.aliases.has(имя)

  /* Первый проход — только стрелки: композиция вправе ссылаться на морфизм,
     объявленный ниже, ровно как функция вправе звать функцию ниже себя. */
  for (const узел of морфизмы) {
    if (узел?.kind !== "morphism") continue
    for (const [роль, имя] of [["домен", узел.domain], ["кодомен", узел.codomain]]) {
      if (!объявлен(имя)) {
        ctx.report(
          "FLANG_UNKNOWN_NAME",
          `${роль} морфизма «${узел.name}» — «${имя}» — не объявлен: объект категории это тип`,
          узел,
        )
      }
    }
    if (стрелки.has(узел.name)) {
      ctx.report("FLANG_DUPLICATE_NAME", `морфизм «${узел.name}» объявлен дважды`, узел)
      continue
    }
    стрелки.set(узел.name, { domain: узел.domain, codomain: узел.codomain })
  }

  /* Второй проход — композиции. Разрешаются по мере готовности: композиция от
     композиции законна, а цикл в определениях — ошибка, а не зависание. */
  const ждут = морфизмы.filter((узел) => узел?.kind === "composition")
  let сдвинулись = true
  while (сдвинулись && ждут.length > 0) {
    сдвинулись = false
    for (let i = ждут.length - 1; i >= 0; i -= 1) {
      const узел = ждут[i]
      const левая = стрелки.get(узел.left)
      const правая = стрелки.get(узел.right)
      if (левая === undefined || правая === undefined) continue

      ждут.splice(i, 1)
      сдвинулись = true

      if (правая.codomain !== левая.domain) {
        ctx.report(
          "FLANG_COMPOSE_MISMATCH",
          `композиция «${узел.name}» не стыкуется: «${узел.right}» приводит в «${правая.codomain}», ` +
            `а «${узел.left}» ожидает «${левая.domain}»`,
          узел,
        )
        continue
      }
      if (стрелки.has(узел.name)) {
        ctx.report("FLANG_DUPLICATE_NAME", `морфизм «${узел.name}» объявлен дважды`, узел)
        continue
      }
      стрелки.set(узел.name, { domain: правая.domain, codomain: левая.codomain })
    }
  }

  for (const узел of ждут) {
    const неизвестно = стрелки.has(узел.right) ? узел.left : узел.right
    ctx.report(
      "FLANG_UNKNOWN_NAME",
      `композиция «${узел.name}» ссылается на «${неизвестно}»: такого морфизма нет ` +
        `(или определения ходят по кругу)`,
      узел,
    )
  }

  ctx.morphisms = стрелки
}

/**
 * Функтор: отображение объектов и стрелок, обязанное сохранять устройство.
 *
 * Объявление функтора в языке было и раньше — `функтор «Ф» из «A» в «B»` с
 * блоком `объект … отображается в …` и `морфизм … отображается в морфизм …`.
 * Не было проверки: слово «функтор» стояло, а гарантии за ним не стояло
 * никакой. Здесь появляется гарантия.
 *
 * ЗАКОНЫ НЕ ВКЛЮЧАЮТСЯ ПО ЖЕЛАНИЮ. В контракте была строка `сохраняет
 * композицию` — отдельное разрешение на проверку. Она не сделана намеренно:
 * отображение, не сохраняющее композицию, функтором не является, и дать
 * написать это слово без закона значило бы продать имя вместо содержания.
 *
 * ЧТО ИМЕННО ДОКАЗЫВАЕТСЯ, а не проверяется на примерах. Всё нижеследующее —
 * утверждения обо всех входах, и берутся они из одних объявлений, без сетки и
 * без решателя. Это возможно ровно потому, что морфизм здесь объявление, а не
 * значение: у функций первого класса такой проверки не бывает.
 *
 *   1. согласование стрелки с объектами: если «ф» ведёт из «A» в «B», то её
 *      образ обязан вести из образа «A» в образ «B». Ровно та же стыковка, что
 *      у композиции, только через отображение;
 *   2. сохранение композиции: образ композиции обязан быть композицией образов
 *      в том же порядке;
 *   3. сохранение единиц: образ тождественного морфизма объекта обязан быть
 *      тождественным морфизмом его образа;
 *   4. отображение объектов однозначно — иначе это не функция.
 *
 * Чего проверка НЕ делает и делать не может: имена категорий («из «Продажи» в
 * «Биллинг»») остаются пометкой для читателя. Категория в языке не объявляется
 * отдельной сущностью, и утверждать, что объект принадлежит именно этой
 * категории, не на чем.
 */
function checkFunctors(program, ctx) {
  const наследие = Array.isArray(program?.legacy) ? program.legacy : []
  const функторы = наследие.filter((узел) => узел?.construct === "functorFile")
  if (функторы.length === 0) return

  const стрелки = ctx.morphisms instanceof Map ? ctx.morphisms : new Map()
  const морфизмы = Array.isArray(program?.morphisms) ? program.morphisms : []
  /* Композиции берутся из исходных узлов, а не из `стрелки`: там от композиции
     остались только домен и кодомен, а закону нужны имена сомножителей. */
  const композиции = new Map()
  for (const узел of морфизмы) {
    if (узел?.kind === "composition") композиции.set(узел.name, узел)
  }
  const единицы = new Map()
  for (const узел of морфизмы) {
    if (узел?.kind === "morphism" && узел.identity === true) единицы.set(узел.name, узел.domain)
  }

  for (const { value: функтор, span } of функторы) {
    const узел = { span }
    const образОбъекта = new Map()
    for (const пара of функтор.objects ?? []) {
      if (образОбъекта.has(пара.from)) {
        ctx.report(
          "FLANG_FUNCTOR_OBJECT_TWICE",
          `функтор «${функтор.name}»: объект «${пара.from}» отображается дважды — ` +
            `в «${образОбъекта.get(пара.from)}» и в «${пара.to}»; отображение объектов обязано быть однозначным`,
          узел,
        )
        continue
      }
      образОбъекта.set(пара.from, пара.to)
    }

    const образМорфизма = new Map()
    for (const пара of функтор.morphisms ?? []) образМорфизма.set(пара.from, пара.to)

    /* Закон 1: стрелка согласована с объектами. */
    for (const пара of функтор.morphisms ?? []) {
      const исходная = стрелки.get(пара.from)
      const образ = стрелки.get(пара.to)
      if (исходная === undefined) {
        ctx.report(
          "FLANG_UNKNOWN_NAME",
          `функтор «${функтор.name}» отображает «${пара.from}», но такого морфизма нет`,
          узел,
        )
        continue
      }
      if (образ === undefined) {
        ctx.report(
          "FLANG_UNKNOWN_NAME",
          `функтор «${функтор.name}» отображает «${пара.from}» в «${пара.to}», но морфизма «${пара.to}» нет`,
          узел,
        )
        continue
      }
      for (const [роль, конец] of [["домен", "domain"], ["кодомен", "codomain"]]) {
        const объект = исходная[конец]
        if (!образОбъекта.has(объект)) {
          ctx.report(
            "FLANG_FUNCTOR_OBJECT_MISSING",
            `функтор «${функтор.name}» отображает морфизм «${пара.from}», но не отображает его ${роль} ` +
              `«${объект}»: без образа объекта образ стрелки не с чем согласовать`,
            узел,
          )
          continue
        }
        const ожидается = образОбъекта.get(объект)
        if (образ[конец] !== ожидается) {
          ctx.report(
            "FLANG_FUNCTOR_ARROW_MISMATCH",
            `функтор «${функтор.name}»: «${пара.from}» имеет ${роль} «${объект}», его образ — «${ожидается}», ` +
              `но «${пара.to}» имеет ${роль} «${образ[конец]}»`,
            узел,
          )
        }
      }
    }

    /* Закон 2: образ композиции — композиция образов, в том же порядке. */
    for (const [имя, композиция] of композиции) {
      if (!образМорфизма.has(имя)) continue
      const образЛевой = образМорфизма.get(композиция.left)
      const образПравой = образМорфизма.get(композиция.right)
      if (образЛевой === undefined || образПравой === undefined) {
        const без = образЛевой === undefined ? композиция.left : композиция.right
        ctx.report(
          "FLANG_FUNCTOR_COMPOSITION",
          `функтор «${функтор.name}» отображает композицию «${имя}», но не отображает «${без}», ` +
            `из которой она собрана: закон сохранения композиции проверить не на чем`,
          узел,
        )
        continue
      }
      const образКомпозиции = композиции.get(образМорфизма.get(имя))
      if (образКомпозиции === undefined) {
        ctx.report(
          "FLANG_FUNCTOR_COMPOSITION",
          `функтор «${функтор.name}»: образ композиции «${имя}» — «${образМорфизма.get(имя)}» — сам композицией не объявлен, ` +
            `а обязан быть «${образЛевой}» после «${образПравой}»`,
          узел,
        )
        continue
      }
      if (образКомпозиции.left !== образЛевой || образКомпозиции.right !== образПравой) {
        ctx.report(
          "FLANG_FUNCTOR_COMPOSITION",
          `функтор «${функтор.name}» не сохраняет композицию: образ «${имя}» обязан быть ` +
            `«${образЛевой}» после «${образПравой}», а объявлен как «${образКомпозиции.left}» после «${образКомпозиции.right}»`,
          узел,
        )
      }
    }

    /* Закон 3: образ единицы — единица образа. */
    for (const [имя, объект] of единицы) {
      if (!образМорфизма.has(имя)) continue
      if (!образОбъекта.has(объект)) continue
      const ожидается = `единица ${образОбъекта.get(объект)}`
      if (образМорфизма.get(имя) !== ожидается) {
        ctx.report(
          "FLANG_FUNCTOR_IDENTITY",
          `функтор «${функтор.name}» не сохраняет единицы: образ «${имя}» обязан быть «${ожидается}», ` +
            `а объявлен «${образМорфизма.get(имя)}»`,
          узел,
        )
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Конкурентность: процессы, надзор, прогоны                           */
/* ------------------------------------------------------------------ */

/**
 * Процессы (flang/conc/SPEC.md, шаг 1).
 *
 * Проверяется то, ради чего процесс вообще объявлением, а не значением:
 * обработчик — обычная функция языка, и его сигнатуру можно сверить с
 * объявлением до запуска. Три утверждения проверяются здесь и все три —
 * утверждения обо всех входах, а не о примерах.
 *
 *   1. обработчик принимает ровно объявленный тип состояния и объявленный тип
 *      сообщения, в этом порядке;
 *   2. обработчик возвращает отклик — запись ровно из двух полей: «состояние»
 *      того же типа и «действия» — список «Действие»;
 *   3. обработчик без признака `тотальная` обязан назвать запас витков.
 *
 * Третье — ошибка, а не предупреждение, и это записано в контракте («Что
 * проверяется и чем», пункт 4). Причина не в строгости ради строгости:
 * обработчик, про который не известно ни что он завершается, ни сколько ему
 * отпущено, держит свой процесс неограниченно долго, и планировщику нечего
 * противопоставить. Предупреждение здесь означало бы «мы знаем, что программа
 * может встать, и разрешаем это молча».
 */
function checkProcesses(program, ctx) {
  const процессы = Array.isArray(program?.processes) ? program.processes : []
  ctx.processes = new Map()
  if (процессы.length === 0) return

  for (const узел of процессы) {
    if (!isName(узел?.name)) {
      ctx.report("FLANG_PROCESS", "объявление процесса требует имени", узел)
      continue
    }
    if (ctx.processes.has(узел.name)) {
      ctx.report("FLANG_PROCESS", `процесс «${узел.name}» объявлен дважды`, узел)
      continue
    }

    const состояние = namedOnly(узел.state, ctx, узел, `состояние процесса «${узел.name}»`)
    const сообщение = namedOnly(узел.accepts, ctx, узел, `тип сообщений процесса «${узел.name}»`)
    ctx.processes.set(узел.name, { node: узел, state: состояние, accepts: сообщение })

    checkInitial(узел, состояние, ctx)
    checkHandler(узел, состояние, сообщение, ctx)
  }
}

/**
 * Начальное состояние — функция без параметров.
 *
 * Не литерал и не выражение: перезапуск обязан давать ровно то же значение, что
 * и первый запуск (контракт, «Отказ, надзор, перезапуск»), а функция без
 * параметров — самая короткая запись «одно и то же значение всякий раз»,
 * которая при этом проверяется по типу и печатается в C прямо.
 */
function checkInitial(узел, состояние, ctx) {
  const signature = ctx.signatures.get(узел.initial)
  if (!signature) {
    ctx.report(
      "FLANG_UNKNOWN_NAME",
      `процесс «${узел.name}» начинает с «${String(узел.initial)}», но такой функции нет`,
      узел,
    )
    return
  }
  if (signature.params.length !== 0) {
    ctx.report(
      "FLANG_PROCESS",
      `начальное состояние «${signature.name}» процесса «${узел.name}» принимает ${signature.params.length} арг.: ` +
        `начальное состояние — это значение, поэтому функция обязана быть без параметров`,
      узел,
    )
  }
  if (!sameType(signature.returns, состояние)) {
    ctx.report(
      "FLANG_TYPE",
      `начальное состояние «${signature.name}» процесса «${узел.name}» даёт ${typeName(signature.returns)}, ` +
        `а состояние объявлено как ${typeName(состояние)}`,
      узел,
    )
  }
}

function checkHandler(узел, состояние, сообщение, ctx) {
  const signature = ctx.signatures.get(узел.handler)
  if (!signature) {
    ctx.report(
      "FLANG_UNKNOWN_NAME",
      `процесс «${узел.name}» обрабатывает «${String(узел.handler)}», но такой функции нет`,
      узел,
    )
    return
  }

  if (signature.params.length !== 2) {
    ctx.report(
      "FLANG_TYPE",
      `обработчик «${signature.name}» процесса «${узел.name}» принимает ${signature.params.length} арг., ` +
        `а обязан принимать два: состояние и сообщение`,
      узел,
    )
  } else {
    const ожидается = [
      ["состояние", состояние],
      ["сообщение", сообщение],
    ]
    ожидается.forEach(([роль, тип], индекс) => {
      const параметр = signature.params[индекс]
      if (!sameType(параметр.type, тип)) {
        ctx.report(
          "FLANG_TYPE",
          `обработчик «${signature.name}» процесса «${узел.name}»: ${роль} объявлено как ${typeName(тип)}, ` +
            `а параметр «${параметр.name}» имеет тип ${typeName(параметр.type)}`,
          узел,
        )
      }
    })
  }

  checkResponse(узел, signature, состояние, ctx)

  /* Запас витков — единственный ответ на «обработчик может не завершиться»,
     который у планировщика есть. Нет доказательства и нет запаса — программа
     не собирается. */
  if (!signature.total && узел.budget === null) {
    ctx.report(
      "FLANG_HANDLER_NOT_TOTAL",
      `обработчик «${signature.name}» процесса «${узел.name}» не помечен тотальным, поэтому обязан назвать запас: ` +
        `«обрабатывает «${signature.name}» с запасом N витков». Без запаса и без доказательства завершения ` +
        `процесс может держать себя сколь угодно долго, и планировщику нечего этому противопоставить`,
      узел,
    )
  }
  if (узел.budget !== null && (!Number.isInteger(узел.budget) || узел.budget <= 0)) {
    ctx.report(
      "FLANG_PROCESS",
      `запас витков процесса «${узел.name}» — ${узел.budget}: ожидалось целое положительное число`,
      узел,
    )
  }
}

/** Отклик: запись ровно из «состояние» и «действия». */
function checkResponse(узел, signature, состояние, ctx) {
  const отклик = signature.returns
  if (!отклик || отклик.kind === "unknown") return
  if (отклик.kind !== "record") {
    ctx.report(
      "FLANG_TYPE",
      `обработчик «${signature.name}» процесса «${узел.name}» возвращает ${typeName(отклик)}, ` +
        `а обязан возвращать отклик — запись с полями «состояние» и «действия»`,
      узел,
    )
    return
  }
  const поля = ctx.records.get(отклик.name)
  if (!поля) return

  const состояниеОтклика = поля.get("состояние")
  if (состояниеОтклика === undefined) {
    ctx.report(
      "FLANG_TYPE",
      `отклик «${отклик.name}» обработчика «${signature.name}» не имеет поля «состояние»`,
      узел,
    )
  } else if (!sameType(состояниеОтклика, состояние)) {
    ctx.report(
      "FLANG_TYPE",
      `поле «состояние» отклика «${отклик.name}» имеет тип ${typeName(состояниеОтклика)}, ` +
        `а состояние процесса «${узел.name}» объявлено как ${typeName(состояние)}`,
      узел,
    )
  }

  const действия = поля.get("действия")
  if (действия === undefined) {
    ctx.report(
      "FLANG_TYPE",
      `отклик «${отклик.name}» обработчика «${signature.name}» не имеет поля «действия»`,
      узел,
    )
  } else if (действия.kind !== "list" || действия.of?.name !== ACTION_TYPE_NAME) {
    ctx.report(
      "FLANG_TYPE",
      `поле «действия» отклика «${отклик.name}» имеет тип ${typeName(действия)}, ` +
        `а обязано быть списком «${ACTION_TYPE_NAME}»`,
      узел,
    )
  }
}

/**
 * Имя типа и только имя: состояние и сообщение процесса обязаны быть
 * объявленной записью или суммой. Скаляр здесь запрещён намеренно — состояние
 * процесса, которое является числом, невозможно ни расширить, ни прочитать по
 * имени поля, а перезапуск такого процесса неотличим от его продолжения.
 */
function namedOnly(name, ctx, at, label) {
  if (!isName(name)) {
    ctx.report("FLANG_PROCESS", `${label} требует имени типа`, at)
    return UNKNOWN
  }
  if (ctx.records.has(name)) return { kind: "record", name }
  if (ctx.sums.has(name)) return { kind: "sum", name }
  if (ctx.aliases.has(name)) return expandAlias(name, ctx)
  ctx.report("FLANG_UNKNOWN_NAME", `${label}: неизвестный тип «${name}»`, at)
  return UNKNOWN
}

/**
 * Действие с адресатом: `отправить` и `через`.
 *
 * Здесь проверяется то, что делает объявление процесса не украшением, а
 * контрактом: адресат обязан быть объявленным процессом, а сообщение — того
 * типа, который этот процесс объявил в `принимает`. Тип поля «что» в словаре
 * действий — джокер (полиморфизма в языке нет), поэтому без этой сверки
 * отправка была бы нетипизированной вовсе.
 *
 * Адресат обязан быть литералом. Это ограничение шага 1, и оно записано в
 * контракте: имя процесса как значение (открытый вопрос «Именование процессов»)
 * ещё не решено, а проверять адресата, вычисленного в рантайме, нечем.
 *
 * Возвращает найденный процесс — его `принимает` становится ожидаемым типом
 * поля «что». Сверять груз здесь нельзя: `constructType` всё равно обойдёт поля
 * варианта, и второй проход по тому же выражению удвоил бы диагностики.
 */
function addresseeOf(expr, ctx) {
  const адресат = (expr.fields ?? {})["кому"]
  if (адресат === undefined) return null
  if (адресат.kind !== "literal" || typeof адресат.value !== "string") {
    ctx.report(
      "FLANG_PROCESS",
      `действие «${expr.variant}»: адресат обязан быть именем объявленного процесса, ` +
        `записанным прямо здесь — вычисленное имя проверить нечем`,
      адресат,
    )
    return null
  }
  const процесс = ctx.processes.get(адресат.value)
  if (процесс === undefined) {
    const известные = [...ctx.processes.keys()].map((имя) => `«${имя}»`).join(", ")
    ctx.report(
      "FLANG_UNKNOWN_PROCESS",
      `действие «${expr.variant}» адресовано «${адресат.value}», но такой процесс не объявлен` +
        (известные === "" ? "" : `; объявлены ${известные}`),
      expr,
    )
    return null
  }
  return процесс
}

/**
 * Надзор. Проверяется, что под надзором стоят объявленные процессы и что
 * стратегия — одна из трёх названных контрактом.
 *
 * Чего здесь НЕТ: самого надзора. Планировщик эталона шага 1 стратегий не
 * применяет — упавший процесс остаётся остановленным. Объявление разбирается и
 * проверяется, но за ним пока не стоит поведения, и это записано в контракте.
 */
function checkSupervisors(program, ctx) {
  const надзоры = Array.isArray(program?.supervisors) ? program.supervisors : []
  if (надзоры.length === 0) return
  const процессы = ctx.processes instanceof Map ? ctx.processes : new Map()

  const стратегия = (имя, узел, где) => {
    if (!STRATEGIES.includes(имя)) {
      ctx.report(
        "FLANG_PROCESS",
        `${где}: стратегия «${имя}» неизвестна; их три — ${STRATEGIES.map((s) => `«${s}»`).join(", ")}`,
        узел,
      )
    }
  }

  const виденные = new Set()
  for (const узел of надзоры) {
    if (виденные.has(узел.name)) ctx.report("FLANG_PROCESS", `надзор «${узел.name}» объявлен дважды`, узел)
    виденные.add(узел.name)

    const подНадзором = new Set()
    for (const запись of узел.watch ?? []) {
      if (!процессы.has(запись.process)) {
        ctx.report(
          "FLANG_UNKNOWN_PROCESS",
          `надзор «${узел.name}» следит за «${запись.process}», но такой процесс не объявлен`,
          запись,
        )
      }
      if (подНадзором.has(запись.process)) {
        ctx.report(
          "FLANG_PROCESS",
          `надзор «${узел.name}» называет процесс «${запись.process}» дважды: стратегия обязана быть одна`,
          запись,
        )
      }
      подНадзором.add(запись.process)
      стратегия(запись.strategy, запись, `надзор «${узел.name}» за «${запись.process}»`)
    }

    const порог = узел.threshold
    if (порог === null || порог === undefined) continue
    стратегия(порог.otherwise, порог, `порог отказов надзора «${узел.name}»`)
    for (const [поле, подпись] of [["failures", "число отказов"], ["window", "окно в миллисекундах"]]) {
      if (!Number.isInteger(порог[поле]) || порог[поле] <= 0) {
        ctx.report(
          "FLANG_PROCESS",
          `порог отказов надзора «${узел.name}»: ${подпись} — ${порог[поле]}, ожидалось целое положительное число`,
          порог,
        )
      }
    }
  }
}

/**
 * Прогон — пример конкурентной программы: семя, входные сообщения, итог.
 * Сообщение сверяется с `принимает` адресата, ожидаемое состояние — с
 * объявленным типом состояния. Ровно то же, что делает `checkExamples` для
 * обычной функции, и по той же причине.
 */
function checkRuns(program, ctx) {
  const прогоны = Array.isArray(program?.runs) ? program.runs : []
  if (прогоны.length === 0) return
  const процессы = ctx.processes instanceof Map ? ctx.processes : new Map()

  for (const прогон of прогоны) {
    const label = `прогон «${прогон.name}»`
    if (!Number.isInteger(прогон.seed) || прогон.seed < 0) {
      ctx.report("FLANG_PROCESS", `${label}: семя ${прогон.seed} — ожидалось целое неотрицательное число`, прогон)
    }
    if (процессы.size === 0) {
      ctx.report("FLANG_PROCESS", `${label} записан, но в программе не объявлено ни одного процесса`, прогон)
      continue
    }

    for (const запись of прогон.inbox ?? []) {
      const процесс = процессы.get(запись.process)
      if (процесс === undefined) {
        ctx.report("FLANG_UNKNOWN_PROCESS", `${label}: процесс «${запись.process}» не объявлен`, запись)
        continue
      }
      checkValue(запись.message, процесс.accepts, `${label}: сообщение процессу «${запись.process}»`, ctx, запись)
    }
    for (const ожидание of прогон.expected ?? []) {
      const процесс = процессы.get(ожидание.process)
      if (процесс === undefined) {
        ctx.report("FLANG_UNKNOWN_PROCESS", `${label}: процесс «${ожидание.process}» не объявлен`, ожидание)
        continue
      }
      checkValue(ожидание.state, процесс.state, `${label}: ожидаемое состояние «${ожидание.process}»`, ctx, ожидание)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Объявления                                                          */
/* ------------------------------------------------------------------ */

function listFunctions(program) {
  return Array.isArray(program?.functions) ? program.functions : []
}

function collectTypes(program, ctx) {
  const declarations = Array.isArray(program?.types) ? program.types : []

  // Первый проход: только имена. Тип может ссылаться на объявленный ниже
  // (дерево: «Узел» содержит список «Узел»), поэтому поля разбираются вторым
  // проходом, когда все имена уже известны.
  for (const declaration of declarations) {
    if (!isName(declaration?.name)) {
      ctx.report("FLANG_TYPE", "объявление типа требует имени", declaration)
      continue
    }
    if (ctx.records.has(declaration.name) || ctx.sums.has(declaration.name) || ctx.aliases.has(declaration.name)) {
      ctx.report("FLANG_TYPE", `тип «${declaration.name}» объявлен дважды`, declaration)
      continue
    }
    if (declaration.kind === "sum") ctx.sums.set(declaration.name, new Map())
    /* Псевдоним (`тип «Числа» это список числа`) — не новый тип, а второе имя
       уже существующего. Своей таблицы полей у него нет и быть не может:
       раньше он попадал в `records` и притворялся записью без полей, из-за чего
       `свёртка элементы` по значению объявленного псевдонима сообщала, что
       получила «Числа», а не список. Разворачивается он в `namedOrScalar`. */
    else if (declaration.kind === "alias") ctx.aliases.set(declaration.name, declaration)
    else ctx.records.set(declaration.name, new Map())
  }

  for (const declaration of declarations) {
    if (!isName(declaration?.name)) continue
    if (declaration.kind === "alias") {
      /* Разворачиваем сразу, чтобы «неизвестный тип» в правой части псевдонима
         был назван даже тогда, когда сам псевдоним нигде не используется. */
      if (ctx.aliases.get(declaration.name) === declaration) expandAlias(declaration.name, ctx)
      continue
    }
    if (declaration.kind === "sum") {
      const variants = ctx.sums.get(declaration.name)
      if (!variants) continue
      for (const variant of declaration.variants ?? []) {
        if (!isName(variant?.name)) {
          ctx.report("FLANG_TYPE", `сумма «${declaration.name}» содержит вариант без имени`, declaration)
          continue
        }
        if (variants.has(variant.name)) {
          ctx.report("FLANG_TYPE", `вариант «${variant.name}» объявлен в «${declaration.name}» дважды`, declaration)
          continue
        }
        // Имена вариантов уникальны на весь модуль: конструктор
        // `Вариант с полем …` не называет сумму, значит по имени варианта
        // должна однозначно находиться сумма. Иначе тип конструктора
        // зависел бы от контекста, которого в AST нет.
        const owner = ctx.variantOwner.get(variant.name)
        if (owner) {
          ctx.report("FLANG_TYPE", `вариант «${variant.name}» объявлен и в «${owner}», и в «${declaration.name}»: имена вариантов должны быть уникальны`, declaration)
        }
        ctx.variantOwner.set(variant.name, declaration.name)
        variants.set(variant.name, fieldMap(variant.fields, ctx, declaration))
      }
      continue
    }
    ctx.records.set(declaration.name, fieldMap(declaration.fields, ctx, declaration))
  }
}

function fieldMap(fields, ctx, at) {
  const result = new Map()
  for (const field of fields ?? []) {
    if (!isName(field?.name)) {
      ctx.report("FLANG_TYPE", "поле требует имени", at)
      continue
    }
    if (result.has(field.name)) {
      ctx.report("FLANG_TYPE", `поле «${field.name}» объявлено дважды`, at)
      continue
    }
    result.set(field.name, normalizeType(field.type, ctx, at))
  }
  return result
}

function collectSignatures(program, ctx) {
  for (const fn of listFunctions(program)) {
    if (!isName(fn?.name)) {
      ctx.report("FLANG_TYPE", "функция требует имени", fn)
      continue
    }
    if (ctx.signatures.has(fn.name)) {
      ctx.report("FLANG_TYPE", `функция «${fn.name}» объявлена дважды`, fn)
      continue
    }
    const params = []
    const seen = new Set()
    for (const param of fn.params ?? []) {
      if (!isName(param?.name)) {
        ctx.report("FLANG_TYPE", `функция «${fn.name}» имеет параметр без имени`, fn)
        continue
      }
      if (seen.has(param.name)) {
        ctx.report("FLANG_TYPE", `функция «${fn.name}» объявляет параметр «${param.name}» дважды`, fn)
        continue
      }
      seen.add(param.name)
      params.push({ name: param.name, type: normalizeType(param.type, ctx, fn) })
    }
    ctx.signatures.set(fn.name, {
      name: fn.name,
      params,
      returns: normalizeType(fn.returns, ctx, fn),
      total: fn.total === true,
    })
  }
}

/**
 * Тип из AST → внутреннее представление.
 * Принимает и голую строку («число»), и узел `{ kind }`: парсер пишется
 * параллельно, а мост из FTS приносит типы строками.
 */
function normalizeType(node, ctx, at) {
  if (node === null || node === undefined) return UNKNOWN
  if (typeof node === "string") return namedOrScalar(node, ctx, at)

  const kind = typeof node.kind === "string" ? node.kind : ""
  // Пометка «может отсутствовать» переживает и потерю самого типа: «о типе
  // сказать нечего» и «поля может не быть» — разные утверждения, и второе
  // не следует из первого. Отсюда `optional` и на ветках-джокерах.
  if (WILDCARD_KINDS.has(kind)) return optional(UNKNOWN, node)
  // `{ kind: "named", state: true }` — имя состояния из наследия FTS
  // («является состоянием «Скоринг пройден»»). Это маркер доказательства,
  // а не тип значения: проверять по нему нечего, но и ошибкой он не является.
  // «иногда является состоянием» — тот же маркер, но необязательный.
  if (node.state === true) return optional(UNKNOWN, node)
  if (SCALAR_ALIASES.has(kind)) return optional(SCALAR_ALIASES.get(kind), node)
  if (LIST_KINDS.has(kind)) {
    const element = node.of ?? node.item ?? node.элемент
    if (element === undefined) {
      ctx.report("FLANG_TYPE", "тип «список» требует типа элемента", at)
      return UNKNOWN
    }
    return optional({ kind: "list", of: normalizeType(element, ctx, at) }, node)
  }
  if (NAMED_KINDS.has(kind) || (kind === "" && isName(node.name))) {
    return optional(namedOrScalar(node.name ?? node.type, ctx, at), node)
  }
  ctx.report("FLANG_TYPE", `неизвестный вид типа «${kind || String(node.kind)}»`, at)
  return UNKNOWN
}

/**
 * Пометка «может отсутствовать» (`Тип | undefined` в FTS). На совместимость
 * типов она не влияет — значение типа `T` годится и там, где допустимо
 * отсутствие, — но проверка значений в примерах обязана пропускать `ничто`
 * и не требовать необязательное поле записи.
 *
 * Пометка ставится и на джокер: `{ kind: "unknown", optional: true }` —
 * законный тип («о типе сказать нечего, но поля может не быть»), а не
 * противоречие. Раньше здесь стояло `type.kind === "unknown"` — и всякое
 * необязательное поле-состояние FTS считалось обязательным.
 */
function optional(type, node) {
  if (node?.optional !== true) return type
  // UNKNOWN — замороженный синглтон, поэтому именно копия, а не мутация.
  return { ...type, optional: true }
}

function namedOrScalar(name, ctx, at) {
  if (SCALAR_ALIASES.has(name)) return SCALAR_ALIASES.get(name)
  if (!isName(name)) {
    ctx.report("FLANG_TYPE", "тип требует имени", at)
    return UNKNOWN
  }
  if (ctx.records.has(name)) return { kind: "record", name }
  if (ctx.sums.has(name)) return { kind: "sum", name }
  if (ctx.aliases.has(name)) return expandAlias(name, ctx)
  ctx.report("FLANG_UNKNOWN_NAME", `неизвестный тип «${name}»`, at)
  return UNKNOWN
}

/**
 * Развёртывание псевдонима в тот тип, которым он назван. Мемоизация нужна не
 * ради скорости, а ради одинакового результата: тип возвращается один и тот же
 * объект, сколько бы раз имя ни встретилось.
 *
 * Цикл (`тип «А» это «Б»`, `тип «Б» это «А»`) развернуть нельзя — бесконечный
 * тип не существует. Сообщаем и отдаём джокер: одна диагностика вместо
 * переполнения стека.
 */
function expandAlias(name, ctx) {
  if (ctx.aliasTypes.has(name)) return ctx.aliasTypes.get(name)
  const declaration = ctx.aliases.get(name)
  if (ctx.aliasOpen.has(name)) {
    ctx.report("FLANG_TYPE", `псевдоним «${name}» определён через самого себя`, declaration)
    ctx.aliasTypes.set(name, UNKNOWN)
    return UNKNOWN
  }
  ctx.aliasOpen.add(name)
  const type = normalizeType(declaration.of ?? declaration.type, ctx, declaration)
  ctx.aliasOpen.delete(name)
  /* Цикл мог записать джокер, пока мы разворачивались, — не затираем его. */
  if (!ctx.aliasTypes.has(name)) ctx.aliasTypes.set(name, type)
  return ctx.aliasTypes.get(name)
}

/* ------------------------------------------------------------------ */
/* Типы: сравнение и печать                                            */
/* ------------------------------------------------------------------ */

function sameType(a, b) {
  if (!a || !b) return true
  if (a.kind === "unknown" || b.kind === "unknown") return true
  if (a.kind !== b.kind) return false
  if (a.kind === "list") return sameType(a.of, b.of)
  if (a.kind === "record" || a.kind === "sum") return a.name === b.name
  return true
}

/* Экспортируется ради наведения в редакторе: сигнатуру функции там показывает
   языковой сервер, и называть типы он обязан теми же словами, какими называет
   их диагностика. Иначе у языка появился бы второй словарь — тот же довод, по
   которому оболочка печатает значения поверхностью языка. */
export function typeName(type) {
  if (!type) return "неизвестный тип"
  if (type.optional === true) return `${typeName({ ...type, optional: false })} или ничто`
  switch (type.kind) {
    case "number": return "число"
    case "string": return "строка"
    case "boolean": return "признак"
    case "null": return "ничто"
    // «список числа», а не «список число»: так тип пишется в исходнике
    // (SPEC, раздел 3), и сообщение можно скопировать в объявление.
    case "list": return `список ${genitive(type.of)}`
    case "record": case "sum": return `«${type.name}»`
    default: return "неизвестный тип"
  }
}

const GENITIVE = new Map([["number", "числа"], ["string", "строки"], ["boolean", "признака"], ["null", "ничего"]])

function genitive(type) {
  if (!type) return "неизвестного"
  if (GENITIVE.has(type.kind)) return GENITIVE.get(type.kind)
  if (type.kind === "list") return `списка ${genitive(type.of)}`
  if (type.kind === "record" || type.kind === "sum") return `«${type.name}»`
  return "неизвестного"
}

/** Скаляр ли: только по скалярам разрешено сравнение на равенство. */
function isScalarType(type) {
  return type.kind === "number" || type.kind === "string" || type.kind === "boolean" || type.kind === "null"
}

/* ------------------------------------------------------------------ */
/* Функции                                                             */
/* ------------------------------------------------------------------ */

function checkFunction(fn, ctx) {
  const signature = ctx.signatures.get(fn.name)
  if (!signature) return
  const env = new Map()
  for (const param of signature.params) env.set(param.name, param.type)

  const where = `функция «${fn.name}»`
  const body = fn.body === undefined ? null : fn.body
  if (body === null) {
    ctx.report("FLANG_TYPE", `${where} не имеет тела`, fn)
  } else {
    const actual = inferExpr(body, env, signature.returns, ctx, fn.name)
    if (!sameType(actual, signature.returns)) {
      ctx.report("FLANG_TYPE", `${where} объявлена как ${typeName(signature.returns)}, а тело даёт ${typeName(actual)}`, body)
    }
  }

  checkExamples(fn, signature, ctx)
}

function checkExamples(fn, signature, ctx) {
  for (const example of fn.examples ?? []) {
    const label = isName(example?.name) ? `пример «${example.name}»` : "пример"
    const args = example?.args ?? {}
    for (const param of signature.params) {
      if (!(param.name in args)) {
        // Необязательный аргумент можно не задавать: отсутствие — это `ничто`,
        // а не пропуск. Ядро FTS считает так же (`requiredFields`
        // в `src/validate.ts` исключает поля с `| undefined`).
        if (param.type.optional !== true) {
          ctx.report("FLANG_TYPE", `${label} функции «${fn.name}» не задаёт аргумент «${param.name}»`, example)
        }
        continue
      }
      checkValue(args[param.name], param.type, `${label}: аргумент «${param.name}»`, ctx, example)
    }
    for (const given of Object.keys(args)) {
      if (!signature.params.some((param) => param.name === given)) {
        ctx.report("FLANG_UNKNOWN_NAME", `${label} функции «${fn.name}» задаёт неизвестный аргумент «${given}»`, example)
      }
    }
    checkValue(example?.expected, signature.returns, `${label}: ожидаемое значение`, ctx, example)
  }
}

/**
 * Значение (из примера) против типа. Значения — обычный JSON, поэтому вариант
 * суммы приходится узнавать по форме: `{ вариант: "Слово", … }` либо
 * `{ variant: "Слово", fields: { … } }`. Обе формы приняты сознательно —
 * SPEC фиксирует AST, но не сериализацию значений.
 */
function checkValue(value, type, label, ctx, at) {
  if (!type || type.kind === "unknown") return
  if (type.optional === true && (value === null || value === undefined)) return
  const bad = () => ctx.report("FLANG_TYPE", `${label} не соответствует типу ${typeName(type)}`, at)
  switch (type.kind) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) bad()
      return
    case "string":
      if (typeof value !== "string") bad()
      return
    case "boolean":
      if (typeof value !== "boolean") bad()
      return
    case "null":
      if (value !== null) bad()
      return
    case "list":
      if (!Array.isArray(value)) { bad(); return }
      value.forEach((item, index) => checkValue(item, type.of, `${label}[${index}]`, ctx, at))
      return
    case "record": {
      const fields = ctx.records.get(type.name)
      if (!isPlainObject(value) || !fields) { bad(); return }
      for (const [name, fieldType] of fields) {
        if (!(name in value)) {
          if (fieldType.optional !== true) ctx.report("FLANG_TYPE", `${label}: не задано поле «${name}» записи «${type.name}»`, at)
          continue
        }
        checkValue(value[name], fieldType, `${label}.${name}`, ctx, at)
      }
      for (const name of Object.keys(value)) {
        if (!fields.has(name)) ctx.report("FLANG_TYPE", `${label}: запись «${type.name}» не имеет поля «${name}»`, at)
      }
      return
    }
    case "sum": {
      if (!isPlainObject(value)) { bad(); return }
      const variantName = value["вариант"] ?? value.variant
      const variants = ctx.sums.get(type.name)
      if (!isName(variantName) || !variants || !variants.has(variantName)) {
        ctx.report("FLANG_TYPE", `${label}: ожидался вариант типа «${type.name}»`, at)
        return
      }
      const declared = variants.get(variantName)
      const payload = isPlainObject(value["поля"] ?? value.fields)
        ? (value["поля"] ?? value.fields)
        : omit(value, ["вариант", "variant"])
      for (const [name, fieldType] of declared) {
        if (!(name in payload)) {
          ctx.report("FLANG_TYPE", `${label}: вариант «${variantName}» требует поле «${name}»`, at)
          continue
        }
        checkValue(payload[name], fieldType, `${label}.${name}`, ctx, at)
      }
      return
    }
    default:
      return
  }
}

/* ------------------------------------------------------------------ */
/* Выражения                                                           */
/* ------------------------------------------------------------------ */

/**
 * Двунаправленный вывод: `expected` — тип, которого ждёт контекст (или null).
 * Он нужен только там, где выражение само по себе неоднозначно (пустой
 * список), и как «якорь» для ветвей `если`/`разбор`, чтобы ошибка называла
 * объявленный тип, а не первую попавшуюся ветвь.
 */
function inferExpr(expr, env, expected, ctx, fnName) {
  if (!expr || typeof expr !== "object") {
    ctx.report("FLANG_TYPE", "ожидалось выражение", expr)
    return UNKNOWN
  }
  switch (expr.kind) {
    case "literal": return literalType(expr, ctx)
    case "var": return varType(expr, env, ctx)
    case "field": return fieldType(expr, env, ctx, fnName)
    case "let": {
      const valueType = inferExpr(expr.value, env, null, ctx, fnName)
      if (!isName(expr.name)) {
        ctx.report("FLANG_TYPE", "«пусть» требует имени", expr)
        return inferExpr(expr.in, env, expected, ctx, fnName)
      }
      const inner = new Map(env)
      inner.set(expr.name, valueType)
      return inferExpr(expr.in, inner, expected, ctx, fnName)
    }
    case "if": {
      const cond = inferExpr(expr.cond, env, BOOLEAN, ctx, fnName)
      if (!sameType(cond, BOOLEAN)) {
        ctx.report("FLANG_TYPE", `условие «если» должно быть признаком, а не ${typeName(cond)}`, expr.cond ?? expr)
      }
      const thenType = inferExpr(expr.then, env, expected, ctx, fnName)
      const elseType = inferExpr(expr.else, env, expected ?? thenType, ctx, fnName)
      if (!sameType(thenType, elseType)) {
        ctx.report("FLANG_TYPE", `ветви «если» разных типов: ${typeName(thenType)} и ${typeName(elseType)}`, expr)
        return expected ?? UNKNOWN
      }
      return thenType.kind === "unknown" ? elseType : thenType
    }
    case "call": return callType(expr, env, ctx, fnName)
    case "binary": return binaryType(expr, env, ctx, fnName)
    case "construct": return constructType(expr, env, ctx, fnName)
    case "record": return recordType(expr, env, ctx, fnName)
    case "list": return listType(expr, env, expected, ctx, fnName)
    case "match": return matchType(expr, env, expected, ctx, fnName)
    case "fold": return foldType(expr, env, ctx, fnName)
    case "map": return mapType(expr, env, expected, ctx, fnName)
    case "filter": return filterType(expr, env, ctx, fnName)
    case "builtin": return builtinType(expr, env, ctx, fnName)
    default:
      ctx.report("FLANG_TYPE", `неизвестный вид выражения «${String(expr.kind)}»`, expr)
      return UNKNOWN
  }
}

function literalType(expr, ctx) {
  const value = expr.value
  if (typeof value === "number" && Number.isFinite(value)) return NUMBER
  if (typeof value === "string") return STRING
  if (typeof value === "boolean") return BOOLEAN
  if (value === null) return NOTHING
  ctx.report("FLANG_TYPE", `литерал ${JSON.stringify(value)} не является скаляром`, expr)
  return UNKNOWN
}

function varType(expr, env, ctx) {
  if (!isName(expr.name) || !env.has(expr.name)) {
    ctx.report("FLANG_UNKNOWN_NAME", `имя «${String(expr.name)}» не связано`, expr)
    return UNKNOWN
  }
  return env.get(expr.name)
}

function fieldType(expr, env, ctx, fnName) {
  const target = inferExpr(expr.target, env, null, ctx, fnName)
  if (target.kind === "unknown") return UNKNOWN
  if (target.kind !== "record") {
    ctx.report("FLANG_TYPE", `доступ к полю «${String(expr.field)}» требует записи, а не ${typeName(target)}`, expr)
    return UNKNOWN
  }
  const fields = ctx.records.get(target.name)
  if (!fields?.has(expr.field)) {
    ctx.report("FLANG_TYPE", `запись «${target.name}» не имеет поля «${String(expr.field)}»`, expr)
    return UNKNOWN
  }
  return fields.get(expr.field)
}

function callType(expr, env, ctx, fnName) {
  const signature = ctx.signatures.get(expr.name)
  const args = Array.isArray(expr.args) ? expr.args : []
  if (!signature) {
    ctx.report("FLANG_UNKNOWN_NAME", `неизвестная функция «${String(expr.name)}»`, expr)
    for (const arg of args) inferExpr(arg, env, null, ctx, fnName)
    return UNKNOWN
  }
  if (args.length !== signature.params.length) {
    ctx.report("FLANG_TYPE", `функция «${signature.name}» принимает ${signature.params.length} арг. (${signature.params.map((p) => `«${p.name}»`).join(", ") || "нет"}), а вызвана с ${args.length}`, expr)
  }
  args.forEach((arg, index) => {
    const param = signature.params[index]
    const actual = inferExpr(arg, env, param?.type ?? null, ctx, fnName)
    if (param && !sameType(actual, param.type)) {
      ctx.report("FLANG_TYPE", `аргумент «${param.name}» функции «${signature.name}»: ожидался ${typeName(param.type)}, получен ${typeName(actual)}`, arg)
    }
  })
  return signature.returns
}

function binaryType(expr, env, ctx, fnName) {
  const op = expr.op
  if (ARITHMETIC.has(op)) {
    checkOperand(expr.left, env, NUMBER, ctx, fnName, op, "левый")
    checkOperand(expr.right, env, NUMBER, ctx, fnName, op, "правый")
    return NUMBER
  }
  if (op === "concat") {
    checkOperand(expr.left, env, STRING, ctx, fnName, op, "левый")
    checkOperand(expr.right, env, STRING, ctx, fnName, op, "правый")
    return STRING
  }
  if (ORDERING.has(op)) {
    const left = inferExpr(expr.left, env, null, ctx, fnName)
    const right = inferExpr(expr.right, env, left, ctx, fnName)
    /*
     * Упорядочены ТОЛЬКО числа. Это не выбор проверки типов, а факт про язык:
     * порядок задан в одном месте — `compare` ядра FTS (`src/utility.ts`), и
     * оно бросает «сравнения порядка допустимы только для чисел» на всём
     * остальном. Ровно то же делают `interpret.mjs` (`order`) и печать в JS
     * (`$ord`). Пропуская сюда строки, проверка обещала бы то, чего ни один
     * исполнитель не умеет: программа проходила бы `check` и падала при
     * запуске. Лексикографический порядок строк пришлось бы сначала завести
     * в ядре — а до тех пор его здесь нет.
     */
    for (const [type, side, node] of [[left, "левый", expr.left], [right, "правый", expr.right]]) {
      if (type.kind !== "unknown" && type.kind !== "number") {
        ctx.report("FLANG_TYPE", `${side} операнд сравнения «${op}» имеет тип ${typeName(type)}: сравнения порядка допустимы только для чисел`, node ?? expr)
      }
    }
    if (!sameType(left, right)) {
      ctx.report("FLANG_TYPE", `сравнение «${op}» между ${typeName(left)} и ${typeName(right)}`, expr)
    }
    return BOOLEAN
  }
  if (EQUALITY.has(op)) {
    const left = inferExpr(expr.left, env, null, ctx, fnName)
    const right = inferExpr(expr.right, env, left, ctx, fnName)
    if (!sameType(left, right)) {
      ctx.report("FLANG_TYPE", `сравнение «${op}» между ${typeName(left)} и ${typeName(right)}`, expr)
    } else if (left.kind !== "unknown" && !isScalarType(left)) {
      ctx.report("FLANG_TYPE", `сравнивать на равенство можно только скаляры, а не ${typeName(left)}`, expr)
    }
    return BOOLEAN
  }
  ctx.report("FLANG_TYPE", `неизвестная операция «${String(op)}»`, expr)
  inferExpr(expr.left, env, null, ctx, fnName)
  inferExpr(expr.right, env, null, ctx, fnName)
  return UNKNOWN
}

function checkOperand(node, env, want, ctx, fnName, op, side) {
  const actual = inferExpr(node, env, want, ctx, fnName)
  if (!sameType(actual, want)) {
    ctx.report("FLANG_TYPE", `${side} операнд «${op}»: ожидался ${typeName(want)}, получен ${typeName(actual)}`, node ?? undefined)
  }
  return actual
}

function constructType(expr, env, ctx, fnName) {
  const owner = ctx.variantOwner.get(expr.variant)
  const given = expr.fields ?? {}
  /* Действие с адресатом: адресат сверяется с объявленными процессами, а тип
     груза берётся у адресата, а не из словаря действий — там он джокер, потому
     что полиморфизма в языке нет. */
  const адресат =
    owner === ACTION_TYPE_NAME && ADDRESSED_ACTIONS.has(expr.variant) && ctx.processes?.size > 0
      ? addresseeOf(expr, ctx)
      : null
  if (!owner) {
    ctx.report("FLANG_UNKNOWN_NAME", `неизвестный конструктор варианта «${String(expr.variant)}»`, expr)
    for (const value of Object.values(given)) inferExpr(value, env, null, ctx, fnName)
    return UNKNOWN
  }
  const declared = ctx.sums.get(owner).get(expr.variant)
  for (const [name, type] of declared) {
    if (!(name in given)) {
      ctx.report("FLANG_TYPE", `конструктор «${expr.variant}» требует поле «${name}» (${typeName(type)})`, expr)
      continue
    }
    const wanted = адресат !== null && name === "что" ? адресат.accepts : type
    const actual = inferExpr(given[name], env, wanted, ctx, fnName)
    if (!sameType(actual, wanted)) {
      ctx.report("FLANG_TYPE", `поле «${name}» варианта «${expr.variant}»: ожидался ${typeName(wanted)}, получен ${typeName(actual)}`, given[name])
    }
  }
  for (const name of Object.keys(given)) {
    if (!declared.has(name)) {
      ctx.report("FLANG_TYPE", `вариант «${expr.variant}» типа «${owner}» не имеет поля «${name}»`, expr)
      inferExpr(given[name], env, null, ctx, fnName)
    }
  }
  return { kind: "sum", name: owner }
}

function recordType(expr, env, ctx, fnName) {
  const fields = ctx.records.get(expr.type)
  const given = expr.fields ?? {}
  if (!fields) {
    ctx.report("FLANG_UNKNOWN_NAME", `неизвестная запись «${String(expr.type)}»`, expr)
    for (const value of Object.values(given)) inferExpr(value, env, null, ctx, fnName)
    return UNKNOWN
  }
  for (const [name, type] of fields) {
    if (!(name in given)) {
      if (type.optional !== true) ctx.report("FLANG_TYPE", `запись «${expr.type}» требует поле «${name}» (${typeName(type)})`, expr)
      continue
    }
    const actual = inferExpr(given[name], env, type, ctx, fnName)
    if (!sameType(actual, type)) {
      ctx.report("FLANG_TYPE", `поле «${name}» записи «${expr.type}»: ожидался ${typeName(type)}, получен ${typeName(actual)}`, given[name])
    }
  }
  for (const name of Object.keys(given)) {
    if (!fields.has(name)) {
      ctx.report("FLANG_TYPE", `запись «${expr.type}» не имеет поля «${name}»`, expr)
      inferExpr(given[name], env, null, ctx, fnName)
    }
  }
  return { kind: "record", name: expr.type }
}

/**
 * Список однороден. Тип пустого списка берётся из контекста; если контекста
 * нет — `список неизвестного`, совместимый с любым списком. Это не «дырка»
 * в проверке: единственное, что можно сделать с пустым списком без контекста,
 * — вернуть его или передать дальше, и там контекст уже появится.
 */
function listType(expr, env, expected, ctx, fnName) {
  const items = Array.isArray(expr.items) ? expr.items : []
  const wanted = expected && expected.kind === "list" ? expected.of : null
  if (items.length === 0) return { kind: "list", of: wanted ?? UNKNOWN }

  let element = wanted
  items.forEach((item, index) => {
    const actual = inferExpr(item, env, element, ctx, fnName)
    if (!element || element.kind === "unknown") {
      element = actual
      return
    }
    if (!sameType(actual, element)) {
      ctx.report("FLANG_TYPE", `список неоднороден: элемент ${index + 1} имеет тип ${typeName(actual)}, а список — ${typeName(element)}`, item)
    }
  })
  return { kind: "list", of: element ?? UNKNOWN }
}

/* ------------------------------------------------------------------ */
/* Разбор                                                              */
/* ------------------------------------------------------------------ */

function matchType(expr, env, expected, ctx, fnName) {
  const target = inferExpr(expr.target, env, null, ctx, fnName)
  const cases = Array.isArray(expr.cases) ? expr.cases : []
  const covered = { empty: false, cons: false, any: false, variants: new Set(), literals: new Set() }
  let result = expected ?? null

  for (const branch of cases) {
    const pattern = branch?.pattern
    // Недостижимость — синтаксическое свойство порядка случаев: всё после
    // «любое» и всякий повтор уже покрытого образца выполниться не может.
    if (covered.any) {
      ctx.report("FLANG_MATCH_UNREACHABLE", "случай недостижим: предыдущий случай «любое» покрывает всё", branch)
    } else if (isCovered(pattern, covered)) {
      ctx.report("FLANG_MATCH_UNREACHABLE", `случай ${patternName(pattern)} недостижим: он уже разобран выше`, branch)
    }
    markCovered(pattern, covered)

    const inner = bindPattern(pattern, target, env, ctx, branch, fnName)
    const bodyType = inferExpr(branch?.body, inner, result, ctx, fnName)
    if (!result) result = bodyType
    else if (!sameType(result, bodyType)) {
      ctx.report("FLANG_TYPE", `случаи разбора разных типов: ${typeName(result)} и ${typeName(bodyType)}`, branch?.body ?? branch)
    }
  }

  reportExhaustiveness(expr, target, covered, cases.length, ctx)
  return result ?? UNKNOWN
}

function isCovered(pattern, covered) {
  switch (pattern?.kind) {
    case "empty": return covered.empty
    case "cons": return covered.cons
    case "variant": return covered.variants.has(pattern.name)
    case "literal": return covered.literals.has(JSON.stringify(pattern.value ?? null))
    default: return false
  }
}

function markCovered(pattern, covered) {
  switch (pattern?.kind) {
    case "empty": covered.empty = true; break
    case "cons": covered.cons = true; break
    case "variant": if (isName(pattern.name)) covered.variants.add(pattern.name); break
    case "literal": covered.literals.add(JSON.stringify(pattern.value ?? null)); break
    case "any": covered.any = true; break
    default: break
  }
}

function patternName(pattern) {
  switch (pattern?.kind) {
    case "empty": return "«пусто»"
    case "cons": return "«голова и хвост»"
    case "variant": return `«${String(pattern.name)}»`
    case "literal": return `литерал ${JSON.stringify(pattern.value ?? null)}`
    case "any": return "«любое»"
    default: return "образец"
  }
}

function bindPattern(pattern, target, env, ctx, at, fnName) {
  const inner = new Map(env)
  switch (pattern?.kind) {
    case "empty":
      if (target.kind !== "unknown" && target.kind !== "list") {
        ctx.report("FLANG_TYPE", `образец «пусто» применим к списку, а разбирается ${typeName(target)}`, at)
      }
      return inner
    case "cons": {
      if (target.kind !== "unknown" && target.kind !== "list") {
        ctx.report("FLANG_TYPE", `образец «голова и хвост» применим к списку, а разбирается ${typeName(target)}`, at)
        return inner
      }
      const element = target.kind === "list" ? target.of : UNKNOWN
      if (isName(pattern.head)) inner.set(pattern.head, element)
      if (isName(pattern.tail)) inner.set(pattern.tail, { kind: "list", of: element })
      return inner
    }
    case "variant": {
      if (target.kind === "unknown") return inner
      if (target.kind !== "sum") {
        ctx.report("FLANG_TYPE", `образец «${String(pattern.name)}» применим к сумме, а разбирается ${typeName(target)}`, at)
        return inner
      }
      const variants = ctx.sums.get(target.name)
      if (!variants?.has(pattern.name)) {
        const owner = ctx.variantOwner.get(pattern.name)
        if (owner) ctx.report("FLANG_TYPE", `вариант «${pattern.name}» принадлежит типу «${owner}», а разбирается «${target.name}»`, at)
        else ctx.report("FLANG_UNKNOWN_NAME", `неизвестный вариант «${String(pattern.name)}»`, at)
        return inner
      }
      const declared = variants.get(pattern.name)
      for (const [field, alias] of Object.entries(pattern.bind ?? {})) {
        if (!declared.has(field)) {
          ctx.report("FLANG_TYPE", `вариант «${pattern.name}» не имеет поля «${field}»`, at)
          continue
        }
        if (isName(alias)) inner.set(alias, declared.get(field))
      }
      return inner
    }
    case "literal": {
      const literal = literalType({ kind: "literal", value: pattern.value ?? null, span: pattern.span }, ctx)
      if (!sameType(literal, target)) {
        ctx.report("FLANG_TYPE", `образец-литерал имеет тип ${typeName(literal)}, а разбирается ${typeName(target)}`, at)
      }
      return inner
    }
    case "any":
      if (isName(pattern.bind)) inner.set(pattern.bind, target)
      return inner
    default:
      ctx.report("FLANG_TYPE", `неизвестный вид образца «${String(pattern?.kind)}»`, at)
      return inner
  }
}

/**
 * Исчерпывающность. Для суммы — все варианты; для списка — «пусто» и
 * «голова и хвост»; для признака — оба литерала; для остальных скаляров
 * перечислить значения нельзя, поэтому требуется «любое».
 */
function reportExhaustiveness(expr, target, covered, caseCount, ctx) {
  if (covered.any) return
  if (caseCount === 0) {
    ctx.report("FLANG_MATCH_NOT_EXHAUSTIVE", "разбор без случаев не покрывает ничего", expr)
    return
  }
  if (target.kind === "unknown") return

  if (target.kind === "sum") {
    const variants = ctx.sums.get(target.name) ?? new Map()
    const missing = [...variants.keys()].filter((name) => !covered.variants.has(name))
    if (missing.length > 0) {
      ctx.report("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор «${target.name}» не покрывает ${missing.map((name) => `«${name}»`).join(", ")}`, expr)
    }
    return
  }
  if (target.kind === "list") {
    const missing = []
    if (!covered.empty) missing.push("«пусто»")
    if (!covered.cons) missing.push("«голова и хвост»")
    if (missing.length > 0) {
      ctx.report("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор списка не покрывает ${missing.join(" и ")}`, expr)
    }
    return
  }
  if (target.kind === "boolean") {
    const missing = ["true", "false"].filter((value) => !covered.literals.has(value))
    if (missing.length > 0) {
      ctx.report("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор признака не покрывает ${missing.join(" и ")}`, expr)
    }
    return
  }
  ctx.report("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор ${typeName(target)} перечислением не исчерпать: добавьте случай «любое»`, expr)
}

/* ------------------------------------------------------------------ */
/* Встроенные формы                                                    */
/* ------------------------------------------------------------------ */

function collectionOf(node, env, ctx, fnName, form) {
  const over = inferExpr(node, env, null, ctx, fnName)
  if (over.kind === "unknown") return UNKNOWN
  if (over.kind !== "list") {
    ctx.report("FLANG_BUILTIN_ARGS", `«${form}» работает со списком, а получен ${typeName(over)}`, node ?? undefined)
    return UNKNOWN
  }
  return over.of
}

function mapType(expr, env, expected, ctx, fnName) {
  const element = collectionOf(expr.over, env, ctx, fnName, "отобразить")
  if (!isName(expr.item)) {
    ctx.report("FLANG_BUILTIN_ARGS", "«отобразить» требует имени элемента", expr)
    return UNKNOWN
  }
  const inner = new Map(env)
  inner.set(expr.item, element)
  const wanted = expected && expected.kind === "list" ? expected.of : null
  const body = inferExpr(expr.body, inner, wanted, ctx, fnName)
  return { kind: "list", of: body }
}

function filterType(expr, env, ctx, fnName) {
  const element = collectionOf(expr.over, env, ctx, fnName, "отфильтровать")
  if (!isName(expr.item)) {
    ctx.report("FLANG_BUILTIN_ARGS", "«отфильтровать» требует имени элемента", expr)
    return { kind: "list", of: element }
  }
  const inner = new Map(env)
  inner.set(expr.item, element)
  const body = inferExpr(expr.body, inner, BOOLEAN, ctx, fnName)
  if (!sameType(body, BOOLEAN)) {
    ctx.report("FLANG_BUILTIN_ARGS", `тело «отфильтровать» должно давать признак, а даёт ${typeName(body)}`, expr.body ?? expr)
  }
  return { kind: "list", of: element }
}

/**
 * Свёртка. Тип накопителя выводится из начального значения — другого
 * источника нет, аннотации в AST не предусмотрено. Тело обязано вернуть
 * тот же тип: иначе накопитель менял бы тип от шага к шагу, и результат
 * зависел бы от длины списка.
 */
function foldType(expr, env, ctx, fnName) {
  const element = collectionOf(expr.over, env, ctx, fnName, "свёртка")
  const accType = inferExpr(expr.init, env, null, ctx, fnName)
  if (!isName(expr.acc) || !isName(expr.item)) {
    ctx.report("FLANG_BUILTIN_ARGS", "«свёртка» требует имён накопителя и элемента", expr)
    return accType
  }
  const inner = new Map(env)
  inner.set(expr.acc, accType)
  inner.set(expr.item, element)
  const body = inferExpr(expr.body, inner, accType, ctx, fnName)
  if (!sameType(body, accType)) {
    ctx.report("FLANG_BUILTIN_ARGS", `тело «свёртка» даёт ${typeName(body)}, а накопитель «${expr.acc}» — ${typeName(accType)}`, expr.body ?? expr)
  }
  return accType
}

function builtinType(expr, env, ctx, fnName) {
  const canonical = BUILTIN_ALIASES.get(expr.name)
  const args = Array.isArray(expr.args) ? expr.args : []
  if (!canonical) {
    ctx.report("FLANG_BUILTIN_ARGS", `неизвестная встроенная форма «${String(expr.name)}»`, expr)
    for (const arg of args) inferExpr(arg, env, null, ctx, fnName)
    return UNKNOWN
  }
  const arity = (count) => {
    if (args.length === count) return true
    ctx.report("FLANG_BUILTIN_ARGS", `«${canonical}» принимает ${count} арг., а получила ${args.length}`, expr)
    return false
  }
  const want = (index, type) => {
    const actual = inferExpr(args[index], env, type, ctx, fnName)
    if (!sameType(actual, type)) {
      ctx.report("FLANG_BUILTIN_ARGS", `аргумент ${index + 1} формы «${canonical}»: ожидался ${typeName(type)}, получен ${typeName(actual)}`, args[index] ?? expr)
    }
    return actual
  }
  const listArg = (index) => {
    const actual = inferExpr(args[index], env, null, ctx, fnName)
    if (actual.kind === "unknown") return UNKNOWN
    if (actual.kind !== "list") {
      ctx.report("FLANG_BUILTIN_ARGS", `аргумент ${index + 1} формы «${canonical}»: ожидался список, получен ${typeName(actual)}`, args[index] ?? expr)
      return UNKNOWN
    }
    return actual.of
  }

  switch (canonical) {
    case "длина": {
      // Единственная перегрузка в языке: длина строки и длина списка — одно
      // понятие, разводить их в два имени было бы шумом.
      if (!arity(1)) return NUMBER
      const actual = inferExpr(args[0], env, null, ctx, fnName)
      if (actual.kind !== "unknown" && actual.kind !== "string" && actual.kind !== "list") {
        ctx.report("FLANG_BUILTIN_ARGS", `«длина» принимает строку или список, а получила ${typeName(actual)}`, args[0] ?? expr)
      }
      return NUMBER
    }
    case "символ":
      /*
       * Порядок аргументов — как в поверхности «символ N в текст»: сначала
       * номер, потом строка. Так же его кладёт парсер (`args: [позиция,
       * строка]`), так же читает `builtins.mjs` и печать в JS и C. Здесь
       * когда-то стояло обратное, и любой реальный вызов не проходил `check`.
       */
      if (arity(2)) { want(0, NUMBER); want(1, STRING) }
      return STRING
    case "подстрока":
      if (arity(3)) { want(0, STRING); want(1, NUMBER); want(2, NUMBER) }
      return STRING
    case "соединить": {
      // Две формы, как в `builtins.mjs`: «соединить список с разделителем»
      // и «соединить строку со строкой». Разводятся по первому аргументу.
      if (!arity(2)) return STRING
      const first = inferExpr(args[0], env, null, ctx, fnName)
      if (first.kind === "list") want(0, { kind: "list", of: STRING })
      else if (first.kind !== "unknown" && first.kind !== "string") {
        ctx.report("FLANG_BUILTIN_ARGS", `«соединить» принимает строку или список строк, а получила ${typeName(first)}`, args[0] ?? expr)
      }
      want(1, STRING)
      return STRING
    }
    case "остаток от":
    case "процентов от":
      if (arity(2)) { want(0, NUMBER); want(1, NUMBER) }
      return NUMBER
    case "разделить":
      if (arity(2)) { want(0, STRING); want(1, STRING) }
      return { kind: "list", of: STRING }
    /* Список строк, а не список чисел: кодовая точка числом потребовала бы
       обратной формы «символ по коду», а с ней и решения про суррогаты. Список
       односимвольных строк складывается обратно тем же «соединить», который
       уже есть. */
    case "символы":
      if (arity(1)) want(0, STRING)
      return { kind: "list", of: STRING }
    case "начинается с":
      if (arity(2)) { want(0, STRING); want(1, STRING) }
      return BOOLEAN
    case "содержит": {
      if (!arity(2)) return BOOLEAN
      const first = inferExpr(args[0], env, null, ctx, fnName)
      if (first.kind === "list") want(1, first.of)
      else if (first.kind === "string") want(1, STRING)
      else if (first.kind !== "unknown") {
        ctx.report("FLANG_BUILTIN_ARGS", `«содержит» принимает строку или список, а получила ${typeName(first)}`, args[0] ?? expr)
        inferExpr(args[1], env, null, ctx, fnName)
      }
      return BOOLEAN
    }
    case "к числу":
      if (arity(1)) want(0, STRING)
      return NUMBER
    case "к строке":
      if (arity(1)) inferExpr(args[0], env, null, ctx, fnName)
      return STRING
    case "голова":
      if (!arity(1)) return UNKNOWN
      return listArg(0)
    case "хвост": {
      if (!arity(1)) return UNKNOWN
      return { kind: "list", of: listArg(0) }
    }
    case "пусто": {
      if (!arity(1)) return BOOLEAN
      const actual = inferExpr(args[0], env, null, ctx, fnName)
      if (actual.kind !== "unknown" && actual.kind !== "string" && actual.kind !== "list") {
        ctx.report("FLANG_BUILTIN_ARGS", `«пусто» принимает строку или список, а получила ${typeName(actual)}`, args[0] ?? expr)
      }
      return BOOLEAN
    }
    case "добавить": {
      // Порядок аргументов — как в поверхностном синтаксисе «добавить X к Y»:
      // сначала элемент, затем список.
      if (!arity(2)) return UNKNOWN
      const element = inferExpr(args[0], env, null, ctx, fnName)
      const list = inferExpr(args[1], env, { kind: "list", of: element }, ctx, fnName)
      if (list.kind === "unknown") return { kind: "list", of: element }
      if (list.kind !== "list") {
        ctx.report("FLANG_BUILTIN_ARGS", `«добавить» добавляет в список, а второй аргумент — ${typeName(list)}`, args[1] ?? expr)
        return { kind: "list", of: element }
      }
      if (!sameType(element, list.of)) {
        ctx.report("FLANG_BUILTIN_ARGS", `«добавить»: элемент имеет тип ${typeName(element)}, а список — ${typeName(list)}`, expr)
      }
      return list
    }
    default:
      return UNKNOWN
  }
}

/* ------------------------------------------------------------------ */
/* Мелочи                                                              */
/* ------------------------------------------------------------------ */

function spanOf(node) {
  return node && typeof node === "object" && node.span ? node.span : null
}

function isName(value) {
  return typeof value === "string" && value.length > 0
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function omit(object, keys) {
  const result = {}
  for (const [key, value] of Object.entries(object)) {
    if (!keys.includes(key)) result[key] = value
  }
  return result
}
