set_option linter.unusedVariables false
set_option exponentiation.threshold 4200

def «биты» (n : Nat) : Nat := if n = 0 then 0 else n.log2 + 1

theorem «биты-сверху» (n : Nat) : n < 2 ^ «биты» n := by
  unfold «биты»
  split
  · rename_i h; subst h; decide
  · exact Nat.lt_log2_self

theorem «биты-снизу» {n : Nat} (h : 0 < n) : 2 ^ («биты» n - 1) ≤ n ∧ 1 ≤ «биты» n := by
  unfold «биты»
  have hn : n ≠ 0 := by omega
  simp only [hn, ite_false, Nat.add_sub_cancel]
  exact ⟨Nat.log2_self_le hn, by omega⟩

def «ед» : Nat := 1074

@[irreducible] def «шаг» : Nat := 2 ^ 1074

theorem «шаг-степень» : «шаг» = 2 ^ 1074 := by unfold «шаг»; rfl

theorem «выбор-да» {α : Type} {c : Prop} [Decidable c] {a b : α} (h : c) : (if c then a else b) = a := by
  simp [h]

theorem «выбор-нет» {α : Type} {c : Prop} [Decidable c] {a b : α} (h : ¬ c) : (if c then a else b) = b := by
  simp [h]

@[irreducible] def «предел» : Nat := 2 ^ 2098

def «порядок» (N D : Nat) : Nat :=
  if N < D * 2 ^ («биты» N - «биты» D - 54 + 53) then «биты» N - «биты» D - 54
  else if N < D * 2 ^ («биты» N - «биты» D - 54 + 54) then «биты» N - «биты» D - 54 + 1
  else «биты» N - «биты» D - 54 + 2

theorem «степень-сумма» (a b : Nat) : 2 ^ (a + b) = 2 ^ a * 2 ^ b := Nat.pow_add 2 a b

theorem «степень-моно» {a b : Nat} (h : a ≤ b) : 2 ^ a ≤ 2 ^ b := Nat.pow_le_pow_right (by decide) h

theorem «степень-строго» {a b : Nat} (h : a < b) : 2 ^ a < 2 ^ b := Nat.pow_lt_pow_right (by decide) h

theorem «степень-полож» (a : Nat) : 0 < 2 ^ a := Nat.two_pow_pos a

theorem «порядок-запас» {N D : Nat} (hD : 0 < D) :
    N < D * 2 ^ («биты» N - «биты» D - 54 + 55) := by
  have hN := «биты-сверху» N
  obtain ⟨hD2, hD1⟩ := «биты-снизу» hD
  have hk : «биты» N ≤ («биты» D - 1) + («биты» N - «биты» D - 54 + 55) := by omega
  have := «степень-моно» hk
  rw [«степень-сумма»] at this
  have h2 : 2 ^ («биты» D - 1) * 2 ^ («биты» N - «биты» D - 54 + 55) ≤
      D * 2 ^ («биты» N - «биты» D - 54 + 55) := Nat.mul_le_mul_right _ hD2
  omega

theorem «порядок-сверху» {N D : Nat} (hD : 0 < D) : N < D * 2 ^ («порядок» N D + 53) := by
  unfold «порядок»
  split
  · assumption
  · split
    · rename_i h1 h2; simpa [Nat.add_assoc] using h2
    · have := «порядок-запас» (N := N) hD; simpa [Nat.add_assoc] using this

theorem «порядок-снизу» {N D : Nat} (hD : 0 < D) :
    «порядок» N D = 0 ∨ D * 2 ^ («порядок» N D + 52) ≤ N := by
  unfold «порядок»
  split
  · by_cases hc : «биты» N - «биты» D - 54 = 0
    · left; exact hc
    · right
      have hN0 : 0 < N := by
        rcases Nat.eq_zero_or_pos N with h | h
        · subst h; simp [«биты»] at hc
        · exact h
      obtain ⟨hN1, _⟩ := «биты-снизу» hN0
      have hD3 := «биты-сверху» D
      have hk : «биты» D + («биты» N - «биты» D - 54 + 52) ≤ «биты» N - 1 := by omega
      have := «степень-моно» hk
      rw [«степень-сумма»] at this
      have h2 : D * 2 ^ («биты» N - «биты» D - 54 + 52) ≤
          2 ^ «биты» D * 2 ^ («биты» N - «биты» D - 54 + 52) := Nat.mul_le_mul_right _ (Nat.le_of_lt hD3)
      omega
  · right
    split
    · rename_i h1 h2; simpa [Nat.add_assoc] using Nat.le_of_not_lt h1
    · rename_i h1 h2; simpa [Nat.add_assoc] using Nat.le_of_not_lt h2

