import Evaluator

open «Разбор»

namespace «Второй»

/-!
Порядок по фактам: замыкание сравнений, переигранное вторым сверщиком так же, как
`порядок_по_фактам` сверщика на C.

Ядро доказывает `а не больше д` из `а не больше б`, `б не больше ц`, `ц не больше д`
правилом «порядок по построению» (О1, О10), несовместную пару `а меньше б`, `б меньше а`
— правилом «несовместимые допущения» (Пр1), и записи ходов у таких мест нет. Сверщик
переигрывает их сам: факты — рёбра графа порядка, цель — путь нужной строгости.

Устройство доверия. Поиск пути (`путьИз`) — не доверенная часть: он может быть каким
угодно. Найденный путь проверяет `путьВерен`, и теорема `путь-верен` говорит: на любом
носителе с законами `МодельПорядка`, где все рёбра верны, путь даёт верное сравнение
концов; теорема `круг-несовместен` — что строгий круг при верных рёбрах невозможен, то есть
факты несовместны. Законы `МодельПорядка` держатся и на двоичных числах языка вместе с
«не числом»: у не-числа любое сравнение ложно, и посылки закона тогда ложны. Полноты
(`меньше` или `не меньше`) там нет — её спрашивает только `ребро-из-ложного`, у двух
заведомых чисел.

Узел — имя одним словом или целый литерал из одних цифр; терм факта иного вида молча
пропускается, в цели — отказ. `равен` ребра не даёт: равенство языка — Object.is, и
«не число» равно себе.
-/

/-- Ребро порядка: откуда, куда, строго ли (`меньше`) или нет (`не больше`). -/
abbrev «Ребро» := Nat × Nat × Bool

/-- Законы порядка, на которых стоит замыкание. -/
structure «МодельПорядка» (α : Type) where
  «нб» : α → α → Prop
  «мн» : α → α → Prop
  «нб-нб» : ∀ {a b c : α}, «нб» a b → «нб» b c → «нб» a c
  «мн-нб» : ∀ {a b c : α}, «мн» a b → «нб» b c → «мн» a c
  «нб-мн» : ∀ {a b c : α}, «нб» a b → «мн» b c → «мн» a c
  «мн→нб» : ∀ {a b : α}, «мн» a b → «нб» a b
  «мн-нет-себе» : ∀ a : α, ¬ «мн» a a

def «Верно» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) : «Ребро» → Prop
  | (a, b, true) => M.«мн» (v a) (v b)
  | (a, b, false) => M.«нб» (v a) (v b)

/-- Путь проверяется ЗДЕСЬ: рёбра подряд, каждое из списка, концы сходятся. Ответ —
    строгость пути (было ли в нём строгое ребро), либо `none`. -/
def «путьВерен» («рёбра» : List «Ребро») : List «Ребро» → Nat → Nat → Option Bool
  | [], _, _ => none
  | [(x, y, s)], a, b => if x = a && y = b && «рёбра».contains (x, y, s) then some s else none
  | (x, y, s) :: r, a, b =>
    if x = a && «рёбра».contains (x, y, s) then (fun t => s || t) <$> «путьВерен» «рёбра» r y b else none

theorem «верно-нб» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) (a b : Nat) :
    ∀ s, «Верно» M v (a, b, s) → M.«нб» (v a) (v b)
  | true, h => M.«мн→нб» h
  | false, h => h

theorem «верно-слить» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) (a y b : Nat) :
    ∀ s t, «Верно» M v (a, y, s) → «Верно» M v (y, b, t) → «Верно» M v (a, b, s || t)
  | true, true, h1, h2 => M.«мн-нб» h1 (M.«мн→нб» h2)
  | true, false, h1, h2 => M.«мн-нб» h1 h2
  | false, true, h1, h2 => M.«нб-мн» h1 h2
  | false, false, h1, h2 => M.«нб-нб» h1 h2

