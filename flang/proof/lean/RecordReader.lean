import «Приёмка»

/-!
# Разбор текста записи и исходника в данные Lean (ADR-0041 §2.2, веха 5)

Здесь то, что стоит ВНЕ теоремы (ADR-0041 §2.3): чтение текста формулы в
`«Форм»`/`«ТермЧ»`/…, строк записи — в `«Запись»`, строк исходника — в
`«Функция»`. Читатель повторяет дисциплину сверщика (`сверщик.c`): те же
`терм`/`ужать`/`расставить`, тот же разрез «надвое по верхнему знаку» с
отказом при неоднозначности, те же ключевые слова. Где сверщик сличает текст,
здесь сличаются деревья — и потому этот файл ДОВЕРЕННЫЙ наравне с
`Модель.lean`: ошибка чтения не ловится теоремой, её ловит сверка вердиктов
в `прогон.sh`.

Сумма автора (ADR-0042 §2, задача 6432): `вариант «В» с «п» равным Т и …` —
выписанный конструктор, поле `С .«п»` (и `С.«п»`, как в теле) читается числом,
разбор суммы `разбор С случай вариант «В» с п как х и … то Ф случай …` — формулой
раньше всех разрезов: его ветви тянутся до следующего «случай». Имена полей и
варианта хранятся без ёлочек — как их сличает сверщик (`как_слово`). Довод вызова,
который весь — вызов с доводами, читается вызовом без сорта (`«Тело».«вызов»`):
его итог встаёт на место параметра целиком, какого бы сорта ни было это место.

Порядок разреза формулы (когда скобок нет, решает он): `если … то … иначе`,
`или`, `и притом`, `не`, `для всех`, `есть такой`, `пусто`, `: кон|цел`,
`помещается`, `не убывает`, сравнения, `содержит`, `начинается с`, вызов,
имя. У термов-чисел `если … то … иначе` и `свёртка … → Ш` стоят раньше
двуместных знаков: их хвост тянется до конца. Записи ядра скобки
расставляют, и порядок не спрашивается.

Имя вызова хранится так, как написано: у объявленной функции — в ёлочках
(`«Ф»`), у довода-функции — голым именем (`условие`). По ёлочкам приёмка отличает
вызов функции программы от вызова довода — плоскость тела у Разв2 (задача 8836),
как сверщик отличает их записью «» от ».

Строй блока `вывод` (цель первой и одна, конец последним и один, шагов от 1 до
64) читатель проверяет сам, как `проиграть_вывод`: приёмка получает уже
разобранный блок и о строках не знает. Не прочлось утверждение — отказ только
ему (`«утверждение»`), соседние читаются дальше.
-/

/-! ## Строки Lean 4.34: `drop`/`trim` дают срез, здесь нужна строка -/

def String.«сн» (s : String) (n : Nat) : String := (s.drop n).toString
def String.«снК» (s : String) (n : Nat) : String := (s.dropEnd n).toString
def String.«обр» (s : String) : String := s.trimAscii.toString

namespace «Разбор»


/-! ## Текст, как его читает сверщик -/

/-- Число вхождений знака. -/
def «сколькоРаз» (s : String) (c : Char) : Nat := (s.toList.filter (· = c)).length

def «сжатьПробелы» (s : String) : String :=
  " ".intercalate ((s.splitOn " ").filter (· ≠ ""))

def «расставить» (s : String) : String :=
  «сжатьПробелы» ((s.replace "(" " ( ").replace ")" " ) ")

def «скобкиСошлись» (s : String) : Bool := «сколькоРаз» s '(' = «сколькоРаз» s ')'

/-- Счёт скобок ни разу не уходит в минус. -/
def «неПроваливается» (s : String) : Bool :=
  (s.toList.foldl (fun (acc : Int × Bool) c =>
    if c = '(' then (acc.1 + 1, acc.2)
    else if c = ')' then (acc.1 - 1, acc.2 && acc.1 - 1 ≥ 0)
    else acc) (0, true)).2

def «безКраёв» (s : String) : String := if s.length < 3 then "" else (s.«сн» 1).«снК» 1

def «однаПара» (s : String) : Bool :=
  s.length ≥ 3 && s.front = '(' && s.back = ')' && «скобкиСошлись» s && «неПроваливается» («безКраёв» s)

/-- Снять внешние скобки, до четырёх раз. -/
def «ужать» (s : String) : String :=
  let r0 := s.«обр»
  let «шаг» := fun (r : String) => if «однаПара» r then («безКраёв» r).«обр» else r
  «шаг» («шаг» («шаг» («шаг» r0)))

