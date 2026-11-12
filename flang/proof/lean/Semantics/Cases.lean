import Semantics.Bridge
import Semantics.Tables
import Semantics.Unfold

set_option linter.unusedVariables false

namespace «Эталон»

mutual
def «замкнут» : «Терм» → Bool
  | .«знач» _ => true
  | .«имя» _ => false
  | .«рез» _ => false
  | .«двучлен» _ a b => «замкнут» a && «замкнут» b
  | .«вариант?» _ t => «замкнут» t
  | .«пусто?» t => «замкнут» t
  | .«звено?» t => «замкнут» t
  | .«голова» t => «замкнут» t
  | .«хвост» t => «замкнут» t
  | .«поле» _ t => «замкнут» t
  | .«список» ts => «замкнутыВсе» ts
def «замкнутыВсе» : List «Терм» → Bool
  | [] => true
  | t :: r => «замкнут» t && «замкнутыВсе» r
end

mutual
theorem «замкнут-верен» (σ : «Среда») (res : «Итоги») :
    ∀ t, «замкнут» t = true → «значТерм» σ res t = «значТерм» [] [] t
  | .«знач» _, _ => by simp [«значТерм»]
  | .«имя» _, h => by simp [«замкнут»] at h
  | .«рез» _, h => by simp [«замкнут»] at h
  | .«двучлен» op a b, h => by
    simp only [«замкнут», Bool.and_eq_true] at h
    simp only [«значТерм», «замкнут-верен» σ res a h.1, «замкнут-верен» σ res b h.2]
  | .«вариант?» k t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«пусто?» t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«звено?» t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«голова» t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«хвост» t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«поле» f t, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнут-верен» σ res t h]
  | .«список» ts, h => by
    simp only [«замкнут»] at h; simp only [«значТерм», «замкнутыВсе-верны» σ res ts h]
theorem «замкнутыВсе-верны» (σ : «Среда») (res : «Итоги») :
    ∀ ts, «замкнутыВсе» ts = true → «значВсех» σ res ts = «значВсех» [] [] ts
  | [], _ => by simp [«значВсех»]
  | t :: r, h => by
    simp only [«замкнутыВсе», Bool.and_eq_true] at h
    simp only [«значВсех», «замкнут-верен» σ res t h.1, «замкнутыВсе-верны» σ res r h.2]
end

def «искать» (c : «Терм») : List («Терм» × Bool) → Option Bool
  | [] => none
  | (t, b) :: r => if «равноТерм» t c then some b else «искать» c r

def «решено» (Φ : List («Терм» × Bool)) (c : «Терм») : Option Bool :=
  match «искать» c Φ with
  | some b => some b
  | none =>
    if «замкнут» c then
      match «значТерм» [] [] c with
      | .ok (.«признак» b) => some b
      | _ => none
    else none

mutual
def «естьРез» (k : Nat) : «Терм» → Bool
  | .«знач» _ => false
  | .«имя» _ => false
  | .«рез» j => j == k
  | .«двучлен» _ a b => «естьРез» k a || «естьРез» k b
  | .«вариант?» _ t => «естьРез» k t
  | .«пусто?» t => «естьРез» k t
  | .«звено?» t => «естьРез» k t
  | .«голова» t => «естьРез» k t
  | .«хвост» t => «естьРез» k t
  | .«поле» _ t => «естьРез» k t
  | .«список» ts => «естьРезВсе» k ts
def «естьРезВсе» (k : Nat) : List «Терм» → Bool
  | [] => false
  | t :: r => «естьРез» k t || «естьРезВсе» k r
end

def «Верны» (σ : «Среда») (res : «Итоги») (Φ : List («Терм» × Bool)) : Prop :=
  ∀ t b, (t, b) ∈ Φ → «значТерм» σ res t = .ok (.«признак» b)

theorem «искать-верно» {c : «Терм»} {b : Bool} :
    ∀ {Φ : List («Терм» × Bool)}, «искать» c Φ = some b → (c, b) ∈ Φ
  | [], h => by simp [«искать»] at h
  | (t, b') :: r, h => by
    simp only [«искать»] at h
    split at h
    · rename_i ht
      have := «равноТерм-верно» _ _ ht
      subst this
      simp only [Option.some.injEq] at h
      subst h
      exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ («искать-верно» h)

theorem «решено-верно» {σ : «Среда»} {res : «Итоги»} {Φ : List («Терм» × Bool)} (hΦ : «Верны» σ res Φ)
    {c : «Терм»} {b : Bool} (h : «решено» Φ c = some b) : «значТерм» σ res c = .ok (.«признак» b) := by
  unfold «решено» at h
  cases hs : «искать» c Φ with
  | some b' =>
    rw [hs] at h
    simp only [Option.some.injEq] at h
    subst h
    exact hΦ c b' («искать-верно» hs)
  | none =>
    rw [hs] at h
    simp only at h
    split at h
    · rename_i hz
      rw [«замкнут-верен» σ res c hz]
      split at h
      · rename_i b' hv
        simp only [Option.some.injEq] at h
        subst h
        exact hv
      · cases h
    · cases h

theorem «верны-добавить» {σ : «Среда»} {res : «Итоги»} {Φ : List («Терм» × Bool)} (hΦ : «Верны» σ res Φ)
    {c : «Терм»} {b : Bool} (h : «значТерм» σ res c = .ok (.«признак» b)) : «Верны» σ res ((c, b) :: Φ) := by
  intro t b' hm
  rcases List.mem_cons.mp hm with he | hm
  · cases he; exact h
  · exact hΦ t b' hm

mutual
theorem «без-реза» (σ : «Среда») (res : «Итоги») (k : Nat) (w : «Зн») :
    ∀ t, «естьРез» k t = false → «значТерм» σ ((k, w) :: res) t = «значТерм» σ res t
  | .«знач» _, _ => by simp [«значТерм»]
  | .«имя» _, _ => by simp [«значТерм»]
  | .«рез» j, h => by
    simp only [«естьРез», beq_eq_false_iff_ne, ne_eq] at h
    simp only [«значТерм», «взять»]
    have : (k = j) = False := by
      apply propext; constructor
      · intro e; exact h e.symm
      · intro f; exact f.elim
    simp [this]
  | .«двучлен» op a b, h => by
    simp only [«естьРез», Bool.or_eq_false_iff] at h
    simp only [«значТерм», «без-реза» σ res k w a h.1, «без-реза» σ res k w b h.2]
  | .«вариант?» m t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«пусто?» t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«звено?» t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«голова» t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«хвост» t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«поле» f t, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза» σ res k w t h]
  | .«список» ts, h => by
    simp only [«естьРез»] at h; simp only [«значТерм», «без-реза-все» σ res k w ts h]
theorem «без-реза-все» (σ : «Среда») (res : «Итоги») (k : Nat) (w : «Зн») :
    ∀ ts, «естьРезВсе» k ts = false → «значВсех» σ ((k, w) :: res) ts = «значВсех» σ res ts
  | [], _ => by simp [«значВсех»]
  | t :: r, h => by
    simp only [«естьРезВсе», Bool.or_eq_false_iff] at h
    simp only [«значВсех», «без-реза» σ res k w t h.1, «без-реза-все» σ res k w r h.2]
end

mutual
def «безРез» : «Терм» → Bool
  | .«знач» _ => true
  | .«имя» _ => true
  | .«рез» _ => false
  | .«двучлен» _ a b => «безРез» a && «безРез» b
  | .«вариант?» _ t => «безРез» t
  | .«пусто?» t => «безРез» t
  | .«звено?» t => «безРез» t
  | .«голова» t => «безРез» t
  | .«хвост» t => «безРез» t
  | .«поле» _ t => «безРез» t
  | .«список» ts => «безРезВсе» ts
def «безРезВсе» : List «Терм» → Bool
  | [] => true
  | t :: r => «безРез» t && «безРезВсе» r
end

