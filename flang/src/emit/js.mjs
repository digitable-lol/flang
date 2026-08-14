/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/js.mjs — печать программы flang в JavaScript (SPEC.md, раздел 6).
//
// ── Зачем этот слой, если есть интерпретатор ───────────────────────────────
// Интерпретатор удобен для отладки и факт-чекинга, но во встраивании в чужое
// приложение нужен обычный модуль без рантайма: импортировал функцию и вызвал.
// Поэтому здесь печатается один ES-модуль с нулём зависимостей, работающий и в
// Node, и в браузере.
//
// ── Один файл на программу ─────────────────────────────────────────────────
// AST flang (раздел 5) описывает ровно один модуль (`module`), а функции внутри
// него свободно вызывают друг друга, в том числе взаимно рекурсивно. Разложить
// их по файлам значило бы завести циклические импорты ради ничего и продублировать
// рантайм-префикс в каждом файле. Поэтому одна программа — один файл.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать тот же результат и те же коды ошибок, что
// интерпретатор. Отсюда несколько решений, которые иначе выглядели бы странно:
//
//   • рантайм-представление значений повторяет builtins.mjs дословно: список —
//     массив, запись — обычный объект, вариант — экземпляр класса с полями
//     `variant`/`fields`, «ничто» — null;
//   • сообщения об ошибках скопированы буквально, вплоть до кавычек-ёлочек:
//     код и текст — часть наблюдаемого поведения, а не украшение;
//   • порядок вычисления строго слева направо, поэтому подвыражения, которым
//     нужны собственные операторы, материализуются во временные `const` —
//     иначе сосед справа успел бы бросить свою ошибку раньше соседа слева;
//   • проценты печатаются как `(процент / 100) * значение`: перестановка
//     множителей меняет последний бит мантиссы.
//
// ── Хвостовая рекурсия ─────────────────────────────────────────────────────
// Интерпретатор переиспользует кадр возврата, поэтому «пока не кончится список»
// работает в постоянной глубине. Печать «как есть» упала бы с RangeError там,
// где интерпретатор считает штатно, — то есть обещание совпадения нарушилось бы
// на ровном месте. Поэтому:
//
//   • хвостовой самовызов разворачивается в `for (;;)` с переприсваиванием
//     параметров — глубина стека не растёт вовсе;
//   • взаимно рекурсивные хвостовые вызовы (компонента сильной связности из
//     двух и более функций) идут через батут: внутренняя `…$шаг` возвращает
//     «отскок», внешняя функция крутит его в цикле;
//   • функция с постусловиями хвостовых вызовов не получает — и это не
//     упрощение, а точное повторение интерпретатора: он тоже не переиспользует
//     кадр, у которого есть постусловия, потому что они обязаны проверить
//     именно свой результат.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// Раньше здесь стояло «лимитов `maxSteps`/`maxDepth` нет», и это была дыра, а не
// упрощение. Обещание языка — «тотальная функция завершится ИЛИ ОТКАЖЕТ ЧЕСТНО»,
// и набор видов отказа ЗАКРЫТ (failures.mjs). Без счётчиков напечатанный модуль
// давал не отказ из набора, а `RangeError` с пустым `code` на нехвостовой
// рекурсии и вечное вращение на хвостовой — в браузере это смерть вкладки.
// Обещание держалось на интерпретаторе и не держалось на том, что собирал
// пользователь. Теперь считают, как в остальных семи целях: шаг — это вход в
// функцию, оборот цикла хвостового самовызова и отскок батута; глубину считает
// каждая функция, лежащая на цикле графа вызовов (`recursive`).
//
// Знание `total: true` используется честно: оно доказывает завершение, но не
// ограничивает глубину — тотальная «Сумма» на списке в миллион элементов уйдёт
// на миллион кадров, — поэтому счётчик нужен обоим классам функций.
//
// Счётчик витков в модуле ОДИН, и это существенно. Запас витков процесса
// (`с запасом N витков`) и предел шагов расчёта (`--max-steps`) — два ПРЕДЕЛА,
// но одна ЕДИНИЦА и один прибор: планировщик конкурентности не завёл своего
// счётчика, а ставит предел общему на время пробега обработчика и читает его
// показание в поле `витки` итога (`js/flang_conc.js`). Два счётчика в одном
// модуле означали бы два разных числа предела и молчаливый разъезд: тот же
// обработчик отказал бы по одному прибору, досчитав по другому.
//
// Три вещи, которых у остальных целей нет, и каждая — следствие того, что
// подпись напечатанной функции здесь и есть её интерфейс.
//
//   • Счётчики живут в области видимости модуля, а не едут параметром `ctx`:
//     добавить `ctx` в подпись значило бы сломать всякого, кто модуль уже
//     вызывает. Так же ambient они устроены в бэкенде Elixir (словарь процесса).
//     Свежесть, которую там даёт прогонщик новым контекстом на каждый запрос,
//     здесь даёт `$top` — граница расчёта на вызове извне.
//
//     Следствие, и оно единственное: границу ставит первая РЕКУРСИВНАЯ функция на
//     пути, а не всякая. Если нерекурсивная функция зовёт рекурсивную в цикле, у
//     каждого такого вызова бюджет витков свой, тогда как интерпретатор считает
//     их все в один. Расхождение в безопасную сторону — напечатанный код может
//     досчитать то, что интерпретатор объявил исчерпанным, но не наоборот, — и
//     потому оставлено: чтобы закрыть его, границу пришлось бы ставить на каждую
//     функцию модуля, включая те, которым счётчик глубины не нужен вовсе.
//   • Возврат глубины стоит на самих `return` (`$leave`), а не в `finally`.
//     Естественная форма — обернуть тело в `try … finally` — ВДВОЕ сокращает
//     доступную глубину: кадр функции с `try` у V8 много больше обычного
//     (замер холодными процессами: 7031 кадр против 8544). Отказ минует
//     `return`, поэтому глубину на путях отказа чинит та же граница `$top`.
//   • Стек хозяина может кончиться РАНЬШЕ объявленного предела, и это тот
//     случай, где цель принципиально слабее остальных семи. У V8 холодный кадр
//     этой формы влезает около 8,5 тысяч раз при пределе языка 10 000, в
//     браузерах бывает меньше, а поднять стек изнутри модуля нечем: в Python
//     это делает поток с заданным стеком, в JS такого рычага нет. Поэтому
//     `$hostDepth` переводит переполнение стека в объявленный
//     FLANG_RECURSION_LIMIT — код из набора, а текст называет хозяина, а не
//     предел, до которого не добрались. Врать про предел нельзя, молчать тоже.
//
// ── Где печать намеренно расходится с интерпретатором ──────────────────────
// Расхождения ровно четыре, и каждое — следствие того, что на выходе модуль, а
// не вычислитель. Ни одно не меняет результат корректной программы.
//
//   1. Виток здесь крупнее витка интерпретатора: там это итерация машины, здесь
//      — вход в функцию, оборот цикла и отскок батута. Значит при одном и том же
//      пределе интерпретатор упирается ПЕРВЫМ, и расхождение одностороннее и
//      безопасное: напечатанный код не объявит исчерпанным то, что интерпретатор
//      досчитал. Та же единица, что в C (`fl_tick`), — и мерит она ОБА предела,
//      которые есть у модуля: и `maxSteps` самого расчёта, и запас витков
//      процесса, объявленный автором. Счётчик при этом ОДИН: планировщик
//      конкурентности не приносит своего, а ставит предел общему на время
//      пробега (`js/flang_conc.js`, `$concПробег`), потому что два счётчика в
//      одном модуле — это два разных числа предела, и они разошлись бы молча.
//      Расхождение единицы измерено — `flang/conc/SPEC.md`, «Планировщик в
//      напечатанном JavaScript», и `flang/test/emit-js-conc.test.mjs`.
//      Глубина расходится в ту же сторону: интерпретатор
//      переиспользует кадр любого хвостового вызова без постусловий, здесь кадр
//      переиспользуется только у самовызова и у взаимной рекурсии (батут).
//   2. Ошибки, которые видны статически, печать сообщает при печати, а
//      интерпретатор — когда доберётся до узла: несвязанное имя, неизвестная
//      функция или встроенная форма, её арность, неверное число аргументов,
//      опечатка в имени варианта или записи. Код и текст те же; раньше — лучше,
//      потому что напечатать заведомо сломанный модуль хуже, чем не напечатать.
//   3. `span` едет только в ошибке постусловия. Остальным диагностикам он не
//      нужен: артефакт здесь — сам модуль, и указывать в нём строку исходника,
//      которого рядом нет, значит обещать больше, чем есть.
//   4. Класс варианта у каждого напечатанного модуля свой — иначе появилась бы
//      зависимость, а её быть не должно. Значит вариант, пришедший извне, надо
//      строить экспортированным конструктором этого же модуля; структура
//      значения (`variant`, `fields`) при этом совпадает с интерпретатором
//      ровно, и сравнивать результаты двух движков можно структурно.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin } from "../builtins.mjs"
import { defunctionalize } from "../defunc.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../../../tools/ftsc/src/bidi.mjs"
import { camel, createNamer, pascal, snake } from "../../../tools/ftsc/src/naming.mjs"

/* Планировщик конкурентности — настоящий .js рядом, а не строка здесь, и по той
   же причине, по какой так сделано в C (`emit/c/flang_conc.c`): его читает
   человек и проверяет разбором сам движок, когда загружает напечатанный модуль,
   а не наши глаза сквозь кавычки шаблона. Печатается он ЦЕЛИКОМ и только той
   программе, у которой есть процессы: обычной программе планировщик не нужен, и
   ни один её байт от планировщика не изменился. Своего счётчика витков он с
   собой не приносит — считает общий счётчик модуля (`$step`), а планировщик
   только ставит ему предел на время пробега. */
const CONC_SOURCE = readFileSync(new URL("js/flang_conc.js", import.meta.url), "utf8")

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм печатаемого модуля.

   Функции ниже эмиттер не вызывает — он печатает их исходный текст через
   Function.prototype.toString(). Так рантайм остаётся обычным кодом: его
   проверяет парсер JS при загрузке этого модуля, а не наши глаза, и в нём
   невозможна опечатка вида «забыли экранировать обратный слэш в шаблоне».
   ═══════════════════════════════════════════════════════════════════════════ */

// Формат ядра FTS: { code, message, severity, span }. Наружу дублируем
// code/span полями — вызывающему не приходится разворачивать массив.
class $FlangError extends Error {
  constructor(code, message, span) {
    super(message)
    this.name = "FlangError"
    this.code = code
    const diagnostic = { code, message, severity: "error" }
    if (span !== undefined && span !== null) {
      diagnostic.span = span
      this.span = span
    }
    this.diagnostics = [diagnostic]
  }
}

function $fail(code, message, span) {
  throw new $FlangError(code, message, span)
}

// Вариант суммы типов — отдельный класс, а не объект с меткой: запись flang это
// обычный объект JS, поэтому служебное поле-метка могло бы столкнуться с
// пользовательским полем.
class $FlangVariant {
  constructor(name, fields = {}) {
    this.variant = name
    this.fields = fields
  }
}

function $isList(value) {
  return Array.isArray(value)
}

function $isVariant(value) {
  return value instanceof $FlangVariant
}

function $isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof $FlangVariant)
}

/* Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост» разбирают
   обе. По кодовым точкам, а не по единицам UTF-16, — как «длина», «символ» и
   «символы»: иначе эмодзи разваливалось бы пополам. */
