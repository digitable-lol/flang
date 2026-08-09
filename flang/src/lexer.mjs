/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * flang — лексер: текст → токены.
 *
 * Почему отдельный лексер, а не построчные регулярки как в `src/natural-parser.ts`:
 * в flang появились выражения, которые не помещаются в строку (тело функции,
 * ветки `если`, случаи `разбор`), поэтому парсеру нужен поток токенов с
 * настоящими INDENT/DEDENT, а не массив `SourceLine`. Всё остальное — приёмы
 * ядра FTS дословно: имена в «ёлочках»/кавычках/одним словом, нормализация NFC,
 * табуляция шириной 2, комментарии `//` и `/* *\/`, диагностика с точным местом.
 *
 * Виды токенов:
 *   name    имя: «…», одно слово, — `value` уже нормализовано в NFC
 *   string  строка в обычных кавычках: и литерал данных, и имя (совместимость с FTS,
 *           где `category "Sales"` — это имя; парсер решает по позиции)
 *   number  IEEE-754 double в записи ядра FTS
 *   keyword ключевое слово или фраза; `value` — канонический идентификатор,
 *           `text` — исходные слова (нужен, когда слово стоит в позиции имени)
 *   punct   одиночный знак: `:` `,` `.` `{` `}` `[` `]` `(` `)` `;` `?` `<` `>`
 *   arrow   `→`, `->`, `=>`
 *   newline конец значащей строки
 *   indent / dedent  вход в блок и выход из него
 *   eof
 *
 * Ключевые слова склеиваются вторым проходом (`foldKeywords`) из уже разобранных
 * слов. Так проще, чем munch по символам: фраза «не меньше» или «отображается в
 * поле» — это несколько слов, а имя в кавычках ключевым словом стать не может
 * никогда, поэтому `«поле»` и `поле` различаются без специальных правил.
 */

const TAB_WIDTH = 2

const NAME_START = /[\p{ID_Start}_$]/u
const NAME_PART = /[\p{ID_Continue}$\u200C\u200D-]/u
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u

/** Диагностика в формате ядра FTS: `{ code, message, severity, span }`. */
export class FlangError extends Error {
  constructor(message, diagnostics) {
    super(message)
    this.name = "FlangError"
    this.diagnostics = diagnostics
  }
}

export function flangError(code, message, span) {
  const diagnostic = { code, message, severity: "error" }
  if (span !== undefined) diagnostic.span = span
  return new FlangError(message, [diagnostic])
}

/**
 * Таблица ключевых слов: канонический идентификатор → поверхности.
 * Русская и английская поверхности равноправны и дают один и тот же токен,
 * поэтому парсер ниже не знает, на каком языке написан исходник.
 */
