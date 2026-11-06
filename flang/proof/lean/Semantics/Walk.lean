import Semantics.Fuel

namespace «Эталон»

inductive «Терм» where
  | «знач» (v : «Зн»)
  | «имя» (x : String)
  | «рез» (k : Nat)
  | «двучлен» (op : String) (a b : «Терм»)
  | «вариант?» (k : String) (t : «Терм»)
  | «пусто?» (t : «Терм»)
  | «звено?» (t : «Терм»)
  | «голова» (t : «Терм»)
  | «хвост» (t : «Терм»)
  | «поле» (f : String) (t : «Терм»)
  | «список» (ts : List «Терм»)
deriving Repr, Inhabited

inductive «Дерево» where
  | «лист» (t : «Терм»)
  | «отказ» (k : String)
  | «если» (c : «Терм») (a b : «Дерево»)
  | «вызов» (f : String) (args : List «Терм») (k : Nat) (rest : «Дерево»)
  | «форма» (f : String) (args : List «Терм») (k : Nat) (rest : «Дерево»)
  | «свёртка» (l i : «Терм») (step : «Дерево») (k : Nat) (rest : «Дерево»)
deriving Repr, Inhabited

def «вариантКакой» (k : String) : «Зн» → Bool
  | .«вариант» m _ => k = m
  | _ => false

def «пустой» : «Зн» → Bool
  | .«строка» s => s.isEmpty
  | .«список» l => l.isEmpty
  | _ => false

def «звеньевой» : «Зн» → Bool
  | .«строка» s => match s.toList with
    | [] => false
    | _ :: _ => true
  | .«список» (_ :: _) => true
  | _ => false

def «головаЗн» : «Зн» → «Исход»
  | .«строка» s => match s.toList with
    | c :: _ => .ok (.«строка» (String.singleton c))
    | [] => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"
  | .«список» (v :: _) => .ok v
  | _ => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"

def «хвостЗн» : «Зн» → «Исход»
  | .«строка» s => match s.toList with
    | _ :: r => .ok (.«строка» (String.ofList r))
    | [] => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"
  | .«список» (_ :: r) => .ok (.«список» r)
  | _ => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"

def «полеЗн» (p : String) : «Зн» → «Исход»
  | .«запись» fs => match «найти» p fs with
    | some w => .ok w
    | none => «беда» "FLANG_FIELD"
  | .«вариант» _ fs => match «найти» p fs with
    | some w => .ok w
    | none => «беда» "FLANG_FIELD"
  | _ => «беда» "FLANG_FIELD"

abbrev «Итоги» := List (Nat × «Зн»)

def «взять» (k : Nat) : «Итоги» → Option «Зн»
  | [] => none
  | (j, v) :: r => if j = k then some v else «взять» k r

mutual
def «значТерм» (σ : «Среда») (res : «Итоги») : «Терм» → «Исход»
  | .«знач» v => .ok v
  | .«имя» x =>
    match «найти» x σ with
    | some v => .ok v
    | none => «беда» "FLANG_NAME"
  | .«рез» k =>
    match «взять» k res with
    | some v => .ok v
    | none => «беда» "FLANG_NAME"
  | .«двучлен» op a b => do
    let x ← «значТерм» σ res a
    let y ← «значТерм» σ res b
    «двучлен» op x y
  | .«вариант?» k t => do
    let x ← «значТерм» σ res t
    pure (.«признак» («вариантКакой» k x))
  | .«пусто?» t => do
    let x ← «значТерм» σ res t
    pure (.«признак» («пустой» x))
  | .«звено?» t => do
    let x ← «значТерм» σ res t
    pure (.«признак» («звеньевой» x))
  | .«голова» t => do
    let x ← «значТерм» σ res t
    «головаЗн» x
  | .«хвост» t => do
    let x ← «значТерм» σ res t
    «хвостЗн» x
  | .«поле» f t => do
    let x ← «значТерм» σ res t
    «полеЗн» f x
  | .«список» ts => do
    let vs ← «значВсех» σ res ts
    pure (.«список» vs)

def «значВсех» (σ : «Среда») (res : «Итоги») : List «Терм» → Except «Сбой» (List «Зн»)
  | [] => .ok []
  | t :: r => do
    let v ← «значТерм» σ res t
    let w ← «значВсех» σ res r
    pure (v :: w)
end

mutual
def «значДерева» (P : «Программа») (M : Nat) (σ : «Среда») : «Итоги» → «Дерево» → «Исход»
  | res, .«лист» t => «значТерм» σ res t
  | _, .«отказ» k => «беда» k
  | res, .«если» c a b => do
    let u ← «значТерм» σ res c
    match u with
    | .«признак» true => «значДерева» P M σ res a
    | .«признак» false => «значДерева» P M σ res b
    | _ => «беда» "FLANG_TYPE"
  | res, .«вызов» f ts k rest => do
    let vs ← «значВсех» σ res ts
    let v ← «выч» P M [] (.«вызов» f (vs.map .«лит»))
    «значДерева» P M σ ((k, v) :: res) rest
  | res, .«форма» f ts k rest => do
    let vs ← «значВсех» σ res ts
    let v ← «форма» f vs
    «значДерева» P M σ ((k, v) :: res) rest
  | res, .«свёртка» l i step k rest => do
    let lv ← «значТерм» σ res l
    let iv ← «значТерм» σ res i
    match lv with
    | .«список» xs => do
      let acc ← «свернутьДерево» P M σ res step k xs iv
      «значДерева» P M σ ((k, acc) :: res) rest
    | _ => «беда» "FLANG_TYPE"
termination_by res d => (sizeOf d, 0)
decreasing_by all_goals (simp_wf; first | omega | (apply Prod.Lex.left; omega))
def «свернутьДерево» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (step : «Дерево») (k : Nat) :
    List «Зн» → «Зн» → «Исход»
  | [], acc => .ok acc
  | v :: r, acc => do
    let acc' ← «значДерева» P M σ ((k + 1, v) :: (k, acc) :: res) step
    «свернутьДерево» P M σ res step k r acc'
termination_by xs _ => (sizeOf step, xs.length + 1)
decreasing_by all_goals (simp_wf; first | omega | (apply Prod.Lex.right; omega) | (apply Prod.Lex.left; omega))
end

mutual
def «обход» (ρ : List (String × «Терм»)) (n : Nat) (k : «Терм» → Nat → Option «Дерево») :
    «Выр» → Option «Дерево»
  | .«лит» v => k (.«знач» v) n
  | .«имя» x =>
    match «найти» x ρ with
    | some t => k t n
    | none => none
  | .«двучлен» op a b =>
    «обход» ρ n (fun ta n1 => «обход» ρ n1 (fun tb n2 => k (.«двучлен» op ta tb) n2) b) a
  | .«если» c t e =>
    «обход» ρ n (fun tc n1 =>
      match «обход» ρ n1 k t, «обход» ρ n1 k e with
      | some a, some b => some (.«если» tc a b)
      | _, _ => none) c
  | .«пусть» x v b => «обход» ρ n (fun tv n1 => «обход» ((x, tv) :: ρ) n1 k b) v
  | .«вызов» f args =>
    «обходВсех» ρ n (fun ts n1 =>
      match k (.«рез» n1) (n1 + 1) with
      | some r => some (.«вызов» f ts n1 r)
      | none => none) args
  | .«форма» f args =>
    if f.startsWith "#отказ " then some (.«отказ» (f.drop 7).toString) else
    «обходВсех» ρ n (fun ts n1 =>
      match k (.«рез» n1) (n1 + 1) with
      | some r => some (.«форма» f ts n1 r)
      | none => none) args
  | .«поле» t p => «обход» ρ n (fun tt n1 => k (.«поле» p tt) n1) t
  | .«список» es => «обходВсех» ρ n (fun ts n1 => k (.«список» ts) n1) es
  | .«свёртка» l i a x s =>
    «обход» ρ n (fun tl n1 => «обход» ρ n1 (fun ti n2 =>
      match «обход» ((a, .«рез» n2) :: (x, .«рез» (n2 + 1)) :: ρ) (n2 + 2) (fun t _ => some (.«лист» t)) s,
          k (.«рез» n2) (n2 + 1) with
      | some st, some r => some (.«свёртка» tl ti st n2 r)
      | _, _ => none) i) l
  | .«конструктор» v [] => k (.«знач» (.«вариант» v [])) n
  | .«разбор» t cs => «обход» ρ n (fun tt n1 => «обходСлучаев» ρ n1 k tt cs) t
  | _ => none