theorem «порядок-единственен» {N D t u : Nat}
    (ht1 : N < D * 2 ^ (t + 53)) (ht2 : t = 0 ∨ D * 2 ^ (t + 52) ≤ N)
    (hu1 : N < D * 2 ^ (u + 53)) (hu2 : u = 0 ∨ D * 2 ^ (u + 52) ≤ N) : t = u := by
  rcases Nat.lt_trichotomy t u with h | h | h
  · rcases hu2 with hu | hu
    · omega
    · have := Nat.mul_le_mul_left D («степень-моно» (show t + 53 ≤ u + 52 by omega))
      omega
  · exact h
  · rcases ht2 with ht | ht
    · omega
    · have := Nat.mul_le_mul_left D («степень-моно» (show u + 53 ≤ t + 52 by omega))
      omega

theorem «порядок-моно» {N1 D1 N2 D2 : Nat} (h1 : 0 < D1) (h2 : 0 < D2) (h : N1 * D2 ≤ N2 * D1) :
    «порядок» N1 D1 ≤ «порядок» N2 D2 := by
  apply Nat.le_of_not_lt
  intro hlt
  have a1 := «порядок-снизу» (N := N1) h1
  have b1 := «порядок-сверху» (N := N2) h2
  rcases a1 with a1 | a1
  · omega
  · have p := Nat.mul_le_mul_left D2 («степень-моно» (show «порядок» N2 D2 + 53 ≤ «порядок» N1 D1 + 52 by omega))
    have q1 : N2 * D1 < D2 * 2 ^ («порядок» N2 D2 + 53) * D1 := Nat.mul_lt_mul_of_pos_right b1 h1
    have q2 : D2 * 2 ^ («порядок» N2 D2 + 53) * D1 ≤ D2 * 2 ^ («порядок» N1 D1 + 52) * D1 :=
      Nat.mul_le_mul_right _ p
    have q3 : D1 * 2 ^ («порядок» N1 D1 + 52) * D2 ≤ N1 * D2 := Nat.mul_le_mul_right _ a1
    have q4 : D2 * 2 ^ («порядок» N1 D1 + 52) * D1 = D1 * 2 ^ («порядок» N1 D1 + 52) * D2 := by
      rw [Nat.mul_comm D2, Nat.mul_assoc, Nat.mul_comm D2 D1, ← Nat.mul_assoc, Nat.mul_comm (2 ^ _) D1]
    omega

def «кБлижнему» (N B : Nat) : Nat :=
  if B < 2 * (N % B) ∨ (2 * (N % B) = B ∧ (N / B) % 2 = 1) then N / B + 1 else N / B

theorem «кБлижнему-между» (N B : Nat) : N / B ≤ «кБлижнему» N B ∧ «кБлижнему» N B ≤ N / B + 1 := by
  unfold «кБлижнему»; split <;> omega

theorem «частное-моно» {N1 B1 N2 B2 : Nat} (h1 : 0 < B1) (h2 : 0 < B2) (h : N1 * B2 ≤ N2 * B1) :
    N1 / B1 ≤ N2 / B2 := by
  rw [Nat.le_div_iff_mul_le h2]
  apply Nat.le_of_mul_le_mul_right _ h1
  have a := Nat.div_mul_le_self N1 B1
  have b : N1 / B1 * B1 * B2 ≤ N1 * B2 := Nat.mul_le_mul_right _ a
  have c : N1 / B1 * B2 * B1 = N1 / B1 * B1 * B2 := by
    rw [Nat.mul_assoc, Nat.mul_comm B2, ← Nat.mul_assoc]
  omega

