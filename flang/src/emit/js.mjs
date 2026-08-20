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
// ── Один файл на программу, плюс прогонщик ─────────────────────────────────
// AST flang (раздел 5) описывает ровно один модуль (`module`), а функции внутри
// него свободно вызывают друг друга, в том числе взаимно рекурсивно. Разложить
// их по файлам значило бы завести циклические импорты ради ничего и продублировать
// рантайм-префикс в каждом файле. Поэтому одна ПРОГРАММА — один файл, и этот
// файл по-прежнему самодостаточен и работает в браузере.
//
// Рядом печатается второй файл — прогонщик `flang_cli.js` (`js/flang_cli.js`),
// тот же, что у остальных семи целей: JSON на входе, JSON на выходе. Он не
// часть модуля и в браузер не едет; отменяется ключом `cli: false`. Без него у
// цели не было двух вещей. Первая — способ позвать программу из чего угодно,
// у чего есть труба, и сверить её с интерпретатором на тысячах входов одним
// запуском процесса. Вторая важнее: объявленный предел глубины несёт стек, а
// стека вызывающего в JavaScript не хватает НИ ОДНОЙ программе (7 386 кадров у
// самой тонкой функции при обещанных 10 000). Рычаг у модуля есть — `$callDeep`
// ниже, — но звать его надо руками, и ОБЫЧНЫЙ запуск объявленного предела не
// имел. Прогонщик ставит рычаг на пути каждого запроса.
//
// Всё, что прогонщику нужно от конкретной программы, — таблица `$PROGRAM`
// (`renderProgramTable`): имена flang → функции, фабрика варианта и размер
// стека, посчитанный ЗДЕСЬ, при печати, по объявленному пределу глубины.
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
// ── Цена «добавить»: почему вид, а не массив ───────────────────────────────
// Предел шагов, который не срабатывает вовсе, — не предел. Точка
// `«Строить скобки» от 42 и 0 и 0 и "" и []`
// (`flang/examples/leetcode/022-generate-parentheses.flang`) при объявленных
// 5 000 000 шагов НЕ ОТВЕЧАЛА и за 90 с (снято по сроку), тогда как
// интерпретатор упирается в предел за 919 мс, а починенная печать — за 0,8 с.
// Считал счётчик верно — дорог был ШАГ: `добавить` печаталось
// как `[...list, item]`, копия всего списка на каждый вызов, и накопление n слов
// стоило O(n²). Шаг ценой O(длины) не ограничивает работу ничем.
//
// Приём C, Rust и Go — общий массив с отметкой «сколько ячеек занято» и список
// как СРЕЗ этого массива — здесь не переносится дословно, и вот почему. Список
// flang в этой цели — обычный массив JS, и это часть наблюдаемого протокола: его
// читают тесты, прогонщик, сверки с интерпретатором и всякий, кто модуль
// импортировал. А два массива JS с РАЗНОЙ длиной разделить хранилище не могут:
// длина у массива — собственное свойство, элементы принадлежат самому объекту,
// среза (вида на чужие ячейки) в языке нет. Значит любой способ, при котором
// значение — обычный массив, обязан скопировать n элементов на каждое
// `добавить`: Ω(n) на шаг, и это не недоделка, а доказуемая невозможность.
//
// Выход, не меняющий протокола ни на знак: значение остаётся МАССИВОМ по всем
// наблюдениям, но перестаёт быть массивом по хранению — `добавить` отдаёт
// `Proxy` над общим буфером (`$view`), у которого своя длина. Прокси над
// массивом — массив для `Array.isArray`, для `length`, для чтения по индексу,
// для перебора, для `JSON.stringify`, для расширения `[...x]`, для
// `Object.keys`, для `deepStrictEqual` и для `Object.getPrototypeOf`: сверено
// программой, «вид «добавить» неотличим от обычного массива» ниже по файлу
// тестов. Отсюда правило занятия ячейки — ровно то же, что в Go и Rust:
// дописать за конец вправе единственный список, тот, чей конец совпал с концом
// буфера; всякий другой уходит на копию. Ветвление двух `добавить` от одного
// значения даёт две независимых копии, ячейки внутри списка не пишет никто.
//
// Чем плачено. Чтение элемента у списка, ВЫДАННОГО `добавить`, идёт сквозь
// ловушку прокси: 341 нс против 7 нс у обычного массива на замере 10⁶ чтений.
// Класс сложности при этом не меняется (`элемент N` остаётся обращением по
// индексу), а цена накопления падает классом: 200 000 `добавить` в напечатанном
// модуле — 133 мс вместо больше 120 000 мс (снято по сроку); 50 000 — 45 мс
// вместо 13 029. Обмен принят осознанно: до него всякая программа с
// `добавить` в цикле была квадратичной, то есть медленнее не в 50 раз, а во
// сколько угодно. Второе, чем плачено: вид держит буфер живым целиком — как
// срез в Go, — поэтому короткий вид на длинный буфер не даёт освободить хвост.
// Третье: `util.inspect` печатает вид как `Proxy([...])` вместе с ячейками
// соседа — это видно только в сообщениях об ошибках, на значения не влияет.
// Четвёртое, и это единственное, чем вид от массива ОТЛИЧИМ: запись в него
// отвергается (в модуле, то есть в строгом режиме, — `TypeError`), тогда как в
// массив, который отдавало прежнее `добавить`, чужая запись проходила. Значение
// flang неизменяемо по договору, а пустить запись в общий буфер значило бы
// испортить соседний список — отказ здесь честнее тишины. Проверено там же, где
// и неотличимость.
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
//   • Стек хозяина кончался РАНЬШЕ объявленного предела, и здесь стояло, что
//     поднять его изнутри модуля нечем: «в Python это делает поток с заданным
//     стеком, в JS такого рычага нет». Это была неправда, и стоила она всего
//     обещания: замер холодными процессами показал 7 386 кадров у самой тонкой
//     рекурсивной функции и 1 379 у функции с сорока связываниями при
//     объявленных 10 000 — то есть предела, который язык обещает, у этой цели
//     не было НИ ДЛЯ ОДНОЙ программы. Рычаг тот же, что в Python и C: поток с
//     явно заданным стеком (`worker_threads`, `resourceLimits.stackSizeMb`), и
//     он стоит в `$callDeep` — под 10 000 кадров отводится 79 МиБ, и худшая из
//     мерянных форм доходит до предела ЯЗЫКА и отказывает текстом свидетеля.
//     Замеры и границы — у самого `$callDeep`, ниже по файлу.
//     Где рычага нет (браузер; прямой вызов мимо `$callDeep`), обещание держит
//     сторож: `$hostDepth` переводит переполнение стека в объявленный
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

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { требуетХозяина } from "../conc.mjs"
import { требуетИсполнителяПлана } from "../target-plan.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"
import { camel, createNamer, pascal, snake } from "../naming.mjs"
import { обойтиЗанятоеЦелью } from "../target-occupied.mjs"