export const KEYWORDS = {
  // ── документ и модульность ────────────────────────────────────────────────
  module: ["модуль", "module"],
  exports: ["экспортирует", "exports"],
  uses: ["использует", "uses"],
  category: ["категория", "category"],
  object: ["объект", "структура", "object", "structure"],
  record: ["запись", "record"],
  type: ["тип", "type"],
  variant: ["вариант", "variant"],
  alias: ["это"],
  nested: ["вложен объект", "вложена структура", "nested object", "nested structure"],

  // ── функции ───────────────────────────────────────────────────────────────
  total: ["тотальная", "total"],
  function: ["функция", "function"],
  accepts: ["принимает", "accepts"],
  returns: ["возвращает", "returns"],
  /* Объявленная мера: `убывает б`. Одно слово, а не пара, потому что пары
     склеиваются лексером (`MAX_PHRASE_WORDS`), и всякая новая пара — это ещё
     одно место, где чужое сочетание слов молча становится ключевым. Голого
     `убывает` в репозитории нет ни одного (все 58 вхождений — комментарии,
     строковые литералы и имена в ёлочках), поэтому поток токенов корпуса от
     этой записи не меняется: проверено `self-lexer.test.mjs`. */
  decreases: ["убывает", "decreases"],
  example: ["пример", "example"],
  given: ["дано", "given"],
  expected: ["ожидается", "expected"],

  // ── выражения ─────────────────────────────────────────────────────────────
  let: ["пусть", "let"],
  if: ["если", "if"],
  then: ["то", "then"],
  else: ["иначе", "else"],
  match: ["разбор", "match"],
  case: ["случай", "case"],
  of: ["от", "of"],
  and: ["и", "and"],
  with: ["с", "with"],
  from: ["из", "from"],
  only: ["только", "only"],
  to: ["в", "к", "to", "into", "in", "onto"],
  by: ["по", "by"],
  at: ["у", "at"],
  as: ["как", "as"],
  where: ["где", "where"],
  startingWith: ["начиная с", "starting with"],

  // ── встроенные формы ──────────────────────────────────────────────────────
  map: ["отобразить", "map"],
  filter: ["отфильтровать", "filter"],
  fold: ["свёртка", "свертка", "fold"],
  length: ["длина", "length"],
  char: ["символ", "char"],
  /* Разложение строки в список — форма из двух частей, `разложить … на
     символы`, а не одно слово «символы».
     
     Причина не в красоте. Ключевое слово запрещает имя: параметр с таким
     именем перестаёт разбираться. Слово «символы» в этой роли встретилось
     дважды в сорока файлах репозитория — и оба раза именно там, где решение
     обходилось списком, потому что этой формы не было. Резервировать его
     значило бы сломать чужой код ради своего удобства. «Разложить» в роли
     имени переменной не встречается и не ожидается.
     
     Сама форма нужна не для краткости: посимвольный проход по индексу уменьшает
     «размер минус позиция» — число, а числа анализ завершаемости частью
     значения не считает. Разложив строку в список, тот же проход становится
     рекурсией по хвосту и доказывается. */
  decompose: ["разложить", "decompose"],
  intoCharacters: ["на символы", "into characters"],
  substring: ["подстрока", "substring"],
  join: ["соединить", "join"],
  split: ["разделить", "split"],
  contains: ["содержит", "contains"],
  beginsWith: ["начинается с", "begins with"],
  /* «к числу», чей отказ становится значением, а не концом вычисления
     (`builtins.mjs`, раздел «отказ, ставший значением»).

     Новых слов НОЛЬ, и это здесь важнее обычного. Фраза из четырёх слов именем
     быть не может никогда — тем же доводом в языке появились `разложить … на
     символы`, `обратный элемент` и `порог отказов`. Ни «или», ни «беда» по
     отдельности ключевыми не становятся: «беда» и «беды» — рабочие имена в
     `flang/self/*.flang` (92 вхождения), «или» встречается в 553 местах, и
     занять любое из них значило бы сломать чужой файл ради своего удобства.

     Длина фразы выбрана не наугад: четыре слова — это уже существующий предел
     таблицы (`is not equal to`), поэтому склейка ключевых слов не меняется ни
     здесь, ни в `self/lexer.flang`, где перебор фраз идёт до четырёх слов.

     Порядок в таблице значения не имеет — склейка жадная и длинные фразы идут
     первыми, — но запись стоит рядом с `к числу` нарочно: их поверхности
     пересекаются, и правку одной надо видеть вместе с другой. */
  toNumberOrFail: ["к числу или беда", "to number or failure"],
  toNumber: ["к числу", "to number"],
  toText: ["к строке", "to text"],
  head: ["голова", "head"],
  tail: ["хвост", "tail"],
  /* Взятие элемента списка по номеру: `элемент N в СПИСОК`.

     ПОЧЕМУ ТА ЖЕ ФОРМА, ЧТО У `символ N в СТРОКЕ`. Одно понятие называется
     одним оборотом — это правило поверхности языка, и здесь понятие буквально
     одно: «возьми N-й». Разные обороты у строки и у списка означали бы, что
     читателю надо помнить два способа сказать одно; а заодно и индексация
     разошлась бы, потому что у одного оборота она с 1, а у второго её выбирал
     бы автор заново.

     ПОЧЕМУ ОДНО СЛОВО, А НЕ ФРАЗА. Форма из двух слов (`взять по номеру`)
     запретила бы имя гарантированно, но и заняла бы вдвое больше поверхности.
     Одиночное слово здесь можно, и это ИЗМЕРЕНО тем же счётом, каким уже
     потеряны «символы», «группа», «обратный», «на», «начальное» и «порог»:
     токенизацией всех 128 файлов `.flang` и `.fts` репозитория, которые лексер
     читает, с отбором незакавыченных имён.

       элемент   — 0 голых вхождений;
       элементы  — 430 голых вхождений, и это ровно тот случай, из-за которого
                   «символы» пришлось переделывать в форму из двух частей.

     Единственное число свободно, множественное занято намертво, и ключевым
     становится РОВНО единственное: склейка сверяет слово целиком, поэтому
     `принимает элементы: список числа` разбирается как раньше. Проверять это
     на слово нельзя, поэтому проверяет тест `flang/test/lexer.test.mjs`.

     `обратный элемент` моноида не ломается: склейка жадная и длинные фразы
     идут первыми, поэтому пара слов побеждает одиночное. Тоже под тестом. */
  item: ["элемент", "item"],
  headTail: ["голова и хвост", "head and tail"],
  empty: ["пусто", "empty"],
  emptyList: ["пустой список", "empty list"],
  listOf: ["список из", "list of"],
  list: ["список", "list"],
  add: ["добавить", "add"],
  any: ["любое", "any"],

  // ── арифметика и сравнения ────────────────────────────────────────────────
  opAdd: ["плюс", "plus"],
  opSub: ["минус", "minus"],
  opMul: ["умножить на", "times", "multiplied by"],
  opDiv: ["делить на", "divided by"],
  opMod: ["остаток от", "modulo"],
  opPercent: ["процентов", "процента", "процент", "percent", "percents"],
  cmpEq: ["равен", "равна", "равно", "равным", "равной", "равное", "equals", "equal to"],
  cmpNeq: ["не равен", "не равна", "не равно", "is not equal to", "not equals"],
  cmpGt: ["больше", "is greater than", "greater than"],
  cmpLt: ["меньше", "is less than", "less than"],
  cmpLte: ["не больше", "is at most", "at most"],
  cmpGte: ["не меньше", "is at least", "at least"],

  // ── значения и типы ───────────────────────────────────────────────────────
  litTrue: ["да", "true", "yes"],
  litFalse: ["нет", "false", "no"],
  litNull: ["ничто", "null"],
  tNumber: ["число", "числа", "числом", "числу", "number"],
  /* «текст» и «text» намеренно не ключевые слова: это слишком частое имя поля
     (`вариант Слово содержит текст: строка` прямо из SPEC). Форму творительного
     падежа `текстом` ядро FTS понимает как тип, её и оставляем. */
  tString: ["строка", "строки", "строкой", "строку", "текстом", "string"],
  tFlag: ["признак", "признака", "признаком", "boolean", "flag"],
  tMoney: ["деньги", "деньгами", "money"],
  tDate: ["дата", "даты", "дату", "датой", "date"],
  state: ["состояние", "состоянием", "state"],
  is: ["является", "is"],
  maybeIs: ["иногда является", "may be"],

  // ── наследие FTS ──────────────────────────────────────────────────────────
  utility: ["утилита", "utility"],
  rule: ["правило", "rule"],
  property: ["свойство", "property"],
  result: ["результат", "result"],
  startsWith: ["начинает с", "starts with"],
  /* «поля» — родительный падеж из оборота «10 процентов от поля сумма»:
     ядро FTS срезает его как служебное слово, значит и здесь оно служебное. */
  field: ["поле", "поля", "field"],
  morphism: ["морфизм", "morphism"],
  /* Теоркат-поверхность (flang/cat/SPEC.md, шаг 1). Только слова: «после» —
     композиция в математическом порядке, «цепочка» с «сначала»/«затем» — она
     же в порядке чтения, потому что «в после (б после а)» читается наизнанку.
     Символов вроде «∘» здесь нет и не будет: их не набрать на клавиатуре. */
  after: ["после", "after"],
  chain: ["цепочка", "chain"],
  firstStep: ["сначала", "first"],
  nextStep: ["затем", "next"],
  identity: ["единица", "identity"],
  /* Закон при стрелке (flang/cat/SPEC.md, «Категория и морфизм»). Стрелка
     сама по себе — объявление без вычисления, и проверять у неё нечего; `даёт`
     называет функцию, которая её считает, а `закон` открывает блок примеров,
     на которых обещание проверяется.

     Оба слова проверены на ГОЛОЕ, незакавыченное вхождение — не глазами, а
     токенизацией всех 135 файлов `.flang` и `.fts` репозитория тем же
     `tokenize`, каким их читает язык (тот же счёт, каким уже потеряны
     «символы», «группа», «обратный», «на», «начальное» и «порог»):

       даёт   — 0 голых вхождений, и по-английски `gives` — тоже 0;
       закон  — 0 голых вхождений; те, что видит `grep`, все до одной внутри
                «ёлочек» («закон-о-лизинге.ст-15» в корпусе спецификаций) или
                в комментариях, а там ключевым слово не становится.

     Английское `law` при этом уже занято фразой `under law`, и это не
     столкновение: склейка жадная и длинные фразы идут первыми, поэтому
     `under law` остаётся ссылкой на теорему, а одинокое `law` открывает блок.

     ПОЧЕМУ `даёт` НАЗЫВАЕТ ФУНКЦИЮ, А НЕ НЕСЁТ ВЫРАЖЕНИЕ. Черновик контракта
     писал `даёт запись «Отгрузка» с номер равным …` — тело прямо в стрелке.
     Тело в стрелке — это второй разбор выражений, второй вывод типов, второй
     анализ завершаемости и восьмая печать в восьми целях; названная функция не
     стоит ничего из этого и говорит ровно то же. Так уже сделано у моноида
     (`операция «Соединить»`) и у монады (`возврат «Обернуть»`), и решение 3
     контракта — «морфизм может быть реализован функцией» — это же и говорит. */
  gives: ["даёт", "gives"],
  lawBlock: ["закон", "law"],
  /* Изоморфизм: пара стрелок туда и обратно (flang/cat/SPEC.md).
     Концы называются уже занятыми `из … в …` — теми же двумя словами, какими
     их называют морфизм и функтор. Третий предлог («между») читался бы не
     хуже, но означал бы ровно то же самое, а поверхность языка тем и держится,
     что одно понятие называется одним оборотом.

     Сами стрелки — фразы из двух слов, а не «туда» и «обратно». Проверка
     `grep` по .flang и .fts репозитория показывает, что оба наречия сегодня
     свободны, но свободны они СЛУЧАЙНО: это обычные слова, и завтра автор
     напишет `пусть обратно равно …`. Фраза из двух слов именем быть не может
     никогда — тем же доводом в языке появились `обратный элемент` и
     `разложить … на символы`. «Обратный морфизм» вдобавок ставится в один ряд
     с «обратным элементом» моноида: одно и то же слово об одном и том же. */
  isomorphism: ["изоморфизм", "isomorphism"],
  forwardMorphism: ["прямой морфизм", "forward morphism"],
  inverseMorphism: ["обратный морфизм", "inverse morphism"],
  /* Моноид: носитель, операция, единица — и необязательное обращение, с
     которым моноид становится группой. Отдельного слова «группа» нет, и это
     не экономия: группа И ЕСТЬ моноид с обращением, а два слова для одного
     понятия развели бы проверки, которые обязаны совпадать.

     «Группа», «обратный» и «на» в этот набор не вошли, потому что заняты как
     имена в коде репозитория (57, 4 и множество мест). Резервировать их
     значило бы сломать чужой код — как уже случилось со словом «символы».
     Отсюда «носитель» вместо «на» и фраза «обратный элемент» вместо слова. */
  monoid: ["моноид", "monoid"],
  carrier: ["носитель", "carrier"],
  operation: ["операция", "operation"],
  inverseElement: ["обратный элемент", "inverse element"],
  /* Монада: моноид в категории эндофункторов (flang/cat/MONAD.md). Четыре
     слова на всю конструкцию, и каждое проверено `grep -rowE` по .flang и .fts
     репозитория на ГОЛОЕ, не закавыченное вхождение — тем же счётом, каким уже
     потеряны «символы», «группа», «обратный», «на», «начальное» и «порог».

       монада      — 1 вхождение, и то в комментарии link-report.flang;
       возврат     — 20 вхождений, ВСЕ в «ёлочках» или в комментариях
                     (`пусть «возврат» равно` в self/types.flang, self/emit-c.flang,
                     core/parser.flang), а имя в ёлочках ключевым не становится;
       соединение  — 6 вхождений, все в комментариях и в «Слово соединением»;
       в монаде    — фраза из двух слов, именем быть не может никогда.

     Слово «вернуть» рассматривалось для строки-результата блока и ОТВЕРГНУТО
     измерением: `пусть вернуть равно «Перенести» от …` стоит голым в
     `flang/examples/rosetta/towers-of-hanoi.flang`, и ключевое слово сломало бы
     этот файл. Вместо него ту же роль играет `возврат` — то самое η, которое
     объявлено строкой выше: `возврат «Обернуть»` называет функцию, `возврат
     выражение` внутри блока её применяет. Одно понятие — одно слово.

     Английское `join` занято встроенной формой `соединить`, поэтому μ
     по-английски пишется `flatten`: одна и та же фраза не вправе означать две
     конструкции. */
  monad: ["монада", "monad"],
  monadUnit: ["возврат", "return"],
  monadJoin: ["соединение", "flatten"],
  inMonad: ["в монаде", "in monad"],
  theorem: ["теорема", "theorem"],
  functor: ["функтор", "functor"],
  /* Бифунктор: функтор от двух входов сразу (flang/cat/SPEC.md). Слова
     «бифунктор», «объекты» и «морфизмы» проверены `grep` по .flang и .fts вне
     комментариев, ёлочек и строк — ни одно не стоит в позиции имени.
     Множественное число заведено отдельными идентификаторами, а не добавлено
     к `object` и `morphism`: тогда `объекты «Х»` наверху файла разбиралось бы
     как объявление записи, и опечатка в одну букву молча меняла бы смысл. */
  bifunctor: ["бифунктор", "bifunctor"],
  objectPair: ["объекты", "objects"],
  morphismPair: ["морфизмы", "morphisms"],
  proposition: ["утверждение", "proposition"],
  has: ["имеет", "has"],
  inData: ["в данных", "in data"],
  findWhere: ["найти где", "find where"],
  byMorphism: [
    "по морфизму",
    "затем по морфизму",
    "применить морфизм",
    "затем применить морфизм",
    "by morphism",
    "then by morphism",
    "apply morphism",
    "then apply morphism",
  ],
  therefore: ["следовательно", "получаем", "therefore"],
  law: ["по закону", "under law"],
  /* Множественное число — та же связка, что и единственное, ровно как `равен`,
     `равна` и `равное` дают один `cmpEq`. У бифунктора отображается ПАРА, и
     писать «пара объектов отображается» вместо «объекты отображаются» значило
     бы портить русский ради экономии одной строки таблицы. */
  mapsTo: ["отображается в", "отображаются в", "maps to", "map to"],
  mapsToField: ["отображается в поле", "maps to field"],
  mapsToMorphism: ["отображается в морфизм", "отображаются в морфизм", "maps to morphism", "map to morphism"],

  /* ── конкурентность (flang/conc/SPEC.md, шаг 1) ────────────────────────────
     Восемь слов на всю модель, и каждое проверено `grep -rn` по .flang и .fts
     репозитория на затенение имени. Двух слов из контракта здесь нет, и оба
     раза по одной и той же причине — по той, из-за которой «символы» пришлось
     переделывать в форму из двух частей.

     «начальное» из контракта не заводится: это имя переменной в
     `flang/core/lexer.flang`, и не однажды, а в четырёх местах (`пусть
     начальное равно запись …`). Ключевое слово запрещает имя, значит слово
     «начальное» сломало бы файл, к конкурентности отношения не имеющий.
     Начальное состояние процесса называется уже занятым `начинает с` — тем же
     оборотом, каким начальное значение называет утилита FTS. Смысл тот же,
     новых слов ноль.

     «порог» из контракта не заводится по той же причине: это параметр в
     `flang/stdlib/optional.flang` («Найти не меньше» принимает порог: число, и
     дальше `если эл не меньше порог`). Поэтому форма из двух частей — «порог
     отказов»: одиночное слово остаётся именем, а фраза из двух слов именем
     быть не может никогда.

     «витков», «отказов» после числа и «миллисекунд» не резервируются вовсе:
     парсер пропускает их как слова-пояснения (`skipFillerWords`). Занимать
     существительное ради читаемости одной строки — цена, которую платить не
     надо. */
  process: ["процесс", "process"],
  handles: ["обрабатывает", "handles"],
  budget: ["с запасом", "with budget"],
  supervision: ["надзор", "supervision"],
  strategy: ["стратегия", "strategy"],
  failureThreshold: ["порог отказов", "failure threshold"],
  run: ["прогон", "run"],
  seed: ["семя", "seed"],

  /* ── ввод-вывод (flang/cat/SPEC.md, «Эффекты и HTTP») ──────────────────────
     ОДНО слово на всю модель, и это не рекорд ради рекорда: план объявляется
     теми же тремя строками, что процесс, — `состояние`, `начинает с`,
     `обрабатывает`, — потому что форма у них одна и та же (чистая функция от
     «где мы были» и «что случилось»). Разные слова для одинаковых строк
     означали бы, что читателю надо помнить два словаря вместо одного.

     Проверено `grep`-ом по всем `.flang` и `.fts` репозитория на голое (не
     закавыченное, не в комментарии) вхождение: «план» — 0, «plan» — 0.
     Проверялись и отвергнутые кандидаты: «шаг» встречается 7 раз голым — это
     поле записи и переменная в `flang/core/lexer.flang` и накопитель свёртки в
     `flang/examples/rosetta/fibonacci.flang`, — поэтому слова «шаг» здесь нет
     и функция шага называется уже занятым `обрабатывает`.

     Имена вариантов словаря ключевыми словами не становятся вовсе: они
     пишутся в ёлочках, а закавыченное имя ключевым словом стать не может
     никогда. Их занятость проверена отдельно — см. `src/io.mjs`. */
  plan: ["план", "plan"],
}