theorem «кБлижнему-моно» {N1 B1 N2 B2 : Nat} (h1 : 0 < B1) (h2 : 0 < B2) (h : N1 * B2 ≤ N2 * B1) :
    «кБлижнему» N1 B1 ≤ «кБлижнему» N2 B2 := by
  have hq := «частное-моно» h1 h2 h
  have m1 := «кБлижнему-между» N1 B1
  have m2 := «кБлижнему-между» N2 B2
  rcases Nat.lt_or_eq_of_le hq with hlt | heq
  · omega
  · have e1 := Nat.div_add_mod N1 B1
    have e2 := Nat.div_add_mod N2 B2
    have hr : N1 % B1 * B2 ≤ N2 % B2 * B1 := by
      rw [← e1, ← e2, heq] at h
      grind
    have r1 := Nat.mod_lt N1 h1
    have r2 := Nat.mod_lt N2 h2
    unfold «кБлижнему»
    by_cases c1 : B1 < 2 * (N1 % B1) ∨ (2 * (N1 % B1) = B1 ∧ (N1 / B1) % 2 = 1)
    · have c2 : B2 < 2 * (N2 % B2) ∨ (2 * (N2 % B2) = B2 ∧ (N2 / B2) % 2 = 1) := by
        rcases c1 with c1 | ⟨c1, c3⟩
        · left
          have : B1 * B2 < 2 * (N1 % B1) * B2 := Nat.mul_lt_mul_of_pos_right c1 h2
          have : 2 * (N1 % B1) * B2 ≤ 2 * (N2 % B2) * B1 := by
            rw [Nat.mul_assoc, Nat.mul_assoc]; exact Nat.mul_le_mul_left 2 hr
          have : B2 * B1 < 2 * (N2 % B2) * B1 := by rw [Nat.mul_comm B2]; omega
          exact Nat.lt_of_mul_lt_mul_right this
        · have : B1 * B2 = 2 * (N1 % B1) * B2 := by rw [c1]
          have : 2 * (N1 % B1) * B2 ≤ 2 * (N2 % B2) * B1 := by
            rw [Nat.mul_assoc, Nat.mul_assoc]; exact Nat.mul_le_mul_left 2 hr
          have : B2 * B1 ≤ 2 * (N2 % B2) * B1 := by rw [Nat.mul_comm B2]; omega
          have h5 := Nat.le_of_mul_le_mul_right this h1
          rcases Nat.lt_or_eq_of_le h5 with h6 | h6
          · left; exact h6
          · right; exact ⟨h6.symm, by rw [← heq]; exact c3⟩
      simp only [c1, c2, ite_true]; omega
    · simp only [c1, ite_false]; split <;> omega

def «окрЕд» (N D : Nat) : Nat := «кБлижнему» N (D * 2 ^ «порядок» N D) * 2 ^ «порядок» N D

theorem «кБлижнему-сверху» {N B : Nat} (hB : 0 < B) (h : N < B * 2 ^ 53) : «кБлижнему» N B ≤ 2 ^ 53 := by
  have := (Nat.div_lt_iff_lt_mul hB).mpr (by rw [Nat.mul_comm]; exact h)
  have := «кБлижнему-между» N B
  omega

theorem «кБлижнему-снизу» {N B : Nat} (hB : 0 < B) (h : B * 2 ^ 52 ≤ N) : 2 ^ 52 ≤ «кБлижнему» N B := by
  have := (Nat.le_div_iff_mul_le hB).mpr (by rw [Nat.mul_comm]; exact h)
  have := «кБлижнему-между» N B
  omega

theorem «окрЕд-моно» {N1 D1 N2 D2 : Nat} (h1 : 0 < D1) (h2 : 0 < D2) (h : N1 * D2 ≤ N2 * D1) :
    «окрЕд» N1 D1 ≤ «окрЕд» N2 D2 := by
  have he := «порядок-моно» h1 h2 h
  unfold «окрЕд»
  generalize hx : «порядок» N1 D1 = e1 at he ⊢
  generalize hy : «порядок» N2 D2 = e2 at he ⊢
  have p1 := «степень-полож» e1
  have p2 := «степень-полож» e2
  rcases Nat.lt_or_eq_of_le he with hlt | heq
  · have u1 := «порядок-сверху» (N := N1) h1
    rw [hx, «степень-сумма», ← Nat.mul_assoc] at u1
    have v1 := «кБлижнему-сверху» (Nat.mul_pos h1 p1) u1
    have l2 := «порядок-снизу» (N := N2) h2
    rw [hy] at l2
    rcases l2 with l2 | l2
    · omega
    · rw [«степень-сумма», ← Nat.mul_assoc] at l2
      have v2 := «кБлижнему-снизу» (Nat.mul_pos h2 p2) l2
      have a : «кБлижнему» N1 (D1 * 2 ^ e1) * 2 ^ e1 ≤ 2 ^ 53 * 2 ^ e1 := Nat.mul_le_mul_right _ v1
      have b : 2 ^ 52 * 2 ^ e2 ≤ «кБлижнему» N2 (D2 * 2 ^ e2) * 2 ^ e2 := Nat.mul_le_mul_right _ v2
      have c : 2 ^ 53 * 2 ^ e1 ≤ 2 ^ 52 * 2 ^ e2 := by
        rw [← «степень-сумма», ← «степень-сумма»]; exact «степень-моно» (by omega)
      omega
  · subst heq
    apply Nat.mul_le_mul_right
    apply «кБлижнему-моно» (Nat.mul_pos h1 p1) (Nat.mul_pos h2 p1)
    have := Nat.mul_le_mul_right (2 ^ e1) h
    grind