/-- Путь, принятый `путьВерен`, даёт верное сравнение концов той строгости, что он назвал. -/
theorem «путь-верен» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) («рёбра» : List «Ребро»)
    (hr : ∀ e ∈ «рёбра», «Верно» M v e) :
    ∀ (p : List «Ребро») (a b : Nat) (s : Bool), «путьВерен» «рёбра» p a b = some s → «Верно» M v (a, b, s)
  | [], _, _, _, h => by simp [«путьВерен»] at h
  | [(x, y, t)], a, b, s, h => by
    simp only [«путьВерен»] at h
    split at h
    · rename_i hc
      simp only [Bool.and_eq_true, decide_eq_true_eq, List.contains_iff_mem] at hc
      obtain ⟨⟨rfl, rfl⟩, hm⟩ := hc
      cases h
      exact hr _ hm
    · cases h
  | (x, y, t) :: e2 :: r, a, b, s, h => by
    simp only [«путьВерен»] at h
    split at h
    · rename_i hc
      simp only [Bool.and_eq_true, decide_eq_true_eq, List.contains_iff_mem] at hc
      obtain ⟨rfl, hm⟩ := hc
      cases hq : «путьВерен» «рёбра» (e2 :: r) y b with
      | none => rw [hq] at h; cases h
      | some u =>
        rw [hq] at h
        cases h
        exact «верно-слить» M v x y b t u (hr _ hm) («путь-верен» M v «рёбра» hr (e2 :: r) y b u hq)
    · cases h

/-- Строгий круг при верных рёбрах невозможен: факты, давшие его, несовместны. -/
theorem «круг-несовместен» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) («рёбра» : List «Ребро»)
    (hr : ∀ e ∈ «рёбра», «Верно» M v e) (p : List «Ребро») (a : Nat)
    (h : «путьВерен» «рёбра» p a a = some true) : False :=
  M.«мн-нет-себе» (v a) («путь-верен» M v «рёбра» hr p a a true h)

/-- Нестрогая цель берётся и строгим путём. -/
theorem «нб-из-пути» {α : Type} (M : «МодельПорядка» α) (v : Nat → α) («рёбра» : List «Ребро»)
    (hr : ∀ e ∈ «рёбра», «Верно» M v e) (p : List «Ребро») (a b : Nat) (s : Bool)
    (h : «путьВерен» «рёбра» p a b = some s) : M.«нб» (v a) (v b) :=
  «верно-нб» M v a b s («путь-верен» M v «рёбра» hr p a b s h)

/-- Ложное сравнение двух заведомых чисел — ребро обратного порядка. Полнота нужна
    только здесь, и только у чисел: у «не числа» её нет. -/
theorem «ребро-из-ложного» {α : Type} (M : «МодельПорядка» α) («число» : α → Prop)
    («полнота» : ∀ {a b : α}, «число» a → «число» b → ¬ M.«мн» a b → M.«нб» b a)
    {a b : α} (ha : «число» a) (hb : «число» b) (h : ¬ M.«мн» a b) : M.«нб» b a :=
  «полнота» ha hb h

/-- Отбор не удлиняет (О8, «Отбор под длиной»). -/
theorem «отбор-не-удлиняет» {β : Type} (p : β → Bool) (xs : List β) : (xs.filter p).length ≤ xs.length :=
  List.length_filter_le p xs

/-- Пример носителя: целые числа с их порядком — законы выполнимы. -/
def «порядокЦелых» : «МодельПорядка» Int where
  «нб» := (· ≤ ·)
  «мн» := (· < ·)
  «нб-нб» := Int.le_trans
  «мн-нб» := Int.lt_of_lt_of_le
  «нб-мн» := Int.lt_of_le_of_lt
  «мн→нб» := Int.le_of_lt
  «мн-нет-себе» := Int.lt_irrefl

/-! Поиск пути: состояния (узел, строгость), обход в ширину; путь хранится к каждому
состоянию. Полон: состояние достижимо, если есть проход с той строгостью. -/