/-- `терм` сверщика: двоеточие разводится пробелами, скобки — тоже. -/
def «терм» (s : String) : String := «ужать» («расставить» (s.replace ":" " : "))

/-- Части верхнего уровня по знаку: разбить наивно и склеивать, пока скобки не сойдутся. -/
def «разделитьСверху» (t : String) («знак» : String) : List String :=
  let sep := " " ++ «знак» ++ " "
  let «сырые» := t.splitOn sep
  let «итог» := «сырые».foldl (fun (acc : List String × Option String) «ч» =>
    let «новое» := match acc.2 with | some «тек» => «тек» ++ sep ++ «ч» | none => «ч»
    if «скобкиСошлись» «новое» then (acc.1 ++ [«новое»], none) else (acc.1, some «новое»)) ([], none)
  «итог».1

/-- Ровно два куска верхнего уровня по знаку, обе стороны ужаты. -/
def «надвое» (t : String) («знак» : String) : Option (String × String) :=
  match «разделитьСверху» («ужать» t) «знак» with
  | [l, r] => some («ужать» l, «ужать» r)
  | _ => none

def «содержитСлово» (t : String) (w : String) : Bool :=
  ((" " ++ t ++ " ").splitOn (" " ++ w ++ " ")).length > 1

def «словаПосле» (s : String) (n : Nat) : String :=
  " ".intercalate ((s.splitOn " ").drop n)

def «литерал?» (t : String) : Option Nat :=
  let u := «ужать» t
  if u.isNat then u.toNat? else none

def «имя?» (t : String) : Bool :=
  let u := «ужать» t
  u ≠ "" && !(u.any (· = ' ')) && !(u.any (· = '(')) && («литерал?» u).isNone

/-- «если У то А иначе Б» — по одному верхнему « то » и « иначе ». -/
def «выбор» (t : String) : Option (String × String × String) :=
  let u := «ужать» t
  if !u.startsWith "если " then none else
  match «разделитьСверху» u "иначе" with
  | [«лево», «б»] =>
    match «разделитьСверху» («ужать» «лево») "то" with
    | [«у», «а»] => some ((«ужать» «у»).«сн» 5 |>.«обр», «ужать» «а», «ужать» «б»)
    | _ => none
  | _ => none

/-- Вызов: `«Ф» от А и Б`, `условие от эл`, либо голое `«Ф»`. -/
def «вызов?» (t : String) : Option (String × List String) :=
  let u := «ужать» t
  match «разделитьСверху» u "от" with
  | [f, args] =>
    let f' := «ужать» f
    if «имя?» f' || (f'.startsWith "«" && f'.endsWith "»") then
      some (f', («разделитьСверху» («ужать» args) "и").map «ужать»)
    else none
  | _ => if u.startsWith "«" && u.endsWith "»" && !(u.any (· = ' ')) then some (u, []) else none

/-- Голое имя из ёлочек. -/
def «голо» (s : String) : String :=
  let t := s.«обр»
  if t.startsWith "«" && t.endsWith "»" then («безКраёв» t) else t

/-- Поле `С .«п»` (либо `С.«п»`): кусок до ПОСЛЕДНЕГО «.«» и имя поля без ёлочек. -/
def «проекция?» (s : String) : Option (String × String) :=
  if !s.endsWith "»" then none else
  match (s.splitOn ".«").reverse with
  | «хв» :: «пред» :: «ещё» =>
    let «поле» := «хв».«снК» 1
    let «до» := «ужать» (".«".intercalate ((«пред» :: «ещё»).reverse))
    if «поле» = "" || «поле».any (fun c => c = '«' || c = '»') || «до» = "" || !(«скобкиСошлись» «до») then none
    else some («до», «поле»)
  | _ => none

/-- `вариант «В» …`: имя варианта без ёлочек и хвост после него. -/
def «вариант?» (s : String) : Option (String × String) :=
  if !s.startsWith "вариант «" then none else
  match s.splitOn "»" with
  | a :: «ост» => some (a.«сн» 9, ("»".intercalate «ост»).«обр»)
  | [] => none

/-! ## Формулы и термы -/

mutual
partial def «число» (s0 : String) : Option «ТермЧ» :=
  let s := «ужать» s0
  if let some (u, a, b) := «выбор» s then
    do let u' ← «форм» u; let a' ← «число» a; let b' ← «число» b; pure (.«если» u' a' b')
  else if s.startsWith "свёртка " then
    match «разделитьСверху» s "→" with
    | [«лево», «ш»] =>
      match «разделитьСверху» («ужать» «лево») "как" with
      | [«лево2», «имена»] =>
        match «разделитьСверху» («ужать» «лево2») "начиная с" with
        | [«сп», «н»] =>
          match «разделитьСверху» («ужать» «имена») "и" with
          | [a, e] =>
            if «имя?» a && «имя?» e then
              do pure (.«свёртка» (← «список» («словаПосле» («ужать» «сп») 1)) (← «число» «н»)
                        («ужать» a) («ужать» e) (← «число» «ш»))
            else none
          | _ => none
        | _ => none
      | _ => none
    | _ => none
  else if let some (l, r) := «надвое» s "плюс" then do pure (.«плюс» (← «число» l) (← «число» r))
  else if let some (l, r) := «надвое» s "минус" then do pure (.«минус» (← «число» l) (← «число» r))
  else if let some (l, r) := «надвое» s "умножить на" then do pure (.«умножить» (← «число» l) (← «число» r))
  else if let some (l, r) := «надвое» s "остаток от" then do pure (.«остаток» (← «число» l) (← «число» r))
  else if s.startsWith "длина " then do pure (.«длина» (← «список» (s.«сн» 6)))
  else if s.startsWith "код символа " then do pure (.«кодСимвола» (← «текст» (s.«сн» 12)))
  else if let some (f, args) := «вызов?» s then do pure (.«вызов» f (← «доводы» args))
  else if let some (c, p) := «проекция?» s then do pure (.«поле» (← «сумма» c) p)
  else if let some n := «литерал?» s then some (.«лит» n)
  else if «имя?» s then some (.«имя» s)
  else none

