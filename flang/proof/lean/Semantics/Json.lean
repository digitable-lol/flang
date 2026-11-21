import Lean.Data.Json
import Semantics.Eval

namespace «Эталон»

open Lean

def «поле?» (j : Json) (k : String) : Option Json := (j.getObjVal? k).toOption

def «строка?» (j : Json) (k : String) : String :=
  match «поле?» j k with
  | some (.str s) => s
  | _ => ""

def «массив» (j : Json) (k : String) : List Json :=
  match «поле?» j k with
  | some (.arr a) => a.toList
  | _ => []

def «пары» (j : Json) (k : String) : List (String × Json) :=
  match «поле?» j k with
  | some (.obj m) => m.toList
  | _ => []

def «числоJson» (n : JsonNumber) : «Д64» :=
  «дробьВД64» (decide (n.mantissa < 0)) n.mantissa.natAbs (-(n.exponent : Int))

partial def «значениеJson» : Json → «Зн»
  | .null => .«ничто»
  | .bool b => .«признак» b
  | .num n => .«число» («числоJson» n)
  | .str s => .«строка» s
  | .arr a => .«список» (a.toList.map «значениеJson»)
  | .obj m =>
    let j := Json.obj m
    match «поле?» j "variant" with
    | some (.str k) => .«вариант» k ((«пары» j "fields").map (fun p => (p.1, «значениеJson» p.2)))
    | _ => .«запись» (m.toList.map (fun p => (p.1, «значениеJson» p.2)))

def «имя?» (j : Json) (k : String) : Option String :=
  match «поле?» j k with
  | some (.str s) => some s
  | _ => none

def «образецJson» (j : Json) : «Образец» :=
  match «строка?» j "kind" with
  | "empty" => .«пусто»
  | "cons" => .«звено» («имя?» j "head") («имя?» j "tail")
  | "variant" => .«вариант» («строка?» j "name")
      (match «поле?» j "bind" with
       | some (.arr a) => a.toList.filterMap (fun x => match x with | .str v => some (v, v) | _ => none)
       | _ => («пары» j "bind").filterMap (fun p =>
          match p.2 with
          | .str v => some (p.1, v)
          | _ => none))
  | "literal" => .«лит» («значениеJson» ((«поле?» j "value").getD .null))
  | _ => .«любое»

/-- Место узла в исходнике: строка и столбец из `span`; узел без места стоит первым. -/
def «местоJson» (j : Json) : Nat × Nat :=
  match «поле?» j "span" with
  | some s =>
    ((s.getObjValAs? Nat "line").toOption.getD 0, (s.getObjValAs? Nat "column").toOption.getD 0)
  | none => (0, 0)

/-- Поля записи и варианта в порядке исходника. Объект JSON порядка не хранит (Lean читает его в дерево по
ключу), а язык вычисляет поля в том порядке, в каком они написаны; порядок возвращает место выражения поля. -/
def «поИсходнику» (ps : List (String × Json)) : List (String × Json) :=
  ps.mergeSort (fun a b =>
    let x := «местоJson» a.2
    let y := «местоJson» b.2
    x.1 < y.1 || (x.1 == y.1 && x.2 ≤ y.2))

def «отказМеры» : «Выр» := .«форма» "#отказ FLANG_MEASURE" []

def «сторожМеры» (f : String) (args : List «Выр») (current next : «Выр») (callee : List String) : «Выр» :=
  let slots := (args.zipIdx).map (fun (_, i) => "#довод" ++ toString i)
  let call := .«вызов» f (slots.map .«имя»)
  let whole := .«двучлен» "eq" (.«двучлен» "sub" (.«имя» "#шаг") (.«двучлен» "mod" (.«имя» "#шаг") (.«лит» (.«число» («изЦелого» 1)))))
    (.«имя» "#шаг")
  let check := .«если» (.«двучлен» "lt" (.«имя» "#шаг") (.«имя» "#мера"))
    (.«если» (.«двучлен» "gte" (.«имя» "#шаг") (.«лит» (.«число» («изЦелого» 0))))
      (.«если» whole call «отказМеры») «отказМеры») «отказМеры»
  let withNext := .«пусть» "#шаг" next check
  let named := (callee.zip slots).foldr (fun (p, a) e => .«пусть» p (.«имя» a) e) withNext
  let measured := .«пусть» "#мера" current named
  (args.zip slots).foldr (fun (a, x) e => .«пусть» x a e) measured