function $chainEmpty(value) {
  if (typeof value === "string") return value.length === 0
  return $isList(value) && value.length === 0
}

function $chainCons(value) {
  if (typeof value === "string") return value.length > 0
  return $isList(value) && value.length > 0
}

function $chainHead(value) {
  return typeof value === "string" ? Array.from(value)[0] : value[0]
}

function $chainTail(value) {
  return typeof value === "string" ? Array.from(value).slice(1).join("") : value.slice(1)
}

function $isScalar(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

function $typeName(value) {
  if (value === null) return "ничто"
  if (typeof value === "string") return "строка"
  if (typeof value === "number") return "число"
  if (typeof value === "boolean") return "признак"
  if ($isList(value)) return "список"
  if ($isVariant(value)) return `вариант «${value.variant}»`
  if ($isRecord(value)) return "запись"
  return "неизвестное значение"
}

function $describe(value) {
  if (typeof value === "string") return JSON.stringify(value)
  if ($isVariant(value)) {
    const fields = Object.keys(value.fields)
    return fields.length === 0 ? value.variant : `${value.variant}(${fields.join(", ")})`
  }
  if ($isList(value)) return `список из ${value.length}`
  if ($isRecord(value)) return `запись {${Object.keys(value).join(", ")}}`
  if (value === null) return "ничто"
  if (value === true) return "да"
  if (value === false) return "нет"
  return String(value)
}

// Скаляры сравниваются через Object.is — как compare() ядра FTS: NaN равен NaN,
// 0 не равен -0. Составные значения ядро не сравнивает, здесь семантика
// структурная. Рекурсия по данным, а не по программе: её глубина ограничена
// вложенностью значения.
function $equal(left, right) {
  if ($isScalar(left) || $isScalar(right)) {
    if (!$isScalar(left) || !$isScalar(right)) return false
    return Object.is(left, right)
  }
  if ($isList(left) && $isList(right)) {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!$equal(left[index], right[index])) return false
    }
    return true
  }
  if ($isVariant(left) && $isVariant(right)) {
    if (left.variant !== right.variant) return false
    return $recordsEqual(left.fields, right.fields)
  }
  if ($isRecord(left) && $isRecord(right)) return $recordsEqual(left, right)
  return false
}

function $recordsEqual(left, right) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => key in right && $equal(left[key], right[key]))
}

function $field(target, name) {
  if ($isVariant(target)) {
    $fail("FLANG_TYPE", `поле «${name}» нельзя взять у варианта «${target.variant}» — нужен разбор`)
  }
  if (!$isRecord(target)) {
    $fail("FLANG_TYPE", `поле «${name}» можно взять только у записи, получено ${$typeName(target)}`)
  }
  if (!Object.hasOwn(target, name)) $fail("FLANG_UNKNOWN_NAME", `запись не содержит поле «${name}»`)
  return target[name]
}

function $cond(value) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `условие «если» должно быть признаком, получено ${$typeName(value)}`)
  }
  return value
}

function $matchFail(value) {
  $fail("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор не покрывает значение ${$describe(value)}`)
}

function $variantField(value, field) {
  if (!Object.hasOwn(value.fields, field)) {
    $fail("FLANG_UNKNOWN_NAME", `вариант «${value.variant}» не содержит поле «${field}»`)
  }
  return value.fields[field]
}

function $requireList(value, label) {
  if (!$isList(value)) {
    $fail("FLANG_TYPE", `«${label}» работает только со списком, получено ${$typeName(value)}`)
  }
  return value
}

function $keep(value) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `условие «отфильтровать» должно быть признаком, получено ${$typeName(value)}`)
  }
  return value
}

function $post(value, property, name) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `постусловие «${property}» функции «${name}» должно давать признак, получено ${$typeName(value)}`)
  }
  return value
}

function $nums(op, left, right) {
  if (typeof left !== "number" || typeof right !== "number") {
    $fail("FLANG_TYPE", `операция «${op}» допустима только для чисел, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
}

// Сообщение дословно как в ядре (src/utility.ts, compare): порядок — только для
// чисел.
function $ord(left, right) {
  if (typeof left !== "number" || typeof right !== "number") {
    $fail("FLANG_TYPE", "сравнения порядка допустимы только для чисел")
  }
}

function $add(left, right) {
  $nums("add", left, right)
  return left + right
}

function $sub(left, right) {
  $nums("sub", left, right)
  return left - right
}

function $mul(left, right) {
  $nums("mul", left, right)
  return left * right
}

// Деление на ноль даёт Infinity — это значение IEEE-754, а не ошибка.
function $div(left, right) {
  $nums("div", left, right)
  return left / right
}

function $mod(left, right) {
  $nums("mod", left, right)
  return left % right
}

// Порядок операций ядра: (процент / 100) * значение. Переписать в
// значение * процент / 100 нельзя — меняется последний бит мантиссы.
function $percent(percent, value) {
  $nums("percent", percent, value)
  return (percent / 100) * value
}

function $gt(left, right) {
  $ord(left, right)
  return left > right
}

function $lt(left, right) {
  $ord(left, right)
  return left < right
}

function $gte(left, right) {
  $ord(left, right)
  return left >= right
}

function $lte(left, right) {
  $ord(left, right)
  return left <= right
}

function $concat(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    $fail("FLANG_TYPE", `«соединить» допустимо только для строк, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
  return left + right
}

function $expectString(name, value, role) {
  if (typeof value !== "string") {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должна быть строкой, получено ${$typeName(value)}`)
  }
  return value
}

function $expectNumber(name, value, role) {
  if (typeof value !== "number") {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть числом, получено ${$typeName(value)}`)
  }
  return value
}

function $expectInteger(name, value, role) {
  $expectNumber(name, value, role)
  if (!Number.isInteger(value)) {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть целым числом, получено ${value}`)
  }
  return value
}

function $expectList(name, value, role) {
  if (!$isList(value)) {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должен быть списком, получено ${$typeName(value)}`)
  }
  return value
}

// Строки режутся по кодовым точкам (Array.from), а не по единицам UTF-16:
// «длина» для «привет» обязана быть 6, а для суррогатной пары — 1.
function $b_dlina(value) {
  if (typeof value === "string") return Array.from(value).length
  if ($isList(value)) return value.length
  $fail("FLANG_BUILTIN_ARGS", `«длина»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_simvol(index, text) {
  $expectInteger("символ", index, "индекс")
  $expectString("символ", text, "строка")
  const chars = Array.from(text)
  const at = index - $INDEX_BASE
  if (at < 0 || at >= chars.length) {
    $fail("FLANG_BUILTIN_ARGS", `«символ»: индекс ${index} вне строки длиной ${chars.length}`)
  }
  return chars[at]
}

function $b_podstroka(text, from, to) {
  $expectString("подстрока", text, "строка")
  $expectInteger("подстрока", from, "начало")
  $expectInteger("подстрока", to, "конец")
  const chars = Array.from(text)
  const start = from - $INDEX_BASE
  const end = to
  if (start < 0 || start > chars.length) {
    $fail("FLANG_BUILTIN_ARGS", `«подстрока»: начало ${from} вне строки длиной ${chars.length}`)
  }
  if (end < start || end > chars.length) {
    $fail("FLANG_BUILTIN_ARGS", `«подстрока»: конец ${to} вне диапазона [${from}, ${chars.length}]`)
  }
  return chars.slice(start, end).join("")
}

// Две формы: «соединить строку с строкой» и «соединить список с разделителем».
// Различаем по типу первого аргумента — как builtins.mjs.
function $b_soedinit(left, right) {
  if ($isList(left)) {
    const separator = $expectString("соединить", right, "разделитель")
    const parts = left.map((item, index) => {
      if (typeof item !== "string") {
        $fail(
          "FLANG_BUILTIN_ARGS",
          `«соединить»: элемент ${index + 1} списка должен быть строкой, получено ${$typeName(item)}`,
        )
      }
      return item
    })
    return parts.join(separator)
  }
  $expectString("соединить", left, "первая строка")
  $expectString("соединить", right, "вторая строка")
  return left + right
}

function $b_razdelit(text, separator) {
  $expectString("разделить", text, "строка")
  $expectString("разделить", separator, "разделитель")
  if (separator === "") $fail("FLANG_BUILTIN_ARGS", "«разделить»: разделитель не может быть пустым")
  return text.split(separator)
}

function $b_simvoly(text) {
  $expectString("символы", text, "строка")
  /* Array.from идёт по кодовым точкам, а не по единицам UTF-16: [...text] и
     text.split("") разошлись бы на первом же символе вне BMP. То же деление,
     что у «длина» и «подстрока» в builtins.mjs. */
  return Array.from(text)
}

function $b_kod_simvola(text) {
  $expectString("код символа", text, "строка")
  /* Та же нарезка по кодовым точкам, что у «символы»: [...text] идёт по
     точкам, а text.charCodeAt(0) отдал бы половину суррогатной пары. */
  const first = Array.from(text)[0]
  if (first === undefined) $fail("FLANG_BUILTIN_ARGS", "«код символа»: строка пуста")
  return first.codePointAt(0)
}

function $b_soderzhit(left, right) {
  if ($isList(left)) return left.some((item) => $equal(item, right))
  const text = $expectString("содержит", left, "строка или список")
  const part = $expectString("содержит", right, "искомая подстрока")
  return text.includes(part)
}

function $b_nachinaetsya_s(text, prefix) {
  $expectString("начинается с", text, "строка")
  $expectString("начинается с", prefix, "префикс")
  return text.startsWith(prefix)
}

// Строгий разбор: без Infinity, NaN, шестнадцатеричных и пустой строки — иначе
// «к числу» молча превращает мусор в значение.
function $b_k_chislu(text) {
  $expectString("к числу", text, "строка")
  const trimmed = text.trim()
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/u.test(trimmed)) {
    $fail("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является числом`)
  }
  const result = Number(trimmed)
  if (!Number.isFinite(result)) {
    $fail("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является конечным числом`)
  }
  return result
}

// Отказ «к числу», ставший значением (builtins.mjs, «отказ, ставший значением»).
// Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
// интерпретатором, и единственный способ гарантировать это — один разбор на обе
// формы.
function $b_k_chislu_ili_beda(text) {
  try {
    return new $FlangVariant("Разобрано", { "значение": $b_k_chislu(text) })
  } catch (error) {
    return new $FlangVariant("Не разобрано", {
      "код": error?.code ?? "FLANG_BUILTIN_ARGS",
      "сообщение": String(error?.message ?? ""),
    })
  }
}

// Признак печатается по-русски: поверхность языка знает «да» и «нет», а не
// true и false (SPEC, раздел 5, таблица семантики).
function $b_k_stroke(value) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "да" : "нет"
  if (value === null) return "ничто"
  $fail("FLANG_BUILTIN_ARGS", `«к строке»: ожидается скаляр, получено ${$typeName(value)}`)
}

