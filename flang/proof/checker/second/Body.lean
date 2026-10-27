import Evaluator

open «Разбор»

namespace «Второй»

def «разрезСл» (t w : String) : Option (String × String) :=
  match «делСв» t w with
  | none => none
  | some (l0, p0) =>
    let l := «обрезать» l0
    let p := «обрезать» p0
    if l = "" || p = "" || («найтиСв» p [w]).isSome then none else some (l, p)

def «разрезРавенства» (t : String) : Option (String × String) :=
  («разрезСл» t " равен ").orElse (fun _ => «разрезСл» t " равно ")

def «простойС» (t : String) : Bool := let u := «обрезать» t; «однаПараТ» u || !((u.splitOn " ").length > 1)

def «естьСвязыватель» (t : String) : Bool :=
  ["пусть ", "разбор ", "свёртка ", "отобразить ", "отфильтровать ", "случай "].any fun w =>
    t.startsWith w || (t.splitOn (" " ++ w)).length > 1

def «знакиТерма» : List String :=
  [" умножить на ", " делить на ", " остаток от деления на ", " плюс ", " минус ", " и притом ", " или ",
   " содержит ", " начинается с ", " кончается на ", " не равен ", " равен ", " не меньше ", " не больше ",
   " меньше ", " больше "]

def «одинУзел» (t «знак» : String) : Option (String × String) :=
  if (t.splitOn "[").length > 1 || (t.splitOn "]").length > 1 then none else
  match «найтиСв» t «знакиТерма» with
  | none => none
  | some (g, k) =>
    if «знакиТерма».getD k "" ≠ «знак» then none else
    let l := «обрезать» («доЗнака» t g)
    let p := «обрезать» («отЗнака» t (g + «знак».length))
    if l = "" || p = "" then none
    else if («найтиСв» l «знакиТерма»).isSome || («найтиСв» p «знакиТерма»).isSome then none
    else some (l, p)

partial def «свести» («сырой» : String) («гл» : Nat) : String :=
  let t := «ужатьТ» («обрезать» «сырой»)
  if «гл» = 0 then t
  else if t.startsWith "длина " then
    let a := «свести» (t.«сн» 6) («гл» - 1)
    match «разрезСл» a " к " with
    | some (l, p) =>
      if l.startsWith "добавить " || l.startsWith "приписать " then
        s!"{«вСкобки» («свести» s!"длина {«вСкобки» p}" («гл» - 1))} плюс 1"
      else «длинаДальше» a
    | none => «длинаДальше» a
  else if t.startsWith "элемент " then
    match «разрезСл» («обрезать» (t.«сн» 8)) " в " with
    | none => t
    | some (nom, sp) =>
      let n := «свести» nom («гл» - 1)
      let sp2 := «свести» sp («гл» - 1)
      let v := «числоТочно» n
      let vi : Option Int := v.bind «целоеЧ?»
      let viaK : Option String := match «разрезСл» sp2 " к " with
        | some (l, p) =>
          let tl2 := «свести» p («гл» - 1)
          let r1 : Option String := if l.startsWith "приписать " then
              (match vi with
               | some 1 => some («свести» («словаС» l 1) («гл» - 1))
               | some k => if k ≥ 2 then some («свести» s!"элемент {k - 1} в {«вСкобки» tl2}" («гл» - 1)) else none
               | none => none)
            else none
          r1.orElse fun _ =>
            if l.startsWith "добавить " && (n = s!"( длина {«вСкобки» tl2} ) плюс 1" || n = s!"1 плюс ( длина {«вСкобки» tl2} )") then
              some («свести» («словаС» l 1) («гл» - 1))
            else none
        | none => none
      match viaK with
      | some r => r
      | none =>
        let ms := «членыСписка» sp2
        match vi with
        | some k => if !ms.isEmpty && k ≥ 1 && k ≤ ms.length then «свести» (ms.getD (k.toNat - 1) "") («гл» - 1)
                    else s!"элемент {«вСкобки» n} в {«вСкобки» sp2}"
        | none => s!"элемент {«вСкобки» n} в {«вСкобки» sp2}"
  else t
where
  «длинаДальше» (a : String) : String :=
    match «разрезСл» a " с " with
    | some (l, p) =>
      if l.startsWith "соединить " then
        s!"{«вСкобки» («свести» s!"длина {«вСкобки» («словаС» l 1)}" («гл» - 1))} плюс {«вСкобки» («свести» s!"длина {«вСкобки» p}" («гл» - 1))}"
      else «длинаТретье» a
    | none => «длинаТретье» a
  «длинаТретье» (a : String) : String :=
    match «разрезСл» a " на " with
    | some (l, p) =>
      if l.startsWith "разложить " && p = "символы" then «свести» s!"длина {«вСкобки» («словаС» l 1)}" («гл» - 1)
      else «длинаЧетвёртое» a
    | none => «длинаЧетвёртое» a
  «длинаЧетвёртое» (a : String) : String :=
    match «разрезСл» a " как " with
    | some (l, _) =>
      if l.startsWith "отобразить " then «свести» s!"длина {«вСкобки» («словаС» l 1)}" («гл» - 1)
      else s!"длина {«вСкобки» a}"
    | none => s!"длина {«вСкобки» a}"

def «равныЗнС» (a b : «Зн») : Option Bool :=
  if a.«вид» ≠ b.«вид» || a.«мера?» then none else «равныЗн» a b

partial def «тождественны» (c : «Счёт») («са» «сб» : String) («гл» : Nat) : Bool :=
  let a := «свести» «са» «гл»
  let b := «свести» «сб» «гл»
  if a = b then true
  else if «гл» > 0 && [" плюс ", " умножить на "].any (fun w =>
      match «одинУзел» a w, «одинУзел» b w with
      | some (a1, a2), some (b1, b2) =>
        («тождественны» c a1 b1 («гл» - 1) && «тождественны» c a2 b2 («гл» - 1)) ||
        («тождественны» c a1 b2 («гл» - 1) && «тождественны» c a2 b1 («гл» - 1))
      | _, _ => false) then true
  else
    match «равныЗнС» («значениеС» c a) («значениеС» c b) with
    | some v => v
    | none => false

def «стороныРазошлись» (c : «Счёт») («са» «сб» : String) : Bool :=
  let za := «значениеС» c («свести» «са» 8)
  let zb := «значениеС» c («свести» «сб» 8)
  if !za.«есть» || za.«вид» ≠ zb.«вид» then false else
  match za, zb with
  | .«стр» x, .«стр» y => x != y
  | .«спис» x _, .«спис» y _ => x != y
  | .«тег» x, .«тег» y => x != y
  | .«чис» x, .«чис» y => !x.isNaN && !y.isNaN && !«одноЧисло» x y
  | .«приз» x, .«приз» y => x != y
  | .«длн» x, .«длн» y => x != y
  | _, _ => false

/-- `найти_сверху` сверщика на C: как `найтиСв`, но имя в «ёлочках» — одно слово, какие бы
    слова ни стояли внутри: «Значение или запасное» не связка. -/
def «найтиСвЁ» (t : String) (ops : List String) : Option (Nat × Nat) := Id.run do
  let cs := t.toList.toArray
  let ws := ops.map String.toList
  let mut gl : Int := 0
  let mut q := false
  let mut el : Nat := 0
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      i := i + 1
      continue
    if c = '«' then
      el := el + 1
      i := i + 1
      continue
    if c = '»' then
      if el > 0 then el := el - 1
      i := i + 1
      continue
    if el > 0 then
      i := i + 1
      continue
    if c = '(' then gl := gl + 1
    else if c = ')' then gl := gl - 1
    else if gl = 0 && c = ' ' then
      let mut k := 0
      for w in ws do
        if «стоитНа» cs i w then return some (i, k)
        k := k + 1
    i := i + 1
  return none

/-- Варианты с разными метками не равны никогда, какими бы ни были поля (`метки_разошлись`
    сверщика на C): атом `вариант «A» … равен вариант «B» …` ложен, `не равен` — истинен. -/
def «меткиРазошлись» (t0 : String) : Option Bool :=
  let t := «безВнешних» t0
  let ops := [" не меньше ", " не больше ", " не равен ", " не равно ", " равен ", " равно ", " меньше ", " больше ", " равна "]
  let more := [" и притом ", " или ", " то ", " иначе ", " содержит ", " начинается с ", " кончается на "] ++ ops
  if t = "" || t.startsWith "если " || t.startsWith "не " || «естьСвязыватель» t then none else
  match «найтиСвЁ» t ops with
  | none => none
  | some (g, k) =>
    let l := «доЗнака» t g
    let p := «отЗнака» t (g + (ops.getD k "").length)
    if («найтиСвЁ» p more).isSome || («найтиСвЁ» l more).isSome || l.startsWith "если " || l.startsWith "не " then none else
    let a := «безВнешних» («ужатьТ» («безВнешних» l))
    let b := «безВнешних» («ужатьТ» («безВнешних» p))
    if !([2, 3, 4, 5, 8].contains k) || a = "" || b = "" then none
    else if a.startsWith "вариант «" && b.startsWith "вариант «" && «ёлочка» a 1 ≠ «ёлочка» b 1 then some (k = 2 || k = 3)
    else none

partial def «значМоё» (c : «Счёт») («сырой» : String) («гл» : Nat) : «Зн» :=
  let t := «безВнешних» «сырой»
  let z := «значениеС» c t
  if z.«есть» || «гл» > 6 then z else
  if let some v := «меткиРазошлись» t then .«приз» v else
  let bp := «безПробеловВнеКавычек» t
  if bp.length ≥ 2 && bp.startsWith "[" && bp.endsWith "]" && «кавычкиЧисты» t then .«спис» bp («членыСписка» t).length
  else if t.startsWith "длина " then
    match «значМоё» c (t.«сн» 6) («гл» + 1) with
    | .«спис» _ n => .«чис» n.toFloat
    | _ => .«нет»
  else match «найтиСв» t «отношенияС» with
  | none => .«нет»
  | some (g, k) =>
    let ls := «доЗнака» t g
    let a := «значМоё» c ls («гл» + 1)
    let b := «значМоё» c («отЗнака» t (g + («отношенияС».getD k "").length)) («гл» + 1)
    if !a.«есть» || !b.«есть» then .«нет»
    else if k = 0 && a.«вид» = 4 then
      if («членыСписка» («безВнешних» ls)).any (fun m =>
          let x := «значМоё» c m («гл» + 1)
          !x.«мера?» && «равныЗнС» x b = some true) then .«приз» true else .«нет»
    else if k = 2 || k = 3 || k = 11 then
      match «равныЗнС» a b with
      | some v => .«приз» (if k = 2 then !v else v)
      | none => .«нет»
    else match a, b with
      | .«чис» x, .«чис» y =>
        match k with
        | 4 => .«приз» (x ≥ y)
        | 5 => .«приз» (x ≤ y)
        | 6 => .«приз» (x < y)
        | 7 => .«приз» (x > y)
        | _ => .«нет»
      | _, _ => .«нет»

def «законПризнакаС» («внутри» : String) : Option String :=
  let t := «обрезать» «внутри»
  if t.startsWith "не " && «простойС» (t.«сн» 3) then
    let v := «безВнешних» (t.«сн» 3)
    if v = "да" then some "нет" else if v = "нет" then some "да" else none
  else match «найтиСв» t [" и притом ", " или "] with
  | none => none
  | some (g, k) =>
    let w := if k = 0 then " и притом " else " или "
    if «сколькоСв» t w ≠ 1 then none else
    let l0 := «доЗнака» t g
    let p0 := «отЗнака» t (g + w.length)
    if !«простойС» l0 || !«простойС» p0 then none else
    let l := «безВнешних» l0
    let p := «безВнешних» p0
    if k = 0 then
      if l = "да" then some p else if p = "да" then some l
      else if l = "нет" || p = "нет" then some "нет" else none
    else
      if l = "нет" then some p else if p = "нет" then some l
      else if l = "да" || p = "да" then some "да" else none

def «сжатьВыборы» («сырой» : String) : String := Id.run do
  let mut t := «обрезать» «сырой»
  for _ in [0:16] do
    let cs := t.toList.toArray
    let mut st : Array Nat := #[]
    let mut gl : Int := 0
    let mut q := false
    let mut «новый» : Option String := none
    let mut i := 0
    while i < cs.size do
      let c := cs[i]!
      if q then
        if c = '\\' && i + 1 < cs.size then i := i + 1
        else if c = '"' then q := false
        i := i + 1
        continue
      if c = '"' then
        q := true
        i := i + 1
        continue
      if c = '(' then
        if gl < 32 then st := st.push i
        gl := gl + 1
        i := i + 1
        continue
      if c ≠ ')' then
        i := i + 1
        continue
      gl := gl - 1
      if gl < 0 || gl ≥ 32 then break
      let «нач» := st[gl.toNat]!
      st := st.extract 0 gl.toNat
      let «внутри» := «обрезать» (String.ofList (cs.extract («нач» + 1) i).toList)
      let mut «новое» : Option String := none
      if let some (u, a, b) := «разрезВыбора» «внутри» then
        let uu := «безВнешних» u
        if uu = "да" then «новое» := some a
        if uu = "нет" then «новое» := some b
      if «новое».isNone then «новое» := «законПризнакаС» «внутри»
      match «новое» with
      | some n =>
        «новый» := some (String.ofList (cs.extract 0 «нач»).toList ++ "( " ++ n ++ " )" ++ String.ofList (cs.extract (i + 1) cs.size).toList)
        break
      | none => i := i + 1
    match «новый» with
    | some n => t := n
    | none => break
  return t

def «местоЗамены» (cs : Array Char) (i d : Nat) : Bool :=
  let «слева» := i = 0 || ["( ", "если ", " то ", " иначе ", " и притом ", " или ", "не "].any (fun w =>
    i ≥ w.length && (cs.extract (i - w.length) i).toList == w.toList)
  let «справа» := i + d = cs.size || [" )", " то ", " иначе ", " и притом ", " или "].any (fun w => «стоитНа» cs (i + d) w.toList)
  «слева» && «справа»

