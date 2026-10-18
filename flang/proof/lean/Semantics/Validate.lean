import Semantics.Json

namespace «Эталон»

open Lean

def «топливоСверки» : Nat := 200000

def «предел перебора» : Nat := 512

def «свидетелей» : Nat := 48

def «экранJson» (s : String) : String :=
  s.foldl (fun acc c =>
    acc ++ (if c = '"' then "\\\"" else if c = '\\' then "\\\\" else if c = '\n' then "\\n"
      else if c = '\t' then "\\t" else if c = '\r' then "\\r" else String.singleton c)) ""

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

def «цифра?» (c : Char) : Bool := '0' ≤ c && c ≤ '9'

def «цифрыВНат» (cs : List Char) : Nat := cs.foldl (fun n c => n * 10 + (c.toNat - '0'.toNat)) 0

def «читатьЧисло» (t : String) : Option «Д64» :=
  let neg := t.startsWith "-"
  let body := if neg then (t.drop 1).toString else t
  if body = "Infinity" then some (.«беск» neg)
  else if body = "NaN" then some .«нечисло»
  else
    let parts := body.splitOn "e"
    let mant := parts.headD ""
    let ex := (parts.drop 1).headD "0"
    let mp := mant.splitOn "."
    let whole := (mp.headD "").toList
    let frac := ((mp.drop 1).headD "").toList
    let exNeg := ex.startsWith "-"
    let exDigits := ((if exNeg || ex.startsWith "+" then (ex.drop 1).toString else ex)).toList
    if whole.all «цифра?» && frac.all «цифра?» && exDigits.all «цифра?» && !(whole ++ frac).isEmpty then
      let p := «цифрыВНат» (whole ++ frac)
      let e : Int := (if exNeg then -(«цифрыВНат» exDigits : Int) else («цифрыВНат» exDigits : Int)) - frac.length
      some («дробьВД64» neg p e)
    else none

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
  | "fn" => .«вне» "значение-функция"
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

partial def «образцы» (decls : List (String × Json)) (seen : List String) (depth : Nat) : «Тип» → «Образцы»
  | .«число» => ⟨«образцыЧисла», false, []⟩
  | .«нат» => ⟨«образцыНат», false, []⟩
  | .«целое» => ⟨«образцыЦелого», false, []⟩
  | .«признак» => ⟨[.«признак» false, .«признак» true], true, []⟩
  | .«строка» => ⟨«образцыСтроки», false, []⟩
  | .«вне» why => ⟨[], false, [why]⟩
  | .«список» t =>
    let inner := «образцы» decls seen (depth - 1) t
    let vs := inner.«значения»
    let lists := if vs.isEmpty then [[]] else [[], [vs[0]!], (vs.drop 1).take 2, (vs.drop 3).take 3]
    ⟨lists.map .«список», false, inner.«вне»⟩
  | .«ссылка» n =>
    if seen.contains n && depth = 0 then ⟨[], false, []⟩
    else
      let inner := «образцы» decls (n :: seen) (if seen.contains n then depth - 1 else depth) («раскрыть» decls n)
      { inner with «конечно» := «конечен?» decls seen (.«ссылка» n) }
  | .«запись» _ fs =>
    let rows := fs.map (fun f => «образцы» decls seen depth f.2)
    «соединитьОбразцы» rows (fun vs => .«запись» ((fs.map (·.1)).zip vs))
  | .«сумма» _ vs =>
    let parts : List «Образцы» := vs.map (fun v =>
      if v.2.isEmpty then ⟨[.«вариант» v.1 []], true, []⟩
      else «соединитьОбразцы» (v.2.map (fun f => «образцы» decls seen depth f.2))
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

def «строкиФункции» (P : «Программа») (common : List (String × Json)) (f : Json) : List String :=
  let decls := «параметрыТипа» f ++ common
  let name := «строка?» f "name"
  let params := («массив» f "params").map (fun p => («строка?» p "name", «типJson» ((«поле?» p "type").getD .null)))
  let ret := «образцы» decls [] 2 («типJson» ((«поле?» f "returns").getD .null))
  let rows := params.map (fun p => «образцы» decls [] 2 p.2)
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
    let all := «безПовторов» («наборыПримеров» f (params.map (·.1)) ++ sets)
    let cls := if params.isEmpty then "без параметров" else if full then "перебор" else "свидетели"
    let pre := «предусловияJson» f
    if all.isEmpty then [name ++ "\tвне\tнет ни одного свидетеля\t"]
    else all.map (fun vs => name ++ "\t" ++ cls ++ "\t" ++ «запрос» name vs ++ "\t" ++ «ответЭталона» P pre g vs)

def «планФайла» (path : String) : IO (List String) := do
  let text ← IO.FS.readFile path
  match Json.parse text with
  | .error m => pure ["\tнечитаемо\t" ++ m ++ "\t"]
  | .ok j =>
    let P := «программаJson» j
    let decls := «объявленияТипов» j
    pure ((«массив» j "functions").flatMap («строкиФункции» P decls))

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
    for line in ← «планФайла» f do
      IO.println line
    pure 0
  | ["canon", f] =>
    for line in ← «канонФайла» f do
      IO.println line
    pure 0
  | _ =>
    IO.eprintln "plan <ast.json> | canon <answers.jsonl>"
    pure 2
