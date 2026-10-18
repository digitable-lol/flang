import «Модель»

set_option exponentiation.threshold 4200
set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

open «Знач»

def «вД64» : «Знач» → «Д64»
  | «неЧисло» => .«нечисло»
  | «минусБеск» => .«беск» true
  | «плюсБеск» => .«беск» false
  | «минусНоль» => .«кон» true 0
  | «кон» n => .«кон» (decide (n < 0)) (n.natAbs * «шаг»)

theorem «вЕдиницах-вД64» (n : Int) : «вЕдиницах» (decide (n < 0)) (n.natAbs * «шаг») = n * «шаг» := by
  unfold «вЕдиницах»
  by_cases h : n < 0
  · simp only [h, decide_true, ite_true]
    rw [Int.natCast_mul]
    have : (n.natAbs : Int) = -n := by omega
    rw [this, Int.neg_mul, Int.neg_neg]
  · simp only [h, decide_false, Bool.false_eq_true, ite_false]
    rw [Int.natCast_mul]
    have : (n.natAbs : Int) = n := by omega
    rw [this]

theorem «окрЕд-не-меньше-шага» {N : Nat} (h : 1 ≤ N) : «шаг» ≤ «окрЕд» (N * «шаг») 1 := by
  have a := «окрЕд-моно» (N1 := 1 * «шаг») (D1 := 1) (N2 := N * «шаг») (D2 := 1) (by decide) (by decide)
    (by rw [Nat.mul_one, Nat.mul_one]; exact Nat.mul_le_mul_right _ h)
  rw [«шаг-сетка» (M := 1) (by decide), Nat.one_mul] at a
  exact a

theorem «окрЕд-кратно» (N : Nat) : «шаг» ∣ «окрЕд» (N * «шаг») 1 := by
  by_cases hN : N ≤ 2 ^ 53
  · rw [«шаг-сетка» hN]; exact Nat.dvd_mul_left _ _
  · have up := «порядок-сверху» (N := N * «шаг») (D := 1) (by decide)
    generalize hE : «порядок» (N * «шаг») 1 = e at up
    have he : 1074 ≤ e := by
      apply Nat.le_of_not_lt
      intro hlt
      have p1 : 2 ^ (e + 53) ≤ 2 ^ 1126 := «степень-моно» (by omega)
      have p2 : 2 ^ 1126 = 2 ^ 52 * «шаг» := by rw [«шаг-степень», ← «степень-сумма»]
      have p3 : 2 ^ 53 * «шаг» ≤ N * «шаг» := Nat.mul_le_mul_right _ (by omega)
      have p4 : 2 ^ 52 * «шаг» < 2 ^ 53 * «шаг» := Nat.mul_lt_mul_of_pos_right (by decide) «шаг-полож»
      rw [Nat.one_mul] at up
      omega
    unfold «окрЕд»
    rw [hE]
    apply Nat.dvd_mul_left_of_dvd
    rw [«шаг-степень»]
    exact Nat.pow_dvd_pow 2 he