def «путьИз» («рёбра» : List «Ребро») (n a : Nat) : List ((Nat × Bool) × List «Ребро») := Id.run do
  let mut «есть» : List ((Nat × Bool) × List «Ребро») := []
  let mut «фронт» : List ((Nat × Bool) × List «Ребро») := []
  for e in «рёбра» do
    if e.1 = a && !(«есть».any (·.1 == (e.2.1, e.2.2))) then
      «есть» := «есть» ++ [((e.2.1, e.2.2), [e])]
      «фронт» := «фронт» ++ [((e.2.1, e.2.2), [e])]
  for _ in [0:2 * n + 2] do
    let mut «новый» : List ((Nat × Bool) × List «Ребро») := []
    for ((y, s), p) in «фронт» do
      for e in «рёбра» do
        if e.1 = y then
          let st := (e.2.1, s || e.2.2)
          if !(«есть».any (·.1 == st)) then
            «есть» := «есть» ++ [(st, p ++ [e])]
            «новый» := «новый» ++ [(st, p ++ [e])]
    «фронт» := «новый»
  return «есть»

/-- Найден ли путь a → b строгости не меньше `строго`, принятый `путьВерен`. -/
def «естьПуть» («рёбра» : List «Ребро») (n a b : Nat) («строго» : Bool) : Bool :=
  («путьИз» «рёбра» n a).any fun ((y, s), p) =>
    y = b && (!«строго» || s) && (match «путьВерен» «рёбра» p a b with
      | some t => !«строго» || t
      | none => false)

def «пфЛитерал?» (t : String) : Option Nat :=
  if t.length = 0 || t.length > 15 || !t.all Char.isDigit then none else t.toNat?

def «пфНатуральное» (t : String) : Bool :=
  ["неотрицательное", "нат", "натуральное", "nat", "naturo", "自然数"].contains («обрезать» t)

def «пфГодныйУзел» (t : String) : Bool :=
  («пфЛитерал?» t).isSome ||
  (t ≠ "" && !((t.splitOn " ").length > 1) && !((t.splitOn "(").length > 1) && !((t.splitOn "\"").length > 1) &&
   !((t.splitOn "[").length > 1) && t ≠ "да" && t ≠ "нет" && t ≠ "результат")

def «пфЧисло» («имена» : List (String × String)) (t : String) : Bool :=
  («пфЛитерал?» t).isSome || (match «имена».find? (·.1 = t) with
    | some (_, ty) => «пфНатуральное» ty
    | none => false)

/-- Сравнение: 0 «не меньше», 1 «не больше», 3 «меньше», 4 «больше» (2 «равен» — отказ). -/
def «пфСравнение» (t : String) : Option (String × Nat × String) :=
  let ops := [" не меньше ", " не больше ", " равен ", " меньше ", " больше "]
  match «найтиСв» t ops with
  | none => none
  | some (g, k) => some («безВнешних» («доЗнака» t g), k, «безВнешних» («отЗнака» t (g + (ops.getD k "").length)))

def «пфАтом» (f : String) : Option (String × Nat × String) :=
  match «пфСравнение» f with
  | some (l, k, p) =>
    let l := «т» l
    let p := «т» p
    if k = 2 || !«пфГодныйУзел» l || !«пфГодныйУзел» p then none else some (l, k, p)
  | none => none

structure «Граф» where
  «узлы» : Array String := #[]
  «рёбра» : List «Ребро» := []

def «Граф».«узел» (g : «Граф») (t : String) : Option Nat × «Граф» :=
  match g.«узлы».toList.idxOf? t with
  | some i => (some i, g)
  | none => if g.«узлы».size ≥ 24 then (none, g) else (some g.«узлы».size, { g with «узлы» := g.«узлы».push t })

def «Граф».«ребро» (g : «Граф») (l p : String) (s : Bool) : «Граф» :=
  match g.«узел» l with
  | (some a, g1) => match g1.«узел» p with
    | (some b, g2) => if g2.«рёбра».contains (a, b, s) then g2 else { g2 with «рёбра» := g2.«рёбра» ++ [(a, b, s)] }
    | (none, g2) => g2
  | (none, g1) => g1

