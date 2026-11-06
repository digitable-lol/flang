import Semantics.Symbolic

namespace «Эталон»

open Lean

def «топливоСверки» : Nat := 200000

def «предел перебора» : Nat := 512

def «свидетелей» : Nat := 48

def «шестнадцать» (n : Nat) : String :=
  let d := fun (k : Nat) => String.singleton ("0123456789abcdef".toList[k % 16]!)
  "00" ++ d (n / 16) ++ d n

def «экранJson» (s : String) : String :=
  s.foldl (fun acc c =>
    acc ++ (if c = '"' then "\\\"" else if c = '\\' then "\\\\" else if c = '\n' then "\\n"
      else if c = '\t' then "\\t" else if c = '\r' then "\\r"
      else if c.toNat < 32 || c.toNat = 127 then "\\u" ++ «шестнадцать» c.toNat else String.singleton c)) ""

def «числоМеткой» : «Д64» → String
  | .«кон» true 0 => "-0"
  | d => «строкаЧисла» d

partial def «меткой» : «Зн» → String
  | .«число» d => "{\"n\":\"" ++ «числоМеткой» d ++ "\"}"
  | .«строка» s => "{\"s\":\"" ++ «экранJson» s ++ "\"}"
  | .«признак» b => if b then "true" else "false"
  | .«ничто» => "null"
  | .«список» l => "{\"l\":[" ++ ",".intercalate (l.map «меткой») ++ "]}"
  | .«запись» fs => "{\"r\":[" ++ ",".intercalate (fs.map (fun p =>
      "[\"" ++ «экранJson» p.1 ++ "\"," ++ «меткой» p.2 ++ "]")) ++ "]}"
  | .«вариант» k fs => "{\"v\":\"" ++ «экранJson» k ++ "\",\"f\":[" ++ ",".intercalate (fs.map (fun p =>
      "[\"" ++ «экранJson» p.1 ++ "\"," ++ «меткой» p.2 ++ "]")) ++ "]}"

def «вставитьПоле» (p : String × «Зн») : List (String × «Зн») → List (String × «Зн»)
  | [] => [p]
  | q :: r => if decide (p.1 < q.1) then p :: q :: r else q :: «вставитьПоле» p r

def «поУпорядоченным» (fs : List (String × «Зн»)) : List (String × «Зн») := fs.foldr «вставитьПоле» []

partial def «канон» : «Зн» → «Зн»
  | .«список» l => .«список» (l.map «канон»)
  | .«запись» fs => .«запись» («поУпорядоченным» (fs.map (fun p => (p.1, «канон» p.2))))
  | .«вариант» k fs => .«вариант» k («поУпорядоченным» (fs.map (fun p => (p.1, «канон» p.2))))
  | v => v

partial def «изМетки» : Json → Option «Зн»
  | .null => some .«ничто»
  | .bool b => some (.«признак» b)
  | .obj m =>
    let j := Json.obj m
    match «поле?» j "n", «поле?» j "s", «поле?» j "l", «поле?» j "r", «поле?» j "v" with
    | some (.str t), _, _, _, _ => («читатьЧисло» t).map .«число»
    | _, some (.str s), _, _, _ => some (.«строка» s)
    | _, _, some (.arr a), _, _ => (a.toList.mapM «изМетки»).map .«список»
    | _, _, _, some (.arr a), _ => («поляМетки» a.toList).map .«запись»
    | _, _, _, _, some (.str k) =>
      match «поле?» j "f" with
      | some (.arr a) => («поляМетки» a.toList).map (.«вариант» k)
      | _ => none
    | _, _, _, _, _ => none
  | _ => none
where
  «поляМетки» (a : List Json) : Option (List (String × «Зн»)) :=
    a.mapM (fun p => match p with
      | .arr q =>
        match q.toList with
        | [.str k, v] => («изМетки» v).map (fun w => (k, w))
        | _ => none
      | _ => none)

def «ответТекстом» (j : Json) : String :=
  match «поле?» j "ok" with
  | some (.bool true) =>
    match «изМетки» ((«поле?» j "value").getD .null) with
    | some v => "значение " ++ «меткой» («канон» v)
    | none => "нечитаемо"
  | some (.bool false) =>
    let k := «строка?» j "code"
    if k = "FLANG_RECURSION_LIMIT" || k = "FLANG_MEMORY" then "предел " ++ k else "отказ " ++ k
  | _ => "нечитаемо"

inductive «Тип» where
  | «число»
  | «нат»
  | «целое»
  | «признак»
  | «строка»
  | «список» (t : «Тип»)
  | «запись» (n : String) (fs : List (String × «Тип»))
  | «сумма» (n : String) (vs : List (String × List (String × «Тип»)))
  | «ссылка» (n : String)
  | «функция» (ps : List «Тип») (r : «Тип»)
  | «вне» (why : String)
deriving Inhabited

def «натИмена» : List String := ["неотрицательное", "нат", "натуральное", "nat", "naturo", "自然数"]

def «целыеИмена» : List String := ["целое", "integer", "entjero", "整数"]

def «числаИмена» : List String := ["число", "Число", "number"]

partial def «типJson» (j : Json) : «Тип» :=
  match «строка?» j "kind" with
  | "number" => .«число»
  | "flag" => .«признак»
  | "string" => .«строка»
  | "list" => .«список» («типJson» ((«поле?» j "of").getD .null))
  | "named" =>
    let n := «строка?» j "name"
    if «натИмена».contains n then .«нат»
    else if «целыеИмена».contains n then .«целое»
    else if «числаИмена».contains n then .«число»
    else .«ссылка» n
  | "fn" => .«функция» ((«массив» j "params").map «типJson») («типJson» ((«поле?» j "returns").getD .null))
  | k => .«вне» ("вид типа " ++ k)