theorem «окр64-это-д64» (n : Int) : «вД64» («окр64» n) = «изЦелого» n := by
  by_cases h0 : n = 0
  · subst h0; decide +kernel
  unfold «изЦелого» «изЗнач»
  have habs : (n * «шаг»).natAbs = n.natAbs * «шаг» := by
    rw [Int.natAbs_mul]; rfl
  have hsgn : decide (n * «шаг» < 0) = decide (n < 0) := by
    have hp : (0 : Int) < «шаг» := by exact_mod_cast «шаг-полож»
    by_cases h : n < 0
    · have : n * «шаг» < 0 := Int.mul_neg_of_neg_of_pos h hp
      simp [h, this]
    · have : ¬ n * «шаг» < 0 := by
        have := Int.mul_nonneg (by omega : 0 ≤ n) (Int.le_of_lt hp); omega
      simp [h, this]
  · have hz : ¬ n * «шаг» = 0 := by
      intro hm
      rcases Int.mul_eq_zero.mp hm with hm | hm
      · exact h0 hm
      · have : (0 : Int) < «шаг» := by exact_mod_cast «шаг-полож»
        omega
    rw [«выбор-нет» hz]
    unfold «округлить» «окр64»
    rw [habs, hsgn]
    by_cases hp : «предел» ≤ «окрЕд» (n.natAbs * «шаг») 1
    · rw [«выбор-да» hp, «выбор-да» hp]
      by_cases hn : n < 0
      · simp [hn, «вД64»]
      · simp [hn, «вД64»]
    · rw [«выбор-нет» hp, «выбор-нет» hp]
      have hd := «окрЕд-кратно» n.natAbs
      have hg := «окрЕд-не-меньше-шага» (N := n.natAbs) (by omega)
      have hk : «окрЕд» (n.natAbs * «шаг») 1 / «шаг» * «шаг» = «окрЕд» (n.natAbs * «шаг») 1 :=
        Nat.div_mul_cancel hd
      have hq : 1 ≤ «окрЕд» (n.natAbs * «шаг») 1 / «шаг» := (Nat.le_div_iff_mul_le «шаг-полож»).mpr (by omega)
      by_cases hn : n < 0
      · rw [«выбор-да» hn]
        simp only [«вД64»]
        have hneg : -((«окрЕд» (n.natAbs * «шаг») 1 / «шаг» : Nat) : Int) < 0 := by omega
        rw [decide_eq_true hneg, decide_eq_true hn, Int.natAbs_neg, Int.natAbs_natCast, hk]
      · rw [«выбор-нет» hn]
        simp only [«вД64»]
        have hpos : ¬ ((«окрЕд» (n.natAbs * «шаг») 1 / «шаг» : Nat) : Int) < 0 := by omega
        rw [decide_eq_false hpos, decide_eq_false hn, Int.natAbs_natCast, hk]


theorem «шаг-цел» : (0 : Int) < «шаг» := by exact_mod_cast «шаг-полож»

theorem «шаг-не-больше» (a b : Int) : a * «шаг» ≤ b * «шаг» ↔ a ≤ b :=
  ⟨fun h => Int.le_of_mul_le_mul_right h «шаг-цел», fun h => Int.mul_le_mul_of_nonneg_right h (Int.le_of_lt «шаг-цел»)⟩

theorem «шаг-меньше» (a b : Int) : a * «шаг» < b * «шаг» ↔ a < b :=
  ⟨fun h => Int.lt_of_mul_lt_mul_right h (Int.le_of_lt «шаг-цел»), fun h => Int.mul_lt_mul_of_pos_right h «шаг-цел»⟩

theorem «вЕдиницах-ноль» (s : Bool) : «вЕдиницах» s 0 = 0 := by cases s <;> rfl

theorem «вД64-неБольше» (x y : «Знач») : «неБольше» x y = «неБольше64» («вД64» x) («вД64» y) := by
  cases x <;> cases y <;> simp only [«неБольше», «неБольше64», «вД64», «вЕдиницах-вД64», «вЕдиницах-ноль»] <;>
    (try rfl) <;> (try simp)
  all_goals first
    | (rename_i a b; exact («шаг-не-больше» a b).symm)
    | (rename_i a; have := «шаг-не-больше» a 0; rw [Int.zero_mul] at this; exact this.symm)
    | (rename_i a; have := «шаг-не-больше» 0 a; rw [Int.zero_mul] at this; exact this.symm)

theorem «вД64-меньше» (x y : «Знач») : «меньше» x y = «меньше64» («вД64» x) («вД64» y) := by
  cases x <;> cases y <;> simp only [«меньше», «меньше64», «вД64», «вЕдиницах-вД64», «вЕдиницах-ноль»] <;>
    (try rfl) <;> (try simp)
  all_goals first
    | (rename_i a b; exact («шаг-меньше» a b).symm)
    | (rename_i a; have := «шаг-меньше» a 0; rw [Int.zero_mul] at this; exact this.symm)
    | (rename_i a; have := «шаг-меньше» 0 a; rw [Int.zero_mul] at this; exact this.symm)

