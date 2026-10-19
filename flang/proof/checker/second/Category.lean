import Source

open «Разбор»

namespace «Второй»
namespace «Категории»

def «сеп» : String := "\x01"
def «сеп2» : String := "\x02"

def «слова» (s : String) : List String := Id.run do
  let mut r : List String := []
  let mut cur : String := ""
  let mut inq := false
  for c in s.toList do
    if inq then
      cur := cur.push c
      if c = '»' then
        inq := false
        r := r ++ [cur]
        cur := ""
    else if c = '«' then
      if cur ≠ "" then r := r ++ [cur]
      cur := "«"
      inq := true
    else if c = ' ' || c = '\t' || c = '\r' then
      if cur ≠ "" then r := r ++ [cur]
      cur := ""
    else if c = '(' || c = ')' then
      if cur ≠ "" then r := r ++ [cur]
      r := r ++ [String.singleton c]
      cur := ""
    else cur := cur.push c
  if cur ≠ "" then r := r ++ [cur]
  return r

def «срез» (v : List String) (a b : Nat) : List String := (v.drop a).take (b - a)

def «место» (v : List String) (w : String) : Option Nat := Id.run do
  let mut g : Int := 0
  let mut i := 0
  for x in v do
    if x = "(" then g := g + 1
    else if x = ")" then g := g - 1
    else if g = 0 && x = w then return some i
    i := i + 1
  return none

def «объект» (f : List String) (o : String) : String :=
  if f.isEmpty then o else «сеп».intercalate (f ++ [o])

def «функторыОбъекта» (o : String) : List String := (o.splitOn «сеп»).dropLast

def «основа» (o : String) : String := ((o.splitOn «сеп»).getLast?).getD ""

def «под» (f : List String) (o : String) : String := «объект» (f ++ «функторыОбъекта» o) («основа» o)

structure «Функтор» where
  «ф» : List String
  «из» : String
  «в» : String
  deriving BEq, Inhabited

def «Функтор».«строкой» (f : «Функтор») : String :=
  «сеп».intercalate f.«ф» ++ «сеп2» ++ f.«из» ++ «сеп2» ++ f.«в»

def «функторИз» (s : String) : «Функтор» :=
  let v := s.splitOn «сеп2»
  let a := v.getD 0 ""
  ⟨if a = "" then [] else a.splitOn «сеп», v.getD 1 "", v.getD 2 ""⟩

inductive «Т» where
  | «стрелка» (n : String)
  | «единица» (o : String)
  | «композиция» (a b : «Т»)
  | «образ» (f : String) («ф» : List String) (a : «Т»)
  | «компонента» (n : String) (o : String)
  deriving Inhabited

structure «Конт» where
  «кат» : List String := []
  «об» : List (String × String) := []
  «ст» : List (String × String × String) := []
  «фн» : List (String × String × String) := []
  «пр» : List (String × String × String) := []
  «г» : List (String × «Т» × «Т») := []

def «Конт».«вид» (k : «Конт») (n : String) : Nat :=
  if k.«кат».contains n then 1
  else if k.«об».any (·.1 = n) then 2
  else if k.«ст».any (·.1 = n) then 3
  else if k.«фн».any (·.1 = n) then 4
  else if k.«пр».any (·.1 = n) then 5
  else 0

def «Конт».«через» (k : «Конт») (c : String) (f : List String) : String :=
  f.reverse.foldl (fun c n =>
    match k.«фн».find? (·.1 = n) with
    | some (_, a, b) => if c ≠ "" && a = c then b else ""
    | none => "") c

def «Конт».«категория» (k : «Конт») (o : String) : String :=
  match k.«об».find? (·.1 = «основа» o) with
  | some (_, c) => k.«через» c («функторыОбъекта» o)
  | none => ""

def «Конт».«годен» (k : «Конт») (f : «Функтор») : Bool :=
  let c := k.«через» f.«из» f.«ф»
  c ≠ "" && c = f.«в» && k.«кат».contains f.«из»