def «подставитьУсловие» (t u «на» : String) : String × Nat := Id.run do
  let d := u.length
  if d = 0 then return (t, 0)
  let cs := t.toList.toArray
  let uc := u.toList
  let mut out : Array Char := #[]
  let mut n := 0
  let mut q := false
  let mut el : Nat := 0
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      out := out.push c
      if c = '\\' && i + 1 < cs.size then
        out := out.push cs[i + 1]!
        i := i + 2
        continue
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      out := out.push c
      i := i + 1
      continue
    -- 8192: условие может начинаться с имени в ёлочках («скидка» не больше 30) — оно
    -- ищется до того, как ёлочка уводит чтение внутрь имени.
    if c = '«' && el = 0 && «стоитНа» cs i uc && «местоЗамены» cs i d then
      out := out ++ «на».toList.toArray
      n := n + 1
      i := i + d
      continue
    if c = '«' then
      el := el + 1
      out := out.push c
      i := i + 1
      continue
    if c = '»' then
      if el > 0 then el := el - 1
      out := out.push c
      i := i + 1
      continue
    if el > 0 then
      out := out.push c
      i := i + 1
      continue
    if «стоитНа» cs i uc && «местоЗамены» cs i d then
      out := out ++ «на».toList.toArray
      n := n + 1
      i := i + d
      continue
    out := out.push c
    i := i + 1
  return (String.ofList out.toList, n)

def «атомУсловия» («сырой» : String) : String × Bool := Id.run do
  let mut u := «безВнешних» «сырой»
  let mut n := false
  for _ in [0:u.length + 1] do
    if u.startsWith "не " && «простойС» (u.«сн» 3) then
      u := «безВнешних» (u.«сн» 3)
      n := !n
    else break
  return (u, n)

def «оговоркаОКонечности» (c : «Счёт») (t : String) : Option (String × String) := do
  let (g, _) ← «найтиСв» t [" или "]
  let «левый» := «безВнешних» («доЗнака» t g)
  if !«левый».startsWith "не " then none
  let «внутри» := «безВнешних» («левый».«сн» 3)
  let (g2, _) ← «найтиСв» «внутри» [" равен "]
  let «слева» := «безВнешних» («доЗнака» «внутри» g2)
  let «справа» := «безВнешних» («отЗнака» «внутри» (g2 + 7))
  if «справа» ≠ "0" then none
  let (g3, _) ← «найтиСв» «слева» [" минус "]
  let m1 := «безВнешних» («доЗнака» «слева» g3)
  let m2 := «безВнешних» («отЗнака» «слева» (g3 + 7))
  if !«тождественны» c m1 m2 0 then none
  pure (m1, «безВнешних» («отЗнака» t (g + 5)))

def «квадратПодОговоркой» (c : «Счёт») (t : String) («конечен» : Option String) : Bool :=
  match «конечен» with
  | none => false
  | some k =>
    match «найтиСв» t [" не меньше "] with
    | none => false
    | some (g, _) =>
      let l := «безВнешних» («доЗнака» t g)
      let p := «безВнешних» («отЗнака» t (g + 11))
      if p ≠ "0" then false else
      match «найтиСв» l [" умножить на "] with
      | none => false
      | some (g2, _) =>
        let e1 := «безВнешних» («доЗнака» l g2)
        let e2 := «безВнешних» («отЗнака» l (g2 + 13))
        «тождественны» c e1 e2 0 && «тождественны» c e1 k 0

def «мераНеотрицательна» (t : String) : Bool :=
  match «найтиСв» t [" не меньше "] with
  | none => false
  | some (g, _) =>
    let l := «безВнешних» («доЗнака» t g)
    let p := «безВнешних» («отЗнака» t (g + 11))
    p = "0" && («безВнешних» («свести» l 4)).startsWith "длина "

def «началоПоПостроению» (c : «Счёт») (t : String) : Bool :=
  match «найтиСв» t [" начинается с "] with
  | none => false
  | some (g, _) =>
    let l := «безВнешних» («доЗнака» t g)
    let p := «безВнешних» («отЗнака» t (g + 14))
    if p = "\"\"" then true else
    match «разрезСл» («безВнешних» l) " с " with
    | none => false
    | some («левый», _) =>
      if !«левый».startsWith "соединить " then false else
      let h := «словаС» «левый» 1
      if «тождественны» c h p 6 then true else
      match «значениеС» c h, «значениеС» c p with
      | .«стр» x, .«стр» y => x.startsWith y
      | _, _ => false

def «первоеУсловие» (t : String) : Option String := Id.run do
  let cs := t.toList.toArray
  let mut q := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      i := i + 1
      continue
    if (i = 0 || cs[i - 1]! = ' ') && «стоитНа» cs i "если ".toList then
      let h := String.ofList (cs.extract (i + 5) cs.size).toList
      match «найтиСв» h [" то "] with
      | none => return none
      | some (g, _) =>
        let u := «безВнешних» («доЗнака» h g)
        return if u ≠ "" then some u else none
    i := i + 1
  return none

partial def «первыйАтом» (c : «Счёт») («сырой» : String) : Option String :=
  let t := «безВнешних» «сырой»
  if t = "да" || t = "нет" || «естьСвязыватель» t then none
  else if t.startsWith "не " && «простойС» (t.«сн» 3) then «первыйАтом» c (t.«сн» 3)
  else match «найтиСв» t [" и притом ", " или "] with
  | some (g, k) =>
    («первыйАтом» c («доЗнака» t g)).orElse (fun _ => «первыйАтом» c («отЗнака» t (g + (if k = 0 then 10 else 5))))
  | none =>
    if t.startsWith "если " || («значМоё» c t 0).«есть» then none else some t

def «простойИлиНе» (t : String) : Bool :=
  let u := «обрезать» t
  «простойС» u || (u.startsWith "не " && «простойС» (u.«сн» 3))

def «числоТ» (x : String) : Option Int :=
  let u := «ужатьТ» x
  if u.startsWith "-" then («целоеТ?» (u.«сн» 1)).map (fun n => -(n : Int)) else («целоеТ?» u).map (fun n => (n : Int))

def «вариантТ» (x : String) : String :=
  let u := «ужатьТ» x
  if u.startsWith "вариант «" then «ёлочка» u 1 else ""

structure «Границы» where
  «низ» : Option (Int × Bool) := none
  «верх» : Option (Int × Bool) := none

def «сНизом» (g : «Границы») (b : Int × Bool) : «Границы» :=
  match g.«низ» with
  | none => { g with «низ» := some b }
  | some a => if b.1 > a.1 || (b.1 = a.1 && !b.2 && a.2) then { g with «низ» := some b } else g

def «сВерхом» (g : «Границы») (b : Int × Bool) : «Границы» :=
  match g.«верх» with
  | none => { g with «верх» := some b }
  | some a => if b.1 < a.1 || (b.1 = a.1 && !b.2 && a.2) then { g with «верх» := some b } else g

def «сравнениеБ» (t : String) : Option (String × Nat × String) :=
  let ops := [" не меньше ", " не больше ", " равен ", " меньше ", " больше "]
  match «найтиСв» t ops with
  | none => none
  | some (g, k) => some («безВнешних» («доЗнака» t g), k, «безВнешних» («отЗнака» t (g + (ops.getD k "").length)))

def «границыПоФактам» («факты» : List (String × Bool)) (x : String) : «Границы» :=
  «факты».foldl (fun g (f, v) =>
    if («найтиСв» f [" не равен "]).isSome then g else
    match «сравнениеБ» f with
    | none => g
    | some (l, k, p) =>
      if «ужатьТ» l ≠ x then g else
      match «числоТ» p with
      | none => g
      | some b =>
        match k, v with
        | 0, true => «сНизом» g (b, true)
        | 0, false => «сВерхом» g (b, false)
        | 1, true => «сВерхом» g (b, true)
        | 1, false => «сНизом» g (b, false)
        | 2, true => «сНизом» («сВерхом» g (b, true)) (b, true)
        | 3, true => «сВерхом» g (b, false)
        | 3, false => «сНизом» g (b, true)
        | 4, true => «сНизом» g (b, false)
        | 4, false => «сВерхом» g (b, true)
        | _, _ => g) {}

def «точноБольше» (g : «Границы») (b : Int) : Bool :=
  match g.«низ» with | some (a, incl) => a > b || (a = b && !incl) | none => false
def «точноНеМеньше» (g : «Границы») (b : Int) : Bool :=
  match g.«низ» with | some (a, _) => a ≥ b | none => false
def «точноМеньше» (g : «Границы») (b : Int) : Bool :=
  match g.«верх» with | some (a, incl) => a < b || (a = b && !incl) | none => false
def «точноНеБольше» (g : «Границы») (b : Int) : Bool :=
  match g.«верх» with | some (a, _) => a ≤ b | none => false

def «вариантФакта» (f : String) : Option (String × String) :=
  match «сравнениеБ» f with
  | some (l, 2, p) => if «вариантТ» p ≠ "" then some («ужатьТ» l, «вариантТ» p) else none
  | _ => none

def «поФактам» («факты» : List (String × Bool)) («атом» : String) : Option Bool :=
  let a := «ужатьТ» «атом»
  match «факты».find? (fun (f, _) => «ужатьТ» f = a) with
  | some (_, v) => some v
  | none =>
    if («найтиСв» a [" не равен "]).isSome then none else
    match «сравнениеБ» a with
    | none => none
    | some (l, k, p) =>
      let x := «ужатьТ» l
      if k = 2 && «вариантТ» p ≠ "" then
        match «факты».findSome? (fun (q : String × Bool) => if q.2 then (match «вариантФакта» q.1 with
            | some (y, w) => if y = x then some w else none
            | none => none) else none) with
        | some w => some (w = «вариантТ» p)
        | none => none
      else match «числоТ» p with
      | none => none
      | some b =>
        let g := «границыПоФактам» «факты» x
        if g.«низ».isNone && g.«верх».isNone then none else
        let «гт» := «точноБольше» g b
        let «нм» := «точноНеМеньше» g b
        let «мн» := «точноМеньше» g b
        let «нб» := «точноНеБольше» g b
        match k with
        | 0 => if «нм» then some true else if «мн» then some false else none
        | 1 => if «нб» then some true else if «гт» then some false else none
        | 2 => if «нм» && «нб» then some true else if «мн» || «гт» then some false else none
        | 3 => if «мн» then some true else if «нм» then some false else none
        | _ => if «гт» then some true else if «нб» then some false else none

def «слитьЛин» (a b : List (String × Int)) : List (String × Int) :=
  let «ключи» := ((a ++ b).map (·.1)).eraseDups
  («ключи».map (fun k => (k, ((a ++ b).filter (·.1 = k)).foldl (fun s p => s + p.2) 0))).filter (·.2 ≠ 0)

partial def «линейноПоДлинам» (t0 : String) («гл» : Nat) : Option (List (String × Int) × Int) :=
  let t := «ужатьТ» t0
  if «гл» > 12 || t = "" then none else
  match «числоТ» t with
  | some n => some ([], n)
  | none =>
    match «найтиСв» t [" плюс ", " минус "] with
    | some (g, k) =>
      let l := «доЗнака» t g
      let r := «отЗнака» t (g + (if k = 0 then 6 else 7))
      match «линейноПоДлинам» l («гл» + 1), «линейноПоДлинам» r («гл» + 1) with
      | some (la, lc), some (ra, rc) =>
        if k = 0 then some («слитьЛин» la ra, lc + rc)
        else some («слитьЛин» la (ra.map (fun p => (p.1, -p.2))), lc - rc)
      | _, _ => none
    | none =>
      if !t.startsWith "длина " then none else
      let x := «ужатьТ» (t.«сн» 6)
      if x = "пустой список" || x = "\"\"" then some ([], 0)
      else if («найтиСв» x [" плюс ", " минус ", " равен ", " если ", " то ", " к ", " с "]).isSome || x.startsWith "если " then none
      else some ([(x, 1)], 0)

def «поДлинам» (t : String) : Option Bool :=
  if (t.splitOn "длина ").length < 2 then none else
  let ops := [" не меньше ", " не больше ", " не равен ", " равен ", " меньше ", " больше "]
  match «найтиСв» t ops with
  | none => none
  | some (g, k) =>
    let l := «доЗнака» t g
    let r := «отЗнака» t (g + (ops.getD k "").length)
    match «линейноПоДлинам» l 0, «линейноПоДлинам» r 0 with
    | some (la, lc), some (ra, rc) =>
      let d := «слитьЛин» ra (la.map (fun p => (p.1, -p.2)))
      let dc := rc - lc
      let «неотр» := d.all (·.2 ≥ 0)
      let «непол» := d.all (·.2 ≤ 0)
      let «ге» := «неотр» && dc ≥ 0
      let «гт» := «неотр» && dc > 0
      let «ле» := «непол» && dc ≤ 0
      let «лт» := «непол» && dc < 0
      let «ек» := d.isEmpty && dc = 0
      match k with
      | 0 => if «ле» then some true else if «гт» then some false else none
      | 1 => if «ге» then some true else if «лт» then some false else none
      | 2 => if «гт» || «лт» then some true else if «ек» then some false else none
      | 3 => if «ек» then some true else if «гт» || «лт» then some false else none
      | 4 => if «гт» then some true else if «ле» then some false else none
      | _ => if «лт» then some true else if «ге» then some false else none
    | _, _ => none

/-!
Имена цели по объявленным типам (задачи 7312, 7851, 8806) — зеркало сверщика на
C (`задать_типы_цели`). Тип имени знают ровно две строки: «для всех «x» ⟨Т⟩»
записи и «принимает» функции, чьё постусловие доказывается.
— признак: цель со свободным именем-признаком закрыта, когда закрыты обе
  подстановки «да» и «нет» (не больше восьми подряд);
— точный тип: «Т равен Т» знак в знак — истина, когда Т — имя точного типа;
— запись: две построенные записи одного вида с одними полями равны, когда равны
  поля; построенная из всех полей «п» — та же «п»; «п» и «д» одного вида равны,
  когда на пути истинны факты «п.ф равно д.ф» по каждому полю.
-/

def «точныйТипЦели» (t0 : String) : Bool :=
  let t := «обрезать» t0
  ["неотрицательное", "нат", "натуральное", "nat", "naturo", "自然数", "целое", "точное целое",
   "точное дробное", "сотых", "тысячных", "признак", "строка"].contains t

def «Счёт».«типИмени» (c : «Счёт») (x : String) : Option String :=
  (c.«имена».find? (·.1 = x)).map (·.2)

def «тождествоНаТочном» (c : «Счёт») («атом» : String) : Bool :=
  if c.«имена».isEmpty then false else
  let t := «безВнешних» «атом»
  match «найтиСв» t [" равен ", " равно ", " равна "] with
  | none => false
  | some (g, _) =>
    let l := «ужатьТ» («доЗнака» t g)
    let p := «ужатьТ» («отЗнака» t (g + 7))
    l = p && !((l.splitOn " ").length > 1) && !((l.splitOn "(").length > 1) && !((l.splitOn ".").length > 1) &&
      (match c.«типИмени» («голо» l) with | some w => «точныйТипЦели» w | none => false)

/-- Слово `x` заменяется по пробельным и скобочным краям, мимо кавычек и ёлочек;
    имя поля перед « равным » и имя перед « как » — не значение. -/
