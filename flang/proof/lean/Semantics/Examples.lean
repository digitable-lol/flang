import Semantics.Recursion
import Semantics.Tables

set_option linter.unusedVariables false

namespace «Эталон»

theorem «пост-верны» (r : «Вычислитель») (ρ : «Среда») (w v : «Зн») :
    ∀ qs : List «Постусловие», «проверитьПост» r ρ w qs = .ok v →
      v = w ∧ ∀ q ∈ qs, r ((q.«связка», w) :: ρ) q.«выражение» = .ok (.«признак» true)
  | [], h => by
    simp only [«проверитьПост»] at h
    injection h with h
    exact ⟨h.symm, fun q hq => by cases hq⟩
  | q :: t, h => by
    simp only [«проверитьПост»] at h
    cases hc : r ((q.«связка», w) :: ρ) q.«выражение» with
    | error e => rw [hc] at h; cases h
    | ok c =>
      rw [hc] at h
      cases c with
      | «признак» b =>
        cases b with
        | true =>
          have h' : «проверитьПост» r ρ w t = .ok v := h
          obtain ⟨hv, ht⟩ := «пост-верны» r ρ w v t h'
          refine ⟨hv, fun x hx => ?_⟩
          rcases List.mem_cons.mp hx with rfl | hx
          · exact hc
          · exact ht x hx
        | false => cases h
      | _ => cases h

def «исходОк» : «Исход» → Bool
  | .ok _ => true
  | .error _ => false

def «принятьПример» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» N : Nat) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    g.«параметры».isEmpty &&
      (decide («хозяинСтроки» «строки» «строка» = some f) &&
        ((«строкаИсходника» «строки» «строка»).startsWith ("обеспечивает «" ++ «имя» ++ "»") &&
          «исходОк» («вызватьТело» («выч» P N) g [])))

theorem «пример-исчерпывает» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» N : Nat)
    (h : «принятьПример» P «строки» f «имя» «строка» N = true) :
    ∃ g v, «функцияПрограммы» P f = some g ∧ g.«параметры» = [] ∧
      «хозяинСтроки» «строки» «строка» = some f ∧
      («строкаИсходника» «строки» «строка»).startsWith ("обеспечивает «" ++ «имя» ++ "»") = true ∧
      ∀ m, N ≤ m →
        «вызватьТело» («выч» P m) g [] = .ok v ∧ «выч» P m [] g.«тело» = .ok v ∧
          ∀ q ∈ g.«постусловия», «выч» P m [(q.«связка», v)] q.«выражение» = .ok (.«признак» true) := by
  unfold «принятьПример» at h
  cases hg : «функцияПрограммы» P f with
  | none => simp [hg] at h
  | some g =>
  simp only [hg, Bool.and_eq_true, decide_eq_true_eq, List.isEmpty_iff] at h
  obtain ⟨hp, hown, hline, hok⟩ := h
  cases hr : «вызватьТело» («выч» P N) g [] with
  | error e => simp [hr, «исходОк»] at hok
  | ok v =>
    refine ⟨g, v, rfl, hp, hown, hline, fun m hm => ?_⟩
    have hlive : «вызватьТело» («выч» P N) g [] ≠ .error .«топливо» := by rw [hr]; intro q; cases q
    have hm' : «вызватьТело» («выч» P m) g [] = .ok v := by
      rw [← hr]
      exact «подъём» P (F := fun r => «вызватьТело» r g []) (fun r r' H => «тело-раньше» H g []) hm hlive
    refine ⟨hm', ?_⟩
    have hb : «вызватьТело» («выч» P m) g [] =
        («выч» P m [] g.«тело» >>= fun w => «проверитьПост» («выч» P m) [] w g.«постусловия») := rfl
    rw [hb] at hm'
    cases hw : «выч» P m [] g.«тело» with
    | error e => rw [hw] at hm'; cases hm'
    | ok w =>
      rw [hw] at hm'
      have hq : «проверитьПост» («выч» P m) [] w g.«постусловия» = .ok v := hm'
      obtain ⟨hv, hposts⟩ := «пост-верны» («выч» P m) [] w v g.«постусловия» hq
      subst hv
      exact ⟨rfl, hposts⟩

namespace «ПробыПримера»

def «верно» : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«двучлен» "eq" (.«имя» "результат") (.«лит» (.«строка» "а")) }

def «ложно» : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«двучлен» "eq" (.«имя» "результат") (.«лит» (.«строка» "б")) }

def «буква» (ps : List String) (q : «Постусловие») : «Функция» :=
  { «имя» := "Буква", «параметры» := ps, «тело» := .«лит» (.«строка» "а"), «постусловия» := [q] }

def «исходник» : List String := ["тотальная функция «Буква»", "  обеспечивает «это а» результат равен \"а\"", "  \"а\""]

#guard «принятьПример» [«буква» [] «верно»] «исходник» "Буква" "это а" 2 8
#guard !«принятьПример» [«буква» [] «ложно»] «исходник» "Буква" "это а" 2 8
#guard !«принятьПример» [«буква» ["х"] «верно»] «исходник» "Буква" "это а" 2 8
#guard !«принятьПример» [«буква» [] «верно»] «исходник» "Буква" "это б" 2 8
#guard !«принятьПример» [«буква» [] «верно»] «исходник» "Буква" "это а" 3 8
#guard !«принятьПример» [«буква» [] «верно»] «исходник» "Буква" "это а" 2 0

end «ПробыПримера»

end «Эталон»