function $b_pusto(value) {
  if ($isList(value)) return value.length === 0
  if (typeof value === "string") return Array.from(value).length === 0
  $fail("FLANG_BUILTIN_ARGS", `«пусто»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_golova(value) {
  const list = $expectList("голова", value, "аргумент")
  if (list.length === 0) $fail("FLANG_BUILTIN_ARGS", "«голова»: список пуст")
  return list[0]
}

// «хвост» копирует: список flang — массив JS, а массив нельзя разделить с
// суффиксом без копирования.
function $b_hvost(value) {
  const list = $expectList("хвост", value, "аргумент")
  if (list.length === 0) $fail("FLANG_BUILTIN_ARGS", "«хвост»: список пуст")
  return list.slice(1)
}

// Элемент по номеру. Массив JS — обращение по индексу без обхода; проверка
// границ повторяет вычислитель дословно, включая текст отказа.
function $b_element(index, value) {
  $expectInteger("элемент", index, "индекс")
  const list = $expectList("элемент", value, "список")
  const at = index - $INDEX_BASE
  if (at < 0 || at >= list.length) {
    $fail("FLANG_BUILTIN_ARGS", `«элемент»: индекс ${index} вне списка длиной ${list.length}`)
  }
  return list[at]
}

function $b_dobavit(item, value) {
  const list = $expectList("добавить", value, "второй аргумент")
  return [...list, item]
}

function $b_ostatok_ot(left, right) {
  $expectNumber("остаток от", left, "делимое")
  $expectNumber("остаток от", right, "делитель")
  return left % right
}

function $b_procentov_ot(percent, value) {
  $expectNumber("процентов от", percent, "процент")
  $expectNumber("процентов от", value, "значение")
  return (percent / 100) * value
}

// Батут для взаимной хвостовой рекурсии: `…$шаг` возвращает либо значение, либо
// отскок, а внешняя функция крутит отскоки в цикле. Так группа взаимно
// рекурсивных функций живёт в постоянной глубине стека — ровно как в
// интерпретаторе, который переиспользует кадр возврата.
class $Bounce {
  constructor(step, args) {
    this.step = step
    this.args = args
  }
}

function $trampoline(result, name) {
  while (result instanceof $Bounce) {
    // Отскок — виток: глубину батут не растит, и упереться ему больше не во что.
    $step(name)
    result = result.step(...result.args)
  }
  return result
}

// Вход в функцию, способную к рекурсии.
function $enter(name) {
  $step(name)
  if ($maxDepth > 0 && $depth + 1 > $maxDepth) {
    $fail(
      "FLANG_RECURSION_LIMIT",
      `функция «${name}» превысила предел глубины вызовов (${$maxDepth}) на глубине ${$depth + 1}`,
    )
  }
  $depth += 1
}

// Возврат из функции. Возвращает то, что ей дали, чтобы стоять прямо в `return`:
// кадр с `try` у V8 вдвое больше обычного, и `finally` стоил бы половины глубины.
function $leave(value) {
  $depth -= 1
  return value
}

// Граница расчёта: один кадр с `try` на вызов извне вместо `try` в каждом кадре
// рекурсии. Обнуляет счётчики, переводит переполнение стека в объявленный отказ
// и чинит глубину на путях отказа — их `$leave` не проходит.
function $top(fn, args, name) {
  $guarded = true
  $depth = 0
  $steps = 0
  try {
    return fn(...args)
  } catch ($err) {
    throw $hostDepth($err, name)
  } finally {
    $guarded = false
  }
}

// Виток вычисления: вход в функцию, оборот цикла самовызова, отскок батута.
// Считается отдельно от глубины: хвостовая рекурсия глубину не растит, но
// завершаться от этого не начинает.
function $step(name) {
  $steps += 1
  if ($maxSteps > 0 && $steps > $maxSteps) {
    $fail(
      "FLANG_RECURSION_LIMIT",
      `функция «${name}» исчерпала лимит шагов (${$maxSteps}) на глубине вызовов ${$depth}`,
    )
  }
}

// Переполнение стека хозяина в объявленный отказ. Стек может кончиться раньше
// предела языка, а `code` у RangeError пуст — в закрытый набор видов отказа он не
// входит. Работа сведена к минимуму: кадр здесь уже без стека. Свой try/catch —
// если стека не хватит даже на это; причина всё равно известна.
//
// Своё сообщение о стеке знают три движка ($STACK_OVERFLOW). У незнакомого
// опираемся на глубину: на сотнях кадров RangeError — это стек, а на двух это
// что-то другое (у движка есть свой предел длины строки), и подменять его
// объявленным отказом было бы враньём. Опираться на одну лишь прозу движка
// нельзя: замкнутость набора отказов не должна зависеть от его формулировок.
function $hostDepth(error, name) {
  try {
    if (!(error instanceof RangeError)) return error
    if (!$STACK_OVERFLOW.test(error.message) && $depth < 256) return error
  } catch {}
  return new $FlangError(
    "FLANG_RECURSION_LIMIT",
    `функция «${name}» исчерпала стек хозяина на глубине ${$depth}, не дойдя до предела глубины вызовов (${$maxDepth})`,
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Реестр рантайма: имя → { нужные ему помощники, исходный текст }.

   Печатается только то, что программе действительно нужно: 250 строк рантайма
   перед двадцатью строками бизнес-логики читаются хуже, чем пять. Порядок
   печати фиксирован порядком объявления — один AST даёт побайтово один вывод.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME = new Map()

function runtimeEntry(name, needs, source) {
  RUNTIME.set(name, { needs, source })
}

function fromSource(fn) {
  return fn.toString()
}

runtimeEntry("$FlangError", [], fromSource($FlangError))
runtimeEntry("$fail", ["$FlangError"], fromSource($fail))
runtimeEntry("$FlangVariant", [], fromSource($FlangVariant))
runtimeEntry("$isList", [], fromSource($isList))
runtimeEntry("$isVariant", ["$FlangVariant"], fromSource($isVariant))
runtimeEntry("$isRecord", ["$FlangVariant"], fromSource($isRecord))
runtimeEntry("$isScalar", [], fromSource($isScalar))
runtimeEntry("$chainEmpty", ["$isList"], fromSource($chainEmpty))
runtimeEntry("$chainCons", ["$isList"], fromSource($chainCons))
runtimeEntry("$chainHead", [], fromSource($chainHead))
runtimeEntry("$chainTail", [], fromSource($chainTail))
runtimeEntry("$typeName", ["$isList", "$isVariant", "$isRecord"], fromSource($typeName))
runtimeEntry("$describe", ["$isList", "$isVariant", "$isRecord"], fromSource($describe))
runtimeEntry("$equal", ["$isScalar", "$isList", "$isVariant", "$isRecord", "$recordsEqual"], fromSource($equal))
runtimeEntry("$recordsEqual", ["$equal"], fromSource($recordsEqual))
runtimeEntry("$field", ["$fail", "$isVariant", "$isRecord", "$typeName"], fromSource($field))
runtimeEntry("$cond", ["$fail", "$typeName"], fromSource($cond))
runtimeEntry("$matchFail", ["$fail", "$describe"], fromSource($matchFail))
runtimeEntry("$variantField", ["$fail"], fromSource($variantField))
runtimeEntry("$requireList", ["$fail", "$isList", "$typeName"], fromSource($requireList))
runtimeEntry("$keep", ["$fail", "$typeName"], fromSource($keep))
runtimeEntry("$post", ["$fail", "$typeName"], fromSource($post))
runtimeEntry("$nums", ["$fail", "$typeName"], fromSource($nums))
runtimeEntry("$ord", ["$fail"], fromSource($ord))
runtimeEntry("$add", ["$nums"], fromSource($add))
runtimeEntry("$sub", ["$nums"], fromSource($sub))
runtimeEntry("$mul", ["$nums"], fromSource($mul))
runtimeEntry("$div", ["$nums"], fromSource($div))
runtimeEntry("$mod", ["$nums"], fromSource($mod))
runtimeEntry("$percent", ["$nums"], fromSource($percent))
runtimeEntry("$gt", ["$ord"], fromSource($gt))
runtimeEntry("$lt", ["$ord"], fromSource($lt))
runtimeEntry("$gte", ["$ord"], fromSource($gte))
runtimeEntry("$lte", ["$ord"], fromSource($lte))
runtimeEntry("$concat", ["$fail", "$typeName"], fromSource($concat))
runtimeEntry("$expectString", ["$fail", "$typeName"], fromSource($expectString))
runtimeEntry("$expectNumber", ["$fail", "$typeName"], fromSource($expectNumber))
runtimeEntry("$expectInteger", ["$fail", "$expectNumber"], fromSource($expectInteger))
runtimeEntry("$expectList", ["$fail", "$isList", "$typeName"], fromSource($expectList))
runtimeEntry("$b_dlina", ["$fail", "$isList", "$typeName"], fromSource($b_dlina))
runtimeEntry("$b_simvol", ["$fail", "$expectInteger", "$expectString", "$INDEX_BASE"], fromSource($b_simvol))
runtimeEntry("$b_podstroka", ["$fail", "$expectInteger", "$expectString", "$INDEX_BASE"], fromSource($b_podstroka))
runtimeEntry("$b_soedinit", ["$fail", "$isList", "$expectString", "$typeName"], fromSource($b_soedinit))
runtimeEntry("$b_razdelit", ["$fail", "$expectString"], fromSource($b_razdelit))
runtimeEntry("$b_simvoly", ["$expectString"], fromSource($b_simvoly))
runtimeEntry("$b_kod_simvola", ["$fail", "$expectString"], fromSource($b_kod_simvola))
runtimeEntry("$b_soderzhit", ["$isList", "$equal", "$expectString"], fromSource($b_soderzhit))
runtimeEntry("$b_nachinaetsya_s", ["$expectString"], fromSource($b_nachinaetsya_s))
runtimeEntry("$b_k_chislu", ["$fail", "$expectString"], fromSource($b_k_chislu))
runtimeEntry(
  "$b_k_chislu_ili_beda",
  ["$FlangVariant", "$b_k_chislu"],
  fromSource($b_k_chislu_ili_beda),
)
runtimeEntry("$b_k_stroke", ["$fail", "$typeName"], fromSource($b_k_stroke))
runtimeEntry("$b_pusto", ["$fail", "$isList", "$typeName"], fromSource($b_pusto))
runtimeEntry("$b_golova", ["$fail", "$expectList"], fromSource($b_golova))
runtimeEntry("$b_hvost", ["$fail", "$expectList"], fromSource($b_hvost))
runtimeEntry("$b_element", ["$fail", "$expectInteger", "$expectList", "$INDEX_BASE"], fromSource($b_element))
runtimeEntry("$b_dobavit", ["$expectList"], fromSource($b_dobavit))
runtimeEntry("$b_ostatok_ot", ["$expectNumber"], fromSource($b_ostatok_ot))
runtimeEntry("$b_procentov_ot", ["$expectNumber"], fromSource($b_procentov_ot))
runtimeEntry("$Bounce", [], fromSource($Bounce))
runtimeEntry("$trampoline", ["$Bounce", "$step"], fromSource($trampoline))
/* Счётчики пределов. `$LIMITS` — не функция, а блок состояния: он печатается
   особым случаем в renderRuntime, как `$INDEX_BASE`, потому что несёт значения
   пределов, известные только при печати. */
runtimeEntry("$enter", ["$fail", "$step", "$LIMITS"], fromSource($enter))
runtimeEntry("$leave", ["$LIMITS"], fromSource($leave))
runtimeEntry("$step", ["$fail", "$LIMITS"], fromSource($step))
/* `$STACK_OVERFLOW` живёт в том же блоке `$LIMITS`, отдельной записи ему не надо. */
runtimeEntry("$hostDepth", ["$FlangError", "$LIMITS"], fromSource($hostDepth))
runtimeEntry("$top", ["$hostDepth", "$LIMITS"], fromSource($top))

/** Канонические имена встроенных форм → помощники рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "$b_dlina"],
  ["символ", "$b_simvol"],
  ["подстрока", "$b_podstroka"],
  ["соединить", "$b_soedinit"],
  ["разделить", "$b_razdelit"],
  ["символы", "$b_simvoly"],
  ["код символа", "$b_kod_simvola"],
  ["содержит", "$b_soderzhit"],
  ["начинается с", "$b_nachinaetsya_s"],
  ["к числу", "$b_k_chislu"],
  ["к числу или беда", "$b_k_chislu_ili_beda"],
  ["к строке", "$b_k_stroke"],
  ["пусто", "$b_pusto"],
  ["голова", "$b_golova"],
  ["хвост", "$b_hvost"],
  ["элемент", "$b_element"],
  ["добавить", "$b_dobavit"],
  ["остаток от", "$b_ostatok_ot"],
  ["процентов от", "$b_procentov_ot"],
])

/** Арность встроенных форм — проверяется при печати, а не в рантайме. */
const BUILTIN_ARITY = new Map([
  ["длина", 1],
  ["символ", 2],
  ["подстрока", 3],
  ["соединить", 2],
  ["разделить", 2],
  ["символы", 1],
  ["код символа", 1],
  ["содержит", 2],
  ["начинается с", 2],
  ["к числу", 1],
  ["к числу или беда", 1],
  ["к строке", 1],
  ["пусто", 1],
  ["голова", 1],
  ["хвост", 1],
  ["элемент", 2],
  ["добавить", 2],
  ["остаток от", 2],
  ["процентов от", 2],
])

const BINARY_HELPERS = new Map([
  ["add", "$add"],
  ["sub", "$sub"],
  ["mul", "$mul"],
  ["div", "$div"],
  ["mod", "$mod"],
  ["percent", "$percent"],
  ["gt", "$gt"],
  ["lt", "$lt"],
  ["gte", "$gte"],
  ["lte", "$lte"],
  ["concat", "$concat"],
])

/* ═══════════════════════════ имена ═══════════════════════════ */

// Зарезервированные слова JS: имя функции flang, давшее `new` или `class`,
// обязано стать ошибкой сборки, а не молча переименоваться — ровно как коллизия
// двух имён в naming.mjs.
const JS_RESERVED = [
  "arguments", "async", "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "eval", "export", "extends", "false", "finally", "for",
  "function", "globalThis", "if", "implements", "import", "in", "instanceof", "interface", "let",
  "new", "null", "package", "private", "protected", "public", "return", "static", "super", "switch",
  "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield",
  "Infinity", "NaN",
]

// Транслитерация даёт слова и цифры; идентификатор JS не может начинаться с
// цифры, поэтому такие имена получают подчёркивание.
function safeIdent(value) {
  return /^[A-Za-z_$]/u.test(value) ? value : `_${value}`
}

const identStyle = (style) => (value) => safeIdent(style(value))

/* ═══════════════════════════ литералы ═══════════════════════════ */

// -0, NaN и Infinity обязаны напечататься так, чтобы прочитаться обратно тем же
// значением: `Object.is(-0, 0)` ложно, и расхождение здесь — расхождение
// результатов.
function renderNumber(value) {
  if (Number.isNaN(value)) return "NaN"
  if (value === Infinity) return "Infinity"
  if (value === -Infinity) return "-Infinity"
  if (Object.is(value, -0)) return "-0"
  return String(value)
}

/**
 * Строковый литерал JS: как JSON.stringify, но двунаправленные управляющие —
 * через `\uXXXX` (набор — bidi.mjs, общий на все бэкенды обоих компиляторов).
 * Значение то же: `\u202a` в литерале JS и сырой U+202A — одна и та же кодовая
 * точка, разница только в записи. Здесь набор задан кодами, а не символами:
 * сырой управляющий в комментарии этого файла делал бы с ним ровно то, от чего
 * он стережёт (и был здесь до правки — единственный на весь репозиторий).
 */
function jsstring(value) {
  /* Экранирование кавычек, слэшей и управляющих оставлено JSON.stringify:
     заменять его своим значило бы держать вторую копию правил ECMAScript.
     Двунаправленные он пропускает сырыми, поэтому они заменяются после него —
     на готовое `\uXXXX`, которое он уже не удвоит. Сам этот файл при этом
     остаётся без сырых двунаправленных: набор задан кодами, не символами. */
  const pattern = new RegExp(`[${[...BIDI_CONTROLS].map((code) => `\\u{${code.toString(16)}}`).join("")}]`, "gu")
  return JSON.stringify(String(value)).replace(
    pattern,
    (character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`,
  )
}

