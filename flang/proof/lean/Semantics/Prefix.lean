import Semantics.Examples

set_option linter.unusedVariables false

namespace «Эталон»

def «началоВыр» (P : «Программа») : Nat → «Выр» → Option String
  | 0, _ => none
  | _ + 1, .«лит» (.«строка» s) => some s
  | k + 1, .«двучлен» op a _ => if op = "concat" then «началоВыр» P k a else none
  | k + 1, .«вызов» f _ =>
    match «функцияПрограммы» P f with
    | some g => «началоВыр» P k g.«тело»
    | none => none
  | _ + 1, _ => none

theorem «начало-верно» (P : «Программа») :
    ∀ k e p, «началоВыр» P k e = some p → ∀ m ρ v, «выч» P m ρ e = .ok v → ∃ t, v = .«строка» (p ++ t)
  | 0, e, p, h, _, _, _, _ => by simp [«началоВыр»] at h
  | k + 1, e, p, h, 0, ρ, v, hv => by simp [«выч»] at hv
  | k + 1, e, p, h, m + 1, ρ, v, hv => by
    cases e with
    | «лит» w =>
      cases w with
      | «строка» s =>
        simp only [«началоВыр», Option.some.injEq] at h
        simp only [«выч», «шаг», Except.ok.injEq] at hv
        exact ⟨"", by rw [← hv, ← h, String.append_empty]⟩
      | _ => simp [«началоВыр»] at h
    | «двучлен» op a b =>
      simp only [«началоВыр»] at h
      by_cases hop : op = "concat"
      · simp only [hop, ↓reduceIte] at h
        simp only [«выч», «шаг»] at hv
        cases hx : «выч» P m ρ a with
        | error c => rw [hx] at hv; cases hv
        | ok x =>
          rw [hx] at hv
          obtain ⟨t, rfl⟩ := «начало-верно» P k a p h m ρ x hx
          cases hy : «выч» P m ρ b with
          | error c => rw [hy] at hv; cases hv
          | ok y =>
            rw [hy] at hv
            have hv' : «двучлен» op (.«строка» (p ++ t)) y = .ok v := hv
            subst hop
            cases y with
            | «строка» z =>
              simp [«двучлен»] at hv'
              exact ⟨t ++ z, by rw [← hv', String.append_assoc]⟩
            | _ => simp [«двучлен», «беда»] at hv'
      · simp only [hop, ↓reduceIte] at h
        cases h
    | «вызов» f args =>
      simp only [«началоВыр»] at h
      simp only [«выч», «шаг»] at hv
      cases hvs : «вычВсе» («выч» P m) ρ args with
      | error c => rw [hvs] at hv; cases hv
      | ok vs =>
        rw [hvs] at hv
        cases hg : «функцияПрограммы» P f with
        | none => rw [hg] at h; cases h
        | some g =>
          rw [hg] at h
          have hv' : (if g.«параметры».length = vs.length then
              «вызватьТело» («выч» P m) g («привязать» g.«параметры» vs) else «беда» "FLANG_ARITY") = .ok v := by
            rw [hg] at hv; exact hv
          by_cases hl : g.«параметры».length = vs.length
          · simp only [hl, ↓reduceIte, «вызватьТело»] at hv'
            cases hb : «выч» P m («привязать» g.«параметры» vs) g.«тело» with
            | error c => rw [hb] at hv'; cases hv'
            | ok u =>
              rw [hb] at hv'
              have hp : «проверитьПост» («выч» P m) («привязать» g.«параметры» vs) u g.«постусловия» = .ok v := hv'
              obtain ⟨huv, _⟩ := «пост-верны» («выч» P m) _ u v g.«постусловия» hp
              obtain ⟨t, ht⟩ := «начало-верно» P k g.«тело» p h m _ u hb
              exact ⟨t, by rw [huv, ht]⟩
          · simp only [hl, ↓reduceIte, «беда»] at hv'
            cases hv'
    | _ => simp [«началоВыр»] at h

def «цельНачала» (x s : String) : «Выр» := .«форма» "начинается с" [.«имя» x, .«лит» (.«строка» s)]

def «строкаЦели» : «Выр» → Option (String × String × String)
  | .«форма» n [.«имя» x, .«лит» (.«строка» s)] => some (n, x, s)
  | _ => none

theorem «строкаЦели-верна» (e : «Выр») (n x s : String) (h : «строкаЦели» e = some (n, x, s)) :
    e = .«форма» n [.«имя» x, .«лит» (.«строка» s)] := by
  unfold «строкаЦели» at h
  split at h
  · cases h; rfl
  · cases h

def «началоПоПостроению?» (P : «Программа») (N : Nat) (g : «Функция») (q : «Постусловие») : Bool :=
  match «строкаЦели» q.«выражение», «началоВыр» P N g.«тело» with
  | some (n, x, s), some p => n = "начинается с" && x = q.«связка» && s.toList.isPrefixOf p.toList
  | _, _ => false