partial def «вырJson» (j : Json) : «Выр» :=
  let sub := fun (k : String) => «вырJson» ((«поле?» j k).getD .null)
  let subs := fun (k : String) => («массив» j k).map «вырJson»
  let flds := fun (k : String) => («поИсходнику» («пары» j k)).map (fun p => (p.1, «вырJson» p.2))
  match «строка?» j "kind" with
  | "literal" => .«лит» («значениеJson» ((«поле?» j "value").getD .null))
  | "var" => .«имя» («строка?» j "name")
  | "binary" => .«двучлен» («строка?» j "op") (sub "left") (sub "right")
  | "if" => .«если» (sub "cond") (sub "then") (sub "else")
  | "let" => .«пусть» («строка?» j "name") (sub "value") (sub "in")
  | "call" =>
    match «поле?» j "descent" with
    | some d =>
      if («строка?» d "proved").isEmpty && («поле?» d "current").isSome && («поле?» d "next").isSome then
        «сторожМеры» («строка?» j "name") (subs "args") («вырJson» ((«поле?» d "current").getD .null))
          («вырJson» ((«поле?» d "next").getD .null)) ((«массив» d "calleeParams").map (fun p =>
            match p with
            | .str t => t
            | _ => «строка?» p "name"))
      else .«вызов» («строка?» j "name") (subs "args")
    | none => .«вызов» («строка?» j "name") (subs "args")
  | "match" => .«разбор» (sub "target") ((«массив» j "cases").map (fun c =>
      («образецJson» ((«поле?» c "pattern").getD .null), «вырJson» ((«поле?» c "body").getD .null))))
  | "fold" => .«свёртка» (sub "over") (sub "init") («строка?» j "acc") («строка?» j "item") (sub "body")
  | "map" => .«отобразить» (sub "over") («строка?» j "item") (sub "body")
  | "filter" => .«отфильтровать» (sub "over") («строка?» j "item") (sub "body")
  | "forallIn" =>
    if («строка?» j "item").isEmpty then .«форма» "узел forallIn" []
    else .«свёртка» (sub "over") (.«лит» (.«признак» true)) "накопитель (все элементы)" («строка?» j "item")
      (.«если» (.«имя» "накопитель (все элементы)") (sub "body") (.«лит» (.«признак» false)))
  | "list" => .«список» (subs "items")
  | "record" => .«запись» (flds "fields")
  | "construct" => .«конструктор» («строка?» j "variant") (flds "fields")
  | "field" => .«поле» (sub "target") («строка?» j "field")
  | "builtin" => .«форма» («строка?» j "name") (subs "args")
  | "fnref" => .«ссылка» («строка?» j "name") (flds "fields")
  | "apply" => .«применить» (sub "fn") (subs "args")
  | k => .«форма» ("узел " ++ k) []

def «постусловиеJson» (j : Json) : «Постусловие» :=
  { «связка» := («имя?» j "bind").getD "результат"
    «код» := («имя?» j "code").getD "FLANG_PROPERTY"
    «выражение» := «вырJson» ((«поле?» j "expr").getD .null) }

def «функцияJson» (j : Json) : «Функция» :=
  { «имя» := «строка?» j "name"
    «параметры» := («массив» j "params").map (fun p => «строка?» p "name")
    «тело» := «вырJson» ((«поле?» j "body").getD .null)
    «постусловия» := («массив» j "postconditions").map «постусловиеJson» }

structure «Пример» where
  «функция» : String
  «имя» : String
  «доводы» : List (String × «Зн»)
  «ожидается» : «Зн»

def «примерыJson» (f : Json) : List «Пример» :=
  («массив» f "examples").map (fun e =>
    { «функция» := «строка?» f "name"
      «имя» := «строка?» e "name"
      «доводы» := («пары» e "args").map (fun p => (p.1, «значениеJson» p.2))
      «ожидается» := «значениеJson» ((«поле?» e "expected").getD .null) })

def «программаJson» (j : Json) : «Программа» := («массив» j "functions").map «функцияJson»

def «всеПримеры» (j : Json) : List «Пример» := («массив» j "functions").flatMap «примерыJson»

def «дети» : «Выр» → List «Выр»
  | .«двучлен» _ a b => [a, b]
  | .«если» c t e => [c, t, e]
  | .«пусть» _ v b => [v, b]
  | .«вызов» _ args => args
  | .«разбор» t cs => t :: cs.map (·.2)
  | .«свёртка» l n _ _ s => [l, n, s]
  | .«отобразить» l _ s => [l, s]
  | .«отфильтровать» l _ s => [l, s]
  | .«список» es => es
  | .«запись» fs => fs.map (·.2)
  | .«конструктор» _ fs => fs.map (·.2)
  | .«поле» t _ => [t]
  | .«форма» _ args => args
  | .«ссылка» _ fs => fs.map (·.2)
  | .«применить» f args => f :: args
  | _ => []

