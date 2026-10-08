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
  | .«чис» x, .«чис» y => !x.isNaN && !y.isNaN && x != y
  | .«приз» x, .«приз» y => x != y
  | .«длн» x, .«длн» y => x != y
  | _, _ => false

partial def «значМоё» (c : «Счёт») («сырой» : String) («гл» : Nat) : «Зн» :=
  let t := «безВнешних» «сырой»
  let z := «значениеС» c t
  if z.«есть» || «гл» > 6 then z else
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

mutual

partial def «половинаЗакрыта» (c : «Счёт») («сырой» : String) («делений» : Nat) («конечен» : Option String) : Bool :=
  let t := «безВнешних» («сжатьВыборы» («безВнешних» «сырой»))
  if t = "да" then true
  else if t = "нет" then false
  else match «разрезВыбора» t with
  | some (u, a, b) =>
    let uu := «безВнешних» u
    if uu = "да" then «половинаЗакрыта» c a «делений» «конечен»
    else if uu = "нет" then «половинаЗакрыта» c b «делений» «конечен»
    else match «значМоё» c uu 0 with
    | .«приз» v => «половинаЗакрыта» c (if v then a else b) «делений» «конечен»
    | _ =>
      let (au, par) := «атомУсловия» uu
      if au = "да" || au = "нет" then
        let lit := au = "да"
        «половинаЗакрыта» c (if lit == par then b else a) «делений» «конечен»
      else «деление» c t au «делений» «конечен»
  | none =>
    match «значМоё» c t 0 with
    | .«приз» v => v
    | _ =>
      let notFalse := t.startsWith "не " && («найтиСв» (t.«сн» 3) [" и притом ", " или "]).isNone &&
        (match «значМоё» c (t.«сн» 3) 0 with | .«приз» v => !v | _ => false)
      if notFalse then true else
      match «оговоркаОКонечности» c t with
      | some (tk, pod) => «половинаЗакрыта» c pod «делений» (some tk)
      | none =>
        if «квадратПодОговоркой» c t «конечен» then true else
        let viaConn := match «найтиСв» t [" и притом ", " или "] with
          | some (g, k) =>
            let l := «доЗнака» t g
            let p := «отЗнака» t (g + (if k = 0 then 10 else 5))
            «простойИлиНе» l && «простойИлиНе» p &&
              (let el := «половинаЗакрыта» c l «делений» «конечен»
               let ep := «половинаЗакрыта» c p «делений» «конечен»
               if k = 0 then el && ep else el || ep)
          | none => false
        if viaConn then true else
        let viaEq := match «найтиСв» t [" равен "] with
          | some (g, _) =>
            let l := «доЗнака» t g
            let p := «отЗнака» t (g + 7)
            «простойС» l && «простойС» p && «тождественны» c l p 0
          | none => false
        if viaEq then true
        else if «мераНеотрицательна» t then true
        else if «началоПоПостроению» c t then true
        else if (match «первоеУсловие» t with
            | some u => «деление» c t («атомУсловия» u).1 «делений» «конечен»
            | none => false) then true
        else match «первыйАтом» c t with
          | some u => «деление» c t u «делений» «конечен»
          | none => false

partial def «деление» (c : «Счёт») (t u : String) («делений» : Nat) («конечен» : Option String) : Bool :=
  if «делений» ≥ 4 || «естьСвязыватель» t then false else
  let (da, n1) := «подставитьУсловие» t u "да"
  let (net, n2) := «подставитьУсловие» t u "нет"
  if n1 < 1 || n1 ≠ n2 then false
  else «половинаЗакрыта» c da («делений» + 1) «конечен» && «половинаЗакрыта» c net («делений» + 1) «конечен»

end

def «закрыта» (c : «Счёт») (t : String) : Bool := «половинаЗакрыта» c t 0 none

def «отступСтроки» (s : String) : Nat := (s.toList.takeWhile (· = ' ')).length

def «Исх».«концаПодгруппы» (s : «Исх») (i b «над» : Nat) : Nat :=
  ((List.range' i (b - i)).find? (fun j => s.«строка» j ≠ "" && «отступСтроки» (s.«сырая» j) ≤ «над»)).getD b

partial def «Исх».«выражениеСтрок» (s : «Исх») («голова» : String) (i j «над» «глубина» : Nat) : String := Id.run do
  let h := «обрезать» «голова»
  if «глубина» > 24 || h = "" then return ""
  let ls := (List.range' i (j - i)).filter (fun k => s.«строка» k ≠ "")
  match ls.head? with
  | none => return «т» h
  | some k0 =>
    let d1 := «отступСтроки» (s.«сырая» k0)
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
      if «отступСтроки» (s.«сырая» k) ≠ d1 || br.size ≥ 2 || !l.startsWith (marks.getD br.size "") then return ""
      let kon := s.«концаПодгруппы» (k + 1) j d1
      let v := s.«выражениеСтрок» («после» l (marks.getD br.size "")) (k + 1) kon d1 («глубина» + 1)
      if v = "" then return ""
      br := br.push v
      k := kon
    if br.size ≠ 2 then return ""
    return «т» s!"если {«вСкобки» («т» u)} то {«вСкобки» br[0]!} иначе {«вСкобки» br[1]!}"

def «объявление?С» (l : String) : Bool := «объявленияТела».any (l.startsWith ·)

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

def «Исх».«телоРазбора» (s : «Исх») (a b : Nat) : String :=
  let t := s.«телоБезПуст» a b
  if t ≠ "" then t else s.«телоМногострочное» a b

def «разборомЦели» (c : «Счёт») («свои» : List String) («чья» «цель» : String) : Bool :=
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
    if «естьСвязыватель» g then false
    else «закрыта» c g || s.«изОбъявленного» c g a b || s.«невыполнимаяПосылка» c a b

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
  let kr := ((s.«меж» ci «конец»).find? (fun i => (s.«строка» i).startsWith "случай ")).getD «конец»
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
          !((l.splitOn " таких что ").length > 1) && !(i + 1 < fb && (s.«сырая» (i + 1)).startsWith "   ") &&
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


end «Второй»