def «обходВсех» (ρ : List (String × «Терм»)) (n : Nat) (k : List «Терм» → Nat → Option «Дерево») :
    List «Выр» → Option «Дерево»
  | [] => k [] n
  | e :: r => «обход» ρ n (fun t n1 => «обходВсех» ρ n1 (fun ts n2 => k (t :: ts) n2) r) e
def «обходСлучаев» (ρ : List (String × «Терм»)) (n : Nat) (k : «Терм» → Nat → Option «Дерево») (tt : «Терм») :
    List («Образец» × «Выр») → Option «Дерево»
  | [] => some (.«отказ» "FLANG_MATCH_NOT_EXHAUSTIVE")
  | (.«любое», b) :: _ => «обход» ρ n k b
  | (.«вариант» v bs, b) :: r =>
    match «обход» (bs.map (fun fx => (fx.2, «Терм».«поле» fx.1 tt)) ++ ρ) n k b, «обходСлучаев» ρ n k tt r with
    | some y, some z => some (.«если» (.«вариант?» v tt) y z)
    | _, _ => none
  | (.«пусто», b) :: r =>
    match «обход» ρ n k b, «обходСлучаев» ρ n k tt r with
    | some y, some z => some (.«если» (.«пусто?» tt) y z)
    | _, _ => none
  | (.«звено» h t, b) :: r =>
    match «обход» (h.toList.map (fun x => (x, «Терм».«голова» tt)) ++ t.toList.map (fun y => (y, «Терм».«хвост» tt)) ++ ρ)
        n k b, «обходСлучаев» ρ n k tt r with
    | some y, some z => some (.«если» (.«звено?» tt) y z)
    | _, _ => none
  | (.«лит» _, _) :: _ => none
end

mutual
def «Ниже» (n : Nat) : «Терм» → Prop
  | .«знач» _ => True
  | .«имя» _ => True
  | .«рез» j => j < n
  | .«двучлен» _ a b => «Ниже» n a ∧ «Ниже» n b
  | .«вариант?» _ t => «Ниже» n t
  | .«пусто?» t => «Ниже» n t
  | .«звено?» t => «Ниже» n t
  | .«голова» t => «Ниже» n t
  | .«хвост» t => «Ниже» n t
  | .«поле» _ t => «Ниже» n t
  | .«список» ts => «НижеВсе» n ts
def «НижеВсе» (n : Nat) : List «Терм» → Prop
  | [] => True
  | t :: r => «Ниже» n t ∧ «НижеВсе» n r
end

mutual
theorem «ниже-выше» {n m : Nat} (h : n ≤ m) : ∀ t, «Ниже» n t → «Ниже» m t
  | .«знач» _, _ => trivial
  | .«имя» _, _ => trivial
  | .«рез» _, hj => Nat.lt_of_lt_of_le hj h
  | .«двучлен» _ a b, ⟨ha, hb⟩ => ⟨«ниже-выше» h a ha, «ниже-выше» h b hb⟩
  | .«вариант?» _ t, ht => «ниже-выше» h t ht
  | .«пусто?» t, ht => «ниже-выше» h t ht
  | .«звено?» t, ht => «ниже-выше» h t ht
  | .«голова» t, ht => «ниже-выше» h t ht
  | .«хвост» t, ht => «ниже-выше» h t ht
  | .«поле» _ t, ht => «ниже-выше» h t ht
  | .«список» ts, ht => «нижеВсе-выше» h ts ht
theorem «нижеВсе-выше» {n m : Nat} (h : n ≤ m) : ∀ ts, «НижеВсе» n ts → «НижеВсе» m ts
  | [], _ => trivial
  | t :: r, ⟨ht, hr⟩ => ⟨«ниже-выше» h t ht, «нижеВсе-выше» h r hr⟩
end

theorem «нижеВсе-из-членов» {n : Nat} : ∀ ts : List «Терм», (∀ t, t ∈ ts → «Ниже» n t) → «НижеВсе» n ts
  | [], _ => trivial
  | t :: r, h => ⟨h t (by simp), «нижеВсе-из-членов» r (fun x hx => h x (by simp [hx]))⟩

