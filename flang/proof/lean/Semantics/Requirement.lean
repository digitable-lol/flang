import Semantics.Closed

set_option linter.unusedVariables false

namespace «Эталон»

def «тотЖеЗн» : «Зн» → «Зн» → Bool
  | .«число» a, .«число» b => decide (a = b)
  | .«строка» a, .«строка» b => decide (a = b)
  | .«признак» a, .«признак» b => decide (a = b)
  | .«ничто», .«ничто» => true
  | _, _ => false

theorem «тотЖеЗн-верно» (v w : «Зн») (h : «тотЖеЗн» v w = true) : v = w := by
  cases v <;> cases w <;> simp_all [«тотЖеЗн»]

mutual
def «тотЖе» : «Выр» → «Выр» → Bool
  | .«лит» v, .«лит» w => «тотЖеЗн» v w
  | .«имя» x, .«имя» y => decide (x = y)
  | .«двучлен» o a b, .«двучлен» o' a' b' => decide (o = o') && «тотЖе» a a' && «тотЖе» b b'
  | .«если» c t e, .«если» c' t' e' => «тотЖе» c c' && «тотЖе» t t' && «тотЖе» e e'
  | .«поле» t p, .«поле» t' p' => «тотЖе» t t' && decide (p = p')
  | .«форма» n as, .«форма» n' as' => decide (n = n') && «тотЖеВсе» as as'
  | .«вызов» f as, .«вызов» f' as' => decide (f = f') && «тотЖеВсе» as as'
  | _, _ => false
def «тотЖеВсе» : List «Выр» → List «Выр» → Bool
  | [], [] => true
  | a :: r, b :: s => «тотЖе» a b && «тотЖеВсе» r s
  | _, _ => false
end

mutual
theorem «тотЖе-верно» : ∀ a b, «тотЖе» a b = true → a = b
  | .«лит» v, b, h => by
    cases b with
    | «лит» w => simp only [«тотЖе»] at h; rw [«тотЖеЗн-верно» v w h]
    | _ => simp [«тотЖе»] at h
  | .«имя» x, b, h => by
    cases b with
    | «имя» y => simp only [«тотЖе», decide_eq_true_eq] at h; rw [h]
    | _ => simp [«тотЖе»] at h
  | .«двучлен» o a b, c, h => by
    cases c with
    | «двучлен» o' a' b' =>
      simp only [«тотЖе», Bool.and_eq_true, decide_eq_true_eq] at h
      obtain ⟨⟨ho, ha⟩, hb⟩ := h
      rw [ho, «тотЖе-верно» a a' ha, «тотЖе-верно» b b' hb]
    | _ => simp [«тотЖе»] at h
  | .«если» c t e, d, h => by
    cases d with
    | «если» c' t' e' =>
      simp only [«тотЖе», Bool.and_eq_true] at h
      obtain ⟨⟨hc, ht⟩, he⟩ := h
      rw [«тотЖе-верно» c c' hc, «тотЖе-верно» t t' ht, «тотЖе-верно» e e' he]
    | _ => simp [«тотЖе»] at h
  | .«поле» t p, d, h => by
    cases d with
    | «поле» t' p' =>
      simp only [«тотЖе», Bool.and_eq_true, decide_eq_true_eq] at h
      obtain ⟨ht, hp⟩ := h
      rw [«тотЖе-верно» t t' ht, hp]
    | _ => simp [«тотЖе»] at h
  | .«форма» n as, d, h => by
    cases d with
    | «форма» n' as' =>
      simp only [«тотЖе», Bool.and_eq_true, decide_eq_true_eq] at h
      obtain ⟨hn, ha⟩ := h
      rw [hn, «тотЖеВсе-верно» as as' ha]
    | _ => simp [«тотЖе»] at h
  | .«вызов» f as, d, h => by
    cases d with
    | «вызов» f' as' =>
      simp only [«тотЖе», Bool.and_eq_true, decide_eq_true_eq] at h
      obtain ⟨hf, ha⟩ := h
      rw [hf, «тотЖеВсе-верно» as as' ha]
    | _ => simp [«тотЖе»] at h
  | .«пусть» _ _ _, b, h | .«разбор» _ _, b, h | .«свёртка» _ _ _ _ _, b, h | .«отобразить» _ _ _, b, h
  | .«отфильтровать» _ _ _, b, h | .«список» _, b, h | .«запись» _, b, h | .«конструктор» _ _, b, h
  | .«ссылка» _ _, b, h | .«применить» _ _, b, h => by cases b <;> simp [«тотЖе»] at h
theorem «тотЖеВсе-верно» : ∀ as bs, «тотЖеВсе» as bs = true → as = bs
  | [], [], h => rfl
  | a :: r, b :: s, h => by
    simp only [«тотЖеВсе», Bool.and_eq_true] at h
    rw [«тотЖе-верно» a b h.1, «тотЖеВсе-верно» r s h.2]
  | [], _ :: _, h | _ :: _, [], h => by simp [«тотЖеВсе»] at h
end

def «принятьПосылкой» («связка» : String) («посылки» : List «Выр») («цель» : «Выр») : Bool :=
  «посылки».any («тотЖе» «цель») && !(«посылки».any (fun p => («свободные» p).contains «связка»))

theorem «без-связки» (P : «Программа») (m : Nat) (p : «Выр») («связка» : String) (v : «Зн»)
    (hp : («свободные» p).contains «связка» = false) (ρ : «Среда») :
    «выч» P m ((«связка», v) :: ρ) p = «выч» P m ρ p := by
  have hs : ∀ ρ', (∀ y ∈ «свободные» p, «найти» y ρ' = «найти» y ρ) → «Согласны» [] ρ ρ' («свободные» p) := by
    intro ρ' h y hy
    simp only [«найти», Option.none_or]
    exact h y hy
  have h1 := «подст-верна» P m [] ρ ((«связка», v) :: ρ) p (hs _ (fun y hy => by
    have hne : «связка» ≠ y := by
      intro he
      subst he
      simp [hy] at hp
    simp [«найти», hne]))
  have h2 := «подст-верна» P m [] ρ ρ p (hs _ (fun y _ => rfl))
  rw [← h1, h2]

theorem «посылкой-верно» («связка» : String) («посылки» : List «Выр») («цель» : «Выр»)
    (h : «принятьПосылкой» «связка» «посылки» «цель» = true) (P : «Программа») (m : Nat) (ρ : «Среда»)
    (v : «Зн») (hpre : ∀ p ∈ «посылки», «выч» P m ρ p = .ok (.«признак» true)) :
    «выч» P m ((«связка», v) :: ρ) «цель» = .ok (.«признак» true) := by
  unfold «принятьПосылкой» at h
  simp only [Bool.and_eq_true, List.any_eq_true, Bool.not_eq_true', List.any_eq_false] at h
  obtain ⟨⟨p, hp, heq⟩, hfree⟩ := h
  rw [«тотЖе-верно» _ _ heq, «без-связки» P m p «связка» v (by simpa using hfree p hp) ρ]
  exact hpre p hp

end «Эталон»