structure «Р» where
  «w» : List String
  «i» : Nat := 0
  «беда» : Option String := none

def «Р».«тут» (r : «Р») (k : Nat) : String := r.«w».getD (r.«i» + k) ""
def «Р».«ошибка» (r : «Р») (s : String) : «Р» := if r.«беда».isSome then r else { r with «беда» := some s }

def «звеноФунктора» (k : «Конт») (fuel : Nat) (r : «Р») : «Функтор» × «Р» :=
  match fuel with
  | 0 => (default, r.«ошибка» "функтор слишком глубок")
  | fuel + 1 =>
    if r.«тут» 0 = "(" then
      let (f, r) := «функтор» k fuel { r with «i» := r.«i» + 1 }
      if r.«тут» 0 = ")" then (f, { r with «i» := r.«i» + 1 }) else (f, r.«ошибка» "ожидалась закрывающая скобка у функтора")
    else if r.«тут» 0 = "единица" && k.«вид» (r.«тут» 1) = 1 then
      (⟨[], r.«тут» 1, r.«тут» 1⟩, { r with «i» := r.«i» + 2 })
    else match k.«фн».find? (·.1 = r.«тут» 0) with
      | some (n, a, b) => (⟨[n], a, b⟩, { r with «i» := r.«i» + 1 })
      | none => (default, r.«ошибка» s!"ожидался функтор, а стоит «{r.«тут» 0}»")
termination_by fuel
decreasing_by all_goals simp_wf <;> omega
where
  «функтор» (k : «Конт») (fuel : Nat) (r : «Р») : «Функтор» × «Р» :=
    match fuel with
    | 0 => (default, r.«ошибка» "функтор слишком глубок")
    | fuel + 1 =>
      let (f, r) := «звеноФунктора» k fuel r
      if r.«беда».isNone && r.«тут» 0 = "после" then
        let (g, r) := «функтор» k fuel { r with «i» := r.«i» + 1 }
        (⟨f.«ф» ++ g.«ф», g.«из», f.«в»⟩, r)
      else (f, r)
  termination_by fuel
  decreasing_by all_goals simp_wf <;> omega

def «функтор» (k : «Конт») (fuel : Nat) (r : «Р») : «Функтор» × «Р» := «звеноФунктора».«функтор» k fuel r

def «началоФунктора» (k : «Конт») (r : «Р») : Bool :=
  k.«вид» (r.«тут» 0) = 4 || (r.«тут» 0 = "единица" && k.«вид» (r.«тут» 1) = 1)

def «функторВСкобке» (k : «Конт») (fuel : Nat) (r : «Р») : Option («Функтор» × «Р») :=
  let (f, p) := «звеноФунктора» k fuel { r with «беда» := none }
  if p.«беда».isNone && p.«тут» 0 = "от" then some (f, p) else none

def «разобратьОбъект» (k : «Конт») : Nat → «Р» → String × «Р»
  | 0, r => ("", r.«ошибка» "объект слишком глубок")
  | fuel + 1, r =>
    if r.«тут» 0 = "(" then
      match «функторВСкобке» k fuel r with
      | some (f, p) =>
        let (o, p) := «разобратьОбъект» k fuel { p with «i» := p.«i» + 1 }
        («под» f.«ф» o, p)
      | none =>
        let (o, p) := «разобратьОбъект» k fuel { r with «i» := r.«i» + 1 }
        if p.«тут» 0 = ")" then (o, { p with «i» := p.«i» + 1 }) else (o, p.«ошибка» "ожидалась закрывающая скобка у объекта")
    else if «началоФунктора» k r then
      let (f, p) := «звеноФунктора» k fuel r
      if p.«тут» 0 ≠ "от" then ("", p.«ошибка» "ожидалось «от» после функтора")
      else
        let (o, p) := «разобратьОбъект» k fuel { p with «i» := p.«i» + 1 }
        («под» f.«ф» o, p)
    else if k.«вид» (r.«тут» 0) = 2 then (r.«тут» 0, { r with «i» := r.«i» + 1 })
    else ("", r.«ошибка» s!"ожидался объект, а стоит «{r.«тут» 0}»")

