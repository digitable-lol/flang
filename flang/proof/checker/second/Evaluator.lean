import Moves

open «Разбор»

namespace «Второй»

def «доЗнака» (t : String) (k : Nat) : String := String.ofList (t.toList.take k)
def «отЗнака» (t : String) (k : Nat) : String := String.ofList (t.toList.drop k)

def «стоитНа» (cs : Array Char) (i : Nat) (w : List Char) : Bool :=
  i + w.length ≤ cs.size && (cs.extract i (i + w.length)).toList == w

def «найтиСв» (t : String) (ops : List String) : Option (Nat × Nat) := Id.run do
  let cs := t.toList.toArray
  let ws := ops.map String.toList
  let mut gl : Int := 0
  let mut q := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
    else if c = '"' then q := true
    else if c = '(' then gl := gl + 1
    else if c = ')' then gl := gl - 1
    else if gl = 0 && c = ' ' then
      let mut k := 0
      for w in ws do
        if «стоитНа» cs i w then return some (i, k)
        k := k + 1
    i := i + 1
  return none

def «делСв» (t : String) (op : String) : Option (String × String) :=
  match «найтиСв» t [op] with
  | some (g, _) => some («доЗнака» t g, «отЗнака» t (g + op.length))
  | none => none

def «сколькоСв» (t w : String) : Nat := Id.run do
  let mut p := t
  let mut n := 0
  for _ in [0:t.length + 1] do
    match «делСв» p w with
    | some (_, r) => n := n + 1; p := r
    | none => break
  return n

def «безВнешних» (s : String) : String := Id.run do
  let mut t := «обрезать» s
  for _ in [0:6] do
    let cs := t.toList.toArray
    let d := cs.size
    if d < 2 || cs[0]! ≠ '(' || cs[d - 1]! ≠ ')' then break
    let mut gl : Int := 0
    let mut q := false
    let mut «всё» := true
    let mut i := 0
    while i < d do
      let c := cs[i]!
      if q then
        if c = '\\' && i + 1 < d then i := i + 1
        else if c = '"' then q := false
      else if c = '"' then q := true
      else if c = '(' then gl := gl + 1
      else if c = ')' then
        gl := gl - 1
        if gl = 0 && i + 1 < d then
          «всё» := false
          break
      i := i + 1
    if !«всё» || gl ≠ 0 then break
    t := «обрезать» (String.ofList ((cs.extract 1 (d - 1)).toList))
  return t

def «кавычкиЧисты» (t : String) : Bool := Id.run do
  let mut v := false
  for c in t.toList do
    if c = '"' then v := !v
    else if v && (c = '(' || c = ')' || c = ' ' || c = '\\') then return false
  return !v

def «безПробеловВнеКавычек» (s : String) : String := Id.run do
  let cs := s.toList.toArray
  let mut r : Array Char := #[]
  let mut q := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      r := r.push c
      if c = '\\' && i + 1 < cs.size then
        i := i + 1
        r := r.push cs[i]!
      else if c = '"' then q := false
    else if c = '"' then
      q := true
      r := r.push c
    else if c = ' ' || c = '\t' || c = '\r' || c = '\n' then pure ()
    else r := r.push c
    i := i + 1
  return if q then "" else String.ofList r.toList

def «звеньевПоЗапятым» (t : String) : Nat := Id.run do
  let cs := t.toList.toArray
  let mut gl : Int := 0
  let mut n := 0
  let mut q := false
  let mut «буквы» := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
    else if c = '"' then
      q := true
      «буквы» := true
    else if c = '[' || c = '(' then gl := gl + 1
    else if c = ']' || c = ')' then gl := gl - 1
    else if gl = 1 && c = ',' then n := n + 1
    else if gl ≥ 1 && c ≠ ' ' then «буквы» := true
    i := i + 1
  if q || gl ≠ 0 then return 0
  return if «буквы» then n + 1 else 0

def «цифра16» (c : Char) : Option Nat :=
  if c ≥ '0' && c ≤ '9' then some (c.toNat - '0'.toNat)
  else if c ≥ 'a' && c ≤ 'f' then some (c.toNat - 'a'.toNat + 10)
  else if c ≥ 'A' && c ≤ 'F' then some (c.toNat - 'A'.toNat + 10)
  else none

def «литерал?» (t : String) : Option String := Id.run do
  let cs := t.toList.toArray
  let d := cs.size
  if d < 2 || cs[0]! ≠ '"' || cs[d - 1]! ≠ '"' then return none
  let mut r : Array Char := #[]
  let mut i := 1
  while i + 1 < d do
    let c := cs[i]!
    if c.toNat ≥ 0x10000 then return none
    if c = '"' then return none
    if c ≠ '\\' then
      r := r.push c
      i := i + 1
      continue
    i := i + 1
    if i + 1 ≥ d then return none
    let e := cs[i]!
    if e = 'n' then r := r.push '\n'
    else if e = 'r' then r := r.push '\r'
    else if e = 't' then r := r.push '\t'
    else if e = 'u' then
      if i + 4 ≥ d - 1 then return none
      let mut k := 0
      for j in [1:5] do
        match «цифра16» cs[i + j]! with
        | some h => k := k * 16 + h
        | none => return none
      if k ≥ 0xD800 && k ≤ 0xDFFF then return none
      r := r.push (Char.ofNat k)
      i := i + 4
    else r := r.push e
    i := i + 1
  return some (String.ofList r.toList)