def «объявленияТипов» (j : Json) : List (String × Json) :=
  («массив» j "types").map (fun t => («строка?» t "name", t))

def «поляТипа» (fs : List Json) : List (String × «Тип») :=
  fs.map (fun f => («строка?» f "name", «типJson» ((«поле?» f "type").getD .null)))

def «раскрыть» (decls : List (String × Json)) (n : String) : «Тип» :=
  match «найти» n decls with
  | none => .«вне» ("тип «" ++ n ++ "» не описан деревом")
  | some t =>
    match «строка?» t "kind" with
    | "record" => .«запись» n («поляТипа» («массив» t "fields"))
    | "sum" => .«сумма» n ((«массив» t "variants").map (fun v =>
        («строка?» v "name", «поляТипа» («массив» v "fields"))))
    | "param" => .«число»
    | k => .«вне» ("объявление вида " ++ k)

def «образцыЧисла» : List «Зн» :=
  ["0", "1", "-1", "2", "0.5", "-2.5", "3", "10", "100", "-7", "0.1", "1e15", "9007199254740992", "1e308",
    "-1e308", "5e-324", "-0", "123456.789", "1e-7", "7"].filterMap (fun t => («читатьЧисло» t).map .«число»)

def «образцыНат» : List «Зн» :=
  ["0", "1", "2", "3", "5", "7", "10", "100", "1000", "9007199254740991"].filterMap
    (fun t => («читатьЧисло» t).map .«число»)

def «образцыЦелого» : List «Зн» :=
  ["0", "1", "-1", "2", "-2", "7", "-100", "1000"].filterMap (fun t => («читатьЧисло» t).map .«число»)

def «образцыСтроки» : List «Зн» := ["", "a", "ab", "Привет", "1 2"].map .«строка»

def «вразброс» {α : Type} [Inhabited α] (columns : List (List α)) (n : Nat) : List (List α) :=
  (List.range n).map (fun i => (columns.zipIdx).map (fun (c, j) =>
    if c.isEmpty then default else c[(i * (2 * j + 1) + j) % c.length]!))

def «все наборы» {α : Type} : List (List α) → List (List α)
  | [] => [[]]
  | c :: r => c.flatMap (fun x => («все наборы» r).map (fun t => x :: t))

structure «Образцы» where
  «значения» : List «Зн»
  «конечно» : Bool
  «вне» : List String
deriving Inhabited

def «соединитьОбразцы» (rows : List «Образцы») (build : List «Зн» → «Зн») : «Образцы» :=
  let finite := rows.all (·.«конечно»)
  let cols := rows.map (·.«значения»)
  let size := cols.foldl (fun n c => n * c.length) 1
  let sets := if finite && size ≤ «предел перебора» then «все наборы» cols
    else if cols.any (·.isEmpty) then [] else «вразброс» cols 6
  { «значения» := sets.map build
    «конечно» := finite && size ≤ «предел перебора»
    «вне» := rows.flatMap (·.«вне») }

partial def «конечен?» (decls : List (String × Json)) (seen : List String) : «Тип» → Bool
  | .«признак» => true
  | .«ссылка» n => !seen.contains n && «конечен?» decls (n :: seen) («раскрыть» decls n)
  | .«запись» _ fs => fs.all (fun f => «конечен?» decls seen f.2)
  | .«сумма» _ vs => vs.all (fun v => v.2.all (fun f => «конечен?» decls seen f.2))
  | _ => false

def «родТипа» : «Тип» → String
  | .«число» => "число"
  | .«нат» => "число"
  | .«целое» => "число"
  | .«признак» => "признак"
  | .«строка» => "строка"
  | .«список» _ => "список"
  | .«функция» _ _ => "функция"
  | _ => ""

def «совместимы» (a b : «Тип») : Bool :=
  «родТипа» a = "" || «родТипа» b = "" || «родТипа» a = «родТипа» b

partial def «образцы» (fns : List (String × List «Тип» × «Тип»)) (decls : List (String × Json)) (seen : List String)
    (depth : Nat) : «Тип» → «Образцы»
  | .«число» => ⟨«образцыЧисла», false, []⟩
  | .«нат» => ⟨«образцыНат», false, []⟩
  | .«целое» => ⟨«образцыЦелого», false, []⟩
  | .«признак» => ⟨[.«признак» false, .«признак» true], true, []⟩
  | .«строка» => ⟨«образцыСтроки», false, []⟩
  | .«вне» why => ⟨[], false, [why]⟩
  | .«функция» ps r =>
    let fits := fns.filter (fun (_, gps, gr) =>
      gps.length = ps.length && (gps.zip ps).all (fun (a, b) => «совместимы» a b) && «совместимы» gr r)
    if fits.isEmpty then ⟨[], false, ["значение-функция без подходящих функций модуля"]⟩
    else ⟨fits.map (fun (g, _, _) => .«вариант» g []), false, []⟩
  | .«список» t =>
    let inner := «образцы» fns decls seen (depth - 1) t
    let vs := inner.«значения»
    let lists := if vs.isEmpty then [[]] else [[], [vs[0]!], (vs.drop 1).take 2, (vs.drop 3).take 3]
    ⟨lists.map .«список», false, inner.«вне»⟩
  | .«ссылка» n =>
    if seen.contains n && depth = 0 then ⟨[], false, []⟩
    else
      let inner := «образцы» fns decls (n :: seen) (if seen.contains n then depth - 1 else depth) («раскрыть» decls n)
      { inner with «конечно» := «конечен?» decls seen (.«ссылка» n) }
  | .«запись» _ fs =>
    let rows := fs.map (fun f => «образцы» fns decls seen depth f.2)
    «соединитьОбразцы» rows (fun vs => .«запись» ((fs.map (·.1)).zip vs))
  | .«сумма» _ vs =>
    let parts : List «Образцы» := vs.map (fun v =>
      if v.2.isEmpty then ⟨[.«вариант» v.1 []], true, []⟩
      else «соединитьОбразцы» (v.2.map (fun f => «образцы» fns decls seen depth f.2))
        (fun ws => .«вариант» v.1 ((v.2.map (·.1)).zip ws)))
    ⟨parts.flatMap (·.«значения»), parts.all (·.«конечно»), parts.flatMap (·.«вне»)⟩