theorem «цель-начала-значение» (P : «Программа») (ρ : «Среда») (x s a : String) :
    ∀ m w, «выч» P m ((x, .«строка» a) :: ρ) («цельНачала» x s) = .ok w → w = .«признак» (a.startsWith s)
  | 0, w, h => by simp [«выч»] at h
  | 1, w, h => by simp [«выч», «шаг», «цельНачала», «вычВсе», bind, Except.bind] at h
  | m + 2, w, h => by
    simp [«выч», «шаг», «цельНачала», «вычВсе», «найти», «форма», bind, Except.bind, pure, Except.pure] at h
    exact h.symm

theorem «начало-держится» (P : «Программа») (N : Nat) (g : «Функция») (q : «Постусловие»)
    (h : «началоПоПостроению?» P N g q = true) (ρ : «Среда») (m m' : Nat) (v w : «Зн»)
    (hb : «выч» P m ρ g.«тело» = .ok v)
    (hq : «выч» P m' ((q.«связка», v) :: ρ) q.«выражение» = .ok w) : w = .«признак» true := by
  unfold «началоПоПостроению?» at h
  split at h
  · rename_i n x s p hc hp
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.isPrefixOf_iff_prefix] at h
    obtain ⟨⟨hn, hx⟩, hs⟩ := h
    obtain ⟨t, rfl⟩ := «начало-верно» P N g.«тело» p hp m ρ v hb
    have he := «строкаЦели-верна» q.«выражение» n x s hc
    rw [he, hn, hx] at hq
    have hw := «цель-начала-значение» P ρ q.«связка» s (p ++ t) m' w hq
    have hpre : (p ++ t).startsWith s = true := by
      rw [String.startsWith_string_iff, String.toList_append]
      exact List.IsPrefix.trans hs (List.prefix_append _ _)
    rw [hw, hpre]
  · cases h

def «принятьНачало» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» N : Nat) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    decide («хозяинСтроки» «строки» «строка» = some f) &&
      ((«строкаИсходника» «строки» «строка»).splitOn ("обеспечивает «" ++ «имя» ++ "» ")).length > 1 &&
      !g.«постусловия».isEmpty && g.«постусловия».all («началоПоПостроению?» P N g)

theorem «начало-по-построению» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» N : Nat)
    (h : «принятьНачало» P «строки» f «имя» «строка» N = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧ «хозяинСтроки» «строки» «строка» = some f ∧
      ((«строкаИсходника» «строки» «строка»).splitOn ("обеспечивает «" ++ «имя» ++ "» ")).length > 1 ∧
      g.«постусловия» ≠ [] ∧
      ∀ q ∈ g.«постусловия», ∀ ρ m m' v w,
        «выч» P m ρ g.«тело» = .ok v →
        «выч» P m' ((q.«связка», v) :: ρ) q.«выражение» = .ok w →
        w = .«признак» true := by
  unfold «принятьНачало» at h
  cases hg : «функцияПрограммы» P f with
  | none => rw [hg] at h; cases h
  | some g =>
    rw [hg] at h
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true, decide_eq_true_eq, Bool.not_eq_true',
      List.isEmpty_eq_false_iff] at h
    obtain ⟨⟨⟨hown, hline⟩, hne⟩, hall⟩ := h
    exact ⟨g, rfl, hown, hline, hne, fun q hq ρ m m' v w hb hw =>
      «начало-держится» P N g q (hall q hq) ρ m m' v w hb hw⟩

namespace «ПробыНачала»

def «обещает» : «Функция» :=
  { «имя» := "Обещает", «параметры» := ["хвост"],
    «тело» := .«двучлен» "concat" (.«лит» (.«строка» "абв")) (.«имя» "хвост"), «постусловия» := [] }

def «пост» (s : String) : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY", «выражение» := «цельНачала» "результат" s }

def «взята» (s : String) : «Функция» :=
  { «имя» := "Взята", «параметры» := ["хвост"], «тело» := .«вызов» "Обещает" [.«имя» "хвост"],
    «постусловия» := [«пост» s] }

#guard «началоПоПостроению?» [«обещает», «взята» "аб"] 8 («взята» "аб") («пост» "аб")
#guard «началоПоПостроению?» [«обещает», «взята» "абв"] 8 («взята» "абв") («пост» "абв")
#guard !«началоПоПостроению?» [«обещает», «взята» "аг"] 8 («взята» "аг") («пост» "аг")
#guard !«началоПоПостроению?» [«обещает», «взята» "абвг"] 8 («взята» "абвг") («пост» "абвг")
#guard !«началоПоПостроению?» [«взята» "аб"] 8 («взята» "аб") («пост» "аб")
#guard !«началоПоПостроению?» [«обещает», «взята» "аб"] 1 («взята» "аб") («пост» "аб")
#guard !«началоПоПостроению?» [«обещает», «взята» "аб"] 8 («взята» "аб")
  { «пост» "аб" with «выражение» := «цельНачала» "хвост" "аб" }

end «ПробыНачала»

end «Эталон»