mutual
def «звено» (k : «Конт») : Nat → «Р» → «Т» × «Р»
  | 0, r => («Т».«стрелка» "", r.«ошибка» "терм слишком глубок")
  | fuel + 1, r =>
    if r.«беда».isSome then («Т».«стрелка» "", r)
    else if r.«тут» 0 = "(" then
      match «функторВСкобке» k fuel r with
      | some (f, p) => «образ» k fuel f p
      | none =>
        let (t, p) := «терм» k fuel { r with «i» := r.«i» + 1 }
        if p.«тут» 0 = ")" then (t, { p with «i» := p.«i» + 1 }) else (t, p.«ошибка» "ожидалась закрывающая скобка у терма")
    else if «началоФунктора» k r then
      let (f, p) := «звеноФунктора» k fuel r
      «образ» k fuel f p
    else if r.«тут» 0 = "единица" then
      let (o, p) := «разобратьОбъект» k fuel { r with «i» := r.«i» + 1 }
      («Т».«единица» o, p)
    else if k.«вид» (r.«тут» 0) = 5 && r.«тут» 1 = "на" then
      let (o, p) := «разобратьОбъект» k fuel { r with «i» := r.«i» + 2 }
      («Т».«компонента» (r.«тут» 0) o, p)
    else if k.«вид» (r.«тут» 0) = 3 then («Т».«стрелка» (r.«тут» 0), { r with «i» := r.«i» + 1 })
    else («Т».«стрелка» "", r.«ошибка» s!"ожидалась стрелка, а стоит «{r.«тут» 0}»")
def «образ» (k : «Конт») : Nat → «Функтор» → «Р» → «Т» × «Р»
  | 0, _, r => («Т».«стрелка» "", r.«ошибка» "терм слишком глубок")
  | fuel + 1, f, r =>
    if r.«тут» 0 ≠ "от" then («Т».«стрелка» "", r.«ошибка» "ожидалось «от» после функтора")
    else
      let (a, p) := «звено» k fuel { r with «i» := r.«i» + 1 }
      («Т».«образ» f.«строкой» f.«ф» a, p)
def «терм» (k : «Конт») : Nat → «Р» → «Т» × «Р»
  | 0, r => («Т».«стрелка» "", r.«ошибка» "терм слишком глубок")
  | fuel + 1, r =>
    let (t, p) := «звено» k fuel r
    if p.«беда».isNone && p.«тут» 0 = "после" then
      let (b, q) := «терм» k fuel { p with «i» := p.«i» + 1 }
      («Т».«композиция» t b, q)
    else (t, p)
end

def «термЦеликом» (k : «Конт») (w : List String) : «Т» × Option String :=
  let (t, r) := «терм» k (4 * w.length + 16) { «w» := w }
  match r.«беда» with
  | some b => (t, some b)
  | none => if r.«i» = w.length then (t, none) else (t, some "лишнее после терма")

def «концы» (k : «Конт») : «Т» → Option (String × String)
  | «Т».«стрелка» n => (k.«ст».find? (·.1 = n)).map (fun (_, a, b) => (a, b))
  | «Т».«единица» o => if k.«категория» o = "" then none else some (o, o)
  | «Т».«композиция» a b => do
    let (a1, a2) ← «концы» k a
    let (b1, b2) ← «концы» k b
    if a1 = b2 then some (b1, a2) else none
  | «Т».«образ» fs _ a => do
    let f := «функторИз» fs
    let (a1, a2) ← «концы» k a
    if k.«годен» f && k.«категория» a1 = f.«из» then some («под» f.«ф» a1, «под» f.«ф» a2) else none
  | «Т».«компонента» n o => do
    let (_, fs, gs) ← k.«пр».find? (·.1 = n)
    let f := «функторИз» fs
    let g := «функторИз» gs
    if k.«категория» o = f.«из» then some («под» f.«ф» o, «под» g.«ф» o) else none