/* Планировщик конкурентности — настоящий .js рядом, а не строка здесь, и по той
   же причине, по какой так сделано в C (`emit/c/flang_conc.c`): его читает
   человек и проверяет разбором сам движок, когда загружает напечатанный модуль,
   а не наши глаза сквозь кавычки шаблона. Печатается он ЦЕЛИКОМ и только той
   программе, у которой есть процессы: обычной программе планировщик не нужен, и
   ни один её байт от планировщика не изменился. Своего счётчика витков он с
   собой не приносит — считает общий счётчик модуля (`$step`), а планировщик
   только ставит ему предел на время пробега. */
const CONC_SOURCE = readFileSync(new URL("js/flang_conc.js", import.meta.url), "utf8")

/* Прогонщик — тоже настоящий .js рядом, и по тем же причинам: его читает
   человек, а разбирает движок. В отличие от планировщика он печатается ОТДЕЛЬНЫМ
   файлом и байт в байт одинаково для любой программы — как `flang_cli.c` у C и
   `flang_cli.py` у Python. Связь с конкретной программой у него ровно одна и она
   в модуле: таблица `$PROGRAM`. */
const CLI_SOURCE = readFileSync(new URL("js/flang_cli.js", import.meta.url), "utf8")

/* Исполнитель плана — тоже настоящий `.js` рядом и тоже читается файлом, и по
   той же причине, что планировщик: его читает человек, и жить он обязан файлом,
   который открывается и правится, а не строковым литералом внутри печати. Едет
   он ВНУТРЬ модуля, а не вторым файлом: во вкладку он нужен, а обещание
   «модуль самодостаточен» дороже экономии на общем для всех программ куске. */
const IO_SOURCE = readFileSync(new URL("js/flang_io.js", import.meta.url), "utf8")

/** Имя файла прогонщика — то же, что у семи остальных целей. */
const CLI_FILE = "flang_cli.js"

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

/* Отдельный помощник, а не `$post` со вторым текстом: слова отказа дословно те
   же, что у интерпретатора (`checkPreconditions` в src/interpret.mjs), и одно
   сообщение на две разные вещи расходилось бы молча. Печатается он ТОЛЬКО в
   программу, у которой есть `требует`, — как и всё остальное здесь. */
function $pre(value, property, name) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `предусловие «${property}» функции «${name}» должно давать признак, получено ${$typeName(value)}`)
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

/* ── Доказанный путь тех же четырёх форм ───────────────────────────────────
 *
 * Частичная форма отказывает не всегда, а на пустом: `голова` пустого списка,
 * `код символа` пустой строки, `разделить` по пустому разделителю. Там, где
 * непустота ДОКАЗАНА проверкой типов (`src/types.mjs`, `длинаНиз`), узел
 * приезжает с отметкой `доказана`, и печать зовёт эти помощники — те же
 * действия без проверки, которой нечего ловить.
 *
 * Сверка типа остаётся: `$expectList` ловит НЕ пустоту, а другой вид значения,
 * и его гарантирует не непустота, а сама проверка типов. Снимается ровно один
 * сторож — тот, что назван в `ЧАСТИЧНЫЕ` (`src/failures.mjs`).
 */
function $b_golova_dokazano(value) {
  return $expectList("голова", value, "аргумент")[0]
}

function $b_hvost_dokazano(value) {
  return $expectList("хвост", value, "аргумент").slice(1)
}

function $b_razdelit_dokazano(text, separator) {
  $expectString("разделить", text, "строка")
  $expectString("разделить", separator, "разделитель")
  return text.split(separator)
}