function renderLiteral(value) {
  if (value === undefined || value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return renderNumber(value)
  if (typeof value === "string") return jsstring(value)
  if (Array.isArray(value)) return `[${value.map(renderLiteral).join(", ")}]`
  if (typeof value === "object") {
    const entries = Object.keys(value).map((key) => `${jsstring(key)}: ${renderLiteral(value[key])}`)
    return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`
  }
  throw flangError("FLANG_PARSE", `литерал недопустимого вида: ${typeof value}`)
}

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и тексты.
// Разница только во времени срабатывания — при печати, а не при вычислении.
function prepare(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) {
    throw flangError("FLANG_PARSE", "программа должна быть объектом AST flang")
  }
  const functionList = program.functions ?? []
  if (!Array.isArray(functionList)) {
    throw flangError("FLANG_PARSE", "поле «functions» программы должно быть списком")
  }

  const functions = new Map()
  for (const fn of functionList) {
    if (fn === null || typeof fn !== "object" || typeof fn.name !== "string") {
      throw flangError("FLANG_PARSE", "функция должна быть объектом с полем «name»")
    }
    if (functions.has(fn.name)) {
      throw flangError("FLANG_PARSE", `функция «${fn.name}» объявлена дважды`, fn.span)
    }
    if (fn.body === undefined || fn.body === null) {
      throw flangError("FLANG_PARSE", `у функции «${fn.name}» нет тела`, fn.span)
    }
    functions.set(fn.name, {
      name: fn.name,
      total: fn.total === true,
      params: normalizeParams(fn),
      returns: fn.returns,
      body: fn.body,
      postconditions: normalizePostconditions(fn),
      span: fn.span,
    })
  }

  const records = new Map()
  const variants = new Map()
  const sums = []
  for (const type of program.types ?? []) {
    if (type === null || typeof type !== "object") continue
    if (type.kind === "record") records.set(type.name, type)
    if (type.kind === "sum") {
      sums.push(type)
      for (const item of type.variants ?? []) variants.set(item.name, { sum: type.name, ...item })
    }
  }
  return { functions, records, variants, sums }
}

function normalizeParams(fn) {
  const params = fn.params ?? []
  if (!Array.isArray(params)) {
    throw flangError("FLANG_PARSE", `поле «params» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return params.map((param) => {
    if (typeof param === "string") return { name: param }
    if (param === null || typeof param !== "object" || typeof param.name !== "string") {
      throw flangError("FLANG_PARSE", `параметр функции «${fn.name}» должен иметь имя`, fn.span)
    }
    return param
  })
}

function normalizePostconditions(fn) {
  const list = fn.postconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «postconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `постусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      bind: typeof item.bind === "string" ? item.bind : "результат",
      code: typeof item.code === "string" ? item.code : "FLANG_PROPERTY",
      message: typeof item.message === "string" ? item.message : null,
      span: item.span,
    }
  })
}

/* ═══════════════════════════ анализ хвостовых вызовов ═══════════════════════════ */

// ВСЕ вызовы тела, не только хвостовые: по этому графу считается, кто способен к
// рекурсии и потому обязан считать глубину. Хвостовой граф для этого не годится —
// нехвостовая рекурсия как раз и есть та, что растит стек хозяина. Постусловия
// обходятся тоже: вызов из постусловия — такой же вызов.
function allCallees(fn) {
  const found = new Set()
  const seen = new Set()
  const walk = (node) => {
    if (node === null || typeof node !== "object" || seen.has(node)) return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    seen.add(node)
    if (node.kind === "call" && typeof node.name === "string") found.add(node.name)
    for (const value of Object.values(node)) walk(value)
  }
  walk(fn.body)
  for (const property of fn.postconditions) walk(property.expr)
  return found
}

// Хвостовые позиции тела. Функция с постусловиями хвостовых вызовов не имеет:
// интерпретатор не переиспользует кадр, у которого есть что проверять после
// возврата, и глубина у него растёт — печать обязана вести себя так же.
function tailCallees(fn) {
  if (fn.postconditions.length > 0) return new Set()
  const found = new Set()
  const walk = (expr) => {
    if (expr === null || typeof expr !== "object") return
    switch (expr.kind) {
      case "let":
        walk(expr.in ?? expr.body)
        return
      case "if":
        walk(expr.then)
        walk(expr.else)
        return
      case "match":
        for (const branch of expr.cases ?? []) {
          if (branch !== null && typeof branch === "object") walk(branch.body)
        }
        return
      case "call":
        if (typeof expr.name === "string") found.add(expr.name)
        return
      default:
    }
  }
  walk(fn.body)
  return found
}

// Компоненты сильной связности графа хвостовых вызовов (Тарьян). Компонента из
// двух и более функций — взаимная хвостовая рекурсия, ей нужен батут.
function stronglyConnected(functions, tailEdges) {
  const index = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const components = []
  let counter = 0

  // Явный стек вместо рекурсии: программа может состоять из тысяч функций, а
  // падать на глубине графа вызовов эмиттер права не имеет.
  for (const root of functions.keys()) {
    if (index.has(root)) continue
    const work = [{ name: root, edges: [...(tailEdges.get(root) ?? [])], position: 0 }]
    index.set(root, counter)
    low.set(root, counter)
    counter += 1
    stack.push(root)
    onStack.add(root)

    while (work.length > 0) {
      const frame = work[work.length - 1]
      if (frame.position < frame.edges.length) {
        const next = frame.edges[frame.position]
        frame.position += 1
        if (!functions.has(next)) continue
        if (!index.has(next)) {
          index.set(next, counter)
          low.set(next, counter)
          counter += 1
          stack.push(next)
          onStack.add(next)
          work.push({ name: next, edges: [...(tailEdges.get(next) ?? [])], position: 0 })
        } else if (onStack.has(next)) {
          low.set(frame.name, Math.min(low.get(frame.name), index.get(next)))
        }
        continue
      }
      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1]
        low.set(parent.name, Math.min(low.get(parent.name), low.get(frame.name)))
      }
      if (low.get(frame.name) === index.get(frame.name)) {
        const component = []
        for (;;) {
          const name = stack.pop()
          onStack.delete(name)
          component.push(name)
          if (name === frame.name) break
        }
        components.push(component)
      }
    }
  }
  return components
}

/* ═══════════════════════════ печать ═══════════════════════════ */

/**
 * Печать программы flang в JavaScript.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1 }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitJs(program, options = {}) {
  /* Конкурентность БЕРЁТСЯ ДО дефункционализации, и это не вкус: план
     печатается по объявлениям исходной программы, а проход, который добавляет
     функции, к процессам, надзорам и прогонам не прикасается. Читать их после
     него значило бы зависеть от того, чего проход не обещал.

     Раньше здесь стоял отказ `FLANG_CONC_UNSUPPORTED`: печатать процессы было
     нечем, и молчать об этом было хуже всего — программа собиралась и делала не
     то, что написано. Теперь планировщик у цели есть (`js/flang_conc.js`), и
     отказ снялся не тем, что его убрали, а тем, что он перестал быть правдой:
     список целей с планировщиком выводится из таблицы возможностей в
     `conc.mjs`, и сторож (`flang/test/emit-conc-refuse.test.mjs`) требует от
     каждой цели каталога либо печатать процессы, либо отказывать. */
  const processes = Array.isArray(program.processes) ? program.processes : []
  const supervisors = Array.isArray(program.supervisors) ? program.supervisors : []
  const runs = Array.isArray(program.runs) ? program.runs : []
  const concurrent = processes.length > 0 || supervisors.length > 0 || runs.length > 0
  /* Дефункционализация — ОДИН проход на все восемь целей (src/defunc.mjs), а не
     восемь реализаций: после него в программе нет ни функций-значений, ни
     применения, и печатается она теми же узлами, что и всё остальное. На
     программе без высшего порядка проход тождествен — возвращает ТОТ ЖЕ объект,
     — поэтому напечатанное не меняется ни на байт, и неподвижная точка цела. */
  program = defunctionalize(program)
  const prepared = prepare(program)
  const base = options.indexBase === 0 ? 0 : 1
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 10_000
  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 1_000_000

  /* Три пространства имён верхнего уровня, каждое со своей проверкой коллизий:
     типы (typedef), конструкторы вариантов и значения (функции, фабрики). Их
     идентификаторы всё равно живут в одной области видимости модуля, поэтому
     после раздачи имён проверяем общую уникальность. */
  const typeNamer = createNamer(identStyle(pascal), [])
  const variantNamer = createNamer(identStyle(pascal), JS_RESERVED)
  const valueNamer = createNamer(identStyle(camel), JS_RESERVED)

  const recordIdents = new Map()
  const factoryIdents = new Map()
  for (const name of prepared.records.keys()) {
    recordIdents.set(name, typeNamer(name))
    factoryIdents.set(name, valueNamer(`создать ${name}`))
  }
  const sumIdents = new Map()
  for (const sum of prepared.sums) sumIdents.set(sum.name, typeNamer(sum.name))
  const variantIdents = new Map()
  for (const name of prepared.variants.keys()) variantIdents.set(name, variantNamer(name))
  const functionIdents = new Map()
  for (const name of prepared.functions.keys()) functionIdents.set(name, valueNamer(name))

  const topLevel = new Map()
  const claim = (ident, source) => {
    const previous = topLevel.get(ident)
    if (previous !== undefined && previous !== source) {
      throw flangError(
        "FLANG_EMIT",
        `имена «${source}» и «${previous}» дают один идентификатор JavaScript «${ident}» — переименуйте одно из них`,
      )
    }
    topLevel.set(ident, source)
  }
  for (const [name, ident] of factoryIdents) claim(ident, `фабрика записи «${name}»`)
  for (const [name, ident] of variantIdents) claim(ident, `конструктор варианта «${name}»`)
  for (const [name, ident] of functionIdents) claim(ident, `функция «${name}»`)
  /* Прогонщик конкурентности живёт в той же области видимости модуля, поэтому
     его имена занимаются так же, как имена функций: программа с функцией
     «conc run» обязана получить внятный отказ, а не молча потерять прогонщик. */
  if (concurrent) {
    claim("concPlan", "прогонщик конкурентности")
    claim("concRun", "прогонщик конкурентности")
  }

  /* Граф хвостовых вызовов: кто разворачивается в цикл, а кто — в батут. */
  const tailEdges = new Map()
  for (const [name, fn] of prepared.functions) tailEdges.set(name, tailCallees(fn))
  const cyclic = new Map()
  for (const component of stronglyConnected(prepared.functions, tailEdges)) {
    if (component.length < 2) continue
    const members = new Set(component)
    for (const name of component) cyclic.set(name, members)
  }
  const stepIdents = new Map()
  for (const name of cyclic.keys()) stepIdents.set(name, `${functionIdents.get(name)}$step`)

  /* Граф ВСЕХ вызовов: кто способен к рекурсии и потому обязан считать глубину.
     Ровно тот же расчёт, что у остальных семи целей. */
  const callEdges = new Map()
  for (const [name, fn] of prepared.functions) callEdges.set(name, allCallees(fn))
  const recursive = new Set()
  for (const component of stronglyConnected(prepared.functions, callEdges)) {
    if (component.length >= 2) {
      for (const name of component) recursive.add(name)
      continue
    }
    if (callEdges.get(component[0])?.has(component[0])) recursive.add(component[0])
  }

  const shared = {
    prepared,
    base,
    recordIdents,
    factoryIdents,
    sumIdents,
    variantIdents,
    functionIdents,
    stepIdents,
    tailEdges,
    cyclic,
    concurrent,
    recursive,
    used: new Set(),
  }

  const sections = []
  for (const [name, type] of prepared.records) sections.push(renderRecord(name, type, shared))
  for (const sum of prepared.sums) sections.push(renderSum(sum, shared))
  for (const fn of prepared.functions.values()) sections.push(renderFunction(fn, shared))

  if (concurrent) {
    /* Планировщик отказывает через `$fail`, как и всё остальное в модуле: код и
       текст отказа — часть наблюдаемого поведения, а не украшение. */
    shared.used.add("$fail")
    /* И считает он ОБЩИЙ счётчик витков модуля, а не свой: `$step` мерит виток,
       `$top` ставит границу пробега (сбрасывает счёт и переводит переполнение
       стека хозяина в объявленный отказ), `$LIMITS` держит сами счётчики.
       Затребованы они здесь явно, потому что программа с процессами может не
       иметь ни одной рекурсивной функции — а планировщику счётчик нужен всё
       равно: запас витков объявлен автором и обязан работать. */
    shared.used.add("$top")
    sections.push(renderConcurrency(processes, supervisors, runs, program, shared))
  }

  const runtime = renderRuntime(shared.used, base, maxDepth, maxSteps, concurrent)
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const head = [
    "// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
    "// Модуль самодостаточен — ни одной зависимости, работает и в Node, и в браузере.",
    ...(concurrent
      ? [
        "// Программа с процессами: планировщик конкурентности напечатан внутрь модуля.",
        "// Конкурентность есть, параллелизма нет и не будет — один поток (concRun, concPlan).",
      ]
      : []),
  ].join("\n")

  const parts = [head]
  if (runtime.length > 0) parts.push(runtime)
  parts.push(...sections.filter((section) => section.length > 0))

  const path = options.path ?? `${moduleName === null ? "program" : snake(moduleName)}.js`
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку модуля и в jsdoc функции, — а комментарий читают
     первым и проверить исполнением не могут: движок выполнит такой файл молча.
     Форма JS — `\uXXXX`, та же, что в литерале. */
  const files = [{ path, content: `${parts.join("\n\n")}\n` }]
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

function renderRuntime(used, base, maxDepth, maxSteps, concurrent = false) {
  const closure = new Set()
  const add = (name) => {
    if (closure.has(name)) return
    closure.add(name)
    for (const need of RUNTIME.get(name)?.needs ?? []) add(need)
  }
  for (const name of used) add(name)
  if (closure.size === 0 && !concurrent) return ""

  const blocks = [
    [
      "/* ── рантайм: то и только то, что нужно этому модулю ──",
      "   Представление значений повторяет интерпретатор flang дословно: список —",
      "   массив, запись — обычный объект, вариант — экземпляр класса, «ничто» — null.",
      "   Тексты и коды ошибок тоже дословные: они часть наблюдаемого поведения. */",
    ].join("\n"),
  ]
  if (closure.has("$INDEX_BASE")) {
    blocks.push(
      [
        "// Индексация строк — с 1 и включительно с обоих концов (SPEC, раздел 5):",
        "// «первый символ» на языке предметной области это первый, а не нулевой.",
        `const $INDEX_BASE = ${base}`,
      ].join("\n"),
    )
  }
  if (closure.has("$LIMITS")) {
    blocks.push(
      [
        "// Пределы вычисления — те же, что у интерпретатора. Без счётчиков модуль на",
        "// незавершающейся функции крутился бы вечно (в браузере — смерть вкладки), а",
        "// на глубокой рекурсии давал RangeError с пустым `code`: не отказ языка.",
        `const $DEFAULT_MAX_DEPTH = ${maxDepth}`,
        `const $DEFAULT_MAX_STEPS = ${maxSteps}`,
        "let $maxDepth = $DEFAULT_MAX_DEPTH",
        "let $maxSteps = $DEFAULT_MAX_STEPS",
        "let $depth = 0",
        "let $steps = 0",
        "// Стоит ли на расчёте граница ($top). Вызов извне приходит с `false` и",
        "// границу ставит; рекурсивные вызовы видят `true` и идут прямо в тело.",
        "let $guarded = false",
        "",
        "// Как хозяин называет исчерпание стека: V8 и JavaScriptCore — «Maximum call",
        "// stack size exceeded», SpiderMonkey — «too much recursion». Компилируется",
        "// здесь, при загрузке: компиляция образца сама требует стека, которого на",
        "// месте отказа уже нет — и тогда наружу шёл SyntaxError вместо отказа языка.",
        "const $STACK_OVERFLOW = /call stack|too much recursion|recursion too deep/iu",
        "",
        "/**",
        " * Свежий контекст вычисления: пределы и сброшенные счётчики.",
        " *",
        " * То же, что `new_context` у остальных семи целей, только контекст здесь —",
        " * сам модуль. Не переданный предел берётся ПО УМОЛЧАНИЮ, а не остаётся с",
        " * прошлого раза: контекст на то и свежий. Ноль или отрицательное значение",
        " * снимает предел.",
        " *",
        " * @param {{maxDepth?: number, maxSteps?: number}} [limits]",
        " * @returns {{maxDepth: number, maxSteps: number}}",
        " */",
        "export function $newContext(limits = {}) {",
        "  $maxDepth = typeof limits.maxDepth === \"number\" ? limits.maxDepth : $DEFAULT_MAX_DEPTH",
        "  $maxSteps = typeof limits.maxSteps === \"number\" ? limits.maxSteps : $DEFAULT_MAX_STEPS",
        "  $depth = 0",
        "  $steps = 0",
        "  return { maxDepth: $maxDepth, maxSteps: $maxSteps }",
        "}",
      ].join("\n"),
    )
  }
  for (const [name, entry] of RUNTIME) {
    if (closure.has(name)) blocks.push(entry.source)
  }
  /* Планировщик — последним: он зовёт помощников рантайма, а объявления функций
     в JS поднимаются, поэтому порядок здесь читательский, а не обязательный. */
  if (concurrent) blocks.push(CONC_SOURCE.trimEnd())
  return blocks.join("\n\n")
}

/* ── типы ── */

function jsdocType(type, shared) {
  if (type === null || typeof type !== "object") return "*"
  const inner = jsdocBase(type, shared)
  return type.optional === true ? `(${inner}|null)` : inner
}

/**
 * Имена уточнённого числа. Приходят они сюда ИМЕНЕМ, а не видом: `нат` и
 * `целое` не ключевые слова, и парсер разбирает их тем же именным узлом, каким
 * разбирает «Возможно» (см. `SCALAR_ALIASES` в types.mjs). В JavaScript
 * отдельного типа у них нет — значение то же самое число, — и написать в
 * документации `*` значило бы сказать «неизвестно» там, где известно всё.
 *
 * Печать от этого не меняется ни на знак: уточнение живёт в типизаторе, а
 * напечатанный код о нём не знает и знать не должен.
 */
const ЧИСЛОВЫЕ_ИМЕНА = new Set([
  "нат", "натуральное", "nat", "naturo", "自然数",
  "целое", "integer", "entjero", "整数",
])

function jsdocBase(type, shared) {
  switch (type.kind) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "nothing":
      return "null"
    case "list":
      return `Array<${jsdocType(type.of, shared)}>`
    default: {
      const name = typeof type.name === "string" ? type.name : null
      if (name === null) return "*"
      if (shared.recordIdents.has(name)) return shared.recordIdents.get(name)
      if (shared.sumIdents.has(name)) return shared.sumIdents.get(name)
      if (ЧИСЛОВЫЕ_ИМЕНА.has(name)) return "number"
      return "*"
    }
  }
}

function renderRecord(name, type, shared) {
  const ident = shared.recordIdents.get(name)
  const factory = shared.factoryIdents.get(name)
  const fields = Array.isArray(type.fields) ? type.fields : []
  const entries = fields.map((field) => `${JSON.stringify(field.name)}: ${jsdocType(field.type, shared)}`)

  const lines = [
    `/** Запись FTS «${name}». */`,
    `/** @typedef {{ ${entries.join(", ")} }} ${ident} */`,
    "",
    `/**`,
    ` * Фабрика записи «${name}».`,
    ` *`,
    ` * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее`,
    ` * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал`,
    ` * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.`,
    ` *`,
    ` * @param {Partial<${ident}>} [fields]`,
    ` * @returns {${ident}}`,
    ` */`,
    `export function ${factory}(fields = {}) {`,
    "  return {",
  ]
  for (const field of fields) {
    lines.push(`    ${JSON.stringify(field.name)}: fields[${JSON.stringify(field.name)}] ?? null,`)
  }
  lines.push("  }", "}")
  return lines.join("\n")
}

function renderSum(sum, shared) {
  const ident = shared.sumIdents.get(sum.name)
  const variants = Array.isArray(sum.variants) ? sum.variants : []
  shared.used.add("$FlangVariant")
  const blocks = [
    [
      `/** Сумма типов FTS «${sum.name}»: ${variants.map((item) => `«${item.name}»`).join(" | ") || "без вариантов"}. */`,
      `/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */`,
      `/** @typedef {$FlangVariant} ${ident} */`,
    ].join("\n"),
  ]
  for (const item of variants) {
    const variantIdent = shared.variantIdents.get(item.name)
    if (variantIdent === undefined) continue
    shared.used.add("$FlangVariant")
    const fields = Array.isArray(item.fields) ? item.fields : []
    const entries = fields.map((field) => `${JSON.stringify(field.name)}: ${jsdocType(field.type, shared)}`)
    blocks.push(
      [
        `/**`,
        ` * Конструктор варианта «${item.name}» суммы «${sum.name}».`,
        ` *`,
        ` * Поля не копируются, а берутся как есть: интерпретатор строит объект полей`,
        ` * в порядке узла AST, и порядок ключей виден в диагностиках разбора.`,
        ` *`,
        entries.length === 0 ? ` * @returns {$FlangVariant}` : ` * @param {{ ${entries.join(", ")} }} fields`,
        entries.length === 0 ? null : ` * @returns {$FlangVariant}`,
        ` */`,
        `export function ${variantIdent}(fields = {}) {`,
        `  return new $FlangVariant(${JSON.stringify(item.name)}, fields)`,
        "}",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
  }
  return blocks.join("\n\n")
}

/* ── функции ── */

function renderFunction(fn, shared) {
  const ident = shared.functionIdents.get(fn.name)
  const members = shared.cyclic.get(fn.name) ?? null
  /* Цикл нужен только самовызову: соседи по взаимной рекурсии уезжают в батут,
     и оборачивать их тело в `for (;;)` значило бы печатать петлю, в которую
     никто никогда не вернётся. */
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true

  /* Счётчик глубины ставится ровно на тех, кто способен к рекурсии (компонента
     сильной связности графа ВСЕХ вызовов), — как у остальных семи целей. Знание
     `total: true` при этом используется честно: оно доказывает завершение, но не
     ограничивает глубину (тотальная «Сумма» на списке в миллион элементов уйдёт
     на миллион кадров), поэтому счётчик нужен обоим классам.

     У батута тело печатается в `…$шаг`, а счётчик стоит на внешней функции:
     возврат глубины внутри шага вернул бы не свою. */
  const guard = shared.recursive.has(fn.name)
  const leaves = guard && members === null

  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...shared.functionIdents.values(), ...shared.variantIdents.values(), ...shared.factoryIdents.values()]),
    counter: 0,
    params: [],
    selfTail,
    members,
    /* Возврат из тела обязан вернуть и глубину: `return $leave(x)`. */
    leave(code) {
      if (!leaves) return code
      ctx.use("$leave")
      return `$leave(${code})`
    },
    use(name) {
      shared.used.add(name)
      return name
    },
    temp() {
      ctx.counter += 1
      return `$t${ctx.counter}`
    },
    fresh(name) {
      const wanted = safeIdent(camel(name))
      let candidate = wanted
      let suffix = 1
      while (ctx.taken.has(candidate) || JS_RESERVED.includes(candidate)) {
        suffix += 1
        candidate = `${wanted}$${suffix}`
      }
      ctx.taken.add(candidate)
      return candidate
    },
    bind(name, ident) {
      const previous = ctx.scope.has(name) ? ctx.scope.get(name) : null
      ctx.scope.set(name, ident)
      return previous
    },
    unbind(name, previous) {
      if (previous === null) ctx.scope.delete(name)
      else ctx.scope.set(name, previous)
    },
  }

  for (const param of fn.params) {
    const paramIdent = ctx.fresh(param.name)
    ctx.params.push(paramIdent)
    ctx.bind(param.name, paramIdent)
  }
  const signature = ctx.params.join(", ")

  const body = []
  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен. Первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const result = emitValue(fn.body, ctx, body, "  ")
    /* Уже вычисленное имя незачем перекладывать: постусловие смотрит на него
       столько же раз, а лишний `const` только мешает читать. */
    let resultIdent = result.code
    if (!result.pure) {
      resultIdent = ctx.temp()
      body.push(`  const ${resultIdent} = ${result.code}`)
    }
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, resultIdent)
      const check = emitValue(property.expr, ctx, body, "  ")
      ctx.unbind(property.bind, previous)
      ctx.use("$post")
      ctx.use("$fail")
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      const span = property.span === undefined || property.span === null ? "" : `, ${renderLiteral(property.span)}`
      body.push(`  // постусловие «${property.name}»`)
      body.push(
        `  if (!$post(${check.code}, ${JSON.stringify(property.name)}, ${JSON.stringify(fn.name)})) {`,
        `    $fail(${JSON.stringify(property.code)}, ${JSON.stringify(message)}${span})`,
        "  }",
      )
    }
    body.push(`  return ${ctx.leave(resultIdent)}`)
  } else if (selfTail) {
    body.push("  for (;;) {")
    /* Оборот цикла — виток, и он ставится не здесь, а прямо на `continue`
       (см. `emitTail`): виток на входе в функцию хвостовой самовызов не
       поймает — кадра он не растит, — а оборотом считается именно возврат к
       голове цикла, а не первый проход по телу. */
    emitTail(fn.body, ctx, body, "    ")
    body.push("  }")
  } else {
    emitTail(fn.body, ctx, body, "  ")
  }

  const doc = ["/**", ` * Функция flang «${fn.name}».`]
  if (fn.total) {
    doc.push(" *", " * Тотальная: завершение доказано анализом завершаемости (totality.mjs).")
  } else {
    doc.push(
      " *",
      " * Обычная (не тотальная) функция: её завершение не доказано; зацикливание",
      " * ловится лимитом шагов, как в интерпретаторе.",
    )
  }
  if (guard) {
    doc.push(" *", " * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  if (selfTail) {
    doc.push(
      " *",
      " * Хвостовые самовызовы развёрнуты в цикл: глубина стека JS не растёт, поэтому",
      " * рекурсия «пока не кончится список» проходит и на сотнях тысяч шагов.",
    )
  }
  if (members !== null) {
    const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
    doc.push(
      " *",
      ` * Взаимная хвостовая рекурсия с ${others}: вызовы идут через батут, глубина стека постоянна.`,
    )
  }
  doc.push(" *")
  for (const [index, param] of fn.params.entries()) {
    doc.push(` * @param {${jsdocType(param.type, shared)}} ${ctx.params[index]} — «${param.name}»`)
  }
  doc.push(` * @returns {${jsdocType(fn.returns, shared)}}`, " */")

  const label = JSON.stringify(fn.name)

  /* Преамбула счётчика: граница на вызов извне и подъём глубины. Возврат глубины
     стоит на самих `return` (`$leave`), а не в `finally`, — так вдвое больше
     доступной глубины, см. комментарий у `$leave`.

     Виток — вход в функцию, оборот хвостового цикла и шаг батута: те же три
     места, что в C (`flang_runtime.c`, `fl_tick`/`fl_enter`), и по той же
     причине. Без счёта витков обработчик с объявленным запасом не отказал бы, а
     ЗАВИС — худший из исходов, и запас перестал бы что-либо значить.

     Счётчик ОДИН на все три места и на оба предела — и на `maxSteps` расчёта, и
     на запас витков процесса. Своего счётчика у конкурентности НЕТ: планировщик
     ставит предел общему на время пробега (`js/flang_conc.js`). Раньше у неё был
     свой (`$tick` на входе в каждую функцию конкурентного модуля), и это были два
     разных числа предела в одном модуле: тот же обработчик отказал бы по одному
     прибору, досчитав по другому. Счёт стоит ровно на тех функциях, которые лежат
     на цикле графа вызовов (`recursive`), — не завершиться может только цикл, —
     поэтому запас работает и там, где счёт дешевле. */
  const preamble = () => {
    if (!guard) return []
    ctx.use("$enter")
    ctx.use("$leave")
    ctx.use("$top")
    return [`  if (!$guarded) return $top(${ident}, [${signature}], ${label})`, `  $enter(${label})`]
  }

  if (members === null) {
    return [doc.join("\n"), `export function ${ident}(${signature}) {`, ...preamble(), ...body, "}"].join("\n")
  }

  /* Батут: наружу торчит обычная функция, внутри — шаг, возвращающий отскок.
     Счётчик глубины стоит на внешней функции, а не на шаге: шаг кадра не растит,
     и считать его глубиной значило бы считать то, чего нет. Ровно так же
     расставлено в остальных семи целях. */
  const step = shared.stepIdents.get(fn.name)
  ctx.use("$trampoline")
  const bounced = guard
    ? `  return $leave($trampoline(${step}(${signature}), ${label}))`
    : `  return $trampoline(${step}(${signature}), ${label})`
  return [
    doc.join("\n"),
    `export function ${ident}(${signature}) {`,
    ...preamble(),
    bounced,
    "}",
    "",
    `/** Шаг батута для «${fn.name}»: значение либо отскок к соседу по взаимной рекурсии. */`,
    `function ${step}(${signature}) {`,
    ...body,
    "}",
  ].join("\n")
}

/* ── хвостовая позиция: здесь живут `return`, `continue` и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}const ${ident} = ${value.code}`)
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      return
    }
    case "if": {
      const cond = emitValue(node.cond, ctx, out, pad)
      ctx.use("$cond")
      out.push(`${pad}if ($cond(${cond.code})) {`)
      emitTail(node.then, ctx, out, `${pad}  `)
      out.push(`${pad}} else {`)
      emitTail(node.else, ctx, out, `${pad}  `)
      out.push(`${pad}}`)
      return
    }
    case "match":
      emitMatch(node, ctx, out, pad, null)
      return
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = emitOperands(node.args ?? [], ctx, out, pad)
      if (ctx.selfTail && node.name === ctx.fn.name) {
        /* Самовызов в хвосте — это цикл. Присваивание параметров идёт по
           очереди, поэтому аргумент, который ещё читает старое значение
           параметра, обязан сперва лечь во временное. Исключение ровно одно и
           оно очевидно: имя, которое параметром не является, затереть нечем. */
        const temps = args.map((arg) => {
          if (/^[A-Za-z_$][\w$]*$/u.test(arg) && !ctx.params.includes(arg)) return arg
          const temp = ctx.temp()
          out.push(`${pad}const ${temp} = ${arg}`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]}`)
        })
        /* Оборот цикла — тоже виток вычисления: незавершающийся хвостовой
           самовызов глубину не растит, и упереться ему больше не во что. Без
           этой строки «Вечность» крутилась бы вечно, а в браузере унесла бы с
           собой вкладку. */
        ctx.use("$step")
        out.push(`${pad}$step(${JSON.stringify(ctx.fn.name)})`)
        out.push(`${pad}continue`)
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        ctx.use("$Bounce")
        out.push(`${pad}return new $Bounce(${ctx.shared.stepIdents.get(node.name)}, [${args.join(", ")}])`)
        return
      }
      out.push(`${pad}return ${ctx.leave(`${ctx.shared.functionIdents.get(callee.name)}(${args.join(", ")})`)}`)
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}return ${ctx.leave(value.code)}`)
    }
  }
}