def «строкой» : «Т» → String
  | «Т».«стрелка» n => s!"s[{n}]"
  | «Т».«единица» o => s!"e[{o}]"
  | «Т».«композиция» a b => s!"c[{«строкой» a}|{«строкой» b}]"
  | «Т».«образ» fs _ a => s!"m[{fs}|{«строкой» a}]"
  | «Т».«компонента» n o => s!"t[{n}|{o}]"

def «объектЕдиниц» : «Т» → String
  | «Т».«единица» o => o
  | «Т».«композиция» a b => let o := «объектЕдиниц» a; if o ≠ "" then o else «объектЕдиниц» b
  | _ => ""

def «множители» («уровень» : Nat) : «Т» → List String
  | «Т».«стрелка» n => [s!"s[{n}]"]
  | «Т».«единица» o => if «уровень» < 2 then [s!"e[{o}]"] else []
  | «Т».«композиция» a b => «множители» «уровень» a ++ «множители» «уровень» b
  | «Т».«образ» fs _ a =>
    let v := «множители» «уровень» a
    [s!"m[{fs}|{";".intercalate v}|{if v.isEmpty then «объектЕдиниц» a else ""}]"]
  | «Т».«компонента» n o => [s!"t[{n}|{o}]"]

def «атом» («ф» : List String) (n : String) («к» : Bool) (o : String) : String :=
  «сеп».intercalate «ф» ++ «сеп2» ++ n ++ «сеп2» ++ (if «к» then o else "-")

def «фАтома» (a : String) : List String := let x := (a.splitOn «сеп2»).getD 0 ""; if x = "" then [] else x.splitOn «сеп»
def «оснАтома» (a : String) : String := (a.splitOn «сеп2»).getD 1 ""
def «обАтома» (a : String) : String := (a.splitOn «сеп2»).getD 2 ""
def «компонента?» (a : String) : Bool := «обАтома» a ≠ "-"
def «сПриставкой» («п» : List String) (a : String) : String := «атом» («п» ++ «фАтома» a) («оснАтома» a) («компонента?» a) («обАтома» a)

def «атомы» : «Т» → List String
  | «Т».«стрелка» n => [«атом» [] n false ""]
  | «Т».«единица» _ => []
  | «Т».«композиция» a b => «атомы» a ++ «атомы» b
  | «Т».«образ» _ «ф» a => («атомы» a).map («сПриставкой» «ф»)
  | «Т».«компонента» n o => [«атом» [] n true o]

def «концыАтома» (k : «Конт») (a : String) : Option (String × String) :=
  let «п» := «фАтома» a
  if «компонента?» a then do
    let (_, fs, gs) ← k.«пр».find? (·.1 = «оснАтома» a)
    some («под» («п» ++ («функторИз» fs).«ф») («обАтома» a), «под» («п» ++ («функторИз» gs).«ф») («обАтома» a))
  else do
    let (_, x, y) ← k.«ст».find? (·.1 = «оснАтома» a)
    some («под» «п» x, «под» «п» y)

def «снять» («п» : List String) (a : String) : String := «атом» ((«фАтома» a).drop «п».length) («оснАтома» a) («компонента?» a) («обАтома» a)

def «подстановка» (k : «Конт») (x y : List String) («начало» : String) («из» «в» : List String) (o : String) (m : Nat) («п» : List String) : Bool :=
  let «вставка» := «в».map («сПриставкой» «п»)
  if m = 0 || m - 1 > x.length then false
  else
    let i := m - 1
    if !«из».isEmpty then
      «срез» x i (i + «из».length) = «из».map («сПриставкой» «п») &&
        «срез» x 0 i ++ «вставка» ++ «срез» x (i + «из».length) x.length = y
    else
      let «стык» := if i < x.length then (match «концыАтома» k (x.getD i "") with | some (_, b) => b | none => "\x03") else «начало»
      !«в».isEmpty && «стык» = «под» «п» o && «срез» x 0 i ++ «вставка» ++ «срез» x i x.length = y