structure «Предусловие» where
  «код» : String
  «выражение» : «Выр»

def «предусловияJson» (f : Json) : List «Предусловие» :=
  («массив» f "preconditions").map (fun q =>
    { «код» := («имя?» q "code").getD "FLANG_PRECONDITION"
      «выражение» := «вырJson» ((«поле?» q "expr").getD .null) })

def «проверитьПред» (P : «Программа») (ρ : «Среда») : List «Предусловие» → Option «Исход»
  | [] => none
  | q :: r =>
    match «выч» P «топливоСверки» ρ q.«выражение» with
    | .ok (.«признак» true) => «проверитьПред» P ρ r
    | .ok (.«признак» false) => some («беда» q.«код»)
    | .ok _ => some («беда» "FLANG_TYPE")
    | .error e => some (.error e)

def «эталонТекстом» : «Исход» → String
  | .ok v => "значение " ++ «меткой» («канон» v)
  | .error (.«беда» k) => "отказ " ++ k
  | .error .«топливо» => "топливо"
  | .error (.«вне» k) => "вне " ++ k

def «ответЭталона» (P : «Программа») (pre : List «Предусловие») (g : «Функция») (vs : List «Зн») : String :=
  let ρ := «привязать» g.«параметры» vs
  match «проверитьПред» P ρ pre with
  | some r => «эталонТекстом» r
  | none => «эталонТекстом» («выч» P «топливоСверки» [] (.«вызов» g.«имя» (vs.map .«лит»)))

def «запрос» (f : String) (vs : List «Зн») : String :=
  "{\"fn\":\"" ++ «экранJson» f ++ "\",\"args\":[" ++ ",".intercalate (vs.map «меткой») ++ "]}"

def «наборыПримеров» (f : Json) (params : List String) : List (List «Зн») :=
  («массив» f "examples").filterMap (fun e =>
    let args := «пары» e "args"
    params.mapM (fun p => («найти» p args).map «значениеJson»))

def «безПовторов» (xs : List (List «Зн»)) : List (List «Зн») :=
  xs.foldl (fun acc x => if acc.any (fun y => «меткой» («канон» (.«список» y)) == «меткой» («канон» (.«список» x)))
    then acc else acc ++ [x]) []

def «параметрыТипа» (f : Json) : List (String × Json) :=
  («массив» f "typeParams").filterMap (fun t => match t with
    | .str n => some (n, Json.mkObj [("kind", .str "param")])
    | _ => none)

structure «КонтекстC» where
  «функции» : List «ФункцияC»
  «имена» : List (String × String)
  «тексты» : List (String × «Т»)
  «доказанные» : List (String × String)
  «есть» : Bool
  «применения» : List (String × List String)
  «судимые» : List (String × String)

def «числовойТип?» : «Тип» → Bool
  | .«число» => true
  | .«нат» => true
  | .«целое» => true
  | _ => false

def «числовыеПоля» (fs : List (String × «Тип»)) : List String :=
  fs.filterMap (fun (f, t) => if «числовойТип?» t then some f else none)

def «числовыеИмена» (decls : List (String × Json)) (x : String) : «Тип» → List String
  | .«список» (.«список» (.«список» t)) => if «числовойТип?» t then ["[][][]" ++ x] else []
  | .«список» (.«список» t) => if «числовойТип?» t then ["[][]" ++ x] else []
  | .«список» t => if «числовойТип?» t then ["[]" ++ x] else []
  | .«ссылка» n =>
    match «раскрыть» decls n with
    | .«запись» _ fs => («числовыеПоля» fs).map (fun f => x ++ "." ++ f)
    | .«сумма» _ vs =>
      let all := vs.flatMap (·.2)
      let names := (all.map (·.1)).eraseDups
      (names.filter (fun f => all.all (fun (g, t) => g ≠ f || «числовойТип?» t))).map (fun f => x ++ "." ++ f)
    | _ => []
  | t => if «числовойТип?» t then [x] else []

def «предел ветвлений» : Nat := 32

partial def «ветвления» : «Выр» → Nat
  | .«если» c t e => 1 + «ветвления» c + «ветвления» t + «ветвления» e
  | .«разбор» t cs => cs.length + «ветвления» t + (cs.map (fun c => «ветвления» c.2)).foldl (· + ·) 0
  | .«двучлен» _ a b => «ветвления» a + «ветвления» b
  | .«пусть» _ v b => «ветвления» v + «ветвления» b
  | .«вызов» _ args => (args.map «ветвления»).foldl (· + ·) 0
  | .«поле» t _ => «ветвления» t
  | _ => 0