def «вЛитерал» (s : String) : String :=
  let hex := fun (n : Nat) => let d := Nat.toDigits 16 n; String.ofList (List.replicate (4 - d.length) '0' ++ d)
  "\"" ++ String.join (s.toList.map fun c =>
    if c = '"' || c = '\\' then String.ofList ['\\', c]
    else if c = '\n' then "\\n"
    else if c = '\r' then "\\r"
    else if c = '\t' then "\\t"
    else if c.toNat < 0x20 || c.toNat = 0x7f then "\\u" ++ hex c.toNat
    else String.singleton c) ++ "\""

def «цифры» (cs : List Char) : List Char × List Char := (cs.takeWhile Char.isDigit, cs.dropWhile Char.isDigit)

def «числоТочно» (s0 : String) : Option Float :=
  let cs0 := s0.toList.dropWhile (fun c => c = ' ' || c = '\t' || c = '\n' || c = '\r')
  if s0 = "" then none else
  let (neg, cs) := match cs0 with
    | '-' :: r => (true, r)
    | '+' :: r => (false, r)
    | r => (false, r)
  let low := String.ofList (cs.map Char.toLower)
  let sgn := fun (x : Float) => if neg then -x else x
  if low = "inf" || low = "infinity" then some (sgn (1.0 / 0.0))
  else if low = "nan" then some (0.0 / 0.0)
  else
  let (a, r1) := «цифры» cs
  let (b, r2) := match r1 with
    | '.' :: r => «цифры» r
    | r => ([], r)
  if a.isEmpty && b.isEmpty then none else
  let (ex, r3) : Int × List Char := match r2 with
    | e :: r => if e = 'e' || e = 'E' then
        let (es, rr) := match r with
          | '-' :: q => (true, q)
          | '+' :: q => (false, q)
          | q => (false, q)
        let (ds, rest) := «цифры» rr
        if ds.isEmpty then (0, r2) else
        let v : Int := (String.ofList ds).toNat!
        (if es then -v else v, rest)
      else (0, r2)
    | [] => (0, [])
  if !r3.isEmpty then none else
  let m := (String.ofList (a ++ b)).toNat!
  let e := ex - b.length
  let x : Float := if e ≥ 0 then Float.ofNat (m * 10 ^ e.toNat) else Float.ofScientific m true (-e).toNat
  some (sgn x)

inductive «Зн» where
  | «нет»
  | «стр» (s : String)
  | «чис» (x : Float)
  | «приз» (b : Bool)
  | «спис» (t : String) (n : Nat)
  | «зап» (t : String)
  | «длн» (n : Nat)
  | «тег» (t : String)
  | «вар» («имя» : String) («поля» : List (String × «Зн»))
  deriving Inhabited

def «Зн».«есть» : «Зн» → Bool
  | .«нет» => false
  | _ => true

def «Зн».«вид» : «Зн» → Nat
  | .«нет» => 0 | .«стр» _ => 1 | .«чис» _ => 2 | .«приз» _ => 3 | .«спис» _ _ => 4
  | .«зап» _ => 5 | .«длн» _ => 6 | .«тег» _ => 7 | .«вар» _ _ => 8

def «Зн».«мера?» (z : «Зн») : Bool := z.«вид» = 6 || z.«вид» = 8

def «равныЗн» : «Зн» → «Зн» → Option Bool
  | .«стр» a, .«стр» b => some (a == b)
  | .«спис» a _, .«спис» b _ => some (a == b)
  | .«тег» a, .«тег» b => some (a == b)
  | .«чис» a, .«чис» b => some (a == b)
  | .«приз» a, .«приз» b => some (a == b)
  | _, _ => none

def «Зн».«текст» : «Зн» → String
  | .«стр» s => s
  | .«спис» t _ => t
  | .«тег» t => t
  | .«приз» b => if b then "да" else "нет"
  | .«чис» x => if x == x.round && x.abs < 1e15 then
      (if x < 0 then "-" ++ toString (-x).toUInt64.toNat else toString x.toUInt64.toNat) else toString x
  | .«вар» n _ => s!"вариант «{n}»"
  | _ => "не берусь"

structure «Среда» where
  «связи» : List (String × «Зн») := []
  «дв» : Nat := 0
  «св» : Nat := 0
  «рез» : «Зн» := .«нет»
  «сосед» : Option (String × String × String) := none

def «Среда».«найти» (e : «Среда») (n : String) : Option «Зн» := (e.«связи».find? (·.1 = n)).map (·.2)

def «Среда».«связать» (e : «Среда») (n : String) (z : «Зн») : Option «Среда» :=
  if e.«дв» ≥ 16 || n = "" then none else some { e with «связи» := (n, z) :: e.«связи», «дв» := e.«дв» + 1 }

def «Среда».«связатьОба» (e : «Среда») (n : String) (z : «Зн») : «Среда» × Nat :=
  let g := if «ёлочка» n 1 ≠ "" then «ёлочка» n 1 else n
  match e.«связать» g z with
  | some e1 => match e1.«связать» s!"«{g}»" z with
    | some e2 => (e2, 2)
    | none => (e1, 1)
  | none => match e.«связать» s!"«{g}»" z with
    | some e2 => (e2, 1)
    | none => (e, 0)