theorem «кон-инъективно» {a b : Int} (h : «вД64» («кон» a) = «вД64» («кон» b)) : a = b := by
  simp only [«вД64», «Д64».«кон».injEq] at h
  obtain ⟨h1, h2⟩ := h
  have h3 : a.natAbs = b.natAbs := Nat.eq_of_mul_eq_mul_right «шаг-полож» h2
  by_cases ha : a < 0 <;> by_cases hb : b < 0 <;> simp [ha, hb] at h1 <;> omega

theorem «кон-не-минусНоль» (a : Int) : «вД64» («кон» a) ≠ «вД64» «минусНоль» := by
  intro h
  simp only [«вД64», «Д64».«кон».injEq] at h
  obtain ⟨h1, h2⟩ := h
  have : a.natAbs = 0 := by
    rcases Nat.mul_eq_zero.mp h2 with h2 | h2
    · exact h2
    · have := «шаг-полож»; omega
  have : a < 0 := by simpa using h1
  omega

theorem «вД64-инъективно» {x y : «Знач»} (h : «вД64» x = «вД64» y) : x = y := by
  cases x <;> cases y
  all_goals first
    | rfl
    | exact congrArg «кон» («кон-инъективно» h)
    | exact absurd h («кон-не-минусНоль» _)
    | exact absurd h.symm («кон-не-минусНоль» _)
    | (simp [«вД64»] at h)

theorem «вД64-равен» (x y : «Знач») : «равен» x y = «равен64» («вД64» x) («вД64» y) := by
  unfold «равен» «равен64»
  by_cases h : x = y
  · subst h; simp
  · have : «вД64» x ≠ «вД64» y := fun e => h («вД64-инъективно» e)
    simp [h, this]

theorem «вД64-отр» (x : «Знач») : «вД64» («отр» x) = «отр64» («вД64» x) := by
  cases x with
  | «кон» n =>
    by_cases h : n = 0
    · subst h; simp [«отр», «вД64», «отр64»]
    · simp only [«отр», h, ↓reduceIte, «вД64», «отр64», Int.natAbs_neg]
      by_cases hn : n < 0
      · have : ¬ -n < 0 := by omega
        simp [hn, this]; omega
      · have : -n < 0 := by omega
        simp [hn, this]; omega
  | «минусНоль» => simp [«отр», «вД64», «отр64»]
  | _ => rfl