const PHRASES = new Map()
let MAX_PHRASE_WORDS = 1
for (const [id, phrases] of Object.entries(KEYWORDS)) {
  for (const phrase of phrases) {
    const words = phrase.split(" ")
    if (words.length > MAX_PHRASE_WORDS) MAX_PHRASE_WORDS = words.length
    /* Первая победившая фраза остаётся за своим идентификатором: таблица выше
       читается сверху вниз, поэтому конфликт виден глазами при правке. */
    if (!PHRASES.has(phrase)) PHRASES.set(phrase, id)
  }
}

/** Ключевое слово по одной поверхности — нужно тестам и парсеру для сообщений. */
export function keywordId(text) {
  return PHRASES.get(text.toLowerCase()) ?? null
}

export function tokenize(source) {
  if (typeof source !== "string") {
    throw flangError("FLANG_LEX", "исходник должен быть строкой")
  }

  const text = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n")
  const tokens = []
  const indents = [0]
  let offset = 0
  let line = 1
  let column = 1
  let depth = 0
  let atLineStart = true
  let lineHasTokens = false

  const here = () => ({ line, column })

  const advance = () => {
    const character = text[offset]
    offset += 1
    if (character === "\n") {
      line += 1
      column = 1
    } else {
      column += 1
    }
    return character
  }

  const push = (token) => {
    tokens.push(token)
    if (token.kind !== "indent" && token.kind !== "dedent" && token.kind !== "newline") lineHasTokens = true
  }

  const skipBlockComment = () => {
    const start = here()
    advance()
    advance()
    while (offset < text.length && !(text[offset] === "*" && text[offset + 1] === "/")) advance()
    if (offset >= text.length) throw flangError("FLANG_LEX", "не закрыт блочный комментарий", start)
    advance()
    advance()
  }

  /**
   * Начало значащей строки: измеряем отступ, пропуская пустые строки и
   * комментарии. Возвращает false, если значащих строк больше нет.
   */
  const openLine = () => {
    let width = 0
    for (;;) {
      const character = text[offset]
      if (character === undefined) return false
      if (character === " ") {
        width += 1
        advance()
        continue
      }
      if (character === "\t") {
        width += TAB_WIDTH
        advance()
        continue
      }
      if (character === "\n") {
        width = 0
        advance()
        continue
      }
      if (character === "/" && text[offset + 1] === "/") {
        while (offset < text.length && text[offset] !== "\n") advance()
        continue
      }
      if (character === "/" && text[offset + 1] === "*") {
        const before = line
        skipBlockComment()
        /* Комментарий через несколько строк обнуляет измеренный отступ:
           значащим считается отступ той строки, где стоит первый токен. */
        if (line !== before) width = 0
        continue
      }
      break
    }

    const top = indents[indents.length - 1]
    if (width > top) {
      indents.push(width)
      push({ kind: "indent", value: "", span: here() })
      return true
    }
    while (width < indents[indents.length - 1]) {
      indents.pop()
      push({ kind: "dedent", value: "", span: here() })
    }
    if (width !== indents[indents.length - 1]) {
      throw flangError(
        "FLANG_LEX",
        `рваный отступ: ${width} не совпадает ни с одним открытым уровнем (${indents.join(", ")})`,
        here(),
      )
    }
    return true
  }

  const readQuoted = (open, close) => {
    const start = here()
    advance()
    let value = ""
    let closed = false
    while (offset < text.length) {
      const character = advance()
      if (character === close) {
        closed = true
        break
      }
      if (character === "\\" && offset < text.length) {
        const escaped = advance()
        const escapes = { n: "\n", r: "\r", t: "\t", '"': '"', "'": "'", "\\": "\\" }
        if (escaped === "u") {
          const hex = text.slice(offset, offset + 4)
          if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) throw flangError("FLANG_LEX", "неверный Unicode-escape", start)
          for (let index = 0; index < 4; index += 1) advance()
          value += String.fromCharCode(Number.parseInt(hex, 16))
        } else {
          value += escapes[escaped] ?? escaped
        }
        continue
      }
      value += character
    }
    if (!closed) {
      throw flangError("FLANG_LEX", open === "«" ? "не закрыта кавычка-ёлочка" : "не закрыта кавычка", start)
    }
    return { value: value.normalize("NFC"), span: start }
  }

  while (offset < text.length) {
    if (atLineStart && depth === 0) {
      if (!openLine()) break
      atLineStart = false
      continue
    }
    atLineStart = false

    const character = text[offset]

    if (character === "\n") {
      const start = here()
      advance()
      if (lineHasTokens) {
        tokens.push({ kind: "newline", value: "\n", span: start })
        lineHasTokens = false
      }
      atLineStart = true
      continue
    }
    if (character === " " || character === "\t") {
      advance()
      continue
    }
    if (character === "/" && text[offset + 1] === "/") {
      while (offset < text.length && text[offset] !== "\n") advance()
      continue
    }
    if (character === "/" && text[offset + 1] === "*") {
      skipBlockComment()
      continue
    }
    if (character === "→") {
      const start = here()
      advance()
      push({ kind: "arrow", value: "→", span: start })
      continue
    }
    if ((character === "-" || character === "=") && text[offset + 1] === ">") {
      const start = here()
      advance()
      advance()
      push({ kind: "arrow", value: "→", span: start })
      continue
    }
    if (character === "«") {
      const { value, span } = readQuoted("«", "»")
      push({ kind: "name", value, quoted: true, span })
      continue
    }
    if (character === '"' || character === "'") {
      const { value, span } = readQuoted(character, character)
      push({ kind: "string", value, quoted: true, span })
      continue
    }
    if (/\d/u.test(character) || (character === "-" && /\d/u.test(text[offset + 1] ?? ""))) {
      const start = here()
      const match = NUMBER.exec(text.slice(offset))
      if (match === null) throw flangError("FLANG_LEX", "неверное число", start)
      for (let index = 0; index < match[0].length; index += 1) advance()
      push({ kind: "number", value: Number(match[0]), text: match[0], span: start })
      continue
    }
    if (NAME_START.test(character)) {
      const start = here()
      let value = advance()
      while (offset < text.length && NAME_PART.test(text[offset])) value += advance()
      push({ kind: "name", value: value.normalize("NFC"), quoted: false, span: start })
      continue
    }
    if ("{}[]()<>:;,.?=|&+*%!".includes(character)) {
      const start = here()
      push({ kind: "punct", value: advance(), span: start })
      if (character === "{" || character === "[" || character === "(") depth += 1
      if (character === "}" || character === "]" || character === ")") depth = Math.max(0, depth - 1)
      continue
    }

    throw flangError("FLANG_LEX", `недопустимый символ '${character}'`, here())
  }

  if (lineHasTokens) tokens.push({ kind: "newline", value: "\n", span: here() })
  while (indents.length > 1) {
    indents.pop()
    tokens.push({ kind: "dedent", value: "", span: here() })
  }
  tokens.push({ kind: "eof", value: "", span: here() })

  return foldKeywords(tokens)
}

/** Склейка соседних незакавыченных слов в ключевые слова и фразы (жадно, длинные вперёд). */
function foldKeywords(tokens) {
  const result = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (token.kind !== "name" || token.quoted) {
      result.push(token)
      index += 1
      continue
    }
    let size = Math.min(MAX_PHRASE_WORDS, tokens.length - index)
    let id = null
    for (; size >= 1; size -= 1) {
      const run = tokens.slice(index, index + size)
      if (run.some((item) => item.kind !== "name" || item.quoted)) continue
      const found = PHRASES.get(run.map((item) => item.value.toLowerCase()).join(" "))
      if (found !== undefined) {
        id = found
        break
      }
    }
    if (id === null) {
      result.push(token)
      index += 1
      continue
    }
    const run = tokens.slice(index, index + size)
    result.push({ kind: "keyword", value: id, text: run.map((item) => item.value).join(" "), span: token.span })
    index += size
  }
  return result
}