def «естественность» (k : «Конт») (x y : List String) (t : String) (m «длина» : Nat) («п» : List String) («вперёд» : Bool) : Bool :=
  match k.«пр».find? (·.1 = t) with
  | none => false
  | some (_, fs, gs) =>
    let F := «функторИз» fs
    let G := «функторИз» gs
    if m = 0 || «длина» = 0 then false
    else
      let i := m - 1
      if «вперёд» then
        let «тт» := x.getD (i + «длина») ""
        let «под» := «п» ++ G.«ф»
        let «путь» := «срез» x i (i + «длина»)
        let u := «путь».map («снять» «под»)
        if «тт» = "" || !«компонента?» «тт» || «оснАтома» «тт» ≠ t || «фАтома» «тт» ≠ «п» || «путь».length ≠ «длина»
          || !«путь».all (fun a => («фАтома» a).take «под».length = «под») then false
        else match «концыАтома» k (u.getD 0 "") with
          | none => false
          | some (_, b) =>
            «срез» x 0 i ++ ([«атом» «п» t true b] ++ u.map («сПриставкой» («п» ++ F.«ф»))) ++ «срез» x (i + «длина» + 1) x.length = y
      else
        let «тт» := x.getD i ""
        let «под» := «п» ++ F.«ф»
        let «путь» := «срез» x (i + 1) (i + 1 + «длина»)
        let u := «путь».map («снять» «под»)
        if «тт» = "" || !«компонента?» «тт» || «оснАтома» «тт» ≠ t || «фАтома» «тт» ≠ «п» || «путь».length ≠ «длина»
          || !«путь».all (fun a => («фАтома» a).take «под».length = «под») then false
        else match «концыАтома» k (u.getLast?.getD "") with
          | none => false
          | some (a, _) =>
            «срез» x 0 i ++ (u.map («сПриставкой» («п» ++ G.«ф»)) ++ [«атом» «п» t true a]) ++ «срез» x (i + 1 + «длина») x.length = y

def «занятые» : List String := ["единица", "после", "от", "на", "из", "в", "равно", "по", "(", ")"]

def «имена» (k : «Конт») (v : List String) : Option String :=
  if v.isEmpty then some "объявление без имён"
  else v.findSome? (fun n =>
    if n.any (fun c => c = '[' || c = ']' || c = '|' || c = ';' || c = '\x01' || c = '\x02') then
      some s!"имя «{n}» несёт знак, которым сверщик разделяет части термов"
    else if k.«вид» n ≠ 0 || «занятые».contains n then some s!"имя «{n}» занято или повторено" else none)