def «заменитьСловоЦели» (t x «на» : String) : String := Id.run do
  let cs := t.toList.toArray
  let xc := x.toList
  let d := xc.length
  let «одето» := («вСкобки» «на»).toList.toArray
  let mut out : Array Char := #[]
  let mut q := false
  let mut el : Nat := 0
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      out := out.push c
      if c = '\\' && i + 1 < cs.size then
        out := out.push cs[i + 1]!
        i := i + 2
        continue
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      out := out.push c
      i := i + 1
      continue
    if el = 0 && d > 0 && «стоитНа» cs i xc && (i = 0 || cs[i - 1]! = ' ' || cs[i - 1]! = '(') &&
        (i + d = cs.size || cs[i + d]! = ' ' || cs[i + d]! = ')') &&
        !«стоитНа» cs (i + d) " равным ".toList && !«стоитНа» cs (i + d) " как ".toList then
      out := out ++ «одето»
      i := i + d
      continue
    if c = '«' then el := el + 1
    if c = '»' && el > 0 then el := el - 1
    out := out.push c
    i := i + 1
  return String.ofList out.toList

def «первыйПризнакЦели» (c : «Счёт») (t : String) : Option String :=
  (c.«имена».find? (fun (x, w) => w = "признак" && «заменитьСловоЦели» t x "да" ≠ t)).map (·.1)

/-- Поля выписанной записи `запись «Т» с ф1 равным З1 и …`: имя поля — одно
    слово без ёлочек, значение — справа от первого « равным », куски — по « и »
    верхнего уровня; кусок без « равным » или повтор имени — отказ. -/
def «поляПостроенной» (t0 : String) : Option (String × List (String × String)) := Id.run do
  let t := «ужатьТ» t0
  if !t.startsWith "запись «" then return none
  let «вид» := «ёлочка» t 1
  let «голова» := s!"запись «{«вид»}» с "
  if «вид» = "" || («вид».splitOn " ").length > 1 || !t.startsWith «голова» then return none
  let «ч» := «сверху» ((t.drop «голова».length).toString) "и"
  if «ч».isEmpty then return none
  let mut r : List (String × String) := []
  for k in «ч» do
    let kk := «обрезать» k
    match (kk.splitOn " равным ") with
    | a :: b :: rest =>
      let «имя» := «голо» («обрезать» a)
      let «зн» := «обрезать» (" равным ".intercalate (b :: rest))
      if «имя» = "" || («имя».splitOn " ").length > 1 || «зн» = "" || r.any (·.1 = «имя») then return none
      r := r ++ [(«имя», «зн»)]
    | _ => return none
  return some («вид», r)

/-- Поля объявленного `объект «Т»` без параметров; есть `иногда является` — `none`. -/
def «Исх».«поляОбъявленного» (s : «Исх») («вид» : String) : Option (List String) := Id.run do
  let «нач» := s.«номера».find? (fun i => s.«строка» i = s!"объект «{«вид»}»" && !(s.«сырая» i).startsWith " ")
  let some n := «нач» | return none
  let mut r : List String := []
  for i in List.range' (n + 1) (s.«число» - n) do
    let raw := s.«сырая» i
    if raw ≠ "" && !raw.startsWith " " then break
    let l := s.«строка» i
    if l = "" || l.startsWith "//" then continue
    if (l.splitOn " иногда является ").length > 1 then return none
    let «имя» := «голо» («обрезать» (if (l.splitOn ":").length > 1 then (l.splitOn ":").headD "" else if (l.splitOn " является ").length > 1 then (l.splitOn " является ").headD "" else ""))
    if «имя» = "" || («имя».splitOn " ").length > 1 then return none
    r := r ++ [«имя»]
  return if r.isEmpty then none else some r

def «полеСлитно» (t : String) : String := «заменить» («заменить» («заменить» («ужатьТ» t) " " "") "«" "") "»" ""

def «полеИмениЛи» («знач» «имя» «поле» : String) : Bool := «полеСлитно» «знач» = s!"{«имя»}.{«поле»}"

def «этаЗаписи» (c : «Счёт») («запись» «имя0» : String) : Bool :=
  match «поляПостроенной» «запись» with
  | none => false
  | some («вид», ps) =>
    let «имя» := «ужатьТ» «имя0»
    if («имя».splitOn " ").length > 1 || («имя».splitOn "(").length > 1 then false else
    match c.«типИмени» («голо» «имя»), c.«исх».«поляОбъявленного» «вид» with
    | some w, some fs =>
      w = s!"«{«вид»}»" && fs.length = ps.length &&
        fs.all (fun f => match ps.find? (·.1 = f) with
          | some (_, v) => «полеИмениЛи» v («голо» «имя») f
          | none => false)
    | _, _ => false

partial def «фактПоля» (l p f «факт» : String) : Bool :=
  let t := «безВнешних» «факт»
  match «найтиСв» t [" и притом "] with
  | some (g, _) => «фактПоля» l p f («доЗнака» t g) || «фактПоля» l p f («отЗнака» t (g + 10))
  | none =>
    match «найтиСв» t [" равен ", " равно ", " равна "] with
    | none => false
    | some (g, _) =>
      let a := «доЗнака» t g
      let b := «отЗнака» t (g + 7)
      («полеИмениЛи» a l f && «полеИмениЛи» b p f) || («полеИмениЛи» a p f && «полеИмениЛи» b l f)

def «поляРавныФактами» (c : «Счёт») («сл» «сп» : String) («факты» : List (String × Bool)) : Bool :=
  let l := «голо» («ужатьТ» «сл»)
  let p := «голо» («ужатьТ» «сп»)
  if (l.splitOn " ").length > 1 || (p.splitOn " ").length > 1 || l = p then false else
  match c.«типИмени» l, c.«типИмени» p with
  | some wl, some wp =>
    let «вид» := «ёлочка» wl 1
    if wl ≠ wp || wl ≠ s!"«{«вид»}»" then false else
    match c.«исх».«поляОбъявленного» «вид» with
    | some fs => fs.all (fun f => «факты».any (fun (u, v) => v && «фактПоля» l p f u))
    | none => false
  | _, _ => false

def «равенстваПолей» («сл» «сп» : String) : Option String := Id.run do
  let some (vl, pl) := «поляПостроенной» «сл» | return none
  let some (vp, pp) := «поляПостроенной» «сп» | return none
  if vl ≠ vp || pl.length ≠ pp.length then return none
  let mut r : Option String := none
  for (f, x) in pl.reverse do
    let some (_, y) := pp.find? (·.1 = f) | return none
    let e := s!"{«вСкобки» x} равно {«вСкобки» y}"
    r := some (match r with | none => e | some q => s!"( {e} ) и притом ( {q} )")
  return r

/-! ### Разбор в половине — зеркало `разбор_в_половине` сверщика на C

Терм `разбор S случай P то ( Т ) …` собирает из строк исходника `разборСтрок`. В
половине он снимается двумя путями, и оба — перебор конечного числа случаев:
— S выписан (вариант, вариант с полями, пустой список): берётся первый совпавший
  случай, имена образца получают значения полей разом, через метки;
— иначе цель делится по случаям: случай встаёт на место разбора, S — конструктором
  образца (когда образец называет все поля объявления), и закрыться обязан каждый.
  Имена образца не вправе встречаться в цели вне разбора, в S и в фактах пути.
Образец, которого сверщик не знает, — «не берусь». -/

def «чужойОбразец» : String := "\x01"

inductive «Обр» where
  | «нет» | «тег» | «поля» | «пусто» | «голова» | «любое»
  deriving BEq, Inhabited

structure «Образец» where
  «вид» : «Обр» := .«нет»
  «тег» : String := ""
  «поля» : List String := []
  «имена» : List String := []
  deriving Inhabited

def «образецСлучая» («сырой» : String) : «Образец» :=
  let P := «обрезать» «сырой»
  if P = "любое" then { «вид» := .«любое» }
  else if P = "пусто" then { «вид» := .«пусто» }
  else if P = "голова и хвост" then { «вид» := .«голова», «имена» := ["голова", "хвост"] }
  else if P.startsWith "голова " then
    let w := P.splitOn " "
    if w.length ≠ 5 || w.getD 2 "" ≠ "и" || w.getD 3 "" ≠ "хвост" then {}
    else { «вид» := .«голова», «имена» := [w.getD 1 "", w.getD 4 ""] }
  else
    let «тт» := if P.startsWith "вариант «" then «отЗнака» P "вариант ".length else P
    let «тег» := «ёлочка» «тт» 1
    if !«тт».startsWith "«" || «тег» = "" then {}
    else if «тт» = s!"«{«тег»}»" then { «вид» := .«тег», «тег» := «тег» }
    else if !«тт».startsWith s!"«{«тег»}» с " then {}
    else match «поляС» «тт» " как " with
      | none => {}
      | some (nms, tms) =>
        if tms.any (fun x => x = "" || (x.splitOn " ").length > 1 || (x.splitOn "(").length > 1) then {}
        else { «вид» := .«поля», «тег» := «тег», «поля» := nms, «имена» := tms }

def «конструкторОбразца» (o : «Образец») : String :=
  match o.«вид» with
  | .«тег» => s!"вариант «{o.«тег»}»"
  | .«пусто» => "пустой список"
  | .«поля» => s!"вариант «{o.«тег»}» с " ++ " и ".intercalate ((o.«поля».zip o.«имена»).map (fun (f, n) => s!"«{f}» равным {n}"))
  | _ => ""

/-- Имена, которые связывают образцы всех случаев терма; незнакомый образец — `чужойОбразец`. -/
def «именаОбразцов» (t : String) : List String := Id.run do
  let cs := t.toList.toArray
  let w := "случай ".toList
  let mut r : List String := []
  let mut i := 0
  while i < cs.size do
    if «стоитНа» cs i w && (i = 0 || cs[i - 1]! = ' ') then
      let h := String.ofList (cs.extract (i + w.length) cs.size).toList
      match «найтиСвЁ» h [" то "] with
      | some (g, _) =>
        let o := «образецСлучая» («доЗнака» h g)
        r := if o.«вид» == .«нет» then r ++ [«чужойОбразец»] else r ++ o.«имена»
      | none => r := r ++ [«чужойОбразец»]
      i := i + w.length
    else i := i + 1
  return r

def «словаСреди» (t : String) («имена» : List String) : Bool :=
  «имена».contains «чужойОбразец» || ((«т» t).splitOn " ").any («имена».contains ·)

/-- `разбор S случай P1 то B1 …` — S, образцы и ветви; ветвь — одно слово или одна пара скобок. -/
def «разобратьРазбор» («сырой» : String) : Option (String × List String × List String) := Id.run do
  let t := «безВнешних» «сырой»
  if !t.startsWith "разбор " then return none
  let h0 := «отЗнака» t "разбор ".length
  let some (g, _) := «найтиСвЁ» h0 [" случай "] | return none
  let S := «ужатьТ» («доЗнака» h0 g)
  let mut h := «отЗнака» h0 (g + " случай ".length)
  let mut ps : List String := []
  let mut bs : List String := []
  for _ in [0:h0.length + 1] do
    if h = "" then break
    let (k, rest) := match «найтиСвЁ» h [" случай "] with
      | some (g2, _) => («доЗнака» h g2, «отЗнака» h (g2 + " случай ".length))
      | none => (h, "")
    h := rest
    let some (g3, _) := «найтиСвЁ» k [" то "] | return none
    let P := «обрезать» («доЗнака» k g3)
    let B := «обрезать» («отЗнака» k (g3 + " то ".length))
    if !«однаПараТ» B && (B.splitOn " ").length > 1 then return none
    ps := ps ++ [P]
    bs := bs ++ [B]
  if S = "" || ps.isEmpty then return none
  return some (S, ps, bs)

/-- Первая скобочная группа `( разбор … )` терма (или весь терм), по знакам. -/
def «найтиРазбор» (t : String) : Option (Nat × Nat) := Id.run do
  if t.startsWith "разбор " then return some (0, t.length)
  let cs := t.toList.toArray
  let w := "( разбор ".toList
  let mut q := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      i := i + 1
      continue
    if «стоитНа» cs i w then
      let mut gl : Int := 0
      let mut vk := false
      let mut k := i
      while k < cs.size do
        let d := cs[k]!
        if vk then
          if d = '\\' && k + 1 < cs.size then k := k + 1
          else if d = '"' then vk := false
        else if d = '"' then vk := true
        else if d = '(' then gl := gl + 1
        else if d = ')' then
          gl := gl - 1
          if gl = 0 then return some (i, k + 1)
        k := k + 1
      return none
    i := i + 1
  return none

/-- Значение S против образца: 1 — совпало (и значения имён образца), 0 — нет, -1 — не знаю. -/
def «совпалОбразец» («сырой» : String) (o : «Образец») : Int × List String :=
  let S := «безВнешних» «сырой»
  if o.«вид» == .«любое» then (1, [])
  else if S = "пустой список" || S = "[]" then
    ((if o.«вид» == .«пусто» then 1 else if o.«вид» == .«голова» then 0 else -1), [])
  else if !S.startsWith "вариант «" then (-1, [])
  else
    let «тг» := «ёлочка» S 1
    if S = s!"вариант «{«тг»}»" then
      if o.«вид» == .«тег» then ((if «тг» = o.«тег» then 1 else 0), [])
      else if o.«вид» == .«поля» then ((if «тг» = o.«тег» then -1 else 0), [])
      else (-1, [])
    else if !S.startsWith s!"вариант «{«тг»}» с " then (-1, [])
    else if o.«вид» == .«тег» then ((if «тг» = o.«тег» then -1 else 0), [])
    else if !(o.«вид» == .«поля») then (-1, [])
    else if «тг» ≠ o.«тег» then (0, [])
    else match «поляС» S " равным " with
      | none => (-1, [])
      | some (nms, tms) =>
        let vals := o.«поля».map (fun f => ((nms.zip tms).find? (·.1 = f)).map (·.2))
        if vals.any (·.isNone) then (-1, []) else (1, vals.filterMap id)