partial def «список» (s0 : String) : Option «ТермС» :=
  let s := «ужать» s0
  if s = "пустой список" then some .«пустой»
  -- списочная свёртка (М2, ADR-0042 §2): начало и шаг — списки
  else if s.startsWith "свёртка " then
    match «разделитьСверху» s "→" with
    | [«лево», «ш»] =>
      match «разделитьСверху» («ужать» «лево») "как" with
      | [«лево2», «имена»] =>
        match «разделитьСверху» («ужать» «лево2») "начиная с" with
        | [«сп», «н»] =>
          match «разделитьСверху» («ужать» «имена») "и" with
          | [a, e] =>
            if «имя?» a && «имя?» e then
              do pure (.«свёрткаС» (← «список» («словаПосле» («ужать» «сп») 1)) (← «список» «н»)
                        («ужать» a) («ужать» e) (← «список» «ш»))
            else none
          | _ => none
        | _ => none
      | _ => none
    | _ => none
  else if s.startsWith "[" && s.endsWith "]" then
    let «вн» := («безКраёв» s).«обр»
    if «вн».any (· = '[') || «вн».any (· = ']') then none
    -- `[]` — тот же пустой список, что слово «пустой список»: Э1 судит `.«пустой»`,
    -- а печать ядра пишет хвост выписанного списка `[]` (мера длины формулы, 4058).
    else if «вн» = "" then some .«пустой»
    else do pure (.«выписан» (← «члены» ((«вн».splitOn ",").map «ужать»)))
  else if let some (u, a, b) := «выбор» s then
    do pure (.«еслиС» (← «форм» u) (← «список» a) (← «список» b))
  else if s.startsWith "приписать " then
    match «разделитьСверху» s "к" with
    | [«л», «хв»] => do pure (.«приписать» (← «число» («словаПосле» («ужать» «л») 1)) (← «список» «хв»))
    | _ => none
  else if s.startsWith "добавить " then
    match «разделитьСверху» s "к" with
    | [«л», «хв»] => do pure (.«добавить» (← «число» («словаПосле» («ужать» «л») 1)) (← «список» «хв»))
    | _ => none
  else if s.startsWith "отфильтровать " then
    match «надвое» (s.«сн» 14) "где" with
    | some («над», «хв») =>
      let «разрез» := match «надвое» «хв» "→" with | some p => some p | none => «надвое» «хв» ":"
      match «разрез» with
      | some (x, «у») => if «имя?» x then do pure (.«отбор» (← «список» «над») («ужать» x) (← «форм» «у»)) else none
      | none => none
    | none => none
  else if let some (f, args) := «вызов?» s then do pure (.«вызовС» f (← «доводы» args))
  else if «имя?» s then some (.«имяС» s)
  else none

