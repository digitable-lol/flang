import «RecordReader»

open «Разбор»

namespace «Второй»

structure «Исх» where
  «сырые» : Array String
  «текст» : String

def «исходник» (t : String) : «Исх» := ⟨(t.splitOn "\n").toArray, t⟩

def «Исх».«сырая» (s : «Исх») (n : Nat) : String := if n = 0 then "" else s.«сырые».getD (n - 1) ""

def «Исх».«число» (s : «Исх») : Nat := s.«сырые».size

def «Исх».«строка» (s : «Исх») (n : Nat) : String := («какЧитаетЯзык» (s.«сырая» n)).«обр»

def «отКрая» (raw : String) : Bool :=
  raw ≠ "" && !raw.startsWith " " && !raw.startsWith "\t" && !raw.startsWith "\r" && !raw.startsWith "//"

def «отступ» (raw : String) : Nat := (raw.toList.takeWhile (· = ' ')).length

def «заголовокФункции» (raw : String) : Option String :=
  let n := «имяФункции» raw
  if n = "" then none else some n

def «Исх».«номера» (s : «Исх») : List Nat := List.range' 1 s.«число»

def «Исх».«блок» (s : «Исх») (f : String) : Option (Nat × Nat) :=
  match s.«номера».find? (fun i => «заголовокФункции» (s.«сырая» i) = some f) with
  | none => none
  | some h =>
    let «конец» := ((List.range' (h + 1) (s.«число» - h)).find? (fun i => «отКрая» (s.«сырая» i))).getD (s.«число» + 1)
    some (h, «конец»)

def «Исх».«функции» (s : «Исх») : List String :=
  s.«номера».filterMap (fun i => «заголовокФункции» (s.«сырая» i))

def «Исх».«внутри» (s : «Исх») (f : String) : List Nat :=
  match s.«блок» f with
  | some (h, e) => List.range' (h + 1) (e - h - 1)
  | none => []

def «словаКонтракта» : List String :=
  ["принимает ", "возвращает ", "обеспечивает ", "для всех ", "требует ", "убывает ", "мера ",
   "пример ", "дано ", "ожидается "]

def «Исх».«опорная» (s : «Исх») (f : String) (i : Nat) : Nat :=
  match s.«блок» f with
  | none => i
  | some (h, _) =>
    let «база» := «отступ» (s.«сырая» (h + 1))
    let rec «вверх» (k : Nat) (fuel : Nat) : Nat :=
      match fuel with
      | 0 => k
      | fuel + 1 =>
        if k > h + 1 && («отступ» (s.«сырая» k) > «база» || s.«строка» k = "") then «вверх» (k - 1) fuel else k
    «вверх» i i

def «Исх».«строкаТела?» (s : «Исх») (f : String) (i : Nat) : Bool :=
  s.«строка» i ≠ "" &&
  let o := s.«строка» (s.«опорная» f i)
  !(«словаКонтракта».any (fun w => o.startsWith w))

def «Исх».«подпись» (s : «Исх») (f : String) : List (String × String) :=
  match (s.«внутри» f).find? (fun i => (s.«строка» i).startsWith "принимает ") with
  | none => []
  | some i =>
    ((s.«строка» i).«сн» 10).splitOn "," |>.map (fun k =>
      match k.splitOn ":" with
      | a :: b => (a.«обр», (":".intercalate b).«обр»)
      | [] => ("", ""))

def «вариантыВстроенных» (t : String) : Option (List (String × Nat)) :=
  if t = "список" || t = "строка" then some [("пусто", 0), ("голова и хвост", 1)] else none

def «имяВарианта» (l : String) : String :=
  if l.startsWith "вариант «" then «вЁлочках» l 1 else ((l.splitOn " ").getD 1 "")

def «Исх».«заголовокТипа?» (s : «Исх») (i : Nat) (t : String) : Bool :=
  let l := s.«строка» i
  l = s!"тип «{t}»" || (l.startsWith s!"тип «{t}» от " && !((l.splitOn "» это ").length > 1))

def «Исх».«строкиВариантов» (s : «Исх») (t : String) : List String :=
  match s.«номера».find? (fun i => s.«заголовокТипа?» i t) with
  | none => []
  | some h =>
    let rec «сбор» (i : Nat) (fuel : Nat) (acc : List String) : List String :=
      match fuel with
      | 0 => acc
      | fuel + 1 =>
        let l := s.«строка» i
        if l.startsWith "вариант " then «сбор» (i + 1) fuel (acc ++ [l])
        else if l = "" && i ≤ s.«число» then «сбор» (i + 1) fuel acc
        else acc
    «сбор» (h + 1) s.«число» []

def «Исх».«основа» (s : «Исх») (t : String) : String := «основаТипа» s.«сырые».toList t

inductive «ВидТипа» where
  | «сумма» (v : List String)
  | «запись»
  | «отрезок»
  | «нет»
  deriving BEq

def «Исх».«видТипа» (s : «Исх») (t0 : String) : «ВидТипа» :=
  let t := s.«основа» t0
  if t = "список" || t = "строка" then .«сумма» ["пусто", "голова и хвост"]
  else if «натуральноеИмя» t then .«отрезок»
  else
    let v := (s.«строкиВариантов» t).map «имяВарианта»
    if !v.isEmpty then .«сумма» v
    else if s.«номера».any (fun i => s.«строка» i = s!"объект «{t}»") then .«запись»
    else .«нет»

def «Исх».«строкаВарианта» (s : «Исх») (t v : String) : Option String :=
  (s.«строкиВариантов» (s.«основа» t)).find? (fun l => «имяВарианта» l = v)

def «поляВарианта» (l : String) : List (String × String) :=
  match l.splitOn " содержит " with
  | [_, r] => (r.splitOn ",").map (fun k =>
      match k.splitOn ":" with
      | a :: b => («голо» a.«обр», (":".intercalate b).«обр»)
      | [] => ("", ""))
  | _ => []

def «Исх».«ввозит?» (s : «Исх») : Bool :=
  s.«номера».any (fun i => (s.«строка» i).startsWith "использует «")

end «Второй»