/-- Варианты типа, объявившего вариант K, и поля K — когда такой тип в исходнике ровно один. -/
def «Исх».«типВарианта» (s : «Исх») (K : String) : Option (List String × List String) := Id.run do
  let mut «найдено» := 0
  let mut res : List String × List String := ([], [])
  let mut «внутри» := false
  let mut «есть» := false
  let mut «вар» : List String := []
  let mut «пол» : List String := []
  for i in List.range' 1 (s.«число» + 1) do
    let raw := if i ≤ s.«число» then s.«сырая» i else ""
    let l := «обрезать» (if i ≤ s.«число» then s.«строка» i else "")
    let «шапка» := i ≤ s.«число» && raw.startsWith "тип «"
    if «внутри» && (i > s.«число» || «шапка» || (l ≠ "" && !raw.startsWith " ")) then
      if «есть» then
        «найдено» := «найдено» + 1
        res := («вар», «пол»)
      «внутри» := false
      «есть» := false
      «вар» := []
      «пол» := []
    if «шапка» then
      «внутри» := true
      continue
    if !«внутри» || !l.startsWith "вариант «" then continue
    let «имя» := «ёлочка» l 1
    «вар» := «вар» ++ [«имя»]
    if «имя» = K then
      «есть» := true
      let «хв» := «обрезать» («отЗнака» l s!"вариант «{«имя»}»".length)
      if «хв» ≠ "" then
        if !«хв».startsWith "содержит " then return none
        for k in («отЗнака» «хв» "содержит ".length).splitOn "," do
          let n0 := «обрезать» (match k.splitOn ":" with | a :: _ :: _ => a | _ => "")
          let n := if «ёлочка» n0 1 ≠ "" then «ёлочка» n0 1 else n0
          if n = "" then return none
          «пол» := «пол» ++ [n]
  return if «найдено» = 1 then some res else none

def «Исх».«покрытыСлучаи» (s : «Исх») (os : List «Образец») : Bool :=
  if os.any (·.«вид» == .«любое») then true else
  let «пусто» := os.any (·.«вид» == .«пусто»)
  let «голова» := os.any (·.«вид» == .«голова»)
  let «теги» := (os.filter (fun o => o.«вид» == .«тег» || o.«вид» == .«поля»)).map (·.«тег»)
  if «пусто» && «голова» && «теги».isEmpty then true
  else if «теги».isEmpty || «пусто» || «голова» then false
  else match s.«типВарианта» («теги».headD "") with
    | none => false
    | some (vs, _) => vs.all («теги».contains ·)

def «Исх».«полныйОбразец» (s : «Исх») (o : «Образец») : Bool :=
  let n := o.«имена»
  if (List.range n.length).any (fun i => (List.range n.length).any (fun j => i < j && n.getD i "" = n.getD j "")) then false
  else if !(o.«вид» == .«тег») && !(o.«вид» == .«поля») then false
  else match s.«типВарианта» o.«тег» with
    | none => false
    | some (_, fs) => if o.«вид» == .«тег» then fs.isEmpty else fs == o.«поля»

/-- Замкнутое значение, которое на место имени не ставится: признак, число, строка, вариант без полей, пустой список. -/
def «литералДляЗамены» (t : String) : Bool :=
  t = "да" || t = "нет" || t = "пустой список" || («числоТ» t).isSome ||
  (t.length ≥ 2 && t.startsWith "\"" && t.endsWith "\"" && (t.splitOn "\"").length = 3 && «кавычкиЧисты» t) ||
  («ёлочка» t 1 ≠ "" && t = s!"вариант «{«ёлочка» t 1}»")

/-- Слово `x` (многословное — целой скобочной группой) заменяется термом, как `заменить_слово` на C. -/
def «заменитьСлово» (t x «на» : String) : String :=
  «заменитьСловоЦели» t (if (x.splitOn " ").length > 1 then s!"( {x} )" else x) «на»

/-- Имена `xs` заменяются значениями `vs` разом: сначала метками, потом значениями. -/
def «заменитьСловаРазом» (t : String) (xs vs : List String) : String := Id.run do
  let mut r := t
  for (k, x) in (List.range xs.length).zip xs do
    r := «заменитьСлово» r x s!"%о{k}%"
  for (k, v) in (List.range vs.length).zip vs do
    r := «заменитьСлово» r s!"%о{k}%" v
  return r

def «отступСтроки» (s : String) : Nat := (s.toList.takeWhile (· = ' ')).length