partial def «текст» (s0 : String) : Option «ТермТ» :=
  let s := «ужать» s0
  if s.length ≥ 2 && s.front = '"' && s.back = '"' then some (.«литТ» («безКраёв» s))
  else if let some (u, a, b) := «выбор» s then
    do pure (.«еслиТ» (← «форм» u) (← «текст» a) (← «текст» b))
  else if s.startsWith "соединить " then
    match «разделитьСверху» s "с" with
    | [«л», «р»] => do pure (.«склейка» (← «текст» («словаПосле» («ужать» «л») 1)) (← «текст» «р»))
    | _ => none
  else if let some (f, args) := «вызов?» s then do pure (.«вызовТ» f (← «доводы» args))
  else if «имя?» s then some (.«имяТ» s)
  else none

partial def «форм» (s0 : String) : Option «Форм» :=
  let s := «ужать» s0
  if s = "да" then some .«да»
  else if s = "нет" then some .«нет»
  else if s.startsWith "разбор " then
    match «разделитьСверху» s "случай" with
    | «гол» :: «сл» =>
      if «сл».isEmpty then none else do
        pure (.«разборСм» (← «сумма» ((«ужать» «гол»).«сн» 7)) (← «случаи» «сл»))
    | [] => none
  else if let some (u, a, b) := «выбор» s then
    do pure (.«еслиФ» (← «форм» u) (← «форм» a) (← «форм» b))
  else if let some (l, r) := «надвое» s "или" then do pure (.«или» (← «форм» l) (← «форм» r))
  else if let some (l, r) := «надвое» s "и притом" then do pure (.«и» (← «форм» l) (← «форм» r))
  else if s.startsWith "не " then do pure (.«не» (← «форм» (s.«сн» 3)))
  else if s.startsWith "для всех " then
    match «разделитьСверху» s ":" with
    | «лево» :: «хвост» =>
      if «хвост».isEmpty then none else
      let «у» := «ужать» (" : ".intercalate «хвост»)
      match «надвое» ((«ужать» «лево»).«сн» 9) "из" with
      | some («п», «л») => if «имя?» «п» then do pure (.«всех» («ужать» «п») (← «список» «л») (← «форм» «у»)) else none
      | none => none
    | [] => none
  else if s.startsWith "есть такой " then
    match (s.«сн» 11).splitOn ", а именно " with
    | [«м», «хв»] =>
      match «хв».splitOn ", что " with
      | [«т», «у»] => if «имя?» «м» then do pure (.«есть» («м».«обр») (← «число» «т») (← «форм» «у»)) else none
      | _ => none
    | _ => none
  else if s.startsWith "пусто " then
    match «список» (s.«сн» 6) with
    | some l => some (.«пусто» l)
    | none => do pure (.«пустоТ» (← «текст» (s.«сн» 6)))
  else if let some (l, r) := «надвое» s ":" then
    if r = "кон" then do pure (.«кон» (← «число» l))
    else if r = "цел" then do pure (.«цел» (← «число» l))
    else none
  else if s.endsWith " помещается" then do pure (.«помещается» (← «число» (s.«снК» 11)))
  else if s.endsWith " не убывает" then do pure (.«неУбывает» (← «список» (s.«снК» 11)))
  else if let some (l, r) := «надвое» s "не больше" then do pure (.«неБольше» (← «число» l) (← «число» r))
  else if let some (l, r) := «надвое» s "не меньше" then do pure (.«неМеньше» (← «число» l) (← «число» r))
  else if «содержитСлово» s "не меньше" || «содержитСлово» s "не больше" then none
  else if let some (l, r) := «надвое» s "меньше" then do pure (.«меньше» (← «число» l) (← «число» r))
  else if let some (l, r) := «надвое» s "больше" then do pure (.«больше» (← «число» l) (← «число» r))
  else if let some (l, r) := (match «надвое» s "равен" with | some p => some p | none => «надвое» s "равно") then
    match «число» l, «число» r with
    | some a, some b => some (.«равен» a b)
    | _, _ =>
      match «список» l, «список» r with
      | some a, some b => some (.«равенС» a b)
      | _, _ => do pure (.«равенТ» (← «текст» l) (← «текст» r))
  else if let some (l, r) := «надвое» s "содержит" then do pure (.«содержит» (← «список» l) (← «число» r))
  else if let some (l, r) := «надвое» s "начинается с" then do pure (.«начинается» (← «текст» l) (← «текст» r))
  else if let some (f, args) := «вызов?» s then do pure (.«вызовФ» f (← «доводы» args))
  else if «имя?» s then some (.«имяФ» s)
  else none

/-- Довод вызова: выписанный конструктор — суммой; вызов с доводами — вызовом
    без сорта; иначе число, список, текст, признак, сумма — что прочтётся первым. -/