partial def «преобразовать» (h : «Выр» → «Выр») : «Выр» → «Выр»
  | .«двучлен» op a b => h (.«двучлен» op («преобразовать» h a) («преобразовать» h b))
  | .«если» c t e => h (.«если» («преобразовать» h c) («преобразовать» h t) («преобразовать» h e))
  | .«пусть» x v b => h (.«пусть» x («преобразовать» h v) («преобразовать» h b))
  | .«вызов» f args => h (.«вызов» f (args.map («преобразовать» h)))
  | .«разбор» t cs => h (.«разбор» («преобразовать» h t) (cs.map (fun c => (c.1, «преобразовать» h c.2))))
  | .«свёртка» l n a x s => h (.«свёртка» («преобразовать» h l) («преобразовать» h n) a x («преобразовать» h s))
  | .«отобразить» l x s => h (.«отобразить» («преобразовать» h l) x («преобразовать» h s))
  | .«отфильтровать» l x s => h (.«отфильтровать» («преобразовать» h l) x («преобразовать» h s))
  | .«список» es => h (.«список» (es.map («преобразовать» h)))
  | .«запись» fs => h (.«запись» (fs.map (fun p => (p.1, «преобразовать» h p.2))))
  | .«конструктор» k fs => h (.«конструктор» k (fs.map (fun p => (p.1, «преобразовать» h p.2))))
  | .«поле» t p => h (.«поле» («преобразовать» h t) p)
  | .«форма» n args => h (.«форма» n (args.map («преобразовать» h)))
  | .«ссылка» f fs => h (.«ссылка» f (fs.map (fun p => (p.1, «преобразовать» h p.2))))
  | .«применить» f args => h (.«применить» («преобразовать» h f) (args.map («преобразовать» h)))
  | e => h e

def «спускШагом?» (cycle : List String) (k : Nat) : «Выр» → Bool
  | .«вызов» f args => cycle.contains f && k < args.length
  | _ => false

partial def «местаШага» (cycle : List String) (k : Nat) (e : «Выр») : Nat :=
  ((«дети» e).map («местаШага» cycle k)).foldl (· + ·) (if «спускШагом?» cycle k e then 1 else 0)

def «сторожШага» (cycle : List String) (k : Nat) (param : String) (e : «Выр») : «Выр» :=
  match e with
  | .«вызов» f args =>
    if «спускШагом?» cycle k e then
      let slots := (args.zipIdx).map (fun (_, i) => "#довод" ++ toString i)
      let bound := args.zip slots
      let rest := (bound.drop (k + 1)).foldr (fun (a, x) body => .«пусть» x a body) (.«вызов» f (slots.map .«имя»))
      let check := .«если» (.«двучлен» "lt" (.«имя» ("#довод" ++ toString k)) (.«имя» param)) rest «отказМеры»
      (bound.take (k + 1)).foldr (fun (a, x) body => .«пусть» x a body) check
    else e
  | _ => e

def «номерДовода» (s : String) : Option Nat :=
  let digits := (s.toList.dropWhile (fun c => !c.isDigit)).takeWhile (·.isDigit)
  if digits.isEmpty then none else some (digits.foldl (fun n c => n * 10 + (c.toNat - '0'.toNat)) 0)

def «функцияСШагом» (ledger : Json) (g : «Функция») : «Функция» :=
  match («массив» ledger "functions").find? (fun r => «строка?» r "name" = g.«имя» && «строка?» r "carrier" = "step") with
  | none => g
  | some r =>
    let cycle := («массив» r "cycle").filterMap (fun c =>
      match c with
      | .str s => some s
      | _ => none)
    match «номерДовода» («строка?» r "argument") with
    | some (k + 1) =>
      match g.«параметры»[k]? with
      | some param =>
        if «местаШага» cycle k g.«тело» = (r.getObjValAs? Nat "guardSites").toOption.getD 0 then
          { g with «тело» := «преобразовать» («сторожШага» cycle k param) g.«тело» }
        else g
      | none => g
    | _ => g

def «программаСШагом» (ledger : Json) (P : «Программа») : «Программа» := P.map («функцияСШагом» ledger)

partial def «взятыеФункции» : Json → List String
  | .obj m =>
    let j := Json.obj m
    let here := if «строка?» j "kind" = "fnref" && («пары» j "fields").isEmpty then [«строка?» j "name"] else []
    here ++ m.toList.flatMap (fun p => «взятыеФункции» p.2)
  | .arr a => a.toList.flatMap «взятыеФункции»
  | _ => []

end «Эталон»