partial def «пфФакт» («имена» : List (String × String)) (g : «Граф») (f : String) («истинен» : Bool) («гл» : Nat) : «Граф» :=
  let t := «безВнешних» f
  if «гл» > 12 then g else
  match (if «истинен» then «найтиСв» t [" и притом "] else none) with
  | some (w, _) =>
    let g1 := «пфФакт» «имена» g («доЗнака» t w) true («гл» + 1)
    «пфФакт» «имена» g1 («отЗнака» t (w + " и притом ".length)) true («гл» + 1)
  | none =>
    if t.startsWith "не " && «однаПараТ» («обрезать» («отЗнака» t 3)) then «пфФакт» «имена» g («отЗнака» t 3) (!«истинен») («гл» + 1) else
    match «пфАтом» t with
    | none => g
    | some (l, k, p) =>
      if !«истинен» && !(«пфЧисло» «имена» l && «пфЧисло» «имена» p) then g else
      let k := if «истинен» then k else (if k = 0 then 3 else if k = 1 then 4 else if k = 3 then 0 else 1)
      if k = 0 then g.«ребро» p l false
      else if k = 1 then g.«ребро» l p false
      else if k = 3 then g.«ребро» l p true
      else g.«ребро» p l true

partial def «пфУзлыЦели» (g : «Граф») (c : String) («гл» : Nat) : Bool × «Граф» :=
  let t := «безВнешних» c
  if «гл» > 12 then (false, g) else
  match «найтиСв» t [" и притом "] with
  | some (w, _) =>
    let (o1, g1) := «пфУзлыЦели» g («доЗнака» t w) («гл» + 1)
    let (o2, g2) := «пфУзлыЦели» g1 («отЗнака» t (w + " и притом ".length)) («гл» + 1)
    (o1 && o2, g2)
  | none => match «пфАтом» t with
    | none => (false, g)
    | some (l, _, p) =>
      match g.«узел» l with
      | (some _, g1) => match g1.«узел» p with
        | (some _, g2) => (true, g2)
        | (none, g2) => (false, g2)
      | (none, g1) => (false, g1)

/-- Рёбра между литералами по их значению — как у сверщика на C, после фактов. -/
def «Граф».«литералы» (g : «Граф») : «Граф» := Id.run do
  let mut r := g
  let n := g.«узлы».size
  for i in [0:n] do
    for j in [0:n] do
      if i ≠ j then
        match «пфЛитерал?» (g.«узлы».getD i ""), «пфЛитерал?» (g.«узлы».getD j "") with
        | some a, some b =>
          if a ≤ b && !r.«рёбра».contains (i, j, decide (a < b)) then r := { r with «рёбра» := r.«рёбра» ++ [(i, j, decide (a < b))] }
        | _, _ => pure ()
  return r

/-- Закон отбора: `( длина ( отфильтровать Л где … ) ) не больше ( длина Л )` и зеркально. -/
def «пфПодДлиной» (t : String) : Option String :=
  let u := «безВнешних» t
  if u.startsWith "длина " then some («безВнешних» («отЗнака» u 6)) else none

def «пфЗаконОтбора» (c : String) : Bool :=
  match «пфСравнение» c with
  | some (l, k, p) =>
    if k ≠ 0 && k ≠ 1 then false else
    let (l, p) := if k = 0 then (p, l) else (l, p)
    match «пфПодДлиной» l, «пфПодДлиной» p with
    | some o, some sp =>
      if !o.startsWith "отфильтровать " then false else
      let h := «отЗнака» o "отфильтровать ".length
      match «найтиСв» h [" где "] with
      | some (w, _) => «т» («безВнешних» («доЗнака» h w)) = «т» sp
      | none => false
    | _, _ => false
  | none => false

partial def «пфЦель» («имена» : List (String × String)) (g : «Граф») (c : String) («гл» : Nat) : Bool :=
  let t := «безВнешних» c
  if «гл» > 12 then false
  else if t = "да" then true
  else match «найтиСв» t [" и притом "] with
  | some (w, _) => «пфЦель» «имена» g («доЗнака» t w) («гл» + 1) && «пфЦель» «имена» g («отЗнака» t (w + " и притом ".length)) («гл» + 1)
  | none =>
    if «пфЗаконОтбора» t then true else
    match «пфАтом» t with
    | none => false
    | some (l, k, p) =>
      let (l, p) := if k = 0 || k = 4 then (p, l) else (l, p)
      if (k = 0 || k = 1) && l = p && «пфЧисло» «имена» l then true else
      match g.«узлы».toList.idxOf? l, g.«узлы».toList.idxOf? p with
      | some a, some b =>
        let n := g.«узлы».size
        «естьПуть» g.«рёбра» n a b (k = 3 || k = 4)
      | _, _ => false