partial def «границы» : «Выр» → List «Д64»
  | .«двучлен» op a b =>
    let here := if ["lt", "lte", "gt", "gte", "eq", "neq"].contains op then
      (match a, b with
       | .«лит» (.«число» d), _ => [d]
       | _, .«лит» (.«число» d) => [d]
       | _, _ => [])
      else []
    here ++ «границы» a ++ «границы» b
  | .«если» c t e => «границы» c ++ «границы» t ++ «границы» e
  | .«пусть» _ v b => «границы» v ++ «границы» b
  | .«вызов» _ args => args.flatMap «границы»
  | _ => []

def «конечное?» : «Д64» → Bool
  | .«кон» _ _ => true
  | _ => false

def «соседи» (d : «Д64») : List «Д64» :=
  let b := «вБиты» d
  let up := «изБит» (b + 1)
  let down := if b = 0 then «изБит» (9223372036854775808 + 1) else «изБит» (b - 1)
  ([d, up, down].filter «конечное?»)

def «целое?» (d : «Д64») : Bool :=
  match «целое64?» d with
  | some _ => true
  | none => false

def «годноДля» (t : «Тип») (d : «Д64») : Bool :=
  match t with
  | .«число» => «конечное?» d
  | .«нат» => «целое?» d && !(«знак64» d) && «меньше64» d («изЦелого» 9007199254740992)
  | .«целое» => «целое?» d
  | _ => false

def «наборыГраниц» (types : List «Тип») (base : List «Зн») (ds : List «Д64») : List (List «Зн») :=
  (types.zipIdx).flatMap (fun (t, j) =>
    if «числовойТип?» t then
      (ds.filter («годноДля» t)).map (fun d => (base.zipIdx).map (fun (v, i) => if i = j then .«число» d else v))
    else [])

partial def «блокДвери» (name : String) : List «Лекс» → Option (List «Лекс»)
  | .«слово» "if" :: .«знак» "(" :: .«слово» "strcmp" :: .«знак» "(" :: .«слово» "name" :: .«знак» "," ::
      .«строка» n :: .«знак» ")" :: .«знак» "==" :: .«число» "0" :: .«знак» ")" :: .«знак» "{" :: r =>
    match «доПары» "{" "}" 0 r [] with
    | some (block, rest) => if n = name then some block else «блокДвери» name rest
    | none => none
  | _ :: r => «блокДвери» name r
  | [] => none

def «безСчёта» (ls : List «Лекс») : List «Лекс» :=
  match ls with
  | .«слово» "if" :: .«знак» "(" :: .«слово» "count" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | some (_, .«знак» "{" :: q) =>
      match «доПары» "{" "}" 0 q [] with
      | some (_, rest) => rest
      | none => ls
    | _ => ls
  | _ => ls

partial def «последнийВызов» (ids : List String) : List «Лекс» → Option String → Option String
  | .«слово» "return" :: .«слово» f :: .«знак» "(" :: r, best =>
    «последнийВызов» ids r (if ids.contains f then some f else best)
  | _ :: r, best => «последнийВызов» ids r best
  | [], best => best

partial def «строкиПодряд» : List «Лекс» → List String × List «Лекс»
  | .«строка» v :: r =>
    let (more, rest) := «строкиПодряд» r
    (v :: more, rest)
  | r => ([], r)

partial def «именаПолейC» : List «Лекс» → List (String × «Т»)
  | .«слово» "static" :: .«слово» "const" :: .«слово» "char" :: .«знак» "*" :: .«слово» "const" :: .«слово» x ::
      .«знак» "[" :: .«знак» "]" :: .«знак» "=" :: .«знак» "{" :: r =>
    match «доПары» "{" "}" 0 r [] with
    | some (inner, q) =>
      let ns := («разрезать» inner).filterMap (fun p => match p with
        | [.«строка» v] => some («Т».«с» («разэкранить» v))
        | _ => none)
      if ns.length = («разрезать» inner).length then (x, .«оп» "fields" ns) :: «именаПолейC» q else «именаПолейC» q
    | none => []
  | _ :: r => «именаПолейC» r
  | [] => []

partial def «текстыC» : List «Лекс» → List (String × «Т»)
  | .«слово» "static" :: .«слово» "const" :: .«слово» "fl_value" :: .«слово» x :: .«знак» "=" :: .«знак» "{" ::
      .«слово» "FL_STRING" :: .«знак» "," :: .«знак» "{" :: .«знак» "." :: .«слово» "string" :: .«знак» "=" ::
      .«знак» "{" :: r =>
    let (parts, rest) := «строкиПодряд» r
    let v := «разэкранить» (String.join parts)
    match rest with
    | .«знак» "," :: .«число» nb :: .«знак» "," :: .«число» nc :: q =>
      if nb.toNat? = some v.utf8ByteSize && nc.toNat? = some v.length then (x, .«с» v) :: «текстыC» q
      else (x, .«оп» "строка с неверной длиной" []) :: «текстыC» q
    | q => «текстыC» q
  | _ :: r => «текстыC» r
  | [] => []

def «конструкторыC» (fs : List «ФункцияC») : List (String × String) :=
  fs.filterMap (fun f => match f.«тело» with
    | [.«слово» "return", .«слово» "fl_variant_new", .«знак» "(", .«слово» "ctx", .«знак» ",", .«строка» v,
        .«знак» ",", .«слово» "NULL", .«знак» ",", .«слово» "NULL", .«знак» ",", .«число» "0", .«знак» ",",
        .«слово» "out", .«знак» ",", .«слово» "error", .«знак» ")", .«знак» ";"] =>
      some (f.«имя», "variant:" ++ «разэкранить» v)
    | _ => none)