mutual
theorem «безРез-верен» (σ : «Среда») (res res' : «Итоги») :
    ∀ t, «безРез» t = true → «значТерм» σ res t = «значТерм» σ res' t
  | .«знач» _, _ => rfl
  | .«имя» _, _ => rfl
  | .«рез» _, h => by simp [«безРез»] at h
  | .«двучлен» op a b, h => by
    simp only [«безРез», Bool.and_eq_true] at h
    simp only [«значТерм», «безРез-верен» σ res res' a h.1, «безРез-верен» σ res res' b h.2]
  | .«вариант?» k t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«пусто?» t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«звено?» t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«голова» t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«хвост» t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«поле» f t, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРез-верен» σ res res' t h]
  | .«список» ts, h => by
    simp only [«безРез»] at h; simp only [«значТерм», «безРезВсе-верны» σ res res' ts h]
theorem «безРезВсе-верны» (σ : «Среда») (res res' : «Итоги») :
    ∀ ts, «безРезВсе» ts = true → «значВсех» σ res ts = «значВсех» σ res' ts
  | [], _ => rfl
  | t :: r, h => by
    simp only [«безРезВсе», Bool.and_eq_true] at h
    simp only [«значВсех», «безРез-верен» σ res res' t h.1, «безРезВсе-верны» σ res res' r h.2]
end

def «искатьРез» (k : Nat) : List (Nat × «Терм») → Option «Терм»
  | [] => none
  | (j, t) :: r => if j = k then some t else «искатьРез» k r

theorem «искатьРез-член» {k : Nat} {t : «Терм»} :
    ∀ {R : List (Nat × «Терм»)}, «искатьРез» k R = some t → (k, t) ∈ R
  | [], h => by simp [«искатьРез»] at h
  | (j, t') :: r, h => by
    simp only [«искатьРез»] at h
    split at h
    · rename_i hj
      subst hj
      simp only [Option.some.injEq] at h
      subst h
      exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ («искатьРез-член» h)

mutual
def «норм» (R : List (Nat × «Терм»)) : «Терм» → «Терм»
  | .«знач» v => .«знач» v
  | .«имя» x => .«имя» x
  | .«рез» k =>
    match «искатьРез» k R with
    | some t => t
    | none => .«рез» k
  | .«двучлен» op a b => .«двучлен» op («норм» R a) («норм» R b)
  | .«вариант?» m t => .«вариант?» m («норм» R t)
  | .«пусто?» t => .«пусто?» («норм» R t)
  | .«звено?» t => .«звено?» («норм» R t)
  | .«голова» t => .«голова» («норм» R t)
  | .«хвост» t => .«хвост» («норм» R t)
  | .«поле» f t => .«поле» f («норм» R t)
  | .«список» ts => .«список» («нормВсе» R ts)
def «нормВсе» (R : List (Nat × «Терм»)) : List «Терм» → List «Терм»
  | [] => []
  | t :: r => «норм» R t :: «нормВсе» R r
end

def «ВерныЗамены» (σ : «Среда») (res : «Итоги») (R : List (Nat × «Терм»)) : Prop :=
  ∀ k t, (k, t) ∈ R → ∃ w, «взять» k res = some w ∧ «значТерм» σ res t = .ok w

mutual
theorem «норм-верна» {σ : «Среда»} {res : «Итоги»} {R : List (Nat × «Терм»)} (hR : «ВерныЗамены» σ res R) :
    ∀ t, «значТерм» σ res («норм» R t) = «значТерм» σ res t
  | .«знач» _ => rfl
  | .«имя» _ => rfl
  | .«рез» k => by
    cases h : «искатьРез» k R with
    | none => simp only [«норм», h]
    | some t =>
      obtain ⟨w, hw, ht⟩ := hR k t («искатьРез-член» h)
      simp only [«норм», h, ht, «значТерм», hw]
  | .«двучлен» op a b => by simp only [«норм», «значТерм», «норм-верна» hR a, «норм-верна» hR b]
  | .«вариант?» m t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«пусто?» t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«звено?» t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«голова» t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«хвост» t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«поле» f t => by simp only [«норм», «значТерм», «норм-верна» hR t]
  | .«список» ts => by simp only [«норм», «значТерм», «нормВсе-верна» hR ts]
theorem «нормВсе-верна» {σ : «Среда»} {res : «Итоги»} {R : List (Nat × «Терм»)} (hR : «ВерныЗамены» σ res R) :
    ∀ ts, «значВсех» σ res («нормВсе» R ts) = «значВсех» σ res ts
  | [] => rfl
  | t :: r => by simp only [«нормВсе», «значВсех», «норм-верна» hR t, «нормВсе-верна» hR r]
end

def «искатьВызов» (f : String) (ts : List «Терм») : List (String × List «Терм» × Nat) → Option Nat
  | [] => none
  | (g, us, k) :: r => if f = g ∧ «равноТермов» us ts = true then some k else «искатьВызов» f ts r

theorem «искатьВызов-член» {f : String} {ts : List «Терм»} {k : Nat} :
    ∀ {C : List (String × List «Терм» × Nat)}, «искатьВызов» f ts C = some k → (f, ts, k) ∈ C
  | [], h => by simp [«искатьВызов»] at h
  | (g, us, j) :: r, h => by
    simp only [«искатьВызов»] at h
    split at h
    · rename_i hc
      obtain ⟨hf, hu⟩ := hc
      have := «равноТермов-верно» _ _ hu
      subst this
      subst hf
      simp only [Option.some.injEq] at h
      subst h
      exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ («искатьВызов-член» h)

structure «Путь» where
  «факты» : List («Терм» × Bool)
  «замены» : List (Nat × «Терм»)
  «вызовы» : List (String × List «Терм» × Nat)

def «ВерныйПуть» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») (s : «Путь») : Prop :=
  «Верны» σ res s.«факты» ∧ «ВерныЗамены» σ res s.«замены» ∧
    ∀ f ts k, (f, ts, k) ∈ s.«вызовы» → «безРезВсе» ts = true ∧ ∃ vs w, «значВсех» σ res ts = .ok vs ∧
      «взять» k res = some w ∧ «выч» P M [] (.«вызов» f (vs.map .«лит»)) = .ok w

def «сдвинуть» (k : Nat) (s : «Путь») : «Путь» :=
  ⟨s.«факты».filter (fun p => !«естьРез» k p.1),
   s.«замены».filter (fun p => !(p.1 == k) && !«естьРез» k p.2),
   s.«вызовы».filter (fun p => !(p.2.2 == k))⟩

theorem «взять-мимо» {k j : Nat} (w : «Зн») (res : «Итоги») (h : j ≠ k) : «взять» j ((k, w) :: res) = «взять» j res := by
  simp only [«взять»]
  split
  · rename_i e; exact absurd e.symm h
  · rfl

theorem «сдвинуть-верно» {P : «Программа»} {M : Nat} {σ : «Среда»} {res : «Итоги»} {s : «Путь»}
    (h : «ВерныйПуть» P M σ res s) (k : Nat) (w : «Зн») : «ВерныйПуть» P M σ ((k, w) :: res) («сдвинуть» k s) := by
  obtain ⟨hΦ, hR, hC⟩ := h
  refine ⟨?_, ?_, ?_⟩
  · intro t b hm
    simp only [«сдвинуть», List.mem_filter, Bool.not_eq_true'] at hm
    rw [«без-реза» σ res k w t hm.2]
    exact hΦ t b hm.1
  · intro j t hm
    simp only [«сдвинуть», List.mem_filter, Bool.and_eq_true, Bool.not_eq_true', beq_eq_false_iff_ne] at hm
    obtain ⟨hm, hj, ht⟩ := hm
    obtain ⟨u, hu, htu⟩ := hR j t hm
    refine ⟨u, ?_, ?_⟩
    · rw [«взять-мимо» w res hj]; exact hu
    · rw [«без-реза» σ res k w t ht]; exact htu
  · intro f ts j hm
    simp only [«сдвинуть», List.mem_filter, Bool.not_eq_true', beq_eq_false_iff_ne] at hm
    obtain ⟨hm, hj⟩ := hm
    obtain ⟨hb, vs, u, hvs, hu, hc⟩ := hC f ts j hm
    refine ⟨hb, vs, u, ?_, ?_, hc⟩
    · rw [«безРезВсе-верны» σ ((k, w) :: res) res ts hb]; exact hvs
    · rw [«взять-мимо» w res hj]; exact hu

def «числоЛи» : «Зн» → Bool
  | .«число» _ => true
  | _ => false

def «плоское» : «Зн» → Bool
  | .«число» _ => true
  | .«строка» _ => true
  | .«признак» _ => true
  | .«ничто» => true
  | .«список» l => l.all «числоЛи»
  | _ => false

theorem «равныСписки-числа» : ∀ l : List «Зн», (∀ z ∈ l, «числоЛи» z = true) → «равныСписки» l l = true
  | [], _ => by simp [«равныСписки»]
  | z :: r, h => by
    have hz := h z List.mem_cons_self
    have hr := «равныСписки-числа» r (fun y hy => h y (List.mem_cons_of_mem _ hy))
    cases z with
    | «число» d => simp [«равныСписки», «равны», «равен64», hr]
    | _ => simp [«числоЛи»] at hz

theorem «равны-плоское» : ∀ v : «Зн», «плоское» v = true → «равны» v v = true
  | .«число» d, _ => by simp [«равны», «равен64»]
  | .«строка» s, _ => by simp [«равны»]
  | .«признак» b, _ => by simp [«равны»]
  | .«ничто», _ => by simp [«равны»]
  | .«список» l, h => by
    simp only [«плоское», List.all_eq_true] at h
    simp only [«равны»]
    exact «равныСписки-числа» l h
  | .«запись» _, h => by simp [«плоское»] at h
  | .«вариант» _ _, h => by simp [«плоское»] at h

theorem «разряды-числа» (n : Nat) : ∀ z ∈ «числоВРазряды» n, «числоЛи» z = true := by
  intro z hz
  unfold «числоВРазряды» at hz
  split at hz
  · simp at hz
  · rename_i hn
    rcases List.mem_cons.mp hz with hz | hz
    · subst hz; rfl
    · exact «разряды-числа» _ z hz
termination_by n
decreasing_by unfold «основание»; omega

theorem «точныйСчёт-плоский» (op : String) (a b : Nat) (u : «Зн») (h : «точныйСчёт» op a b = .ok u) :
    «плоское» u = true := by
  unfold «точныйСчёт» at h
  split at h
  · cases h; simp only [«плоское», List.all_eq_true]; exact «разряды-числа» _
  · cases h; simp only [«плоское», List.all_eq_true]; exact «разряды-числа» _
  · split at h
    · simp [«беда»] at h
    · cases h; simp only [«плоское», List.all_eq_true]; exact «разряды-числа» _
  · split at h
    · simp [«беда»] at h
    · cases h; simp only [«плоское», List.all_eq_true]; exact «разряды-числа» _
  · simp [«беда»] at h

theorem «двучлен-плоский» (op : String) (x y u : «Зн») (h : «двучлен» op x y = .ok u) : «плоское» u = true := by
  unfold «двучлен» at h
  split at h
  · cases h; rfl
  split at h
  · cases h; rfl
  split at h
  · split at h
    · cases h; rfl
    · simp [«беда»] at h
  split at h
  · simp [«вне»] at h
  split at h
  · split at h
    · cases h; rfl
    · simp [«вне»] at h
    · split at h
      · cases h; rfl
      · simp [«беда»] at h
  split at h
  · split at h
    · split at h
      · cases h; rfl
      · simp [«беда»] at h
    · simp [«беда»] at h
  · split at h
    · exact «точныйСчёт-плоский» _ _ _ _ h
    · simp [«вне»] at h
    · split at h
      · split at h
        · cases h; rfl
        · simp [«беда»] at h
      · simp [«беда»] at h

def «двучленЛи» : «Терм» → Bool
  | .«двучлен» _ _ _ => true
  | _ => false

def «рефл?» : «Терм» → Bool
  | .«двучлен» op a b => decide (op = "eq") && «равноТерм» a b && «двучленЛи» a
  | _ => false

theorem «рефл-верно» {σ : «Среда»} {res : «Итоги»} {t : «Терм»} {u : «Зн»} (h : «рефл?» t = true)
    (hv : «значТерм» σ res t = .ok u) : u = .«признак» true := by
  cases t with
  | «двучлен» op a b =>
    simp only [«рефл?», Bool.and_eq_true, decide_eq_true_eq] at h
    obtain ⟨⟨hop, hab⟩, ha⟩ := h
    have := «равноТерм-верно» _ _ hab
    subst this
    subst hop
    cases a with
    | «двучлен» op2 a1 a2 =>
      simp only [«значТерм»] at hv
      cases h1 : «значТерм» σ res a1 with
      | error q => rw [h1] at hv; cases hv
      | ok x1 =>
        cases h2 : «значТерм» σ res a2 with
        | error q => rw [h1, h2] at hv; cases hv
        | ok x2 =>
          rw [h1, h2] at hv
          simp only [bind, Except.bind] at hv
          cases h3 : «двучлен» op2 x1 x2 with
          | error q => rw [h3] at hv; cases hv
          | ok x =>
            rw [h3] at hv
            simp only [«двучлен», ↓reduceIte, Except.ok.injEq] at hv
            subst hv
            rw [«равны-плоское» x («двучлен-плоский» op2 x1 x2 x h3)]
    | _ => simp [«двучленЛи»] at ha
  | _ => simp [«рефл?»] at h

def «головаОдного?» (f : String) (ts : List «Терм») : Option «Терм» :=
  if f = "голова" then
    match ts with
    | [.«список» [t]] => some t
    | _ => none
  else none

def «держится» : «Путь» → «Дерево» → Bool
  | s, .«лист» t =>
    «решено» s.«факты» («норм» s.«замены» t) == some true || «рефл?» («норм» s.«замены» t)
  | _, .«отказ» _ => true
  | s, .«если» c a b =>
    match «решено» s.«факты» («норм» s.«замены» c) with
    | some true => «держится» s a
    | some false => «держится» s b
    | none =>
      «держится» ⟨(«норм» s.«замены» c, true) :: s.«факты», s.«замены», s.«вызовы»⟩ a &&
        «держится» ⟨(«норм» s.«замены» c, false) :: s.«факты», s.«замены», s.«вызовы»⟩ b
  | s, .«вызов» f ts k rest =>
    if «безРезВсе» («нормВсе» s.«замены» ts) then
      match «искатьВызов» f («нормВсе» s.«замены» ts) («сдвинуть» k s).«вызовы» with
      | some j =>
        «держится» ⟨(«сдвинуть» k s).«факты», (k, .«рез» j) :: («сдвинуть» k s).«замены»,
          (f, «нормВсе» s.«замены» ts, k) :: («сдвинуть» k s).«вызовы»⟩ rest
      | none =>
        «держится» ⟨(«сдвинуть» k s).«факты», («сдвинуть» k s).«замены»,
          (f, «нормВсе» s.«замены» ts, k) :: («сдвинуть» k s).«вызовы»⟩ rest
    else «держится» («сдвинуть» k s) rest
  | s, .«форма» f ts k rest =>
    match «головаОдного?» f ts with
    | some t =>
      if «естьРез» k («норм» s.«замены» t) then «держится» («сдвинуть» k s) rest
      else «держится» ⟨(«сдвинуть» k s).«факты», (k, «норм» s.«замены» t) :: («сдвинуть» k s).«замены»,
        («сдвинуть» k s).«вызовы»⟩ rest
    | none => «держится» («сдвинуть» k s) rest
  | _, _ => false

theorem «голова-одного» : ∀ (x : «Зн»), «форма» "голова" [.«список» [x]] = .ok x := by
  intro x; simp [«форма»]

theorem «головаОдного-вид» {f : String} {ts : List «Терм»} {t : «Терм»} (h : «головаОдного?» f ts = some t) :
    f = "голова" ∧ ts = [.«список» [t]] := by
  unfold «головаОдного?» at h
  split at h
  · rename_i hf
    split at h
    · rename_i t0
      simp only [Option.some.injEq] at h
      subst h
      exact ⟨hf, rfl⟩
    · cases h
  · cases h

theorem «держится-верно» (P : «Программа») (M : Nat) (σ : «Среда») :
    ∀ (d : «Дерево») (s : «Путь») (res : «Итоги») (u : «Зн»),
      «ВерныйПуть» P M σ res s → «держится» s d = true → «значДерева» P M σ res d = .ok u → u = .«признак» true
  | .«лист» t, s, res, u, hs, h, hv => by
    simp only [«значДерева»] at hv
    have hn := «норм-верна» hs.2.1 t
    simp only [«держится», Bool.or_eq_true, beq_iff_eq] at h
    rcases h with h | h
    · have := «решено-верно» hs.1 h
      rw [hn, hv] at this
      cases this
      rfl
    · rw [← hn] at hv
      exact «рефл-верно» h hv
  | .«отказ» k, s, res, u, hs, h, hv => by
    simp only [«значДерева», «беда»] at hv
    cases hv
  | .«если» c a b, s, res, u, hs, h, hv => by
    simp only [«значДерева»] at hv
    have hn := «норм-верна» hs.2.1 c
    cases hc : «значТерм» σ res c with
    | error q => rw [hc] at hv; cases hv
    | ok cv =>
      rw [hc] at hv
      simp only [bind, Except.bind] at hv
      simp only [«держится»] at h
      cases hr : «решено» s.«факты» («норм» s.«замены» c) with
      | some bb =>
        rw [hr] at h
        have hcb := «решено-верно» hs.1 hr
        rw [hn, hc] at hcb
        cases hcb
        cases bb with
        | true => exact «держится-верно» P M σ a s res u hs h hv
        | false => exact «держится-верно» P M σ b s res u hs h hv
      | none =>
        rw [hr] at h
        simp only [Bool.and_eq_true] at h
        cases cv with
        | «признак» bb =>
          have hf : «значТерм» σ res («норм» s.«замены» c) = .ok (.«признак» bb) := by rw [hn, hc]
          cases bb with
          | true =>
            exact «держится-верно» P M σ a ⟨(«норм» s.«замены» c, true) :: s.«факты», s.«замены», s.«вызовы»⟩ res u
              ⟨«верны-добавить» hs.1 hf, hs.2.1, hs.2.2⟩ h.1 hv
          | false =>
            exact «держится-верно» P M σ b ⟨(«норм» s.«замены» c, false) :: s.«факты», s.«замены», s.«вызовы»⟩ res u
              ⟨«верны-добавить» hs.1 hf, hs.2.1, hs.2.2⟩ h.2 hv
        | _ => simp [«беда»] at hv
  | .«вызов» f ts k rest, s, res, u, hs, h, hv => by
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
        have h0 := «сдвинуть-верно» hs k w
        simp only [«держится»] at h
        split at h
        · rename_i hb
          have hvs' : «значВсех» σ ((k, w) :: res) («нормВсе» s.«замены» ts) = .ok vs := by
            rw [«безРезВсе-верны» σ ((k, w) :: res) res _ hb, «нормВсе-верна» hs.2.1 ts]
            exact hvs
          have hk : «взять» k ((k, w) :: res) = some w := by simp [«взять»]
          have hC : ∀ f' ts' j, (f', ts', j) ∈ (f, «нормВсе» s.«замены» ts, k) :: («сдвинуть» k s).«вызовы» →
              «безРезВсе» ts' = true ∧ ∃ vs w', «значВсех» σ ((k, w) :: res) ts' = .ok vs ∧
                «взять» j ((k, w) :: res) = some w' ∧ «выч» P M [] (.«вызов» f' (vs.map .«лит»)) = .ok w' := by
            intro f' ts' j hm
            rcases List.mem_cons.mp hm with he | hm
            · cases he
              exact ⟨hb, vs, w, hvs', hk, hw⟩
            · exact h0.2.2 f' ts' j hm
          split at h
          · rename_i j hj
            obtain ⟨_, vs0, w0, hvs0, hw0, hc0⟩ := h0.2.2 f _ j («искатьВызов-член» hj)
            rw [hvs'] at hvs0
            cases hvs0
            rw [hw] at hc0
            cases hc0
            refine «держится-верно» P M σ rest ⟨(«сдвинуть» k s).«факты», (k, .«рез» j) :: («сдвинуть» k s).«замены»,
              (f, «нормВсе» s.«замены» ts, k) :: («сдвинуть» k s).«вызовы»⟩ ((k, w) :: res) u ⟨h0.1, ?_, hC⟩ h hv
            intro k' t hm
            rcases List.mem_cons.mp hm with he | hm
            · cases he
              exact ⟨w, hk, by simp [«значТерм», hw0]⟩
            · exact h0.2.1 k' t hm
          · exact «держится-верно» P M σ rest ⟨(«сдвинуть» k s).«факты», («сдвинуть» k s).«замены»,
              (f, «нормВсе» s.«замены» ts, k) :: («сдвинуть» k s).«вызовы»⟩ ((k, w) :: res) u ⟨h0.1, h0.2.1, hC⟩ h hv
        · exact «держится-верно» P M σ rest _ ((k, w) :: res) u h0 h hv
  | .«форма» f ts k rest, s, res, u, hs, h, hv => by
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
        have h0 := «сдвинуть-верно» hs k w
        simp only [«держится»] at h
        split at h
        · rename_i t ht
          split at h
          · exact «держится-верно» P M σ rest _ ((k, w) :: res) u h0 h hv
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
              refine «держится-верно» P M σ rest ⟨(«сдвинуть» k s).«факты», (k, «норм» s.«замены» t) :: («сдвинуть» k s).«замены»,
                («сдвинуть» k s).«вызовы»⟩ ((k, x) :: res) u ⟨h0.1, ?_, h0.2.2⟩ h hv
              intro k' t' hm
              rcases List.mem_cons.mp hm with he | hm
              · cases he
                refine ⟨x, by simp [«взять»], ?_⟩
                rw [«без-реза» σ res k x _ (by simpa using hkt), «норм-верна» hs.2.1 t]
                exact hx
              · exact h0.2.1 k' t' hm
        · exact «держится-верно» P M σ rest _ ((k, w) :: res) u h0 h hv
  | .«свёртка» _ _ _ _ _, _, _, _, _, h, _ => by simp [«держится»] at h
  | .«отбор» _ _ _ _, _, _, _, _, h, _ => by simp [«держится»] at h
  | .«отображение» _ _ _ _, _, _, _, _, h, _ => by simp [«держится»] at h

mutual
def «нижеБ» (n : Nat) : «Терм» → Bool
  | .«знач» _ => true
  | .«имя» _ => true
  | .«рез» j => decide (j < n)
  | .«двучлен» _ a b => «нижеБ» n a && «нижеБ» n b
  | .«вариант?» _ t => «нижеБ» n t
  | .«пусто?» t => «нижеБ» n t
  | .«звено?» t => «нижеБ» n t
  | .«голова» t => «нижеБ» n t
  | .«хвост» t => «нижеБ» n t
  | .«поле» _ t => «нижеБ» n t
  | .«список» ts => «нижеВсеБ» n ts
def «нижеВсеБ» (n : Nat) : List «Терм» → Bool
  | [] => true
  | t :: r => «нижеБ» n t && «нижеВсеБ» n r
end

mutual
theorem «нижеБ-верно» (n : Nat) : ∀ t, «нижеБ» n t = true → «Ниже» n t
  | .«знач» _, _ => trivial
  | .«имя» _, _ => trivial
  | .«рез» j, h => by simpa [«нижеБ», «Ниже»] using h
  | .«двучлен» _ a b, h => by
    simp only [«нижеБ», Bool.and_eq_true] at h
    exact ⟨«нижеБ-верно» n a h.1, «нижеБ-верно» n b h.2⟩
  | .«вариант?» _ t, h => «нижеБ-верно» n t h
  | .«пусто?» t, h => «нижеБ-верно» n t h
  | .«звено?» t, h => «нижеБ-верно» n t h
  | .«голова» t, h => «нижеБ-верно» n t h
  | .«хвост» t, h => «нижеБ-верно» n t h
  | .«поле» _ t, h => «нижеБ-верно» n t h
  | .«список» ts, h => «нижеВсеБ-верно» n ts h
theorem «нижеВсеБ-верно» (n : Nat) : ∀ ts, «нижеВсеБ» n ts = true → «НижеВсе» n ts
  | [], _ => trivial
  | t :: r, h => by
    simp only [«нижеВсеБ», Bool.and_eq_true] at h
    exact ⟨«нижеБ-верно» n t h.1, «нижеВсеБ-верно» n r h.2⟩
end

theorem «нижеВсеБ-член» {n : Nat} : ∀ {ts : List «Терм»} {t : «Терм»}, «нижеВсеБ» n ts = true → t ∈ ts →
    «нижеБ» n t = true
  | [], _, _, h => by cases h
  | x :: r, t, h, hm => by
    simp only [«нижеВсеБ», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hm with he | hm
    · subst he; exact h.1
    · exact «нижеВсеБ-член» h.2 hm

mutual
def «своб» (n : Nat) (B : List Nat) : «Терм» → Bool
  | .«знач» _ => true
  | .«имя» _ => true
  | .«рез» j => decide (j < n) || B.contains j
  | .«двучлен» _ a b => «своб» n B a && «своб» n B b
  | .«вариант?» _ t => «своб» n B t
  | .«пусто?» t => «своб» n B t
  | .«звено?» t => «своб» n B t
  | .«голова» t => «своб» n B t
  | .«хвост» t => «своб» n B t
  | .«поле» _ t => «своб» n B t
  | .«список» ts => «свобВсе» n B ts
def «свобВсе» (n : Nat) (B : List Nat) : List «Терм» → Bool
  | [] => true
  | t :: r => «своб» n B t && «свобВсе» n B r
end

def «Согласие» (n : Nat) (B : List Nat) (A C : «Итоги») : Prop :=
  ∀ j, (j < n ∨ j ∈ B) → «взять» j A = «взять» j C

theorem «согласие-добавить» {n : Nat} {B : List Nat} {A C : «Итоги»} (h : «Согласие» n B A C) (k : Nat) (w : «Зн») :
    «Согласие» n (k :: B) ((k, w) :: A) ((k, w) :: C) := by
  intro j hj
  by_cases hk : j = k
  · subst hk; simp [«взять»]
  · rw [«взять-мимо» w A hk, «взять-мимо» w C hk]
    apply h j
    rcases hj with hj | hj
    · exact Or.inl hj
    · exact Or.inr ((List.mem_cons.mp hj).resolve_left hk)

mutual
theorem «своб-верно» (σ : «Среда») {n : Nat} {B : List Nat} {A C : «Итоги»} (h : «Согласие» n B A C) :
    ∀ t, «своб» n B t = true → «значТерм» σ A t = «значТерм» σ C t
  | .«знач» _, _ => rfl
  | .«имя» _, _ => rfl
  | .«рез» j, hj => by
    simp only [«своб», Bool.or_eq_true, decide_eq_true_eq, List.contains_iff_mem] at hj
    simp only [«значТерм», h j hj]
  | .«двучлен» op a b, hb => by
    simp only [«своб», Bool.and_eq_true] at hb
    simp only [«значТерм», «своб-верно» σ h a hb.1, «своб-верно» σ h b hb.2]
  | .«вариант?» _ t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«пусто?» t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«звено?» t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«голова» t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«хвост» t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«поле» _ t, ht => by simp only [«своб»] at ht; simp only [«значТерм», «своб-верно» σ h t ht]
  | .«список» ts, ht => by simp only [«своб»] at ht; simp only [«значТерм», «свобВсе-верно» σ h ts ht]
theorem «свобВсе-верно» (σ : «Среда») {n : Nat} {B : List Nat} {A C : «Итоги»} (h : «Согласие» n B A C) :
    ∀ ts, «свобВсе» n B ts = true → «значВсех» σ A ts = «значВсех» σ C ts
  | [], _ => rfl
  | t :: r, hb => by
    simp only [«свобВсе», Bool.and_eq_true] at hb
    simp only [«значВсех», «своб-верно» σ h t hb.1, «свобВсе-верно» σ h r hb.2]
end

def «деревоСвоб» (n : Nat) : List Nat → «Дерево» → Bool
  | B, .«лист» t => «своб» n B t
  | _, .«отказ» _ => true
  | B, .«если» c a b => «своб» n B c && «деревоСвоб» n B a && «деревоСвоб» n B b
  | B, .«вызов» _ ts k rest => «свобВсе» n B ts && «деревоСвоб» n (k :: B) rest
  | B, .«форма» _ ts k rest => «свобВсе» n B ts && «деревоСвоб» n (k :: B) rest
  | _, _ => false

theorem «деревоСвоб-верно» (P : «Программа») (M : Nat) (σ : «Среда») (n : Nat) :
    ∀ (d : «Дерево») (B : List Nat) (A C : «Итоги»), «деревоСвоб» n B d = true → «Согласие» n B A C →
      «значДерева» P M σ A d = «значДерева» P M σ C d
  | .«лист» t, B, A, C, hd, h => by
    simp only [«деревоСвоб»] at hd
    simp only [«значДерева», «своб-верно» σ h t hd]
  | .«отказ» _, B, A, C, _, _ => by simp only [«значДерева»]
  | .«если» c a b, B, A, C, hd, h => by
    simp only [«деревоСвоб», Bool.and_eq_true] at hd
    obtain ⟨⟨hc, ha⟩, hb⟩ := hd
    simp only [«значДерева», «своб-верно» σ h c hc, «деревоСвоб-верно» P M σ n a B A C ha h,
      «деревоСвоб-верно» P M σ n b B A C hb h]
  | .«вызов» f ts k rest, B, A, C, hd, h => by
    simp only [«деревоСвоб», Bool.and_eq_true] at hd
    simp only [«значДерева», «свобВсе-верно» σ h ts hd.1]
    cases hvs : «значВсех» σ C ts with
    | error q => rfl
    | ok vs =>
      simp only [bind, Except.bind]
      cases hw : «выч» P M [] (.«вызов» f (vs.map .«лит»)) with
      | error q => rfl
      | ok w =>
        exact «деревоСвоб-верно» P M σ n rest (k :: B) _ _ hd.2 («согласие-добавить» h k w)
  | .«форма» f ts k rest, B, A, C, hd, h => by
    simp only [«деревоСвоб», Bool.and_eq_true] at hd
    simp only [«значДерева», «свобВсе-верно» σ h ts hd.1]
    cases hvs : «значВсех» σ C ts with
    | error q => rfl
    | ok vs =>
      simp only [bind, Except.bind]
      cases hw : «форма» f vs with
      | error q => rfl
      | ok w =>
        exact «деревоСвоб-верно» P M σ n rest (k :: B) _ _ hd.2 («согласие-добавить» h k w)
  | .«свёртка» _ _ _ _ _, _, _, _, hd, _ => by simp [«деревоСвоб»] at hd
  | .«отбор» _ _ _ _, _, _, _, hd, _ => by simp [«деревоСвоб»] at hd
  | .«отображение» _ _ _ _, _, _, _, hd, _ => by simp [«деревоСвоб»] at hd

theorem «вычВсе-лит» (P : «Программа») (m : Nat) (γ : «Среда») :
    ∀ (vs vs' : List «Зн»), «вычВсе» («выч» P m) γ (vs.map .«лит») = .ok vs' → vs' = vs
  | [], vs', h => by simp [«вычВсе»] at h; exact h
  | v :: r, vs', h => by
    cases m with
    | zero =>
      simp only [List.map, «вычВсе»] at h
      rw [show «выч» P 0 γ (.«лит» v) = .error .«топливо» from rfl] at h
      cases h
    | succ m =>
      simp only [List.map, «вычВсе»] at h
      rw [show «выч» P (m + 1) γ (.«лит» v) = .ok v from rfl] at h
      cases hr : «вычВсе» («выч» P (m + 1)) γ (r.map .«лит») with
      | error q => rw [hr] at h; cases h
      | ok xs =>
        rw [hr] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
        subst h
        rw [«вычВсе-лит» P (m + 1) γ r xs hr]

theorem «вызов-тело» (P : «Программа») (M : Nat) (f : String) (vs : List «Зн») (w : «Зн») (g : «Функция»)
    (hg : «функцияПрограммы» P f = some g) (h : «выч» P M [] (.«вызов» f (vs.map .«лит»)) = .ok w) :
    ∃ M', M = M' + 1 ∧ g.«параметры».length = vs.length ∧
      «выч» P M' («привязать» g.«параметры» vs) g.«тело» = .ok w := by
  cases M with
  | zero => cases h
  | succ M' =>
    refine ⟨M', rfl, ?_⟩
    have e : «выч» P (M' + 1) [] (.«вызов» f (vs.map .«лит»)) =
        «шаг» P («выч» P M') [] (.«вызов» f (vs.map .«лит»)) := rfl
    rw [e] at h
    simp only [«шаг»] at h
    cases hl : «вычВсе» («выч» P M') [] (vs.map .«лит») with
    | error q => rw [hl] at h; cases h
    | ok vs' =>
      have := «вычВсе-лит» P M' [] vs vs' hl
      subst this
      rw [hl] at h
      simp only [bind, Except.bind, hg] at h
      by_cases hlen : g.«параметры».length = vs'.length
      · simp only [hlen, ↓reduceIte, «вызватьТело»] at h
        refine ⟨hlen, ?_⟩
        cases hb : «выч» P M' («привязать» g.«параметры» vs') g.«тело» with
        | error q => rw [hb] at h; cases h
        | ok v =>
          rw [hb] at h
          simp only [bind, Except.bind] at h
          rw [«пост-сохраняет» _ _ v _ w h]
      · simp only [hlen, ↓reduceIte] at h
        cases h

theorem «найти-параллельно» (σ : «Среда») (res : «Итоги») (x : String) :
    ∀ (ps : List String) (ts : List «Терм») (vs : List «Зн») (t : «Терм»),
      «значВсех» σ res ts = .ok vs → «найти» x (ps.zip ts) = some t →
      ∃ w, «найти» x (ps.zip vs) = some w ∧ «значТерм» σ res t = .ok w
  | [], _, _, _, _, h => by simp [«найти»] at h
  | _ :: _, [], _, _, _, h => by simp [«найти»] at h
  | p :: ps, u :: us, vs, t, hv, h => by
    simp only [«значВсех»] at hv
    cases hu : «значТерм» σ res u with
    | error q => rw [hu] at hv; cases hv
    | ok w =>
      cases hus : «значВсех» σ res us with
      | error q => rw [hu, hus] at hv; cases hv
      | ok ws =>
        rw [hu, hus] at hv
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at hv
        subst hv
        simp only [List.zip_cons_cons, «найти»] at h ⊢
        split at h
        · simp only [Option.some.injEq] at h
          subst h
          rename_i hp
          exact ⟨w, by simp [hp], hu⟩
        · rename_i hp
          simp only [hp, ↓reduceIte]
          exact «найти-параллельно» σ res x ps us ws t hus h

def «влить» (P : «Программа») (n : Nat) : «Дерево» → Option «Дерево»
  | .«лист» t => some (.«лист» t)
  | .«отказ» k => some (.«отказ» k)
  | .«если» c a b =>
    match «влить» P n a, «влить» P n b with
    | some a', some b' => some (.«если» c a' b')
    | _, _ => none
  | .«вызов» f ts k rest =>
    match «влить» P n rest with
    | none => none
    | some rest' =>
      match «функцияПрограммы» P f with
      | none => some (.«вызов» f ts k rest')
      | some g =>
        if «нижеВсеБ» n ts && «деревоСвоб» n [k] rest' then
          match «обход» (g.«параметры».zip ts) n (fun t _ => some (.«форма» "голова" [.«список» [t]] k rest'))
              g.«тело» with
          | some d => some d
          | none => some (.«вызов» f ts k rest')
        else some (.«вызов» f ts k rest')
  | .«форма» f ts k rest =>
    match «влить» P n rest with
    | some rest' => some (.«форма» f ts k rest')
    | none => none
  | _ => none

theorem «согласны-вызова» (σ : «Среда») (res : «Итоги») (n : Nat) (ps : List String) (ts : List «Терм»)
    (vs : List «Зн») (hn : «нижеВсеБ» n ts = true) (hv : «значВсех» σ res ts = .ok vs) :
    «СогласныОбхода» σ res n (ps.zip ts) («привязать» ps vs) := by
  intro x t hx
  refine ⟨«нижеБ-верно» n t («нижеВсеБ-член» hn («найти-в-паре» hx)), ?_⟩
  exact «найти-параллельно» σ res x ps ts vs t hv hx

theorem «голова-списка» (σ : «Среда») (res : «Итоги») (t : «Терм») (w : «Зн»)
    (h : «значТерм» σ res t = .ok w) : «значВсех» σ res [.«список» [t]] = .ok [.«список» [w]] := by
  simp [«значВсех», «значТерм», h, bind, Except.bind, pure, Except.pure]

theorem «влить-верно» (P : «Программа») (M : Nat) (σ : «Среда») (n : Nat) :
    ∀ (d d' : «Дерево») (res : «Итоги») (u : «Зн»), «влить» P n d = some d' →
      «значДерева» P M σ res d = .ok u → «значДерева» P M σ res d' = .ok u
  | .«лист» t, d', res, u, hd, hv => by
    simp only [«влить», Option.some.injEq] at hd; subst hd; exact hv
  | .«отказ» k, d', res, u, hd, hv => by
    simp only [«влить», Option.some.injEq] at hd; subst hd; exact hv
  | .«если» c a b, d', res, u, hd, hv => by
    simp only [«влить»] at hd
    split at hd
    · rename_i a' b' ha hb
      simp only [Option.some.injEq] at hd
      subst hd
      simp only [«значДерева»] at hv ⊢
      cases hc : «значТерм» σ res c with
      | error q => rw [hc] at hv; cases hv
      | ok cv =>
        rw [hc] at hv
        simp only [bind, Except.bind] at hv ⊢
        cases cv with
        | «признак» bb =>
          cases bb with
          | true => exact «влить-верно» P M σ n a a' res u ha hv
          | false => exact «влить-верно» P M σ n b b' res u hb hv
        | _ => exact hv
    · cases hd
  | .«форма» f ts k rest, d', res, u, hd, hv => by
    simp only [«влить»] at hd
    split at hd
    · rename_i rest' hr
      simp only [Option.some.injEq] at hd
      subst hd
      simp only [«значДерева»] at hv ⊢
      cases hvs : «значВсех» σ res ts with
      | error q => rw [hvs] at hv; cases hv
      | ok vs =>
        rw [hvs] at hv
        simp only [bind, Except.bind] at hv ⊢
        cases hw : «форма» f vs with
        | error q => rw [hw] at hv; cases hv
        | ok w =>
          rw [hw] at hv
          exact «влить-верно» P M σ n rest rest' ((k, w) :: res) u hr hv
    · cases hd
  | .«вызов» f ts k rest, d', res, u, hd, hv => by
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
        have keep : ∀ rest', «влить» P n rest = some rest' →
            «значДерева» P M σ res (.«вызов» f ts k rest') = .ok u := by
          intro rest' hr
          simp only [«значДерева», hvs, hw, bind, Except.bind]
          exact «влить-верно» P M σ n rest rest' ((k, w) :: res) u hr hv
        simp only [«влить»] at hd
        split at hd
        · cases hd
        · rename_i rest' hr
          split at hd
          · simp only [Option.some.injEq] at hd; subst hd; exact keep rest' hr
          · rename_i g hg
            split at hd
            · rename_i hc
              simp only [Bool.and_eq_true] at hc
              obtain ⟨hn, hfree⟩ := hc
              have hrest := «влить-верно» P M σ n rest rest' ((k, w) :: res) u hr hv
              split at hd
              · rename_i dd hdd
                simp only [Option.some.injEq] at hd
                subst hd
                obtain ⟨M', hM, hlen, hb⟩ := «вызов-тело» P M f vs w g hg hw
                refine «обход-верен» P σ M g.«тело» (g.«параметры».zip ts) («привязать» g.«параметры» vs) n res _ dd
                  M' w _ hdd («согласны-вызова» σ res n g.«параметры» ts vs hn hvs) hb (by omega) ?_
                intro t n1 d1 res1 hd1 _ _ hext ht
                simp only [Option.some.injEq] at hd1
                subst hd1
                simp only [«значДерева», «голова-списка» σ res1 t w ht, bind, Except.bind, «голова-одного»]
                rw [«деревоСвоб-верно» P M σ n rest' [k] ((k, w) :: res1) ((k, w) :: res) hfree ?_]
                · exact hrest
                · intro j hj
                  by_cases hjk : j = k
                  · subst hjk; simp [«взять»]
                  · rw [«взять-мимо» w res1 hjk, «взять-мимо» w res hjk]
                    rcases hj with hj | hj
                    · exact «взять-расширение» hj hext
                    · simp at hj; exact absurd hj hjk
              · simp only [Option.some.injEq] at hd; subst hd; exact keep rest' hr
            · simp only [Option.some.injEq] at hd; subst hd; exact keep rest' hr
  | .«свёртка» _ _ _ _ _, _, _, _, hd, _ => by simp [«влить»] at hd
  | .«отбор» _ _ _ _, _, _, _, hd, _ => by simp [«влить»] at hd
  | .«отображение» _ _ _ _, _, _, _, hd, _ => by simp [«влить»] at hd

mutual
def «верхТ» : «Терм» → Nat
  | .«знач» _ => 0
  | .«имя» _ => 0
  | .«рез» j => j + 1
  | .«двучлен» _ a b => max («верхТ» a) («верхТ» b)
  | .«вариант?» _ t => «верхТ» t
  | .«пусто?» t => «верхТ» t
  | .«звено?» t => «верхТ» t
  | .«голова» t => «верхТ» t
  | .«хвост» t => «верхТ» t
  | .«поле» _ t => «верхТ» t
  | .«список» ts => «верхВсех» ts
def «верхВсех» : List «Терм» → Nat
  | [] => 0
  | t :: r => max («верхТ» t) («верхВсех» r)
end

def «верх» : «Дерево» → Nat
  | .«лист» t => «верхТ» t
  | .«отказ» _ => 0
  | .«если» c a b => max («верхТ» c) (max («верх» a) («верх» b))
  | .«вызов» _ ts k rest => max («верхВсех» ts) (max (k + 1) («верх» rest))
  | .«форма» _ ts k rest => max («верхВсех» ts) (max (k + 1) («верх» rest))
  | .«свёртка» l i step k rest => max («верхТ» l) (max («верхТ» i) (max («верх» step) (max (k + 2) («верх» rest))))
  | .«отбор» l step k rest => max («верхТ» l) (max («верх» step) (max (k + 2) («верх» rest)))
  | .«отображение» l step k rest => max («верхТ» l) (max («верх» step) (max (k + 2) («верх» rest)))

def «параметрыТермами» (g : «Функция») : List (String × «Терм») := g.«параметры».map (fun p => (p, «Терм».«имя» p))

def «деревоЦели» (g : «Функция») (q : «Постусловие») : Option «Дерево» :=
  «обход» («параметрыТермами» g) 0 (fun t n1 =>
    «обход» ((q.«связка», t) :: «параметрыТермами» g) n1 (fun c _ => some (.«лист» c)) q.«выражение») g.«тело»

def «влитьВсё» (P : «Программа») (d : «Дерево») : Option «Дерево» := «влить» P («верх» d) d

def «деревоЦелиСВлитым» (P : «Программа») (g : «Функция») (q : «Постусловие») : Option «Дерево» :=
  «обход» («параметрыТермами» g) 0 (fun t n1 =>
    match «обход» ((q.«связка», t) :: «параметрыТермами» g) n1 (fun c _ => some (.«лист» c)) q.«выражение» with
    | some d => «влить» P (n1 + «верх» d) d
    | none => none) g.«тело»

def «путьПуст» : «Путь» := ⟨[], [], []⟩

def «проверить» : Option «Дерево» → Bool
  | some d => «держится» «путьПуст» d
  | none => false

def «цельПоУсловию?» (P : «Программа») (g : «Функция») (q : «Постусловие») : Bool :=
  «проверить» («деревоЦели» g q) || «проверить» ((«деревоЦели» g q).bind («влитьВсё» P)) ||
    «проверить» («деревоЦелиСВлитым» P g q)

theorem «деревоЦели-значение» (P : «Программа») (g : «Функция») (q : «Постусловие») (vs : List «Зн»)
    (hl : g.«параметры».length = vs.length) (m m' : Nat) (v w : «Зн»)
    (hb : «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v)
    (hq : «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w)
    (K : «Терм» → Nat → Option «Дерево»)
    (hK : ∀ t n1 d' res', K t n1 = some d' → «Ниже» n1 t →
      «Расширяет» res' [] 0 → «значТерм» («привязать» g.«параметры» vs) res' t = .ok v →
      ∀ d0, «обход» ((q.«связка», t) :: «параметрыТермами» g) n1 (fun c _ => some (.«лист» c)) q.«выражение» = some d0 →
        «значДерева» P (max m m') («привязать» g.«параметры» vs) res' d0 = .ok w →
        «значДерева» P (max m m') («привязать» g.«параметры» vs) res' d' = .ok w)
    (hK0 : ∀ t n1 d', K t n1 = some d' →
      ∃ d0, «обход» ((q.«связка», t) :: «параметрыТермами» g) n1 (fun c _ => some (.«лист» c)) q.«выражение» = some d0)
    (d : «Дерево») (hd : «обход» («параметрыТермами» g) 0 K g.«тело» = some d) :
    «значДерева» P (max m m') («привязать» g.«параметры» vs) [] d = .ok w := by
  let σ := «привязать» g.«параметры» vs
  have hs : «СогласныОбхода» σ [] 0 («параметрыТермами» g) σ := «согласны-параметры» g.«параметры» vs hl
  refine «обход-верен» P σ (max m m') g.«тело» («параметрыТермами» g) σ 0 [] K d m v _ hd hs hb
    (Nat.le_max_left m m') ?_
  intro t n1 d' res' hd' hn1 ht he htv
  obtain ⟨d0, hd0⟩ := hK0 t n1 d' hd'
  refine hK t n1 d' res' hd' ht he htv d0 hd0 ?_
  refine «обход-верен» P σ (max m m') q.«выражение» ((q.«связка», t) :: «параметрыТермами» g) ((q.«связка», v) :: σ)
    n1 res' _ d0 m' w _ hd0 («согласны-шире» («согласны-дальше» hs (Nat.zero_le _) he) q.«связка» t v ht htv) hq
    (Nat.le_max_right m m') ?_
  intro c n2 d2 res2 hd2 _ _ _ hcw
  simp only [Option.some.injEq] at hd2
  subst hd2
  simp only [«значДерева»]
  exact hcw

theorem «путьПуст-верен» (P : «Программа») (M : Nat) (σ : «Среда») (res : «Итоги») :
    «ВерныйПуть» P M σ res «путьПуст» := by
  refine ⟨?_, ?_, ?_⟩
  · intro t b hm; simp [«путьПуст»] at hm
  · intro k t hm; simp [«путьПуст»] at hm
  · intro f ts k hm; simp [«путьПуст»] at hm

theorem «проверить-верно» (P : «Программа») (M : Nat) (σ : «Среда») (o : Option «Дерево») (w : «Зн»)
    (h : «проверить» o = true) (hv : ∀ d, o = some d → «значДерева» P M σ [] d = .ok w) : w = .«признак» true := by
  cases o with
  | none => simp [«проверить»] at h
  | some d =>
    simp only [«проверить»] at h
    exact «держится-верно» P M σ d «путьПуст» [] w («путьПуст-верен» P M σ []) h (hv d rfl)

theorem «цель-по-условию-верна» (P : «Программа») (g : «Функция») (q : «Постусловие»)
    (h : «цельПоУсловию?» P g q = true) (vs : List «Зн») (hl : g.«параметры».length = vs.length)
    (m m' : Nat) (v w : «Зн»)
    (hb : «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v)
    (hq : «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w) :
    w = .«признак» true := by
  let σ := «привязать» g.«параметры» vs
  have base : ∀ d, «деревоЦели» g q = some d → «значДерева» P (max m m') σ [] d = .ok w := by
    intro d hd
    refine «деревоЦели-значение» P g q vs hl m m' v w hb hq _ ?_ ?_ d hd
    · intro t n1 d' res' hd' _ _ _ d0 hd0 hv0
      rw [hd'] at hd0
      cases hd0
      exact hv0
    · intro t n1 d' hd'
      exact ⟨d', hd'⟩
  simp only [«цельПоУсловию?», Bool.or_eq_true] at h
  rcases h with (h | h) | h
  · exact «проверить-верно» P (max m m') σ _ w h base
  · refine «проверить-верно» P (max m m') σ _ w h ?_
    intro d hd
    cases h0 : «деревоЦели» g q with
    | none => rw [h0] at hd; cases hd
    | some d0 =>
      rw [h0] at hd
      exact «влить-верно» P (max m m') σ _ d0 d [] w hd (base d0 h0)
  · refine «проверить-верно» P (max m m') σ _ w h ?_
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

def «принятьРазборЦели» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» : Nat) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    decide («хозяинСтроки» «строки» «строка» = some f) &&
      ((«строкаИсходника» «строки» «строка»).splitOn ("обеспечивает «" ++ «имя» ++ "» ")).length > 1 &&
      !g.«постусловия».isEmpty && g.«постусловия».all («цельПоУсловию?» P g)

theorem «разбор-цели-по-условию» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» : Nat)
    (h : «принятьРазборЦели» P «строки» f «имя» «строка» = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧ «хозяинСтроки» «строки» «строка» = some f ∧
      ((«строкаИсходника» «строки» «строка»).splitOn ("обеспечивает «" ++ «имя» ++ "» ")).length > 1 ∧
      g.«постусловия» ≠ [] ∧
      ∀ q ∈ g.«постусловия», ∀ vs, g.«параметры».length = vs.length → ∀ m m' v w,
        «выч» P m («привязать» g.«параметры» vs) g.«тело» = .ok v →
        «выч» P m' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok w →
        w = .«признак» true := by
  unfold «принятьРазборЦели» at h
  cases hg : «функцияПрограммы» P f with
  | none => rw [hg] at h; cases h
  | some g =>
    rw [hg] at h
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true, decide_eq_true_eq, Bool.not_eq_true',
      List.isEmpty_eq_false_iff] at h
    obtain ⟨⟨⟨hown, hline⟩, hne⟩, hall⟩ := h
    exact ⟨g, rfl, hown, hline, hne, fun q hq vs hl m m' v w hb hw =>
      «цель-по-условию-верна» P g q (hall q hq) vs hl m m' v w hb hw⟩

namespace «ПробыРазбора»

def «ч» (k : Nat) : «Выр» := .«лит» (.«число» («изЦелого» k))

def «да» : «Выр» := .«лит» (.«признак» true)

def «порог» : «Выр» := .«двучлен» "gt" (.«имя» "порог") («ч» 0)

def «телоПорога» (c : «Выр») (a b : Nat) : «Выр» :=
  .«разбор» (.«имя» "элементы")
    [(.«пусто», .«если» c («ч» 0) («ч» 5)), (.«звено» (some "г") (some "х"), .«если» c («ч» a) («ч» b))]

def «постПорога» : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«если» «порог»
      (.«если» (.«двучлен» "eq" (.«имя» "результат") («ч» 0)) «да» (.«двучлен» "eq" (.«имя» "результат") («ч» 1)))
      «да» }

def «порогФ» (c : «Выр») (a b : Nat) : «Функция» :=
  { «имя» := "Порог под разбором", «параметры» := ["порог", "элементы"], «тело» := «телоПорога» c a b,
    «постусловия» := [«постПорога»] }

def «исходник» : List String :=
  ["тотальная функция «Порог под разбором»", "  принимает порог: число, элементы: список число",
   "  обеспечивает «ноль или один» если порог больше 0 то (результат равен 0) или (результат равен 1) иначе да"]

def «вход» : «Выр» := .«двучлен» "gt" (.«имя» "вход") («ч» 0)

def «страж» : «Функция» :=
  { «имя» := "Страж", «параметры» := ["вход"],
    «тело» := .«если» «вход» (.«имя» "вход") (.«вызов» "Ноль" [.«имя» "вход"]), «постусловия» := [] }

def «ноль» : «Функция» := { «имя» := "Ноль", «параметры» := ["вход"], «тело» := «ч» 0, «постусловия» := [] }

def «постСтража» (k : Nat) : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«если» «вход»
      (.«двучлен» "eq" (.«имя» "результат") (.«двучлен» "add" (.«имя» "вход") («ч» k))) «да» }

def «через» (k : Nat) : «Функция» :=
  { «имя» := "Через стража", «параметры» := ["вход"],
    «тело» := .«двучлен» "add" (.«вызов» "Страж" [.«имя» "вход"]) («ч» 1), «постусловия» := [«постСтража» k] }

#guard «цельПоУсловию?» [] («порогФ» «порог» 1 5) «постПорога»
#guard «цельПоУсловию?» [] («порогФ» «порог» 0 7) «постПорога»
#guard !«цельПоУсловию?» [] («порогФ» «порог» 2 5) «постПорога»
#guard !«цельПоУсловию?» [] («порогФ» (.«двучлен» "gt" (.«имя» "элементы") («ч» 0)) 1 5) «постПорога»
#guard !«цельПоУсловию?» [] («порогФ» (.«двучлен» "gte" (.«имя» "порог") («ч» 0)) 1 5) «постПорога»
#guard !«цельПоУсловию?» [] { «порогФ» «порог» 1 5 with «тело» := .«имя» "порог" } «постПорога»
#guard «цельПоУсловию?» [«страж», «ноль», «через» 1] («через» 1) («постСтража» 1)
#guard !«цельПоУсловию?» [«страж», «ноль», «через» 2] («через» 2) («постСтража» 2)
#guard !«цельПоУсловию?» [«ноль», «через» 1] («через» 1) («постСтража» 1)
#guard !«цельПоУсловию?» [{ «страж» with «тело» := .«если» «вход» («ч» 0) (.«имя» "вход") }, «ноль», «через» 1]
  («через» 1) («постСтража» 1)
#guard «принятьРазборЦели» [«порогФ» «порог» 1 5] «исходник» "Порог под разбором" "ноль или один" 3
#guard !«принятьРазборЦели» [«порогФ» «порог» 1 5] «исходник» "Порог под разбором" "ноль или один" 2
#guard !«принятьРазборЦели» [«порогФ» «порог» 1 5] «исходник» "Порог под разбором" "другое" 3
#guard !«принятьРазборЦели» [{ «порогФ» «порог» 1 5 with «постусловия» := [] }] «исходник» "Порог под разбором"
  "ноль или один" 3

end «ПробыРазбора»

end «Эталон»
