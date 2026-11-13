import Semantics.Examples
import Semantics.Facts

set_option linter.unusedVariables false

namespace «Эталон»

def «даётДа» : «Исход» → Bool
  | .ok (.«признак» true) => true
  | _ => false

def «принятьЗамкнутое» (P : «Программа») (f : String) (i N : Nat) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    match g.«постусловия»[i]? with
    | none => false
    | some q => («свободные» q.«выражение»).isEmpty && «даётДа» («выч» P N [] q.«выражение»)

theorem «замкнутое-не-зависит-от-среды» (P : «Программа») (m : Nat) (e : «Выр»)
    (h : «свободные» e = []) (ρ : «Среда») : «выч» P m ρ e = «выч» P m [] e := by
  have hs : ∀ ρ', «Согласны» [] [] ρ' («свободные» e) := by
    intro ρ' y hy
    rw [h] at hy
    cases hy
  rw [← «подст-верна» P m [] [] ρ e (hs ρ), «подст-верна» P m [] [] [] e (hs [])]

theorem «замкнутое-верно» (P : «Программа») (f : String) (i N : Nat)
    (h : «принятьЗамкнутое» P f i N = true) :
    ∃ g q, «функцияПрограммы» P f = some g ∧ g.«постусловия»[i]? = some q ∧
      «свободные» q.«выражение» = [] ∧
      ∀ m, N ≤ m → ∀ ρ, «выч» P m ρ q.«выражение» = .ok (.«признак» true) := by
  unfold «принятьЗамкнутое» at h
  cases hg : «функцияПрограммы» P f with
  | none => simp [hg] at h
  | some g =>
  simp only [hg] at h
  cases hq : g.«постусловия»[i]? with
  | none => simp [hq] at h
  | some q =>
  simp only [hq, Bool.and_eq_true, List.isEmpty_iff] at h
  obtain ⟨hfree, hda⟩ := h
  have hN : «выч» P N [] q.«выражение» = .ok (.«признак» true) := by
    unfold «даётДа» at hda
    split at hda
    · next heq => exact heq
    · cases hda
  refine ⟨g, q, rfl, hq, hfree, fun m hm ρ => ?_⟩
  rw [«замкнутое-не-зависит-от-среды» P m q.«выражение» hfree ρ]
  exact «топливо-моно» P hm [] q.«выражение» hN (by intro c; cases c)

end «Эталон»