def «Расширяет» (res' res : «Итоги») (n : Nat) : Prop :=
  ∃ pre, res' = pre ++ res ∧ ∀ p, p ∈ pre → n ≤ p.1

theorem «расширяет-сам» (res : «Итоги») (n : Nat) : «Расширяет» res res n :=
  ⟨[], by simp, by simp⟩

theorem «расширяет-цепь» {a b c : «Итоги»} {n m : Nat} (hnm : n ≤ m) (h1 : «Расширяет» a b m)
    (h2 : «Расширяет» b c n) : «Расширяет» a c n := by
  obtain ⟨p1, rfl, h1⟩ := h1
  obtain ⟨p2, rfl, h2⟩ := h2
  refine ⟨p1 ++ p2, by simp, ?_⟩
  intro p hp
  rcases List.mem_append.mp hp with hp | hp
  · exact Nat.le_trans hnm (h1 p hp)
  · exact h2 p hp

theorem «расширяет-добавить» {res' res : «Итоги»} {n j : Nat} (hj : n ≤ j) (w : «Зн»)
    (h : «Расширяет» res' res n) : «Расширяет» ((j, w) :: res') res n := by
  obtain ⟨p, rfl, hp⟩ := h
  refine ⟨(j, w) :: p, by simp, ?_⟩
  intro q hq
  rcases List.mem_cons.mp hq with hq | hq
  · subst hq; exact hj
  · exact hp q hq

theorem «взять-расширение» {res' res : «Итоги»} {n j : Nat} (hj : j < n) (h : «Расширяет» res' res n) :
    «взять» j res' = «взять» j res := by
  obtain ⟨p, rfl, hp⟩ := h
  induction p with
  | nil => rfl
  | cons q r ih =>
    have hq : n ≤ q.1 := hp q (by simp)
    have hne : q.1 ≠ j := by omega
    obtain ⟨a, b⟩ := q
    simp only [List.cons_append, «взять»]
    rw [ite_eq_right_iff.mpr (fun h => absurd h hne)]
    exact ih (fun x hx => hp x (by simp [hx]))

mutual
theorem «терм-расширение» (σ : «Среда») {res' res : «Итоги»} {n : Nat} (h : «Расширяет» res' res n) :
    ∀ t, «Ниже» n t → «значТерм» σ res' t = «значТерм» σ res t
  | .«знач» _, _ => rfl
  | .«имя» _, _ => rfl
  | .«рез» j, hj => by simp only [«значТерм», «взять-расширение» hj h]
  | .«двучлен» op a b, ⟨ha, hb⟩ => by
    simp only [«значТерм», «терм-расширение» σ h a ha, «терм-расширение» σ h b hb]
  | .«вариант?» _ t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«пусто?» t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«звено?» t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«голова» t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«хвост» t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«поле» _ t, ht => by simp only [«значТерм», «терм-расширение» σ h t ht]
  | .«список» ts, ht => by simp only [«значТерм», «термы-расширение» σ h ts ht]
theorem «термы-расширение» (σ : «Среда») {res' res : «Итоги»} {n : Nat} (h : «Расширяет» res' res n) :
    ∀ ts, «НижеВсе» n ts → «значВсех» σ res' ts = «значВсех» σ res ts
  | [], _ => rfl
  | t :: r, ⟨ht, hr⟩ => by simp only [«значВсех», «терм-расширение» σ h t ht, «термы-расширение» σ h r hr]
end

def «Согласны» (σ : «Среда») (res : «Итоги») (n : Nat) (ρ : List (String × «Терм»)) (γ : «Среда») : Prop :=
  ∀ x t, «найти» x ρ = some t → «Ниже» n t ∧ ∃ w, «найти» x γ = some w ∧ «значТерм» σ res t = .ok w

theorem «согласны-шире» {σ : «Среда»} {res : «Итоги»} {n : Nat} {ρ : List (String × «Терм»)} {γ : «Среда»}
    (h : «Согласны» σ res n ρ γ) (x : String) (t : «Терм») (w : «Зн») (hn : «Ниже» n t)
    (ht : «значТерм» σ res t = .ok w) : «Согласны» σ res n ((x, t) :: ρ) ((x, w) :: γ) := by
  intro y s hs
  by_cases hy : x = y
  · subst hy
    simp only [«найти», ite_true, Option.some.injEq] at hs
    subst hs
    exact ⟨hn, w, by simp [«найти»], ht⟩
  · simp only [«найти», hy, ite_false] at hs
    obtain ⟨h1, w', h2, h3⟩ := h y s hs
    exact ⟨h1, w', by simp [«найти», hy, h2], h3⟩

theorem «согласны-дальше» {σ : «Среда»} {res res' : «Итоги»} {n m : Nat} {ρ : List (String × «Терм»)}
    {γ : «Среда»} (h : «Согласны» σ res n ρ γ) (hnm : n ≤ m) (he : «Расширяет» res' res n) :
    «Согласны» σ res' m ρ γ := by
  intro x t hx
  obtain ⟨h1, w, h2, h3⟩ := h x t hx
  refine ⟨«ниже-выше» hnm t h1, w, h2, ?_⟩
  rw [«терм-расширение» σ he t h1]
  exact h3

def «Соответствуют» (σ : «Среда») (res : «Итоги») (n : Nat) :
    List (String × «Терм») → «Среда» → Prop
  | [], [] => True
  | (x, t) :: a, (y, w) :: b => x = y ∧ «Ниже» n t ∧ «значТерм» σ res t = .ok w ∧ «Соответствуют» σ res n a b
  | _, _ => False

theorem «согласны-префикс» {σ : «Среда»} {res : «Итоги»} {n : Nat} {ρ : List (String × «Терм»)} {γ : «Среда»}
    (h : «Согласны» σ res n ρ γ) : ∀ (pr : List (String × «Терм»)) (pg : «Среда»), «Соответствуют» σ res n pr pg →
      «Согласны» σ res n (pr ++ ρ) (pg ++ γ)
  | [], [], _ => by simpa using h
  | (x, t) :: a, (y, w) :: b, ⟨hxy, hn, ht, hab⟩ => by
    subst hxy
    exact «согласны-шире» («согласны-префикс» h a b hab) x t w hn ht
  | [], _ :: _, hf => by simp [«Соответствуют»] at hf
  | _ :: _, [], hf => by simp [«Соответствуют»] at hf

theorem «соответствуют-сцепка» {σ : «Среда»} {res : «Итоги»} {n : Nat} :
    ∀ (a1 : List (String × «Терм»)) (b1 : «Среда») (a2 : List (String × «Терм»)) (b2 : «Среда»),
      «Соответствуют» σ res n a1 b1 → «Соответствуют» σ res n a2 b2 → «Соответствуют» σ res n (a1 ++ a2) (b1 ++ b2)
  | [], [], _, _, _, h2 => by simpa using h2
  | (x, t) :: a, (y, w) :: b, a2, b2, ⟨h1, h2, h3, h4⟩, h5 =>
    ⟨h1, h2, h3, «соответствуют-сцепка» a b a2 b2 h4 h5⟩
  | [], _ :: _, _, _, hf, _ => by simp [«Соответствуют»] at hf
  | _ :: _, [], _, _, hf, _ => by simp [«Соответствуют»] at hf

theorem «связки-соответствуют» (σ : «Среда») (res : «Итоги») (n : Nat) (tt : «Терм») (mm : String)
    (fs : List (String × «Зн»)) (hn : «Ниже» n tt) (ht : «значТерм» σ res tt = .ok (.«вариант» mm fs)) :
    ∀ (bs : List (String × String)) (e : «Среда»), «связки» fs bs = .ok e →
      «Соответствуют» σ res n (bs.map (fun fx => (fx.2, «Терм».«поле» fx.1 tt))) e
  | [], e, h => by simp only [«связки»] at h; cases h; trivial
  | (f, x) :: r, e, h => by
    simp only [«связки»] at h
    cases hf : «найти» f fs with
    | none => rw [hf] at h; cases h
    | some w =>
      rw [hf] at h
      cases hr : «связки» fs r with
      | error er => rw [hr] at h; cases h
      | ok e' =>
        rw [hr] at h
        simp only [bind, Except.bind, pure, Except.pure] at h
        cases h
        refine ⟨rfl, hn, ?_, «связки-соответствуют» σ res n tt mm fs hn ht r e' hr⟩
        simp [«значТерм», ht, «полеЗн», hf, bind, Except.bind]

def «связиЗвена» (h t : Option String) (H T : «Зн») : «Среда» :=
  (match h with | some x => [(x, H)] | none => []) ++ (match t with | some y => [(y, T)] | none => [])

theorem «звено-соответствуют» (σ : «Среда») (res : «Итоги») (n : Nat) (tt : «Терм») (val : «Зн»)
    (hn : «Ниже» n tt) (ht : «значТерм» σ res tt = .ok val) (h t : Option String) (e : «Среда»)
    (hp : «подходит» (.«звено» h t) val = .ok (some e)) :
    «Соответствуют» σ res n (h.toList.map (fun x => (x, «Терм».«голова» tt)) ++
      t.toList.map (fun y => (y, «Терм».«хвост» tt))) e := by
  have key : ∀ (H T : «Зн»), «головаЗн» val = .ok H → «хвостЗн» val = .ok T →
      e = «связиЗвена» h t H T →
      «Соответствуют» σ res n (h.toList.map (fun x => (x, «Терм».«голова» tt)) ++
        t.toList.map (fun y => (y, «Терм».«хвост» tt))) e := by
    intro H T hH hT he
    subst he
    unfold «связиЗвена»
    apply «соответствуют-сцепка»
    · cases h with
      | none => trivial
      | some x => exact ⟨rfl, hn, by simp [«значТерм», ht, hH, bind, Except.bind], trivial⟩
    · cases t with
      | none => trivial
      | some y => exact ⟨rfl, hn, by simp [«значТерм», ht, hT, bind, Except.bind], trivial⟩
  cases val with
  | «строка» s =>
    simp only [«подходит»] at hp
    cases hs : s.toList with
    | nil => rw [hs] at hp; cases hp
    | cons c r =>
      rw [hs] at hp
      simp only [Except.ok.injEq, Option.some.injEq] at hp
      exact key (.«строка» (String.singleton c)) (.«строка» (String.ofList r)) (by simp [«головаЗн», hs])
        (by simp [«хвостЗн», hs]) (by rw [hp.symm]; rfl)
  | «список» l =>
    simp only [«подходит»] at hp
    cases l with
    | nil => cases hp
    | cons v r =>
      simp only [Except.ok.injEq, Option.some.injEq] at hp
      exact key v (.«список» r) (by simp [«головаЗн»]) (by simp [«хвостЗн»]) (by rw [hp.symm]; rfl)
  | _ => simp [«подходит»] at hp

theorem «звено-без-ошибки» (h t : Option String) (val : «Зн») (er : «Сбой») :
    «подходит» (.«звено» h t) val ≠ .error er := by
  cases val with
  | «строка» s =>
    simp only [«подходит»]
    cases s.toList <;> simp
  | «список» l => cases l <;> simp [«подходит»]
  | _ => simp [«подходит»]

theorem «звено-нет» (h t : Option String) (val : «Зн») (hp : «подходит» (.«звено» h t) val = .ok none) :
    «звеньевой» val = false := by
  cases val with
  | «строка» s =>
    simp only [«подходит»] at hp
    simp only [«звеньевой»]
    cases hs : s.toList with
    | nil => rfl
    | cons c r => rw [hs] at hp; simp at hp
  | «список» l => cases l with
    | nil => rfl
    | cons _ _ => simp [«подходит»] at hp
  | _ => rfl

theorem «звено-да» (h t : Option String) (val : «Зн») (e : «Среда»)
    (hp : «подходит» (.«звено» h t) val = .ok (some e)) : «звеньевой» val = true := by
  cases val with
  | «строка» s =>
    simp only [«подходит»] at hp
    simp only [«звеньевой»]
    cases hs : s.toList with
    | nil => rw [hs] at hp; simp at hp
    | cons c r => rfl
  | «список» l => cases l with
    | nil => simp [«подходит»] at hp
    | cons _ _ => rfl
  | _ => simp [«подходит»] at hp

theorem «поле-как-полеЗн» (p : String) (v : «Зн») :
    (match v with
      | .«запись» fs =>
        match «найти» p fs with
        | some w => pure w
        | none => «беда» "FLANG_FIELD"
      | .«вариант» _ fs =>
        match «найти» p fs with
        | some w => pure w
        | none => «беда» "FLANG_FIELD"
      | _ => «беда» "FLANG_FIELD" : «Исход») = «полеЗн» p v := by
  cases v <;> simp [«полеЗн»] <;> rfl

theorem «вычВсе-литералы» (P : «Программа») (m : Nat) (γ : «Среда») :
    ∀ vs : List «Зн», 0 < m → «вычВсе» («выч» P m) γ (vs.map .«лит») = .ok vs
  | [], _ => rfl
  | v :: r, hm => by
    obtain ⟨k, rfl⟩ : ∃ k, m = k + 1 := ⟨m - 1, by omega⟩
    have h1 : «выч» P (k + 1) γ (.«лит» v) = .ok v := rfl
    have h2 := «вычВсе-литералы» P (k + 1) γ r hm
    simp only [List.map, «вычВсе»]
    rw [h1, h2]
    rfl

theorem «вызов-литералами» (P : «Программа») (m : Nat) (γ : «Среда») (f : String) (args : List «Выр»)
    (vs : List «Зн») (hvs : «вычВсе» («выч» P m) γ args = .ok vs) {v : «Зн»}
    (hv : «выч» P (m + 1) γ (.«вызов» f args) = .ok v) :
    «выч» P (m + 1) [] (.«вызов» f (vs.map .«лит»)) = .ok v := by
  have e1 : «выч» P (m + 1) γ (.«вызов» f args) = «шаг» P («выч» P m) γ (.«вызов» f args) := rfl
  have e2 : «выч» P (m + 1) [] (.«вызов» f (vs.map .«лит»)) =
      «шаг» P («выч» P m) [] (.«вызов» f (vs.map .«лит»)) := rfl
  have hl : «вычВсе» («выч» P m) [] (vs.map .«лит») = .ok vs := by
    cases m with
    | zero =>
      cases args with
      | nil =>
        simp only [«вычВсе»] at hvs
        cases hvs
        rfl
      | cons a r =>
        simp only [«вычВсе»] at hvs
        rw [show «выч» P 0 γ a = .error .«топливо» from rfl] at hvs
        cases hvs
    | succ k => exact «вычВсе-литералы» P (k + 1) [] vs (by omega)
  rw [e1] at hv
  rw [e2]
  simp only [«шаг»] at hv ⊢
  rw [hvs] at hv
  rw [hl]
  exact hv

theorem «свернуть-верно» (P : «Программа») (σ : «Среда») (M m : Nat) (γ : «Среда»)
    (a x : String) (s : «Выр») (n2 : Nat) (st : «Дерево») (res : «Итоги»)
    (hstep : ∀ (acc v acc' : «Зн»), «выч» P m ((a, acc) :: (x, v) :: γ) s = .ok acc' →
      «значДерева» P M σ ((n2 + 1, v) :: (n2, acc) :: res) st = .ok acc') :
    ∀ (xs : List «Зн») (acc w : «Зн»),
      «свернуть» («выч» P m) γ a x s acc xs = .ok w →
      «свернутьДерево» P M σ res st n2 xs acc = .ok w
  | [], acc, w, hw => by
    simp only [«свернуть»] at hw
    cases hw
    simp [«свернутьДерево»]
  | v :: r, acc, w, hw => by
    simp only [«свернуть»] at hw
    cases hb : «выч» P m ((a, acc) :: (x, v) :: γ) s with
    | error er => rw [hb] at hw; cases hw
    | ok acc' =>
      rw [hb] at hw
      simp only [bind, Except.bind] at hw
      simp only [«свернутьДерево», hstep acc v acc' hb, bind, Except.bind]
      exact «свернуть-верно» P σ M m γ a x s n2 st res hstep r acc' w hw

mutual
theorem «обход-верен» (P : «Программа») (σ : «Среда») (M : Nat) :
    ∀ (e : «Выр») (ρ : List (String × «Терм»)) (γ : «Среда») (n : Nat) (res : «Итоги»)
      (k : «Терм» → Nat → Option «Дерево») (d : «Дерево») (m : Nat) (v : «Зн») (R : «Исход»),
      «обход» ρ n k e = some d → «Согласны» σ res n ρ γ → «выч» P m γ e = .ok v → m ≤ M →
      (∀ t n1 d' res', k t n1 = some d' → n ≤ n1 → «Ниже» n1 t → «Расширяет» res' res n →
        «значТерм» σ res' t = .ok v → «значДерева» P M σ res' d' = R) →
      «значДерева» P M σ res d = R
  | .«лит» w, ρ, γ, n, res, k, d, m, v, R, hd, _, hv, _, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hv
      exact hk _ _ _ res hd (Nat.le_refl n) trivial («расширяет-сам» res n) rfl
  | .«имя» x, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, _, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«обход»] at hd
      split at hd
      · rename_i t ht
        obtain ⟨hn, w, hw, htw⟩ := hs x t ht
        simp only [«выч», «шаг», hw] at hv
        cases hv
        exact hk _ _ _ res hd (Nat.le_refl n) hn («расширяет-сам» res n) htw
      · cases hd
  | .«двучлен» op a b, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases ha : «выч» P m γ a with
      | error e => rw [ha] at hv; cases hv
      | ok x =>
        cases hb : «выч» P m γ b with
        | error e => rw [ha, hb] at hv; cases hv
        | ok y =>
          rw [ha, hb] at hv
          simp only [bind, Except.bind] at hv
          simp only [«обход»] at hd
          refine «обход-верен» P σ M a ρ γ n res _ d m x R hd hs ha (by omega) ?_
          intro ta n1 d1 res1 hd1 hn1 hta he1 hxa
          refine «обход-верен» P σ M b ρ γ n1 res1 _ d1 m y R hd1 («согласны-дальше» hs hn1 he1) hb
            (by omega) ?_
          intro tb n2 d2 res2 hd2 hn2 htb he2 hyb
          refine hk _ n2 d2 res2 hd2 (by omega) ⟨«ниже-выше» hn2 ta hta, htb⟩
            («расширяет-цепь» hn1 he2 he1) ?_
          simp only [«значТерм», «терм-расширение» σ he2 ta hta, hxa, hyb, bind, Except.bind]
          exact hv
  | .«если» c t e, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hc : «выч» P m γ c with
      | error er => rw [hc] at hv; cases hv
      | ok u =>
        rw [hc] at hv
        simp only [bind, Except.bind] at hv
        simp only [«обход»] at hd
        refine «обход-верен» P σ M c ρ γ n res _ d m u R hd hs hc (by omega) ?_
        intro tc n1 d1 res1 hd1 hn1 htc he1 huc
        have hs1 := «согласны-дальше» hs hn1 he1
        have hk1 : ∀ t' n2 d' res', k t' n2 = some d' → n1 ≤ n2 → «Ниже» n2 t' →
            «Расширяет» res' res1 n1 → «значТерм» σ res' t' = .ok v → «значДерева» P M σ res' d' = R :=
          fun t' n2 d' res' h1 h2 h3 h4 h5 =>
            hk t' n2 d' res' h1 (by omega) h3 («расширяет-цепь» hn1 h4 he1) h5
        cases hta : «обход» ρ n1 k t with
        | none => simp [hta] at hd1
        | some a =>
          cases hte : «обход» ρ n1 k e with
          | none => simp [hta, hte] at hd1
          | some b =>
            simp only [hta, hte] at hd1
            cases hd1
            simp only [«значДерева», huc, bind, Except.bind]
            split at hv
            · exact «обход-верен» P σ M t ρ γ n1 res1 k a m v R hta hs1 hv (by omega) hk1
            · exact «обход-верен» P σ M e ρ γ n1 res1 k b m v R hte hs1 hv (by omega) hk1
            · cases hv
  | .«пусть» x w b, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hw : «выч» P m γ w with
      | error er => rw [hw] at hv; cases hv
      | ok w' =>
        rw [hw] at hv
        simp only [bind, Except.bind] at hv
        simp only [«обход»] at hd
        refine «обход-верен» P σ M w ρ γ n res _ d m w' R hd hs hw (by omega) ?_
        intro tw n1 d1 res1 hd1 hn1 htw he1 hww
        refine «обход-верен» P σ M b ((x, tw) :: ρ) ((x, w') :: γ) n1 res1 k d1 m v R hd1
          («согласны-шире» («согласны-дальше» hs hn1 he1) x tw w' htw hww) hv (by omega) ?_
        intro t' n2 d' res' h1 h2 h3 h4 h5
        exact hk t' n2 d' res' h1 (by omega) h3 («расширяет-цепь» hn1 h4 he1) h5
  | .«вызов» f args, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      have hv0 := hv
      simp only [«выч», «шаг»] at hv
      cases hvs : «вычВсе» («выч» P m) γ args with
      | error er => rw [hvs] at hv; cases hv
      | ok vs =>
        have hcall := «вызов-литералами» P m γ f args vs hvs hv0
        have hcallM := «топливо-моно» P hM [] _ hcall (by simp)
        simp only [«обход»] at hd
        refine «обходВсех-верен» P σ M args ρ γ n res _ d m vs R hd hs hvs (by omega) ?_
        intro ts n1 d1 res1 hd1 hn1 hts he1 hvts
        cases hr : k (.«рез» n1) (n1 + 1) with
        | none => simp [hr] at hd1
        | some r =>
          simp only [hr] at hd1
          cases hd1
          simp only [«значДерева», hvts, bind, Except.bind, hcallM]
          refine hk _ (n1 + 1) r ((n1, v) :: res1) hr (by omega) (Nat.lt_succ_self n1)
            («расширяет-добавить» hn1 v he1) ?_
          simp [«значТерм», «взять»]
  | .«разбор» t cs, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases ht : «выч» P m γ t with
      | error er => rw [ht] at hv; cases hv
      | ok val =>
        rw [ht] at hv
        simp only [bind, Except.bind] at hv
        simp only [«обход»] at hd
        refine «обход-верен» P σ M t ρ γ n res _ d m val R hd hs ht (by omega) ?_
        intro tt n1 d1 res1 hd1 hn1 htt he1 hval
        refine «обходСлучаев-верен» P σ M cs ρ γ n1 res1 k tt d1 m val v R hd1 («согласны-дальше» hs hn1 he1)
          htt hval hv (by omega) ?_
        intro t' n2 d' res' h1 h2 h3 h4 h5
        exact hk t' n2 d' res' h1 (by omega) h3 («расширяет-цепь» hn1 h4 he1) h5
  | .«свёртка» l i a x s, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hl : «выч» P m γ l with
      | error er => rw [hl] at hv; cases hv
      | ok lv =>
        cases hi : «выч» P m γ i with
        | error er => rw [hl, hi] at hv; cases hv
        | ok iv =>
          rw [hl, hi] at hv
          simp only [bind, Except.bind] at hv
          cases lv with
          | «список» xs =>
            simp only at hv
            simp only [«обход»] at hd
            refine «обход-верен» P σ M l ρ γ n res _ d m (.«список» xs) R hd hs hl (by omega) ?_
            intro tl n1 d1 res1 hd1 hn1 htl he1 hvl
            refine «обход-верен» P σ M i ρ γ n1 res1 _ d1 m iv R hd1 («согласны-дальше» hs hn1 he1) hi (by omega) ?_
            intro ti n2 d2 res2 hd2 hn2 hti he2 hvi
            cases hst : «обход» ((a, .«рез» n2) :: (x, .«рез» (n2 + 1)) :: ρ) (n2 + 2) (fun t _ => some (.«лист» t)) s with
            | none => simp [hst] at hd2
            | some st =>
              cases hr : k (.«рез» n2) (n2 + 1) with
              | none => simp [hst, hr] at hd2
              | some r =>
                simp only [hst, hr] at hd2
                cases hd2
                have he12 : «Расширяет» res2 res n := «расширяет-цепь» hn1 he2 he1
                have hs2 : «Согласны» σ res2 n2 ρ γ := «согласны-дальше» hs (by omega) he12
                have hstep : ∀ (acc w acc' : «Зн»), «выч» P m ((a, acc) :: (x, w) :: γ) s = .ok acc' →
                    «значДерева» P M σ ((n2 + 1, w) :: (n2, acc) :: res2) st = .ok acc' := by
                  intro acc w acc' hb
                  have hext : «Расширяет» ((n2 + 1, w) :: (n2, acc) :: res2) res2 n2 :=
                    «расширяет-добавить» (by omega) w («расширяет-добавить» (Nat.le_refl n2) acc («расширяет-сам» res2 n2))
                  have hs0 : «Согласны» σ ((n2 + 1, w) :: (n2, acc) :: res2) (n2 + 2) ρ γ :=
                    «согласны-дальше» hs2 (by omega) hext
                  have hsx := «согласны-шире» hs0 x (.«рез» (n2 + 1)) w (by simp [«Ниже»])
                    (by simp [«значТерм», «взять»])
                  have hsa := «согласны-шире» hsx a (.«рез» n2) acc (by simp [«Ниже»])
                    (by simp [«значТерм», «взять»])
                  refine «обход-верен» P σ M s _ _ (n2 + 2) _ _ st m acc' _ hst hsa hb (by omega) ?_
                  intro t n3 d' res' h1 _ _ _ h5
                  simp only [Option.some.injEq] at h1
                  subst h1
                  simp only [«значДерева»]
                  exact h5
                have hfold := «свернуть-верно» P σ M m γ a x s n2 st res2 hstep xs iv v hv
                simp only [«значДерева», «терм-расширение» σ he2 tl htl, hvl, hvi, bind, Except.bind, hfold]
                refine hk _ (n2 + 1) r ((n2, v) :: res2) hr (by omega) (Nat.lt_succ_self n2)
                  («расширяет-добавить» (by omega) v he12) ?_
                simp [«значТерм», «взять»]
          | _ => simp [«беда»] at hv
  | .«отобразить» _ _ _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
  | .«отфильтровать» _ _ _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
  | .«список» es, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hvs : «вычВсе» («выч» P m) γ es with
      | error er => rw [hvs] at hv; cases hv
      | ok vs =>
        rw [hvs] at hv
        simp only [bind, Except.bind, pure, Except.pure] at hv
        cases hv
        simp only [«обход»] at hd
        refine «обходВсех-верен» P σ M es ρ γ n res _ d m vs R hd hs hvs (by omega) ?_
        intro ts n1 d1 res1 hd1 hn1 hts he1 hvts
        refine hk _ n1 d1 res1 hd1 hn1 («нижеВсе-из-членов» ts hts) he1 ?_
        simp only [«значТерм», hvts, bind, Except.bind, pure, Except.pure]
  | .«запись» _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
  | .«конструктор» kv [], ρ, γ, n, res, k, d, m, v, R, hd, _, hv, _, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг», «вычПоля», bind, Except.bind, pure, Except.pure] at hv
      cases hv
      exact hk _ _ _ res hd (Nat.le_refl n) trivial («расширяет-сам» res n) rfl
  | .«конструктор» _ (_ :: _), _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
  | .«поле» t p, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases ht : «выч» P m γ t with
      | error er => rw [ht] at hv; cases hv
      | ok val =>
        rw [ht] at hv
        simp only [bind, Except.bind] at hv
        simp only [«обход»] at hd
        refine «обход-верен» P σ M t ρ γ n res _ d m val R hd hs ht (by omega) ?_
        intro tt n1 d1 res1 hd1 hn1 htt he1 hval
        refine hk _ n1 d1 res1 hd1 hn1 htt he1 ?_
        simp only [«значТерм», hval, bind, Except.bind]
        cases val <;> simp only [«полеЗн»] <;> first | exact hv | (simp [«беда»] at hv)
  | .«форма» f args, ρ, γ, n, res, k, d, m, v, R, hd, hs, hv, hM, hk => by
    cases m with
    | zero => simp [«выч»] at hv
    | succ m =>
      simp only [«выч», «шаг»] at hv
      cases hvs : «вычВсе» («выч» P m) γ args with
      | error er => rw [hvs] at hv; cases hv
      | ok vs =>
        rw [hvs] at hv
        simp only [bind, Except.bind] at hv
        by_cases hf : f.startsWith "#отказ "
        · simp [«форма», hf, «беда»] at hv
        · simp only [«обход», hf] at hd
          refine «обходВсех-верен» P σ M args ρ γ n res _ d m vs R hd hs hvs (by omega) ?_
          intro ts n1 d1 res1 hd1 hn1 hts he1 hvts
          cases hr : k (.«рез» n1) (n1 + 1) with
          | none => simp [hr] at hd1
          | some r =>
            simp only [hr] at hd1
            cases hd1
            simp only [«значДерева», hvts, bind, Except.bind, hv]
            refine hk _ (n1 + 1) r ((n1, v) :: res1) hr (by omega) (Nat.lt_succ_self n1)
              («расширяет-добавить» hn1 v he1) ?_
            simp [«значТерм», «взять»]
  | .«ссылка» _ _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
  | .«применить» _ _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _ => by simp [«обход»] at hd
theorem «обходВсех-верен» (P : «Программа») (σ : «Среда») (M : Nat) :
    ∀ (args : List «Выр») (ρ : List (String × «Терм»)) (γ : «Среда») (n : Nat) (res : «Итоги»)
      (k : List «Терм» → Nat → Option «Дерево») (d : «Дерево») (m : Nat) (vs : List «Зн») (R : «Исход»),
      «обходВсех» ρ n k args = some d → «Согласны» σ res n ρ γ → «вычВсе» («выч» P m) γ args = .ok vs →
      m ≤ M →
      (∀ ts n1 d' res', k ts n1 = some d' → n ≤ n1 → (∀ t, t ∈ ts → «Ниже» n1 t) → «Расширяет» res' res n →
        «значВсех» σ res' ts = .ok vs → «значДерева» P M σ res' d' = R) →
      «значДерева» P M σ res d = R
  | [], ρ, γ, n, res, k, d, m, vs, R, hd, _, hvs, _, hk => by
    simp only [«вычВсе»] at hvs
    cases hvs
    simp only [«обходВсех»] at hd
    exact hk [] n d res hd (Nat.le_refl n) (by simp) («расширяет-сам» res n) rfl
  | e :: r, ρ, γ, n, res, k, d, m, vs, R, hd, hs, hvs, hM, hk => by
    simp only [«вычВсе»] at hvs
    cases he : «выч» P m γ e with
    | error er => rw [he] at hvs; cases hvs
    | ok w =>
      cases hr : «вычВсе» («выч» P m) γ r with
      | error er => rw [he, hr] at hvs; cases hvs
      | ok ws =>
        rw [he, hr] at hvs
        simp only [bind, Except.bind, pure, Except.pure] at hvs
        cases hvs
        simp only [«обходВсех»] at hd
        refine «обход-верен» P σ M e ρ γ n res _ d m w R hd hs he hM ?_
        intro t n1 d1 res1 hd1 hn1 ht he1 hwt
        refine «обходВсех-верен» P σ M r ρ γ n1 res1 _ d1 m ws R hd1 («согласны-дальше» hs hn1 he1) hr hM ?_
        intro ts n2 d2 res2 hd2 hn2 hts he2 hws
        refine hk (t :: ts) n2 d2 res2 hd2 (by omega) ?_ («расширяет-цепь» hn1 he2 he1) ?_
        · intro x hx
          rcases List.mem_cons.mp hx with hx | hx
          · rw [hx]; exact «ниже-выше» hn2 t ht
          · exact hts x hx
        · simp only [«значВсех», «терм-расширение» σ he2 t ht, hwt, hws, bind, Except.bind, pure, Except.pure]
theorem «обходСлучаев-верен» (P : «Программа») (σ : «Среда») (M : Nat) :
    ∀ (cs : List («Образец» × «Выр»)) (ρ : List (String × «Терм»)) (γ : «Среда») (n : Nat) (res : «Итоги»)
      (k : «Терм» → Nat → Option «Дерево») (tt : «Терм») (d : «Дерево») (m : Nat) (val v : «Зн») (R : «Исход»),
      «обходСлучаев» ρ n k tt cs = some d → «Согласны» σ res n ρ γ → «Ниже» n tt → «значТерм» σ res tt = .ok val →
      «разобрать» («выч» P m) γ val cs = .ok v → m ≤ M →
      (∀ t n1 d' res', k t n1 = some d' → n ≤ n1 → «Ниже» n1 t → «Расширяет» res' res n →
        «значТерм» σ res' t = .ok v → «значДерева» P M σ res' d' = R) →
      «значДерева» P M σ res d = R
  | [], _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, hv, _, _ => by simp [«разобрать», «беда»] at hv
  | (.«любое», b) :: _, ρ, γ, n, res, k, tt, d, m, val, v, R, hd, hs, _, _, hv, hM, hk => by
    simp only [«разобрать», «подходит», «вставить», List.nil_append] at hv
    simp only [«обходСлучаев»] at hd
    exact «обход-верен» P σ M b ρ γ n res k d m v R hd hs hv hM hk
  | (.«лит» _, _) :: _, _, _, _, _, _, _, _, _, _, _, _, hd, _, _, _, _, _, _ => by simp [«обходСлучаев»] at hd
  | (.«вариант» kv bs, b) :: r, ρ, γ, n, res, k, tt, d, m, val, v, R, hd, hs, hn, ht, hv, hM, hk => by
    simp only [«обходСлучаев»] at hd
    cases hy : «обход» (bs.map (fun fx => (fx.2, «Терм».«поле» fx.1 tt)) ++ ρ) n k b with
    | none => simp [hy] at hd
    | some y =>
      cases hz : «обходСлучаев» ρ n k tt r with
      | none => simp [hy, hz] at hd
      | some z =>
        simp only [hy, hz] at hd
        cases hd
        have hrest : «разобрать» («выч» P m) γ val r = .ok v → «значДерева» P M σ res z = R :=
          fun h => «обходСлучаев-верен» P σ M r ρ γ n res k tt z m val v R hz hs hn ht h hM hk
        cases val with
        | «вариант» mm fs =>
          by_cases hk' : kv = mm
          · subst hk'
            simp only [«разобрать», «подходит», ite_true] at hv
            cases he : «связки» fs bs with
            | error er => rw [he] at hv; cases hv
            | ok e =>
              rw [he] at hv
              simp only [bind, Except.bind, pure, Except.pure, «вставить»] at hv
              simp only [«значДерева», «значТерм», ht, «вариантКакой», bind, Except.bind, pure, Except.pure,
                decide_true]
              exact «обход-верен» P σ M b _ (e ++ γ) n res k y m v R hy
                («согласны-префикс» hs _ e («связки-соответствуют» σ res n tt kv fs hn ht bs e he)) hv hM hk
          · simp only [«разобрать», «подходит», hk', ite_false] at hv
            simp only [«значДерева», «значТерм», ht, «вариантКакой», hk', bind, Except.bind, pure, Except.pure,
              decide_false]
            exact hrest hv
        | _ =>
          simp only [«разобрать», «подходит»] at hv
          simp only [«значДерева», «значТерм», ht, «вариантКакой», bind, Except.bind, pure, Except.pure]
          exact hrest hv
  | (.«пусто», b) :: r, ρ, γ, n, res, k, tt, d, m, val, v, R, hd, hs, hn, ht, hv, hM, hk => by
    simp only [«обходСлучаев»] at hd
    cases hy : «обход» ρ n k b with
    | none => simp [hy] at hd
    | some y =>
      cases hz : «обходСлучаев» ρ n k tt r with
      | none => simp [hy, hz] at hd
      | some z =>
        simp only [hy, hz] at hd
        cases hd
        have hrest : «разобрать» («выч» P m) γ val r = .ok v → «значДерева» P M σ res z = R :=
          fun h => «обходСлучаев-верен» P σ M r ρ γ n res k tt z m val v R hz hs hn ht h hM hk
        have hyes : «выч» P m γ b = .ok v → «значДерева» P M σ res y = R :=
          fun h => «обход-верен» P σ M b ρ γ n res k y m v R hy hs h hM hk
        cases val with
        | «строка» s =>
          by_cases he : s.isEmpty = true
          · simp only [«разобрать», «подходит», he, ite_true, «вставить», List.nil_append] at hv
            simp only [«значДерева», «значТерм», ht, «пустой», he, bind, Except.bind, pure, Except.pure]
            exact hyes hv
          · simp only [«разобрать», «подходит», he, ite_false] at hv
            simp only [«значДерева», «значТерм», ht, «пустой», he, bind, Except.bind, pure, Except.pure]
            exact hrest hv
        | «список» l =>
          by_cases he : l.isEmpty = true
          · simp only [«разобрать», «подходит», he, ite_true, «вставить», List.nil_append] at hv
            simp only [«значДерева», «значТерм», ht, «пустой», he, bind, Except.bind, pure, Except.pure]
            exact hyes hv
          · simp only [«разобрать», «подходит», he, ite_false] at hv
            simp only [«значДерева», «значТерм», ht, «пустой», he, bind, Except.bind, pure, Except.pure]
            exact hrest hv
        | _ =>
          simp only [«разобрать», «подходит»] at hv
          simp only [«значДерева», «значТерм», ht, «пустой», bind, Except.bind, pure, Except.pure]
          exact hrest hv
  | (.«звено» h t, b) :: r, ρ, γ, n, res, k, tt, d, m, val, v, R, hd, hs, hn, ht, hv, hM, hk => by
    simp only [«обходСлучаев», List.append_assoc] at hd
    cases hy : «обход» (h.toList.map (fun x => (x, «Терм».«голова» tt)) ++ (t.toList.map (fun y => (y, «Терм».«хвост» tt)) ++ ρ))
        n k b with
    | none => simp [hy] at hd
    | some y =>
      cases hz : «обходСлучаев» ρ n k tt r with
      | none => simp [hy, hz] at hd
      | some z =>
        simp only [hy, hz] at hd
        cases hd
        have hrest : «разобрать» («выч» P m) γ val r = .ok v → «значДерева» P M σ res z = R :=
          fun h' => «обходСлучаев-верен» P σ M r ρ γ n res k tt z m val v R hz hs hn ht h' hM hk
        cases hp : «подходит» (.«звено» h t) val with
        | error er => exact absurd hp («звено-без-ошибки» h t val er)
        | ok o =>
          cases o with
          | none =>
            have hv' : «разобрать» («выч» P m) γ val r = .ok v := by
              simp only [«разобрать», hp] at hv; exact hv
            simp only [«значДерева», «значТерм», ht, «звено-нет» h t val hp, bind, Except.bind, pure, Except.pure]
            exact hrest hv'
          | some e =>
            have hv' : «выч» P m (e ++ γ) b = .ok v := by
              simp only [«разобрать», hp, «вставить»] at hv; exact hv
            simp only [«значДерева», «значТерм», ht, «звено-да» h t val e hp, bind, Except.bind, pure, Except.pure]
            have hs2 := «согласны-префикс» hs _ e («звено-соответствуют» σ res n tt val hn ht h t e hp)
            rw [List.append_assoc] at hs2
            exact «обход-верен» P σ M b _ (e ++ γ) n res k y m v R hy hs2 hv' hM hk
end

structure «Условие входа» where
  «код» : String
  «выражение» : «Выр»

def «проверитьВход» (P : «Программа») (N : Nat) (ρ : «Среда») : List «Условие входа» → Option «Исход»
  | [] => none
  | q :: r =>
    match «выч» P N ρ q.«выражение» with
    | .ok (.«признак» true) => «проверитьВход» P N ρ r
    | .ok (.«признак» false) => some («беда» q.«код»)
    | .ok _ => some («беда» "FLANG_TYPE")
    | .error e => some (.error e)

def «обходПост» (ρ : List (String × «Терм»)) (t : «Терм») : Nat → List «Постусловие» → Option «Дерево»
  | _, [] => some (.«лист» t)
  | n, q :: r =>
    «обход» ((q.«связка», t) :: ρ) n (fun c n1 =>
      match «обходПост» ρ t n1 r with
      | some a => some (.«если» c a (.«отказ» q.«код»))
      | none => none) q.«выражение»

def «обходВхода» (ρ : List (String × «Терм»)) (kb : Nat → Option «Дерево») :
    Nat → List «Условие входа» → Option «Дерево»
  | n, [] => kb n
  | n, q :: r =>
    «обход» ρ n (fun c n1 =>
      match «обходВхода» ρ kb n1 r with
      | some a => some (.«если» c a (.«отказ» q.«код»))
      | none => none) q.«выражение»

def «деревоФункции» (pres : List «Условие входа») (g : «Функция») (qs : List «Постусловие») : Option «Дерево» :=
  let ρ := g.«параметры».map (fun p => (p, «Терм».«имя» p))
  «обходВхода» ρ (fun n => «обход» ρ n (fun t n1 => «обходПост» ρ t n1 qs) g.«тело») 0 pres

def «исходСПостами» (P : «Программа») (N : Nat) (pres : List «Условие входа») (g : «Функция»)
    (qs : List «Постусловие») (vs : List «Зн») : «Исход» :=
  match «проверитьВход» P N («привязать» g.«параметры» vs) pres with
  | some r => r
  | none =>
    match N with
    | 0 => .error .«топливо»
    | N' + 1 => do
      let v ← «выч» P N' («привязать» g.«параметры» vs) g.«тело»
      «проверитьПост» («выч» P N') («привязать» g.«параметры» vs) v qs

def «исходЭталона» (P : «Программа») (N : Nat) (pres : List «Условие входа») (g : «Функция»)
    (vs : List «Зн») : «Исход» :=
  match «проверитьВход» P N («привязать» g.«параметры» vs) pres with
  | some r => r
  | none => «выч» P N [] (.«вызов» g.«имя» (vs.map .«лит»))

theorem «обходПост-верен» (P : «Программа») (σ : «Среда») (M m : Nat) (hm : m ≤ M) (γ : «Среда»)
    (v : «Зн») : ∀ (posts : List «Постусловие») (ρ : List (String × «Терм»)) (t : «Терм») (n : Nat)
      (res : «Итоги») (d : «Дерево»),
      «обходПост» ρ t n posts = some d → «Согласны» σ res n ρ γ → «Ниже» n t → «значТерм» σ res t = .ok v →
      (∀ q, q ∈ posts → ∃ b, «выч» P m ((q.«связка», v) :: γ) q.«выражение» = .ok (.«признак» b)) →
      «значДерева» P M σ res d = «проверитьПост» («выч» P m) γ v posts
  | [], ρ, t, n, res, d, hd, _, _, ht, _ => by
    simp only [«обходПост»] at hd
    cases hd
    simp only [«значДерева», ht, «проверитьПост»]
  | q :: r, ρ, t, n, res, d, hd, hs, hn, ht, hq => by
    obtain ⟨b, hb⟩ := hq q (by simp)
    simp only [«обходПост»] at hd
    refine «обход-верен» P σ M q.«выражение» ((q.«связка», t) :: ρ) ((q.«связка», v) :: γ) n res _ d m
      (.«признак» b) _ hd («согласны-шире» hs q.«связка» t v hn ht) hb hm ?_
    intro c n1 d1 res1 hd1 hn1 hc he1 hcv
    cases ha : «обходПост» ρ t n1 r with
    | none => simp [ha] at hd1
    | some a =>
      simp only [ha] at hd1
      cases hd1
      have ht1 : «значТерм» σ res1 t = .ok v := by rw [«терм-расширение» σ he1 t hn]; exact ht
      have ih := «обходПост-верен» P σ M m hm γ v r ρ t n1 res1 a ha («согласны-дальше» hs hn1 he1)
        («ниже-выше» hn1 t hn) ht1 (fun q' hq' => hq q' (by simp [hq']))
      cases b with
      | true => simp only [«значДерева», hcv, bind, Except.bind, «проверитьПост», hb, ih]
      | false => simp only [«значДерева», hcv, bind, Except.bind, «проверитьПост», hb]

theorem «обходВхода-верен» (P : «Программа») (σ : «Среда») (M N : Nat) (hN : N ≤ M) (γ : «Среда»)
    (kb : Nat → Option «Дерево») (R : «Исход») :
    ∀ (pres : List «Условие входа») (ρ : List (String × «Терм»)) (n : Nat) (res : «Итоги») (d : «Дерево»),
      «обходВхода» ρ kb n pres = some d → «Согласны» σ res n ρ γ →
      (∀ q, q ∈ pres → ∃ b, «выч» P N γ q.«выражение» = .ok (.«признак» b)) →
      («проверитьВход» P N γ pres = none →
        ∀ n1 d' res', kb n1 = some d' → n ≤ n1 → «Расширяет» res' res n → «значДерева» P M σ res' d' = R) →
      «значДерева» P M σ res d = (match «проверитьВход» P N γ pres with
        | some r => r
        | none => R)
  | [], ρ, n, res, d, hd, _, _, hk => by
    simp only [«обходВхода»] at hd
    simp only [«проверитьВход»]
    exact hk rfl n d res hd (Nat.le_refl n) («расширяет-сам» res n)
  | q :: r, ρ, n, res, d, hd, hs, hq, hk => by
    obtain ⟨b, hb⟩ := hq q (by simp)
    simp only [«обходВхода»] at hd
    refine «обход-верен» P σ M q.«выражение» ρ γ n res _ d N (.«признак» b) _ hd hs hb hN ?_
    intro c n1 d1 res1 hd1 hn1 hc he1 hcv
    cases ha : «обходВхода» ρ kb n1 r with
    | none => simp [ha] at hd1
    | some a =>
      simp only [ha] at hd1
      cases hd1
      cases b with
      | true =>
        have ih := «обходВхода-верен» P σ M N hN γ kb R r ρ n1 res1 a ha («согласны-дальше» hs hn1 he1)
          (fun q' hq' => hq q' (by simp [hq']))
          (fun hnone n2 d' res' h1 h2 h3 => hk (by simp [«проверитьВход», hb, hnone]) n2 d' res' h1 (by omega)
            («расширяет-цепь» hn1 h3 he1))
        simp only [«значДерева», hcv, bind, Except.bind, «проверитьВход», hb, ih]
      | false => simp only [«значДерева», hcv, bind, Except.bind, «проверитьВход», hb]

theorem «найти-имена» (x : String) : ∀ (ps : List String) (t : «Терм»),
    «найти» x (ps.map (fun p => (p, «Терм».«имя» p))) = some t → t = .«имя» x ∧ x ∈ ps
  | [], t, h => by simp [«найти»] at h
  | p :: ps, t, h => by
    simp only [List.map, «найти»] at h
    split at h
    · rename_i hp
      simp only [Option.some.injEq] at h
      subst hp; subst h
      exact ⟨rfl, by simp⟩
    · obtain ⟨h1, h2⟩ := «найти-имена» x ps t h
      exact ⟨h1, by simp [h2]⟩

theorem «найти-привязка» (x : String) : ∀ (ps : List String) (vs : List «Зн»), ps.length = vs.length →
    x ∈ ps → ∃ w, «найти» x («привязать» ps vs) = some w
  | [], _, _, h => by simp at h
  | p :: ps, w :: ws, hl, h => by
    by_cases hp : p = x
    · exact ⟨w, by simp [«привязать», «найти», hp]⟩
    · have hx : x ∈ ps := by
        rcases List.mem_cons.mp h with h | h
        · exact absurd h.symm hp
        · exact h
      obtain ⟨w', hw⟩ := «найти-привязка» x ps ws (by simpa using hl) hx
      exact ⟨w', by simpa [«привязать», «найти», hp] using hw⟩
  | _ :: _, [], hl, _ => by simp at hl

theorem «согласны-параметры» (ps : List String) (vs : List «Зн») (hl : ps.length = vs.length) :
    «Согласны» («привязать» ps vs) [] 0 (ps.map (fun p => (p, «Терм».«имя» p))) («привязать» ps vs) := by
  intro x t hx
  obtain ⟨rfl, hm⟩ := «найти-имена» x ps t hx
  obtain ⟨w, hw⟩ := «найти-привязка» x ps vs hl hm
  exact ⟨trivial, w, hw, by simp [«значТерм», hw]⟩

theorem «дерево-функции-верно» (P : «Программа») (N : Nat) (pres : List «Условие входа») (g : «Функция»)
    (qs : List «Постусловие») (vs : List «Зн») (d : «Дерево») (hd : «деревоФункции» pres g qs = some d)
    (hl : g.«параметры».length = vs.length)
    (hpre : ∀ q, q ∈ pres → ∃ b, «выч» P N («привязать» g.«параметры» vs) q.«выражение» = .ok (.«признак» b))
    (hrun : «проверитьВход» P N («привязать» g.«параметры» vs) pres = none →
      ∃ N' v, N = N' + 1 ∧ «выч» P N' («привязать» g.«параметры» vs) g.«тело» = .ok v ∧
        ∀ q, q ∈ qs → ∃ b,
          «выч» P N' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok (.«признак» b)) :
    «значДерева» P N («привязать» g.«параметры» vs) [] d = «исходСПостами» P N pres g qs vs := by
  let σ := «привязать» g.«параметры» vs
  let ρ := g.«параметры».map (fun p => (p, «Терм».«имя» p))
  have hs : «Согласны» σ [] 0 ρ σ := «согласны-параметры» g.«параметры» vs hl
  unfold «исходСПостами»
  cases hc : «проверитьВход» P N σ pres with
  | some r =>
    have := «обходВхода-верен» P σ N N (Nat.le_refl N) σ _ (.error .«топливо») pres ρ 0 [] d hd hs hpre
      (fun hnone => by rw [hc] at hnone; cases hnone)
    rw [hc] at this
    exact this
  | none =>
    obtain ⟨N', v, rfl, hb, hpost⟩ := hrun hc
    simp only [hb, bind, Except.bind]
    have := «обходВхода-верен» P σ (N' + 1) (N' + 1) (Nat.le_refl _) σ _
      («проверитьПост» («выч» P N') σ v qs) pres ρ 0 [] d hd hs hpre ?_
    · rw [hc] at this; exact this
    · intro _ n1 d' res' h1 _ he
      refine «обход-верен» P σ (N' + 1) g.«тело» ρ σ n1 res' _ d' N' v _ h1
        («согласны-дальше» hs (Nat.zero_le _) he) hb (by omega) ?_
      intro t n2 d2 res2 hd2 hn2 ht he2 htv
      exact «обходПост-верен» P σ (N' + 1) N' (by omega) σ v qs ρ t n2 res2 d2 hd2
        («согласны-дальше» («согласны-дальше» hs (Nat.zero_le _) he) hn2 he2) ht htv hpost

theorem «исход-с-постами-функции» (P : «Программа») (N : Nat) (pres : List «Условие входа») (g : «Функция»)
    (vs : List «Зн») (hl : g.«параметры».length = vs.length) (hg : «функцияПрограммы» P g.«имя» = some g)
    (hN : 1 < N ∨ vs = []) :
    «исходСПостами» P N pres g g.«постусловия» vs = «исходЭталона» P N pres g vs := by
  unfold «исходСПостами» «исходЭталона»
  cases hc : «проверитьВход» P N («привязать» g.«параметры» vs) pres with
  | some r => rfl
  | none =>
    cases N with
    | zero => rfl
    | succ N' =>
      have hlit : «вычВсе» («выч» P N') [] (vs.map .«лит») = .ok vs := by
        rcases hN with hN | hN
        · exact «вычВсе-литералы» P N' [] vs (by omega)
        · subst hN; rfl
      show _ = «шаг» P («выч» P N') [] (.«вызов» g.«имя» (vs.map .«лит»))
      simp only [«шаг»]
      rw [hlit]
      simp only [bind, Except.bind, hg, hl, ite_true, «вызватьТело»]

end «Эталон»