def «контекст» (k : «Конт») (w : List String) : «Конт» × Option String :=
  let «кв» := w.getD 1 ""
  let «сущ» := w.getD 2 ""
  if !(«кв» = "всякой" || «кв» = "всякого" || «кв» = "всяких") then (k, some "строка контекста не разобрана")
  else if «сущ» = "категории" || «сущ» = "категорий" then
    let v := w.drop 3
    match «имена» k v with
    | some b => (k, some b)
    | none => ({ k with «кат» := k.«кат» ++ v }, none)
  else
    let «с» := if «сущ» = "естественного" || «сущ» = "естественных" then 4 else 3
    match «место» w "из" with
    | none => (k, some "строка контекста не разобрана")
    | some «из» =>
      if «из» < «с» then (k, some "строка контекста не разобрана") else
      let v := «срез» w «с» «из»
      let «после» := w.drop («из» + 1)
      match «имена» k v with
      | some b => (k, some b)
      | none =>
        if «сущ» = "объекта" || «сущ» = "объектов" then
          if «после».length = 1 && k.«кат».contains («после».getD 0 "") then
            ({ k with «об» := k.«об» ++ v.map (fun n => (n, «после».getD 0 "")) }, none)
          else (k, some "объекты объявляются словами «из» и именем категории")
        else if «сущ» = "функтора" || «сущ» = "функторов" then
          if «после».length = 3 && «после».getD 1 "" = "в" && k.«кат».contains («после».getD 0 "") && k.«кат».contains («после».getD 2 "") then
            ({ k with «фн» := k.«фн» ++ v.map (fun n => (n, «после».getD 0 "", «после».getD 2 "")) }, none)
          else (k, some "функтор объявляется словами «из C в D»")
        else match «место» «после» "в" with
          | none => (k, some "не найдено слово «в»")
          | some «в» =>
            if «в» = 0 then (k, some "не найдено слово «в»") else
            let w1 := «срез» «после» 0 «в»
            let w2 := «после».drop («в» + 1)
            if «сущ» = "стрелки" || «сущ» = "стрелок" then
              let (o1, r1) := «разобратьОбъект» k (4 * w1.length + 16) { «w» := w1 }
              let (o2, r2) := «разобратьОбъект» k (4 * w2.length + 16) { «w» := w2 }
              if r1.«беда».isSome || r2.«беда».isSome || r1.«i» ≠ w1.length || r2.«i» ≠ w2.length
                || k.«категория» o1 = "" || k.«категория» o1 ≠ k.«категория» o2 then (k, some "концы стрелки не годны")
              else ({ k with «ст» := k.«ст» ++ v.map (fun n => (n, o1, o2)) }, none)
            else if «с» = 4 then
              let (f, r1) := «функтор» k (4 * w1.length + 16) { «w» := w1 }
              let (g, r2) := «функтор» k (4 * w2.length + 16) { «w» := w2 }
              if r1.«беда».isSome || r2.«беда».isSome || r1.«i» ≠ w1.length || r2.«i» ≠ w2.length
                || !k.«годен» f || !k.«годен» g || f.«из» ≠ g.«из» || f.«в» ≠ g.«в» then (k, some "функторы преобразования не годны")
              else ({ k with «пр» := k.«пр» ++ v.map (fun n => (n, f.«строкой», g.«строкой»)) }, none)
            else (k, some "строка контекста не разобрана")

def «равенство» (k : «Конт») (w : List String) : Option («Т» × «Т» × String × String) := do
  let «р» ← «место» w "равно"
  if «р» = 0 then none
  let («л», «б1») := «термЦеликом» k («срез» w 0 «р»)
  let («п», «б2») := «термЦеликом» k (w.drop («р» + 1))
  if «б1».isSome || «б2».isSome then none
  let (a1, a2) ← «концы» k «л»
  let (p1, p2) ← «концы» k «п»
  if a1 = p1 && a2 = p2 then some («л», «п», a1, a2) else none

