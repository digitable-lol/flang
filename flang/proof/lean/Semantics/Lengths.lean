import Semantics.Cases
import Semantics.Ceiling

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

namespace «Эталон»

open «Д64»

theorem «изЦелого-нат» (n : Nat) (h : n ≤ 2 ^ 53) : «изЦелого» n = .«кон» false (n * _root_.«шаг») := by
  unfold «изЦелого» «изЗнач»
  have hs := _root_.«шаг-полож»
  by_cases hn : n = 0
  · subst hn; simp
  · have h1 : ((n : Int) * (_root_.«шаг» : Int)) ≠ 0 := Int.mul_ne_zero (by exact_mod_cast hn) (by omega)
    have h2 : ¬ ((n : Int) * (_root_.«шаг» : Int) < 0) := by
      have : (0 : Int) ≤ (n : Int) * (_root_.«шаг» : Int) := Int.mul_nonneg (by omega) (by omega)
      omega
    have h3 : ((n : Int) * (_root_.«шаг» : Int)).natAbs = n * _root_.«шаг» := by
      rw [Int.natAbs_mul]; simp
    simp only [h1, h2, ↓reduceIte, decide_false, h3, «округлить», «шаг-сетка» h]
    have h4 := «шаг-запас» h
    simp only [Nat.not_le.mpr h4, ↓reduceIte]

theorem «изЦелого-инъективно» {a b : Nat} (ha : a ≤ 2 ^ 53) (hb : b ≤ 2 ^ 53)
    (h : «изЦелого» a = «изЦелого» b) : a = b := by
  rw [«изЦелого-нат» a ha, «изЦелого-нат» b hb] at h
  simp only [«Д64».«кон».injEq, true_and] at h
  exact Nat.eq_of_mul_eq_mul_right _root_.«шаг-полож» h

theorem «изЦелого-ниже» {k n : Nat} (hn : n < 2 ^ 53) (h : «изЦелого» k = «изЦелого» n) : k = n := by
  by_cases hk : k ≤ 2 ^ 53
  · exact «изЦелого-инъективно» hk (Nat.le_of_lt hn) h
  · have hm := «целые-моно» (a := 2 ^ 53) (b := k) (by omega)
    rw [h, «изЦелого-нат» n (Nat.le_of_lt hn), «изЦелого-нат» (2 ^ 53) (Nat.le_refl _)] at hm
    simp only [«неБольше64», «вЕдиницах», Bool.false_eq_true, ↓reduceIte, decide_eq_true_eq] at hm
    have : 2 ^ 53 * _root_.«шаг» ≤ n * _root_.«шаг» := by exact_mod_cast hm
    have := Nat.le_of_mul_le_mul_right this _root_.«шаг-полож»
    omega

theorem «плюс-целых» (a b : Nat) (h : a + b ≤ 2 ^ 53) :
    «плюс64» («изЦелого» a) («изЦелого» b) = «изЦелого» (a + b) := by
  rw [«изЦелого-нат» a (by omega), «изЦелого-нат» b (by omega)]
  simp only [«плюс64», «вЕдиницах», Bool.false_eq_true, ↓reduceIte, Bool.and_self, «изЦелого»]
  congr 1
  push_cast
  rw [Int.add_mul]

theorem «сложение-чисел» (a b : Nat) (h : a + b ≤ 2 ^ 53) :
    «двучлен» "add" (.«число» («изЦелого» a)) (.«число» («изЦелого» b)) = .ok (.«число» («изЦелого» (a + b))) := by
  simp [«двучлен», «точно?», «разряды?», «дробь?», «счёт64», «плюс-целых» a b h]

def «литНат?» : «Д64» → Option Nat
  | .«кон» false v => if v % _root_.«шаг» = 0 ∧ v / _root_.«шаг» ≤ 2 ^ 53 then some (v / _root_.«шаг») else none
  | _ => none

theorem «литНат-верно» {d : «Д64»} {c : Nat} (h : «литНат?» d = some c) : d = «изЦелого» c ∧ c ≤ 2 ^ 53 := by
  unfold «литНат?» at h
  split at h
  · rename_i v
    split at h
    · rename_i hv
      simp only [Option.some.injEq] at h
      subst h
      refine ⟨?_, hv.2⟩
      rw [«изЦелого-нат» _ hv.2, Nat.div_mul_cancel (Nat.dvd_of_mod_eq_zero hv.1)]
    · cases h
  · cases h

def «предел48» : Nat := 2 ^ 48

mutual
def «короткое» : «Зн» → Bool
  | .«строка» s => decide (s.length < «предел48»)
  | .«список» l => decide (l.length < «предел48») && «короткиеВсе» l
  | _ => true
def «короткиеВсе» : List «Зн» → Bool
  | [] => true
  | v :: r => «короткое» v && «короткиеВсе» r
end