/* ── значение: возвращает выражение JS, попутно печатая нужные ему операторы ── */

function emitValue(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "literal":
      return { code: renderLiteral(node.value), pure: true }
    case "var": {
      const ident = ctx.scope.get(node.name)
      if (ident === undefined) {
        throw flangError("FLANG_UNKNOWN_NAME", `имя «${node.name}» не связано`, node.span)
      }
      return { code: ident, pure: true }
    }
    case "field": {
      const target = emitValue(node.target, ctx, out, pad)
      ctx.use("$field")
      return { code: `$field(${target.code}, ${JSON.stringify(node.field)})`, pure: false }
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}const ${ident} = ${value.code}`)
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      return body
    }
    case "if": {
      const cond = emitValue(node.cond, ctx, out, pad)
      const result = ctx.temp()
      ctx.use("$cond")
      out.push(`${pad}let ${result}`)
      out.push(`${pad}if ($cond(${cond.code})) {`)
      assignInto(node.then, ctx, out, `${pad}  `, result)
      out.push(`${pad}} else {`)
      assignInto(node.else, ctx, out, `${pad}  `, result)
      out.push(`${pad}}`)
      return { code: result, pure: true }
    }
    case "match": {
      const result = ctx.temp()
      out.push(`${pad}let ${result}`)
      emitMatch(node, ctx, out, pad, result)
      return { code: result, pure: true }
    }
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = emitOperands(node.args ?? [], ctx, out, pad)
      return { code: `${ctx.shared.functionIdents.get(callee.name)}(${args.join(", ")})`, pure: false }
    }
    case "builtin": {
      const canonical = canonicalBuiltinName(node.name)
      if (!hasBuiltin(node.name)) {
        throw flangError("FLANG_UNKNOWN_NAME", `неизвестная встроенная форма «${node.name}»`, node.span)
      }
      const args = node.args ?? []
      if (!Array.isArray(args)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
      }
      expectArity(canonical, args.length, node.span)
      const rendered = emitOperands(args, ctx, out, pad)
      const helper = ctx.use(BUILTIN_HELPERS.get(canonical))
      return { code: `${helper}(${rendered.join(", ")})`, pure: false }
    }
    case "binary": {
      const [left, right] = emitOperands([node.left, node.right], ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        ctx.use("$equal")
        const call = `$equal(${left}, ${right})`
        return { code: node.op === "eq" ? call : `!${call}`, pure: false }
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      ctx.use(helper)
      return { code: `${helper}(${left}, ${right})`, pure: false }
    }
    case "list": {
      const items = node.items ?? []
      if (!Array.isArray(items)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
      }
      const rendered = emitOperands(items, ctx, out, pad)
      return { code: `[${rendered.join(", ")}]`, pure: false }
    }
    case "record": {
      const fields = node.fields ?? {}
      checkRecordType(node, ctx)
      const keys = Object.keys(fields)
      const rendered = emitOperands(keys.map((key) => fields[key]), ctx, out, pad)
      const entries = keys.map((key, index) => `${JSON.stringify(key)}: ${rendered[index]}`)
      return { code: entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`, pure: false }
    }
    case "construct": {
      const fields = node.fields ?? {}
      checkVariantName(node, ctx)
      const keys = Object.keys(fields)
      const rendered = emitOperands(keys.map((key) => fields[key]), ctx, out, pad)
      const entries = keys.map((key, index) => `${JSON.stringify(key)}: ${rendered[index]}`)
      const payload = entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`
      const constructor = ctx.shared.variantIdents.get(node.variant)
      if (constructor !== undefined) return { code: `${constructor}(${payload})`, pure: false }
      ctx.use("$FlangVariant")
      return { code: `new $FlangVariant(${JSON.stringify(node.variant)}, ${payload})`, pure: false }
    }
    case "fold":
      return emitFold(node, ctx, out, pad)
    case "map":
    case "filter":
      return emitLoop(node, ctx, out, pad)
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид выражения «${node.kind}»`, node.span)
  }
}