partial def «тело» (s : String) : Option «Тело» :=
  if («ужать» s).startsWith "вариант «" then (fun c => .«сумма» c) <$> «сумма» s
  else match «число» s with
  | some (.«вызов» f d) => if d matches .«нет» then some (.«число» (.«вызов» f d)) else some (.«вызов» f d)
  | some t => some (.«число» t)
  | none => match «список» s with
    | some l => some (.«список» l)
    | none => match «текст» s with
      | some t => some (.«текст» t)
      | none => match «форм» s with
        | some u => some (.«признак» u)
        | none => (fun c => .«сумма» c) <$> «сумма» s

/-- Терм-сумма: выписанный конструктор, вызов, имя. -/
partial def «сумма» (s0 : String) : Option «ТермСм» :=
  let s := «ужать» s0
  match «вариант?» s with
  | some (k, r) =>
    if r = "" then some (.«вариант» k .«нет»)
    else if r.startsWith "с " then do pure (.«вариант» k (← «поля» («разделитьСверху» (r.«сн» 2) "и")))
    else none
  | none =>
    if let some (f, args) := «вызов?» s then do pure (.«вызовСм» f (← «доводы» args))
    else if «имя?» s then some (.«имяСм» s)
    else none

/-- Поля конструктора: `«п» равным Т`. -/
partial def «поля» : List String → Option «Поля»
  | [] => some .«нет»
  | x :: r => match «надвое» x "равным" with
    | some (p, t) => do pure (.«ещё» («голо» p) (← «тело» t) (← «поля» r))
    | none => none

/-- Ветви разбора суммы: `вариант «В» с п как х и … то Ф`; разрез — по первому «то». -/
partial def «случаи» : List String → Option «Случаи»
  | [] => some .«нет»
  | x :: r =>
    match «разделитьСверху» («ужать» x) "то" with
    | «обр» :: «т» :: «ещё» =>
      match «вариант?» («ужать» «обр») with
      | some (k, rr) =>
        let bs? : Option (List (String × String)) :=
          if rr = "" then some []
          else if rr.startsWith "с " then
            («разделитьСверху» (rr.«сн» 2) "и").mapM (fun b => (fun (p, y) => («голо» p, y)) <$> «надвое» b "как")
          else none
        do
          let bs ← bs?
          let u ← «форм» (" то ".intercalate («т» :: «ещё»))
          pure (.«ещё» k bs u (← «случаи» r))
      | none => none
    | _ => none

partial def «доводы» : List String → Option «Доводы»
  | [] => some .«нет»
  | a :: r => do pure (.«ещё» (← «тело» a) (← «доводы» r))

partial def «члены» : List String → Option «Члены»
  | [] => some .«нет»
  | a :: r => do pure (.«ещё» (← «число» a) (← «члены» r))
end

/-- Тело функции по объявленному типу возврата. -/
def «телоПоТипу» («тип» : String) (s : String) : Option «Тело» :=
  let t := «голо» («сжатьПробелы» «тип»)
  if t = "признак" then (fun u => .«признак» u) <$> «форм» s
  else if t = "строка" then (fun u => .«текст» u) <$> «текст» s
  else if t.startsWith "список" then (fun u => .«список» u) <$> «список» s
  else if t = "число" || t = "нат" || t = "натуральное" || t = "неотрицательное" || t = "целое" then
    (fun u => .«число» u) <$> «число» s
  else «тело» s

/-! ## Исходник -/

/-- Строка без хвостового примечания `//` (кавычки уважаются). -/
def «безПримечания» (s : String) : String :=
  let rec «идти» : List Char → Bool → List Char → List Char
    | [], _, acc => acc.reverse
    | '"' :: r, «к», acc => «идти» r (!«к») ('"' :: acc)
    | '/' :: '/' :: _, false, acc => acc.reverse
    | c :: r, «к», acc => «идти» r «к» (c :: acc)
  String.ofList («идти» s.toList false [])

/-- Строка так, как её читает язык. -/
def «какЧитаетЯзык» (s : String) : String :=
  «сжатьПробелы» ((«безПримечания» s).replace "\t" " ")

def «имяФункции» (s : String) : String :=
  let b := «безПримечания» s
  if b.startsWith "функция «" || b.startsWith "тотальная функция «" then
    match (b.splitOn "«")[1]? with
    | some «хв» => («хв».splitOn "»").headD ""
    | none => ""
  else ""

def «натуральноеИмя» (t : String) : Bool :=
  t = "неотрицательное" || t = "нат" || t = "натуральное" || t = "nat" || t = "naturo" || t = "自然数"

/-- Имя типа из объявленного текста: в ёлочках целиком, голым словом — первое слово. -/
def «имяТипа» (s : String) : String :=
  let t := s.«обр»
  if t.startsWith "«" then «голо» ((t.splitOn "»").headD t ++ "»") else (t.splitOn " ").headD ""

