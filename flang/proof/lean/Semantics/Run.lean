import Semantics.Json

namespace «Эталон»

open Lean

def «топливо» : Nat := 200000

def «экранировать» (s : String) : String :=
  s.foldl (fun acc c =>
    acc ++ (if c = '"' then "\\\"" else if c = '\\' then "\\\\" else if c = '\n' then "\\n"
      else if c = '\t' then "\\t" else String.singleton c)) ""

partial def «печать» : «Зн» → String
  | .«число» d => «строкаЧисла» d
  | .«строка» s => "\"" ++ «экранировать» s ++ "\""
  | .«признак» b => if b then "true" else "false"
  | .«ничто» => "null"
  | .«список» l => "[" ++ ",".intercalate (l.map «печать») ++ "]"
  | .«запись» fs => "{" ++ ",".intercalate (fs.map (fun p => "\"" ++ «экранировать» p.1 ++ "\":" ++ «печать» p.2)) ++ "}"
  | .«вариант» k fs => "{\"variant\":\"" ++ «экранировать» k ++ "\",\"fields\":{" ++
      ",".intercalate (fs.map (fun p => "\"" ++ «экранировать» p.1 ++ "\":" ++ «печать» p.2)) ++ "}}"

def «исходТекстом» : «Исход» → String × String
  | .ok v => ("значение", «печать» v)
  | .error (.«беда» k) => ("беда", k)
  | .error .«топливо» => ("топливо", "")
  | .error (.«вне» k) => ("вне", k)

def «прогнатьПример» (P : «Программа») (e : «Пример») : String × String :=
  match «функцияПрограммы» P e.«функция» with
  | none => ("вне", "нет функции")
  | some g =>
    let args := g.«параметры».map (fun p => match «найти» p e.«доводы» with
      | some v => «Выр».«лит» v
      | none => «Выр».«лит» .«ничто»)
    match «выч» P «топливо» [] (.«вызов» g.«имя» args) with
    | .ok v => if «равны» v e.«ожидается» then ("совпало", «печать» v) else ("разошлось", «печать» v)
    | r => «исходТекстом» r

def «примерыФайла» (path : String) : IO (List String) := do
  let text ← IO.FS.readFile path
  match Json.parse text with
  | .error m => pure [path ++ "\t\t\tнечитаемо\t" ++ m]
  | .ok j =>
    let P := «программаJson» j
    pure ((«всеПримеры» j).map (fun e =>
      let r := «прогнатьПример» P e
      path ++ "\t" ++ e.«функция» ++ "\t" ++ e.«имя» ++ "\t" ++ r.1 ++ "\t" ++ r.2))

def «значениеФункции» (path f : String) : IO String := do
  let text ← IO.FS.readFile path
  match Json.parse text with
  | .error m => pure ("нечитаемо\t" ++ m)
  | .ok j =>
    let P := «программаJson» j
    let r := «исходТекстом» («выч» P «топливо» [] (.«вызов» f []))
    pure (r.1 ++ "\t" ++ r.2)

def «прыжок» (s : UInt64) : UInt64 := s * 6364136223846793005 + 1442695040888963407

def «тот же» (a : «Д64») (f : Float) : Bool :=
  if «нечисло?» a then f.isNaN else «вБиты» a == f.toBits.toNat

def «битыВыборки» (s : UInt64) : UInt64 :=
  let k := (s >>> 61).toNat
  let m := (s >>> 8) % 4503599627370496
  let e := ((s >>> 20) % 2047)
  match k with
  | 0 => s
  | 1 => (s &&& (0x800FFFFFFFFFFFFF : UInt64)) ||| ((1075 - 60 + (e % 120)) <<< 52)
  | 2 => (s &&& (0x800FFFFFFFFFFFFF : UInt64)) ||| ((e % 4) <<< 52)
  | 3 => (s &&& (0x800FFFFFFFFFFFFF : UInt64)) ||| ((2040 + (e % 7)) <<< 52)
  | 4 => (s &&& (0x8000000000000000 : UInt64)) ||| m
  | 5 => (s &&& (0x800FFFFFFFFFFFFF : UInt64)) ||| ((1023 + (e % 64)) <<< 52)
  | 6 => Float.toBits (Float.ofInt ((s >>> 11).toNat : Int))
  | _ => (s &&& (0x800FFFFFFFFFFFFF : UInt64)) ||| ((970 + (e % 100)) <<< 52)

def «аппаратно» (n : Nat) : IO (Nat × Nat × List String) := do
  let mut s : UInt64 := 20261017
  let mut bad := 0
  let mut total := 0
  let mut said : List String := []
  for _ in [0:n] do
    s := «прыжок» s; let a := «битыВыборки» s
    s := «прыжок» s; let b := «битыВыборки» s
    let fa := Float.ofBits a
    let fb := Float.ofBits b
    let da := «изБит» a.toNat
    let db := «изБит» b.toNat
    let checks : List (String × Bool) := [
      ("плюс", «тот же» («плюс64» da db) (fa + fb)),
      ("минус", «тот же» («минус64» da db) (fa - fb)),
      ("умножить", «тот же» («умножить64» da db) (fa * fb)),
      ("делить", «тот же» («делить64» da db) (fa / fb)),
      ("меньше", «меньше64» da db == decide (fa < fb)),
      ("не больше", «неБольше64» da db == decide (fa ≤ fb)),
      ("биты", «вБиты» da == a.toNat || «нечисло?» da)]
    for (nm, ok) in checks do
      total := total + 1
      if !ok then
        bad := bad + 1
        if said.length < 10 then said := said ++ [nm ++ " " ++ toString a ++ " " ++ toString b]
    s := «прыжок» s
    let i : Int := if s % 2 = 0 then ((s >>> 1).toNat : Int) else -((s >>> 1).toNat : Int)
    let j : Int := i * (((s >>> 40).toNat % 1048576 : Nat) : Int)
    for (nm, x) in [("целое", i), ("целое широкое", j)] do
      total := total + 1
      if !(«тот же» («изЦелого» x) (Float.ofInt x)) then
        bad := bad + 1
        if said.length < 10 then said := said ++ [nm ++ " " ++ toString x]
  pure (total, bad, said)

end «Эталон»

open «Эталон» in
def main (args : List String) : IO UInt32 := do
  match args with
  | "examples" :: files =>
    for f in files do
      for line in ← «примерыФайла» f do
        IO.println line
    pure 0
  | ["value", f, g] =>
    IO.println (← «значениеФункции» f g)
    pure 0
  | ["hardware", n] =>
    let (total, bad, said) ← «аппаратно» n.toNat!
    for l in said do IO.println l
    IO.println ("операций " ++ toString total ++ ", расхождений " ++ toString bad)
    pure (if bad = 0 then 0 else 1)
  | _ =>
    IO.eprintln "examples <ast.json>… | value <ast.json> <функция> | hardware <N>"
    pure 2
