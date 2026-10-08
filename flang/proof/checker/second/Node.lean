import Body

open «Разбор»

namespace «Второй»

inductive «Узел» where
  | «проигран» («булев» : Bool)
  | «мимо»
  | «не» («почему» : String)
  | «ложь» («беды» : List String)

def «правилоПосылки» (l : String) : String := «ёлочка» l 3
def «вариантПосылки» (l : String) : String := «ёлочка» l 2

def «вариантСлучая» («хвост» : String) : String :=
  if «хвост».startsWith "вариант " then «имяВарианта» «хвост»
  else if «хвост».startsWith "голова " then "голова и хвост"
  else if «хвост» = s!"«{«ёлочка» «хвост» 1}»" then «ёлочка» «хвост» 1
  else «слово» «хвост» 1

def «Исх».«найтиСлучай» (s : «Исх») (a b : Nat) («вариант» : String) : Option Nat :=
  (List.range' a (b - a)).find? fun i =>
    let l := s.«строка» i
    l.startsWith "случай " && «вариантСлучая» («словаС» l 1) = «вариант»

def «образецКакТерм» («хвост» «тип» : String) : String :=
  let str := «тип» = "строка"
  if «хвост» = "пусто" then (if str then "\"\"" else "пустой список")
  else if «хвост».startsWith "голова" then
    match «сверху» «хвост» "и" with
    | [x0, x1] =>
      let g := if «обрезать» x0 = "голова" then "голова" else «обрезать» («после» («обрезать» x0) "голова ")
      let x := if «обрезать» x1 = "хвост" then "хвост" else «обрезать» («после» («обрезать» x1) "хвост ")
      if g = "" || x = "" then "" else if str then s!"соединить {g} с {x}" else s!"приписать {g} к {x}"
    | _ => ""
  else if «хвост».startsWith "вариант «" then
    let n := «ёлочка» «хвост» 1
    if n = "" then "" else
    let r := («разрез» «хвост» "с").«право»
    if r = "" then s!"вариант «{n}»" else
    let parts := («сверху» r "и").map fun k =>
      let f := match k.splitOn " как " with | a :: _ :: _ => «обрезать» a | _ => ""
      let nm := «обрезать» («разрез» k "как").«право»
      if f = "" || nm = "" then none else some s!"{f} равным {nm}"
    if parts.all Option.isSome then s!"вариант «{n}» с {" и ".intercalate (parts.filterMap id)}" else ""
  else ""

def «Исх».«допущенияИндукции» (s : «Исх») («чья» «по» : String) («связ» : List String) : List String :=
  let nms := s.«именаДоводовФункции» «чья»
  «связ».flatMap fun sv =>
    [«ужатьТ» («т» s!"«{«чья»}» от {sv}")] ++
    (if sv = "хвост" then [«ужатьТ» («т» s!"«{«чья»}» от хвоста")] else []) ++
    (if nms.length < 2 || «по» = "" || !nms.contains «по» then [] else
      [«ужатьТ» («т» s!"«{«чья»}» от {" и ".intercalate (nms.map fun n => if n = «по» then sv else n)}")])

def «Исх».«дноПоля» (s : «Исх») («вариант» «поле» : String) : Bool :=
  let ls := s.«номера».filter (fun i => (s.«строка» i).startsWith s!"вариант «{«вариант»}» содержит ")
  match ls.getLast? with
  | none => false
  | some i =>
    let t := s.«типДоводаВСтроке» ("принимает " ++ «после» (s.«строка» i) " содержит ") «поле»
    ls.length = 1 && t ≠ "" && s.«видТипа» («имяТипа» t) == .«отрезок»

def «Исх».«сДномПоОбъявлению» (s : «Исх») («связ» : List String) («чья» : String) (a b : Nat) («вариант» «обр» : String) : List String :=
  let sv := «связанныеСлучая» «обр»
  let ds := (s.«именаДоводовФункции» «чья»).filter (fun d => !sv.contains d && s.«доводСДном» a b d)
  let fs := if («обр».splitOn "» с ").length > 1 then
      match «поляС» «обр» " как " with
      | some (nms, tms) => (nms.zip tms).filterMap (fun (n, t) => if s.«дноПоля» «вариант» n then some t else none)
      | none => []
    else []
  «связ» ++ ds ++ fs

partial def «Исх».«неНижеДна» (s : «Исх») («т0» : String) («дно» : Float) («чья» : String) («связ» : List String) : Bool :=
  let t := «ужатьТ» «т0»
  match «числоТочно» t with
  | some v => v ≥ «дно»
  | none =>
    if «связ».contains t then true else
    let r := «разрез» t "плюс"
    r.«есть» && ((s.«неНижеДна» r.«лево» «дно» «чья» «связ» && «неотр?» s r.«право» «чья» «связ») ||
                 (s.«неНижеДна» r.«право» «дно» «чья» «связ» && «неотр?» s r.«лево» «чья» «связ»))

structure «Порядок» where
  «исх» : «Исх»
  «чья» : String := ""
  «голова» : String := ""

partial def «свестиПорядком» (o : «Порядок») (t : String) («гл» : Nat) : String :=
  let s := «свести» t 8
  if s.startsWith "длина " then
    let pod := «ужатьТ» («обрезать» (s.«сн» 6))
    if pod = "\"\"" || pod = "пустой список" then "0"
    else
      let ms := «членыСписка» pod
      if !ms.isEmpty then toString ms.length
      else if o.«голова» ≠ "" && pod = o.«голова» then "1" else s
  else if «гл» = 0 then s
  else match «знакиТерма».findSome? (fun w => («одинУзел» s w).map (fun p => (w, p))) with
  | none => s
  | some (w, (a, b)) =>
    let l := «свестиПорядком» o a («гл» - 1)
    let p := «свестиПорядком» o b («гл» - 1)
    let sums := match («числоТочно» l).bind «целоеЧ?», («числоТочно» p).bind «целоеЧ?» with
      | some x, some y => some (x + y)
      | _, _ => none
    match w, sums with
    | " плюс ", some v => toString v
    | _, _ => «обрезать» (s!"{«вСкобки» l}{w}{«вСкобки» p}")

def «прибавкаСнизу» (t : String) : Bool :=
  let u := «ужатьТ» t
  match «числоТочно» u with | some v => v ≥ 0 | none => u.startsWith "длина "

def «прибавкаКонечна» (t : String) : Bool :=
  let u := «ужатьТ» t
  («числоТочно» u).isSome || u.startsWith "длина "

partial def «неБольшеПравилами» (o : «Порядок») («сл» «сп» : String) («ихл» «ихп» : List String) («гл» : Nat) : Bool :=
  let L := «свестиПорядком» o «сл» 6
  let P := «свестиПорядком» o «сп» 6
  if «гл» = 0 then false
  else if L = P then true
  else if (List.range (min «ихл».length «ихп».length)).any (fun i => L = «ихл».getD i "" && P = «ихп».getD i "") then true
  else
    let num := match «числоТочно» L with
      | some vl => match «числоТочно» P with
        | some vp => some (decide (vl ≤ vp))
        | none => if vl ≤ 0 && «неотр?» o.«исх» P o.«чья» [] then some true else none
      | none => none
    match num with
    | some v => v
    | none =>
    match «разрезЦепочкой» L with
    | some (_, a, b) => «неБольшеПравилами» o a P «ихл» «ихп» («гл» - 1) && «неБольшеПравилами» o b P «ихл» «ихп» («гл» - 1)
    | none =>
      let o5 := match «одинУзел» L " плюс ", «одинУзел» P " плюс " with
        | some (a1, a2), some (b1, b2) =>
          [(a1, b1, a2, b2), (a2, b2, a1, b1), (a1, b2, a2, b1), (a2, b1, a1, b2)].any fun (la, ra, lb, rb) =>
            let g := «свестиПорядком» o lb 6
            g = «свестиПорядком» o rb 6 && «прибавкаКонечна» g && «неБольшеПравилами» o la ra «ихл» «ихп» («гл» - 1)
        | _, _ => false
      if o5 then true else
      match «одинУзел» P " плюс " with
      | some (b1, b2) => (L = «свестиПорядком» o b1 6 && «прибавкаСнизу» b2) || (L = «свестиПорядком» o b2 6 && «прибавкаСнизу» b1)
      | none => false

def «Исх».«развернутьПлоское» (s : «Исх») (t «чья» : String) : String :=
  let n := «ёлочка» t 1
  if n = "" || n = «чья» || !t.startsWith s!"«{n}» от " then t else
  let tail := «обрезать» («после» t s!"«{n}» от ")
  let body := s.«плоскоеТело» n
  let ds := s.«именаДоводовФункции» n
  let fs := «сверху» tail "и"
  if body = "" || ds.isEmpty || ds.length ≠ fs.length then t
  else (ds.zip fs).foldl (fun acc (d, f) => «вместо» acc d («т» («обрезать» f))) body

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
  let some ci := s.«найтиСлучай» a b var | return t
  let mut body := s.«телоСлучая» ci b
  if body = "" then return t
  let hs := «словаС» (s.«строка» ci) 1
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
  if pk.size ≠ pv.size then return t
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
    if k = k0 then continue
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

def «свестиДопущением» (o : «Порядок») (t : String) («лево» «право» : List String) : String := Id.run do
  let mut r := «свестиПорядком» o (o.«исх».«развернутьВезде» t o.«чья») 6
  for (l, p) in «лево».zip «право» do
    if l ≠ "" && l ≠ p && «естьТ» r l then r := «свестиПорядком» o («вместо» r l p) 6
  return r

def «выборВнутри» (t : String) : Option (String × String × String) := Id.run do
  let cs := t.toList.toArray
  let pat := "( если ".toList
  let mut p := 0
  while p < cs.size do
    if «стоитНа» cs p pat then
      match «закрывающая» cs p with
      | none => return none
      | some q =>
        let inner := «обрезать» (String.ofList (cs.extract (p + 1) q).toList)
        if let some (_, a, b) := «разрезЦепочкой» inner then return some (inner, a, b)
    p := p + 1
  return none

partial def «равенствоПравилами» (o : «Порядок») («сл» «сп» : String) («ихл» «ихп» : List String) («гл» : Nat) : Bool :=
  let L := «свестиДопущением» o «сл» «ихл» «ихп»
  let P := «свестиДопущением» o «сп» «ихл» «ихп»
  if L = P then true
  else if «гл» = 0 then false
  else match «разрезЦепочкой» L with
  | some (_, a, b) => «равенствоПравилами» o a P «ихл» «ихп» («гл» - 1) && «равенствоПравилами» o b P «ихл» «ихп» («гл» - 1)
  | none => match «разрезЦепочкой» P with
    | some (_, a, b) => «равенствоПравилами» o L a «ихл» «ихп» («гл» - 1) && «равенствоПравилами» o L b «ихл» «ихп» («гл» - 1)
    | none => match «выборВнутри» L with
      | some (w, a, b) => «равенствоПравилами» o («вместо» L w a) P «ихл» «ихп» («гл» - 1) && «равенствоПравилами» o («вместо» L w b) P «ихл» «ихп» («гл» - 1)
      | none => match «выборВнутри» P with
        | some (w, a, b) => «равенствоПравилами» o L («вместо» P w a) «ихл» «ихп» («гл» - 1) && «равенствоПравилами» o L («вместо» P w b) «ихл» «ихп» («гл» - 1)
        | none => false

def «сРезультатом» («цель» «тело» : String) : String :=
  let ws := («т» «цель»).splitOn " "
  let u := «ужатьТ» «тело»
  let pf := if u.startsWith "запись «" || u.startsWith "вариант «" then «поляС» u " равным " else none
  let ws := match pf with
    | none => ws
    | some (nms, tms) => ws.map fun w =>
      if !w.startsWith "результат." then w else
      let f0 := w.«сн» 10
      let f := if «ёлочка» f0 1 ≠ "" then «ёлочка» f0 1 else f0
      match ((nms.zip tms).reverse).find? (·.1 = f) with
      | some (_, v) => «вСкобки» v
      | none => w
  «вместо» (" ".intercalate ws) "результат" «тело»

def «Исх».«связанноеРекурсивно» (s : «Исх») («тип» «хвост» «имя» : String) : Bool :=
  let sv := «связанныеСлучая» «хвост»
  if !«хвост».startsWith "вариант «" then sv.length = 2 && sv.getD 1 "" = «имя» else
  match «поляС» («заменить» «хвост» " как " " равным ") " равным " with
  | none => false
  | some (nms, tms) =>
    match (nms.zip tms).find? (·.2 = «имя») with
    | none => false
    | some (n, _) =>
      let decl := (s.«строкаВарианта» «тип» («ёлочка» «хвост» 1)).getD ""
      match ((«разрез» decl "содержит").«право».splitOn ",").find? (fun x => «обрезать» ((x.splitOn ":").headD "") = n) with
      | some x => «обрезать» ((x.splitOn ":").getD 1 "") = s!"«{«тип»}»"
      | none => false

def «допущенияРавенства» (o : «Порядок») (ihs : List String) : List String × List String :=
  ihs.foldl (fun (l, r) ih => match «разрезРавенства» ih with
    | some (a, b) => (l ++ [«свестиПорядком» o a 6], r ++ [«свестиПорядком» o b 6])
    | none => (l, r)) ([], [])

def «Исх».«тождествоСлучая» (s : «Исх») («чья» «цель» «тип» «по» «тело» «образец» «хвост» : String) («связ» : List String) : Except String Unit := do
  let o : «Порядок» := { «исх» := s, «чья» := «чья» }
  let mut g := «сРезультатом» «цель» (s.«развернутьПлоское» («т» «тело») «чья»)
  match «поляС» «образец» " равным " with
  | some (nms, tms) =>
    for (n, v) in nms.zip tms do
      g := «вместо» («вместо» g s!"{«по»}.{n}" v) s!"{«по»}.«{n}»" v
  | none => pure ()
  g := «вместо» g «по» «образец»
  let some (L, P) := «разрезРавенства» g | throw s!"цель ветви «{g}» — не равенство"
  let ihs := «связ».flatMap fun sv =>
    if !s.«связанноеРекурсивно» «тип» «хвост» sv then [] else
    (s.«допущенияИндукции» «чья» «по» [sv]).map fun call => «вместо» («сРезультатом» «цель» call) «по» sv
  let (l, r) := «допущенияРавенства» o ihs
  if «равенствоПравилами» o L P l r 4 then pure ()
  else throw s!"стороны «{«свестиДопущением» o L l r}» и «{«свестиДопущением» o P l r}» не сошлись знак в знак"

def «Исх».«порядокСлучая» (s : «Исх») («чья» «цель» «тип» «по» «тело» «образец» «хвост» : String) («связ» : List String) : Except String Unit := do
  let head := if «тип» = "строка" && «хвост».startsWith "голова" then
      match «сверху» «хвост» "и" with
      | [x0, _] => if «обрезать» x0 = "голова" then "голова" else «обрезать» («после» («обрезать» x0) "голова ")
      | _ => ""
    else ""
  let o : «Порядок» := { «исх» := s, «чья» := «чья», «голова» := head }
  let g := «вместо» («вместо» («т» «цель») "результат" (s.«развернутьПлоское» («т» «тело») «чья»)) «по» «образец»
  let some (L, P) := «разрезСл» g " не больше " | throw s!"цель ветви «{g}» — не «не больше»"
  let ihs := «связ».flatMap fun sv =>
    (s.«допущенияИндукции» «чья» «по» [sv]).map fun call => «вместо» («вместо» («т» «цель») "результат" call) «по» sv
  let (l, r) := ihs.foldl (fun (l, r) ih => match «разрезСл» ih " не больше " with
    | some (a, b) => (l ++ [«свестиПорядком» o a 6], r ++ [«свестиПорядком» o b 6])
    | none => (l, r)) ([], [])
  if «неБольшеПравилами» o L P l r 8 then pure ()
  else throw s!"«{«свестиПорядком» o L 6}» не больше «{«свестиПорядком» o P 6}» — правилами ядра не выводится"

def «Исх».«охранойСлучая» (s : «Исх») (c : «Счёт») («чья» «цель» «по» «тело» «образец» : String) : Except String Unit := do
  let g := «т» («вместо» («вместо» («т» «цель») "результат" («т» «тело»)) «по» «образец»)
  let some (u, vt, vi) := «разрезЦепочкой» g | throw s!"цель ветви «{g}» — не охрана «если У то Ц иначе да»"
  if «ужатьТ» vi ≠ "да" then throw s!"у охраны «{g}» ветвь «иначе» не литерал «да»"
  if «ужатьТ» vt = "да" then return ()
  let razv := «т» (s.«развернутьВариантом» («ужатьТ» u) «чья»)
  if («сверху» razv "и притом").any (fun x => «т» x = «т» vt) then return ()
  let vt' := s!" {«т» vt} "
  let uu := «т» u
  let pod := «обрезать» («заменить» («заменить» vt' s!" если ( {uu} ) то " " если да то ") s!" если {uu} то " " если да то ")
  if pod ≠ «обрезать» vt' && !«естьСвязыватель» pod && «закрыта» c pod then return ()
  throw s!"среди конъюнктов охраны «{razv}» нет обещанного «{«т» vt}»"

def «Исх».«тождествоСвёртки» (s : «Исх») («чья» «цель» «тип» «по» «начало» «накоп» «элем» «виток» : String) («шаг» : Bool) : Except String Unit := do
  let pr := "пройденное"
  let o : «Порядок» := { «исх» := s, «чья» := «чья» }
  if «тип» ≠ "список" then throw s!"носитель свёртки «{«тип»}» тождеству сверщику незнаком"
  if «естьТ» («т» «цель») pr || «естьТ» («т» «виток») pr || «естьТ» («т» «начало») pr then throw "имя пройденного куска занято исходником"
  let (g, l, r) :=
    if !«шаг» then («вместо» («вместо» («т» «цель») "результат" («т» «начало»)) «по» "пустой список", [], [])
    else
      let g := «вместо» («вместо» («т» «цель») "результат" («т» «виток»)) «по» s!"добавить {«элем»} к {pr}"
      let ih := «вместо» («вместо» («т» «цель») "результат" «накоп») «по» pr
      match «разрезРавенства» ih with
      | some (a, b) => (g, [«свестиПорядком» o a 6], [«свестиПорядком» o b 6])
      | none => (g, [], [])
  let some (L, P) := «разрезРавенства» g | throw s!"цель половины «{g}» — не равенство"
  if «равенствоПравилами» o L P l r 4 then pure ()
  else throw s!"стороны «{«свестиДопущением» o L l r}» и «{«свестиДопущением» o P l r}» не сошлись знак в знак"

structure «Домен» where
  «неотр» : Bool := false
  «тожд» : Bool := false
  «пор» : Bool := false
  «охр» : Bool := false
  «дно» : Float := 0

def «всеПосылкиПравилом» («посылки» : List String) (a : String) (b : Option String) : Bool :=
  «посылки».all fun l => let p := «правилоПосылки» l; p = "" || p = a || b == some p

def «доменЦели» («цель» : String) («посылки» : List String) : «Домен» :=
  if «цель» = "результат не меньше 0" then { «неотр» := true } else
  let floor := match «разрезСл» («т» «цель») " не меньше " with
    | some (l, p) => if «ужатьТ» l = "результат" then
        (match «числоТочно» («ужатьТ» p) with
         | some v => if v > 0 && v ≤ 9007199254740991.0 && «всеПосылкиПравилом» «посылки» "ограниченность точным потолком по построению" (some "порядок по построению") then some v else none
         | none => none) else none
    | none => none
  match floor with
  | some v => { «дно» := v }
  | none =>
  if («разрезРавенства» («т» «цель»)).isSome && «всеПосылкиПравилом» «посылки» "тождество после переписки допущением" (some "разбор цели по условию") then { «тожд» := true }
  else if («разрезСл» («т» «цель») " не больше ").isSome && «всеПосылкиПравилом» «посылки» "ограниченность точным потолком по построению" (some "порядок по построению") then { «пор» := true }
  else if (match «разрезЦепочкой» («т» «цель») with | some (_, _, i) => «ужатьТ» i = "да" | none => false) &&
          «всеПосылкиПравилом» «посылки» "разбор цели по условию" none then { «охр» := true }
  else {}

def «правилоВнеДомена» (d : «Домен») (p : String) : Bool :=
  let boolRules := ["вычисление замкнутой цели", "разбор случаев по внутреннему условию цели", "цель-выбор с истинной ветвью",
                 "равенство, решённое счётом замкнутых частей"]
  if p = "" then false
  else if d.«дно» > 0 then p ≠ "ограниченность точным потолком по построению" && p ≠ "порядок по построению"
  else if d.«неотр» then p ≠ "неотрицательность по построению" && p ≠ "цель есть допущение"
  else if d.«тожд» then p ≠ "тождество после переписки допущением" && p ≠ "разбор цели по условию"
  else if d.«пор» then p ≠ "ограниченность точным потолком по построению" && p ≠ "порядок по построению"
  else if d.«охр» then p ≠ "разбор цели по условию"
  else !boolRules.contains p && p ≠ "разбор цели по условию"

def «Исх».«вариантыТипа» (s : «Исх») («тип» : String) : List String :=
  match s.«видТипа» «тип» with
  | .«сумма» v => v
  | _ => []

def «Исх».«узелАлгебры» (s : «Исх») (c : «Счёт») («чья» «цель» «принцип» : String) («посылки» : List String) : «Узел» := Id.run do
  let tip := «ёлочка» «принцип» 1
  let po := «ёлочка» «принцип» 2
  let vs := s.«вариантыТипа» tip
  if vs.isEmpty || «посылки».length ≠ vs.length then return .«мимо»
  let d := «доменЦели» «цель» «посылки»
  if «посылки».any (fun l => «правилоВнеДомена» d («правилоПосылки» l)) then return .«мимо»
  let some (a, b) := s.«блокС» «чья» | return .«мимо»
  let mut n := 0
  for l in «посылки» do
    if «правилоПосылки» l = "" then continue
    n := n + 1
    let v := «вариантПосылки» l
    let some ci := s.«найтиСлучай» a b v | return .«не» s!"случай варианта «{v}» не найден в теле функции «{«чья»}»"
    let body := s.«телоСлучая» ci b
    if body = "" then return .«не» s!"тело случая «{v}» не читается одним термом"
    let hs := «словаС» (s.«строка» ci) 1
    if d.«неотр» || d.«дно» > 0 then
      let bnd := s.«допущенияИндукции» «чья» po («связанныеСлучая» hs)
      let bnd := if d.«неотр» then s.«сДномПоОбъявлению» bnd «чья» a b v hs else bnd
      let ok := if d.«дно» > 0 then s.«неНижеДна» body d.«дно» «чья» bnd else «неотр?» s body «чья» bnd
      if !ok then return .«не» s!"случай «{v}»: знак не держится по построению"
    else if d.«тожд» || d.«пор» || d.«охр» then
      let obr := «образецКакТерм» hs tip
      if obr = "" then return .«не» s!"образец случая «{v}» сверщику незнаком"
      let res := if d.«тожд» then s.«тождествоСлучая» «чья» «цель» tip po body obr hs («связанныеСлучая» hs)
        else if d.«пор» then s.«порядокСлучая» «чья» «цель» tip po body obr hs («связанныеСлучая» hs)
        else s.«охранойСлучая» c «чья» «цель» po body obr
      match res with
      | .error e => return .«не» s!"случай «{v}»: {e}"
      | .ok _ => pure ()
    else
      let mut g := «вместо» («т» «цель») "результат" body
      let obr := «образецКакТерм» (if hs.startsWith "«" then "вариант " ++ hs else hs) tip
      let clean := obr ≠ "" && po ≠ "" && !((«связанныеСлучая» hs).any («естьТ» («т» «цель») ·))
      if clean then g := «вместо» g po obr
      if «естьСвязыватель» g || !«закрыта» c g then return .«не» s!"случай «{v}»: булева цель «{g}» не замкнулась"
  if n = 0 then return .«мимо»
  return .«проигран» (!d.«неотр» && !d.«тожд» && !d.«пор» && !d.«охр» && !(d.«дно» > 0))

def «Исх».«узелСвёртки» (s : «Исх») («чья» «цель» «принцип» : String) («посылки» : List String) : «Узел» := Id.run do
  let po := «ёлочка» «принцип» 2
  if «посылки».length ≠ 2 || po = "" then return .«мимо»
  let nonneg := «цель» = "результат не меньше 0"
  let tozh := !nonneg && («разрезРавенства» («т» «цель»)).isSome
  for l in «посылки» do
    let p := «правилоПосылки» l
    if p ≠ "" && (if nonneg then p ≠ "неотрицательность по построению" else if tozh then p ≠ "тождество после переписки допущением" else true) then
      return .«мимо»
  if !nonneg && !tozh then return .«мимо»
  let some (a, b) := s.«блокС» «чья» | return .«мимо»
  let body := s.«телоТекстом» a b
  if !body.startsWith "свёртка " then return .«мимо»
  let some (head, vit) := «разрезСл» body " → " | return .«не» "заголовок свёртки не читается четырьмя кусками"
  let some (chto, ost) := «разрезСл» («обрезать» (head.«сн» 8)) " начиная с " | return .«не» "заголовок свёртки не читается четырьмя кусками"
  let some (nach, svz) := «разрезСл» ost " как " | return .«не» "заголовок свёртки не читается четырьмя кусками"
  let some (acc, el) := «разрезСл» svz " и " | return .«не» "заголовок свёртки не читается четырьмя кусками"
  if «обрезать» chto ≠ po then return .«не» s!"свёртка идёт по «{«обрезать» chto}», а принцип — по «{po}»"
  if acc = "" || el = "" || acc = el then return .«не» "имена витка свёртки не различаются"
  let mut n := 0
  for l in «посылки» do
    if «правилоПосылки» l = "" then continue
    n := n + 1
    let step := (l.splitOn " вид step ").length > 1
    if nonneg then
      match «неотрицательно» s («т» (if step then vit else nach)) «чья» (if step then [acc] else []) 0 with
      | .error e => return .«не» s!"{if step then "виток" else "начало"} свёртки: {e}"
      | .ok _ => pure ()
    else match s.«тождествоСвёртки» «чья» «цель» («ёлочка» «принцип» 1) po nach acc el vit step with
      | .error e => return .«не» s!"{if step then "виток" else "начало"} свёртки: {e}"
      | .ok _ => pure ()
  if n = 0 then return .«мимо»
  return .«проигран» false

def «Исх».«узелВысказывания» (s : «Исх») (c : «Счёт») («имя» «цель» «принцип» : String) («посылки» : List String) : «Узел» := Id.run do
  let tip := «ёлочка» «принцип» 1
  let po := «ёлочка» «принцип» 2
  let o : «Порядок» := { «исх» := s }
  let base := s.«основа» tip
  let vs := if base = "список" || base = "строка" then [] else s.«вариантыТипа» tip
  if vs.isEmpty || «посылки».length ≠ vs.length || («разрезРавенства» («т» «цель»)).isNone then return .«мимо»
  if «посылки».any (fun l => let p := «правилоПосылки» l; p ≠ "" && p ≠ "тождество после переписки допущением") then return .«мимо»
  let mut n := 0
  let mut bad : List String := []
  for l in «посылки» do
    let v := «вариантПосылки» l
    if «правилоПосылки» l = "" then continue
    let some decl := s.«строкаВарианта» tip v | return .«не» s!"варианта «{v}» у типа «{tip}» в исходнике нет"
    n := n + 1
    let mut fields : Array String := #[]
    let mut lv : List String := []
    let mut rv : List String := []
    let mut own := 0
    if (decl.splitOn "содержит ").length > 1 then
      for part in («разрез» decl "содержит").«право».splitOn "," do
        let f := «обрезать» ((part.splitOn ":").headD "")
        let tf := «обрезать» ((part.splitOn ":").getD 1 "")
        if f = "" || «естьТ» («заменить» s!" {«т» «цель»} " s!" {f} равным " " ~ ") f then
          return .«не» s!"случай «{v}»: имя поля «{f}» занято целью утверждения"
        fields := fields.push s!"{f} равным {f}"
        if tf = s!"«{tip}»" then
          own := own + 1
          if let some (x, y) := «разрезРавенства» («вместо» («т» «цель») po f) then
            lv := lv ++ [«свестиПорядком» o x 6]
            rv := rv ++ [«свестиПорядком» o y 6]
    let ctor := if fields.isEmpty then s!"вариант «{v}»" else s!"вариант «{v}» с {" и ".intercalate fields.toList}"
    let g := «вместо» («т» «цель») po ctor
    if (own > 0) != («слово» («после» l "вид ") 1 = "step") then
      bad := bad ++ [s!"утверждение «{«имя»}», посылка «{v}»: у варианта {if own > 0 then "есть" else "нет"} поля типа «{tip}», а записана как «вид {«слово» («после» l "вид ") 1}»"]
    let some (L, P) := «разрезРавенства» g | return (if bad.isEmpty then .«не» s!"случай «{v}»: цель «{g}» — не равенство" else .«ложь» bad)
    if «равенствоПравилами» o L P lv rv 4 then continue
    let L2 := «свестиДопущением» o L lv rv
    let P2 := «свестиДопущением» o P lv rv
    if «стороныРазошлись» c L2 P2 then
      return .«ложь» (bad ++ [s!"утверждение «{«имя»}», случай «{v}»: обе стороны равенства замкнуты и посчитаны, и это РАЗНЫЕ значения — «{L2}» против «{P2}»"])
    return (if bad.isEmpty then .«не» s!"случай «{v}»: стороны «{L2}» и «{P2}» не сошлись знак в знак" else .«ложь» bad)
  if !bad.isEmpty then return .«ложь» bad
  if n = 0 then return .«мимо»
  return .«проигран» false

def «ветвьДна» («условие» «по» : String) : String :=
  if «слово» «условие» 1 ≠ «по» then "" else
  let tail := «словаС» «условие» 1
  let rels := [("не больше ", "то"), ("не меньше ", "иначе"), ("больше ", "иначе"), ("меньше ", "то"), ("равно ", "то")]
  match rels.find? (fun (r, _) => tail.startsWith r && («числоТочно» (tail.«сн» r.length)).isSome) with
  | some (_, w) => w
  | none => ""

def «цельДержится» («цель» «значение» : String) : Option Bool :=
  if !«цель».startsWith "результат " then none else
  match «числоТочно» «значение» with
  | none => none
  | some v =>
    let tail := «цель».«сн» 10
    let rels := ["не меньше ", "не больше ", "больше ", "меньше ", "равен "]
    match rels.find? (tail.startsWith ·) with
    | none => none
    | some r => match «числоТочно» (tail.«сн» r.length) with
      | none => none
      | some e => some (match r with
        | "не меньше " => v ≥ e
        | "не больше " => v ≤ e
        | "больше " => v > e
        | "меньше " => v < e
        | _ => v == e)

def «поСтрогоПоложителен» («условие» «по» : String) : Bool :=
  if «слово» «условие» 1 ≠ «по» then false else
  let tail := «словаС» «условие» 1
  if tail.startsWith "не больше " then (match «числоТочно» (tail.«сн» 10) with | some v => v ≥ 0 | none => false)
  else if tail.startsWith "меньше " then (match «числоТочно» (tail.«сн» 7) with | some v => v > 0 | none => false)
  else false

def «Исх».«узелОтрезка» (s : «Исх») («имя» «чья» «цель» «принцип» : String) («посылки» : List String) : «Узел» := Id.run do
  let po := «ёлочка» «принцип» 2
  let nos := «слово» («после» «принцип» "носитель ") 1
  let shag := «номерПосле» «принцип» "шаг "
  if nos ≠ "segment" || «посылки».length ≠ 2 || shag < 1 || «цель» ≠ "результат не меньше 0" then return .«мимо»
  if «посылки».any (fun l => let p := «правилоПосылки» l; p ≠ "" && p ≠ "неотрицательность по построению") then return .«мимо»
  let some (a, b) := s.«блокС» «чья» | return .«мимо»
  let ls := (List.range' a (b - a)).map (s.«строка» ·)
  let ifs := ls.filter (·.startsWith "если ")
  let ths := ls.filter (·.startsWith "то ")
  let els := ls.filter (·.startsWith "иначе ")
  if ifs.length ≠ 1 || ths.length ≠ 1 || els.length ≠ 1 then return .«не» "тело функции — не одно «если» с одной парой ветвей"
  let usl := «после» (ifs.headD "") "если "
  let vto := «после» (ths.headD "") "то "
  let vin := «после» (els.headD "") "иначе "
  let dno := «ветвьДна» usl po
  if dno = "" then return .«не» s!"форма условия «{usl}» сверщику незнакома"
  let tdno := «т» (if dno = "то" then vto else vin)
  let tsp := «т» (if dno = "то" then vin else vto)
  match «цельДержится» «цель» tdno with
  | some true => pure ()
  | some false => return .«ложь» [s!"утверждение «{«имя»}»: дно даёт «{tdno}», и цель «{«цель»}» на нём НЕ держится"]
  | none => return .«не» s!"дно «{tdno}» — не замкнутое число"
  let call := «т» s!"«{«чья»}» от ( {po} минус {shag} )"
  let nat := s.«доводСДном» a b po
  let nn := fun (t : String) => match «числоТочно» t with | some v => v ≥ 0 | none => nat && t = po
  let sm := «разрез» tsp "плюс"
  if sm.«есть» && «ужатьТ» sm.«право» = call && nn («ужатьТ» sm.«лево») then return .«проигран» false
  if sm.«есть» && «ужатьТ» sm.«лево» = call && nn («ужатьТ» sm.«право») then return .«проигран» false
  let pr := «разрез» tsp "умножить на"
  if pr.«есть» && nat && «поСтрогоПоложителен» usl po then
    if «ужатьТ» pr.«право» = call && «ужатьТ» pr.«лево» = po then return .«проигран» false
    if «ужатьТ» pr.«лево» = call && «ужатьТ» pr.«право» = po then return .«проигран» false
  return .«не» s!"спуск «{tsp}» — ни сумма неотрицательного по построению, ни произведение строго положительного довода индукции — с вызовом «{call}»"

def «дноНулём» («условие» «п» : String) : Bool :=
  let tail := «словаС» «условие» 1
  let rels : List (String × Float) := [("не больше ", 0), ("меньше ", 1), ("больше ", 0), ("не меньше ", 1)]
  «слово» «условие» 1 = «п» &&
    match rels.find? (fun (r, _) => tail.startsWith r && («числоТочно» (tail.«сн» r.length)).isSome) with
    | some (r, k) => «числоТочно» (tail.«сн» r.length) == some k
    | none => false

def «Исх».«ветвьФормой» (s : «Исх») (f «по» : String) («шаг» : Bool) : Option String := do
  let [p] := (s.«доводы» f).«голые» | none
  let (a, b) ← s.«блокС» f
  let ls := (List.range' a (b - a)).map (s.«строка» ·)
  let ifs := ls.filter (·.startsWith "если ")
  let ths := ls.filter (·.startsWith "то ")
  let els := ls.filter (·.startsWith "иначе ")
  guard (ifs.length = 1 && ths.length = 1 && els.length = 1)
  let usl := «после» (ifs.headD "") "если "
  guard («дноНулём» usl p)
  let w := if («ветвьДна» usl p = "то") != «шаг» then «после» (ths.headD "") "то " else «после» (els.headD "") "иначе "
  some («вместо» («т» w) p «по»)

def «Исх».«развернутьФормой» (s : «Исх») («цель» «по» : String) («шаг» : Bool) : String :=
  s.«функции».foldl (fun t f =>
    let v := s!"«{f}» от {«по»}"
    if !«естьТ» t v then t else
    match s.«ветвьФормой» f «по» «шаг» with
    | some w => «вместо» t v w
    | none => t) («т» «цель»)

def «левоеНеотрицательности» (t : String) : String :=
  let r := «разрез» t "не меньше"
  if r.«есть» && «ужатьТ» r.«право» = "0" then «ужатьТ» r.«лево» else ""

def «неотрицательноФормой» (t ih «по» : String) («шаг» : Bool) : Bool :=
  let nn := fun (x : String) => match «числоТочно» x with | some v => v ≥ 0 | none => x = «по»
  let sm := «разрез» t "плюс"
  nn t || («шаг» && t = ih) ||
    («шаг» && sm.«есть» && ((«ужатьТ» sm.«право» = ih && nn («ужатьТ» sm.«лево»)) || («ужатьТ» sm.«лево» = ih && nn («ужатьТ» sm.«право»))))

def «шагПосылки» (l : String) : Bool := «слово» («после» l "вид ") 1 = "step"

def «Исх».«узелФормой» (s : «Исх») (c : «Счёт») («имя» «цель» «принцип» : String) («посылки» : List String) : «Узел» := Id.run do
  let po := «ёлочка» «принцип» 2
  let ih := «вместо» («т» «цель») po s!"( {po} минус 1 )"
  let nn := «левоеНеотрицательности» («т» «цель») ≠ ""
  let eq0 := «разрезРавенства» («т» «цель»)
  if «посылки».length ≠ 2 || (!nn && eq0.isNone) then return .«мимо»
  let «своё» := if nn then "неотрицательность по построению" else "тождество после переписки допущением"
  if «посылки».any (fun l => let p := «правилоПосылки» l; p ≠ "" && p ≠ «своё» && p ≠ "цель есть допущение") then return .«мимо»
  let «живые» := «посылки».filter («правилоПосылки» · ≠ "")
  if «живые».isEmpty then return .«мимо»
  if nn then
    let ihl := «левоеНеотрицательности» ih
    for l in «живые» do
      let t := s.«развернутьФормой» «цель» po («шагПосылки» l)
      if !«неотрицательноФормой» («левоеНеотрицательности» t) ihl po («шагПосылки» l) then
        return .«не» s!"посылка «{«ёлочка» l 1}»: «{t}» не неотрицательна по построению"
    return .«проигран» false
  let o : «Порядок» := { «исх» := s }
  let (lv, rv) := match «разрезРавенства» ih with
    | some (a, b) => ([«свестиПорядком» o a 6], [«свестиПорядком» o b 6])
    | none => ([], [])
  for l in «живые» do
    let step := «шагПосылки» l
    let (il, ip) := if step then (lv, rv) else ([], [])
    let (L, P) := («разрезРавенства» (s.«развернутьФормой» «цель» po step)).getD (eq0.getD ("", ""))
    if «равенствоПравилами» o L P il ip 4 then continue
    let L2 := «свестиДопущением» o L il ip
    let P2 := «свестиДопущением» o P il ip
    if «стороныРазошлись» c L2 P2 then
      return .«ложь» [s!"утверждение «{«имя»}», посылка «{«ёлочка» l 1}»: стороны «{L2}» и «{P2}» замкнуты и РАЗНЫЕ"]
    return .«не» s!"посылка «{«ёлочка» l 1}»: стороны «{L2}» и «{P2}» не сошлись знак в знак"
  return .«проигран» false

structure «Место» where
  «свои» : List String
  «имя» : String
  «чья» : String
  «цель» : String
  «высказывание» : Option String := none
  «доказанные» : List String := []
  «объявленные» : List String := []

def «проигратьУзел» (c : «Счёт») (m : «Место») : «Узел» := Id.run do
  let s := c.«исх»
  let mut pr := (m.«свои».find? (·.startsWith "принцип тип ")).getD ""
  if pr = "" then return .«мимо»
  let pos := m.«свои».filter (·.startsWith "посылка ")
  if «слово» («после» pr "носитель ") 1 = "segment-form" then
    return if m.«высказывание».isSome then s.«узелФормой» c m.«имя» m.«цель» pr pos else .«мимо»
  let mut g := m.«цель»
  if let some mv := m.«высказывание» then
    if m.«чья» ≠ "" then
      let po := «ёлочка» pr 2
      let d := s.«доводы» m.«чья»
      let t := «т» g
      let c2 := «т» («заменить» («заменить» t s!"( «{m.«чья»}» от ( {po} ) )" "результат") s!"( «{m.«чья»}» от {po} )" "результат")
      let tsv := s.«типВысказывания» (s.«высказывание» mv) po
      if d.«голые».length = 1 && c2 ≠ t && !«естьТ» t "результат" && !«естьТ» c2 po && tsv ≠ "" && «обрезать» (d.«типы».headD "") = tsv then
        g := c2
        pr := «заменить» pr s!"по «{po}»" s!"по «{d.«голые».headD ""}»"
  let nos := «слово» («после» pr "носитель ") 1
  if m.«высказывание».isSome && nos = "algebra" && !«естьТ» («т» g) "результат" then
    return s.«узелВысказывания» c m.«имя» g pr pos
  if nos = "algebra" then return s.«узелАлгебры» c m.«чья» g pr pos
  if nos = "fold" then return s.«узелСвёртки» m.«чья» g pr pos
  return s.«узелОтрезка» m.«имя» m.«чья» g pr pos

structure «ИтогКрюков» where
  «снял» : String := ""
  «беды» : List String := []
  «причины» : List String := []

def «крюкиПоТелу» (c : «Счёт») (m : «Место») : «ИтогКрюков» := Id.run do
  let s := c.«исх»
  let mut r : «ИтогКрюков» := {}
  match «проигратьУзел» c m with
  | .«проигран» _ => return { r with «снял» := "узел" }
  | .«ложь» bs => r := { r with «беды» := bs }
  | .«не» p => r := { r with «причины» := [s!"утверждение «{m.«имя»}»: узел вердикта не проигран — {p}"] }
  | .«мимо» => pure ()
  match «сторожПереписки» c m.«свои» m.«чья» m.«цель» with
  | some (a, b) => r := { r with «беды» := r.«беды» ++ [s!"утверждение «{m.«имя»}»: обе стороны равенства замкнуты и посчитаны, и это РАЗНЫЕ значения — «{a}» против «{b}»"] }
  | none => pure ()
  if «разборомЦели» c m.«свои» m.«чья» m.«цель» then return { r with «снял» := "разбор" }
  if m.«свои».any (·.startsWith "посылка ") then return r
  if s.«свёрткаНеДлиннее» m.«чья» m.«цель» then return { r with «снял» := "свёртка" }
  if s.«началоОтВызванной» m.«доказанные» m.«чья» m.«цель» then return { r with «снял» := "начало_от_вызванной" }
  if s.«цельОтВызванной» m.«доказанные» m.«чья» m.«цель» then return { r with «снял» := "цель_от_вызванной" }
  if s.«цельПостусловием» m.«высказывание» m.«имя» m.«чья» m.«цель» m.«доказанные» m.«объявленные» then return { r with «снял» := "цель_постусловием" }
  if s.«началоПоТелу» m.«чья» m.«цель» then return { r with «снял» := "начало_по_телу" }
  if «ужатьТ» («т» m.«цель») = "результат не меньше 0" && s.«прямаяПоПредположению» m.«чья» then return { r with «снял» := "прямая" }
  if s.«неотрицательноУтверждение» m.«высказывание» m.«цель» then return { r with «снял» := "неотр_утв" }
  return r

end «Второй»