def «теоремаОКатегориях?» (s : «Исх») (n : Nat) : Bool :=
  match (List.range' (n + 1) (s.«число» - n)).find? (fun k => s.«строка» k ≠ "") with
  | none => false
  | some k => let t := s.«строка» k; t.startsWith "для всякой " || t.startsWith "для всякого " || t.startsWith "для всяких "

def «строкиТеоремы» (s : «Исх») («начало» : Nat) : List (Nat × String) := Id.run do
  let mut r : List (Nat × String) := []
  let mut n := «начало» + 1
  for _ in [0:s.«число»] do
    if n > s.«число» then break
    let «сырая» := s.«сырая» n
    if «сырая».«обр» = "" then
      n := n + 1
      continue
    if !«сырая».startsWith " " then break
    let (k, t) := s.«доЗакрытия» n (s.«строка» n)
    r := r ++ [(n, t)]
    n := k + 1
  return r

def «номерПосле» (s : String) («м» : String) : Nat :=
  match s.splitOn «м» with
  | _ :: b :: _ => ((b.«обр».splitOn " ").getD 0 "").toNat?.getD 0
  | _ => 0

def «вЁлочке» (s : String) : String :=
  match s.splitOn "«" with
  | _ :: b :: _ => (b.splitOn "»").getD 0 ""
  | _ => ""

def «вУголке» (s : String) : String :=
  match s.splitOn "⟨" with
  | _ :: b :: _ => (b.splitOn "⟩").getD 0 ""
  | _ => ""

structure «Итог» where
  «беды» : List String := []
  «доказано» : Bool := false

def «шагГоден» (k : «Конт») (x y : «Т») («начало» : String) («закон» : String) («обосн» : List String) : Bool :=
  if «закон» = "ассоциативность" || «закон» = "единица" || «закон».startsWith "функториальность" || «закон» = "законы категории" then
    let «уровень» := if «закон» = "ассоциативность" then 1 else if «закон» = "единица" then 2 else 3
    let «ждём» := if «уровень» = 1 then "ассоциативности" else if «уровень» = 2 then "единице"
      else if «закон» = "законы категории" then "законам категории" else "функториальности"
    let «имяФ» := if «закон».startsWith "функториальность " then («закон».«сн» "функториальность ".length).«обр» else ""
    let «сошлись» := " ".intercalate «обосн» = (if «имяФ» ≠ "" then «ждём» ++ " " ++ «имяФ» else «ждём») && («имяФ» = "" || k.«вид» «имяФ» = 4)
    «сошлись» && (if «уровень» = 3 then «атомы» x = «атомы» y else «множители» «уровень» x = «множители» «уровень» y)
  else if «закон».startsWith "гипотеза " then
    let «г» := ((«закон».«сн» "гипотеза ".length).splitOn " место ").getD 0 ""
    let m := «номерПосле» «закон» " место "
    let «п» := «слова» («вУголке» «закон»)
    let «вперёд» := («закон».splitOn "⟩ вперёд").length > 1
    let «назад» := («закон».splitOn "⟩ назад").length > 1
    match k.«г».find? (·.1 = «г») with
    | none => false
    | some (_, «л», «пр») =>
      («вперёд» || «назад») && «обосн» = [«г»] &&
      match «концы» k «л» with
      | none => false
      | some (o, _) =>
        let la := «атомы» «л»
        let pa := «атомы» «пр»
        «подстановка» k («атомы» x) («атомы» y) «начало» (if «вперёд» then la else pa) (if «вперёд» then pa else la) o m «п»
  else if «закон».startsWith "естественность " then
    let t := ((«закон».«сн» "естественность ".length).splitOn " место ").getD 0 ""
    let m := «номерПосле» «закон» " место "
    let «длина» := «номерПосле» «закон» " длина "
    let «п» := «слова» («вУголке» «закон»)
    let «вперёд» := («закон».splitOn "⟩ вперёд").length > 1
    let «назад» := («закон».splitOn "⟩ назад").length > 1
    («вперёд» || «назад») && «обосн» = ["естественности", t] && «естественность» k («атомы» x) («атомы» y) t m «длина» «п» «вперёд»
  else false

def «судить» (s : «Исх») («блок» : String) : «Итог» := Id.run do
  let «зап» := («блок».splitOn "\n").map String.«обр»
  let «заг» := «зап».getD 0 ""
  let «имя» := «вЁлочке» «заг»
  let «верд» := (((«зап».find? (·.startsWith "вердикт ")).getD "").«сн» 8).«обр»
  let «начало» := «номерПосле» «заг» " строка "
  let «шаги» := «зап».filter (·.startsWith "шаг ")
  let mut r : «Итог» := {}
  if !(«заг».startsWith "категорная теорема «" && s.«строка» «начало» = s!"теорема «{«имя»}»" && «теоремаОКатегориях?» s «начало») then
    r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: строка {«начало»} исходника — не заголовок теоремы о категориях"] }
  if !(«зап».contains "конец категорной теоремы") then
    r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}» записана не целиком"] }
  if «номерПосле» ((«зап».find? (·.startsWith "шагов ")).getD "") "шагов " ≠ «шаги».length then
    r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: шапка обещает не столько шагов, сколько записано"] }
  if «верд» ≠ "доказано" || !r.«беды».isEmpty then return r
  let mut k : «Конт» := {}
  let mut «цель» : Option («Т» × «Т» × String × String) := none
  let mut x : Option «Т» := none
  let mut «цепь» : List (Nat × String) := []
  let mut «конец» := false
  for («н», t) in «строкиТеоремы» s «начало» do
    let w := «слова» t
    let «первое» := w.getD 0 ""
    if «первое» = "для" then
      let (k2, «б») := «контекст» k w
      k := k2
      if let some b := «б» then r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: {b}"] }
    else if «первое» = "дано" then
      let «гн» := w.getD 1 ""
      match «равенство» k (w.drop 2) with
      | some («л», «п», _, _) =>
        if k.«г».any (·.1 = «гн») || k.«вид» «гн» ≠ 0 then r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: имя гипотезы занято"] }
        else k := { k with «г» := k.«г» ++ [(«гн», «л», «п»)] }
      | none => r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: гипотеза не годна"] }
    else if «первое» = "утверждаем" then
      «цель» := «равенство» k (w.drop 1)
      if «цель».isNone then r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: цель не годна"] }
    else if «первое» = "равно" then «цепь» := «цепь» ++ [(«н», t)]
    else if «первое» = "следовательно" then «конец» := w = ["следовательно", "доказано"]
    else
      match «цель», x with
      | some («цл», _, _, _), none =>
        let (t0, «б») := «термЦеликом» k w
        if «б».isSome || «строкой» t0 ≠ «строкой» «цл» then
          r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: цепочка начинается не левой частью цели"] }
        x := some t0
      | _, _ => r := { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: строка не на своём месте"] }
  match «цель», x with
  | some (_, «цп», «ц1», «ц2»), some x0 =>
    if !«конец» then return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: нет «следовательно доказано»"] }
    if «цепь».length ≠ «шаги».length then
      return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: в исходнике шагов {«цепь».length}, а в записи {«шаги».length}"] }
    if !r.«беды».isEmpty then return r
    let mut cur := x0
    let mut i := 0
    for («н», t) in «цепь» do
      let «шаг» := «шаги».getD i ""
      i := i + 1
      let «закон» := ((«шаг».splitOn s!" строка {«н»} ").getD 1 "").«обр»
      if «номерПосле» «шаг» "шаг " ≠ i || «номерПосле» «шаг» " строка " ≠ «н» then
        return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: шаг {i} записан не на своей строке"] }
      let w := «слова» t
      match «место» w "по" with
      | none => return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: нет слова «по»"] }
      | some «по» =>
        let (y, «б») := «термЦеликом» k («срез» w 1 «по»)
        let «ок» := «б».isNone && «по» ≥ 2 && (match «концы» k y with | some (a, b) => a = «ц1» && b = «ц2» | none => false)
        if !«ок» then return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: терм шага не годен"] }
        if !«шагГоден» k cur y «ц1» «закон» (w.drop («по» + 1)) then
          return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}», строка {«н»}: шаг «{«закон»}» не переигран"] }
        cur := y
    if «строкой» cur ≠ «строкой» «цп» then
      return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: цепочка кончается не правой частью цели"] }
    return { r with «доказано» := true }
  | _, _ => return { r with «беды» := r.«беды» ++ [s!"категорная теорема «{«имя»}»: нет цели или начала цепочки"] }

def «полнота» (s : «Исх») («блоки» : List String) : List String :=
  s.«номера».filterMap (fun n =>
    let t := s.«строка» n
    if (s.«сырая» n).startsWith "теорема «" && «теоремаОКатегориях?» s n then
      let «имя» := «вЁлочке» t
      let k := («блоки».filter (fun b => «вЁлочке» ((b.splitOn "\n").getD 0 "") = «имя»)).length
      if k = 1 then none else some s!"теорема о категориях «{«имя»}»: блоков в записи {k}, а должен быть один"
    else none)

end «Категории»
end «Второй»