/-- Разворот псевдонима `тип «А» это Б` по цепочке (глубина 8). -/
def «основаТипа» («строки» : List String) («имя» : String) : String :=
  let «шаг» := fun («т» : String) =>
    match «строки».find? (fun l => («какЧитаетЯзык» l).«обр».startsWith ("тип «" ++ «т» ++ "» это ")) with
    | some l => «имяТипа» ((«какЧитаетЯзык» l).«обр».«сн» ("тип «" ++ «т» ++ "» это ").length)
    | none => «т»
  (List.range 8).foldl (fun «т» _ => «шаг» «т») «имя»

def «доводСтроки» («строки» : List String) («кусок» : String) : Option «Довод» :=
  match «кусок».splitOn ":" with
  | [«и», «т»] =>
    let «имя» := «голо» «и».«обр»
    let «т'» := «основаТипа» «строки» («имяТипа» «т»)
    if «имя» = "" then none else
    some ⟨«имя», «натуральноеИмя» «т'» || «т'» = "вес", «натуральноеИмя» «т'» || «т'» = "сотых" || «т'» = "тысячных"⟩
  | _ => none

def «объявление?» (l : String) : Bool :=
  ["принимает ", "возвращает ", "обеспечивает ", "требует ", "для всех ", "пример «", "дано ",
   "ожидается ", "теорема «", "использует "].any (fun p => l.startsWith p)

/-- Функция исходника по имени: строки от заголовка до следующего заголовка, тело. -/
def «функция» («строки» : List String) («чья» : String) : Option «Функция» :=
  let «нум» := «строки».zipIdx 1
  match «нум».find? (fun p => «имяФункции» p.1 = «чья») with
  | none => none
  | some (_, a) =>
    let «после» := «нум».filter (fun p => p.2 > a)
    let «своё» := «после».takeWhile (fun p => «имяФункции» p.1 = "")
    -- блок функции по сверщику: до первой строки с левого края
    let «блок» := «своё».takeWhile (fun p =>
      let z := p.1
      z = "" || z.startsWith " " || z.startsWith "\t" || z.startsWith "\r" || z.startsWith "//")
    let «читать» := fun (p : String × Nat) =>
      let l := («какЧитаетЯзык» p.1).«обр»
      if l.startsWith "требует " then
        match (l.splitOn "» ") with
        | _ :: «хв» => match «форм» («терм» ("» ".intercalate «хв»)) with
          | some f => (p.2, «Строка».«требует» f)
          | none => (p.2, «Строка».«иная»)
        | [] => (p.2, «Строка».«иная»)
      else if l.startsWith "принимает " then
        (p.2, «Строка».«принимает» (((l.«сн» 10).splitOn ",").filterMap («доводСтроки» «строки»)))
      else (p.2, «Строка».«иная»)
    let «тип» := match «блок».find? (fun p => («какЧитаетЯзык» p.1).«обр».startsWith "возвращает ") with
      | some p => («какЧитаетЯзык» p.1).«обр».«сн» 11
      | none => ""
    let «телоСтроки» := «блок».filter (fun p =>
      let l := («какЧитаетЯзык» p.1).«обр»
      l ≠ "" && !(«объявление?» l))
    let «тело» := match «телоСтроки».getLast? with
      | some p =>
        if «телоСтроки».length = 1 then
          match «телоПоТипу» «тип» («терм» («какЧитаетЯзык» p.1)) with
          | some t => some (p.2, t)
          | none => none
        else none   -- `пусть` и многострочные тела: сверщик подставляет текстом, здесь — не читается
      | none => none
    some ⟨«чья», «своё».map «читать» ++ [(a, .«иная»)], «тело»⟩

/-- Цель постусловия: хвост строки N после `обеспечивает «имя» `. -/
def «цельСтроки» («строки» : List String) (n : Nat) («имя» : String) : Option «Форм» :=
  match «строки»[n - 1]? with
  | none => none
  | some l =>
    let l' := «какЧитаетЯзык» l
    match l'.splitOn ("обеспечивает «" ++ «имя» ++ "» ") with
    | [_, «хв»] => «форм» («терм» «хв».«обр»)
    | _ => none

/-! ## Запись -/

def «вУголках» (s : String) : String :=
  match (s.splitOn "⟨")[1]? with
  | some «хв» => («хв».splitOn "⟩").headD ""
  | none => ""

def «вЁлочках» (s : String) (n : Nat) : String :=
  match (s.splitOn "«")[n]? with
  | some «хв» => («хв».splitOn "»").headD ""
  | none => ""