theorem «изЗнач-знак» {x : Int} (D : Nat) (z z' : Bool) (h : x ≠ 0) : «изЗнач» x D z = «изЗнач» x D z' := by
  unfold «изЗнач»; simp [h]

theorem «сумма-конечных» (a b : Int) (sa sb : Bool) (ha : «вЕдиницах» sa (a.natAbs * «шаг») = a * «шаг»)
    (hb : «вЕдиницах» sb (b.natAbs * «шаг») = b * «шаг») (hz : a + b = 0 → (sa && sb) = false) :
    «плюс64» (.«кон» sa (a.natAbs * «шаг»)) (.«кон» sb (b.natAbs * «шаг»)) = «изЦелого» (a + b) := by
  simp only [«плюс64», ha, hb, «изЦелого»]
  rw [← Int.add_mul]
  by_cases h : a + b = 0
  · rw [h, hz h]
  · exact «изЗнач-знак» 1 _ _ (fun e => by
      rcases Int.mul_eq_zero.mp e with e | e
      · exact h e
      · have := «шаг-цел»; omega)

theorem «плюс-кон-кон» (a b : Int) :
    «вД64» («плюс» «Двойная» («кон» a) («кон» b)) = «плюс64» («вД64» («кон» a)) («вД64» («кон» b)) := by
  show «вД64» («окр64» (a + b)) = «плюс64» (.«кон» (decide (a < 0)) (a.natAbs * «шаг»)) (.«кон» (decide (b < 0)) (b.natAbs * «шаг»))
  rw [«окр64-это-д64»]
  exact («сумма-конечных» a b _ _ («вЕдиницах-вД64» a) («вЕдиницах-вД64» b) (fun e => by
    by_cases ha : a < 0 <;> by_cases hb : b < 0 <;> simp [ha, hb] <;> omega)).symm

theorem «плюс-ноль-кон» (b : Int) :
    «вД64» («плюс» «Двойная» «минусНоль» («кон» b)) = «плюс64» («вД64» «минусНоль») («вД64» («кон» b)) := by
  show «вД64» («окр64» (0 + b)) = «плюс64» (.«кон» true 0) (.«кон» (decide (b < 0)) (b.natAbs * «шаг»))
  rw [«окр64-это-д64»]
  have := «сумма-конечных» 0 b true _ (by simp [«вЕдиницах»]) («вЕдиницах-вД64» b) (fun e => by
    have : b = 0 := by omega
    subst this; simp)
  simp only [Int.natAbs_zero, Nat.zero_mul] at this
  exact this.symm

theorem «плюс-кон-ноль» (a : Int) :
    «вД64» («плюс» «Двойная» («кон» a) «минусНоль») = «плюс64» («вД64» («кон» a)) («вД64» «минусНоль») := by
  show «вД64» («окр64» (a + 0)) = «плюс64» (.«кон» (decide (a < 0)) (a.natAbs * «шаг»)) (.«кон» true 0)
  rw [«окр64-это-д64»]
  have := «сумма-конечных» a 0 _ true («вЕдиницах-вД64» a) (by simp [«вЕдиницах»]) (fun e => by
    have : a = 0 := by omega
    subst this; simp)
  simp only [Int.natAbs_zero, Nat.zero_mul] at this
  exact this.symm

theorem «вД64-плюс» : ∀ (x y : «Знач»), ¬ (x = «минусНоль» ∧ y = «минусНоль») →
    «вД64» («плюс» «Двойная» x y) = «плюс64» («вД64» x) («вД64» y)
  | «кон» a, «кон» b, _ => «плюс-кон-кон» a b
  | «минусНоль», «кон» b, _ => «плюс-ноль-кон» b
  | «кон» a, «минусНоль», _ => «плюс-кон-ноль» a
  | «минусНоль», «минусНоль», h => absurd ⟨rfl, rfl⟩ h
  | «неЧисло», _, _ => rfl
  | «кон» _, «неЧисло», _ => rfl
  | «минусНоль», «неЧисло», _ => rfl
  | «плюсБеск», «неЧисло», _ => rfl
  | «минусБеск», «неЧисло», _ => rfl
  | «плюсБеск», «плюсБеск», _ => rfl
  | «плюсБеск», «минусБеск», _ => rfl
  | «плюсБеск», «минусНоль», _ => rfl
  | «плюсБеск», «кон» _, _ => rfl
  | «минусБеск», «плюсБеск», _ => rfl
  | «минусБеск», «минусБеск», _ => rfl
  | «минусБеск», «минусНоль», _ => rfl
  | «минусБеск», «кон» _, _ => rfl
  | «кон» _, «плюсБеск», _ => rfl
  | «кон» _, «минусБеск», _ => rfl
  | «минусНоль», «плюсБеск», _ => rfl
  | «минусНоль», «минусБеск», _ => rfl

theorem «знак-нуля-суммы» :
    «вД64» («плюс» «Двойная» «минусНоль» «минусНоль») ≠ «плюс64» («вД64» «минусНоль») («вД64» «минусНоль») := by
  decide +kernel

theorem «округлить-отношение» (s : Bool) {N1 D1 N2 D2 : Nat} (h1 : 0 < D1) (h2 : 0 < D2) (h : N1 * D2 = N2 * D1) :
    «округлить» s N1 D1 = «округлить» s N2 D2 := by
  unfold «округлить»; rw [«окрЕд-отношение» h1 h2 h]

theorem «умножить-кон» («о» : «Округление») (a b : Int) :
    «умножить» «о» («кон» a) («кон» b) = «о».«ф» (a * b) := rfl

theorem «Двойная-ф» : «Двойная».«ф» = «окр64» := rfl

theorem «умножить-кон-кон» (a b : Int) (h : a * b ≠ 0) :
    «вД64» («умножить» «Двойная» («кон» a) («кон» b)) = «умножить64» («вД64» («кон» a)) («вД64» («кон» b)) := by
  rw [«умножить-кон», «Двойная-ф», «окр64-это-д64»]
  simp only [«вД64»]
  have ha : a ≠ 0 := fun e => h (by rw [e, Int.zero_mul])
  have hb : b ≠ 0 := fun e => h (by rw [e, Int.mul_zero])
  have hp := «шаг-полож»
  have hpos : a.natAbs * «шаг» * (b.natAbs * «шаг») ≠ 0 := by
    have : 0 < a.natAbs := by omega
    have : 0 < b.natAbs := by omega
    exact Nat.ne_of_gt (Nat.mul_pos (Nat.mul_pos ‹_› hp) (Nat.mul_pos ‹_› hp))
  have hz : a * b * «шаг» ≠ 0 := fun e => by
    rcases Int.mul_eq_zero.mp e with e | e
    · exact h e
    · have := «шаг-цел»; omega
  simp only [«умножить64», hpos, ↓reduceIte, «изЦелого», «изЗнач», hz]
  have habs : (a * b * «шаг»).natAbs = a.natAbs * b.natAbs * «шаг» := by
    rw [Int.natAbs_mul, Int.natAbs_mul]; rfl
  rw [habs]
  have hs : decide (a * b * «шаг» < 0) = (decide (a < 0) != decide (b < 0)) := by
    have hq := «шаг-цел»
    by_cases x : a < 0 <;> by_cases y : b < 0
    · have : 0 < a * b := Int.mul_pos_of_neg_of_neg x y
      have : ¬ a * b * «шаг» < 0 := by have := Int.mul_pos this hq; omega
      simp [x, y, this]
    · have : a * b < 0 := Int.mul_neg_of_neg_of_pos x (by omega)
      have : a * b * «шаг» < 0 := Int.mul_neg_of_neg_of_pos this hq
      simp [x, y, this]
    · have : a * b < 0 := Int.mul_neg_of_pos_of_neg (by omega) y
      have : a * b * «шаг» < 0 := Int.mul_neg_of_neg_of_pos this hq
      simp [x, y, this]
    · have : 0 < a * b := Int.mul_pos (by omega) (by omega)
      have : ¬ a * b * «шаг» < 0 := by have := Int.mul_pos this hq; omega
      simp [x, y, this]
  rw [hs]
  exact «округлить-отношение» _ (by decide) hp (by
    rw [Nat.mul_one]
    simp only [Nat.mul_assoc, Nat.mul_comm, Nat.mul_left_comm])

theorem «остаток-кон-кон» (a d : Int) (hd : d ≠ 0) (h : 0 ≤ a ∨ Int.tmod a d ≠ 0) :
    «вД64» («остаток» («кон» a) («кон» d)) = «остаток64» («вД64» («кон» a)) («вД64» («кон» d)) := by
  have hp := «шаг-полож»
  have hd' : ¬ d.natAbs * «шаг» = 0 := by
    have : 0 < d.natAbs := by omega
    exact Nat.ne_of_gt (Nat.mul_pos this hp)
  simp only [«остаток», hd, ↓reduceIte, «вД64», «остаток64», hd', Nat.mul_mod_mul_right, Int.natAbs_tmod]
  have : decide (Int.tmod a d < 0) = decide (a < 0) := by
    rcases h with h | h
    · have : 0 ≤ Int.tmod a d := Int.tmod_nonneg d h
      simp only [decide_eq_decide]; omega
    · by_cases ha : a < 0
      · have h1 := Int.tmod_nonneg d (by omega : 0 ≤ -a)
        rw [Int.neg_tmod] at h1
        simp only [decide_eq_decide]; omega
      · have := Int.tmod_nonneg d (by omega : 0 ≤ a)
        simp only [decide_eq_decide]; omega
  rw [this]