partial def «телоОбёртки» (fs : List «ФункцияC») (f : «ФункцияC») : «ФункцияC» :=
  match f.«тело» with
  | .«слово» "FL_TRY" :: .«знак» "(" :: .«слово» "fl_enter" :: r =>
    let rec find : List «Лекс» → Option String
      | .«слово» "status" :: .«знак» "=" :: .«слово» b :: .«знак» "(" :: _ => some b
      | _ :: q => find q
      | [] => none
    match find r with
    | some b => (fs.find? (fun g => g.«имя» = b)).getD f
    | none => f
  | _ => f

def «дверьФункции» (fs : List «ФункцияC») (n : String) : Option (List «Лекс») :=
  (fs.filter (fun f => f.«имя».endsWith "_call")).findSome? (fun d => «блокДвери» n d.«тело»)

def «именаC» (fs : List «ФункцияC») (names : List String) : List (String × String) :=
  names.filterMap (fun n =>
    match «дверьФункции» fs n with
    | some block => («последнийВызов» (fs.map (·.«имя»)) block none).map (fun c => (c, n))
    | none => none)

partial def «ветвиПрименения» (names : List (String × String)) (teg : String) (args : List String) :
    List «Лекс» → Option (List String)
  | .«слово» "if" :: .«знак» "(" :: .«слово» "fl_variant_is" :: .«знак» "(" :: .«слово» t :: .«знак» "," ::
      .«строка» tag :: .«знак» ")" :: .«знак» ")" :: .«знак» "{" :: .«слово» "return" :: .«слово» c :: .«знак» "(" ::
      .«слово» "ctx" :: r =>
    let want := (args.flatMap (fun a => [«Лекс».«знак» ",", .«слово» a])) ++
      [.«знак» ",", .«слово» "result", .«знак» ",", .«слово» "error", .«знак» ")", .«знак» ";", .«знак» "}",
        .«слово» "else"]
    let tagName := «разэкранить» tag
    if t ≠ teg || «найти» c names ≠ some tagName || !(r.take want.length == want) then none
    else match «ветвиПрименения» names teg args (r.drop want.length) with
      | some rest => some (tagName :: rest)
      | none => none
  | [.«знак» "{", .«слово» "return", .«слово» "fl_match_fail", .«знак» "(", .«слово» "ctx", .«знак» ",", .«слово» t,
      .«знак» ",", .«слово» "error", .«знак» ")", .«знак» ";", .«знак» "}"] => if t = teg then some [] else none
  | _ => none

def «применения» (fs : List «ФункцияC») (names : List (String × String)) : List (String × String × List String) :=
  fs.filterMap (fun f =>
    match f.«параметры» with
    | teg :: args =>
      if args.isEmpty then none else
      match «ветвиПрименения» names teg args f.«тело» with
      | some tags => if tags.isEmpty then none else some (f.«имя», "apply:" ++ toString args.length, tags)
      | none => none
    | [] => none)

partial def «постыC» : List «Лекс» → List String
  | .«слово» "fl_post" :: .«знак» "(" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | some (inner, rest) =>
      match («разрезать» inner)[2]? with
      | some [«Лекс».«строка» n] => n :: «постыC» rest
      | _ => «постыC» rest
    | none => []
  | _ :: r => «постыC» r
  | [] => []

partial def «вставитьТело» (f : String) (body : List «Т» → Nat → Except String «Д») : «Д» → Except String «Д»
  | .«вызов» g ts k (.«знач» (.«рез» m)) =>
    if g = f && k = m then body ts k else pure (.«вызов» g ts k (.«знач» (.«рез» m)))
  | .«вызов» g ts k r => do
    let r2 ← «вставитьТело» f body r
    pure (.«вызов» g ts k r2)
  | .«если» c a b => do
    let a2 ← «вставитьТело» f body a
    let b2 ← «вставитьТело» f body b
    pure (.«если» c a2 b2)
  | .«обход» w l i a x st k r => do
    let st2 ← «вставитьТело» f body st
    let r2 ← «вставитьТело» f body r
    pure (.«обход» w l i a x st2 k r2)
  | d => pure d

def «деревоC» (cx : «КонтекстC») (decls : List (String × Json)) (numeric : List String) (name : String)
    (types : List «Тип») : Except String «Д» := do
  let block ← match «дверьФункции» cx.«функции» name with
    | some b => pure b
    | none => .error "функции нет в двери _call"
  let cid ← match cx.«имена».find? (fun p => p.2 = name) with
    | some p => pure p.1
    | none => .error "нет имени C"
  let fc ← match cx.«функции».find? (fun f => f.«имя» = cid) with
    | some f => pure («телоОбёртки» cx.«функции» f)
    | none => .error "нет функции C"
  let slots := (types.zipIdx).map (fun (_, i) => "args[" ++ toString i ++ "]")
  let named := (types.zipIdx).flatMap (fun (t, i) => «числовыеИмена» decls ("#" ++ toString i) t)
  let nums := (slots.zip types).flatMap (fun (s, t) => «числовыеИмена» decls s t) ++ named
  let start := slots.zipIdx.map (fun (s, i) => (s, «Т».«имя» ("#" ++ toString i))) ++ cx.«тексты»
  let σ0 : «СредаC» := { «знач» := start, «числа» := nums, «функции» := cx.«имена», «числовые» := numeric, «тела» := cx.«функции» }
  let d ← «исполнить» σ0 0 («безСчёта» block)
  «вставитьТело» name (fun ts k =>
    let cn := (fc.«параметры».zip types).flatMap (fun (c, t) => «числовыеИмена» decls c t) ++ named
    let vals1 := fc.«параметры».zip ts ++ cx.«тексты»
    let loop := if («постыC» fc.«тело»).isEmpty then some (name, fc.«параметры») else none
    let σ0b : «СредаC» := { «знач» := vals1, «числа» := cn, «функции» := cx.«имена», «числовые» := numeric, «тела» := cx.«функции» }
    let σ1 : «СредаC» := { σ0b with «петля» := loop }
    «исполнить» σ1 k fc.«тело») d