/-- Число после ПОСЛЕДНЕЙ метки: имя утверждения само может содержать «строка ». -/
def «числоПосле» (s : String) («метка» : String) : Option Nat :=
  match (s.splitOn «метка»).reverse with
  | «хв» :: _ :: _ => ((«хв».«обр».splitOn " ").headD "").toNat?
  | _ => none

/-- Заглушка формулы шага по правилу ВНЕ приёмки, которую читатель не знает
    (у Ч5 — «к строке»): вызов с именем, которого в языке быть не может. Такой
    шаг приёмка не берёт по имени правила (`«шаг?»` — `none`), и проверка на нём
    останавливается с вердиктом «ВНЕ»; до его формулы не доходит ни одно
    сличение. Шаг по правилу приёмки с непрочтённой формулой — по-прежнему
    «НЕ ПРОЧЁЛ». -/
def «непрочтено» : «Форм» := .«вызовФ» "⟨формула вне приёмки не прочтена⟩" .«нет»

/-- Шаг `вывод N ИМЯ ⟨Ф⟩ ОСНОВАНИЕ`. -/
def «шаг» (l : String) («вне» : Bool := false) : Except String «Шаг» := do
  let «слова» := l.«обр».splitOn " "
  let «номер» ← match («слова»[1]?).bind String.toNat? with
    | some n => pure n | none => throw s!"строка «{l}»: номер шага не число"
  let «правило» := «слова».getD 2 ""
  let «хвост» := (match (l.splitOn "⟩")[1]? with | some x => x.«обр» | none => "")
  let «осн» ← if «хвост» = "сам" then pure «Основание».«сам»
    else if «хвост».startsWith "строка " then
      match («хвост».«сн» 7).«обр».toNat? with
      | some n => pure (.«строка» n) | none => throw s!"строка «{l}»: номер строки не число"
    else if «хвост».startsWith "из " then
      match ((«хвост».«сн» 3).«обр».splitOn " ") with
      | [n] => match n.toNat? with | some n => pure (.«из» n) | none => throw s!"строка «{l}»: основание «из»"
      | [n, "строка", m] => match n.toNat?, m.toNat? with
        | some n, some m => pure (.«изСтрока» n m) | _, _ => throw s!"строка «{l}»: основание «из … строка»"
      | [n, m] => match n.toNat?, m.toNat? with
        | some n, some m => pure (.«из2» n m) | _, _ => throw s!"строка «{l}»: основание «из N M»"
      | [n, m, k] => match n.toNat?, m.toNat?, k.toNat? with
        | some n, some m, some k => pure (.«из3» n m k) | _, _, _ => throw s!"строка «{l}»: основание «из N M K»"
      | _ => throw s!"строка «{l}»: основание «из» разобрано быть не может"
    else throw s!"строка «{l}»: основание не названо"
  let «ф» ← match «форм» («терм» («вУголках» l)) with
    | some f => pure f
    | none =>
      if «вне» || «внеПриёмки» «правило» «осн» then pure «непрочтено»
      else throw s!"строка «{l}»: формула не читается"
  pure ⟨«номер», «правило», «ф», «осн»⟩

/-- Запись, разрезанная на утверждения: заголовок и обрезанные строки под ним. -/
def «собрать» : List String → Option (String × List String) → List (String × List String) →
    List (String × List String)
  | [], «тек», «итог» => match «тек» with | some t => «итог» ++ [t] | none => «итог»
  | l :: r, «тек», «итог» =>
    let «закрыть» := match «тек» with | some t => «итог» ++ [t] | none => «итог»
    if l.startsWith "утверждение «" then «собрать» r (some (l, [])) «закрыть»
    else if l.«обр» = "конец утверждения" then «собрать» r none «закрыть»
    else match «тек» with
      | some (h, b) => «собрать» r (some (h, b ++ [l.«обр»])) «итог»
      | none => «собрать» r none «итог»

def «утвержденияТекстом» («текст» : String) : List (String × List String) :=
  «собрать» («текст».splitOn "\n") none []

/-- Блок утверждения, который сверщик проигрывает: вердикт «доказано», есть
    строки `вывод`, и либо над ним теорема (`сверить_теорему`), либо нет ни
    посылок, ни ходов (`без_теоремы`). -/
def «проигрывается» (b : List String) : Bool :=
  b.any (· = "вердикт доказано") && b.any (·.startsWith "вывод ") &&
  (b.any (·.startsWith "теорема «") || !(b.any (fun l => l.startsWith "посылка " || l.startsWith "ход ")))