/** Вычислить выражение и положить результат в уже объявленную переменную. */
function assignInto(expr, ctx, out, pad, target) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${target} = ${value.code}`)
}

/**
 * Строгий порядок слева направо.
 *
 * Если правому соседу понадобились собственные операторы, левый обязан быть уже
 * вычислен — иначе его ошибка (а она возможна почти в любом узле) прозвучала бы
 * позже правой. Поэтому левые соседи материализуются во временные `const` ровно
 * тогда, когда справа есть что печатать.
 */
function emitOperands(exprs, ctx, out, pad) {
  if (!Array.isArray(exprs)) {
    throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком")
  }
  const parts = exprs.map((expr) => {
    const buffer = []
    const value = emitValue(expr, ctx, buffer, pad)
    return { buffer, value }
  })
  const codes = []
  for (let index = 0; index < parts.length; index += 1) {
    const later = parts.slice(index + 1).some((part) => part.buffer.length > 0)
    out.push(...parts[index].buffer)
    if (later && !parts[index].value.pure) {
      const temp = ctx.temp()
      out.push(`${pad}const ${temp} = ${parts[index].value.code}`)
      codes.push(temp)
    } else {
      codes.push(parts[index].value.code)
    }
  }
  return codes
}

/* ── разбор ── */

// `target === null` — хвостовая позиция (тела ветвей печатают `return`), иначе
// результат каждой ветви кладётся в переданную переменную.
function emitMatch(node, ctx, out, pad, target) {
  const subject = emitValue(node.target, ctx, out, pad)
  let subjectCode = subject.code
  if (!subject.pure) {
    subjectCode = ctx.temp()
    out.push(`${pad}const ${subjectCode} = ${subject.code}`)
  }

  const cases = node.cases ?? []
  if (!Array.isArray(cases)) {
    throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
  }
  let opened = false
  let closed = false
  for (const branch of cases) {
    if (branch === null || typeof branch !== "object" || branch.pattern === undefined) {
      throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
    }
    const test = patternTest(branch.pattern, subjectCode, ctx, node.span)
    if (test === null) {
      /* Образец, совпадающий всегда: дальше идти некуда, и `else` честнее, чем
         `if (true)`. Случаи после него недостижимы — интерпретатор до них тоже
         не дойдёт. */
      out.push(opened ? `${pad}} else {` : `${pad}{`)
      opened = true
      emitBranch(branch, subjectCode, ctx, out, `${pad}  `, target)
      out.push(`${pad}}`)
      closed = true
      break
    }
    out.push(opened ? `${pad}} else if (${test}) {` : `${pad}if (${test}) {`)
    opened = true
    emitBranch(branch, subjectCode, ctx, out, `${pad}  `, target)
  }
  if (closed) return
  ctx.use("$matchFail")
  if (opened) {
    out.push(`${pad}} else {`, `${pad}  $matchFail(${subjectCode})`, `${pad}}`)
  } else {
    out.push(`${pad}$matchFail(${subjectCode})`)
  }
}

function emitBranch(branch, subjectCode, ctx, out, pad, target) {
  const undo = bindPattern(branch.pattern, subjectCode, ctx, out, pad)
  if (target === null) emitTail(branch.body, ctx, out, pad)
  else assignInto(branch.body, ctx, out, pad, target)
  for (const step of undo) ctx.unbind(step.name, step.previous)
}

/** Проверка дискриминанта; `null` — образец совпадает всегда. */
function patternTest(pattern, subject, ctx, span) {
  switch (pattern.kind) {
    /* Цепочка — список либо строка: `пусто` и `голова и хвост` разбирают обе.
       Различать их здесь нечем — у печати нет типов, — да и незачем: проверка
       вида стоит одну ветку. */
    case "empty":
      ctx.use("$chainEmpty")
      return `$chainEmpty(${subject})`
    case "cons":
      ctx.use("$chainCons")
      return `$chainCons(${subject})`
    case "variant":
      ctx.use("$isVariant")
      return `$isVariant(${subject}) && ${subject}.variant === ${JSON.stringify(pattern.name)}`
    case "literal":
      ctx.use("$equal")
      return `$equal(${subject}, ${renderLiteral(pattern.value)})`
    case "any":
      return null
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид образца «${pattern.kind}»`, span)
  }
}