def «постыБезСуда» (cx : «КонтекстC») (f : Json) (g : «Функция») : Nat :=
  let cid := (cx.«имена».find? (fun p => p.2 = g.«имя»)).map (·.1)
  let inC := match cid with
    | some c => match cx.«функции».find? (fun (h : «ФункцияC») => h.«имя» = c) with
      | some h => «постыC» («телоОбёртки» cx.«функции» h).«тело»
      | none => []
    | none => []
  ((«условияJson» f "postconditions" "FLANG_PROPERTY").filter (fun q =>
    !(inC.contains q.«имя») && !(cx.«судимые».contains (g.«имя», q.«имя»)))).length

def «постыНаСловеЯдра» (cx : «КонтекстC») (f : Json) (g : «Функция») : Nat :=
  let cid := (cx.«имена».find? (fun p => p.2 = g.«имя»)).map (·.1)
  let inC := match cid with
    | some c => match cx.«функции».find? (fun (h : «ФункцияC») => h.«имя» = c) with
      | some h => «постыC» («телоОбёртки» cx.«функции» h).«тело»
      | none => []
    | none => []
  ((«условияJson» f "postconditions" "FLANG_PROPERTY").filter (fun q =>
    !(inC.contains q.«имя») && cx.«доказанные».contains (g.«имя», q.«имя»))).length

def «деревоЭталона» (P : «Программа») (cx : «КонтекстC») (f : Json) (g : «Функция») : «Сим» :=
  let cid := (cx.«имена».find? (fun p => p.2 = g.«имя»)).map (·.1)
  let inC := match cid with
    | some c => match cx.«функции».find? (fun (h : «ФункцияC») => h.«имя» = c) with
      | some h => «постыC» («телоОбёртки» cx.«функции» h).«тело»
      | none => []
    | none => []
  let posts := («условияJson» f "postconditions" "FLANG_PROPERTY").filter (fun q =>
    inC.contains q.«имя» || !(cx.«доказанные».contains (g.«имя», q.«имя»)))
  let pres := «условияJson» f "preconditions" "FLANG_PRECONDITION"
  let ρ := (g.«параметры».zipIdx).map (fun (p, i) => (p, «Т».«имя» ("#" ++ toString i)))
  «симДо» P ρ pres 0 (fun n => «сим» P ρ n g.«тело» (fun t n1 => «симПосле» P ρ posts t n1))

partial def «значТ» (vals : List (String × «Зн»)) (res : List (Nat × «Зн»)) : «Т» → «Исход»
  | .«ч» d => .ok (.«число» d)
  | .«п» b => .ok (.«признак» b)
  | .«с» v => .ok (.«строка» v)
  | .«имя» x => match «найти» x vals with
    | some v => .ok v
    | none => «беда» "FLANG_NAME"
  | .«рез» k => match (res.find? (fun p => p.1 = k)).map (·.2) with
    | some v => .ok v
    | none => «беда» "FLANG_NAME"
  | .«оп» "ничто" [] => .ok .«ничто»
  | .«оп» "list" ts => do
    let vs ← ts.mapM («значТ» vals res)
    pure (.«список» vs)
  | .«оп» "make-variant" (.«с» v :: .«оп» "fields" ns :: ts) => do
    let vs ← ts.mapM («значТ» vals res)
    let names := ns.filterMap (fun t => match t with | .«с» x => some x | _ => none)
    if names.length ≠ ns.length || names.length ≠ vs.length then «беда» "FLANG_TYPE"
    else pure (.«вариант» v (names.zip vs))
  | .«оп» "make-record" (.«оп» "fields" ns :: ts) => do
    let vs ← ts.mapM («значТ» vals res)
    let names := ns.filterMap (fun t => match t with | .«с» x => some x | _ => none)
    if names.length ≠ ns.length || names.length ≠ vs.length then «беда» "FLANG_TYPE"
    else pure (.«запись» (names.zip vs))
  | .«оп» o [] =>
    if o.startsWith "variant:" then .ok (.«вариант» (o.drop 8).toString []) else «беда» "FLANG_TYPE"
  | .«оп» o [a] =>
    if o.startsWith "is:" then do
      let x ← «значТ» vals res a
      match x with
      | .«вариант» k _ => pure (.«признак» (k = (o.drop 3).toString))
      | _ => «беда» "FLANG_TYPE"
    else if o.startsWith "field:" then do
      let x ← «значТ» vals res a
      let f := (o.drop 6).toString
      match x with
      | .«вариант» _ fs => match «найти» f fs with
        | some v => pure v
        | none => «беда» "FLANG_FIELD"
      | .«запись» fs => match «найти» f fs with
        | some v => pure v
        | none => «беда» "FLANG_FIELD"
      | _ => «беда» "FLANG_FIELD"
    else if o = "empty?" || o = "cons?" || o = "head" || o = "tail" then do
      let x ← «значТ» vals res a
      let part := fun (r : Option «Среда») => match r with
        | some e => «найти» o e
        | none => none
      match o, «подходит» .«пусто» x, «подходит» (.«звено» (some "head") (some "tail")) x with
      | "empty?", .ok r, _ => pure (.«признак» r.isSome)
      | "cons?", _, .ok r => pure (.«признак» r.isSome)
      | _, _, .ok r => match part r with
        | some v => pure v
        | none => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"
      | _, _, .error e => .error e
    else if o = "not" then do
      let x ← «значТ» vals res a
      match x with
      | .«признак» b => pure (.«признак» (!b))
      | _ => «беда» "FLANG_TYPE"
    else «беда» "FLANG_TYPE"
  | .«оп» o [a, b] => do
    let x ← «значТ» vals res a
    let y ← «значТ» vals res b
    match o, x, y with
    | "and", .«признак» p, .«признак» q => pure (.«признак» (p && q))
    | "or", .«признак» p, .«признак» q => pure (.«признак» (p || q))
    | "eq64", .«число» p, .«число» q => pure (.«признак» («неБольше64» p q && «неБольше64» q p))
    | "ne64", .«число» p, .«число» q => pure (.«признак» (!(«неБольше64» p q && «неБольше64» q p)))
    | _, _, _ => «двучлен» o x y
  | .«оп» _ _ => «беда» "FLANG_TYPE"