/-- Цель из фактов с их истинностью. -/
def «порядокПоФактам» («имена» : List (String × String)) («факты» : List (String × Bool)) («цель» : String) : Bool :=
  let (ok, g0) := «пфУзлыЦели» {} «цель» 0
  let g0 := if ok then g0 else {}
  let g1 := «факты».foldl (fun g (f, b) => «пфФакт» «имена» g f b 0) g0
  let g := g1.«литералы»
  let n := g.«узлы».size
  (List.range n).any (fun a => «естьПуть» g.«рёбра» n a a true) || «пфЦель» «имена» g «цель» 0

/-- `( если У то А иначе Б )` внутри терма: целиком, условие и ветви. -/
def «пфВыборВнутри» (t : String) : Option (String × String × String × String) := Id.run do
  let cs := t.toList.toArray
  let pat := "( если ".toList
  let mut p := 0
  while p < cs.size do
    if «стоитНа» cs p pat then
      let mut gl : Int := 0
      let mut q := p
      let mut «конец» : Option Nat := none
      while q < cs.size do
        if cs[q]! = '(' then gl := gl + 1
        else if cs[q]! = ')' then
          gl := gl - 1
          if gl = 0 then
            «конец» := some q
            break
        q := q + 1
      match «конец» with
      | none => return none
      | some e =>
        let inner := «обрезать» (String.ofList (cs.extract (p + 1) e).toList)
        if let some (u, a, b) := «разрезЦепочкой» inner then return some (inner, u, a, b)
    p := p + 1
  return none

partial def «пфВыбрать» (c : String) («усл» : List (String × Bool)) («гл» : Nat) : Except String String :=
  let t := «безВнешних» c
  if «гл» > 16 then .error "" else
  match «разрезЦепочкой» t with
  | some (u, a, b) =>
    let ut := «т» («безВнешних» u)
    if ut = "да" then «пфВыбрать» a «усл» («гл» + 1)
    else if ut = "нет" then «пфВыбрать» b «усл» («гл» + 1)
    else match «усл».find? (·.1 = ut) with
      | some (_, v) => «пфВыбрать» (if v then a else b) «усл» («гл» + 1)
      | none => .error ut
  | none => match «пфВыборВнутри» t with
    | some (inner, u, a, b) =>
      let ut := «т» («безВнешних» u)
      let br := if ut = "да" then some a else if ut = "нет" then some b else
        («усл».find? (·.1 = ut)).map (fun (_, v) => if v then a else b)
      match br with
      | some w => «пфВыбрать» («вместо» t inner w) «усл» («гл» + 1)
      | none => .error ut
    | none => .ok («т» t)

partial def «порядокРазбором» («имена» : List (String × String)) («цель» : String) («факты» : List String)
    («усл» : List (String × Bool)) («гл» : Nat) : Bool :=
  match «пфВыбрать» «цель» «усл» 0 with
  | .error u =>
    if u = "" || «гл» ≥ 4 then false
    else «порядокРазбором» «имена» «цель» «факты» («усл» ++ [(u, true)]) («гл» + 1) &&
         «порядокРазбором» «имена» «цель» «факты» («усл» ++ [(u, false)]) («гл» + 1)
  | .ok t => «порядокПоФактам» «имена» («факты».map (·, true) ++ «усл») t

/-- Свободное утверждение без теоремы, ходов, вывода и посылок: факты — строки
    `таких что` записи, цель — из исходника. -/
def «порядокУтверждения» («свои» : List String) («чья» «цель» : String) : Bool :=
  if «чья» ≠ "" || «свои».any (fun l => l = "ход цель" || l = "вывод цель" || l.startsWith "принцип ") ||
     !«свои».contains "вид statement" || («цель».splitOn "\"").length > 1 then false else
  let «имена» := («свои».filter (·.startsWith "для всех «")).map (fun l => («ёлочка» l 1, «обрезать» («уголок» l 1)))
  let «ф» := («свои».filter (·.startsWith "таких что ")).map (fun l => «т» («уголок» l 1))
  «порядокРазбором» «имена» («т» «цель») «ф» [] 0

end «Второй»