function bindPattern(pattern, subject, ctx, out, pad) {
  const undo = []
  const bind = (name, code) => {
    const ident = ctx.fresh(name)
    out.push(`${pad}const ${ident} = ${code}`)
    undo.push({ name, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        ctx.use("$chainHead")
        bind(pattern.head, `$chainHead(${subject})`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        ctx.use("$chainTail")
        bind(pattern.tail, `$chainTail(${subject})`)
      }
      return undo
    case "variant": {
      const declared = pattern.bind ?? {}
      const entries = Array.isArray(declared)
        ? declared.map((field) => [field, field])
        : Object.entries(declared)
      for (const [field, name] of entries) {
        /* Отсутствующее поле варианта — ошибка прямо при сопоставлении, а не
           «случай не подошёл»: так же ведёт себя matchPattern интерпретатора. */
        ctx.use("$variantField")
        bind(name, `$variantField(${subject}, ${JSON.stringify(field)})`)
      }
      return undo
    }
    case "any":
      if (typeof pattern.bind === "string") bind(pattern.bind, subject)
      return undo
    default:
      return undo
  }
}

/* ── свёртка, отобразить, отфильтровать ── */

function emitFold(node, ctx, out, pad) {
  requireName(node.acc, "fold", "acc", node.span)
  requireName(node.item, "fold", "item", node.span)
  /* Порядок как в интерпретаторе: сперва коллекция и проверка «это список»,
     только потом начальное значение. */
  const over = emitValue(node.over, ctx, out, pad)
  ctx.use("$requireList")
  const list = ctx.temp()
  out.push(`${pad}const ${list} = $requireList(${over.code}, "свёртка")`)

  const init = emitValue(node.init, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  out.push(`${pad}let ${accIdent} = ${init.code}`)
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}for (const ${itemIdent} of ${list}) {`)

  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}  `, accIdent)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)

  out.push(`${pad}}`)
  return { code: accIdent, pure: true }
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  ctx.use("$requireList")
  const list = ctx.temp()
  out.push(`${pad}const ${list} = $requireList(${over.code}, ${JSON.stringify(label)})`)
  const result = ctx.temp()
  out.push(`${pad}const ${result} = []`)
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}for (const ${itemIdent} of ${list}) {`)

  const undo = ctx.bind(node.item, itemIdent)
  const inner = `${pad}  `
  const value = emitValue(node.body, ctx, out, inner)
  if (node.kind === "map") {
    out.push(`${inner}${result}.push(${value.code})`)
  } else {
    ctx.use("$keep")
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    out.push(`${inner}if ($keep(${value.code})) ${result}.push(${itemIdent})`)
  }
  ctx.unbind(node.item, undo)
  out.push(`${pad}}`)
  return { code: result, pure: true }
}

/* ── проверки, повторяющие интерпретатор ── */

function requireExpr(expr) {
  if (expr === undefined || expr === null || typeof expr !== "object" || Array.isArray(expr)) {
    throw flangError("FLANG_PARSE", `ожидалось выражение, получено ${JSON.stringify(expr) ?? "undefined"}`)
  }
  return expr
}

function requireName(name, kind, field, span) {
  if (typeof name !== "string" || name.length === 0) {
    throw flangError("FLANG_PARSE", `узел «${kind}» требует непустое имя в поле «${field}»`, span)
  }
}

function resolveCall(node, ctx) {
  const callee = ctx.shared.prepared.functions.get(node.name)
  if (!callee) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${node.name}»`, node.span)
  const args = node.args ?? []
  if (!Array.isArray(args)) {
    throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
  }
  if (args.length !== callee.params.length) {
    throw flangError(
      "FLANG_TYPE",
      `функция «${callee.name}» принимает ${callee.params.length} аргум., передано ${args.length}`,
      node.span,
    )
  }
  return callee
}