partial def «вычД» (P : «Программа») (vals : List (String × «Зн»)) (res : List (Nat × «Зн»)) : «Д» → «Исход»
  | .«знач» t => «значТ» vals res t
  | .«отказ» k => «беда» k
  | .«если» c a b => do
    let v ← «значТ» vals res c
    match v with
    | .«признак» true => «вычД» P vals res a
    | .«признак» false => «вычД» P vals res b
    | _ => «беда» "FLANG_TYPE"
  | .«вызов» f ts k r => do
    let vs ← ts.mapM («значТ» vals res)
    let v ← if f.startsWith "form:" then «форма» (f.drop 5).toString vs
      else if f.startsWith "apply:" then match vs with
        | fv :: args => «выч» P «топливоСверки» [] (.«применить» (.«лит» fv) (args.map .«лит»))
        | [] => «беда» "FLANG_ARITY"
      else «выч» P «топливоСверки» [] (.«вызов» f (vs.map .«лит»))
    «вычД» P vals ((k, v) :: res) r
  | .«обход» "свёртка" l i a x st k r => do
    let lv ← «значТ» vals res l
    let iv ← «значТ» vals res i
    match lv with
    | .«список» xs => do
      let acc ← xs.foldlM (fun acc v => «вычД» P ((a, acc) :: (x, v) :: vals) res st) iv
      «вычД» P vals ((k, acc) :: res) r
    | _ => «беда» "FLANG_TYPE"
  | .«обход» "отбор" l _ _ x st k r => do
    let lv ← «значТ» vals res l
    match lv with
    | .«список» xs => do
      let kept ← xs.foldlM (fun acc v => do
        let c ← «вычД» P ((x, v) :: vals) res st
        match c with
        | .«признак» true => pure (acc ++ [v])
        | .«признак» false => pure acc
        | _ => «беда» "FLANG_TYPE") []
      «вычД» P vals ((k, .«список» kept) :: res) r
    | _ => «беда» "FLANG_TYPE"
  | .«обход» "отображение" l _ _ x st k r => do
    let lv ← «значТ» vals res l
    match lv with
    | .«список» xs => do
      let ys ← xs.mapM (fun v => «вычД» P ((x, v) :: vals) res st)
      «вычД» P vals ((k, .«список» ys) :: res) r
    | _ => «беда» "FLANG_TYPE"
  | .«обход» _ _ _ _ _ _ _ _ => «беда» "FLANG_TYPE"

def «символьно» (P : «Программа») (cx : «КонтекстC») (decls : List (String × Json)) (numeric : List String) (f : Json)
    (g : «Функция»)
    (types : List «Тип») (witnesses : List (List «Зн»)) (answers : List String) : String × String :=
  let forks := «ветвления» g.«тело» + ((«условияJson» f "preconditions" "") ++ («условияJson» f "postconditions" "")).foldl
    (fun n q => n + 1 + «ветвления» q.«выражение») 0
  if !cx.«есть» then ("вне: нет напечатанного C", "") else
  if forks > «предел ветвлений» then ("вне: ветвлений больше предела", "") else
  if «постыБезСуда» cx f g > 0 then ("вне: постусловие не напечатано, а вердикта ядра о нём нет", "") else
  match «деревоЭталона» P cx f g with
  | .error m => ("вне: " ++ m, "")
  | .ok r =>
    let vals := fun (vs : List «Зн») => (vs.zipIdx).map (fun (v, i) => ("#" ++ toString i, v))
    let checked := (witnesses.zip answers).filter (fun (_, a) => !(a.startsWith "топливо") && !(a.startsWith "вне"))
    let bad := checked.filter (fun (vs, a) => «эталонТекстом» («вычД» P (vals vs) [] r) ≠ a)
    if checked.isEmpty then ("вне: у эталона нет ни одного ответа, чтобы сверить с ним дерево", "") else
    if !bad.isEmpty then ("вне: символьное дерево эталона разошлось с вычислением на свидетеле", "")
    else
      match «деревоC» cx decls numeric g.«имя» types with
      | .error m => ("вне: C " ++ m, "")
      | .ok c =>
        let kernel := «постыНаСловеЯдра» cx f g
        let word := if kernel = 0 then "доказано" else "доказано, постусловий на слове ядра " ++ toString kernel
        let expand := fun (x : String) => if x.startsWith "apply:" then
          (cx.«применения».filter (fun p => p.1 = x)).flatMap (·.2) else [x]
        let called := (((«вызовыД» r) ++ («вызовыД» c)).flatMap expand).eraseDups.filter (· ≠ g.«имя»)
        if «равныД» («упростить» [] («сжатьВызовы» [] r)) («упростить» [] («сжатьВызовы» [] c)) then
          (word, ",".intercalate called)
        else ("не сошлось: эталон " ++ «текстД» r ++ " | C " ++ «текстД» c, "")