function $b_kod_simvola_dokazano(text) {
  $expectString("код символа", text, "строка")
  return Array.from(text)[0].codePointAt(0)
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

// Ключ свойства как индекс массива; −1, если ключ индексом не является.
// Сверка `String(index) === key` обязательна: иначе " 1", "01" и "1e0" сошли бы
// за единицу, а они — обычные строковые ключи, и элементами массива не являются.
function $indexKey(key) {
  if (typeof key !== "string") return -1
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && String(index) === key ? index : -1
}

// Виды «добавить»: вид → { ячейки, конец }. Отдельно от самого вида, потому что
// спрашивают о нём по значению-ключу, а не сквозь ловушку: обращение к прокси
// по служебному полю стоило бы столько же, сколько чтение элемента.
const $VIEWS = new WeakMap()

/**
 * Список как ВИД на общий буфер: те же ячейки, своя длина.
 *
 * Зачем он нужен и почему обычным массивом обойтись нельзя — в шапке файла,
 * раздел «Цена „добавить“». Коротко: два массива JS с разной длиной не могут
 * разделить хранилище, поэтому «добавить» над обычным массивом стоит Ω(длины),
 * а вид — постоянного времени.
 *
 * Ловушки отвечают ровно за одно: вид обязан быть НЕОТЛИЧИМ от обычного массива
 * длиной `end`. Чтение за концом даёт `undefined`, а не ячейку соседа;
 * перечисление ключей не показывает ничего сверх своей длины; запись
 * отвергается — значение flang неизменяемо, а ячейки за концом принадлежат
 * другому списку.
 *
 * @param {Array} cells — общий буфер; его длина и есть отметка «занято».
 * @param {number} end — длина этого списка.
 */
function $view(cells, end) {
  /* Вид на общий буфер: те же ячейки, своя длина. Так «добавить» стоит
     постоянного времени, а не копии всего списка; обычным массивом это не
     выразить — два массива JS с разной длиной не делят хранилище. Ловушки ниже
     отвечают за одно: вид обязан быть НЕОТЛИЧИМ от массива длиной `end` — за
     концом пусто, ключей сверх своей длины нет, запись отвергается. */
  const view = new Proxy(cells, {
    get(target, key) {
      if (key === "length") return end
      const index = $indexKey(key)
      if (index >= 0) return index < end ? target[index] : undefined
      return target[key]
    },
    has(target, key) {
      if (key === "length") return true
      const index = $indexKey(key)
      if (index >= 0) return index < end
      return key in target
    },
    ownKeys() {
      const keys = []
      for (let index = 0; index < end; index += 1) keys.push(String(index))
      keys.push("length")
      return keys
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "length") return { value: end, writable: true, enumerable: false, configurable: false }
      const index = $indexKey(key)
      if (index >= 0) {
        if (index >= end) return undefined
        return { value: target[index], writable: true, enumerable: true, configurable: true }
      }
      return Object.getOwnPropertyDescriptor(target, key)
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  })
  $VIEWS.set(view, { cells, end })
  return view
}

/**
 * «добавить … к …»: за постоянное время, когда ячейка за концом ещё ничья, и
 * копией во всех остальных случаях.
 *
 * Инвариант, он же доказательство неизменяемости: длина буфера только растёт, и
 * занять ячейку за концом вправе единственный список — тот, чей конец совпал с
 * концом буфера. Значит ячейки внутри списка не пишет никто, а ячейка за концом
 * занимается не более одного раза за жизнь буфера: второе «добавить» к тому же
 * значению видит буфер длиннее своего конца и уходит на копию. Тот же приём и по
 * той же причине стоит в `fl_b_dobavit` (C), `Items::grown` (Rust) и `BAppend`
 * (Go).
 *
 * Голое `list.push(item)` здесь недопустимо ни при каких условиях: список,
 * который отдали, мог остаться у кого-то ещё, и продление на месте испортило бы
 * ЕГО значение. Разрешение спрашивается у отметки занятого, а не у длины.
 */
function $b_dobavit(item, value) {
  const list = $expectList("добавить", value, "второй аргумент")
  const view = $VIEWS.get(list)
  if (view !== undefined && view.end === view.cells.length) {
    view.cells.push(item)
    return $view(view.cells, view.cells.length)
  }
  /* Копия — из буфера напрямую, а не сквозь ловушки вида: копировать чтением по
     одному элементу стоило бы вдесятеро дороже на ровном месте. */
  const cells = view === undefined ? list.slice() : view.cells.slice(0, view.end)
  cells.push(item)
  return $view(cells, cells.length)
}

/*
 * «приписать … к …»: одна копия на вызов.
 *
 * Постоянного времени здесь нет, и это НЕ недосмотр, а разница между печатью и
 * вычислителем. Вид `$view` — прокси НАД массивом, и первая ячейка вида — это
 * ячейка 0 массива: смотреть внутрь буфера со сдвигом прокси не умеет, а
 * научить его этому значит добавить сложение к каждому чтению элемента у ВСЕХ
 * списков напечатанной программы, включая те, что приписывания не видели. В
 * вычислителе (`builtins.mjs`, «Список с запасом») этой платы нет: там список —
 * своя запись с полями `начало` и `конец`, сдвиг лежит в ней, и запас работает
 * с обоих концов. Цена по всем восьми целям названа в SPEC, раздел «Стоимость
 * встроенных форм»: постоянная у C и Elixir, одна копия на вызов у шести
 * остальных.
 *
 * Одна копия на вызов — это ровно то, чего не было: до появления формы
 * приписывание писали свёрткой, а она копирует на КАЖДОМ элементе.
 *
 * Копия берётся из буфера напрямую, а не сквозь ловушки вида, по той же
 * причине, что и у `$b_dobavit`: чтение по одному элементу сквозь прокси стоит
 * вдесятеро дороже на ровном месте.
 */
function $b_pripisat(item, value) {
  const list = $expectList("приписать", value, "второй аргумент")
  const view = $VIEWS.get(list)
  const cells = view === undefined ? list : view.cells.slice(0, view.end)
  return [item, ...cells]
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

/* ═════════════════ стек под объявленный предел глубины ═════════════════════

   Счётчик глубины считает КАДРЫ, а несёт их стек хозяина, и в этой цели его не
   хватало НИКОГДА. Замер холодными процессами (Node 26.7, стек V8 по
   умолчанию, предел языка 10 000): у функции с одним параметром и без
   связываний влезает 7 386 кадров, у функции с сорока живыми связываниями —
   1 379. То есть объявленных 10 000 кадров не существовало ни для одной
   программы: до них не доходит даже самая тонкая, а отказ приходит не тот,
   которым на том же входе отвечает интерпретатор.

   Рычаг у цели всё-таки есть, и он тот же, что в Python
   (`threading.stack_size`) и в C (`pthread_attr_setstacksize`): поток с ЯВНО
   ЗАДАННЫМ стеком. В Node это `worker_threads` и `resourceLimits.stackSizeMb`.
   Замер тем же способом — сколько кадров несёт стек заданного размера:

       кадров            4 МиБ    8 МиБ   16 МиБ   32 МиБ   байт на кадр
       0 связываний     29 226   60 067  121 748  245 109        ≈ 137
       40 связываний     5 459   11 220   22 743   45 788        ≈ 733
       200 связываний    1 207    2 483    5 034   10 137      ≈ 3 310

   Цена кадра в расчёте — 8 КиБ: вдвое с лишним больше худшего измеренного, тем
   же правилом, каким взяты 16 КиБ у `FL_STACK_PER_FRAME` в C. Под объявленные
   10 000 кадров это 79 МиБ стека, и на них худшая из трёх форм доходит до
   предела ЯЗЫКА (10 001) и отказывает текстом свидетеля.

   Чего рычаг не делает, и об этом надо сказать прямо:

     • в браузере его нет — `worker_threads` там не существует, стек Worker'а не
       настраивается, и правду говорит сторож `$hostDepth`;
     • прямой вызов экспортированной функции считает на стеке того, кто позвал:
       рычаг работает только через `$callDeep`. Ровно так же устроен C —
       библиотека, вызванная мимо `fl_call_deep`, считает на стеке вызывающего;
     • выше 131 072 объявленных кадров стек упирается в потолок 1 ГиБ, и дальше
       правду опять говорит сторож, а не объявленное число.
*/

// Сколько мегабайт стека просить под объявленный предел глубины. Ноль и
// бесконечность значат «предела нет» — тогда просим потолок и оставляем ответ
// сторожу.
function $stackMb(maxDepth) {
  const perFrame = 8192 // байт на кадр: вдвое с лишним больше худшего измеренного
  const most = 1024 // МиБ: выше потолка глубина не покупается, а обещается
  if (!Number.isFinite(maxDepth) || maxDepth <= 0) return most
  return Math.min(most, Math.max(8, Math.ceil((maxDepth * perFrame) / 1048576)))
}

// Значение через границу потока. Структурное копирование несёт числа (вместе с
// NaN, ±0 и бесконечностями), строки, признаки, «ничто», списки и записи как
// есть, но теряет ПРОТОТИП: вариант приехал бы обычным объектом, и `$isVariant`
// назвал бы его записью. Поэтому вид значения едет тегом, а не угадывается.
function $wireOut(value) {
  if (Array.isArray(value)) return ["l", value.map($wireOut)]
  if (value instanceof $FlangVariant) return ["v", value.variant, $wireFields(value.fields)]
  if (value !== null && typeof value === "object") return ["r", $wireFields(value)]
  return ["s", value]
}

// Поля записи и варианта — списком пар: порядок полей часть значения.
function $wireFields(fields) {
  return Object.keys(fields).map((name) => [name, $wireOut(fields[name])])
}

function $wireIn(node) {
  if (node[0] === "l") return node[1].map($wireIn)
  if (node[0] === "v") return new $FlangVariant(node[1], $unwireFields(node[2]))
  if (node[0] === "r") return $unwireFields(node[1])
  return node[1]
}

function $unwireFields(pairs) {
  const fields = {}
  for (const pair of pairs) fields[pair[0]] = $wireIn(pair[1])
  return fields
}

// Расчёт на своём стеке: рычага нет либо поток не завёлся. Считаем ровно там
// же и с той же памятью, что до починки, — обещание держит сторож `$hostDepth`.
// Глубина, купленная ценой падения, была бы не починкой, а переносом отказа.
function $callHere(fn, args, limits) {
  $newContext(limits)
  return fn(...args)
}

// Что делает поток: зовёт функцию модуля и отвечает одним сообщением. Живёт
// строкой, а не файлом, потому что модуль самодостаточен: класть рядом второй
// файл значило бы, что напечатанное больше не переносится копированием.
function $deepSource() {
  return [
    "import { parentPort, workerData } from \"node:worker_threads\"",
    "const program = await import(workerData.module)",
    "parentPort.postMessage(program.$deepEntry(program[workerData.name], workerData.args, workerData.limits))",
  ].join("\n")
}

function $deepEntry(fn, args, limits) {
  if (typeof fn !== "function") return { ok: false, broken: "в модуле нет такой функции" }
  $newContext(limits ?? {})
  try {
    return { ok: true, value: $wireOut(fn(...args.map($wireIn))) }
  } catch (err) {
    if (err instanceof $FlangError) return { ok: false, code: err.code, message: err.message }
    return { ok: false, alien: String((err && err.message) || err) }
  }
}

async function $callDeep(fn, args = [], limits = {}) {
  let Worker = null
  try {
    /* Имя модуля собирается на месте, а не стоит в тексте: статический
       «node:worker_threads» сборщик для браузера попытался бы разрешить, тогда
       как здесь его отсутствие — обычный ход дела, а не поломка. */
    Worker = (await import(["node:", "worker_threads"].join(""))).Worker
  } catch {
    Worker = null
  }
  if (typeof Worker !== "function") return $callHere(fn, args, limits)
  const depth = typeof limits.maxDepth === "number" ? limits.maxDepth : $DEFAULT_MAX_DEPTH
  let worker = null
  try {
    worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent($deepSource())}`), {
      workerData: { module: import.meta.url, name: fn.name, args: args.map($wireOut), limits },
      resourceLimits: { stackSizeMb: $stackMb(depth) },
    })
  } catch {
    return $callHere(fn, args, limits)
  }
  const answer = await new Promise((done) => {
    worker.on("message", done)
    worker.on("error", (err) => done({ ok: false, broken: String((err && err.message) || err) }))
    worker.on("exit", (code) => done({ ok: false, broken: `поток вышел с кодом ${code}` }))
  })
  await worker.terminate()
  if (answer.ok === true) return $wireIn(answer.value)
  if (answer.broken !== undefined) return $callHere(fn, args, limits)
  if (answer.alien !== undefined) throw new Error(answer.alien)
  throw new $FlangError(answer.code, answer.message)
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

/**
 * То же, но помощник уезжает в модуль ЭКСПОРТОМ и с пояснением над ним.
 * Экспортируется не всё подряд: экспорт — это обещание совместимости, и его
 * получают только две точки входа глубокого расчёта.
 */
function exportedSource(doc, fn) {
  return `${doc}\nexport ${fn.toString()}`
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
runtimeEntry("$pre", ["$fail", "$typeName"], fromSource($pre))
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
runtimeEntry("$b_golova_dokazano", ["$expectList"], fromSource($b_golova_dokazano))
runtimeEntry("$b_hvost_dokazano", ["$expectList"], fromSource($b_hvost_dokazano))
runtimeEntry("$b_razdelit_dokazano", ["$expectString"], fromSource($b_razdelit_dokazano))
runtimeEntry("$b_kod_simvola_dokazano", ["$expectString"], fromSource($b_kod_simvola_dokazano))
runtimeEntry("$b_element", ["$fail", "$expectInteger", "$expectList", "$INDEX_BASE"], fromSource($b_element))
runtimeEntry("$indexKey", [], fromSource($indexKey))
/* `$VIEWS` — не функция, а состояние: одна таблица на модуль, как счётчики в
   `$LIMITS`. Печатается строкой по той же причине, по какой печатается сама
   таблица: значения у неё нет, есть объявление. */
runtimeEntry(
  "$VIEWS",
  [],
  [
    "// Буферы «добавить»: вид → его буфер и длина. Слабая — вид, который никому",
    "// больше не нужен, обязан уйти вместе со своей записью.",
    "const $VIEWS = new WeakMap()",
  ].join("\n"),
)
runtimeEntry("$view", ["$indexKey", "$VIEWS"], fromSource($view))
runtimeEntry("$b_dobavit", ["$expectList", "$view", "$VIEWS"], fromSource($b_dobavit))
runtimeEntry("$b_pripisat", ["$expectList", "$VIEWS"], fromSource($b_pripisat))
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
/* Стек под объявленный предел — рычаг цели, а не украшение: без него
   объявленных 10 000 кадров нет ни у одной программы (см. шапку раздела). */
runtimeEntry("$stackMb", [], fromSource($stackMb))
runtimeEntry("$wireOut", ["$FlangVariant", "$wireFields"], fromSource($wireOut))
runtimeEntry("$wireFields", ["$wireOut"], fromSource($wireFields))
runtimeEntry("$wireIn", ["$FlangVariant", "$unwireFields"], fromSource($wireIn))
runtimeEntry("$unwireFields", ["$wireIn"], fromSource($unwireFields))
runtimeEntry("$callHere", ["$LIMITS"], fromSource($callHere))
runtimeEntry("$deepSource", [], fromSource($deepSource))
runtimeEntry(
  "$deepEntry",
  ["$LIMITS", "$FlangError", "$wireIn", "$wireOut"],
  exportedSource(
    [
      "/**",
      " * Точка входа расчёта в потоке с заданным стеком: её зовёт поток, который",
      " * завёл `$callDeep`. Руками её звать незачем — вызов на своём стеке ничем не",
      " * отличается от обычного вызова функции модуля.",
      " *",
      " * @param {Function} fn экспортированная функция этого модуля",
      " * @param {Array} args аргументы в форме `$wireOut`",
      " * @param {{maxDepth?: number, maxSteps?: number}} limits",
      " */",
    ].join("\n"),
    $deepEntry,
  ),
)
runtimeEntry(
  "$callDeep",
  ["$LIMITS", "$FlangError", "$deepEntry", "$deepSource", "$stackMb", "$wireIn", "$wireOut", "$callHere"],
  exportedSource(
    [
      "/**",
      " * Вычисление на стеке, отведённом ПОД ОБЪЯВЛЕННЫЙ ПРЕДЕЛ глубины.",
      " *",
      " * Прямой вызов `функция(x)` считает на стеке того, кто позвал, а его в",
      " * JavaScript хватает не на 10 000 кадров, а на 7 386 у самой тонкой функции",
      " * и на 1 379 у функции с сорока связываниями. Здесь расчёт уезжает в поток",
      " * с явно заданным стеком (`worker_threads`), и объявленный предел",
      " * становится достижимым: тот же вход даёт FLANG_RECURSION_LIMIT на глубине",
      " * 10 001, тем же текстом, что интерпретатор.",
      " *",
      " * Где рычага нет — в браузере и там, где поток не завёлся, — расчёт идёт на",
      " * своём стеке, как и раньше, а правду говорит сторож: отказ остаётся",
      " * объявленным, только текст называет хозяина.",
      " *",
      " * @param {Function} fn экспортированная функция этого модуля",
      " * @param {Array} args её аргументы",
      " * @param {{maxDepth?: number, maxSteps?: number}} [limits]",
      " * @returns {Promise<any>}",
      " */",
    ].join("\n"),
    $callDeep,
  ),
)

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
  ["приписать", "$b_pripisat"],
  ["остаток от", "$b_ostatok_ot"],
  ["процентов от", "$b_procentov_ot"],
])

/**
 * Суффикс имени помощника БЕЗ сторожа частичности.
 *
 * Выбор делает `помощникФормы` (`src/builtins.mjs`) по отметке `доказана` на
 * узле — её кладёт передний край (`bin/flang.mjs`, `markProven`) по выводу
 * проверки типов. Печать здесь ничего не доказывает и доказать не может: анализ
 * живёт в `src/types.mjs`, а копия печати на самом языке его не видит вовсе
 * (круг импортов), и обе стороны обязаны читать ОДНУ отметку.
 */
const СУФФИКС_ДОКАЗАННОГО = "_dokazano"

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
  ["приписать", 2],
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
      /* Предусловия здесь ТОЛЬКО ради границы напечатанной программы (гейт
         `renderPreconditionGate` ниже, зовёт его прогонщик). В тело функции они
         не печатаются ни одной строкой: внутри программы предусловие снял
         вызывающий на проверке (`FLANG_PRECONDITION_CALL`), и проверять его во
         время работы значило бы платить временем за доказанное. */
      preconditions: normalizePreconditions(fn),
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

/**
 * Предусловия функции — тем же разбором, что у интерпретатора
 * (`normalizePreconditions` в src/interpret.mjs), и с теми же умолчаниями:
 * код FLANG_PRECONDITION, текст «не выполнено требование …». `bind` у
 * предусловия нет и быть не может: оно говорит о том, что было ДО вызова, а
 * результата до вызова не существует.
 */
function normalizePreconditions(fn) {
  const list = fn.preconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «preconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `предусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      code: typeof item.code === "string" ? item.code : "FLANG_PRECONDITION",
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
  /* Планировщик у цели есть, ХОЗЯИНА нет: `поручить` не значится в
     `$КОНК_ДЕЙСТВИЯ` напечатанного планировщика (`js/flang_conc.js`), и
     напечатанная программа дошла бы до поручения и упала на «неизвестном
     действии» уже в бою. Отказ отдельным кодом, потому что беда другая, чем
     «нет планировщика»: процессы цель печатает (`src/conc.mjs`,
     `требуетХозяина`). */
  требуетХозяина(program, "js")
  /* План — вход программы ввода-вывода, и потерять его молча было бы тем же,
     чем была молчаливая потеря процессов: модуль собирается, код возврата ноль,
     а работать он не умеет. Отказ живёт в бэкенде, а не в команде, по той же
     причине, что и два его соседа: бэкенды зовут напрямую из Node. */
  требуетИсполнителяПлана(program, "js")
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
  /* Планы берутся ровно там же и ровно по той же причине, что процессы: это
     ОБЪЯВЛЕНИЯ исходной программы, а понижение к ним не прикасается. */
  const plans = Array.isArray(program.plans) ? program.plans : []
  /* Граница входа читает типы ДО дефункционализации: после неё параметр,
     объявленный функцией, становится суммой тегов, а `checkArguments` на границе
     интерпретатора видит его функцией. Два ответа на один вопрос разошлись бы
     молча. */
  const входные = таблицаВхода(program)
  /* Дефункционализация — ОДИН проход на все восемь целей (src/defunc.mjs), а не
     восемь реализаций: после него в программе нет ни функций-значений, ни
     применения, и печатается она теми же узлами, что и всё остальное. На
     программе без высшего порядка проход тождествен — возвращает ТОТ ЖЕ объект,
     — поэтому напечатанное не меняется ни на байт, и неподвижная точка цела. */
  program = defunctionalize(program)
  const prepared = prepare(program)
  /* База номера едет НА ПРОГРАММЕ, а не в ключах: тем же полем считало
     доказательство границ, и второе число здесь развело бы их молча. */
  const base = (program?.базаНомера ?? options.indexBase) === 0 ? 0 : 1
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
  /* Гейт предусловий: отдельная функция модуля на каждую функцию с `требует`.
     Имена берутся ПОСЛЕ всех имён функций, поэтому у программы без `требует`
     раздача имён не сдвигается ни на шаг и напечатанное не меняется ни на байт
     — та же дисциплина, что у `decreases` и `postconditions` в разборщике. */
  const gateIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    if (fn.preconditions.length > 0) gateIdents.set(name, valueNamer(`граница ${name}`))
  }

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
  for (const [name, ident] of gateIdents) claim(ident, `граница входа функции «${name}»`)
  /* Прогонщик конкурентности живёт в той же области видимости модуля, поэтому
     его имена занимаются так же, как имена функций: программа с функцией
     «conc run» обязана получить внятный отказ, а не молча потерять прогонщик. */
  if (concurrent) {
    claim("concPlan", "прогонщик конкурентности")
    claim("concRun", "прогонщик конкурентности")
  }
  /* И исполнитель плана — по тому же доводу и в той же области видимости. */
  if (plans.length > 0) {
    claim("ioPlan", "исполнитель плана")
    claim("ioRun", "исполнитель плана")
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
    gateIdents,
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
  for (const fn of prepared.functions.values()) {
    sections.push(renderFunction(fn, shared))
    /* Гейт печатается вместе с прогонщиком и отменяется вместе с ним
       (`cli: false`): звать его некому, кроме двери, а дверь — это прогонщик. */
    if (options.cli !== false && fn.preconditions.length > 0) {
      sections.push(renderPreconditionGate(fn, shared))
    }
  }

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

  if (plans.length > 0) {
    /* Исполнитель отказывает через `$fail`, как и всё остальное в модуле, и
       узнаёт вариант через `$isVariant`. Оба затребованы ЗДЕСЬ явно: сумм в
       программе с планом всегда хватает (словарь ввода-вывода приписывается
       ей парсером), а вот рекурсии в ней может не быть ни одной — и `$fail`
       тогда не пришёл бы ни от кого. */
    shared.used.add("$fail")
    shared.used.add("$isVariant")
    shared.used.add("$FlangVariant")
    sections.push(renderPlans(plans, shared))
  }

  /* Рычаг глубины печатается там, где глубине есть куда расти, — то есть при
     рекурсии. Программе без единого цикла в графе вызовов он не нужен: у неё
     глубина ограничена самим графом, и счётчика она не получает вовсе. */
  if (recursive.size > 0) shared.used.add("$callDeep")

  /* Таблица для прогонщика — единственное, что модуль знает о нём. Печатается
     она вместе с ним и отменяется вместе с ним (`cli: false`): модулю, который
     никто не зовёт по имени, таблица имён не нужна.

     `$FlangVariant` и `$isVariant` затребованы ЯВНО, а не потому, что в
     программе есть суммы: их там может не быть вовсе, а вариант всё равно
     обязан доехать по проводу — и обязан быть узнан как вариант. Иначе
     напечатанный код разобрал бы его как запись и ответил не тем отказом, чем
     интерпретатор, ровно на тех входах, где сверка и ищет расхождения. */
  const cli = options.cli !== false
  if (cli) {
    shared.used.add("$FlangVariant")
    shared.used.add("$isVariant")
    sections.push(renderProgramTable(shared, $stackMb(maxDepth), входные))
  }

  const runtime = renderRuntime(shared.used, base, maxDepth, maxSteps, concurrent, plans.length > 0)
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const head = [
    "// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
    "// Модуль самодостаточен — ни одной зависимости, работает и в Node, и в браузере.",
    ...(cli
      ? ["// Рядом напечатан прогонщик: node flang_cli.js ./<этот файл> — JSON на входе, JSON на выходе."]
      : []),
    ...(concurrent
      ? [
        "// Программа с процессами: планировщик конкурентности напечатан внутрь модуля.",
        "// Конкурентность есть, параллелизма нет и не будет — один поток (concRun, concPlan).",
      ]
      : []),
    ...(plans.length > 0
      ? [
        "// Программа с планом: исполнитель ввода-вывода напечатан внутрь модуля.",
        "// Поручения описывает программа, исполняет хозяин — среда снаружи (ioRun, ioPlan).",
      ]
      : []),
  ].join("\n")

  const parts = [head]
  if (runtime.length > 0) parts.push(runtime)
  parts.push(...sections.filter((section) => section.length > 0))

  /* Восьмая цель считается наравне с семью, хотя набор занятого у неё ПУСТ:
     печатается один самодостаточный файл, прогонщик берёт его по файловому
     URL, а голый спецификатор Node в относительный файл не резолвится — занять
     стандартную библиотеку JavaScript именем модуля нельзя (`target-occupied.mjs`).
     Вызов стоит здесь, чтобы пустота набора была РЕШЕНИЕМ, а не пропуском. */
  const stem = обойтиЗанятоеЦелью(moduleName === null ? "program" : snake(moduleName), "js")
  const path = options.path ?? `${stem}.js`
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку модуля и в jsdoc функции, — а комментарий читают
     первым и проверить исполнением не могут: движок выполнит такой файл молча.
     Форма JS — `\uXXXX`, та же, что в литерале. */
  const files = [{ path, content: `${parts.join("\n\n")}\n` }]
  /* Прогонщик — ВТОРЫМ файлом, и порядок здесь не вкус: модуль остаётся
     `files[0]` для всех, кто берёт напечатанное программно (`flang/conc/bin`,
     тесты печати, стенд распределённости). Байт в байт одинаков для любой
     программы — как `flang_cli.c` и `flang_cli.py`; всё, что он знает об этой
     программе, приехало таблицей `$PROGRAM` в модуле. */
  if (cli) {
    files.push({
      path: CLI_FILE,
      content: `${cliBanner(moduleName, path)}\n${CLI_SOURCE}`,
    })
  }
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

/** Шапка прогонщика: чей он и как его звать. Тело — байт в байт `js/flang_cli.js`. */
function cliBanner(moduleName, path) {
  return [
    "// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    "// Файл: прогонщик — JSON на входе, JSON на выходе.",
    `// Запуск: node ${CLI_FILE} ./${path}`,
  ].join("\n")
}

/**
 * Таблица, по которой прогонщик находит эту программу.
 *
 * Всё, что ему нужно, и ничего сверх: имена flang → функции модуля (арность он
 * возьмёт у самой функции), фабрика варианта — построить вариант с ЛЮБЫМ именем
 * иначе нечем, а `$isVariant` смотрит на прототип, — узнавание варианта на
 * обратном пути, и размер стека под объявленный предел глубины.
 *
 * Стек посчитан ЗДЕСЬ, при печати, тем же `$stackMb`, каким его считает
 * `$callDeep`: предел глубины известен в момент печати, и второго расчёта, у
 * которого была бы возможность разойтись с первым, заводить незачем.
 */
function renderProgramTable(shared, stackMb, входные) {
  const rows = [...shared.prepared.functions.keys()].map(
    (name) => `    [${JSON.stringify(name)}, ${shared.functionIdents.get(name)}],`,
  )
  /* Гейты предусловий — только у программы, где есть хоть одно `требует`.
     Программа без него не получает ни поля, ни строки: печать обязана остаться
     побайтово прежней. */
  const gates = [...shared.gateIdents].map(
    ([name, ident]) => `    [${JSON.stringify(name)}, ${ident}],`,
  )
  return [
    "/**",
    " * Связь этого модуля с прогонщиком (`flang_cli.js`): имена flang → функции,",
    " * фабрика и узнавание варианта, стек под объявленный предел глубины (МиБ) и",
    " * объявленные типы параметров — граница входа.",
    " * Прогонщик — соседний файл, а не часть модуля: в браузер он не едет.",
    " *",
    " * @type {{functions: Map<string, Function>, variant: Function, isVariant: Function,"
      + " stackMb: number, entry: object}}",
    " */",
    "export const $PROGRAM = {",
    "  functions: new Map([",
    ...rows,
    "  ]),",
    ...(gates.length === 0
      ? []
      : [
        "  /* Предусловия (`требует`) — той же дверью, что и типы: прогонщик зовёт",
        "     гейт ДО вызова, потому что значение приехало снаружи и вызывающего,",
        "     который снял бы требование на проверке, у него нет. В тело функции",
        "     предусловие не печатается: внутри программы оно доказано. */",
        "  pre: new Map([",
        ...gates,
        "  ]),",
      ]),
    "  variant: (name, fields) => new $FlangVariant(name, fields),",
    "  isVariant: $isVariant,",
    `  stackMb: ${stackMb},`,
    ...renderEntry(входные),
    "}",
  ].join("\n")
}

/**
 * Граница входа — ТАБЛИЦЕЙ, а не кодом.
 *
 * В напечатанном модуле типов нет: прогонщик разбирает JSON и зовёт функцию.
 * Поэтому `«Факториал» принимает н: нат` считался при `н` равном −3 и 2.5, а при
 * 1e300 упирался в FLANG_RECURSION_LIMIT — код, отведённый ОБЫЧНОЙ функции.
 * Тотальная отказывала пределом глубины потому, что доказательство её завершения
 * СТОИТ НА ТИПЕ: у `нат` есть потолок 2^53−1, ниже которого `н минус 1` точно
 * меньше `н`, и сторож убывания в такую функцию не печатается вовсе.
 *
 * Сверяет таблицу `checkEntry` из `js/flang_cli.js` — один и тот же текст для
 * всех программ, а строит её `таблицаВхода` из flang/src/types.mjs, то есть тот
 * же файл, что отвечает на этот вопрос для `flang run --args`.
 *
 * Здесь только ДАННЫЕ, и это не вкус: таблица уезжает в браузер вместе с
 * модулем и ничего там не требует, а обход по ней живёт в прогонщике —
 * соседнем файле, который в браузер не едет вовсе.
 */
function renderEntry(таблица) {
  const список = (имя, строки) =>
    (строки.length === 0 ? [`    ${имя}: [],`] : [`    ${имя}: [`, ...строки, "    ],"])
  const строка = (поля) => `      { ${поля.join(", ")} },`
  return [
    "  /* Граница входа: объявленные типы параметров данными. Прогонщик сверяет",
    "     по ним значения, пришедшие снаружи, ДО вызова (`checkEntry` в",
    "     flang_cli.js); вид «неизвестно» не сверяется — одной таблицы ему мало. */",
    "  entry: {",
    ...список("types", таблица.типы.map((запись) =>
      строка([
        `kind: ${JSON.stringify(запись.вид)}`,
        `name: ${JSON.stringify(запись.имя)}`,
        `owner: ${JSON.stringify(запись.владелец)}`,
        `nothing: ${запись.ничто}`,
        `integer: ${запись.целое}`,
        `range: ${запись.отрезок}`,
        `low: ${renderNumber(запись.низ)}`,
        `high: ${renderNumber(запись.верх)}`,
        `item: ${запись.элемент}`,
        `fieldAt: ${запись.полеС}`,
        `fieldCount: ${запись.полей}`,
        `variantAt: ${запись.вариантС}`,
        `variantCount: ${запись.вариантов}`,
      ]))),
    ...список("fields", таблица.поля.map((поле) =>
      строка([`name: ${JSON.stringify(поле.имя)}`, `type: ${поле.тип}`]))),
    ...список("variants", таблица.варианты.map((вариант) =>
      строка([
        `name: ${JSON.stringify(вариант.имя)}`,
        `fieldAt: ${вариант.полеС}`,
        `fieldCount: ${вариант.полей}`,
      ]))),
    ...список("params", таблица.параметры.map((параметр) =>
      строка([
        `fn: ${JSON.stringify(параметр.функция)}`,
        `name: ${JSON.stringify(параметр.параметр)}`,
        `type: ${параметр.тип}`,
      ]))),
    "  },",
  ]
}

function renderRuntime(used, base, maxDepth, maxSteps, concurrent = false, planned = false) {
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
  /* Исполнитель плана — за планировщиком и по тому же доводу: он зовёт
     помощников рантайма, а объявления функций в JS поднимаются, поэтому порядок
     здесь читательский, а не обязательный. */
  if (planned) blocks.push(IO_SOURCE.trimEnd())
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
  /* Вес стоит здесь по тому же праву: значение — тот же `number`, и `+∞` в
     JavaScript это обычный `Infinity`. Отрезок [0, +∞] живёт в типизаторе;
     напечатанный код о нём не знает. */
  "вес", "стоимость", "weight", "pezo", "权重",
  /* Точный десятичный — по тому же праву и с тем же следствием: значение есть
     целое число минорных единиц, то есть обычный `number`. Масштаб живёт в
     типизаторе; напечатанный код о нём не знает и знать не должен. */
  "сотых", "hundredths", "centonoj", "分",
  "тысячных", "thousandths", "milonoj",
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

/* ── граница входа: предусловия ── */

/**
 * ГДЕ ПРОВЕРЯЕТСЯ ДОГОВОР, И ПОЧЕМУ НЕ В ТЕЛЕ ФУНКЦИИ.
 *
 * В flang предусловие снимает ВЫЗЫВАЮЩИЙ: каждое место вызова обязано доказать
 * `требует` вызываемой, иначе программа отвергается кодом
 * FLANG_PRECONDITION_CALL и не доезжает до печати вовсе. Значит внутри
 * программы предусловие уже ИСТИННО — не «проверено», а известно, — и печатать
 * его проверку в тело значило бы платить временем каждого вызова (в том числе
 * каждого витка рекурсии) за то, что доказано статически. Ровно этого
 * доказуемый язык позволяет НЕ делать; так же устроено в Dafny.
 *
 * Недоказанное входит в программу ровно в одном месте — на ГРАНИЦЕ, где
 * значение приезжает от хозяина: `--args`, факты, отклик хозяина, строка
 * прогонщика. Там вызывающего нет, доказывать нечего, и вход проверяется
 * вычислением. У интерпретатора эта дверь — `callFunction` (src/interpret.mjs),
 * и проверка стоит ровно в ней, а `applyFunction` её не знает. У напечатанной
 * программы дверь — прогонщик: он разбирает JSON, сверяет объявленные типы
 * (`checkEntry`) и зовёт функцию по имени. До этой правки на ней стояла
 * половина двери: типы сверялись, договор — нет.
 *
 * Улика снята прогоном, а не чтением: `flang/proof/examples/precondition.flang`,
 * «Удвоить» от −5. Интерпретатор — FLANG_PRECONDITION «не выполнено требование
 * «вход неотрицателен»»; напечатанный JS — FLANG_PROPERTY «нарушено свойство
 * «удвоенное неотрицательно»», то есть отказ ПОСТусловия вместо отказа входа, и
 * только потому, что постусловие у этой функции есть. У функции без
 * `обеспечивает` не было бы и его: напечатанная программа посчитала бы ответ на
 * входе, которого договор не допускает.
 *
 * ЦЕНА ОБОИХ РЕШЕНИЙ ИЗМЕРЕНА, А НЕ НАЗВАНА. Печать проверки В ТЕЛО каждой
 * функции на четырёх программах дерева с `требует` даёт модули НА 8 917 БАЙТ
 * КОРОЧЕ (обёртки гейта и таблицы `pre` у неё нет) и снимает 1 776 байт с
 * прогонщика: вариант «везде» дешевле в байтах на 10 693. Платит он временем, и
 * это тоже замерено: «Высота от дна» — рекурсивная функция с одним требованием
 * — на 540 000 вызовов (60 прогонов по 9 000 витков, Node 26.7, три повтора)
 * идёт 35,2 мс на границе и 39,8 мс в теле, то есть +13 % и ≈8,5 нс на КАЖДЫЙ
 * вызов. Требование здесь одно и оно из одного сравнения; у «Сколько дополнить»
 * их три, и два из них с вычитанием.
 *
 * Обмен поэтому такой: десять килобайт печати за то, чтобы ни один доказанный
 * вызов не платил ни наносекунды. Берём его, потому что байты платятся один раз
 * при печати, а наносекунды — на каждом витке у каждого пользователя, и потому
 * что проверять доказанное значит не верить собственному доказательству.
 *
 * ФОРМА — ОТДЕЛЬНАЯ ФУНКЦИЯ МОДУЛЯ, а не строки в теле. Тело остаётся байт в
 * байт прежним: ни разворот хвостового самовызова в цикл, ни батут, ни счётчик
 * глубины не сдвигаются. Гейт возвращает `null`, когда все требования
 * выполнены, и первое нарушенное — объектом отказа: код и текст дословно те же,
 * что у интерпретатора.
 */
function renderPreconditionGate(fn, shared) {
  const ident = shared.gateIdents.get(fn.name)
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([
      ...shared.functionIdents.values(),
      ...shared.gateIdents.values(),
      ...shared.variantIdents.values(),
      ...shared.factoryIdents.values(),
    ]),
    counter: 0,
    params: [],
    /* Гейт не тело: ни цикла, ни батута, ни счётчика глубины у него нет — он
       считает замкнутое выражение при известных аргументах и возвращает. */
    selfTail: false,
    members: null,
    leave: (code) => code,
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
    bind(name, identifier) {
      const previous = ctx.scope.has(name) ? ctx.scope.get(name) : null
      ctx.scope.set(name, identifier)
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

  const body = []
  for (const property of fn.preconditions) {
    const check = emitValue(property.expr, ctx, body, "  ")
    ctx.use("$pre")
    const message = property.message ?? `не выполнено требование «${property.name}» функции «${fn.name}»`
    const span = property.span === undefined || property.span === null
      ? "null"
      : renderLiteral(property.span)
    body.push(`  // требует «${property.name}»`)
    body.push(
      `  if (!$pre(${check.code}, ${JSON.stringify(property.name)}, ${JSON.stringify(fn.name)})) {`,
      `    return { code: ${JSON.stringify(property.code)}, message: ${JSON.stringify(message)}, span: ${span} }`,
      "  }",
    )
  }
  body.push("  return null")

  /* Подпись короткая нарочно: доводы, по которым проверка стоит здесь, а не в
     теле, лежат в шапке этой функции и уезжать в каждую напечатанную программу
     не обязаны. Замер: длинная подпись стоила по 260 байт на гейт. */
  const doc = [
    "/**",
    ` * Предусловия функции flang «${fn.name}»: их проверяет прогонщик ДО вызова —`,
    " * значения пришли снаружи, и вызывающего, который снял бы требование на",
    " * проверке, у них нет. В теле функции на это не потрачено ни одной строки.",
    " *",
    " * @returns {null | {code: string, message: string, span: object|null}}",
    " */",
  ]
  return [doc.join("\n"), `export function ${ident}(${ctx.params.join(", ")}) {`, ...body, "}"].join("\n")
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
      const helper = ctx.use(помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО))
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
   свидетелем пришлось бы не модель, а каждую печать по отдельности.

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
       планировщик свидетеля, и разойтись здесь было бы нельзя, потому что от этого
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

/* ═══════════════════════════════════════════════════════════════════════════
   ПЛАН ВВОДА-ВЫВОДА

   План — объявление из четырёх строк: имя, тип состояния, функция начала и
   функция шага. Печатается он ДАННЫМИ, ровно как план конкурентности рядом, и
   по той же причине: объявление в flang обязано остаться одним местом в
   напечатанном коде.

   Разница с планом конкурентности ровно одна: там цикл выбирает СЛЕДУЮЩИЙ
   процесс и потому живёт внутри модуля целиком, а здесь между двумя шагами
   управление обязано выйти НАРУЖУ — к хозяину, у которого есть экран, часы и
   сеть. Поэтому наружу торчат две двери, а не одна: `ioPlan()` отдаёт
   описатель тому, кто хочет собрать цикл сам, а `ioRun(имя, хозяин)` крутит
   готовый цикл, дожидаясь хозяина на каждом поручении.
   ═══════════════════════════════════════════════════════════════════════════ */

function renderPlans(plans, shared) {
  /* Функция, которой в программе нет, — это отказ ПЕЧАТИ, а не пустое место в
     описателе: молча напечатать план без начала или без шага значило бы
     вернуться ровно к тому, из-за чего этот код и заведён. Проверку типов
     программа к этому месту уже прошла (`checkPlans` в `src/io.mjs`), и
     отказать здесь может только AST, собранный не разборщиком. */
  const функция = (имя, роль, план) => {
    const ident = shared.functionIdents.get(имя)
    if (ident === undefined) {
      throw flangError(
        "FLANG_EMIT",
        `${роль} «${имя}» плана «${план}» в программе не объявлена: напечатать план нечем`,
      )
    }
    return ident
  }

  const lines = [
    "/* ── План ввода-вывода: объявления данными ── */",
    "const $io = {",
    "  планы: [",
  ]
  for (const план of plans) {
    lines.push(
      "    {",
      `      имя: ${jsstring(план.name)},`,
      /* Тип состояния едет ИМЕНЕМ, а не устройством: хозяину он нужен не для
         разбора значения, а для того, чтобы назвать его в диагностике. Разбирать
         состояние хозяин не вправе — оно принадлежит программе. */
      `      состояние: ${jsstring(план.state)},`,
      `      начало: ${функция(план.initial, "начальное состояние", план.name)},`,
      `      шаг: ${функция(план.handler, "функция шага", план.name)},`,
      "    },",
    )
  }
  lines.push(
    "  ],",
    "  /* Фабрика варианта: начальный отклик «Пока ничего» строит сам исполнитель,",
    "     а построить вариант иначе нечем. Второго словаря «имя → конструктор»",
    "     рядом с этим полем нет намеренно — исполнителю нужен ровно один. */",
    "  вариант: (имя, поля) => new $FlangVariant(имя, поля),",
    "}",
    "",
    "/**",
    " * Планы ввода-вывода этого модуля: имя, тип состояния, начало и шаг.",
    " *",
    " * Отдаётся как есть, а не копией: план — объявление, и меняться ему негде.",
    " * Нужен тому, кто крутит цикл поручений сам, — например хозяину, у которого",
    " * своё представление о том, когда остановиться.",
    " */",
    "export function ioPlan() {",
    "  return $io",
    "}",
    "",
    "/**",
    " * Прогон плана: поручения наружу, отклики внутрь.",
    " *",
    " * Язык остаётся чистым: поручение — это ОПИСАНИЕ действия, обычное значение",
    " * обычной суммы, а исполняет его `исполнить` — хозяин, среда, в которую",
    " * напечатан модуль. Хозяин вправе ответить обещанием, и тогда тянущий цикл",
    " * становится толкающим: стек на время ожидания пуст.",
    " *",
    " * @param {string} имя имя объявленного плана; пусто — единственный",
    " * @param {(поручение: object) => object|Promise<object>} исполнить хозяин",
    " * @param {{ поручений?: number, журнал?: boolean }} [настройки] ноль поручений —",
    " *   без предела; журнал по умолчанию не ведётся",
    " * @returns {Promise<object>} значение плана, число поручений и журнал",
    " */",
    "export function ioRun(имя, исполнить, настройки = {}) {",
    "  return $ioПрогон($io, имя, исполнить, настройки)",
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