/-- Строй блока — как его требует `проиграть_вывод`: «вывод цель» одна и
    первой, «вывод конец» одна и последней, шагов от одного до шестидесяти
    четырёх. Отказ здесь — отказ сверщика в том же месте. -/
def «стройБлока» («строки» : List String) : Except String Unit := do
  unless ((«строки».head?).map (·.startsWith "вывод цель")).getD false do
    throw "шаг стоит до «вывод цель»"
  unless («строки».filter (·.startsWith "вывод цель")).length = 1 do
    throw "строка «вывод цель» стоит дважды"
  unless («строки».filter (· = "вывод конец")).length ≤ 1 do
    throw "строка «вывод конец» стоит дважды"
  unless «строки».getLast? = some "вывод конец" do
    throw "блок вывода не закрыт строкой «вывод конец»"
  unless «строки».length ≥ 3 do throw "в блоке вывода нет ни одного шага"
  unless «строки».length ≤ 66 do
    throw "шагов вывода больше шестидесяти четырёх — столько сверщик не берёт"

/-- Одно утверждение: заголовок, строки под ним, строки исходника. -/
def «утверждение» (h : String) (b : List String) («исходник» : List String) :
    Except String «Утверждение» := do
  let «имя» := «вЁлочках» h 1
  let «чья» := «вЁлочках» h 2
  let n := («числоПосле» h "строка ").getD 0
  let «вердикт» := match b.find? (·.startsWith "вердикт ") with | some l => l.«сн» 8 | none => ""
  let «естьПХ» := b.any (fun l => l.startsWith "посылка " || l.startsWith "ход ")
  let «обяз» := b.filterMap (fun l =>
    if l.startsWith "обязательство вход «" then
      match «форм» («терм» («вУголках» l)), «числоПосле» ((l.splitOn "⟩").getD 1 "") "строка " with
      | some f, some k => some (⟨«вЁлочках» l 1, f, k⟩ : «Обязательство»)
      | _, _ => none
    else none)
  let «выводСтроки» := b.filter (·.startsWith "вывод ")
  let «вывод» ← if «выводСтроки».isEmpty then pure none else do
    «стройБлока» «выводСтроки»
    let «цель» ← match «выводСтроки».find? (·.startsWith "вывод цель") with
      | some l => match «форм» («терм» («вУголках» l)) with
        | some f => pure f
        -- цель-разбор суммы (задача 6432) модель не читает: блок с заглушкой-целью
        -- принят быть не может — цель сличается, лишь когда приняты все шаги
        | none => pure «непрочтено»
      | none => throw "блок без строки «вывод цель»"
    -- после первого шага по правилу вне приёмки прогон не идёт: формулы дальше
    -- нечитаемыми бывают (цель-разбор суммы, 6432) и получают заглушку
    let («шаги», _) ← («выводСтроки».filter (fun l => !(l.startsWith "вывод цель") && l ≠ "вывод конец")).foldlM
      (fun (acc : List «Шаг» × Bool) l => do
        let «ш» ← «шаг» l acc.2
        pure (acc.1 ++ [«ш»], acc.2 || «внеПриёмки» «ш».«правило» «ш».«основание»)) ([], false)
    pure (some ⟨«цель», «шаги»⟩)
  let «ф» ← match «функция» «исходник» «чья» with
    | some f => pure f
    | none => throw s!"функции «{«чья»}» в исходнике нет"
  let «цель» ← match «цельСтроки» «исходник» n «имя» with
    | some c => pure c
    | none => pure «непрочтено»
  pure ⟨«имя», «ф», «цель», «вердикт», «естьПХ», «обяз», «вывод»⟩

/-- Разбор записи: все утверждения; не прочлось одно — не прочлась запись. -/
def «запись» («текст» : String) («исходник» : List String) : Except String «Запись» := do
  let «путь» := match («текст».splitOn "\n").find? (·.startsWith "исходник ") with
    | some l => l.«сн» 9
    | none => ""
  let «утв» ← («утвержденияТекстом» «текст»).mapM fun (h, b) =>
    match «утверждение» h b «исходник» with
    | .ok u => pure u
    | .error e => throw s!"утверждение «{«вЁлочках» h 1}»: {e}"
  pure ⟨«путь», «утв»⟩

/- ПРОБА ЧИТАТЕЛЯ (задача 4058): `[]` и «пустой список» читаются одним термом,
   непустой выписанный список — по-прежнему выписанным, член за членом. -/
#guard «список» "[]" = some .«пустой»
#guard «список» "пустой список" = some .«пустой»
#guard «список» "[1, 2]" = some (.«выписан» (.«ещё» (.«лит» 1) (.«ещё» (.«лит» 2) .«нет»)))

end «Разбор»