def «строкиФункции» (P : «Программа») (fns : List (String × List «Тип» × «Тип»)) (common : List (String × Json))
    (cx : «КонтекстC») (numeric : List String) (f : Json) : List String :=
  let decls := «параметрыТипа» f ++ common
  let name := «строка?» f "name"
  let params := («массив» f "params").map (fun p => («строка?» p "name", «типJson» ((«поле?» p "type").getD .null)))
  let ret := «образцы» fns decls [] 2 («типJson» ((«поле?» f "returns").getD .null))
  let rows := params.map (fun p => «образцы» fns decls [] 2 p.2)
  let why := rows.flatMap (·.«вне») ++ ret.«вне»
  match why.head?, «функцияПрограммы» P name with
  | some w, _ => [name ++ "\tвне\t" ++ w ++ "\t"]
  | none, none => [name ++ "\tвне\tфункции нет в эталоне\t"]
  | none, some g =>
    let finite := rows.all (·.«конечно»)
    let cols := rows.map (·.«значения»)
    let size := cols.foldl (fun n c => n * c.length) 1
    let full := finite && size ≤ «предел перебора»
    let sets := if full then «все наборы» cols
      else if cols.any (·.isEmpty) then [] else «вразброс» cols «свидетелей»
    let types := params.map (·.2)
    let conds := («условияJson» f "preconditions" "") ++ («условияJson» f "postconditions" "")
    let edges := ((«границы» g.«тело») ++ conds.flatMap (fun q => «границы» q.«выражение»)).flatMap «соседи»
    let base := cols.map (fun c => c.headD .«ничто»)
    let bounds := if full || cols.any (·.isEmpty) then [] else «наборыГраниц» types base edges
    let all := «безПовторов» («наборыПримеров» f (params.map (·.1)) ++ sets ++ bounds)
    let cls := if params.isEmpty then "без параметров" else if full then "перебор" else "свидетели"
    let pre := «предусловияJson» f
    let answers := all.map («ответЭталона» P pre g)
    let sym := «символьно» P cx decls numeric f g types all answers
    if all.isEmpty then [name ++ "\tвне\tнет ни одного свидетеля\t"]
    else (all.zip answers).map (fun (vs, a) => name ++ "\t" ++ cls ++ "\t" ++ «запрос» name vs ++ "\t" ++ a) ++
      [name ++ "\tсимвол\t" ++ sym.1 ++ "\t" ++ sym.2]

def «доказанныеJson» (j : Json) : List (String × String) :=
  («массив» j "obligations").filterMap (fun o =>
    if «строка?» o "kind" = "postcondition" && «строка?» ((«поле?» o "discharge").getD .null) "verdict" = "доказано"
    then some («строка?» o "of", «строка?» o "name") else none)

def «планФайла» (path : String) (cpath proof : Option String) : IO (List String) := do
  let text ← IO.FS.readFile path
  let ctext ← match cpath with
    | some c => do
      let t ← IO.FS.readFile c
      pure (some t)
    | none => pure none
  let ptext ← match proof with
    | some q => IO.FS.readFile q
    | none => pure ""
  match Json.parse text with
  | .error m => pure ["\tнечитаемо\t" ++ m ++ "\t"]
  | .ok j =>
    let P := «программаJson» j
    let decls := «объявленияТипов» j
    let fs := match ctext with
      | some t => «функцииC» («лексемы» t.toList []) []
      | none => []
    let _ := fs.length
    let proved := match Json.parse ptext with
      | .ok pj => «доказанныеJson» pj
      | .error _ => []
    let judged := match Json.parse ptext with
      | .ok pj => («массив» pj "obligations").filterMap (fun o =>
          if «строка?» o "kind" = "postcondition" then some («строка?» o "of", «строка?» o "name") else none)
      | .error _ => []
    let toks := match ctext with
      | some t => «лексемы» t.toList []
      | none => []
    let names := «именаC» fs (P.map (·.«имя») ) ++ «конструкторыC» fs
    let apps := «применения» fs names
    let cx : «КонтекстC» := ⟨fs, names ++ apps.map (fun (c, a, _) => (c, a)), «текстыC» toks ++ «именаПолейC» toks, proved,
      ctext.isSome, apps.map (fun (_, a, ts) => (a, ts)), judged⟩
    let numeric := («массив» j "functions").flatMap (fun f =>
      «числовыеИмена» decls («строка?» f "name") («типJson» ((«поле?» f "returns").getD .null)))
    let fns := («массив» j "functions").map (fun f => («строка?» f "name",
      («массив» f "params").map (fun p => «типJson» ((«поле?» p "type").getD .null)),
      «типJson» ((«поле?» f "returns").getD .null)))
    pure ((«массив» j "functions").flatMap («строкиФункции» P fns decls cx numeric))

def «канонФайла» (path : String) : IO (List String) := do
  let text ← IO.FS.readFile path
  pure ((text.splitOn "\n").filter (fun l => !l.isEmpty) |>.map (fun l =>
    match Json.parse l with
    | .ok j => «ответТекстом» j
    | .error _ => "нечитаемо"))

end «Эталон»

open «Эталон» in
def main (args : List String) : IO UInt32 := do
  match args with
  | ["plan", f] =>
    for line in ← «планФайла» f none none do
      IO.println line
    pure 0
  | ["plan", f, c, q] =>
    for line in ← «планФайла» f (some c) (some q) do
      IO.println line
    pure 0
  | ["canon", f] =>
    for line in ← «канонФайла» f do
      IO.println line
    pure 0
  | _ =>
    IO.eprintln "plan <ast.json> [<module.c> <proof.json>] | canon <answers.jsonl>"
    pure 2