theorem «окрЕд-точно» {M E D : Nat} (hD : 0 < D) (hM : M < 2 ^ 53) (hE : E = 0 ∨ 2 ^ 52 ≤ M) :
    «окрЕд» (M * 2 ^ E * D) D = M * 2 ^ E := by
  have hp := «степень-полож» E
  have up : M * 2 ^ E * D < D * 2 ^ (E + 53) := by
    rw [«степень-сумма»]
    have := Nat.mul_lt_mul_of_pos_right hM (Nat.mul_pos hD hp)
    grind
  have lo : E = 0 ∨ D * 2 ^ (E + 52) ≤ M * 2 ^ E * D := by
    rcases hE with h | h
    · left; exact h
    · right
      rw [«степень-сумма»]
      have := Nat.mul_le_mul_right (2 ^ E * D) h
      grind
  have he := «порядок-единственен» («порядок-сверху» (N := M * 2 ^ E * D) hD) («порядок-снизу» hD) up lo
  unfold «окрЕд»
  rw [he]
  have hB : 0 < D * 2 ^ E := Nat.mul_pos hD hp
  have hq : M * 2 ^ E * D = M * (D * 2 ^ E) := by grind
  unfold «кБлижнему»
  rw [hq, Nat.mul_mod_left, Nat.mul_div_cancel _ hB]
  simp only [Nat.mul_zero]
  have : ¬ (0 = D * 2 ^ E ∧ M % 2 = 1) := by omega
  simp [this]

theorem «окрЕд-форма» {N D : Nat} (hD : 0 < D) :
    ∃ m e, «окрЕд» N D = m * 2 ^ e ∧ m ≤ 2 ^ 53 ∧ (e = 0 ∨ 2 ^ 52 ≤ m) := by
  refine ⟨«кБлижнему» N (D * 2 ^ «порядок» N D), «порядок» N D, rfl, ?_, ?_⟩
  · have u := «порядок-сверху» (N := N) hD
    rw [«степень-сумма», ← Nat.mul_assoc] at u
    exact «кБлижнему-сверху» (Nat.mul_pos hD («степень-полож» _)) u
  · rcases «порядок-снизу» (N := N) hD with h | h
    · left; exact h
    · right
      rw [«степень-сумма», ← Nat.mul_assoc] at h
      exact «кБлижнему-снизу» (Nat.mul_pos hD («степень-полож» _)) h

theorem «окрЕд-дважды» {N D : Nat} (hD : 0 < D) : «окрЕд» («окрЕд» N D) 1 = «окрЕд» N D := by
  obtain ⟨m, e, h, hm, he⟩ := «окрЕд-форма» (N := N) hD
  rw [h]
  rcases Nat.lt_or_eq_of_le hm with hm | hm
  · have := «окрЕд-точно» (M := m) (E := e) (D := 1) (by decide) hm he
    simpa using this
  · subst hm
    have q : 2 ^ 53 * 2 ^ e = 2 ^ 52 * 2 ^ (e + 1) := by
      rw [Nat.pow_succ 2 e, Nat.pow_succ 2 52, Nat.mul_assoc, Nat.mul_comm 2]
    rw [q]
    have := «окрЕд-точно» (M := 2 ^ 52) (E := e + 1) (D := 1) (by decide) (by decide) (Or.inr (Nat.le_refl _))
    simpa using this

theorem «окрЕд-ноль» (D : Nat) : «окрЕд» 0 D = 0 := by
  simp [«окрЕд», «кБлижнему»]

theorem «окрЕд-отношение» {N1 D1 N2 D2 : Nat} (h1 : 0 < D1) (h2 : 0 < D2) (h : N1 * D2 = N2 * D1) :
    «окрЕд» N1 D1 = «окрЕд» N2 D2 :=
  Nat.le_antisymm («окрЕд-моно» h1 h2 (Nat.le_of_eq h)) («окрЕд-моно» h2 h1 (Nat.le_of_eq h.symm))