def «Исх».«концаПодгруппы» (s : «Исх») (i b «над» : Nat) : Nat :=
  ((List.range' i (b - i)).find? (fun j => s.«строка» j ≠ "" && «отступСтроки» (s.«сырая» j) ≤ «над»)).getD b

def «объявление?С» (l : String) : Bool := «объявленияТела».any (l.startsWith ·)

mutual

partial def «Исх».«выражениеСтрок» (s : «Исх») («голова» : String) (i j «над» «глубина» : Nat) : String := Id.run do
  let h := «обрезать» «голова»
  if «глубина» > 24 || h = "" then return ""
  let ls := (List.range' i (j - i)).filter (fun k => s.«строка» k ≠ "")
  match ls.head? with
  | none => return «т» h
  | some k0 =>
    -- Незакрытая скобка продолжается строками подгруппы (ADR-0105), как читает язык.
    if «скобокОткрыто» h > 0 then
      let t := ls.foldl (fun acc k => acc ++ " " ++ s.«строка» k) h
      return if «скобокОткрыто» t = 0 then «т» t else ""
    let d1 := «отступСтроки» (s.«сырая» k0)
    -- Разбор по строкам, как `разбор_строк` сверщика на C: ниже — строки `случай P` одной глубины.
    if h.startsWith "разбор " && ((«отЗнака» h "разбор ".length).splitOn " случай ").length = 1 then
      return if d1 ≤ «над» then "" else s.«разборСтрок» h i j d1 «глубина»
    if !h.startsWith "если " || («найтиСв» (h.«сн» 5) [" то "]).isSome || d1 ≤ «над» then return ""
    let u := h.«сн» 5
    let marks := ["то ", "иначе "]
    let mut br : Array String := #[]
    let mut k := i
    while k < j do
      let l := s.«строка» k
      if l = "" then
        k := k + 1
        continue
      let mark := marks.getD br.size ""
      let bare := l = «обрезать» mark
      if «отступСтроки» (s.«сырая» k) ≠ d1 || br.size ≥ 2 || !(l.startsWith mark || bare) then return ""
      let kon := s.«концаПодгруппы» (k + 1) j d1
      let v := if bare then
          match ((List.range' (k + 1) (kon - k - 1)).filter (fun q => s.«строка» q ≠ "")).head? with
          | none => ""
          | some k1 => s.«выражениеСтрок» (s.«строка» k1) (k1 + 1) kon («отступСтроки» (s.«сырая» k1)) («глубина» + 1)
        else s.«выражениеСтрок» («после» l mark) (k + 1) kon d1 («глубина» + 1)
      if v = "" then return ""
      br := br.push v
      k := kon
    if br.size ≠ 2 then return ""
    return «т» s!"если {«вСкобки» («т» u)} то {«вСкобки» br[0]!} иначе {«вСкобки» br[1]!}"

/-- `разбор S` и ниже строки `случай P` глубины `d1`; тело случая — в скобках всегда. -/
partial def «Исх».«разборСтрок» (s : «Исх») («голова» : String) (i j d1 «глубина» : Nat) : String := Id.run do
  let mut parts : Array String := #[«т» «голова»]
  let mut k := i
  while k < j do
    let l := «обрезать» (s.«строка» k)
    if l = "" then
      k := k + 1
      continue
    if «отступСтроки» (s.«сырая» k) ≠ d1 || !l.startsWith "случай " then return ""
    let kon := s.«концаПодгруппы» (k + 1) j d1
    let body := s.«телоСлучаяСтрок» k kon d1 «глубина»
    if body = "" then return ""
    parts := parts.push s!"случай {«т» («отЗнака» l "случай ".length)} то ( {body} )"
    k := kon
  if parts.size < 2 then return ""
  return " ".intercalate parts.toList

/-- Тело одного случая: метка `то` с выражением либо блок строк глубже строки `случай`. -/
partial def «Исх».«телоСлучаяСтрок» (s : «Исх») (k kon d1 «глубина» : Nat) : String := Id.run do
  let some m := (List.range' (k + 1) (kon - (k + 1))).find? (fun q => «обрезать» (s.«строка» q) ≠ "") | return ""
  let d2 := «отступСтроки» (s.«сырая» m)
  let first := «обрезать» (s.«строка» m)
  if d2 ≤ d1 then return ""
  if first = "то" || first.startsWith "то " then
    if s.«концаПодгруппы» (m + 1) kon d2 ≠ kon then return ""
    if first = "то" then return s.«блокСтрок» (m + 1) kon d2 («глубина» + 2) false
    return s.«выражениеСтрок» («отЗнака» first "то ".length) (m + 1) kon d2 («глубина» + 1)
  return s.«блокСтрок» (k + 1) kon d1 («глубина» + 1) false

/-- Блок строк одной глубины: связыватели `пусть` и одно выражение последним, как `блок_строк` на C. -/
partial def «Исх».«блокСтрок» (s : «Исх») (a b «надБлоком» «глубина» : Nat) («объявления» : Bool) : String := Id.run do
  if «глубина» > 24 then return ""
  let mut «над» : Option Nat := none
  let mut names : Array String := #[]
  let mut vals : Array String := #[]
  let mut body := ""
  let mut i := a
  while i < b do
    let raw := s.«сырая» i
    let l := «обрезать» (s.«строка» i)
    if l = "" then
      i := i + 1
      continue
    let d := match «над» with | some d => d | none => «отступСтроки» raw
    if «над».isNone then
      if d ≤ «надБлоком» then return ""
      «над» := some d
    if «отступСтроки» raw ≠ d then
      if «отступСтроки» raw < d then return ""
      i := i + 1
      continue
    if «объявления» && «объявление?С» l then
      i := i + 1
      continue
    let kon := s.«концаПодгруппы» (i + 1) b d
    if body ≠ "" then return ""
    if l.startsWith "пусть " then
      let n := «слово» l 2
      if «слово» l 3 ≠ "равно" || n = "" || (n.splitOn "(").length > 1 || names.size ≥ 8 then return ""
      let v := s.«выражениеСтрок» («словаС» l 3) (i + 1) kon d («глубина» + 1)
      if v = "" then return ""
      names := names.push n
      vals := vals.push v
    else
      body := s.«выражениеСтрок» l (i + 1) kon d («глубина» + 1)
      if body = "" then return ""
    i := kon
  if body = "" then return ""
  let bound := («именаОбразцов» body) ++ (vals.toList.map «именаОбразцов»).foldl (· ++ ·) []
  if bound.any (names.contains ·) then return ""
  for k in (List.range names.size).reverse do
    body := «вместо» body names[k]! vals[k]!
  return body

end

def «Исх».«телоМногострочное» (s : «Исх») (a b : Nat) : String := Id.run do
  let mut «над» : Option Nat := none
  let mut names : Array String := #[]
  let mut vals : Array String := #[]
  let mut body := ""
  let mut i := a + 1
  while i < b do
    let raw := s.«сырая» i
    let l := s.«строка» i
    if l = "" then
      i := i + 1
      continue
    let d := match «над» with | some d => d | none => «отступСтроки» raw
    «над» := some d
    if «отступСтроки» raw ≠ d || «объявление?С» l then
      i := i + 1
      continue
    let kon := s.«концаПодгруппы» (i + 1) b d
    if body ≠ "" then return ""
    if l.startsWith "пусть " then
      let n := «слово» l 2
      if «слово» l 3 ≠ "равно" || n = "" || (n.splitOn "(").length > 1 || names.size ≥ 4 then return ""
      let v := s.«выражениеСтрок» («словаС» l 3) (i + 1) kon d 0
      if v = "" then return ""
      names := names.push n
      vals := vals.push v
    else
      body := s.«выражениеСтрок» l (i + 1) kon d 0
      if body = "" then return ""
    i := kon
  if body = "" then return ""
  -- имя `пусть`, которое связывает образец разбора в теле, — отказ, как в `блок_строк` на C
  let bound := («именаОбразцов» body) ++ (vals.toList.map «именаОбразцов»).foldl (· ++ ·) []
  if bound.any (names.contains ·) then return ""
  for k in (List.range names.size).reverse do
    body := «вместо» body names[k]! vals[k]!
  return body

def «Исх».«телоБезПуст» (s : «Исх») (a b : Nat) : String := Id.run do
  let mut lets : Array String := #[]
  let mut body := ""
  let mut cont := false
  for i in s.«меж» a b do
    let l := s.«строка» i
    if l = "" then continue
    if cont && (s.«сырая» i).startsWith "   " then continue
    cont := l.startsWith "обеспечивает "
    if «объявление?С» l then continue
    if body ≠ "" then lets := lets.push body
    body := l
  if body = "" || lets.size > 4 then return ""
  let mut t := «т» body
  for k in (List.range lets.size).reverse do
    let l := lets[k]!
    let n := «слово» l 2
    let v := «словаС» l 3
    if !l.startsWith "пусть " || «слово» l 3 ≠ "равно" then return ""
    if n = "" || v = "" || (n.splitOn "(").length > 1 then return ""
    t := «вместо» t n («т» v)
  return t

def «Исх».«телоРазбора» (s : «Исх») (a b : Nat) : String :=
  let t := s.«телоБезПуст» a b
  if t ≠ "" then t else s.«телоМногострочное» a b

/-- Связыватель, которого половина не снимает: всё, кроме разбора (его снимает `разборВПоловине`). -/
def «связывательКромеРазбора» (t : String) : Bool :=
  «естьСвязыватель» («обрезать» («заменить» («заменить» s!" {t} " " разбор " " ") " случай " " "))

def «Исх».«телоФункцииТермом» (s : «Исх») (f : String) : String :=
  match s.«блокС» f with
  | none => ""
  | some (a, b) =>
    let t := s.«телоРазбора» a b
    if t = "" || «связывательКромеРазбора» t || !«кавычкиЧисты» t then "" else t

/-- Группа `( «F» от д1 и … )` — тело F с доводами вместо параметров, как `развернуть_вызов_группы`
    сверщика на C: доводы простые, имя образца тела, встреченное в доводе, переименовывается, а
    захват, оставшийся после этого, — отказ. -/
def «Исх».«развернутьВызовГруппы» (s : «Исх») («группа» : String) : Option String := Id.run do
  let v := «безВнешних» «группа»
  let f := «ёлочка» v 1
  if f = "" || !v.startsWith s!"«{f}» от " then return none
  let args := «доводыВызоваС» («отЗнака» v s!"«{f}» от ".length)
  if !args.all «простойС» then return none
  let mut body := s.«телоФункцииТермом» f
  if body = "" then return none
  let ps := (s.«доводы» f).«голые»
  if ps.length ≠ args.length || ps.isEmpty then return none
  let bound := «именаОбразцов» body
  if bound.contains «чужойОбразец» then return none
  for i in [0:ps.length] do
    if bound.contains (ps.getD i "") then return none
    for j in [i + 1:ps.length] do
      if «естьТ» («т» (args.getD i "")) (ps.getD j "") then return none
  let «занято» := fun (b : String) (x : String) =>
    «естьТ» b x || ps.contains x || args.any (fun a => «естьТ» («т» a) x)
  for x in bound do
    if !args.any (fun a => «естьТ» («т» a) x) then continue
    let mut fresh := x ++ "ʹ"
    for _ in [0:16] do
      if «занято» body fresh then fresh := fresh ++ "ʹ" else break
    if «занято» body fresh then return none
    body := «заменитьСлово» body x fresh
  if args.any (fun a => «словаСреди» a («именаОбразцов» body)) then return none
  for i in [0:ps.length] do
    body := «вместо» body (ps.getD i "") («т» (args.getD i ""))
  return some body

/-- Все группы `( «F» от … )` терма, какие разворачиваются, — за один проход, как `развернуть_вызовы`. -/
def «Исх».«развернутьВызовы» (s : «Исх») (t : String) : Option String := Id.run do
  let cs := t.toList.toArray
  let w := "( «".toList
  let mut out := ""
  let mut «нач» := 0
  let mut «было» := false
  let mut q := false
  let mut i := 0
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
      i := i + 1
      continue
    if c = '"' then
      q := true
      i := i + 1
      continue
    if «стоитНа» cs i w then
      let mut gl : Int := 0
      let mut vk := false
      let mut e : Option Nat := none
      let mut k := i
      while k < cs.size do
        let d := cs[k]!
        if vk then
          if d = '\\' && k + 1 < cs.size then k := k + 1
          else if d = '"' then vk := false
        else if d = '"' then vk := true
        else if d = '(' then gl := gl + 1
        else if d = ')' then
          gl := gl - 1
          if gl = 0 then
            e := some k
            break
        k := k + 1
      match e with
      | none => break
      | some kk =>
        match s.«развернутьВызовГруппы» (String.ofList (cs.extract i (kk + 1)).toList) with
        | some r =>
          out := out ++ String.ofList (cs.extract «нач» i).toList ++ s!"( {r} )"
          «нач» := kk + 1
          i := kk + 1
          «было» := true
          continue
        | none => pure ()
    i := i + 1
  if !«было» then return none
  return some (out ++ String.ofList (cs.extract «нач» cs.size).toList)

mutual

/-- Половина — и, когда не закрылась, ещё раз с развёрнутыми вызовами (не больше двух развёрток
    подряд), как обёртка `половина_закрыта` сверщика на C. -/
partial def «половинаЗакрыта» (c : «Счёт») («сырой» : String) («делений» : Nat) («конечен» : Option String)
    («факты» : List (String × Bool)) : Bool :=
  «половинаЗакрытаПо» c «сырой» «делений» «конечен» «факты» ||
    (c.«развёрток» < 2 &&
      match c.«исх».«развернутьВызовы» («безВнешних» «сырой») with
      | some r => r.length < 200000 &&
          «половинаЗакрытаПо» { c with «развёрток» := c.«развёрток» + 1 } r «делений» «конечен» «факты»
      | none => false)

partial def «разборВПоловине» (c : «Счёт») (t : String) («делений» : Nat) («конечен» : Option String)
    («факты» : List (String × Bool)) : Bool := Id.run do
  let some (a, b) := «найтиРазбор» t | return false
  let cs := t.toList.toArray
  let R := String.ofList (cs.extract a b).toList
  let some (S, ps, bs) := «разобратьРазбор» R | return false
  -- Разбор на месте разбираемого сверщик на C раскладывает по ветвям; второй не берётся.
  if («безВнешних» S).startsWith "разбор " then return false
  let os := ps.map «образецСлучая»
  for (o, B0) in os.zip bs do
    if o.«вид» == .«нет» then return false
    let (m, vs) := «совпалОбразец» S o
    if m < 0 then break
    if m = 0 then continue
    let inner := «именаОбразцов» B0
    if o.«имена».any (inner.contains ·) then return false
    if vs.any (fun v => ((«т» v).splitOn " ").any (inner.contains ·)) then return false
    -- ветвь встаёт без лишних скобок: `( ( зн ) … )` и `( зн … )` — один терм
    let B := «т» («заменитьСловаРазом» B0 o.«имена» vs)
    return «половинаЗакрыта» c («заменить» t R («вСкобки» B)) «делений» «конечен» «факты»
  if «делений» ≥ 6 || !c.«исх».«покрытыСлучаи» os then return false
  let outside := «заменить» t R " "
  for (o, B) in os.zip bs do
    if o.«вид» == .«нет» then return false
    for x in o.«имена» do
      if «естьТ» outside x || «естьТ» S x then return false
      if «факты».any (fun (u, _) => «естьТ» («т» u) x) then return false
    let mut ti := «заменить» t R («вСкобки» B)
    let k := «конструкторОбразца» o
    let inner := «именаОбразцов» ti
    if !«литералДляЗамены» S then
      let ok := !«словаСреди» S inner && !o.«имена».any (inner.contains ·)
      if ok && k ≠ "" && c.«исх».«полныйОбразец» o then ti := «заменитьСлово» ti S k
    if !«половинаЗакрыта» c ti («делений» + 1) «конечен» «факты» then return false
  return true

partial def «половинаЗакрытаПо» (c : «Счёт») («сырой» : String) («делений» : Nat) («конечен» : Option String)
    («факты» : List (String × Bool)) : Bool :=
  let t := «безВнешних» («сжатьВыборы» («безВнешних» «сырой»))
  if t = "да" then true
  else if t = "нет" then false
  else if t.startsWith "разбор " || (t.splitOn "( разбор ").length > 1 then «разборВПоловине» c t «делений» «конечен» «факты»
  else match «разрезВыбора» t with
  | some (u, a, b) =>
    let uu := «безВнешних» u
    if uu = "да" then «половинаЗакрыта» c a «делений» «конечен» «факты»
    else if uu = "нет" then «половинаЗакрыта» c b «делений» «конечен» «факты»
    else match «значМоё» c uu 0 with
    | .«приз» v => «половинаЗакрыта» c (if v then a else b) «делений» «конечен» «факты»
    | _ =>
      let (au, par) := «атомУсловия» uu
      if «тождествоНаТочном» c au then «половинаЗакрыта» c (if par then b else a) «делений» «конечен» «факты» else
      if au = "да" || au = "нет" then
        let lit := au = "да"
        «половинаЗакрыта» c (if lit == par then b else a) «делений» «конечен» «факты»
      else «деление» c t au «делений» «конечен» «факты»
  | none =>
    match «значМоё» c t 0 with
    | .«приз» v => v
    | _ =>
      let notFalse := t.startsWith "не " && («найтиСв» (t.«сн» 3) [" и притом ", " или "]).isNone &&
        (match «значМоё» c (t.«сн» 3) 0 with | .«приз» v => !v | _ => false)
      if notFalse then true else
      match «оговоркаОКонечности» c t with
      | some (tk, pod) => «половинаЗакрыта» c pod «делений» (some tk) «факты»
      | none =>
        if «квадратПодОговоркой» c t «конечен» then true else
        let viaConn := match «найтиСв» t [" и притом ", " или "] with
          | some (g, k) =>
            let l := «доЗнака» t g
            let p := «отЗнака» t (g + (if k = 0 then 10 else 5))
            «простойИлиНе» l && «простойИлиНе» p &&
              (let el := «половинаЗакрыта» c l «делений» «конечен» «факты»
               let ep := «половинаЗакрыта» c p «делений» «конечен» «факты»
               if k = 0 then el && ep else el || ep)
          | none => false
        if viaConn then true else
        let viaEq := match «найтиСв» t [" равен "] with
          | some (g, _) =>
            let l := «доЗнака» t g
            let p := «отЗнака» t (g + 7)
            «простойС» l && «простойС» p && «тождественны» c l p 0
          | none => false
        if viaEq then true else
        let viaRec := match «найтиСв» t [" равен ", " равно ", " равна "] with
          | some (g, k) =>
            let l := «доЗнака» t g
            let p := «отЗнака» t (g + 7)
            let w := if k = 0 then "равен" else if k = 1 then "равно" else "равна"
            if «тождествоНаТочном» c t then true
            else if «тождествоНаТочном» c l || «тождествоНаТочном» c p then
              «половинаЗакрыта» c s!"{if «тождествоНаТочном» c l then "да" else l} {w} {if «тождествоНаТочном» c p then "да" else p}" «делений» «конечен» «факты»
            else if «этаЗаписи» c l p || «этаЗаписи» c p l then true
            else if «поляРавныФактами» c l p «факты» then true
            else match «равенстваПолей» l p with
              | some e => «половинаЗакрыта» c e «делений» «конечен» «факты»
              | none => false
          | none => false
        if viaRec then true
        else if «поДлинам» t = some true then true
        else if «мераНеотрицательна» t then true
        else if «началоПоПостроению» c t then true
        else if c.«признаковПодряд» < 8 && !«естьСвязыватель» t && («первыйПризнакЦели» c t).isSome then
          «делениеПризнаком» c t «делений» «конечен» «факты» 0
        else if (match «первоеУсловие» t with
            | some u => «деление» c t («атомУсловия» u).1 «делений» «конечен» «факты»
            | none => false) then true
        else match «первыйАтом» c t with
          | some u => «деление» c t u «делений» «конечен» «факты»
          | none => false

partial def «делениеПризнаком» (c : «Счёт») (t : String) («делений» : Nat) («конечен» : Option String)
    («факты» : List (String × Bool)) («подряд» : Nat) : Bool :=
  if «подряд» ≥ 8 || c.«признаковПодряд» ≥ 8 || «естьСвязыватель» t then false else
  match «первыйПризнакЦели» c t with
  | none => false
  | some x =>
    let c1 := { c with «признаковПодряд» := c.«признаковПодряд» + 1 }
    «половинаЗакрыта» c1 («заменитьСловоЦели» t x "да") «делений» «конечен» «факты» &&
    «половинаЗакрыта» c1 («заменитьСловоЦели» t x "нет") «делений» «конечен» «факты»

partial def «деление» (c : «Счёт») (t u : String) («делений» : Nat) («конечен» : Option String)
    («факты» : List (String × Bool)) : Bool :=
  if «делений» ≥ 4 || «естьСвязыватель» t then false else
  if «тождествоНаТочном» c u then
    let (s1, n1) := «подставитьУсловие» t u "да"
    n1 ≥ 1 && «половинаЗакрыта» c s1 «делений» «конечен» «факты»
  else
  match «поФактам» «факты» u with
  | some v =>
    let (s1, n1) := «подставитьУсловие» t u (if v then "да" else "нет")
    n1 ≥ 1 && «половинаЗакрыта» c s1 «делений» «конечен» «факты»
  | none =>
    let (da, n1) := «подставитьУсловие» t u "да"
    let (net, n2) := «подставитьУсловие» t u "нет"
    if n1 < 1 || n1 ≠ n2 then false
    else
      let «ф» := «ужатьТ» u
      let da := match «разрезРавенства» «ф» with
        | some (x, v) =>
          let xs := «ужатьТ» x
          if («числоТ» v).isSome && (xs.splitOn " ").length = 1 && («числоТ» xs).isNone && !xs.startsWith "\"" then «вместо» da xs («ужатьТ» v) else da
        | none => da
      «половинаЗакрыта» c da («делений» + 1) «конечен» («факты» ++ [(«ф», true)]) &&
      «половинаЗакрыта» c net («делений» + 1) «конечен» («факты» ++ [(«ф», false)])

end

def «закрыта» (c : «Счёт») (t : String) : Bool := «половинаЗакрыта» c t 0 none []

def «закрытаПри» (c : «Счёт») (t : String) («факты» : List (String × Bool)) : Bool := «половинаЗакрыта» c t 0 none «факты»

def «поляРезультата» («цель» «тело» : String) : String := Id.run do
  if !«тело».startsWith "запись «" then return «цель»
  match «поляС» «тело» " равным " with
  | none => return «цель»
  | some (nms, tms) =>
    let mut t := «цель»
    for (n, v) in nms.zip tms do
      let w := s!"результат.«{n}»"
      for _ in [0:64] do
        match t.splitOn w with
        | a :: r :: rest =>
          if a ≠ "" && !a.endsWith " " && !a.endsWith "(" then return «цель»
          t := a ++ «вСкобки» v ++ w.intercalate (r :: rest)
        | _ => break
    return t

partial def «проекцияТела» («тело» «поле» : String) («глубина» : Nat) : String :=
  let t := «безВнешних» «тело»
  if «глубина» > 24 then "" else
  match «разрезВыбора» t with
  | some (u, a, b) =>
    let pa := «проекцияТела» a «поле» («глубина» + 1)
    let pb := «проекцияТела» b «поле» («глубина» + 1)
    if pa ≠ "" && pb ≠ "" then «т» s!"если {«вСкобки» («т» u)} то {«вСкобки» pa} иначе {«вСкобки» pb}" else ""
  | none =>
    if t.startsWith "запись «" then
      match «поляС» t " равным " with
      | none => ""
      | some (nms, tms) => match (nms.zip tms).find? (·.1 = «поле») with
        | some (_, v) => «т» v
        | none => ""
    else if !((t.splitOn " ").length > 1) && !((t.splitOn "(").length > 1) && !((t.splitOn "\"").length > 1) then
      s!"{t}.«{«поле»}»"
    else ""

def «поляРезультатаВыбором» («цель» «тело» : String) : String := Id.run do
  let mut t := «цель»
  for _ in [0:64] do
    match t.splitOn "результат." with
    | a :: r :: rest =>
      if a ≠ "" && !a.endsWith " " && !a.endsWith "(" then return «цель»
      let za := "результат.".intercalate (r :: rest)
      let (f, rest2) : String × String :=
        if za.startsWith "«" then
          match (za.«сн» 1).splitOn "»" with
          | f :: rr => if rr.isEmpty then ("", "") else (f, "»".intercalate rr)
          | [] => ("", "")
        else
          let cs := za.toList
          let fl := cs.takeWhile (fun c => c ≠ ' ' && c ≠ '(' && c ≠ ')' && c ≠ '.')
          (String.ofList fl, String.ofList (cs.drop fl.length))
      if za.startsWith "«" && !(((za.«сн» 1).splitOn "»").length > 1) then return «цель»
      if f = "" || rest2.startsWith "." then return «цель»
      let pr := «проекцияТела» «тело» f 0
      if pr = "" then return «цель»
      t := a ++ «вСкобки» pr ++ rest2
    | _ => break
  return t

def «Исх».«типДоводаВСтроке» (_ : «Исх») (l «имя» : String) : String :=
  let d := «доводыСтроки» l
  ((d.«имена».zip d.«типы»).find? (fun (n, _) => «голо» n = «имя»)).map (·.2) |>.getD ""

def «Исх».«доводСДном» (s : «Исх») (a b : Nat) («имя» : String) : Bool :=
  match (List.range' a (b - a)).findSome? (fun i =>
      let t := s.«типДоводаВСтроке» (s.«строка» i) «имя»
      if t ≠ "" then some t else none) with
  | some t => s.«видТипа» («имяТипа» t) == .«отрезок»
  | none => false

def «Исх».«типВозврата» (s : «Исх») (a b : Nat) : String :=
  ((List.range' a (b - a)).find? (fun i => (s.«строка» i).startsWith "возвращает ")).map (fun i => «обрезать» («после» (s.«строка» i) "возвращает ")) |>.getD ""

def «Исх».«изОбъявленного» (s : «Исх») (c : «Счёт») («сырой» : String) (a b : Nat) : Bool :=
  let t0 := «безВнешних» «сырой»
  let t := match «оговоркаОКонечности» c t0 with | some (_, pod) => «безВнешних» pod | none => t0
  let nat := fun (x : String) => x ≠ "" && s.«доводСДном» a b x
  match «найтиСв» t [" не меньше "] with
  | some (g, _) =>
    let l := «безВнешних» («доЗнака» t g)
    let p := «безВнешних» («отЗнака» t (g + 11))
    p = "0" && (match «найтиСв» l [" плюс "] with
      | some (g2, _) => nat («безВнешних» («доЗнака» l g2)) && nat («безВнешних» («отЗнака» l (g2 + 6)))
      | none => false)
  | none =>
    match «найтиСв» t [" не больше "] with
    | none => false
    | some (g, _) =>
      let l := «безВнешних» («доЗнака» t g)
      let p := «безВнешних» («отЗнака» t (g + 11))
      if p = "9007199254740991" then
        let tv := s.«типВозврата» a b
        tv = "целое" || «натуральноеИмя» tv
      else match «найтиСв» p [" плюс "] with
        | none => false
        | some (g2, _) =>
          let p1 := «безВнешних» («доЗнака» p g2)
          let p2 := «безВнешних» («отЗнака» p (g2 + 6))
          («тождественны» c l p1 0 && nat p2) || («тождественны» c l p2 0 && nat p1)

def «разборСравнения» (t : String) : Option (String × Nat × String) :=
  let ops := [" не меньше ", " не больше ", " равен ", " меньше ", " больше "]
  match «найтиСв» t ops with
  | none => none
  | some (g, k) => some («безВнешних» («доЗнака» t g), k, «безВнешних» («отЗнака» t (g + (ops.getD k "").length)))

def «несовместимаПара» (c : «Счёт») (f1 f2 : String) : Bool :=
  match «разборСравнения» f1, «разборСравнения» f2 with
  | some (l1, o1, p1), some (l2, o2, p2) =>
    if o1 ≠ 3 && o1 ≠ 4 then false
    else if o2 = 2 then («тождественны» c l2 l1 0 && «тождественны» c p2 p1 0) || («тождественны» c l2 p1 0 && «тождественны» c p2 l1 0)
    else if !«тождественны» c l2 p1 0 || !«тождественны» c p2 l1 0 then false
    else if o1 = 3 then o2 = 3 || o2 = 1 else o2 = 4 || o2 = 0
  | _, _ => false

def «Исх».«требованияФункции» (s : «Исх») (a b : Nat) : List String :=
  (s.«меж» a b).filterMap fun i =>
    let l := s.«строка» i
    if l.startsWith "требует " && (l.splitOn "» ").length > 1 then some («т» («после» l "» ")) else none

def «Исх».«невыполнимаяПосылка» (s : «Исх») (c : «Счёт») (a b : Nat) : Bool :=
  let t := s.«требованияФункции» a b
  (List.range t.length).any fun i => (List.range t.length).any fun j =>
    i ≠ j && «несовместимаПара» c (t.getD i "") (t.getD j "")

def «Исх».«именаДоводовФункции» (s : «Исх») (f : String) : List String :=
  match s.«блокС» f with
  | none => []
  | some (a, b) =>
    match (List.range' a (b - a)).find? (fun i => (s.«строка» i).startsWith "принимает ") with
    | none => []
    | some i => ((«словаС» (s.«строка» i) 1).splitOn ",").map fun k =>
        «голо» («обрезать» ((k.splitOn ":").headD k))

def «Исх».«плоскоеТело» (s : «Исх») (f : String) : String :=
  match s.«блокС» f with
  | none => ""
  | some (a, b) =>
    let t := s.«телоБезПуст» a b
    let t := if t ≠ "" then t else
      let ls := (s.«меж» a b).filterMap (fun i => let l := s.«строка» i; if l = "" || «объявление?С» l then none else some l)
      let sk := " ".intercalate ls
      if sk = "" then "" else
      let tt := «т» sk
      if («разрезВыбора» tt).isSome then tt else ""
    if (t.splitOn "» от ").length > 1 then "" else t

def «закрывающаяБ» (cs : Array Char) (p : Nat) : Option Nat := Id.run do
  let mut gl : Int := 0
  let mut q := false
  let mut i := p
  while i < cs.size do
    let c := cs[i]!
    if q then
      if c = '\\' && i + 1 < cs.size then i := i + 1
      else if c = '"' then q := false
    else if c = '"' then q := true
    else if c = '(' then gl := gl + 1
    else if c = ')' then
      gl := gl - 1
      if gl = 0 then return some i
    i := i + 1
  return none

def «простойДовод» (f : String) : Bool :=
  let u := «ужатьТ» f
  u ≠ "" && (u.splitOn " ").length = 1 && !u.startsWith "«"

def «Исх».«развернутьПлоскоеБ» (s : «Исх») (t «чья» : String) : String :=
  let n := «ёлочка» t 1
  if n = "" || n = «чья» || !t.startsWith s!"«{n}» от " then t else
  let tail := «обрезать» («после» t s!"«{n}» от ")
  let body := s.«плоскоеТело» n
  let ds := s.«именаДоводовФункции» n
  let fs := «сверху» tail "и"
  if body = "" || ds.isEmpty || ds.length ≠ fs.length || !fs.all «простойДовод» then t
  else (ds.zip fs).foldl (fun acc (d, f) => «вместо» acc d («т» («обрезать» f))) body

def «Исх».«развернутьВызовыРаз» (s : «Исх») (t «чья» : String) : String := Id.run do
  let u := «ужатьТ» t
  let «целиком» := s.«развернутьПлоскоеБ» u «чья»
  if «целиком» ≠ u then return «т» «целиком»
  let mut r := «т» t
  for _ in [0:16] do
    let cs := r.toList.toArray
    let mut p := 0
    let mut changed := false
    while p < cs.size && !changed do
      if «стоитНа» cs p "( «".toList then
        match «закрывающаяБ» cs p with
        | none => p := cs.size
        | some q =>
          let inner := «обрезать» (String.ofList (cs.extract (p + 1) q).toList)
          let nn := s.«развернутьПлоскоеБ» inner «чья»
          if nn ≠ inner then
            r := «т» (String.ofList (cs.extract 0 p).toList ++ «вСкобки» nn ++ String.ofList (cs.extract (q + 1) cs.size).toList)
            changed := true
      p := p + 1
    if !changed then break
  return r

def «Исх».«телоОднойСтрокой» (s : «Исх») (a b : Nat) : String :=
  let ls := (s.«меж» a b).filter (fun i => s.«строка» i ≠ "" && !«объявление?С» (s.«строка» i))
  match ls with
  | [i] => s.«строка» i
  | _ => ""

def «сторожПереписки» (c : «Счёт») («свои» : List String) («чья» «цель0» : String) : Option (String × String) :=
  let s := c.«исх»
  if «свои».any (·.startsWith "принцип тип ") || «свои».any (·.startsWith "посылка ") then none
  else if «цель0» = "" || !«кавычкиЧисты» «цель0» then none
  else
    let g := «т» «цель0»
    match «найтиСв» g [" не равен ", " равен "] with
    | some (k, 1) =>
      let l := «обрезать» («доЗнака» g k)
      let p := «обрезать» («отЗнака» g (k + 7))
      if l = "" || p = "" || («найтиСв» p [" не равен ", " равен "]).isSome then none else
      match s.«блокС» «чья» with
      | none => none
      | some (a, b) =>
        let body0 := s.«телоОднойСтрокой» a b
        if body0 = "" || !«кавычкиЧисты» body0 then none else
        let body := «т» body0
        let sl := «вместо» l "результат" body
        let sp := «вместо» p "результат" body
        if (s.«меж» a b ++ [a]).any (fun i => (s.«строка» i).startsWith "требует ") then none
        else if «стороныРазошлись» c sl sp then some (sl, sp) else none
    | _ => none


def «надвоеВ» (f op : String) : Option (String × String) :=
  if («сверху» («ужатьТ» f) op).length ≠ 2 then none else
  let r := «разрез» f op
  if !r.«есть» then none else some («ужатьТ» r.«лево», «ужатьТ» r.«право»)

def «литералВывода» (t : String) : Option Nat :=
  let u := «ужатьТ» t
  if u ≠ "" && u.all Char.isDigit then u.toNat? else none

def «имяВывода» (t : String) : Bool :=
  let u := «ужатьТ» t
  u ≠ "" && !((u.splitOn " ").length > 1) && !((u.splitOn "(").length > 1) && («литералВывода» u).isNone

def «выборВывода» (t : String) : Option (String × String) :=
  let u := «ужатьТ» t
  if !u.startsWith "если " || («сверху» u "иначе").length ≠ 2 then none else
  let l := «ужатьТ» («разрез» u "иначе").«лево»
  let b := «ужатьТ» («разрез» u "иначе").«право»
  if («сверху» l "то").length ≠ 2 then none else
  let a := «ужатьТ» («разрез» l "то").«право»
  if a ≠ "" && b ≠ "" then some (a, b) else none

def «склейкаВывода» (t : String) : Option (String × String) :=
  let u := «ужатьТ» t
  if !u.startsWith "соединить " || («сверху» u "с").length ≠ 2 then none else
  let l := «ужатьТ» («словаС» («разрез» u "с").«лево» 1)
  let r := «ужатьТ» («разрез» u "с").«право»
  if l ≠ "" then some (l, r) else none

def «ветвьСчёта» (v «акк» : String) («предел» : Option Nat) : Bool :=
  let u := «ужатьТ» v
  u = «акк» || (match «надвоеВ» u "плюс" with
    | some (l, p) =>
      let ok := fun (x : String) => match «литералВывода» x with
        | some z => match «предел» with | some m => z ≤ m | none => true
        | none => false
      (l = «акк» && ok p) || (p = «акк» && ok l)
    | none => false)

def «шагСчёта» (w «акк» : String) («предел» : Option Nat) : Bool :=
  «ветвьСчёта» w «акк» «предел» || (match «выборВывода» («ужатьТ» w) with
    | some (a, b) => «ветвьСчёта» a «акк» «предел» && «ветвьСчёта» b «акк» «предел»
    | none => false)

def «мераПростого» (t : String) : Bool :=
  let u := «безВнешних» t
  u.startsWith "длина " && «простойС» («словаС» u 1)

def «шагСМерой» (w «акк» : String) : Bool :=
  let r := «разрез» («ужатьТ» w) "плюс"
  r.«есть» && ((«ужатьТ» r.«лево» = «акк» && «мераПростого» r.«право») || («ужатьТ» r.«право» = «акк» && «мераПростого» r.«лево»))

def «Исх».«требуетНеотр» (s : «Исх») («чья» t : String) : Bool :=
  match s.«блокС» «чья» with
  | none => false
  | some (a, b) => (List.range' a (b - a)).any fun j =>
    let l := s.«строка» j
    if !l.startsWith "требует " then false else
    let u := «обрезать» («после» l s!"«{«ёлочка» l 1}» ")
    u ≠ "" && [" не меньше ", " больше "].any fun w =>
      match «разрезСл» u w with
      | some (lev, pr) => (match «числоТочно» («обрезать» pr) with | some k => k ≥ 0 | none => false) && «ужатьТ» («т» lev) = t
      | none => false

partial def «неотрицательно» (s : «Исх») («т0» «чья» : String) («связ» : List String) («гл» : Nat) : Except String Unit :=
  let t := «ужатьТ» «т0»
  if «гл» > 12 then .error s!"глубина разбора терма «{t}» больше 12" else
  match «числоТочно» t with
  | some v => if v ≥ 0 then .ok () else .error s!"лист «{t}» — отрицательное число"
  | none =>
  if «связ».contains t || s.«требуетНеотр» «чья» t || t.startsWith "длина " then .ok () else
  if t.startsWith "свёртка " then
    let dsh := «разрез» t "→"
    let dim := «разрез» dsh.«лево» "как"
    let nch := «разрез» dim.«лево» "начиная с"
    let nms := «разрез» dim.«право» "и"
    let acc := «ужатьТ» nms.«лево»
    let el := «ужатьТ» nms.«право»
    if dsh.«есть» && dim.«есть» && nch.«есть» && nms.«есть» && acc ≠ "" && el ≠ "" && !((acc.splitOn " ").length > 1) &&
       !((el.splitOn " ").length > 1) && acc ≠ el && («шагСчёта» dsh.«право» acc none || «шагСМерой» dsh.«право» acc) then
      «неотрицательно» s nch.«право» «чья» «связ» («гл» + 1)
    else .error s!"свёртка «{t}»: шаг не счёт по форме"
  else match «разрезВыбора» t with
  | some (_, a, b) => do
    «неотрицательно» s a «чья» «связ» («гл» + 1)
    «неотрицательно» s b «чья» «связ» («гл» + 1)
  | none =>
    let sm := «разрез» t "плюс"
    if sm.«есть» then do
      «неотрицательно» s sm.«лево» «чья» «связ» («гл» + 1)
      «неотрицательно» s sm.«право» «чья» «связ» («гл» + 1)
    else
    let pr := «разрез» t "умножить на"
    if pr.«есть» then
      let pos := fun (x : String) => match «числоТочно» («ужатьТ» x) with | some v => v > 0 && v ≤ 9007199254740991.0 | none => false
      if pos pr.«право» then «неотрицательно» s pr.«лево» «чья» «связ» («гл» + 1)
      else if pos pr.«лево» then «неотрицательно» s pr.«право» «чья» «связ» («гл» + 1)
      else .error s!"произведение «{t}»: ни один сомножитель не выписанное число больше нуля"
    else
    let f := «ёлочка» t 1
    if f ≠ "" && t.startsWith s!"«{f}» от " && f ≠ «чья» then
      let tail := «обрезать» («после» t s!"«{f}» от ")
      let body := s.«плоскоеТело» f
      let ds := s.«именаДоводовФункции» f
      let args := «сверху» tail "и"
      if body ≠ "" && !ds.isEmpty && ds.length = args.length then
        let r := (ds.zip args).foldl (fun acc (d, x) => «вместо» acc d («т» («обрезать» x))) body
        «неотрицательно» s r «чья» «связ» («гл» + 1)
      else .error s!"форма «{t}» сверщику незнакома"
    else .error s!"форма «{t}» сверщику незнакома"

def «неотр?» (s : «Исх») (t «чья» : String) («связ» : List String) : Bool :=
  match «неотрицательно» s t «чья» «связ» 0 with | .ok _ => true | .error _ => false

def «связанныеСлучая» («хвост» : String) : List String :=
  if «хвост».startsWith "голова" then
    match «сверху» «хвост» "и" with
    | [x0, x1] =>
      let g := if «обрезать» x0 = "голова" then "голова" else «обрезать» («после» («обрезать» x0) "голова ")
      let x := if «обрезать» x1 = "хвост" then "хвост" else «обрезать» («после» («обрезать» x1) "хвост ")
      (if g ≠ "" then [g] else []) ++ (if x ≠ "" then [x] else [])
    | _ => []
  else if «хвост» = "пусто" then []
  else
    let r := («разрез» «хвост» "с").«право»
    if r = "" then [] else
    («сверху» r "и").filterMap fun k => let n := «обрезать» («разрез» k "как").«право»; if n ≠ "" then some n else none

partial def «собратьТелоСлучая» (L : Array String) (i «конец» «гл» : Nat) : String :=
  if «гл» = 0 || i ≥ «конец» then "" else
  let l0 := L[i]!
  if l0 = "то" || l0 = "иначе" then «собратьТелоСлучая» L (i + 1) «конец» («гл» - 1) else
  let l := if l0.startsWith "то " then «обрезать» (l0.«сн» 3) else if l0.startsWith "иначе " then «обрезать» (l0.«сн» 6) else l0
  if l.startsWith "пусть " then
    let n := «слово» l 2
    let v := «словаС» l 3
    if «слово» l 3 ≠ "равно" || n = "" || v = "" || (n.splitOn "(").length > 1 then "" else
    let rest := «собратьТелоСлучая» L (i + 1) «конец» («гл» - 1)
    if rest ≠ "" then «т» («вместо» rest n («т» v)) else ""
  else if i + 1 = «конец» then «т» l
  else if !l.startsWith "если " then ""
  else if («разрезЦепочкой» («т» l)).isSome then ""
  else
    let u := «обрезать» (l.«сн» 5)
    match (List.range' (i + 1) («конец» - i - 1)).find? (fun j => L[j]! = "то" || L[j]!.startsWith "то ") with
    | none => ""
    | some j =>
      match (List.range' (j + 1) («конец» - j - 1)).find? (fun k => L[k]! = "иначе" || L[k]!.startsWith "иначе ") with
      | none => ""
      | some k =>
        let a := «собратьТелоСлучая» L j k («гл» - 1)
        let b := «собратьТелоСлучая» L k «конец» («гл» - 1)
        if a = "" || b = "" || u = "" then "" else «т» s!"если ( {u} ) то ( {a} ) иначе ( {b} )"

def «Исх».«телоСлучая» (s : «Исх») (ci «конец» : Nat) : String :=
  let kr := ((s.«меж» ci «конец»).find? (fun i => (s.«строка» i).startsWith "случай " && «отступ» (s.«сырая» i) ≤ «отступ» (s.«сырая» ci))).getD «конец»
  let ls := (s.«меж» ci kr).filterMap (fun i => let l := s.«строка» i; if l = "" then none else some l)
  if ls.isEmpty || ls.length > 5 then "" else «собратьТелоСлучая» ls.toArray 0 ls.length 8

def «Исх».«прямаяПоПредположению» (s : «Исх») («чья» : String) : Bool :=
  match s.«блокС» «чья» with
  | none => false
  | some (a, b) =>
    if (s.«строкаРазбора» a b).isSome then
      let cs := (s.«меж» a b).filter (fun i => (s.«строка» i).startsWith "случай ")
      let ds := s.«именаДоводовФункции» «чья»
      !cs.isEmpty && cs.all fun i =>
        !((«связанныеСлучая» («словаС» (s.«строка» i) 1)).any (ds.contains ·)) &&
        «неотр?» s (s.«телоСлучая» i b) «чья» []
    else
      let t := s.«телоТекстом» a b
      t ≠ "" && «неотр?» s t «чья» []

def «свёрткаПодДлиной» («лев» «прав» : String) : Bool :=
  let u := «ужатьТ» «лев»
  let p := «ужатьТ» «прав»
  let dsh := «разрез» u "→"
  let dim := «разрез» dsh.«лево» "как"
  let nch := «разрез» dim.«лево» "начиная с"
  let nms := «разрез» dim.«право» "и"
  if !u.startsWith "свёртка " || !dsh.«есть» || !dim.«есть» || !nch.«есть» || !nms.«есть» then false else
  let acc := «ужатьТ» nms.«лево»
  let el := «ужатьТ» nms.«право»
  let sp := «ужатьТ» («после» nch.«лево» "свёртка ")
  «имяВывода» acc && «имяВывода» el && acc ≠ el && «ужатьТ» nch.«право» = "0" &&
  p.startsWith "длина " && «простойС» («словаС» p 1) && «ужатьТ» («словаС» p 1) = sp &&
  «шагСчёта» dsh.«право» acc (some 1)

def «Исх».«свёрткаНеДлиннее» (s : «Исх») («чья» «цель» : String) : Bool :=
  match «разрезСл» («ужатьТ» («т» «цель»)) " не больше " with
  | some (t, m) =>
    «ужатьТ» t = "результат" && (match s.«блокС» «чья» with
      | some (a, b) => «свёрткаПодДлиной» («ужатьТ» (s.«телоТекстом» a b)) m
      | none => false)
  | none => false

def «Исх».«всеТребования» (s : «Исх») (f : String) : List String :=
  match s.«блокС» f with
  | none => []
  | some (a, b) => (s.«меж» a b).filterMap fun i => let l := s.«по» i; if l.startsWith "требует " then some l else none

def «Исх».«обещанияФункции» (s : «Исх») (f : String) : List (Nat × String) :=
  match s.«блокС» f with
  | none => []
  | some (a, b) => (List.range' a (b - a)).filterMap fun i =>
    let l := s.«строка» i
    if l.startsWith "обеспечивает «" || (l.startsWith "для всех " && (l.splitOn " обеспечивает «").length > 1) then some (i, l) else none

def «Исх».«началоОтВызванной» (s : «Исх») («доказанные» : List String) («чья» «цель» : String) : Bool :=
  match «разрезСл» («ужатьТ» («т» «цель»)) " начинается с " with
  | none => false
  | some (t, p) =>
    if «ужатьТ» t ≠ "результат" then false else
    match «литерал?» («ужатьТ» p), s.«блокС» «чья» with
    | some lp, some (a, b) =>
      let body := «ужатьТ» (s.«телоТекстом» a b)
      let f := «ёлочка» body 1
      if f = "" || !body.startsWith s!"«{f}» от " || !(s.«всеТребования» f).isEmpty || (s.«блокС» f).isNone then false else
      let ds := «доводыВызоваС» («после» body s!"«{f}» от ")
      if !ds.all (fun d => «имяВывода» («ужатьТ» d)) then false else
      (s.«обещанияФункции» f).any fun (_, l) =>
        let n := «ёлочка» l 1
        «доказанные».contains n &&
        (match «разрезСл» («ужатьТ» («т» («после» l s!"обеспечивает «{n}» "))) " начинается с " with
         | some (t2, p2) => «ужатьТ» t2 = "результат" && (match «литерал?» («ужатьТ» p2) with | some lb => lb.startsWith lp | none => false)
         | none => false)
    | _, _ => false

def «свободноВ» («на» b : String) : Bool := Id.run do
  let pats := [s!" для всех {b} из ", s!" есть такой {b},", s!" как {b} →", s!" как {b} и ", s!" и {b} →", s!" где {b} →",
               s!" случай {b} и ", s!" и {b} то ", s!" пусть {b} "]
  let mut cs := (" " ++ «т» «на» ++ " ").toList.toArray
  for pat in pats do
    let pc := pat.toList
    for _ in [0:cs.size + 1] do
      let mut found : Option Nat := none
      for i in [0:cs.size] do
        if found.isNone && «стоитНа» cs i pc then found := some i
      match found with
      | none => break
      | some k0 =>
        let mut k := k0
        let mut gl : Int := 0
        while k < cs.size && (cs[k]! ≠ ')' || gl > 0) do
          if cs[k]! = '(' then gl := gl + 1
          if cs[k]! = ')' then gl := gl - 1
          cs := cs.set! k ' '
          k := k + 1
  return «естьТ» (String.ofList cs.toList) b

/-- ADR-0103: инстанция ограничения строки `l` вызванной «f» на доводах вызова и
снята ли она: «Т не меньше 0», Т неотрицательно грамматикой Н при дне у параметров
«чья» встроенного натурального типа. Пусто — ограничения нет. -/
def «Исх».«ограничениеНаДоводах» (s : «Исх») («чья» f l : String) («арги» : List String) : String × Bool :=
  let («огр», «связ») := «ограничениеПостусловия» l
  let param := (s.«доводы» f).«голые»
  if «огр» = "" || param.length ≠ «арги».length || !«связанныеПараметры» «связ» param then ("", false) else
  let «о» := (List.range param.length).foldl (fun acc j => «вместо» acc (param.getD j "") («т» («арги».getD j ""))) («т» «огр»)
  let d := s.«доводы» «чья»
  let «дно» := ((d.«имена».zip d.«типы»).filter (fun (_, ty) => «натуральноеИмя» («имяТипа» ty))).map (fun (n, _) => «голо» («обрезать» n))
  («о», match «разрезСл» («ужатьТ» «о») " не меньше " with
    | some (x, pr) => «ужатьТ» pr = "0" && «неотр?» s x «чья» «дно»
    | none => false)

def «Исх».«цельОтВызванной» (s : «Исх») («доказанные» : List String) («чья» «цель» : String) : Bool :=
  let g := «ужатьТ» («т» «цель»)
  match s.«блокС» «чья» with
  | none => false
  | some (a, b) =>
    let body := «безВнешних» (s.«телоБезПуст» a b)
    let f := «ёлочка» body 1
    let ds := match «делСв» body " от " with
      | some (_, r) => «доводыВызоваС» r
      | none => []
    let head := match «найтиСв» body [" от "] with
      | some (k, _) => if ds.isEmpty then body else «доЗнака» body k
      | none => body
    if f = "" || «обрезать» head ≠ s!"«{f}»" || !(s.«всеТребования» f).isEmpty || (s.«блокС» f).isNone then false
    else if !ds.all «простойС» then false
    else
      let names := s.«именаДоводовФункции» «чья» ++ s.«именаДоводовФункции» f
      if names.any («свободноВ» g ·) then false else
      match s.«блокС» f with
      | none => false
      | some (fa, fb) =>
        (s.«обещанияФункции» f).any fun (i, l) =>
          let n := «ёлочка» l 1
          (!((l.splitOn " таких что ").length > 1) || (s.«ограничениеНаДоводах» «чья» f l ds).2) &&
          !(i + 1 < fb && (s.«сырая» (i + 1)).startsWith "   ") &&
          «доказанные».contains n && «ужатьТ» («т» («после» l s!"обеспечивает «{n}» ")) = g && fa ≤ i

partial def «началоПоПостроениюТ» (t p lp : String) («гл» : Nat) : Bool :=
  let u := «ужатьТ» t
  if «гл» > 12 then false
  else if u = p then true
  else match «литерал?» u with
  | some lt => lt.startsWith lp
  | none => match «склейкаВывода» u with
    | some (l, _) => «началоПоПостроениюТ» l p lp («гл» + 1)
    | none => match «выборВывода» u with
      | some (a, b) => «началоПоПостроениюТ» a p lp («гл» + 1) && «началоПоПостроениюТ» b p lp («гл» + 1)
      | none => false

def «Исх».«началоПоТелу» (s : «Исх») («чья» «цель» : String) : Bool :=
  match «разрезСл» («ужатьТ» («т» «цель»)) " начинается с " with
  | none => false
  | some (t, p) =>
    if «ужатьТ» t ≠ "результат" then false else
    match «литерал?» («ужатьТ» p) with
    | none => false
    | some lp =>
      let body := s.«плоскоеТело» «чья»
      body ≠ "" && «началоПоПостроениюТ» body («ужатьТ» p) lp 0

def «Исх».«изВысказывания» (s : «Исх») («где» : Nat) («имя» : String) : String :=
  s.«типВысказывания» «где» «имя»

def «Исх».«неотрицательноУтверждение» (s : «Исх») («высказывание» : Option String) («цель» : String) : Bool :=
  match «высказывание» with
  | none => false
  | some m =>
    if «естьТ» («т» «цель») "результат" then false else
    match «разрезСл» («ужатьТ» («т» «цель»)) " не меньше " with
    | none => false
    | some (l, p) =>
      if «ужатьТ» p ≠ "0" then false else
      let g := s.«высказывание» m
      let names := s.«именаВысказывания» g
      let dno := names.filter fun n => s.«видТипа» («имяТипа» (s.«типВысказывания» g n)) == .«отрезок»
      «неотр?» s l "" dno

def «Исх».«цельПостусловием» (s : «Исх») («высказывание» : Option String) («имя» «чья» «цель» : String)
    («доказанные» «объявленные» : List String) : Bool :=
  let v := «ужатьТ» («т» «цель»)
  let zov := s!"«{«чья»}» от "
  match «высказывание» with
  | none => false
  | some m =>
    if «чья» = "" || !v.startsWith zov then false else
    match s.«блокС» «чья» with
    | none => false
    | some (a, b) =>
      let d := s.«доводы» «чья»
      let args := «доводыВызоваС» («после» v zov)
      let g := s.«высказывание» m
      let typesOk := (List.range args.length).all fun k =>
        let ty := «обрезать» (d.«типы».getD k "")
        ty ≠ "" && «обрезать» (s.«типВысказывания» g («голо» («ужатьТ» (args.getD k "")))) = ty
      if !typesOk then false else
      let o0 : «Обст» := { «исх» := s }
      let o := { o0 with «цель» := v, «обяз» := «имя», «доказанные» := «доказанные», «объявленные» := «объявленные» }
      (List.range' a (b - a)).any fun i =>
        let l := s.«строка» i
        if !l.startsWith "обеспечивает «" then false else
        let p0 : «Прогон» := { «цели» := [v], «идёт» := true }
        let p := «ходФакта» p0 s!"ход 1 факт по свойству «{«ёлочка» l 1}» строка {i} вызов ⟨{v}⟩" o
        if !p.«беды».isEmpty || !p.«неВзялся».isEmpty || p.«факт» = "" then false else
        let p := «закрытьПоСвойству» p "ход 2 закрыть по свойству"
        p.«беды».isEmpty && p.«цели».isEmpty


/-! ### Разбор по случаю и развёртка на выписанном конструкторе — зеркало сверщика на C (ADR-0133);
    из `Node.lean` сюда, чтобы «разборомЦели» могла звать развёртку. -/

def «вариантСлучая» («хвост» : String) : String :=
  if «хвост».startsWith "вариант " then «имяВарианта» «хвост»
  else if «хвост».startsWith "голова " then "голова и хвост"
  else if «хвост» = s!"«{«ёлочка» «хвост» 1}»" then «ёлочка» «хвост» 1
  else «слово» «хвост» 1

def «Исх».«случайРазбора» (s : «Исх») (r b : Nat) («вариант» : String) : Option Nat := Id.run do
  let dr := «отступ» (s.«сырая» r)
  let mut d : Option Nat := none
  for i in s.«меж» r b do
    let l := s.«строка» i
    if l = "" then continue
    let o := «отступ» (s.«сырая» i)
    if o ≤ dr then return none
    if !l.startsWith "случай " then continue
    if d.isNone then d := some o
    if d = some o && «вариантСлучая» («словаС» l 1) = «вариант» then return some i
  return none

def «общийПрефиксБайт» (a b : String) : Nat :=
  let x := a.toUTF8
  let y := b.toUTF8
  ((List.range (min x.size y.size)).takeWhile (fun i => x.get! i = y.get! i)).length

def «тоЖеИмяРазбора» («что» «по» : String) («доводы» : List String) : Bool :=
  let «ч» := «голо» «что»
  let «п» := «голо» «по»
  if «ч» = «п» then true
  else if («ч».splitOn " ").length > 1 || «п».utf8ByteSize < 6 then false
  else if «общийПрефиксБайт» «ч» «п» + 4 < «п».utf8ByteSize then false
  else if «доводы».any (fun «д» => «голо» «д» = «ч») then false
  else («доводы».filter (fun «д» => let dd := «голо» «д»; dd.utf8ByteSize ≥ 6 && «общийПрефиксБайт» «ч» dd + 4 ≥ dd.utf8ByteSize)).length = 1

def «Исх».«случайТела» (s : «Исх») («чья» : String) (a b : Nat) («по» «вариант» : String) : Option Nat :=
  match s.«строкаРазбора» a b with
  | some (r, «что») => if «тоЖеИмяРазбора» «что» «по» (s.«именаДоводовФункции» «чья») then s.«случайРазбора» r b «вариант» else none
  | none => none

/-- Ветвь «любое» разбора по `по` (пусто — любого разбора блока): первая строка
    `случай любое` на отступе случаев, как `найти_любое` сверщика на C (ADR-0133, Инд7). -/
def «Исх».«найтиЛюбое» (s : «Исх») (a b : Nat) («по» : String) : Option Nat := Id.run do
  let some r := (List.range' a (b - a)).find? (fun i => (s.«строка» i).startsWith "разбор ") | return none
  if «по» ≠ "" && «обрезать» («словаС» (s.«строка» r) 1) ≠ «по» then return none
  let mut d : Option Nat := none
  for i in s.«меж» r b do
    let l := s.«строка» i
    if !l.startsWith "случай " then continue
    let o := «отступ» (s.«сырая» i)
    if d.isNone then d := some o
    if d = some o && «обрезать» l = "случай любое" then return some i
  return none


def «Исх».«развернутьВариантом» (s : «Исх») (t «чья» : String) : String := Id.run do
  let g := «т» t
  let n := «ёлочка» g 1
  if n = "" || n = «чья» || !g.startsWith s!"«{n}» от " then return t
  let some (a, b) := s.«блокС» n | return t
  let ds := s.«именаДоводовФункции» n
  let args := «доводыВызоваС» («обрезать» («после» g s!"«{n}» от "))
  if ds.isEmpty || ds.length ≠ args.length then return t
  let razb := (List.range' a (b - a)).filter (fun i => (s.«строка» i).startsWith "разбор ")
  let mut kr : Option Nat := none
  for i in razb do
    for k in [0:ds.length] do
      if «обрезать» («словаС» (s.«строка» i) 1) = ds.getD k "" then kr := some k
  if razb.length ≠ 1 then return t
  let some k0 := kr | return t
  let dv := «ужатьТ» («обрезать» (args.getD k0 ""))
  if !dv.startsWith "вариант «" then return t
  let var := «ёлочка» dv 1
  if var = "" then return t
  -- ADR-0133: ветви варианта нет — берётся ветвь «любое» того же разбора, как `найти_любое` сверщика.
  let (ci, «любое») ← match s.«случайТела» n a b (ds.getD k0 "") var with
    | some ci => pure (ci, false)
    | none => match s.«найтиЛюбое» a b (ds.getD k0 "") with
      | some ci => pure (ci, true)
      | none => return t
  let mut body := s.«телоСлучая» ci b
  if body = "" then return t
  let hs := if «любое» then "" else «словаС» (s.«строка» ci) 1
  let mut pk : Array String := #[]
  let mut nk : Array String := #[]
  let r1 := («разрез» hs "с").«право»
  if r1 ≠ "" then
    for part in «сверху» r1 "и" do
      let f := «обрезать» («разрез» part "как").«лево»
      let nm := «обрезать» («разрез» part "как").«право»
      if f = "" || nm = "" then return t
      pk := pk.push f
      nk := nk.push nm
  let mut pv : Array String := #[]
  let mut vv : Array String := #[]
  let r2 := («разрез» dv "с").«право»
  if r2 ≠ "" then
    for part in «сверху» r2 "и" do
      let f := «обрезать» («разрез» part "равным").«лево»
      let v := «обрезать» («разрез» part "равным").«право»
      if f = "" || v = "" then return t
      pv := pv.push f
      vv := vv.push v
  if !«любое» && pk.size ≠ pv.size then return t
  let mut marks : Array String := #[]
  let mut vals : Array String := #[]
  for k in [0:pk.size] do
    match (List.range pv.size).find? (fun j => pv[j]! = pk[k]!) with
    | none => return t
    | some j =>
      marks := marks.push s!"%п{k}%"
      vals := vals.push («т» vv[j]!)
  for k in [0:nk.size] do
    body := «вместо» body nk[k]! marks[k]!
  for k in [0:ds.length] do
    -- разбираемый довод пропускается, только когда имя образца его затеняет (как в сверщике)
    if k = k0 && nk.contains (ds.getD k "") then continue
    marks := marks.push s!"%д{k}%"
    vals := vals.push («т» («обрезать» (args.getD k "")))
    body := «вместо» body (ds.getD k "") marks[marks.size - 1]!
  for k in [0:marks.size] do
    body := «вместо» body marks[k]! vals[k]!
  return «т» body

def «закрывающая» (cs : Array Char) (p : Nat) : Option Nat := Id.run do
  let mut gl : Int := 0
  let mut q := p
  while q < cs.size do
    if cs[q]! = '(' then gl := gl + 1
    else if cs[q]! = ')' then
      gl := gl - 1
      if gl = 0 then return some q
    q := q + 1
  return none

def «Исх».«развернутьВезде» (s : «Исх») (t «чья» : String) : String := Id.run do
  let mut r := «т» t
  for _ in [0:24] do
    let r2 := s.«развернутьВариантом» r «чья»
    if r2 ≠ r then
      r := «т» r2
      continue
    let cs := r.toList.toArray
    let pat := "( «".toList
    let mut changed := false
    let mut p := 0
    while p < cs.size && !changed do
      if «стоитНа» cs p pat then
        match «закрывающая» cs p with
        | none => p := cs.size
        | some q =>
          let inner := «обрезать» (String.ofList (cs.extract (p + 1) q).toList)
          let nn := s.«развернутьВариантом» inner «чья»
          if nn ≠ inner then
            r := «т» (String.ofList (cs.extract 0 p).toList ++ «вСкобки» nn ++ String.ofList (cs.extract (q + 1) cs.size).toList)
            changed := true
      p := p + 1
    if !changed then break
  return r

/-- Факты для цели, которую не закрыло тело, — зеркало `факты_цели` сверщика на C. Два источника,
    и оба не ищут: `требует` самой функции и постусловие вызванной `«G» от …` в цели, когда оно
    уже проиграно (реестр доказанного), у G нет `требует` и обещание не под квантором и не
    многострочное: параметры заменены доводами вызова, `результат` — самим вызовом. Фактов не
    больше четырёх. -/
def «Исх».«фактыЦели» (s : «Исх») («цель» «чья» : String) («доказанные» : List String) : List String := Id.run do
  let mut r : List String := []
  match s.«блокС» «чья» with
  | some (a, b) =>
    for f in s.«требованияФункции» a b do
      if f ≠ "" then r := r ++ [f]
  | none => pure ()
  let cs := «цель».toList.toArray
  let stops := [" то ", " иначе ", " и притом ", " или ", " равен ", " равно ", " не ", " меньше ", " больше ",
    " плюс ", " минус ", " содержит "].map String.toList
  for i in [0:cs.size] do
    if r.length ≥ 4 then break
    if cs[i]! ≠ '«' || (i > 0 && cs[i - 1]! ≠ ' ') then continue
    let vs := cs.extract i cs.size
    let v0 := String.ofList vs.toList
    let g := «ёлочка» v0 1
    if g = "" || !v0.startsWith s!"«{g}» от " then continue
    let start := (s!"«{g}» от ").length
    let mut gl : Int := 0
    let mut kav := false
    let mut e := start
    while e < vs.size do
      let ch := vs[e]!
      if kav then
        if ch = '\\' && e + 1 < vs.size then e := e + 1
        else if ch = '"' then kav := false
      else if ch = '"' then kav := true
      else if ch = '(' then gl := gl + 1
      else if ch = ')' then
        gl := gl - 1
        if gl < 0 then break
      else if gl = 0 && stops.any («стоитНа» vs e ·) then break
      e := e + 1
    let v := «обрезать» (String.ofList (vs.extract 0 e).toList)
    let args := «доводыВызоваС» («отЗнака» v start)
    let some (_, fb) := s.«блокС» g | continue
    let ps := (s.«доводы» g).«голые»
    if ps.length ≠ args.length || ps.isEmpty || !(s.«всеТребования» g).isEmpty || !args.all «простойС» then continue
    if (List.range ps.length).any (fun k => (List.range ps.length).any (fun m =>
        k < m && «естьТ» («т» (args.getD k "")) (ps.getD m ""))) then continue
    for (j, l) in s.«обещанияФункции» g do
      if !l.startsWith "обеспечивает «" then continue
      let n := «ёлочка» l 1
      if !«доказанные».contains n then continue
      if j + 1 < fb && (s.«сырая» (j + 1)).startsWith "   " then continue
      let f0 := «т» («обещанная» («после» l s!"обеспечивает «{n}» "))
      if f0 = "" || «связывательКромеРазбора» f0 then continue
      let bound := «именаОбразцов» f0
      if «словаСреди» v bound || bound.contains "результат" || args.any (fun a => «естьТ» («т» a) "результат") ||
          ps.any (bound.contains ·) then continue
      let mut f := f0
      for (p, a) in ps.zip args do
        f := «вместо» f p («т» a)
      f := «т» («вместо» f "результат" («вСкобки» v))
      if r.length < 4 && !r.contains f then r := r ++ [f]
  return r

def «именаЦели» (s : «Исх») («свои» : List String) («чья» : String) : List (String × String) :=
  («свои».filter (·.startsWith "для всех «")).map (fun l => («ёлочка» l 1, «обрезать» («уголок» l 1))) ++
  (if «чья» = "" then [] else (s.«подпись» «чья»).map (fun p => («голо» p.1, «обрезать» p.2)))

def «разборомЦели» (c0 : «Счёт») («свои» : List String) («чья» «цель» : String) («доказанные?» : Option (List String) := none) : Bool :=
  let c := { c0 with «имена» := «именаЦели» c0.«исх» «свои» «чья» }
  let s := c.«исх»
  if «свои».any (·.startsWith "принцип тип ") || «свои».any (·.startsWith "посылка ") then false
  else if «цель» = "" || !«кавычкиЧисты» «цель» then false
  else if «чья» = "" && !«естьСвязыватель» («т» «цель») && «закрыта» c («т» «цель») then true
  else match s.«блокС» «чья» with
  | none => false
  | some (a, b) =>
    let body := s.«телоРазбора» a b
    if body = "" || !«кавычкиЧисты» body then false else
    let g := «вместо» («поляРезультатаВыбором» («поляРезультата» («т» «цель») body) body) "результат" body
    -- разбор в цели снимает половина (`связыватель_кроме_разбора` сверщика на C)
    if «связывательКромеРазбора» g then false
    else
      let g1 := s.«развернутьВызовыРаз» g «чья»
      let g2 := s.«развернутьВызовыРаз» g1 «чья»
      -- ADR-0133: вызов на выписанном конструкторе разворачивается ветвью его разбора
      -- (`развёрнутая_закрыта` сверщика на C); связыватель в развёрнутом — честный отказ.
      let g3 := s.«развернутьВезде» g «чья»
      -- Плоская развёртка — приём одного второго сверщика: её цели закрываются без развёртки
      -- вызовов в половине, иначе он брал бы места, которых сверщик на C не берёт.
      let cp := { c with «развёрток» := 2 }
      «закрыта» c g || (g1 ≠ g && «закрыта» cp g1) || (g2 ≠ g1 && «закрыта» cp g2) ||
        (g3 ≠ g && !«связывательКромеРазбора» g3 && «закрыта» c g3) ||
        -- факты цели (`факты_цели` на C): цель, совпавшая с фактом, закрыта; иначе факт встаёт «да»
        -- на своё место. В разбор факт не входит: цель с разбором так не закрывается.
        (!((g.splitOn "разбор ").length > 1) && «доказанные?».isSome &&
          (let fs := s.«фактыЦели» g «чья» («доказанные?».getD [])
           fs.contains («т» g) ||
           (let g4 := fs.foldl (fun acc f => («подставитьУсловие» acc f "да").1) g
            g4 ≠ g && «закрыта» c g4))) ||
        s.«изОбъявленного» c g a b || s.«невыполнимаяПосылка» c a b

end «Второй»