// Полноценная проверка типов — дело types.mjs; здесь только защита от опечатки
// в имени, ровно как в интерпретаторе.
function checkVariantName(node, ctx) {
  if (ctx.shared.prepared.variants.size === 0) return
  if (!ctx.shared.prepared.variants.has(node.variant)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестный вариант «${node.variant}»`, node.span)
  }
}

function checkRecordType(node, ctx) {
  if (ctx.shared.prepared.records.size === 0 || node.type === undefined) return
  if (!ctx.shared.prepared.records.has(node.type)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестная запись «${node.type}»`, node.span)
  }
}

function plural(count, one, few, many) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function expectArity(name, got, span) {
  const count = BUILTIN_ARITY.get(name)
  if (count === undefined || got === count) return
  const word = plural(count, "аргумент", "аргумента", "аргументов")
  throw flangError("FLANG_BUILTIN_ARGS", `«${name}» ожидает ${count} ${word}, получено ${got}`, span)
}

/* ═══════════════════════════ конкурентность ═══════════════════════════
   Процессы, надзоры и прогоны печатаются ДАННЫМИ — одним объектом уровня
   модуля, — а планировщик приезжает готовым (`js/flang_conc.js`). Тот же приём,
   что в C и в Elixir, и по той же причине: надзор в flang — объявление, и одно
   объявление обязано остаться одним местом в напечатанном коде. Печать готового
   планировщика на каждую программу размазала бы его по файлу и превратила
   правку одной строки исходника в правку десятка строк вывода — а сам
   планировщик обязан остаться одним и тем же для всех программ, иначе сверять с
   эталоном пришлось бы не модель, а каждую печать по отдельности.

   Разница с C ровно одна, и она в пользу JavaScript: обработчик кладётся в план
   САМОЙ ФУНКЦИЕЙ, а не именем. В C планировщику нужен диспетчер по имени
   (`prefix_call`), потому что указателя на функцию с переменной арностью там не
   выразить; здесь функция — значение, и второй словарь «имя → функция» рядом с
   областью видимости модуля был бы лишней сущностью. Имя при этом всё равно
   печатается рядом: журнал, отказы и сообщения об ошибках называют обработчик
   так, как его назвал автор.
   ═══════════════════════════════════════════════════════════════════════════ */

function renderConcurrency(processes, supervisors, runs, program, shared) {
  const totals = new Set(
    (program.functions ?? []).filter((fn) => fn?.total === true).map((fn) => fn.name),
  )
  /* Функция, которой в программе нет, — это отказ ПЕЧАТИ, а не пустое место в
     плане: молча напечатать процесс без обработчика значило бы вернуться к тому
     самому поведению, из-за которого шесть целей теряли процессы. */
  const функция = (имя, роль, процесс) => {
    const ident = shared.functionIdents.get(имя)
    if (ident === undefined) {
      throw flangError(
        "FLANG_EMIT",
        `${роль} «${имя}» процесса «${процесс}» в программе не объявлен: напечатать процесс нечем`,
      )
    }
    return ident
  }

  const lines = [
    "/* ── План конкурентности: процессы, надзоры и прогоны данными ── */",
    "const $conc = {",
    "  процессы: [",
  ]
  for (const node of processes) {
    /* Запас витков ставится ТОЛЬКО нетотальному обработчику: про тотальный
       доказано, что он завершится, и отсчитывать нечего — ровно так решает
       планировщик эталона, и разойтись здесь было бы нельзя, потому что от этого
       зависит, каким кодом кончится отказ. */
    const total = totals.has(node.handler)
    const budget = !total && Number.isFinite(node.budget) ? Math.trunc(node.budget) : 0
    /* Ноль — «ящик неограничен», ровно как ноль в запасе значит «считать
       нечего»: ящик в ноль сообщений проверка типов не пропускает, поэтому два
       смысла нуля здесь не сталкиваются. */
    const mailbox = Number.isFinite(node.mailbox) && node.mailbox > 0 ? Math.trunc(node.mailbox) : 0
    lines.push(
      "    {",
      `      имя: ${jsstring(node.name)},`,
      `      обработчик: ${jsstring(node.handler)},`,
      `      вызвать: ${функция(node.handler, "обработчик", node.name)},`,
      `      начало: ${jsstring(node.initial)},`,
      `      завести: ${функция(node.initial, "начальное состояние", node.name)},`,
      `      тотальный: ${total ? "true" : "false"},`,
      `      запас: ${budget},`,
      `      ящик: ${mailbox},`,
      "    },",
    )
  }
  lines.push("  ],", "  надзоры: [")
  for (const node of supervisors) {
    const watch = (node.watch ?? []).map((item) => `[${jsstring(item.process)}, ${jsstring(item.strategy)}]`)
    const nested = (node.nested ?? []).map((item) => `[${jsstring(item.supervisor)}, ${jsstring(item.strategy)}]`)
    const threshold = node.threshold ?? null
    lines.push(
      "    {",
      `      имя: ${jsstring(node.name)},`,
      `      процессы: [${watch.join(", ")}],`,
      `      вложенные: [${nested.join(", ")}],`,
      `      порог: ${
        threshold === null
          ? "null"
          : `{ отказов: ${renderNumber(threshold.failures)}, окно: ${renderNumber(threshold.window)}, ` +
            `иначе: ${jsstring(threshold.otherwise)} }`
      },`,
      "    },",
    )
  }
  lines.push("  ],", "  прогоны: [")
  for (const run of runs) {
    const inbox = (run.inbox ?? []).map(
      (entry) => `[${jsstring(entry.process)}, ${renderMessage(entry.message, shared)}]`,
    )
    const to = run.seedTo === null || run.seedTo === undefined ? run.seed : run.seedTo
    lines.push(
      "    {",
      `      имя: ${jsstring(run.name)},`,
      `      семя: ${renderNumber(run.seed)},`,
      `      доСемени: ${renderNumber(to)},`,
      /* Входные сообщения — ЗАМЫКАНИЕ, а не готовый список: значение строится
         конструктором этого же модуля, и строить его при загрузке значило бы
         платить за прогоны, которых никто не звал. Ровно по этой же причине
         входной ящик в C печатается функцией, а не таблицей. */
      `      вход: () => [${inbox.join(", ")}],`,
      "    },",
    )
  }
  lines.push("  ],", "}")
  lines.push(
    "",
    "/**",
    " * План конкурентности этого модуля: процессы, надзоры, прогоны.",
    " *",
    " * Отдаётся как есть, а не копией: план не меняется ни планировщиком, ни",
    " * прогоном — состояние прогона живёт в самом прогоне.",
    " */",
    "export function concPlan() {",
    "  return $conc",
    "}",
    "",
    "/**",
    " * Прогон объявленной программы: одно семя — один журнал доставок, побайтово.",
    " *",
    " * Конкурентность здесь есть, параллелизма нет: один поток. Наблюдаемая",
    " * семантика от этого не беднее — набор возможных исходов определён",
    " * чередованием, а не числом ядер, и чередование выбирает семя.",
    " *",
    " * @param {string} имя имя объявленного прогона",
    " * @param {{ семя?: number, пробегов?: number, журнал?: boolean }} [настройки]",
    " * @returns {object} исход, состояния, живые, отказы, решения, наверх, время,",
    " *   пробегов, витки и — если не отключён признаком `журнал` — журнал доставок",
    " */",
    "export function concRun(имя, настройки = {}) {",
    "  return $concПрогон($conc, имя, настройки)",
    "}",
  )
  return lines.join("\n")
}

/**
 * Литерал входного сообщения прогона.
 *
 * Отдельно от `renderLiteral`, а не вместо него, по одной причине: вариант в AST
 * записан объектом `{ variant, fields }` (так его читает `reifyValue`
 * интерпретатора), и `renderLiteral` напечатал бы такой объект ЗАПИСЬЮ с полями
 * «variant» и «fields». Для сообщения прогона это была бы прямая ошибка —
 * обработчик не сопоставил бы его ни с одним образцом, — а править сам
 * `renderLiteral` значило бы менять печать всех программ подряд ради одного
 * места. Ровно так же и по тому же доводу устроен `emitMessage` в c.mjs.
 */
function renderMessage(value, shared) {
  if (Array.isArray(value)) return `[${value.map((item) => renderMessage(item, shared)).join(", ")}]`
  if (value !== null && typeof value === "object") {
    const encoded = encodedVariant(value)
    if (encoded !== null) {
      const ident = shared.variantIdents.get(encoded.variant)
      if (ident === undefined) {
        throw flangError(
          "FLANG_EMIT",
          `входное сообщение прогона называет вариант «${encoded.variant}», которого в программе нет`,
        )
      }
      const fields = Object.keys(encoded.fields)
      return fields.length === 0
        ? `${ident}()`
        : `${ident}({ ${fields.map((key) => `${jsstring(key)}: ${renderMessage(encoded.fields[key], shared)}`).join(", ")} })`
    }
    const keys = Object.keys(value)
    return keys.length === 0
      ? "{}"
      : `{ ${keys.map((key) => `${jsstring(key)}: ${renderMessage(value[key], shared)}`).join(", ")} }`
  }
  return renderLiteral(value)
}

/** Объект ровно с двумя полями `variant` и `fields` — это вариант, а не запись. */
function encodedVariant(value) {
  if (value === null || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes("variant") || !keys.includes("fields")) return null
  if (typeof value.variant !== "string" || value.variant === "") return null
  const fields = value.fields
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return null
  return { variant: value.variant, fields }
}