inductive «Д64» where
  | «нечисло»
  | «беск» (s : Bool)
  | «кон» (s : Bool) (v : Nat)
deriving DecidableEq, Repr

open «Д64»

def «округлить» (s : Bool) (N D : Nat) : «Д64» :=
  if «предел» ≤ «окрЕд» N D then «беск» s else «кон» s («окрЕд» N D)

def «Представимо» (v : Nat) : Prop := «окрЕд» v 1 = v ∧ v < «предел»

def «Д64».«годно» : «Д64» → Prop
  | «кон» _ v => «Представимо» v
  | _ => True

theorem «округлить-годно» (s : Bool) {N D : Nat} (hD : 0 < D) : («округлить» s N D).«годно» := by
  unfold «округлить»
  by_cases h : «предел» ≤ «окрЕд» N D
  · simp only [h, ↓reduceIte]; trivial
  · simp only [h, ↓reduceIte]
    exact ⟨«окрЕд-дважды» hD, Nat.lt_of_not_le h⟩

def «вЕдиницах» (s : Bool) (v : Nat) : Int := if s then -(v : Int) else v

def «изЗнач» (x : Int) (D : Nat) (z : Bool) : «Д64» :=
  if x = 0 then «кон» z 0 else «округлить» (decide (x < 0)) x.natAbs D

def «отр64» : «Д64» → «Д64»
  | «нечисло» => «нечисло»
  | «беск» s => «беск» (!s)
  | «кон» s v => «кон» (!s) v

def «плюс64» : «Д64» → «Д64» → «Д64»
  | «нечисло», _ => «нечисло»
  | _, «нечисло» => «нечисло»
  | «беск» a, «беск» b => if a = b then «беск» a else «нечисло»
  | «беск» a, «кон» _ _ => «беск» a
  | «кон» _ _, «беск» b => «беск» b
  | «кон» a x, «кон» b y => «изЗнач» («вЕдиницах» a x + «вЕдиницах» b y) 1 (a && b)

def «минус64» (x y : «Д64») : «Д64» := «плюс64» x («отр64» y)

def «нуль?» : «Д64» → Bool
  | «кон» _ 0 => true
  | _ => false

def «знак64» : «Д64» → Bool
  | «нечисло» => false
  | «беск» s => s
  | «кон» s _ => s

def «умножить64» : «Д64» → «Д64» → «Д64»
  | «нечисло», _ => «нечисло»
  | _, «нечисло» => «нечисло»
  | «беск» a, «беск» b => «беск» (a != b)
  | «беск» a, «кон» b y => if y = 0 then «нечисло» else «беск» (a != b)
  | «кон» a x, «беск» b => if x = 0 then «нечисло» else «беск» (a != b)
  | «кон» a x, «кон» b y => if x * y = 0 then «кон» (a != b) 0 else «округлить» (a != b) (x * y) («шаг»)

def «делить64» : «Д64» → «Д64» → «Д64»
  | «нечисло», _ => «нечисло»
  | _, «нечисло» => «нечисло»
  | «беск» _, «беск» _ => «нечисло»
  | «беск» a, «кон» b _ => «беск» (a != b)
  | «кон» a _, «беск» b => «кон» (a != b) 0
  | «кон» a x, «кон» b y =>
    if y = 0 then (if x = 0 then «нечисло» else «беск» (a != b))
    else if x = 0 then «кон» (a != b) 0
    else «округлить» (a != b) (x * «шаг») y

def «остаток64» : «Д64» → «Д64» → «Д64»
  | «нечисло», _ => «нечисло»
  | _, «нечисло» => «нечисло»
  | «беск» _, _ => «нечисло»
  | «кон» a x, «беск» _ => «кон» a x
  | «кон» a x, «кон» b y => if y = 0 then «нечисло» else «кон» a (x % y)

def «вЦелое» : «Д64» → Option Int
  | «кон» s v => some («вЕдиницах» s v)
  | _ => none

def «меньше64» : «Д64» → «Д64» → Bool
  | «нечисло», _ => false
  | _, «нечисло» => false
  | «беск» a, «беск» b => a && !b
  | «беск» a, «кон» _ _ => a
  | «кон» _ _, «беск» b => !b
  | «кон» a x, «кон» b y => decide («вЕдиницах» a x < «вЕдиницах» b y)

