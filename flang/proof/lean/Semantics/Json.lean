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

partial def «вырJson» (j : Json) : «Выр» :=
  let sub := fun (k : String) => «вырJson» ((«поле?» j k).getD .null)
  let subs := fun (k : String) => («массив» j k).map «вырJson»
  let flds := fun (k : String) => («пары» j k).map (fun p => (p.1, «вырJson» p.2))
  match «строка?» j "kind" with
  | "literal" => .«лит» («значениеJson» ((«поле?» j "value").getD .null))
  | "var" => .«имя» («строка?» j "name")
  | "binary" => .«двучлен» («строка?» j "op") (sub "left") (sub "right")
  | "if" => .«если» (sub "cond") (sub "then") (sub "else")
  | "let" => .«пусть» («строка?» j "name") (sub "value") (sub "in")
  | "call" => .«вызов» («строка?» j "name") (subs "args")
  | "match" => .«разбор» (sub "target") ((«массив» j "cases").map (fun c =>
      («образецJson» ((«поле?» c "pattern").getD .null), «вырJson» ((«поле?» c "body").getD .null))))
  | "fold" => .«свёртка» (sub "over") (sub "init") («строка?» j "acc") («строка?» j "item") (sub "body")
  | "map" => .«отобразить» (sub "over") («строка?» j "item") (sub "body")
  | "filter" => .«отфильтровать» (sub "over") («строка?» j "item") (sub "body")
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

end «Эталон»