def «Исх».«блокС» (s : «Исх») (f : String) : Option (Nat × Nat) :=
  match s.«номера».find? (fun i => «имяФункции» (s.«сырая» i) = f) with
  | none => none
  | some h =>
    let «конец» := ((List.range' (h + 1) (s.«число» - h)).find? (fun i => «отКрая» (s.«сырая» i))).getD (s.«число» + 1)
    some (h, «конец»)

def «Исх».«меж» (s : «Исх») (a b : Nat) : List Nat := if b > a + 1 then List.range' (a + 1) (b - a - 1) else []

def «Исх».«телоТаблицы» (s : «Исх») (f : String) : String :=
  match s.«блокС» f with
  | none => ""
  | some (a, b) =>
    let ls := s.«меж» a b
    if ls.any (fun i => (s.«по» i).startsWith "принимает ") then "" else
    match (ls.filter (fun i => s.«по» i ≠ "" && !(s.«по» i).startsWith "//")).getLast? with
    | some i => s.«по» i
    | none => ""

def «Исх».«текстСписка» (s : «Исх») (a b : Nat) : String :=
  «безПробеловВнеКавычек» (" ".intercalate ((List.range' (a - 1) (b + 3 - a)).map (fun i => s.«по» i)))

def «Исх».«поОглавлению» (s : «Исх») («огл» : List String) (f : String) : Option (Nat × Nat) :=
  match «огл».find? (fun z => «ёлочка» z 1 = f) with
  | none => none
  | some z =>
    let a0 := «номерПосле» z "открыта "
    let b0 := «номерПосле» z "закрыта "
    let n0 := «номерПосле» z "звеньев "
    if s.«по» a0 ≠ "[" || s.«по» b0 ≠ "]" then none else
    match s.«блокС» f with
    | none => none
    | some (h, e) =>
      if h < 1 || a0 ≤ h || b0 ≥ e then none
      else if (s.«меж» h e).any (fun j => (s.«по» j).startsWith "принимает ") then none
      else if b0 - a0 - 1 ≠ n0 then none
      else some (a0 + 1, b0 - 1)

def «Исх».«телоСписком» (s : «Исх») (f : String) : Option (Nat × Nat) :=
  match s.«блокС» f with
  | none => none
  | some (a, b) =>
    let ls := s.«меж» a b
    if ls.any (fun i => (s.«по» i).startsWith "принимает ") then none else
    match (ls.filter (fun i => s.«по» i ≠ "" && !(s.«по» i).startsWith "//")).getLast? with
    | none => none
    | some i =>
      let z := s.«по» i
      if z.length < 2 || !z.startsWith "[" || !z.endsWith "]" then none else some (i + 1, i - 1)

def «Исх».«таблицаСписком» (s : «Исх») («огл» : List String) (f : String) : «Зн» :=
  match (s.«поОглавлению» «огл» f).orElse (fun _ => s.«телоСписком» f) with
  | none => .«нет»
  | some (a, b) =>
    let t := s.«текстСписка» a b
    let n := «звеньевПоЗапятым» t
    if n < 1 then .«нет» else .«спис» t n

def «Исх».«строкаПринимает» (s : «Исх») (a b : Nat) : String :=
  ((s.«меж» a b).find? (fun i => (s.«по» i).startsWith "принимает ")).map (s.«по» ·) |>.getD ""

def «именаДоводовС» («пр» : String) : List String :=
  if !«пр».startsWith "принимает " then [] else
  let ps := («после» «пр» "принимает ").splitOn ", "
  let r := ps.map fun x =>
    let d := «обрезать» x
    match d.toList.findIdx? (· = ':') with
    | some k => if k = 0 then none else some («обрезать» («доЗнака» d k))
    | none => none
  if r.all Option.isSome then r.filterMap id else []

def «объявленияТела» : List String :=
  ["принимает ", "возвращает ", "обеспечивает ", "требует ", "для всех ", "пример «", "дано ", "ожидается ", "теорема «", "использует "]

def «Исх».«строкаРазбора» (s : «Исх») (a b : Nat) : Option (Nat × String) := Id.run do
  let heads := ["принимает ", "возвращает ", "для всех ", "обеспечивает ", "требует ", "пример ", "дано ", "ожидается ", "использует ", "//"]
  for i in s.«меж» a b do
    let z := s.«по» i
    if z = "" then continue
    if z.startsWith "разбор " then return some (i, «после» z "разбор ")
    if !heads.any (z.startsWith ·) then return none
  return none

def «Исх».«телоТекстом» (s : «Исх») (a b : Nat) : String := Id.run do
  let heads := «объявленияТела» ++ ["//"]
  let mut v : Array String := #[]
  for i in s.«меж» a b do
    let l := s.«строка» i
    if l = "" then continue
    if heads.any (l.startsWith ·) then continue
    if ["разбор ", "пусть ", "случай ", "то ", "иначе ", "если "].any (l.startsWith ·) && v.isEmpty then return ""
    v := v.push l
  if v.isEmpty then return ""
  if v.size = 1 then return v[0]!
  let first := v[0]!
  let rest := " ".intercalate (v.toList.drop 1)
  if first.startsWith "свёртка " && !((first.splitOn " → ").length > 1) && !((rest.splitOn " → ").length > 1) then
    return first ++ " → " ++ rest
  return first ++ " " ++ rest

def «Исх».«ветвьПоЗначению» (s : «Исх») (a b : Nat) (z : «Зн») : String := Id.run do
  let mut «неясно» := false
  let zs := match z with | .«тег» t => t | .«стр» t => t | .«спис» t _ => t | _ => ""
  for i in s.«меж» a b do
    let l := s.«по» i
    if !l.startsWith "случай " then continue
    let o := «после» l "случай "
    let «совпал» := if o = "любое" then !«неясно» else match z with
      | .«тег» t => o = t || (t.startsWith "вариант «" && o = t.«сн» 8)
      | .«чис» x => match «числоТочно» o with | some y => y == x | none => false
      | _ => false
    if !«совпал» then
      «неясно» := «неясно» || (match z with
        | .«чис» _ => («числоТочно» o).isNone
        | _ => «ёлочка» o 1 = "" || «ёлочка» o 1 = «ёлочка» zs 1)
      continue
    if i + 1 < b && (s.«по» (i + 1)).startsWith "то " then return «словаС» (s.«по» (i + 1)) 1
    return ""
  return ""

def «Исх».«ветвиПарами» (s : «Исх») (g b : Nat) : Bool := Id.run do
  let mut i := g + 1
  while i < b do
    let z := s.«по» i
    let t := if i + 1 < b then s.«по» (i + 1) else ""
    if z = "" || z.startsWith "//" then
      i := i + 1
      continue
    if !z.startsWith "случай " || !t.startsWith "то " || t.startsWith "то разбор " then return false
    i := i + 2
  return true

def «поляС» (t «связка» : String) : Option (List String × List String) := Id.run do
  match «делСТекстом» t "» с " with
  | none => return none
  | some h0 =>
    let mut h := h0
    let mut nms : Array String := #[]
    let mut tms : Array String := #[]
    for _ in [0:h0.length + 1] do
      if h = "" then break
      let (k, rest) := match «делСв» h " и " with
        | some (a, r) => (a, r)
        | none => (h, "")
      h := rest
      match «делСв» k «связка» with
      | none => return none
      | some (l, r) =>
        let n0 := «обрезать» l
        let n := if «ёлочка» n0 1 ≠ "" then «ёлочка» n0 1 else n0
        if «ёлочка» n0 1 = "" && (n0 = "" || (n0.splitOn " ").length > 1) then return none
        nms := nms.push n
        tms := tms.push («обрезать» r)
    if nms.isEmpty then return none
    return some (nms.toList, tms.toList)
where «делСТекстом» (t m : String) : Option String :=
  match t.splitOn m with
  | _ :: r :: rest => some (m.intercalate (r :: rest))
  | _ => none

def «полеЗаписи» (rec «поле» : String) : Option String := Id.run do
  let m := s!"«{«поле»}»равным"
  if !rec.startsWith "(запись«" then return none
  match rec.splitOn m with
  | _ :: r :: rest =>
    let cs := (m.intercalate (r :: rest)).toList.toArray
    let mut v := false
    let mut gl : Nat := 0
    let mut i := 0
    while i < cs.size do
      let c := cs[i]!
      if v then
        if c = '\\' && i + 1 < cs.size then i := i + 1
        else if c = '"' then v := false
      else if c = '"' then v := true
      else if c = '(' then gl := gl + 1
      else if c = ')' then
        if gl = 0 then break
        gl := gl - 1
      else if gl = 0 && «стоитНа» cs i ['и', '«'] then break
      i := i + 1
    return some (String.ofList (cs.extract 0 i).toList)
  | _ => return none

def «разрезВыбора» (t : String) : Option (String × String × String) :=
  if !t.startsWith "если " then none else
  let h := t.«сн» 5
  if «сколькоСв» h " то " ≠ 1 || «сколькоСв» h " иначе " ≠ 1 then none else
  match «делСв» h " то " with
  | none => none
  | some (u, r) => match «делСв» r " иначе " with
    | none => none
    | some (a, b) =>
      let u := «обрезать» u; let a := «обрезать» a; let b := «обрезать» b
      if u ≠ "" && a ≠ "" && b ≠ "" then some (u, a, b) else none

def «разрезЦепочкой» (t : String) : Option (String × String × String) :=
  match «разрезВыбора» t with
  | some x => some x
  | none =>
    if !t.startsWith "если " then none else
    let h := t.«сн» 5
    match «делСв» h " то " with
    | none => none
    | some (u0, tail) => Id.run do
      let cs := tail.toList.toArray
      let mut gl : Int := 0
      let mut q := false
      let mut «откр» : Nat := if tail.startsWith "если " then 1 else 0
      let mut i := 0
      while i < cs.size do
        let c := cs[i]!
        if q then
          if c = '\\' && i + 1 < cs.size then i := i + 1
          else if c = '"' then q := false
          i := i + 1
          continue
        if c = '"' then q := true
        else if c = '(' then gl := gl + 1
        else if c = ')' then gl := gl - 1
        else if gl = 0 && c = ' ' then
          if «стоитНа» cs i " если ".toList then «откр» := «откр» + 1
          else if «стоитНа» cs i " иначе ".toList then
            if «откр» > 0 then «откр» := «откр» - 1
            else
              let u := «обрезать» u0
              let a := «обрезать» (String.ofList (cs.extract 0 i).toList)
              let b := «обрезать» (String.ofList (cs.extract (i + 7) cs.size).toList)
              return if u ≠ "" && a ≠ "" && b ≠ "" then some (u, a, b) else none
        i := i + 1
      return none

def «доводыВызоваС» (t : String) : List String := Id.run do
  let cs := t.toList.toArray
  let mut r : Array String := #[]
  let mut gl : Int := 0
  let mut q := false
  let mut «от» := 0
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
    else if c = '"' then q := true
    else if c = '(' then gl := gl + 1
    else if c = ')' then
      gl := gl - 1
      if gl < 0 then break
    else if gl = 0 && «стоитНа» cs i " и ".toList then
      if «стоитНа» cs i " и притом ".toList then return []
      r := r.push («обрезать» (String.ofList (cs.extract «от» i).toList))
      «от» := i + 3
      i := «от»
      continue
    i := i + 1
  let p := «обрезать» (String.ofList (cs.extract «от» i).toList)
  if p ≠ "" then r := r.push p
  return r.toList

def «отношенияС» : List String :=
  [" содержит ", " начинается с ", " не равен ", " равен ", " не меньше ", " не больше ", " меньше ", " больше ",
   " плюс ", " минус ", " и притом ", " равно "]

def «подстрокаЗнаков» (s : String) (a b : Int) : Option String :=
  if a < 1 || a > b || b > s.length then none
  else some (String.ofList ((s.toList.drop (a.toNat - 1)).take (b.toNat - a.toNat + 1)))

def «целоеЧ?» (x : Float) : Option Int :=
  if x.isNaN || x.isInf then none else
  let r := x.round
  if r != x then none else
  if x ≥ 0 then some (x.toUInt64.toNat : Int) else some (-((-x).toUInt64.toNat : Int))

def «Исх».«телоОднимРазбором» (s : «Исх») (a b : Nat) («довод» : String) : Nat := Id.run do
  let heads := ["принимает ", "возвращает ", "для всех ", "обеспечивает ", "пример ", "дано ", "ожидается "]
  let mut g := 0
  for i in s.«меж» a b do
    let z := s.«по» i
    if z = "" || z.startsWith "//" then continue
    if g = 0 then
      if z = s!"разбор «{«довод»}»" || z = s!"разбор {«довод»}" then
        g := i
        continue
      if !heads.any (z.startsWith ·) then return 0
    else if !z.startsWith "случай " && !z.startsWith "то " then return 0
  return g

def «Исх».«ветвьТела» (s : «Исх») (a b : Nat) («образец» : String) : String :=
  ((List.range' a (b - a)).find? (fun i => s.«по» i = s!"случай {«образец»}" && i + 1 < b && (s.«по» (i + 1)).startsWith "то ")).map
    (fun i => «словаС» (s.«по» (i + 1)) 1) |>.getD ""

def «ветвьСоседки» (s : «Исх») (e : «Среда») (t : String) : Option String := do
  let («дс», «обр», «пр») ← e.«сосед»
  let (l, r) ← «делСв» t " от "
  let «имяФ» := «обрезать» l
  let «довод» := «безВнешних» r
  let f := «ёлочка» «имяФ» 1
  if f = "" || «имяФ» ≠ s!"«{f}»" || !(«довод» = s!"«{«дс»}»" || «довод» = «дс») then none
  let (a2, b2) ← s.«блокС» f
  if s.«строкаПринимает» a2 b2 ≠ «пр» || s.«телоОднимРазбором» a2 b2 «дс» = 0 then none
  let v := s.«ветвьТела» a2 b2 «обр»
  let v := if v = "" && «обр».startsWith "вариант «" then s.«ветвьТела» a2 b2 («обр».«сн» 8) else v
  if v = "" then none else some v

structure «Счёт» where
  «исх» : «Исх»
  «огл» : List String := []

abbrev «М» := StateM Nat

mutual

partial def «оценить» (c : «Счёт») (e : «Среда») («сырой» : String) («гл» : Nat) : «М» «Зн» := do
  if «гл» = 0 then set 0
  if «гл» > 32 then return .«нет»
  let n ← get
  set (n + 1)
  if n + 1 > 200000 then return .«нет»
  let t := «безВнешних» «сырой»
  if t = "" then return .«нет»
  if !t.startsWith "свёртка " && !t.startsWith "если " && !t.startsWith "отфильтровать " then
    if let some (g, k) := «найтиСв» t «отношенияС» then
      return ← «отношение» c e t g k «гл»
  if t = "результат" then return e.«рез»
  if t = "да" then return .«приз» true
  if t = "нет" then return .«приз» false
  if t = "пустой список" then return .«спис» "[]" 0
  let «тег» := «ёлочка» t 1
  if «тег» ≠ "" && t = s!"вариант «{«тег»}»" then return .«тег» t
  if t.startsWith "вариант «" && (t.splitOn "» с ").length > 1 then return ← «варианта» c e t «гл»
  if let some z := e.«найти» t then return z
  if let some s := «литерал?» t then return .«стр» s
  if let some x := «числоТочно» t then
    if t.startsWith "-" && x == 0 then return .«нет»
    return .«чис» x
  let «им» := «ёлочка» t 1
  if «им» ≠ "" && t = s!"«{«им»}»" then
    let z := c.«исх».«телоТаблицы» «им»
    if z ≠ "" then
      if let some v := «литерал?» z then return .«стр» v
    return c.«исх».«таблицаСписком» c.«огл» «им»
  let bp := «безПробеловВнеКавычек» t
  if bp.length ≥ 2 && bp.startsWith "[" && bp.endsWith "]" && «кавычкиЧисты» t then
    let ps := «членыСписка» bp
    if !ps.isEmpty then return .«спис» bp ps.length
    if bp.length = 2 then return .«спис» bp 0
  if t.startsWith "длина " then
    let a ← «оценить» c e (t.«сн» 6) («гл» + 1)
    return match a with
      | .«спис» _ k => .«чис» k.toFloat
      | .«длн» k => .«чис» k.toFloat
      | .«стр» s => .«чис» s.length.toFloat
      | _ => .«нет»
  if t.startsWith "соединить " then
    if let some (l, r) := «делСв» (t.«сн» 10) " по " then
      let sp ← «оценить» c e l («гл» + 1)
      let raz ← «оценить» c e r («гл» + 1)
      match sp, raz with
      | .«спис» st _, .«стр» rs =>
        let mut parts : Array String := #[]
        for m in «членыСписка» st do
          match ← «оценить» c e m («гл» + 1) with
          | .«стр» x => parts := parts.push x
          | _ => return .«нет»
        return .«стр» (rs.intercalate parts.toList)
      | _, _ => return .«нет»
  if t.startsWith "разделить " then
    if let some (l, r) := «делСв» (t.«сн» 10) " по " then
      let st ← «оценить» c e l («гл» + 1)
      let raz ← «оценить» c e r («гл» + 1)
      match st, raz with
      | .«стр» x, .«стр» rs =>
        if rs = "" then return .«нет»
        let ps := x.splitOn rs
        return .«спис» ("[" ++ ",".intercalate (ps.map «вЛитерал») ++ "]") ps.length
      | _, _ => return .«нет»
  if t.startsWith "подстрока " then
    let h := t.«сн» 10
    match «делСв» h " с " with
    | none => return .«нет»
    | some (xs, r) => match «делСв» r " по " with
      | none => return .«нет»
      | some (ps, qs) =>
        let x ← «оценить» c e xs («гл» + 1)
        let p ← «оценить» c e ps («гл» + 1)
        let q ← «оценить» c e qs («гл» + 1)
        match x, p, q with
        | .«стр» s, .«чис» pa, .«чис» qa =>
          match «целоеЧ?» pa, «целоеЧ?» qa with
          | some a1, some b1 => return match «подстрокаЗнаков» s a1 b1 with
            | some r => .«стр» r
            | none => .«нет»
          | _, _ => return .«нет»
        | _, _, _ => return .«нет»
  if let some (u, a, b) := «разрезЦепочкой» t then
    match ← «оценить» c e u («гл» + 1) with
    | .«приз» v => return ← «оценить» c e (if v then a else b) («гл» + 1)
    | _ => return .«нет»
  if let some v := «ветвьСоседки» c.«исх» e t then return ← «оценить» c { e with «рез» := .«нет» } v («гл» + 1)
  let z ← «вызова» c e t «гл»
  if z.«есть» then return z
  if t.startsWith "голова " then
    match ← «оценить» c e (t.«сн» 7) («гл» + 1) with
    | .«спис» st _ => match «членыСписка» st with
      | m :: _ => return ← (if m.startsWith "(запись«" then pure (.«зап» m) else «оценить» c e m («гл» + 1))
      | [] => return .«нет»
    | _ => return .«нет»
  match t.toList.reverse.findIdx? (· = '.') with
  | some k =>
    let pos := t.length - 1 - k
    if pos > 0 then
      let «за» := «отЗнака» t (pos + 1)
      let «поле» := «ёлочка» «за» 1
      if «поле» ≠ "" && «за» = s!"«{«поле»}»" then
        match ← «оценить» c e («доЗнака» t pos) («гл» + 1) with
        | .«зап» rec => match «полеЗаписи» rec «поле» with
          | some v => return ← «оценить» c e v («гл» + 1)
          | none => return .«нет»
        | _ => return .«нет»
  | none => pure ()
  if t.startsWith "свёртка " && e.«св» < 8 then return ← «свёртки» c e t «гл»
  if t.startsWith "отфильтровать " then return ← «отбора» c e t «гл»
  return .«нет»

partial def «отношение» (c : «Счёт») (e : «Среда») (t : String) (g k «гл» : Nat) : «М» «Зн» := do
  let op := «отношенияС».getD k ""
  let a ← «оценить» c e («доЗнака» t g) («гл» + 1)
  let b ← «оценить» c e («отЗнака» t (g + op.length)) («гл» + 1)
  if !a.«есть» || !b.«есть» then return .«нет»
  if k = 0 || k = 1 then
    return match a, b with
      | .«стр» x, .«стр» y => .«приз» (if k = 0 then ((x.splitOn y).length > 1 || y = "") else x.startsWith y)
      | _, _ => .«нет»
  if k = 2 || k = 3 || k = 11 then
    if a.«вид» ≠ b.«вид» || a.«мера?» then return .«нет»
    return match «равныЗн» a b with
      | some v => .«приз» (if k = 2 then !v else v)
      | none => .«нет»
  if k = 10 then
    return match a, b with
      | .«приз» x, .«приз» y => .«приз» (x && y)
      | _, _ => .«нет»
  match a, b with
  | .«чис» x, .«чис» y =>
    return match k with
      | 4 => .«приз» (x ≥ y)
      | 5 => .«приз» (x ≤ y)
      | 6 => .«приз» (x < y)
      | 7 => .«приз» (x > y)
      | 8 => .«чис» (x + y)
      | _ => .«чис» (x - y)
  | _, _ => return .«нет»

partial def «варианта» (c : «Счёт») (e : «Среда») (t : String) («гл» : Nat) : «М» «Зн» := do
  match «поляС» t " равным " with
  | none => return .«нет»
  | some (nms, tms) =>
    let mut acc : Array (String × «Зн») := #[]
    for (n, x) in nms.zip tms do
      let z ← «оценить» c e x («гл» + 1)
      match z with
      | .«стр» _ | .«приз» _ => acc := acc.push (n, z)
      | .«чис» v => if v == 0 && 1.0 / v < 0 then return .«нет» else acc := acc.push (n, z)
      | _ => return .«нет»
    return .«вар» («ёлочка» t 1) acc.toList

partial def «вызова» (c : «Счёт») (e : «Среда») (t : String) («гл» : Nat) : «М» «Зн» := do
  match «делСв» t " от " with
  | none => return .«нет»
  | some (l, r) =>
    let «лев» := «обрезать» l
    let f := «ёлочка» «лев» 1
    if f = "" || «лев» ≠ s!"«{f}»" then return .«нет»
    «применить» c e f («доводыВызоваС» r) «гл»

partial def «применить» (c : «Счёт») (e : «Среда») (f : String) («дов» : List String) («гл» : Nat) : «М» «Зн» := do
  if «дов».length < 1 || «дов».length > 4 then return .«нет»
  let s := c.«исх»
  match s.«блокС» f with
  | none => return .«нет»
  | some (a, b) =>
    if !(s.«по» a).startsWith "тотальная функция «" then return .«нет»
    let «имена» := «именаДоводовС» (s.«строкаПринимает» a b)
    if «имена».length ≠ «дов».length then return .«нет»
    let mut vals : Array «Зн» := #[]
    for d in «дов» do
      let z ← «оценить» c e d («гл» + 1)
      if !z.«есть» then return .«нет»
      vals := vals.push z
    let mut e2 := { e with «рез» := .«нет» }
    for (n, z) in «имена».zip vals.toList do
      match e2.«связать» n z with
      | some e3 => e2 := e3
      | none => return .«нет»
    «тела» c e2 a b «гл»

partial def «тела» (c : «Счёт») (e : «Среда») (a b «гл» : Nat) : «М» «Зн» := do
  let s := c.«исх»
  match s.«строкаРазбора» a b with
  | some (g, «что») =>
    let z ← «оценить» c e «что» («гл» + 1)
    if !z.«есть» then return .«нет»
    match z with
    | .«спис» _ _ | .«вар» _ _ => «ветвьРазбора» c e g b z «гл»
    | _ =>
      let v := s.«ветвьПоЗначению» a b z
      if v = "" then return .«нет»
      «оценить» c e v («гл» + 1)
  | none =>
    let t := s.«телоТекстом» a b
    if t = "" then return .«нет»
    «оценить» c e t («гл» + 1)

partial def «ветвьРазбора» (c : «Счёт») (e : «Среда») (g b : Nat) (z : «Зн») («гл» : Nat) : «М» «Зн» := do
  let s := c.«исх»
  let «чл» := match z with | .«спис» st _ => «членыСписка» st | _ => []
  let «пуст» := match z with | .«спис» _ n => «чл».isEmpty && n ≠ 0 | _ => false
  if !s.«ветвиПарами» g b || «пуст» then return .«нет»
  let mut «неясно» := false
  let mut i := g + 1
  while i + 1 < b do
    let l := s.«по» i
    let o := «словаС» l 1
    let «то» := «словаС» (s.«по» (i + 1)) 1
    let wsx := o.splitOn " "
    if !l.startsWith "случай " then
      i := i + 1
      continue
    match z with
    | .«спис» _ _ =>
      if «чл».isEmpty then
        if o = "пусто" then return ← «оценить» c e «то» («гл» + 1)
        i := i + 1
        continue
      if o ≠ "голова и хвост" && !(wsx.length = 5 && wsx.getD 0 "" = "голова" && wsx.getD 2 "" = "и" && wsx.getD 3 "" = "хвост") then
        i := i + 1
        continue
      let m0 := «чл».headD ""
      let hv ← if m0.startsWith "(запись«" then pure (.«зап» m0) else «оценить» c e m0 («гл» + 1)
      let rst := «чл».drop 1
      let (e1, k1) := e.«связатьОба» (if wsx.length = 5 then wsx.getD 1 "" else "голова") hv
      let (e2, k2) := e1.«связатьОба» (if wsx.length = 5 then wsx.getD 4 "" else "хвост") (.«спис» ("[" ++ ",".intercalate rst ++ "]") rst.length)
      if k1 + k2 = 4 then return ← «оценить» c e2 «то» («гл» + 1)
      return .«нет»
    | .«вар» vn vf =>
      if o = "любое" then return ← (if «неясно» then pure .«нет» else «оценить» c e «то» («гл» + 1))
      let o2 := if o.startsWith "вариант " then o.«сн» 8 else o
      if «ёлочка» o2 1 ≠ vn then
        «неясно» := «неясно» || «ёлочка» o2 1 = ""
        i := i + 1
        continue
      if (o2.splitOn "» с ").length > 1 then
        match «поляС» o2 " как " with
        | none => return .«нет»
        | some (nms, tms) =>
          if vf.isEmpty then return .«нет»
          let mut e2 := e
          let mut k := 0
          for (n, x) in nms.zip tms do
            match vf.find? (·.1 = n) with
            | some (_, fv) =>
              let (e3, kk) := e2.«связатьОба» x fv
              e2 := e3
              k := k + kk
            | none => pure ()
          if k = 2 * nms.length then return ← «оценить» c e2 «то» («гл» + 1)
          return .«нет»
      return ← «оценить» c e «то» («гл» + 1)
    | _ => return .«нет»
  return .«нет»

partial def «свёртки» (c : «Счёт») (e : «Среда») (t : String) («гл» : Nat) : «М» «Зн» := do
  let h := t.«сн» 8
  let some (spT, h1) := «делСв» h " начиная с " | return .«нет»
  let some (startT, h2) := «делСв» h1 " как " | return .«нет»
  let some (accN0, h3) := «делСв» h2 " и " | return .«нет»
  let some (elW0, bodyT0) := «делСв» h3 " → " | return .«нет»
  let accN := «обрезать» accN0
  let elW := «обрезать» elW0
  let bodyT := «обрезать» bodyT0
  let elN := «ёлочка» elW 1
  if elN ≠ "" then
    if s!"«{elN}»" ≠ elW then return .«нет»
  else if (elW.splitOn " ").length > 1 || elW = "" then return .«нет»
  if accN = "" || (accN.splitOn " ").length > 1 then return .«нет»
  let spB := «безВнешних» spT
  let suf := " на символы"
  let mut members : List «Зн» ⊕ List String := .inr []
  if spB.startsWith "разложить " && spB.length > 10 + suf.length && spB.endsWith suf then
    let base ← «оценить» c e ((spB.«сн» 10).«снК» suf.length) («гл» + 1)
    match base with
    | .«стр» s => members := .inl (s.toList.map (fun ch => .«стр» (String.singleton ch)))
    | _ => return .«нет»
  else
    match ← «оценить» c e spB («гл» + 1) with
    | .«спис» st n =>
      let ps := «членыСписка» st
      if ps.isEmpty && n ≠ 0 then return .«нет»
      members := .inr ps
    | _ => return .«нет»
  let mut acc ← «оценить» c e startT («гл» + 1)
  if !acc.«есть» then return .«нет»
  let frame := fun (a x : «Зн») => { e with «связи» := (accN, a) :: (elW, x) :: e.«связи», «св» := e.«св» + 1 }
  let mut prevA : «Зн» := .«нет»
  let mut prevX : «Зн» := .«нет»
  let items : List («Зн» ⊕ String) := match members with
    | .inl zs => zs.map Sum.inl
    | .inr ms => ms.map Sum.inr
  for it in items do
    let x ← match it with
      | .inl z => pure z
      | .inr m => if m.startsWith "(запись«" then pure (.«зап» m) else «оценить» c (frame prevA prevX) m («гл» + 1)
    if !x.«есть» then
      acc := .«нет»
      break
    prevA := acc
    prevX := x
    acc ← «оценить» c (frame acc x) bodyT («гл» + 1)
    if !acc.«есть» then break
  return acc

partial def «отбора» (c : «Счёт») (e : «Среда») (t : String) («гл» : Nat) : «М» «Зн» := do
  let h := t.«сн» 14
  let some (spT, r) := «делСв» h " где " | return .«нет»
  let some (x0, y) := «делСв» r " → " | return .«нет»
  let x := «обрезать» x0
  match ← «оценить» c e spT («гл» + 1) with
  | .«спис» st n =>
    let ps := «членыСписка» st
    if ps.isEmpty && n ≠ 0 then return .«нет»
    let mut keep : Array String := #[]
    for m in ps do
      let z ← if m.startsWith "(запись«" then pure (.«зап» m) else «оценить» c e m («гл» + 1)
      if !z.«есть» then return .«нет»
      let some e2 := e.«связать» x z | return .«нет»
      match ← «оценить» c e2 y («гл» + 1) with
      | .«приз» v => if v then keep := keep.push m
      | _ => return .«нет»
    return .«спис» ("[" ++ ",".intercalate keep.toList ++ "]") keep.size
  | _ => return .«нет»

end

def «значениеС» (c : «Счёт») (t : String) : «Зн» := ((«оценить» c {} t 0).run 0).1

end «Второй»