def «неБольше64» : «Д64» → «Д64» → Bool
  | «нечисло», _ => false
  | _, «нечисло» => false
  | «беск» a, «беск» b => a || !b
  | «беск» a, «кон» _ _ => a
  | «кон» _ _, «беск» b => !b
  | «кон» a x, «кон» b y => decide («вЕдиницах» a x ≤ «вЕдиницах» b y)

def «равен64» (x y : «Д64») : Bool := decide (x = y)

def «изЦелого» (n : Int) : «Д64» := «изЗнач» (n * «шаг») 1 false

def «изДроби» (p : Int) (q : Nat) : «Д64» :=
  if q = 0 then «нечисло» else «изЗнач» (p * «шаг») q false

def «вБиты» : «Д64» → Nat
  | «нечисло» => 0x7FF8000000000000
  | «беск» s => (if s then 2 ^ 63 else 0) + 0x7FF * 2 ^ 52
  | «кон» s v =>
    let e := «порядок» v 1
    let m := v / 2 ^ e
    (if s then 2 ^ 63 else 0) +
      (if 2 ^ 52 ≤ m then (e + 1) * 2 ^ 52 + (m - 2 ^ 52) else m)

def «изБит» (b : Nat) : «Д64» :=
  let s := decide (2 ^ 63 ≤ b % 2 ^ 64)
  let E := (b % 2 ^ 63) / 2 ^ 52
  let f := b % 2 ^ 52
  if E = 0x7FF then (if f = 0 then «беск» s else «нечисло»)
  else if E = 0 then «кон» s f
  else «кон» s ((2 ^ 52 + f) * 2 ^ (E - 1))

def «нечисло?» : «Д64» → Bool
  | «нечисло» => true
  | _ => false

theorem «окрЕд-сетка» : ∀ (E M : Nat), M < 2 ^ 53 → «окрЕд» (M * 2 ^ E) 1 = M * 2 ^ E
  | 0, M, h => by
    have := «окрЕд-точно» (M := M) (E := 0) (D := 1) (by decide) h (Or.inl rfl)
    simpa using this
  | E + 1, M, h => by
    by_cases hm : 2 ^ 52 ≤ M
    · have := «окрЕд-точно» (M := M) (E := E + 1) (D := 1) (by decide) h (Or.inr hm)
      simpa using this
    · have q : M * 2 ^ (E + 1) = (M * 2) * 2 ^ E := by
        rw [Nat.pow_succ, Nat.mul_comm (2 ^ E) 2, ← Nat.mul_assoc]
      rw [q]
      exact «окрЕд-сетка» E (M * 2) (by
        have : 2 ^ 53 = 2 ^ 52 * 2 := Nat.pow_succ 2 52
        omega)

theorem «предел-запас» {M E : Nat} (hM : M ≤ 2 ^ 53) (hE : E ≤ 2044) : M * 2 ^ E < «предел» := by
  unfold «предел»
  have a : M * 2 ^ E ≤ 2 ^ 53 * 2 ^ E := Nat.mul_le_mul_right _ hM
  have b : 2 ^ 53 * 2 ^ E < 2 ^ 2098 := by
    rw [← «степень-сумма»]; exact «степень-строго» (a := 53 + E) (b := 2098) (by omega)
  generalize (2 : Nat) ^ 2098 = P at b ⊢
  omega

theorem «шаг-запас» {M : Nat} (h : M ≤ 2 ^ 53) : M * «шаг» < «предел» := by
  rw [«шаг-степень»]; exact «предел-запас» (E := 1074) h (by decide)

theorem «шаг-полож» : 0 < «шаг» := by rw [«шаг-степень»]; exact «степень-полож» _

theorem «сдвиг-верха» (k : Nat) : 2 ^ 53 * 2 ^ k = 2 ^ 52 * 2 ^ (k + 1) := by
  rw [Nat.pow_succ 2 k, Nat.pow_succ 2 52, Nat.mul_assoc, Nat.mul_comm 2]

theorem «шаг-сетка» {M : Nat} (h : M ≤ 2 ^ 53) : «окрЕд» (M * «шаг») 1 = M * «шаг» := by
  rw [«шаг-степень»]
  rcases Nat.lt_or_eq_of_le h with h | h
  · exact «окрЕд-сетка» 1074 M h
  · subst h
    rewrite [«сдвиг-верха» 1074]
    exact «окрЕд-сетка» (1074 + 1) (2 ^ 52) (by decide)