theorem «короткиеВсе-член» : ∀ {l : List «Зн»} {v : «Зн»}, «короткиеВсе» l = true → v ∈ l → «короткое» v = true
  | [], _, _, hm => by cases hm
  | x :: r, v, h, hm => by
    simp only [«короткиеВсе», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hm with he | hm
    · subst he; exact h.1
    · exact «короткиеВсе-член» h.2 hm

theorem «короткое-длина» {v : «Зн»} {k : Nat} (h : «короткое» v = true) (hk : «длинаЗн» v = some k) :
    k < «предел48» := by
  cases v with
  | «строка» s =>
    simp only [«длинаЗн», Option.some.injEq] at hk; subst hk
    simpa [«короткое»] using h
  | «список» l =>
    simp only [«длинаЗн», Option.some.injEq] at hk; subst hk
    simp only [«короткое», Bool.and_eq_true, decide_eq_true_eq] at h
    exact h.1
  | _ => simp [«длинаЗн»] at hk

def «КороткаСреда» (σ : «Среда») : Prop := ∀ x v, «найти» x σ = some v → «короткое» v = true

theorem «привязать-коротка» : ∀ (ps : List String) (vs : List «Зн»), «короткиеВсе» vs = true →
    «КороткаСреда» («привязать» ps vs)
  | [], _, _ => by intro x v h; simp [«привязать», «найти»] at h
  | _ :: _, [], _ => by intro x v h; simp [«привязать», «найти»] at h
  | p :: ps, u :: us, h => by
    intro x v hv
    simp only [«короткиеВсе», Bool.and_eq_true] at h
    simp only [«привязать», List.zip_cons_cons, «найти»] at hv
    split at hv
    · simp only [Option.some.injEq] at hv; subst hv; exact h.1
    · exact «привязать-коротка» ps us h.2 x v hv

def «атом?» : «Терм» → Bool
  | .«имя» _ => true
  | .«голова» t => «атом?» t
  | .«хвост» t => «атом?» t
  | _ => false

theorem «атом-короток» {σ : «Среда»} (hσ : «КороткаСреда» σ) (res : «Итоги») :
    ∀ (t : «Терм») (v : «Зн»), «атом?» t = true → «значТерм» σ res t = .ok v → «короткое» v = true
  | .«имя» x, v, _, hv => by
    simp only [«значТерм»] at hv
    cases hf : «найти» x σ with
    | none => rw [hf] at hv; cases hv
    | some w =>
      rw [hf] at hv
      cases hv
      exact hσ x _ hf
  | .«голова» t, v, ha, hv => by
    simp only [«атом?»] at ha
    simp only [«значТерм»] at hv
    cases ht : «значТерм» σ res t with
    | error q => rw [ht] at hv; cases hv
    | ok x =>
      rw [ht] at hv
      simp only [bind, Except.bind] at hv
      have hx := «атом-короток» hσ res t x ha ht
      cases x with
      | «строка» s =>
        simp only [«головаЗн»] at hv
        split at hv
        · rename_i c r _
          cases hv
          simp [«короткое», «предел48»]
        · cases hv
      | «список» l =>
        cases l with
        | nil => simp [«головаЗн», «беда»] at hv
        | cons y r =>
          simp only [«головаЗн», Except.ok.injEq] at hv
          subst hv
          simp only [«короткое», Bool.and_eq_true] at hx
          exact «короткиеВсе-член» hx.2 List.mem_cons_self
      | _ => simp [«головаЗн», «беда»] at hv
  | .«хвост» t, v, ha, hv => by
    simp only [«атом?»] at ha
    simp only [«значТерм»] at hv
    cases ht : «значТерм» σ res t with
    | error q => rw [ht] at hv; cases hv
    | ok x =>
      rw [ht] at hv
      simp only [bind, Except.bind] at hv
      have hx := «атом-короток» hσ res t x ha ht
      cases x with
      | «строка» s =>
        simp only [«хвостЗн»] at hv
        split at hv
        · rename_i c r hs
          cases hv
          simp only [«короткое», decide_eq_true_eq] at hx ⊢
          have : s.length = r.length + 1 := by
            rw [← String.length_toList, hs]; simp
          simp only [String.length_ofList]
          omega
        · cases hv
      | «список» l =>
        cases l with
        | nil => simp [«хвостЗн», «беда»] at hv
        | cons y r =>
          simp only [«хвостЗн», Except.ok.injEq] at hv
          subst hv
          simp only [«короткое», Bool.and_eq_true, decide_eq_true_eq, «короткиеВсе», List.length_cons] at hx ⊢
          exact ⟨by omega, hx.2.2⟩
      | _ => simp [«хвостЗн», «беда»] at hv
  | .«знач» _, _, ha, _ => by simp [«атом?»] at ha
  | .«рез» _, _, ha, _ => by simp [«атом?»] at ha
  | .«двучлен» _ _ _, _, ha, _ => by simp [«атом?»] at ha
  | .«вариант?» _ _, _, ha, _ => by simp [«атом?»] at ha
  | .«пусто?» _, _, ha, _ => by simp [«атом?»] at ha
  | .«звено?» _, _, ha, _ => by simp [«атом?»] at ha
  | .«поле» _ _, _, ha, _ => by simp [«атом?»] at ha
  | .«список» _, _, ha, _ => by simp [«атом?»] at ha

def «сложить» : Option Nat → Option Nat → Option Nat
  | some a, some b => some (a + b)
  | _, _ => none

theorem «сложить-перест» (a b c : Option Nat) : «сложить» a («сложить» b c) = «сложить» b («сложить» a c) := by
  cases a <;> cases b <;> cases c <;> simp [«сложить»] <;> omega

def «длинаТерма» (σ : «Среда») (res : «Итоги») (t : «Терм») : Option Nat :=
  match «значТерм» σ res t with
  | .ok v => «длинаЗн» v
  | .error _ => none

def «суммаДлин» (σ : «Среда») (res : «Итоги») : List «Терм» → Option Nat
  | [] => some 0
  | t :: r => «сложить» («длинаТерма» σ res t) («суммаДлин» σ res r)

theorem «суммаДлин-склейка» (σ : «Среда») (res : «Итоги») :
    ∀ (A B : List «Терм»), «суммаДлин» σ res (A ++ B) = «сложить» («суммаДлин» σ res A) («суммаДлин» σ res B)
  | [], B => by cases h : «суммаДлин» σ res B <;> simp [«суммаДлин», «сложить», h]
  | t :: r, B => by
    simp only [List.cons_append, «суммаДлин», «суммаДлин-склейка» σ res r B]
    cases «длинаТерма» σ res t <;> cases «суммаДлин» σ res r <;> cases «суммаДлин» σ res B <;>
      simp [«сложить»] <;> omega

def «снять» (t : «Терм») : List «Терм» → Option (List «Терм»)
  | [] => none
  | u :: r => if «равноТерм» t u then some r else («снять» t r).map (u :: ·)

theorem «снять-сумма» (σ : «Среда») (res : «Итоги») (t : «Терм») :
    ∀ (B B' : List «Терм»), «снять» t B = some B' →
      «суммаДлин» σ res B = «сложить» («длинаТерма» σ res t) («суммаДлин» σ res B')
  | [], _, h => by simp [«снять»] at h
  | u :: r, B', h => by
    simp only [«снять»] at h
    split at h
    · rename_i he
      have := «равноТерм-верно» _ _ he
      subst this
      simp only [Option.some.injEq] at h
      subst h
      rfl
    · cases hr : «снять» t r with
      | none => rw [hr] at h; cases h
      | some r' =>
        rw [hr] at h
        simp only [Option.map_some, Option.some.injEq] at h
        subst h
        simp only [«суммаДлин», «снять-сумма» σ res t r r' hr]
        exact «сложить-перест» _ _ _

def «равныАтомы» : List «Терм» → List «Терм» → Bool
  | [], B => B.isEmpty
  | t :: r, B =>
    match «снять» t B with
    | some B' => «равныАтомы» r B'
    | none => false

theorem «равныАтомы-сумма» (σ : «Среда») (res : «Итоги») :
    ∀ (A B : List «Терм»), «равныАтомы» A B = true → «суммаДлин» σ res A = «суммаДлин» σ res B
  | [], B, h => by
    simp only [«равныАтомы», List.isEmpty_iff] at h
    subst h; rfl
  | t :: r, B, h => by
    simp only [«равныАтомы»] at h
    split at h
    · rename_i B' hB
      rw [«снять-сумма» σ res t B B' hB]
      simp only [«суммаДлин», «равныАтомы-сумма» σ res r B' h]
    · cases h

theorem «сумма-коротка» {σ : «Среда»} (hσ : «КороткаСреда» σ) (res : «Итоги») :
    ∀ (A : List «Терм») (a : Nat), A.all «атом?» = true → «суммаДлин» σ res A = some a → a ≤ A.length * «предел48»
  | [], a, _, h => by simp [«суммаДлин»] at h; omega
  | t :: r, a, hA, h => by
    simp only [List.all_cons, Bool.and_eq_true] at hA
    simp only [«суммаДлин»] at h
    cases ht : «длинаТерма» σ res t with
    | none => rw [ht] at h; simp [«сложить»] at h
    | some x =>
      cases hr : «суммаДлин» σ res r with
      | none => rw [ht, hr] at h; simp [«сложить»] at h
      | some y =>
        rw [ht, hr] at h
        simp only [«сложить», Option.some.injEq] at h
        subst h
        have hy := «сумма-коротка» hσ res r y hA.2 hr
        unfold «длинаТерма» at ht
        cases hv : «значТерм» σ res t with
        | error q => rw [hv] at ht; cases ht
        | ok v =>
          rw [hv] at ht
          have hx := «короткое-длина» («атом-короток» hσ res t v hA.1 hv) ht
          simp only [List.length_cons, Nat.add_mul, Nat.one_mul]
          omega

def «ПостусловияВызовов» (P : «Программа») : Prop :=
  ∀ (M : Nat) (f : String) (vs : List «Зн») (w : «Зн») (g : «Функция»),
    «выч» P M [] (.«вызов» f (vs.map .«лит»)) = .ok w → «функцияПрограммы» P f = some g →
    ∀ q ∈ g.«постусловия», ∃ m, «выч» P m ((q.«связка», w) :: «привязать» g.«параметры» vs) q.«выражение» =
      .ok (.«признак» true)

theorem «проверитьПост-все» (r : «Среда» → «Выр» → «Исход») (ρ : «Среда») (v : «Зн») :
    ∀ (qs : List «Постусловие») (u : «Зн»), «проверитьПост» r ρ v qs = .ok u →
      ∀ q ∈ qs, r ((q.«связка», v) :: ρ) q.«выражение» = .ok (.«признак» true)
  | [], _, _ => by intro q hq; cases hq
  | q0 :: t, u, h => by
    simp only [«проверитьПост»] at h
    cases hc : r ((q0.«связка», v) :: ρ) q0.«выражение» with
    | error e => rw [hc] at h; cases h
    | ok c =>
      rw [hc] at h
      simp only [bind, Except.bind] at h
      cases c with
      | «признак» b =>
        cases b with
        | true =>
          intro q hq
          rcases List.mem_cons.mp hq with he | hq
          · subst he; exact hc
          · exact «проверитьПост-все» r ρ v t u h q hq
        | false => simp [«беда»] at h
      | _ => simp [«беда»] at h

theorem «эталон-проверяет-постусловия» (P : «Программа») : «ПостусловияВызовов» P := by
  intro M f vs w g h hg q hq
  cases M with
  | zero => cases h
  | succ M' =>
    have e : «выч» P (M' + 1) [] (.«вызов» f (vs.map .«лит»)) =
        «шаг» P («выч» P M') [] (.«вызов» f (vs.map .«лит»)) := rfl
    rw [e] at h
    simp only [«шаг»] at h
    cases hl : «вычВсе» («выч» P M') [] (vs.map .«лит») with
    | error e => rw [hl] at h; cases h
    | ok vs' =>
      have := «вычВсе-лит» P M' [] vs vs' hl
      subst this
      rw [hl] at h
      simp only [bind, Except.bind, hg] at h
      by_cases hlen : g.«параметры».length = vs'.length
      · simp only [hlen, ↓reduceIte, «вызватьТело»] at h
        cases hb : «выч» P M' («привязать» g.«параметры» vs') g.«тело» with
        | error e => rw [hb] at h; cases h
        | ok v =>
          rw [hb] at h
          simp only [bind, Except.bind] at h
          have hw := «пост-сохраняет» _ _ v _ w h
          subst hw
          exact ⟨M', «проверитьПост-все» _ _ _ _ _ h q hq⟩
      · simp only [hlen, ↓reduceIte] at h
        cases h

def «линВыр?» (x : String) : «Выр» → Option (Nat × List String)
  | .«лит» v =>
    match v with
    | .«число» d => («литНат?» d).map (fun c => (c, []))
    | _ => none
  | .«форма» n args =>
    if n = "длина" then
      match args with
      | [.«имя» p] => if p = x then none else some (0, [p])
      | _ => none
    else none
  | .«двучлен» op a b =>
    if op = "add" then
      match «линВыр?» x a, «линВыр?» x b with
      | some (c1, l1), some (c2, l2) => some (c1 + c2, l1 ++ l2)
      | _, _ => none
    else none
  | _ => none

def «суммаИмён» (ρ : «Среда») : List String → Option Nat
  | [] => some 0
  | p :: r => «сложить» ((«найти» p ρ).bind «длинаЗн») («суммаИмён» ρ r)

theorem «суммаИмён-склейка» (ρ : «Среда») :
    ∀ (A B : List String), «суммаИмён» ρ (A ++ B) = «сложить» («суммаИмён» ρ A) («суммаИмён» ρ B)
  | [], B => by cases h : «суммаИмён» ρ B <;> simp [«суммаИмён», «сложить», h]
  | p :: r, B => by
    simp only [List.cons_append, «суммаИмён», «суммаИмён-склейка» ρ r B]
    cases ((«найти» p ρ).bind «длинаЗн») <;> cases «суммаИмён» ρ r <;> cases «суммаИмён» ρ B <;>
      simp [«сложить»] <;> omega

theorem «форма-длина» (v : «Зн») (k : Nat) (hk : «длинаЗн» v = some k) :
    «форма» "длина" [v] = .ok (.«число» («изЦелого» k)) := by
  cases v with
  | «строка» s => simp only [«длинаЗн», Option.some.injEq] at hk; subst hk; simp [«форма»]
  | «список» l => simp only [«длинаЗн», Option.some.injEq] at hk; subst hk; simp [«форма»]
  | _ => simp [«длинаЗн»] at hk

theorem «форма-длина-обратно» (v u : «Зн») (h : «форма» "длина" [v] = .ok u) :
    ∃ k, «длинаЗн» v = some k ∧ u = .«число» («изЦелого» k) := by
  cases v with
  | «строка» s => simp [«форма»] at h; exact ⟨s.length, rfl, h.symm⟩
  | «список» l => simp [«форма»] at h; exact ⟨l.length, rfl, h.symm⟩
  | _ => simp [«форма», «беда»] at h

theorem «линВыр-верно» (P : «Программа») (x : String) (w : «Зн») (ρ : «Среда») :
    ∀ (R : «Выр») (m c : Nat) (ns : List String) (u : «Зн»), «линВыр?» x R = some (c, ns) →
      «выч» P m ((x, w) :: ρ) R = .ok u →
      ∃ a, «суммаИмён» ρ ns = some a ∧ (c + a ≤ 2 ^ 53 → u = .«число» («изЦелого» (c + a)))
  | .«лит» v, m, c, ns, u, h, hv => by
    cases v with
    | «число» d =>
      simp only [«линВыр?»] at h
      cases hd : «литНат?» d with
      | none => rw [hd] at h; cases h
      | some c' =>
        rw [hd] at h
        simp only [Option.map_some, Option.some.injEq, Prod.mk.injEq] at h
        obtain ⟨rfl, rfl⟩ := h
        cases m with
        | zero => cases hv
        | succ m =>
          have e : «выч» P (m + 1) ((x, w) :: ρ) (.«лит» (.«число» d)) = .ok (.«число» d) := rfl
          rw [e] at hv
          cases hv
          refine ⟨0, rfl, fun _ => ?_⟩
          rw [(«литНат-верно» hd).1]
          simp
    | _ => simp [«линВыр?»] at h
  | .«форма» n args, m, c, ns, u, h, hv => by
    simp only [«линВыр?»] at h
    split at h
    · rename_i hn
      subst hn
      split at h
      · rename_i p
        split at h
        · cases h
        · rename_i hp
          simp only [Option.some.injEq, Prod.mk.injEq] at h
          obtain ⟨rfl, rfl⟩ := h
          cases m with
          | zero => cases hv
          | succ m =>
            have e : «выч» P (m + 1) ((x, w) :: ρ) (.«форма» "длина" [.«имя» p]) =
                «шаг» P («выч» P m) ((x, w) :: ρ) (.«форма» "длина" [.«имя» p]) := rfl
            rw [e] at hv
            simp only [«шаг», «вычВсе»] at hv
            cases m with
            | zero => simp [«выч», bind, Except.bind] at hv
            | succ m =>
              have e2 : «выч» P (m + 1) ((x, w) :: ρ) (.«имя» p) = «шаг» P («выч» P m) ((x, w) :: ρ) (.«имя» p) := rfl
              rw [e2] at hv
              simp only [«шаг», «найти»] at hv
              have hpx : ¬ (x = p) := fun e => hp e.symm
              simp only [hpx, ↓reduceIte] at hv
              cases hf : «найти» p ρ with
              | none => rw [hf] at hv; simp [«беда», bind, Except.bind] at hv
              | some y =>
                rw [hf] at hv
                simp only [bind, Except.bind, pure, Except.pure] at hv
                obtain ⟨k, hk, hu⟩ := «форма-длина-обратно» y u hv
                refine ⟨k, ?_, fun _ => by rw [hu]; simp⟩
                simp [«суммаИмён», hf, hk, «сложить»]
      · cases h
    · cases h
  | .«двучлен» op a b, m, c, ns, u, h, hv => by
    simp only [«линВыр?»] at h
    split at h
    · rename_i hop
      subst hop
      cases ha : «линВыр?» x a with
      | none => rw [ha] at h; cases h
      | some p1 =>
        cases hb : «линВыр?» x b with
        | none => rw [ha, hb] at h; cases h
        | some p2 =>
          obtain ⟨c1, l1⟩ := p1
          obtain ⟨c2, l2⟩ := p2
          rw [ha, hb] at h
          simp only [Option.some.injEq, Prod.mk.injEq] at h
          obtain ⟨rfl, rfl⟩ := h
          cases m with
          | zero => cases hv
          | succ m =>
            have e : «выч» P (m + 1) ((x, w) :: ρ) (.«двучлен» "add" a b) =
                «шаг» P («выч» P m) ((x, w) :: ρ) (.«двучлен» "add" a b) := rfl
            rw [e] at hv
            simp only [«шаг»] at hv
            cases hx : «выч» P m ((x, w) :: ρ) a with
            | error q => rw [hx] at hv; cases hv
            | ok xv =>
              cases hy : «выч» P m ((x, w) :: ρ) b with
              | error q => rw [hx, hy] at hv; cases hv
              | ok yv =>
                rw [hx, hy] at hv
                simp only [bind, Except.bind] at hv
                obtain ⟨a1, h1, k1⟩ := «линВыр-верно» P x w ρ a m c1 l1 xv ha hx
                obtain ⟨a2, h2, k2⟩ := «линВыр-верно» P x w ρ b m c2 l2 yv hb hy
                refine ⟨a1 + a2, by rw [«суммаИмён-склейка», h1, h2]; rfl, fun hle => ?_⟩
                have hs := «сложение-чисел» (c1 + a1) (c2 + a2) (by omega)
                push_cast at hs
                rw [k1 (by omega), k2 (by omega), hs] at hv
                cases hv
                congr 2
                push_cast
                omega
    · cases h
  | .«имя» _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«если» _ _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«пусть» _ _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«вызов» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«разбор» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«свёртка» _ _ _ _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«отобразить» _ _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«отфильтровать» _ _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«список» _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«запись» _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«конструктор» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«поле» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«ссылка» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h
  | .«применить» _ _, _, _, _, _, h, _ => by simp [«линВыр?»] at h

def «постДлины?» : List «Постусловие» → Option («Постусловие» × Nat × List String)
  | [] => none
  | q :: r =>
    match q.«выражение» with
    | .«двучлен» op (.«форма» n [.«имя» y]) R =>
      if op = "eq" ∧ n = "длина" ∧ y = q.«связка» then
        match «линВыр?» q.«связка» R with
        | some cl => some (q, cl)
        | none => «постДлины?» r
      else «постДлины?» r
    | _ => «постДлины?» r

theorem «постДлины-вид» : ∀ {qs : List «Постусловие»} {q : «Постусловие»} {c : Nat} {ns : List String},
    «постДлины?» qs = some (q, c, ns) → q ∈ qs ∧ ∃ R, q.«выражение» =
      .«двучлен» "eq" (.«форма» "длина" [.«имя» q.«связка»]) R ∧ «линВыр?» q.«связка» R = some (c, ns)
  | [], _, _, _, h => by simp [«постДлины?»] at h
  | q0 :: r, q, c, ns, h => by
    simp only [«постДлины?»] at h
    split at h
    · rename_i op n y R he
      split at h
      · rename_i hc
        obtain ⟨rfl, rfl, rfl⟩ := hc
        split at h
        · rename_i cl hl
          simp only [Option.some.injEq, Prod.mk.injEq] at h
          obtain ⟨rfl, rfl⟩ := h
          exact ⟨List.mem_cons_self, R, he, hl⟩
        · obtain ⟨hm, rest⟩ := «постДлины-вид» h
          exact ⟨List.mem_cons_of_mem _ hm, rest⟩
      · obtain ⟨hm, rest⟩ := «постДлины-вид» h
        exact ⟨List.mem_cons_of_mem _ hm, rest⟩
    · obtain ⟨hm, rest⟩ := «постДлины-вид» h
      exact ⟨List.mem_cons_of_mem _ hm, rest⟩

theorem «пост-длины-значение» (P : «Программа») (m : Nat) (y : String) (w : «Зн») (ρ : «Среда») (R : «Выр»)
    (k c : Nat) (ns : List String)
    (h : «выч» P m ((y, w) :: ρ) (.«двучлен» "eq" (.«форма» "длина" [.«имя» y]) R) = .ok (.«признак» true))
    (hk : «длинаЗн» w = some k) (hR : «линВыр?» y R = some (c, ns)) :
    ∃ a, «суммаИмён» ρ ns = some a ∧ (c + a < 2 ^ 53 → k = c + a) := by
  cases m with
  | zero => cases h
  | succ m =>
    have e : «выч» P (m + 1) ((y, w) :: ρ) (.«двучлен» "eq" (.«форма» "длина" [.«имя» y]) R) =
        «шаг» P («выч» P m) ((y, w) :: ρ) (.«двучлен» "eq" (.«форма» "длина" [.«имя» y]) R) := rfl
    rw [e] at h
    simp only [«шаг»] at h
    cases hx : «выч» P m ((y, w) :: ρ) (.«форма» "длина" [.«имя» y]) with
    | error q => rw [hx] at h; cases h
    | ok xv =>
      cases hy : «выч» P m ((y, w) :: ρ) R with
      | error q => rw [hx, hy] at h; cases h
      | ok yv =>
        rw [hx, hy] at h
        simp only [bind, Except.bind] at h
        obtain ⟨a, ha, hu⟩ := «линВыр-верно» P y w ρ R m c ns yv hR hy
        refine ⟨a, ha, fun hlt => ?_⟩
        have hxv : xv = .«число» («изЦелого» k) := by
          cases m with
          | zero => cases hx
          | succ m =>
            have e1 : «выч» P (m + 1) ((y, w) :: ρ) (.«форма» "длина" [.«имя» y]) =
                «шаг» P («выч» P m) ((y, w) :: ρ) (.«форма» "длина" [.«имя» y]) := rfl
            rw [e1] at hx
            simp only [«шаг», «вычВсе»] at hx
            cases m with
            | zero => simp [«выч», bind, Except.bind] at hx
            | succ m =>
              have e2 : «выч» P (m + 1) ((y, w) :: ρ) (.«имя» y) = «шаг» P («выч» P m) ((y, w) :: ρ) (.«имя» y) := rfl
              rw [e2] at hx
              simp only [«шаг», «найти», ↓reduceIte, bind, Except.bind, pure, Except.pure] at hx
              rw [«форма-длина» w k hk] at hx
              cases hx
              rfl
        rw [hxv, hu (by omega)] at h
        simp only [«двучлен», ↓reduceIte, Except.ok.injEq, «Зн».«признак».injEq, «равны», «равен64»,
          decide_eq_true_eq] at h
        exact «изЦелого-ниже» hlt h

structure «Лин» where
  «к» : Nat
  «атомы» : List «Терм»

def «Лин».«сумма» (a b : «Лин») : «Лин» := ⟨a.«к» + b.«к», a.«атомы» ++ b.«атомы»⟩

def «вес» (L : «Лин») : Nat := L.«к» + L.«атомы».length

abbrev «Записи» := List (Nat × Bool × String × List «Терм»)

structure «ПутьД» where
  «п» : «Путь»
  «формы» : «Записи»

def «запись?» (k : Nat) : «Записи» → Option (Bool × String × List «Терм»)
  | [] => none
  | (j, c, f, ts) :: r => if j = k then some (c, f, ts) else «запись?» k r

theorem «запись-член» {k : Nat} {c : Bool} {f : String} {ts : List «Терм»} :
    ∀ {F : «Записи»}, «запись?» k F = some (c, f, ts) → (k, c, f, ts) ∈ F
  | [], h => by simp [«запись?»] at h
  | (j, c', f', ts') :: r, h => by
    simp only [«запись?»] at h
    split at h
    · rename_i hj
      subst hj
      simp only [Option.some.injEq, Prod.mk.injEq] at h
      obtain ⟨rfl, rfl, rfl⟩ := h
      exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ («запись-член» h)

def «подставить» (F : «Терм» → Option «Лин») (ps : List String) (args : List «Терм») :
    List String → Option «Лин»
  | [] => some ⟨0, []⟩
  | p :: r =>
    match «найти» p (ps.zip args) with
    | some t =>
      match F t, «подставить» F ps args r with
      | some a, some b => some (a.«сумма» b)
      | _, _ => none
    | none => none

def «длинаЛин» (P : «Программа») (s : «ПутьД») : Nat → «Терм» → Option «Лин»
  | 0, _ => none
  | n + 1, t =>
    match t with
    | .«знач» v =>
      match v with
      | .«список» l => some ⟨l.length, []⟩
      | .«строка» x => some ⟨x.length, []⟩
      | _ => none
    | .«список» ts => some ⟨ts.length, []⟩
    | .«двучлен» op a b =>
      if op = "concat" then
        match a, b with
        | .«голова» z, .«хвост» z' =>
          if «равноТерм» z z' && «атом?» z then some ⟨1, [.«хвост» z]⟩ else none
        | _, _ =>
          match «длинаЛин» P s n a, «длинаЛин» P s n b with
          | some x, some y => some (x.«сумма» y)
          | _, _ => none
      else none
    | .«рез» j =>
      match «запись?» j s.«формы» with
      | some (false, f, args) =>
        if f = "приписать" ∨ f = "добавить" then
          match args with
          | [_, y] => («длинаЛин» P s n y).map (fun L => (⟨1, []⟩ : «Лин»).«сумма» L)
          | _ => none
        else none
      | some (true, f, args) =>
        match «функцияПрограммы» P f with
        | some g =>
          match «постДлины?» g.«постусловия» with
          | some (_, c, ns) =>
            match «подставить» («длинаЛин» P s n) g.«параметры» args ns with
            | some L =>
              if «вес» ((⟨c, []⟩ : «Лин»).«сумма» L) ≤ 16 && L.«атомы».all «атом?» then
                some ((⟨c, []⟩ : «Лин»).«сумма» L)
              else none
            | none => none
          | none => none
        | none => none
      | none => none
    | t =>
      if «атом?» t then
        if «решено» s.«п».«факты» (.«звено?» t) = some true then
          («длинаЛин» P s n (.«хвост» t)).map (fun L => (⟨1, []⟩ : «Лин»).«сумма» L)
        else if «решено» s.«п».«факты» (.«пусто?» t) = some true then some ⟨0, []⟩
        else some ⟨0, [t]⟩
      else none

def «ВернаЗапись» (P : «Программа») (M : Nat) : Bool → String → List «Зн» → «Зн» → Prop
  | true, f, vs, w => «выч» P M [] (.«вызов» f (vs.map .«лит»)) = .ok w
  | false, f, vs, w => «форма» f vs = .ok w

def «ВерныФормы» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (F : «Записи») : Prop :=
  ∀ k c f ts, (k, c, f, ts) ∈ F → ∃ vs w, «значВсех» σ res ts = .ok vs ∧ «взять» k res = some w ∧
    «ВернаЗапись» P M c f vs w

def «ЗовыДоверены» (P : «Программа») (F : «Записи») : Prop :=
  ∀ k f ts, (k, true, f, ts) ∈ F → «ПостусловияВызовов» P

theorem «значВсех-длина» (σ : «Среда») (res : «Итоги») :
    ∀ (ts : List «Терм») (vs : List «Зн»), «значВсех» σ res ts = .ok vs → vs.length = ts.length
  | [], vs, h => by simp [«значВсех»] at h; subst h; rfl
  | t :: r, vs, h => by
    simp only [«значВсех»] at h
    cases ht : «значТерм» σ res t with
    | error q => rw [ht] at h; cases h
    | ok v =>
      cases hr : «значВсех» σ res r with
      | error q => rw [ht, hr] at h; cases h
      | ok ws =>
        rw [ht, hr] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
        subst h
        simp [«значВсех-длина» σ res r ws hr]

theorem «значВсех-два» (σ : «Среда») (res : «Итоги») (a b : «Терм») (vs : List «Зн»)
    (h : «значВсех» σ res [a, b] = .ok vs) :
    ∃ va vb, vs = [va, vb] ∧ «значТерм» σ res a = .ok va ∧ «значТерм» σ res b = .ok vb := by
  simp only [«значВсех»] at h
  cases ha : «значТерм» σ res a with
  | error q => rw [ha] at h; cases h
  | ok va =>
    cases hb : «значТерм» σ res b with
    | error q => rw [ha, hb] at h; cases h
    | ok vb =>
      rw [ha, hb] at h
      simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
      exact ⟨va, vb, h.symm, rfl, rfl⟩

theorem «подставить-верно» (σ : «Среда») (res : «Итоги») (F : «Терм» → Option «Лин»)
    (IH : ∀ t L v k, F t = some L → «значТерм» σ res t = .ok v → «длинаЗн» v = some k →
      ∃ a, «суммаДлин» σ res L.«атомы» = some a ∧ k = L.«к» + a)
    (ps : List String) (args : List «Терм») (vs : List «Зн») (hv : «значВсех» σ res args = .ok vs) :
    ∀ (ns : List String) (L : «Лин») (a0 : Nat), «подставить» F ps args ns = some L →
      «суммаИмён» («привязать» ps vs) ns = some a0 →
      ∃ a, «суммаДлин» σ res L.«атомы» = some a ∧ a0 = L.«к» + a
  | [], L, a0, h, h0 => by
    simp only [«подставить», Option.some.injEq] at h
    subst h
    simp only [«суммаИмён», Option.some.injEq] at h0
    subst h0
    exact ⟨0, rfl, rfl⟩
  | p :: r, L, a0, h, h0 => by
    simp only [«подставить»] at h
    cases hp : «найти» p (ps.zip args) with
    | none => rw [hp] at h; cases h
    | some t =>
      rw [hp] at h
      cases ht : F t with
      | none => simp [ht] at h
      | some Lt =>
        cases hr : «подставить» F ps args r with
        | none => simp [ht, hr] at h
        | some Lr =>
          simp only [ht, hr, Option.some.injEq] at h
          subst h
          obtain ⟨w, hw, htw⟩ := «найти-параллельно» σ res p ps args vs t hv hp
          simp only [«суммаИмён», «привязать»] at h0
          rw [hw] at h0
          cases hk : «длинаЗн» w with
          | none => simp [hk, «сложить»] at h0
          | some k =>
            cases hs : «суммаИмён» (ps.zip vs) r with
            | none => simp [hk, hs, «сложить»] at h0
            | some ar =>
              simp only [Option.bind_some, hk, hs, «сложить», Option.some.injEq] at h0
              subst h0
              obtain ⟨at', h1, e1⟩ := IH t Lt w k ht htw hk
              obtain ⟨ar', h2, e2⟩ := «подставить-верно» σ res F IH ps args vs hv r Lr ar hr hs
              refine ⟨at' + ar', ?_, ?_⟩
              · simp only [«Лин».«сумма», «суммаДлин-склейка», h1, h2]; rfl
              · simp only [«Лин».«сумма»]; omega

theorem «предел48-число» : «предел48» = 281474976710656 := rfl

theorem «длинаЛин-верно» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (s : «ПутьД»)
    (hΦ : «Верны» σ res s.«п».«факты») (hF : «ВерныФормы» P M σ res s.«формы»)
    (hH : «ЗовыДоверены» P s.«формы») (hσ : «КороткаСреда» σ) :
    ∀ (n : Nat) (t : «Терм») (L : «Лин») (v : «Зн») (k : Nat), «длинаЛин» P s n t = some L →
      «значТерм» σ res t = .ok v → «длинаЗн» v = some k →
      ∃ a, «суммаДлин» σ res L.«атомы» = some a ∧ k = L.«к» + a
  | 0, _, _, _, _, h, _, _ => by simp [«длинаЛин»] at h
  | n + 1, t, L, v, k, h, hv, hk => by
    have IH := «длинаЛин-верно» P M σ res s hΦ hF hH hσ n
    have atomic : «атом?» t = true →
        (if «решено» s.«п».«факты» (.«звено?» t) = some true then
          («длинаЛин» P s n (.«хвост» t)).map (fun L => (⟨1, []⟩ : «Лин»).«сумма» L)
        else if «решено» s.«п».«факты» (.«пусто?» t) = some true then some ⟨0, []⟩
        else some ⟨0, [t]⟩) = some L → ∃ a, «суммаДлин» σ res L.«атомы» = some a ∧ k = L.«к» + a := by
      intro ha h
      split at h
      · rename_i hz
        have hzv := «решено-верно» hΦ hz
        simp only [«значТерм», hv, bind, Except.bind, pure, Except.pure, Except.ok.injEq,
          «Зн».«признак».injEq] at hzv
        cases hL : «длинаЛин» P s n (.«хвост» t) with
        | none => rw [hL] at h; cases h
        | some L0 =>
          rw [hL] at h
          simp only [Option.map_some, Option.some.injEq] at h
          subst h
          cases v with
          | «строка» str =>
            simp only [«звеньевой»] at hzv
            cases hs : str.toList with
            | nil => rw [hs] at hzv; cases hzv
            | cons c r =>
              have htv : «значТерм» σ res (.«хвост» t) = .ok (.«строка» (String.ofList r)) := by
                simp [«значТерм», hv, «хвостЗн», hs, bind, Except.bind]
              obtain ⟨a, ha1, ha2⟩ := IH (.«хвост» t) L0 _ r.length hL htv (by simp [«длинаЗн»])
              refine ⟨a, by simpa [«Лин».«сумма», «суммаДлин»] using ha1, ?_⟩
              simp only [«длинаЗн», Option.some.injEq] at hk
              have : str.length = r.length + 1 := by rw [← String.length_toList, hs]; simp
              simp only [«Лин».«сумма»]
              omega
          | «список» l =>
            cases l with
            | nil => simp [«звеньевой»] at hzv
            | cons y r =>
              have htv : «значТерм» σ res (.«хвост» t) = .ok (.«список» r) := by
                simp [«значТерм», hv, «хвостЗн», bind, Except.bind]
              obtain ⟨a, ha1, ha2⟩ := IH (.«хвост» t) L0 _ r.length hL htv (by simp [«длинаЗн»])
              refine ⟨a, by simpa [«Лин».«сумма», «суммаДлин»] using ha1, ?_⟩
              simp only [«длинаЗн», Option.some.injEq, List.length_cons] at hk
              simp only [«Лин».«сумма»]
              omega
          | _ => simp [«длинаЗн»] at hk
      · split at h
        · rename_i _ hp
          have hpv := «решено-верно» hΦ hp
          simp only [«значТерм», hv, bind, Except.bind, pure, Except.pure, Except.ok.injEq,
            «Зн».«признак».injEq] at hpv
          simp only [Option.some.injEq] at h
          subst h
          refine ⟨0, rfl, ?_⟩
          cases v with
          | «строка» str =>
            simp only [«пустой», String.isEmpty_iff] at hpv
            subst hpv
            simp [«длинаЗн»] at hk; simp [hk]
          | «список» l =>
            simp only [«пустой», List.isEmpty_iff] at hpv
            subst hpv
            simp [«длинаЗн»] at hk; simp [hk]
          | _ => simp [«длинаЗн»] at hk
        · simp only [Option.some.injEq] at h
          subst h
          refine ⟨k, ?_, by simp⟩
          simp [«суммаДлин», «длинаТерма», hv, hk, «сложить»]
    cases t with
    | «знач» u =>
      cases u with
      | «список» l =>
        simp only [«длинаЛин», Option.some.injEq] at h; subst h
        simp only [«значТерм», Except.ok.injEq] at hv; subst hv
        simp only [«длинаЗн», Option.some.injEq] at hk
        exact ⟨0, rfl, by simp [hk]⟩
      | «строка» x =>
        simp only [«длинаЛин», Option.some.injEq] at h; subst h
        simp only [«значТерм», Except.ok.injEq] at hv; subst hv
        simp only [«длинаЗн», Option.some.injEq] at hk
        exact ⟨0, rfl, by simp [hk]⟩
      | _ => simp [«длинаЛин»] at h
    | «список» ts =>
      simp only [«длинаЛин», Option.some.injEq] at h; subst h
      simp only [«значТерм»] at hv
      cases hvs : «значВсех» σ res ts with
      | error q => rw [hvs] at hv; cases hv
      | ok vs =>
        rw [hvs] at hv
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at hv
        subst hv
        simp only [«длинаЗн», Option.some.injEq] at hk
        refine ⟨0, rfl, ?_⟩
        rw [← hk, «значВсех-длина» σ res ts vs hvs]
        rfl
    | «рез» j =>
      simp only [«длинаЛин»] at h
      have hjv : «взять» j res = some v := by
        simp only [«значТерм»] at hv
        split at hv
        · rename_i w hw; cases hv; exact hw
        · cases hv
      cases hj : «запись?» j s.«формы» with
      | none => rw [hj] at h; cases h
      | some e =>
        obtain ⟨c, f, args⟩ := e
        rw [hj] at h
        obtain ⟨vs, w, hvs, hw, hrec⟩ := hF j c f args («запись-член» hj)
        rw [hjv] at hw
        simp only [Option.some.injEq] at hw
        subst hw
        cases c with
        | false =>
          simp only [«ВернаЗапись»] at hrec
          simp only at h
          split at h
          · rename_i hf
            split at h
            · rename_i x0 y
              cases hL : «длинаЛин» P s n y with
              | none => rw [hL] at h; cases h
              | some L0 =>
                rw [hL] at h
                simp only [Option.map_some, Option.some.injEq] at h
                subst h
                obtain ⟨vx, vy, rfl, hx, hy⟩ := «значВсех-два» σ res x0 y vs hvs
                rcases hf with rfl | rfl
                · cases vy with
                  | «список» l =>
                    simp [«форма»] at hrec
                    subst hrec
                    obtain ⟨a, ha1, ha2⟩ := IH y L0 _ l.length hL hy (by simp [«длинаЗн»])
                    refine ⟨a, by simpa [«Лин».«сумма», «суммаДлин»] using ha1, ?_⟩
                    simp only [«длинаЗн», List.length_cons, Option.some.injEq] at hk
                    simp only [«Лин».«сумма»]; omega
                  | _ => simp [«форма», «беда»] at hrec
                · cases vy with
                  | «список» l =>
                    simp [«форма»] at hrec
                    subst hrec
                    obtain ⟨a, ha1, ha2⟩ := IH y L0 _ l.length hL hy (by simp [«длинаЗн»])
                    refine ⟨a, by simpa [«Лин».«сумма», «суммаДлин»] using ha1, ?_⟩
                    simp only [«длинаЗн», List.length_append, List.length_cons, List.length_nil,
                      Option.some.injEq] at hk
                    simp only [«Лин».«сумма»]; omega
                  | _ => simp [«форма», «беда»] at hrec
            · cases h
          · cases h
        | true =>
          simp only [«ВернаЗапись»] at hrec
          simp only at h
          cases hg : «функцияПрограммы» P f with
          | none => rw [hg] at h; cases h
          | some g =>
            rw [hg] at h
            simp only at h
            cases hq : «постДлины?» g.«постусловия» with
            | none => rw [hq] at h; cases h
            | some qcn =>
              obtain ⟨q, c, ns⟩ := qcn
              rw [hq] at h
              simp only at h
              cases hL : «подставить» («длинаЛин» P s n) g.«параметры» args ns with
              | none => rw [hL] at h; cases h
              | some L0 =>
                rw [hL] at h
                simp only at h
                split at h
                · rename_i hw
                  simp only [Option.some.injEq] at h
                  subst h
                  simp only [Bool.and_eq_true, decide_eq_true_eq] at hw
                  obtain ⟨hwt, hat⟩ := hw
                  obtain ⟨hqm, R, hqe, hR⟩ := «постДлины-вид» hq
                  obtain ⟨m, hm⟩ := hH j f args («запись-член» hj) M f vs v g hrec hg q hqm
                  rw [hqe] at hm
                  obtain ⟨a0, ha0, hka⟩ := «пост-длины-значение» P m q.«связка» v _ R k c ns hm hk hR
                  obtain ⟨a, ha1, ha2⟩ := «подставить-верно» σ res («длинаЛин» P s n) IH g.«параметры» args vs hvs
                    ns L0 a0 hL ha0
                  have hb := «сумма-коротка» hσ res L0.«атомы» a hat ha1
                  simp only [«вес», «Лин».«сумма», List.nil_append] at hwt
                  rw [«предел48-число»] at hb
                  refine ⟨a, by simpa [«Лин».«сумма»] using ha1, ?_⟩
                  have := hka (by
                    have : L0.«атомы».length * 281474976710656 ≤ 16 * 281474976710656 :=
                      Nat.mul_le_mul_right _ (by omega)
                    omega)
                  simp only [«Лин».«сумма»]
                  omega
                · cases h
    | «имя» x => exact atomic rfl (by simpa only [«длинаЛин», «атом?», ↓reduceIte] using h)
    | «голова» u =>
      by_cases ha : «атом?» u = true
      · exact atomic (by simpa [«атом?»] using ha) (by simpa only [«длинаЛин», «атом?», ha, ↓reduceIte] using h)
      · simp [«длинаЛин», «атом?», ha] at h
    | «хвост» u =>
      by_cases ha : «атом?» u = true
      · exact atomic (by simpa [«атом?»] using ha) (by simpa only [«длинаЛин», «атом?», ha, ↓reduceIte] using h)
      · simp [«длинаЛин», «атом?», ha] at h
    | «двучлен» op a b =>
      simp only [«длинаЛин»] at h
      split at h
      · rename_i hop
        subst hop
        simp only [«значТерм»] at hv
        cases ha : «значТерм» σ res a with
        | error q => rw [ha] at hv; cases hv
        | ok va =>
          cases hb : «значТерм» σ res b with
          | error q => rw [ha, hb] at hv; cases hv
          | ok vb =>
            rw [ha, hb] at hv
            simp only [bind, Except.bind] at hv
            have hcat : ∃ x y, va = .«строка» x ∧ vb = .«строка» y ∧ v = .«строка» (x ++ y) := by
              cases va <;> cases vb <;> simp [«двучлен», «беда»] at hv
              first
                | exact ⟨_, _, rfl, rfl, hv.symm⟩
                | exact ⟨_, _, rfl, rfl, hv⟩
            obtain ⟨x, y, rfl, rfl, rfl⟩ := hcat
            simp only [«длинаЗн», Option.some.injEq, String.length_append] at hk
            split at h
            · rename_i z z'
              split at h
              · rename_i hc
                simp only [Bool.and_eq_true] at hc
                have hz := «равноТерм-верно» _ _ hc.1
                subst hz
                simp only [Option.some.injEq] at h
                subst h
                refine ⟨y.length, ?_, ?_⟩
                · simp [«суммаДлин», «длинаТерма», hb, «длинаЗн», «сложить»]
                · simp only [«значТерм»] at ha hb
                  cases hzv : «значТерм» σ res z with
                  | error q => rw [hzv] at ha; cases ha
                  | ok zv =>
                    rw [hzv] at ha hb
                    simp only [bind, Except.bind] at ha hb
                    cases zv with
                    | «строка» str =>
                      cases hs : str.toList with
                      | nil => simp [«головаЗн», hs, «беда»] at ha
                      | cons c r =>
                        simp only [«головаЗн», hs, Except.ok.injEq, «Зн».«строка».injEq] at ha
                        subst ha
                        rw [← hk]
                        simp [String.length_singleton]
                    | «список» l =>
                      cases l with
                      | nil => simp [«хвостЗн», «беда»] at hb
                      | cons e r => simp [«хвостЗн»] at hb
                    | _ => simp [«хвостЗн», «беда»] at hb
              · cases h
            · cases hLa : «длинаЛин» P s n a with
              | none => simp [hLa] at h
              | some La =>
                cases hLb : «длинаЛин» P s n b with
                | none => simp [hLa, hLb] at h
                | some Lb =>
                  simp only [hLa, hLb, Option.some.injEq] at h
                  subst h
                  obtain ⟨a1, h1, e1⟩ := IH a La _ x.length hLa ha (by simp [«длинаЗн»])
                  obtain ⟨a2, h2, e2⟩ := IH b Lb _ y.length hLb hb (by simp [«длинаЗн»])
                  refine ⟨a1 + a2, by simp only [«Лин».«сумма», «суммаДлин-склейка», h1, h2]; rfl, ?_⟩
                  simp only [«Лин».«сумма»]
                  omega
      · cases h
    | «вариант?» _ _ => simp [«длинаЛин», «атом?»] at h
    | «пусто?» _ => simp [«длинаЛин», «атом?»] at h
    | «звено?» _ => simp [«длинаЛин», «атом?»] at h
    | «поле» _ _ => simp [«длинаЛин», «атом?»] at h

def «числоЛин» (P : «Программа») (s : «ПутьД») : Nat → «Терм» → Option «Лин»
  | 0, _ => none
  | n + 1, t =>
    match t with
    | .«знач» v =>
      match v with
      | .«число» d => («литНат?» d).map (fun c => ⟨c, []⟩)
      | _ => none
    | .«двучлен» op a b =>
      if op = "add" then
        match «числоЛин» P s n a, «числоЛин» P s n b with
        | some x, some y => some (x.«сумма» y)
        | _, _ => none
      else none
    | .«рез» j =>
      match «запись?» j s.«формы» with
      | some (false, f, args) =>
        if f = "длина" then
          match args with
          | [x] => «длинаЛин» P s n x
          | _ => none
        else none
      | _ => none
    | _ => none

theorem «числоЛин-верно» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (s : «ПутьД»)
    (hΦ : «Верны» σ res s.«п».«факты») (hF : «ВерныФормы» P M σ res s.«формы»)
    (hH : «ЗовыДоверены» P s.«формы») (hσ : «КороткаСреда» σ) :
    ∀ (n : Nat) (t : «Терм») (L : «Лин») (u : «Зн»), «числоЛин» P s n t = some L →
      «значТерм» σ res t = .ok u →
      ∃ a, «суммаДлин» σ res L.«атомы» = some a ∧ (L.«к» + a ≤ 2 ^ 53 → u = .«число» («изЦелого» (L.«к» + a)))
  | 0, _, _, _, h, _ => by simp [«числоЛин»] at h
  | n + 1, t, L, u, h, hv => by
    cases t with
    | «знач» z =>
      cases z with
      | «число» d =>
        simp only [«числоЛин»] at h
        cases hd : «литНат?» d with
        | none => rw [hd] at h; cases h
        | some c =>
          rw [hd] at h
          simp only [Option.map_some, Option.some.injEq] at h
          subst h
          simp only [«значТерм», Except.ok.injEq] at hv
          subst hv
          refine ⟨0, rfl, fun _ => ?_⟩
          rw [(«литНат-верно» hd).1]
          simp
      | _ => simp [«числоЛин»] at h
    | «двучлен» op a b =>
      simp only [«числоЛин»] at h
      split at h
      · rename_i hop
        subst hop
        cases ha : «числоЛин» P s n a with
        | none => simp [ha] at h
        | some La =>
          cases hb : «числоЛин» P s n b with
          | none => simp [ha, hb] at h
          | some Lb =>
            simp only [ha, hb, Option.some.injEq] at h
            subst h
            simp only [«значТерм»] at hv
            cases hx : «значТерм» σ res a with
            | error q => rw [hx] at hv; cases hv
            | ok xv =>
              cases hy : «значТерм» σ res b with
              | error q => rw [hx, hy] at hv; cases hv
              | ok yv =>
                rw [hx, hy] at hv
                simp only [bind, Except.bind] at hv
                obtain ⟨a1, h1, k1⟩ := «числоЛин-верно» P M σ res s hΦ hF hH hσ n a La xv ha hx
                obtain ⟨a2, h2, k2⟩ := «числоЛин-верно» P M σ res s hΦ hF hH hσ n b Lb yv hb hy
                refine ⟨a1 + a2, by simp only [«Лин».«сумма», «суммаДлин-склейка», h1, h2]; rfl, fun hle => ?_⟩
                simp only [«Лин».«сумма»] at hle ⊢
                have hs := «сложение-чисел» (La.«к» + a1) (Lb.«к» + a2) (by omega)
                push_cast at hs
                rw [k1 (by omega), k2 (by omega), hs] at hv
                cases hv
                congr 2
                push_cast
                omega
      · cases h
    | «рез» j =>
      simp only [«числоЛин»] at h
      have hjv : «взять» j res = some u := by
        simp only [«значТерм»] at hv
        split at hv
        · rename_i w hw; cases hv; exact hw
        · cases hv
      cases hj : «запись?» j s.«формы» with
      | none => rw [hj] at h; cases h
      | some e =>
        obtain ⟨c, f, args⟩ := e
        rw [hj] at h
        cases c with
        | true => simp at h
        | false =>
          simp only at h
          split at h
          · rename_i hf
            subst hf
            split at h
            · rename_i x
              obtain ⟨vs, w, hvs, hw, hrec⟩ := hF j false "длина" [x] («запись-член» hj)
              rw [hjv] at hw
              simp only [Option.some.injEq] at hw
              subst hw
              simp only [«ВернаЗапись»] at hrec
              simp only [«значВсех»] at hvs
              cases hx : «значТерм» σ res x with
              | error q => rw [hx] at hvs; cases hvs
              | ok xv =>
                rw [hx] at hvs
                simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at hvs
                subst hvs
                obtain ⟨k, hk, hu⟩ := «форма-длина-обратно» xv u hrec
                obtain ⟨a, ha1, ha2⟩ := «длинаЛин-верно» P M σ res s hΦ hF hH hσ n x L xv k h hx hk
                exact ⟨a, ha1, fun _ => by rw [hu, ha2]; simp⟩
            · cases h
          · cases h
    | «имя» _ => simp [«числоЛин»] at h
    | «список» _ => simp [«числоЛин»] at h
    | «вариант?» _ _ => simp [«числоЛин»] at h
    | «пусто?» _ => simp [«числоЛин»] at h
    | «звено?» _ => simp [«числоЛин»] at h
    | «голова» _ => simp [«числоЛин»] at h
    | «хвост» _ => simp [«числоЛин»] at h
    | «поле» _ _ => simp [«числоЛин»] at h

def «запасЛин» : Nat := 64

def «линРавно» (P : «Программа») (s : «ПутьД») : «Терм» → Bool
  | .«двучлен» op a b =>
    decide (op = "eq") &&
      match «числоЛин» P s «запасЛин» a, «числоЛин» P s «запасЛин» b with
      | some La, some Lb =>
        decide (La.«к» = Lb.«к») && «равныАтомы» La.«атомы» Lb.«атомы» &&
          (La.«атомы» ++ Lb.«атомы»).all «атом?» && decide («вес» La ≤ 16)
      | _, _ => false
  | _ => false

theorem «линРавно-верно» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (s : «ПутьД»)
    (hΦ : «Верны» σ res s.«п».«факты») (hF : «ВерныФормы» P M σ res s.«формы»)
    (hH : «ЗовыДоверены» P s.«формы») (hσ : «КороткаСреда» σ) (t : «Терм») (u : «Зн»)
    (h : «линРавно» P s t = true) (hv : «значТерм» σ res t = .ok u) : u = .«признак» true := by
  cases t with
  | «двучлен» op a b =>
    simp only [«линРавно», Bool.and_eq_true, decide_eq_true_eq] at h
    obtain ⟨hop, h⟩ := h
    subst hop
    cases ha : «числоЛин» P s «запасЛин» a with
    | none => simp [ha] at h
    | some La =>
      cases hb : «числоЛин» P s «запасЛин» b with
      | none => simp [ha, hb] at h
      | some Lb =>
        simp only [ha, hb, Bool.and_eq_true, decide_eq_true_eq, List.all_append] at h
        obtain ⟨⟨⟨hk, hat⟩, hall⟩, hw⟩ := h
        simp only [«значТерм»] at hv
        cases hx : «значТерм» σ res a with
        | error q => rw [hx] at hv; cases hv
        | ok xv =>
          cases hy : «значТерм» σ res b with
          | error q => rw [hx, hy] at hv; cases hv
          | ok yv =>
            rw [hx, hy] at hv
            simp only [bind, Except.bind, «двучлен», ↓reduceIte, Except.ok.injEq] at hv
            subst hv
            obtain ⟨a1, h1, k1⟩ := «числоЛин-верно» P M σ res s hΦ hF hH hσ _ a La xv ha hx
            obtain ⟨a2, h2, k2⟩ := «числоЛин-верно» P M σ res s hΦ hF hH hσ _ b Lb yv hb hy
            have e := «равныАтомы-сумма» σ res La.«атомы» Lb.«атомы» hat
            rw [h1, h2] at e
            simp only [Option.some.injEq] at e
            subst e
            have hb1 := «сумма-коротка» hσ res La.«атомы» a1 hall.1 h1
            rw [«предел48-число»] at hb1
            simp only [«вес»] at hw
            have hle : La.«к» + a1 ≤ 2 ^ 53 := by
              have : La.«атомы».length * 281474976710656 ≤ 16 * 281474976710656 :=
                Nat.mul_le_mul_right _ (by omega)
              omega
            rw [k1 hle, k2 (by omega), hk]
            simp [«равны», «равен64»]
  | _ => simp [«линРавно»] at h

def «послеВызова» (p : «Путь») (f : String) (ts : List «Терм») (k : Nat) : «Путь» :=
  if «безРезВсе» («нормВсе» p.«замены» ts) then
    match «искатьВызов» f («нормВсе» p.«замены» ts) («сдвинуть» k p).«вызовы» with
    | some j => ⟨(«сдвинуть» k p).«факты», (k, .«рез» j) :: («сдвинуть» k p).«замены»,
        (f, «нормВсе» p.«замены» ts, k) :: («сдвинуть» k p).«вызовы»⟩
    | none => ⟨(«сдвинуть» k p).«факты», («сдвинуть» k p).«замены»,
        (f, «нормВсе» p.«замены» ts, k) :: («сдвинуть» k p).«вызовы»⟩
  else «сдвинуть» k p

theorem «послеВызова-верно» {P : «Программа»} {M : Nat} {σ : «Среда»} {res : «Итоги»} {p : «Путь»}
    (hs : «ВерныйПуть» P M σ res p) (f : String) (ts : List «Терм») (k : Nat) (vs : List «Зн») (w : «Зн»)
    (hvs : «значВсех» σ res ts = .ok vs) (hw : «выч» P M [] (.«вызов» f (vs.map .«лит»)) = .ok w) :
    «ВерныйПуть» P M σ ((k, w) :: res) («послеВызова» p f ts k) := by
  have h0 := «сдвинуть-верно» hs k w
  unfold «послеВызова»
  split
  · rename_i hb
    have hvs' : «значВсех» σ ((k, w) :: res) («нормВсе» p.«замены» ts) = .ok vs := by
      rw [«безРезВсе-верны» σ ((k, w) :: res) res _ hb, «нормВсе-верна» hs.2.1 ts]
      exact hvs
    have hk : «взять» k ((k, w) :: res) = some w := by simp [«взять»]
    have hC : ∀ f' ts' j, (f', ts', j) ∈ (f, «нормВсе» p.«замены» ts, k) :: («сдвинуть» k p).«вызовы» →
        «безРезВсе» ts' = true ∧ ∃ vs w', «значВсех» σ ((k, w) :: res) ts' = .ok vs ∧
          «взять» j ((k, w) :: res) = some w' ∧ «выч» P M [] (.«вызов» f' (vs.map .«лит»)) = .ok w' := by
      intro f' ts' j hm
      rcases List.mem_cons.mp hm with he | hm
      · cases he
        exact ⟨hb, vs, w, hvs', hk, hw⟩
      · exact h0.2.2 f' ts' j hm
    split
    · rename_i j hj
      obtain ⟨_, vs0, w0, hvs0, hw0, hc0⟩ := h0.2.2 f _ j («искатьВызов-член» hj)
      rw [hvs'] at hvs0
      cases hvs0
      rw [hw] at hc0
      cases hc0
      refine ⟨h0.1, ?_, hC⟩
      intro k' t hm
      rcases List.mem_cons.mp hm with he | hm
      · cases he
        exact ⟨w, hk, by simp [«значТерм», hw0]⟩
      · exact h0.2.1 k' t hm
    · exact ⟨h0.1, h0.2.1, hC⟩
  · exact h0

def «послеФормы» (p : «Путь») (f : String) (ts : List «Терм») (k : Nat) : «Путь» :=
  match «головаОдного?» f ts with
  | some t =>
    if «естьРез» k («норм» p.«замены» t) then «сдвинуть» k p
    else ⟨(«сдвинуть» k p).«факты», (k, «норм» p.«замены» t) :: («сдвинуть» k p).«замены», («сдвинуть» k p).«вызовы»⟩
  | none => «сдвинуть» k p

theorem «послеФормы-верно» {P : «Программа»} {M : Nat} {σ : «Среда»} {res : «Итоги»} {p : «Путь»}
    (hs : «ВерныйПуть» P M σ res p) (f : String) (ts : List «Терм») (k : Nat) (vs : List «Зн») (w : «Зн»)
    (hvs : «значВсех» σ res ts = .ok vs) (hw : «форма» f vs = .ok w) :
    «ВерныйПуть» P M σ ((k, w) :: res) («послеФормы» p f ts k) := by
  have h0 := «сдвинуть-верно» hs k w
  unfold «послеФормы»
  split
  · rename_i t ht
    split
    · exact h0
    · rename_i hkt
      obtain ⟨hf, hts⟩ := «головаОдного-вид» ht
      subst hf
      subst hts
      cases hx : «значТерм» σ res t with
      | error q => simp [«значВсех», «значТерм», hx, bind, Except.bind] at hvs
      | ok x =>
        simp [«значВсех», «значТерм», hx, bind, Except.bind, pure, Except.pure] at hvs
        subst hvs
        rw [«голова-одного»] at hw
        simp only [Except.ok.injEq] at hw
        subst hw
        refine ⟨h0.1, ?_, h0.2.2⟩
        intro k' t' hm
        rcases List.mem_cons.mp hm with he | hm
        · cases he
          refine ⟨x, by simp [«взять»], ?_⟩
          rw [«без-реза» σ res k x _ (by simpa using hkt), «норм-верна» hs.2.1 t]
          exact hx
        · exact h0.2.1 k' t' hm
  · exact h0

def «сдвинутьФ» (k : Nat) (F : «Записи») : «Записи» :=
  F.filter (fun e => !(e.1 == k) && !«естьРезВсе» k e.2.2.2)

def «записать» (k : Nat) (c : Bool) (f : String) (ts : List «Терм») (F : «Записи») : «Записи» :=
  if «естьРезВсе» k ts then F else (k, c, f, ts) :: F

theorem «сдвинутьФ-верно» {P : «Программа»} {M : Nat} {σ : «Среда»} {res : «Итоги»} {F : «Записи»}
    (hF : «ВерныФормы» P M σ res F) (k : Nat) (w : «Зн») : «ВерныФормы» P M σ ((k, w) :: res) («сдвинутьФ» k F) := by
  intro j c f ts hm
  simp only [«сдвинутьФ», List.mem_filter, Bool.and_eq_true, Bool.not_eq_true', beq_eq_false_iff_ne] at hm
  obtain ⟨hm, hj, ht⟩ := hm
  obtain ⟨vs, u, hvs, hu, hr⟩ := hF j c f ts hm
  refine ⟨vs, u, ?_, ?_, hr⟩
  · rw [«без-реза-все» σ res k w ts ht]; exact hvs
  · rw [«взять-мимо» w res hj]; exact hu

theorem «записать-верно» {P : «Программа»} {M : Nat} {σ : «Среда»} {res : «Итоги»} {F : «Записи»}
    (hF : «ВерныФормы» P M σ ((k, w) :: res) F) (c : Bool) (f : String) (ts : List «Терм») (vs : List «Зн»)
    (hvs : «значВсех» σ res ts = .ok vs) (hr : «ВернаЗапись» P M c f vs w) :
    «ВерныФормы» P M σ ((k, w) :: res) («записать» k c f ts F) := by
  unfold «записать»
  split
  · exact hF
  · rename_i hk
    intro j c' f' ts' hm
    rcases List.mem_cons.mp hm with he | hm
    · cases he
      refine ⟨vs, w, ?_, by simp [«взять»], hr⟩
      rw [«без-реза-все» σ res k w ts (by simpa using hk)]
      exact hvs
    · exact hF j c' f' ts' hm

def «ЗовыПоФлагу» («зовы» : Bool) (F : «Записи») : Prop := ∀ k f ts, (k, true, f, ts) ∈ F → «зовы» = true

theorem «сдвинутьФ-флаг» {«зовы» : Bool} {F : «Записи»} (h : «ЗовыПоФлагу» «зовы» F) (k : Nat) :
    «ЗовыПоФлагу» «зовы» («сдвинутьФ» k F) := by
  intro j f ts hm
  simp only [«сдвинутьФ», List.mem_filter] at hm
  exact h j f ts hm.1

theorem «записать-флаг» {«зовы» : Bool} {F : «Записи»} (h : «ЗовыПоФлагу» «зовы» F) (k : Nat) (c : Bool)
    (f : String) (ts : List «Терм») (hc : c = true → «зовы» = true) : «ЗовыПоФлагу» «зовы» («записать» k c f ts F) := by
  intro j f' ts' hm
  unfold «записать» at hm
  split at hm
  · exact h j f' ts' hm
  · rcases List.mem_cons.mp hm with he | hm
    · cases he; exact hc rfl
    · exact h j f' ts' hm

def «держитсяД» (P : «Программа») («зовы» : Bool) : «ПутьД» → «Дерево» → Bool
  | s, .«лист» t => «держится» s.«п» (.«лист» t) || «линРавно» P s («норм» s.«п».«замены» t)
  | _, .«отказ» _ => true
  | s, .«если» c a b =>
    match «решено» s.«п».«факты» («норм» s.«п».«замены» c) with
    | some true => «держитсяД» P «зовы» s a
    | some false => «держитсяД» P «зовы» s b
    | none =>
      «держитсяД» P «зовы» ⟨⟨(«норм» s.«п».«замены» c, true) :: s.«п».«факты», s.«п».«замены», s.«п».«вызовы»⟩,
          s.«формы»⟩ a &&
        «держитсяД» P «зовы» ⟨⟨(«норм» s.«п».«замены» c, false) :: s.«п».«факты», s.«п».«замены», s.«п».«вызовы»⟩,
          s.«формы»⟩ b
  | s, .«вызов» f ts k rest =>
    «держитсяД» P «зовы» ⟨«послеВызова» s.«п» f ts k,
      if «зовы» then «записать» k true f («нормВсе» s.«п».«замены» ts) («сдвинутьФ» k s.«формы»)
      else «сдвинутьФ» k s.«формы»⟩ rest
  | s, .«форма» f ts k rest =>
    «держитсяД» P «зовы» ⟨«послеФормы» s.«п» f ts k,
      «записать» k false f («нормВсе» s.«п».«замены» ts) («сдвинутьФ» k s.«формы»)⟩ rest
  | _, _ => false

theorem «держитсяД-верно» (P : «Программа») (M : Nat) (σ : «Среда») («зовы» : Bool)
    (hH : «зовы» = true → «ПостусловияВызовов» P) (hσ : «КороткаСреда» σ) :
    ∀ (d : «Дерево») (s : «ПутьД») (res : «Итоги») (u : «Зн»),
      «ВерныйПуть» P M σ res s.«п» → «ВерныФормы» P M σ res s.«формы» → «ЗовыПоФлагу» «зовы» s.«формы» →
      «держитсяД» P «зовы» s d = true → «значДерева» P M σ res d = .ok u → u = .«признак» true
  | .«лист» t, s, res, u, hs, hF, hz, h, hv => by
    simp only [«держитсяД», Bool.or_eq_true] at h
    rcases h with h | h
    · exact «держится-верно» P M σ (.«лист» t) s.«п» res u hs h hv
    · simp only [«значДерева»] at hv
      have hn := «норм-верна» hs.2.1 t
      rw [← hn] at hv
      exact «линРавно-верно» P M σ res s hs.1 hF (fun k f ts hm => hH (hz k f ts hm)) hσ _ u h hv
  | .«отказ» k, s, res, u, hs, hF, hz, h, hv => by
    simp only [«значДерева», «беда»] at hv
    cases hv
  | .«если» c a b, s, res, u, hs, hF, hz, h, hv => by
    simp only [«значДерева»] at hv
    have hn := «норм-верна» hs.2.1 c
    cases hc : «значТерм» σ res c with
    | error q => rw [hc] at hv; cases hv
    | ok cv =>
      rw [hc] at hv
      simp only [bind, Except.bind] at hv
      simp only [«держитсяД»] at h
      cases hr : «решено» s.«п».«факты» («норм» s.«п».«замены» c) with
      | some bb =>
        rw [hr] at h
        have hcb := «решено-верно» hs.1 hr
        rw [hn, hc] at hcb
        cases hcb
        cases bb with
        | true => exact «держитсяД-верно» P M σ «зовы» hH hσ a s res u hs hF hz h hv
        | false => exact «держитсяД-верно» P M σ «зовы» hH hσ b s res u hs hF hz h hv
      | none =>
        rw [hr] at h
        simp only [Bool.and_eq_true] at h
        cases cv with
        | «признак» bb =>
          have hf : «значТерм» σ res («норм» s.«п».«замены» c) = .ok (.«признак» bb) := by rw [hn, hc]
          cases bb with
          | true =>
            exact «держитсяД-верно» P M σ «зовы» hH hσ a
              ⟨⟨(«норм» s.«п».«замены» c, true) :: s.«п».«факты», s.«п».«замены», s.«п».«вызовы»⟩, s.«формы»⟩ res u
              ⟨«верны-добавить» hs.1 hf, hs.2.1, hs.2.2⟩ hF hz h.1 hv
          | false =>
            exact «держитсяД-верно» P M σ «зовы» hH hσ b
              ⟨⟨(«норм» s.«п».«замены» c, false) :: s.«п».«факты», s.«п».«замены», s.«п».«вызовы»⟩, s.«формы»⟩ res u
              ⟨«верны-добавить» hs.1 hf, hs.2.1, hs.2.2⟩ hF hz h.2 hv
        | _ => simp [«беда»] at hv
  | .«вызов» f ts k rest, s, res, u, hs, hF, hz, h, hv => by
    simp only [«значДерева»] at hv
    cases hvs : «значВсех» σ res ts with
    | error q => rw [hvs] at hv; cases hv
    | ok vs =>
      rw [hvs] at hv
      simp only [bind, Except.bind] at hv
      cases hw : «выч» P M [] (.«вызов» f (vs.map .«лит»)) with
      | error q => rw [hw] at hv; cases hv
      | ok w =>
        rw [hw] at hv
        simp only [«держитсяД»] at h
        have hp := «послеВызова-верно» hs f ts k vs w hvs hw
        have hnv : «значВсех» σ res («нормВсе» s.«п».«замены» ts) = .ok vs := by
          rw [«нормВсе-верна» hs.2.1 ts]; exact hvs
        have hF0 := «сдвинутьФ-верно» hF k w
        have hz0 := «сдвинутьФ-флаг» hz k
        split at h
        · rename_i hzz
          exact «держитсяД-верно» P M σ «зовы» hH hσ rest _ ((k, w) :: res) u hp
            («записать-верно» hF0 true f _ vs hnv hw) («записать-флаг» hz0 k true f _ (fun _ => hzz)) h hv
        · exact «держитсяД-верно» P M σ «зовы» hH hσ rest _ ((k, w) :: res) u hp hF0 hz0 h hv
  | .«форма» f ts k rest, s, res, u, hs, hF, hz, h, hv => by
    simp only [«значДерева»] at hv
    cases hvs : «значВсех» σ res ts with
    | error q => rw [hvs] at hv; cases hv
    | ok vs =>
      rw [hvs] at hv
      simp only [bind, Except.bind] at hv
      cases hw : «форма» f vs with
      | error q => rw [hw] at hv; cases hv
      | ok w =>
        rw [hw] at hv
        simp only [«держитсяД»] at h
        have hp := «послеФормы-верно» hs f ts k vs w hvs hw
        have hnv : «значВсех» σ res («нормВсе» s.«п».«замены» ts) = .ok vs := by
          rw [«нормВсе-верна» hs.2.1 ts]; exact hvs
        exact «держитсяД-верно» P M σ «зовы» hH hσ rest _ ((k, w) :: res) u hp
          («записать-верно» («сдвинутьФ-верно» hF k w) false f _ vs hnv hw)
          («записать-флаг» («сдвинутьФ-флаг» hz k) k false f _ (fun e => by cases e)) h hv
  | .«свёртка» _ _ _ _ _, _, _, _, _, _, _, h, _ => by simp [«держитсяД»] at h
  | .«отбор» _ _ _ _, _, _, _, _, _, _, h, _ => by simp [«держитсяД»] at h
  | .«отображение» _ _ _ _, _, _, _, _, _, _, h, _ => by simp [«держитсяД»] at h

def «путьДПуст» : «ПутьД» := ⟨«путьПуст», []⟩

def «проверитьД» (P : «Программа») («зовы» : Bool) : Option «Дерево» → Bool
  | some d => «держитсяД» P «зовы» «путьДПуст» d
  | none => false

theorem «проверитьД-верно» (P : «Программа») (M : Nat) (σ : «Среда») («зовы» : Bool)
    (hH : «зовы» = true → «ПостусловияВызовов» P) (hσ : «КороткаСреда» σ) (o : Option «Дерево») (w : «Зн»)
    (h : «проверитьД» P «зовы» o = true) (hv : ∀ d, o = some d → «значДерева» P M σ [] d = .ok w) :
    w = .«признак» true := by
  cases o with
  | none => simp [«проверитьД»] at h
  | some d =>
    simp only [«проверитьД»] at h
    refine «держитсяД-верно» P M σ «зовы» hH hσ d «путьДПуст» [] w («путьПуст-верен» P M σ []) ?_ ?_ h (hv d rfl)
    · intro k c f ts hm; simp [«путьДПуст»] at hm
    · intro k f ts hm; simp [«путьДПуст»] at hm

def «цельДлин?» (P : «Программа») («зовы» : Bool) (g : «Функция») (q : «Постусловие») : Bool :=
  «проверитьД» P «зовы» («деревоЦели» g q) || «проверитьД» P «зовы» ((«деревоЦели» g q).bind («влитьВсё» P)) ||
    «проверитьД» P «зовы» («деревоЦелиСВлитым» P g q)

theorem «цель-длин-верна» (P : «Программа») («зовы» : Bool) (hH : «зовы» = true → «ПостусловияВызовов» P)
    (g : «Функция») (q : «Постусловие»)
    (h : «цельДлин?» P «зовы» g q = true) (vs : List «Зн») (hl : g.«параметры».length = vs.length)
    (hshort : «короткиеВсе» vs = true) (m m' : Nat) (v w : «Зн»)
    (hb : «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v)
    (hq : «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w) :
    w = .«признак» true := by
  let σ := «привязать» g.«параметры» vs
  have hσ : «КороткаСреда» σ := «привязать-коротка» g.«параметры» vs hshort
  have base : ∀ d, «деревоЦели» g q = some d → «значДерева» P (max m m') σ [] d = .ok w := by
    intro d hd
    refine «деревоЦели-значение» P g q vs hl m m' v w hb hq _ ?_ ?_ d hd
    · intro t n1 d' res' hd' _ _ _ d0 hd0 hv0
      rw [hd'] at hd0
      cases hd0
      exact hv0
    · intro t n1 d' hd'
      exact ⟨d', hd'⟩
  simp only [«цельДлин?», Bool.or_eq_true] at h
  rcases h with (h | h) | h
  · exact «проверитьД-верно» P (max m m') σ «зовы» hH hσ _ w h base
  · refine «проверитьД-верно» P (max m m') σ «зовы» hH hσ _ w h ?_
    intro d hd
    cases h0 : «деревоЦели» g q with
    | none => rw [h0] at hd; cases hd
    | some d0 =>
      rw [h0] at hd
      exact «влить-верно» P (max m m') σ _ d0 d [] w hd (base d0 h0)
  · refine «проверитьД-верно» P (max m m') σ «зовы» hH hσ _ w h ?_
    intro d hd
    refine «деревоЦели-значение» P g q vs hl m m' v w hb hq _ ?_ ?_ d hd
    · intro t n1 d' res' hd' _ _ _ d0 hd0 hv0
      rw [hd0] at hd'
      exact «влить-верно» P (max m m') σ _ d0 d' res' w hd' hv0
    · intro t n1 d' hd'
      split at hd'
      · rename_i d0 hd0
        exact ⟨d0, hd0⟩
      · cases hd'

def «длинаРавна?» (q : «Постусловие») : Bool :=
  match q.«выражение» with
  | .«двучлен» op (.«форма» n [.«имя» y]) _ => decide (op = "eq" ∧ n = "длина" ∧ y = q.«связка»)
  | _ => false

def «принятьДлины» (P : «Программа») («зовы» : Bool) («строки» : List String) (f «имя» : String) («строка» : Nat) :
    Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    decide («хозяинСтроки» «строки» «строка» = some f) &&
      ((«строкаИсходника» «строки» «строка»).splitOn
        ("обеспечивает «" ++ «имя» ++ "» (длина результат) равен ")).length > 1 &&
      g.«постусловия».any «длинаРавна?» &&
      (g.«постусловия».filter «длинаРавна?»).all («цельДлин?» P «зовы» g)

theorem «тождество-длин» (P : «Программа») («зовы» : Bool) (hH : «зовы» = true → «ПостусловияВызовов» P)
    («строки» : List String) (f «имя» : String) («строка» : Nat)
    (h : «принятьДлины» P «зовы» «строки» f «имя» «строка» = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧ «хозяинСтроки» «строки» «строка» = some f ∧
      ((«строкаИсходника» «строки» «строка»).splitOn
        ("обеспечивает «" ++ «имя» ++ "» (длина результат) равен ")).length > 1 ∧
      (∃ q ∈ g.«постусловия», «длинаРавна?» q = true) ∧
      ∀ q ∈ g.«постусловия», «длинаРавна?» q = true → ∀ vs, g.«параметры».length = vs.length →
        «короткиеВсе» vs = true → ∀ m m' v w,
        «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v →
        «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w →
        w = .«признак» true := by
  unfold «принятьДлины» at h
  cases hg : «функцияПрограммы» P f with
  | none => rw [hg] at h; cases h
  | some g =>
    rw [hg] at h
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true, List.any_eq_true, List.mem_filter] at h
    obtain ⟨⟨⟨hown, hline⟩, hany⟩, hall⟩ := h
    exact ⟨g, rfl, hown, hline, hany, fun q hq hd vs hl hs m m' v w hb hw =>
      «цель-длин-верна» P «зовы» hH g q (hall q ⟨hq, hd⟩) vs hl hs m m' v w hb hw⟩

theorem «тождество-длин-в-эталоне» (P : «Программа») («зовы» : Bool)
    («строки» : List String) (f «имя» : String) («строка» : Nat)
    (h : «принятьДлины» P «зовы» «строки» f «имя» «строка» = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧ «хозяинСтроки» «строки» «строка» = some f ∧
      ((«строкаИсходника» «строки» «строка»).splitOn
        ("обеспечивает «" ++ «имя» ++ "» (длина результат) равен ")).length > 1 ∧
      (∃ q ∈ g.«постусловия», «длинаРавна?» q = true) ∧
      ∀ q ∈ g.«постусловия», «длинаРавна?» q = true → ∀ vs, g.«параметры».length = vs.length →
        «короткиеВсе» vs = true → ∀ m m' v w,
        «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v →
        «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w →
        w = .«признак» true :=
  «тождество-длин» P «зовы» (fun _ => «эталон-проверяет-постусловия» P) «строки» f «имя» «строка» h

def «путьБазы» (x : String) : «Путь» := ⟨[(.«пусто?» (.«имя» x), true)], [], []⟩

def «проверитьС» (s : «Путь») : Option «Дерево» → Bool
  | some d => «держится» s d
  | none => false

def «базаПоПути?» (P : «Программа») (g : «Функция») (x : String) (q : «Постусловие») : Bool :=
  «проверитьС» («путьБазы» x) («деревоЦели» g q) ||
    «проверитьС» («путьБазы» x) ((«деревоЦели» g q).bind («влитьВсё» P)) ||
    «проверитьС» («путьБазы» x) («деревоЦелиСВлитым» P g q)

theorem «проверитьС-верно» (P : «Программа») (M : Nat) (σ : «Среда») (s : «Путь») (hs : «ВерныйПуть» P M σ [] s)
    (o : Option «Дерево») (w : «Зн») (h : «проверитьС» s o = true)
    (hv : ∀ d, o = some d → «значДерева» P M σ [] d = .ok w) : w = .«признак» true := by
  cases o with
  | none => simp [«проверитьС»] at h
  | some d =>
    simp only [«проверитьС»] at h
    exact «держится-верно» P M σ d s [] w hs h (hv d rfl)

theorem «база-по-пути-верна» (P : «Программа») (g : «Функция») (x : String) (q : «Постусловие»)
    (h : «базаПоПути?» P g x q = true) (vs : List «Зн») (hl : g.«параметры».length = vs.length)
    (u : «Зн») (hx : «найти» x («привязать» g.«параметры» vs) = some u) (hu : «пустой» u = true)
    (m m' : Nat) (v w : «Зн»)
    (hb : «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v)
    (hq : «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w) :
    w = .«признак» true := by
  let σ := «привязать» g.«параметры» vs
  have hs : ∀ M, «ВерныйПуть» P M σ [] («путьБазы» x) := by
    intro M
    refine ⟨?_, ?_, ?_⟩
    · intro t b hm
      simp only [«путьБазы», List.mem_singleton, Prod.mk.injEq] at hm
      obtain ⟨rfl, rfl⟩ := hm
      simp [«значТерм», σ, hx, hu, bind, Except.bind, pure, Except.pure]
    · intro k t hm; simp [«путьБазы»] at hm
    · intro f ts k hm; simp [«путьБазы»] at hm
  have base : ∀ d, «деревоЦели» g q = some d → «значДерева» P (max m m') σ [] d = .ok w := by
    intro d hd
    refine «деревоЦели-значение» P g q vs hl m m' v w hb hq _ ?_ ?_ d hd
    · intro t n1 d' res' hd' _ _ _ d0 hd0 hv0
      rw [hd'] at hd0
      cases hd0
      exact hv0
    · intro t n1 d' hd'
      exact ⟨d', hd'⟩
  simp only [«базаПоПути?», Bool.or_eq_true] at h
  rcases h with (h | h) | h
  · exact «проверитьС-верно» P (max m m') σ _ (hs _) _ w h base
  · refine «проверитьС-верно» P (max m m') σ _ (hs _) _ w h ?_
    intro d hd
    cases h0 : «деревоЦели» g q with
    | none => rw [h0] at hd; cases hd
    | some d0 =>
      rw [h0] at hd
      exact «влить-верно» P (max m m') σ _ d0 d [] w hd (base d0 h0)
  · refine «проверитьС-верно» P (max m m') σ _ (hs _) _ w h ?_
    intro d hd
    refine «деревоЦели-значение» P g q vs hl m m' v w hb hq _ ?_ ?_ d hd
    · intro t n1 d' res' hd' _ _ _ d0 hd0 hv0
      rw [hd0] at hd'
      exact «влить-верно» P (max m m') σ _ d0 d' res' w hd' hv0
    · intro t n1 d' hd'
      split at hd'
      · rename_i d0 hd0
        exact ⟨d0, hd0⟩
      · cases hd'

namespace «ПробыДлин»

def «ч» (k : Nat) : «Выр» := .«лит» (.«число» («изЦелого» k))

def «длина» (x : String) : «Выр» := .«форма» "длина" [.«имя» x]

def «пост» (r : «Выр») : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY", «выражение» := .«двучлен» "eq" («длина» "результат") r }

def «поСписку» (x : String) (b : «Выр») : «Выр» :=
  .«разбор» (.«имя» x) [(.«пусто», .«список» []), (.«звено» (some "г") (some "х"), b)]

def «ф» (n : String) (ps : List String) (b : «Выр») (qs : List «Постусловие») : «Функция» :=
  { «имя» := n, «параметры» := ps, «тело» := b, «постусловия» := qs }

def «вХвост» (b : «Выр») : «Функция» := «ф» "В хвост" ["элементы"] («поСписку» "элементы" b) [«пост» («длина» "элементы")]

def «добавитьГ» : «Выр» := .«форма» "добавить" [.«имя» "г", .«имя» "х"]

def «строкой» (b : «Выр») : «Функция» :=
  «ф» "Снова" ["текст"] (.«разбор» (.«имя» "текст") [(.«пусто», .«лит» (.«строка» "")), (.«звено» (some "г") (some "х"), b)])
    [«пост» («длина» "текст")]

def «дописать» (q : List «Постусловие») : «Функция» :=
  «ф» "Дописать" ["звенья"]
    (.«разбор» (.«имя» "звенья") [(.«пусто», .«список» [«ч» 0]),
      (.«звено» none (some "х"), .«форма» "приписать" [«ч» 0, .«вызов» "Дописать" [.«имя» "х"]])]) q

def «плюсОдин» : «Постусловие» := «пост» (.«двучлен» "add" («длина» "звенья") («ч» 1))

def «двадцать» : «Функция» :=
  { «имя» := "Двадцать", «параметры» := [], «тело» := .«список» ((List.range 20).map «ч»),
    «постусловия» := [«пост» («ч» 20)] }

#guard «цельДлин?» [] false («вХвост» «добавитьГ») («пост» («длина» "элементы"))
#guard !«цельДлин?» [] false («вХвост» (.«форма» "добавить" [.«имя» "г", «добавитьГ»])) («пост» («длина» "элементы"))
#guard !«цельДлин?» [] false («вХвост» (.«имя» "х")) («пост» («длина» "элементы"))
#guard «цельДлин?» [] false («строкой» (.«двучлен» "concat" (.«имя» "г") (.«имя» "х"))) («пост» («длина» "текст"))
#guard !«цельДлин?» [] false («строкой» (.«двучлен» "concat" (.«имя» "г") (.«имя» "г"))) («пост» («длина» "текст"))
#guard !«цельДлин?» [] false («строкой» (.«двучлен» "concat" (.«имя» "х") (.«имя» "х"))) («пост» («длина» "текст"))
#guard !«цельДлин?» [] false («строкой» (.«форма» "соединить" [.«имя» "г", .«имя» "х"])) («пост» («длина» "текст"))
#guard «цельДлин?» [«дописать» [«плюсОдин»]] true («дописать» [«плюсОдин»]) «плюсОдин»
#guard !«цельДлин?» [«дописать» [«плюсОдин»]] false («дописать» [«плюсОдин»]) «плюсОдин»
#guard !«цельДлин?» [«дописать» []] true («дописать» [«плюсОдин»]) «плюсОдин»
#guard !«цельДлин?» [] false «двадцать» («пост» («ч» 20))
def «постНН» : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY", «выражение» := .«двучлен» "gte" (.«имя» "результат") («ч» 0) }

def «индекс» (b : «Выр») : «Функция» :=
  «ф» "Индекс" ["элементы", "значение"]
    (.«разбор» (.«имя» "элементы") [(.«пусто», b), (.«звено» (some "г") (some "х"), .«имя» "значение")]) [«постНН»]

#guard «базаПоПути?» [] («индекс» («ч» 0)) "элементы" «постНН»
#guard !«базаПоПути?» [] («индекс» (.«имя» "значение")) "элементы" «постНН»
#guard !«базаПоПути?» [] («индекс» («ч» 0)) "значение" «постНН»
#guard !«цельПоУсловию?» [] («индекс» («ч» 0)) «постНН»
#guard «принятьДлины» [«вХвост» «добавитьГ»] false
  ["функция «В хвост»", "  обеспечивает «мера» (длина результат) равен (длина элементы)"] "В хвост" "мера" 2
#guard !«принятьДлины» [«вХвост» «добавитьГ»] false
  ["функция «В хвост»", "  обеспечивает «мера» (длина результат) не больше (длина элементы)"] "В хвост" "мера" 2

end «ПробыДлин»

end «Эталон»
