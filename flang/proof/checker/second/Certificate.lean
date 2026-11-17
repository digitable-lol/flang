import Linear

open «Разбор»

namespace «Второй»

/-!
# Модель правила «линейная арифметика»

Запись несёт сертификат Фаркаша: формы «≥ 0» (допущения исходника, границы листьев,
отрицание цели) складываются с целыми множителями больше нуля, и сумма обязана быть
числом меньше нуля. Здесь линейной форме дано значение — сумма множителей на значения
мономов, — и доказано: каждая цель, которую прогон ходов (`«лаБлоки»`) счёл доказанной,
не меньше нуля в каждом мире, где верны допущения; а место, принятое сертификатом
(`«лаСертификат»`), верно.

Что текст сравнения читается в форму верно (`«лаСравнение»`, `«лаФорма»` — разбор текста)
и что раскрытие плоских вызовов цель не меняет — посылки толкования, как чтение текста у
ходов теоремы: сверено на корпусе, не доказано. У приёма «строгий порядок произведения»
(`«лаПроизведение»`, строка записи `ход 2 произведение`) доказано то же о блоках: каждый
множитель, названный доказанным «не меньше единицы», таков; что произведение таких
множителей больше нуля — посылка толкования (`«произведение-положительно»`).
-/

/-- Значение монома: у свободного члена (пустой моном) — единица. -/
def «оценкаМонома» (v : String → Int) (k : String) : Int := if k = "" then 1 else v k

/-- Значение линейной формы: сумма множителей на значения мономов. -/
def «значениеФормы» (v : String → Int) : «ЛФ» → Int
  | [] => 0
  | (k, c) :: r => c * «оценкаМонома» v k + «значениеФормы» v r

theorem «лфК-значение» (v : String → Int) (f : «ЛФ») (k : String) (c : Int) :
    «значениеФормы» v («лфК» f k c) = «значениеФормы» v f + c * «оценкаМонома» v k := by
  induction f with
  | nil => simp [«лфК», «значениеФормы»]
  | cons x r ih =>
    obtain ⟨a, b⟩ := x
    simp only [«лфК»]
    split
    · rename_i hk
      subst hk
      simp only [«значениеФормы», Int.add_mul]
      omega
    · simp only [«значениеФормы», ih]
      omega

theorem «лфСумма-значение» (v : String → Int) (a b : «ЛФ») (m : Int) :
    «значениеФормы» v («лфСумма» a b m) = «значениеФормы» v a + m * «значениеФормы» v b := by
  unfold «лфСумма»
  induction b generalizing a with
  | nil => simp [«значениеФормы»]
  | cons x r ih =>
    obtain ⟨k, c⟩ := x
    simp only [List.foldl_cons, ih, «лфК-значение», «значениеФормы», Int.mul_add, Int.mul_assoc]
    omega

theorem «лфЧисло-значение» (v : String → Int) (c : Int) : «значениеФормы» v («лфЧисло» c) = c := by
  simp [«лфЧисло», «значениеФормы», «оценкаМонома»]

theorem «свёртка-свободных» (v : String → Int) (f : «ЛФ») (z : Int)
    (h : f.any (fun (k, c) => k ≠ "" && c ≠ 0) = false) :
    (f.filter (·.1 = "")).foldl (fun s (_, c) => s + c) z = z + «значениеФормы» v f := by
  induction f generalizing z with
  | nil => simp [«значениеФормы»]
  | cons x r ih =>
    obtain ⟨k, c⟩ := x
    simp only [List.any_cons, Bool.or_eq_false_iff] at h
    obtain ⟨h1, h2⟩ := h
    by_cases hk : k = ""
    · subst hk
      simp [ih _ h2, «значениеФормы», «оценкаМонома»]
      omega
    · have hc : c = 0 := by simpa [hk] using h1
      subst hc
      simp [hk, ih _ h2, «значениеФормы»]

/-- Форма без листьев равна своему свободному члену. -/
theorem «лфКонстанта-значение» (v : String → Int) (f : «ЛФ») (c : Int)
    (h : «лфКонстанта» f = some c) : «значениеФормы» v f = c := by
  unfold «лфКонстанта» at h
  split at h
  · simp at h
  · rename_i hany
    simp only [Bool.not_eq_true] at hany
    have e := «свёртка-свободных» v f 0 hany
    simp only [Option.some.injEq] at h
    rw [e] at h
    omega

/-- Формы, которые сверщик счёл равными, равны значением. -/
theorem «лфРавны-значение» (v : String → Int) (a b : «ЛФ») (h : «лфРавны» a b = true) :
    «значениеФормы» v a = «значениеФормы» v b := by
  unfold «лфРавны» at h
  have e := «лфКонстанта-значение» v _ 0 (by simpa using h)
  rw [«лфСумма-значение»] at e
  omega

theorem «листья-неотрицательны» (v : String → Int) (hv : ∀ m, 0 ≤ v m) (f : «ЛФ»)
    (h1 : f.all (fun (m, c) => m ≠ "" || c = 0) = true)
    (h3 : (f.filter (fun (m, c) => m ≠ "" && c ≠ 0)).all (·.2 = 1) = true) : 0 ≤ «значениеФормы» v f := by
  induction f with
  | nil => simp [«значениеФормы»]
  | cons x r ih =>
    obtain ⟨k, c⟩ := x
    simp only [List.all_cons, Bool.and_eq_true] at h1
    have hr : 0 ≤ «значениеФормы» v r := by
      apply ih h1.2
      simp only [List.filter_cons] at h3
      split at h3
      · simp only [List.all_cons, Bool.and_eq_true] at h3; exact h3.2
      · exact h3
    have hx : 0 ≤ c * «оценкаМонома» v k := by
      by_cases hc : c = 0
      · subst hc; simp
      · have hk : k ≠ "" := by
          have := h1.1
          simp [hc] at this
          exact this
        have hone : c = 1 := by
          simp only [List.filter_cons] at h3
          simp [hk, hc] at h3
          exact h3.1
        subst hone
        simp [«оценкаМонома», hk, hv k]
    simp only [«значениеФормы»]
    omega

/-- Форма одного листа не меньше нуля, когда мономы не меньше нуля. -/
theorem «одинЛист-неотрицателен» (v : String → Int) (hv : ∀ m, 0 ≤ v m) (f : «ЛФ»)
    (h : «одинЛист» f = true) : 0 ≤ «значениеФормы» v f := by
  unfold «одинЛист» at h
  simp only [Bool.and_eq_true] at h
  exact «листья-неотрицательны» v hv f h.1.1 h.2

/-- Толкование правила над исходником `s`: миры — значения имён; у монома (листа либо
    произведения листьев) в мире целое значение, у формулы — истинность. Посылки — законы
    носителя и чтения текста. Законы чтения говорят только о носителях «точное целое» и
    «неотрицательное» (режимы `exact` и `nat`) и только о сравнениях, которые сверщик
    допустил к правилу: над «неотрицательное» — без выхода за 2⁵³ и без спора о знаке нуля,
    над «точное целое» — с доказанным каждым вычитанием. -/
structure «ТолкованиеЛинейной» (s : «Исх») where
  «Мир» : Type
  «моном» : «Мир» → String → Int
  «верно» : «Мир» → String → Prop
  «моном-неотрицателен» : ∀ w m, 0 ≤ «моном» w m
  «сравнение-верно» : ∀ w (k : «ЛК») t op l r f sub, k.«исх» = s → (k.«режим» = "exact" ∨ k.«режим» = "nat") →
    «лаСравнение» k t false = some (op, l, r, f, sub) →
    (k.«режим» = "nat" → «лаОтказНосителя» k op l r t = none) →
    (k.«режим» ≠ "nat" → «лаВычитаниеУВызова» t l r = false) →
    (∀ g ∈ sub, 0 ≤ «значениеФормы» («моном» w) g) →
    (op ≠ "eq" → 0 ≤ «значениеФормы» («моном» w) f) →
    (op = "eq" → «значениеФормы» («моном» w) f = 0) → «верно» w t
  «допущение-читается» : ∀ w (k : «ЛК») d o op l r g sub, k.«исх» = s → (k.«режим» = "exact" ∨ k.«режим» = "nat") →
    «верно» w d → «лаСравнение» k d o = some (op, l, r, g, sub) → «допущениеГодно» k l r = true →
    0 ≤ «значениеФормы» («моном» w) g
  «потолок-листа» : ∀ w (k : «ЛК») t a sub, k.«исх» = s → k.«режим» = "nat" → «лаЛист» k («ужатьТ» t) = true →
    «лаФорма» k t = some (a, sub) → «одинЛист» a = true → «значениеФормы» («моном» w) a ≤ «лаПотолок»
  «раскрытие-цели» : ∀ w g, «верно» w («т» («лаРаскрыть» s g 0)) → «верно» w g
  «раскрытие-допущения» : ∀ w d, «верно» w d → «верно» w («т» («лаРаскрыть» s d 0))
  «тело-результата» : ∀ w f g, «верно» w («цельСТелом» s f g) → «верно» w g
  «конъюнкт-верен» : ∀ w t c, «верно» w t → c ∈ «лаКонъюнкты» t → «верно» w c
  «единица-читается» : ∀ w (k : «ЛК») z op l r f sub, k.«исх» = s → (k.«режим» = "exact" ∨ k.«режим» = "nat") →
    «лаСравнение» k («лаЕдиница» z) false = some (op, l, r, f, sub) →
    (k.«режим» = "exact" ∨ «стороныТочны» k z true = true) →
    0 ≤ «значениеФормы» («моном» w) f → «верно» w («лаЕдиница» z)
  «произведение-положительно» : ∀ w (k : «ЛК») g p, k.«исх» = s → (k.«режим» = "exact" ∨ k.«режим» = "nat") →
    («сверху» p "умножить на").length = 2 → «т» («лаСторонаНадНулём» g) = «т» p →
    «стороныТочны» k («ужатьТ» ((«сверху» p "умножить на").headD "")) true = true →
    «верно» w («лаЕдиница» («ужатьТ» ((«сверху» p "умножить на").headD ""))) →
    («верно» w («лаЕдиница» («ужатьТ» ((«сверху» p "умножить на").getD 1 ""))) ∨
      ∃ d, «верно» w d ∧ «лаКтоПоложителен» («т» d) = «т» («ужатьТ» ((«сверху» p "умножить на").getD 1 ""))) →
    «верно» w g

/-- Сохраняемое прогоном ходов: каждая доказанная цель не меньше нуля, и пока цель
    открыта, из её отрицания следует, что сумма ходов не меньше нуля. -/
def «лаВерно» (z : «ЛФ» → Int) (c : «ЛаСост») : Prop :=
  (∀ f ∈ c.«доказанные», 0 ≤ z f) ∧ (c.«вБлоке» = true → z c.«целиФ» < 0 → 0 ≤ z c.«сумма»)

theorem «лаМножитель-неотрицателен» (x : String) (m : Int) (h : «лаМножитель» x = .ok m) : 0 ≤ m := by
  unfold «лаМножитель» at h
  split at h
  · dsimp only at h
    split at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h
    · simp only [pure, Except.pure, Except.ok.injEq] at h
      subst h
      exact Int.natCast_nonneg _
  · simp only [pure, Except.pure, Except.ok.injEq] at h
    omega

/-- Форма хода, кроме отрицания цели, не меньше нуля: допущение — потому что верно и
    читается, граница — потому что лист носителя лежит в своём отрезке. -/
theorem «форма-хода-неотрицательна» {s : «Исх»} (I : «ТолкованиеЛинейной» s) (w : I.«Мир») (k : «ЛК»)
    (hs : k.«исх» = s) (hm : k.«режим» = "exact" ∨ k.«режим» = "nat") («допущения» : List String)
    (hd : ∀ d ∈ «допущения», I.«верно» w d) (g0 : «ЛФ») (x kind text : String) (f : «ЛФ»)
    (hk : kind ≠ "отрицание") (h : «лаФормаХода» k «допущения» g0 x kind text = .ok f) :
    0 ≤ «значениеФормы» (I.«моном» w) f := by
  unfold «лаФормаХода» at h
  simp only [hk, ↓reduceIte] at h
  split at h
  · split at h
    · rename_i a l r g b hcmp
      split at h
      · rename_i hgood
        simp only [pure, Except.pure, Except.ok.injEq] at h
        subst h
        simp only [Bool.and_eq_true] at hgood
        obtain ⟨_, hhas⟩ := hgood
        unfold «естьДопущение» at hhas
        simp only [List.any_eq_true] at hhas
        obtain ⟨d, hdm, o, _, hmatch⟩ := hhas
        split at hmatch
        · rename_i a' l' r' g' b' hcmp'
          simp only [Bool.and_eq_true] at hmatch
          have e := «лфРавны-значение» (I.«моном» w) _ _ hmatch.2
          have p := I.«допущение-читается» w k d o a' l' r' g' b' hs hm (hd d hdm) hcmp' hmatch.1
          omega
        · simp at hmatch
      · simp [throw, throwThe, MonadExceptOf.throw] at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h
  · split at h
    · unfold «лаГраница» at h
      split at h
      · rename_i a b hform
        dsimp only at h
        split at h
        · simp [throw, throwThe, MonadExceptOf.throw] at h
        · rename_i hcond
          have hone : «одинЛист» a = true := by
            cases ho : «одинЛист» a <;> simp [ho] at hcond ⊢
          split at h
          · simp only [pure, Except.pure, Except.ok.injEq] at h
            subst h
            exact «одинЛист-неотрицателен» _ (I.«моном-неотрицателен» w) a hone
          · rename_i hkinds _ hbottom
            simp only [pure, Except.pure, Except.ok.injEq] at h
            subst h
            rw [«лфСумма-значение», «лфЧисло-значение»]
            have hceil : kind = "потолок" := by
              simp only [Bool.or_eq_true, decide_eq_true_eq] at hkinds
              rcases hkinds with h1 | h1
              · exact absurd h1 hbottom
              · exact h1
            subst hceil
            have hc2 : k.«режим» = "nat" ∧ «лаЛист» k («ужатьТ» text) = true := by
              cases hl : «лаЛист» k («ужатьТ» text) <;> by_cases hn : k.«режим» = "nat" <;>
                simp [hone, hl, hn] at hcond ⊢
            have p := I.«потолок-листа» w k text a b hs hc2.1 hc2.2 hform hone
            omega
      · simp [throw, throwThe, MonadExceptOf.throw] at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h

theorem «лаОткрыть-верно» (z : «ЛФ» → Int) (hz : ∀ c, z («лфЧисло» c) = c) (k : «ЛК») (c c' : «ЛаСост») (text : String)
    (h : «лаОткрыть» k c text = .ok c') (hi : «лаВерно» z c) : «лаВерно» z c' := by
  unfold «лаОткрыть» at h
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  · split at h
    · split at h
      · simp [throw, throwThe, MonadExceptOf.throw] at h
      · simp only [pure, Except.pure, Except.ok.injEq] at h
        subst h
        refine ⟨hi.1, ?_⟩
        intro _ _
        simp [hz]
    · simp [throw, throwThe, MonadExceptOf.throw] at h

theorem «лаЗакрыть-верно» (v : String → Int) (c c' : «ЛаСост») (hb : c.«вБлоке» = true)
    (h : «лаЗакрыть» c = .ok c') (hi : «лаВерно» («значениеФормы» v) c) : «лаВерно» («значениеФормы» v) c' := by
  unfold «лаЗакрыть» at h
  split at h
  · rename_i q hq
    split at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h
    · rename_i hneg
      simp only [pure, Except.pure, Except.ok.injEq] at h
      subst h
      refine ⟨?_, by simp⟩
      intro f hf
      simp only [List.mem_append, List.mem_singleton] at hf
      rcases hf with hf | hf
      · exact hi.1 f hf
      · subst hf
        have e := «лфКонстанта-значение» v _ _ hq
        have p := hi.2 hb
        omega
  · simp [throw, throwThe, MonadExceptOf.throw] at h

/-- Один ход сохраняет верность прогона, когда каждая форма хода, кроме отрицания цели, не
    меньше нуля. -/
theorem «лаШаг-верен» (v : String → Int) (k : «ЛК») («допущения» : List String)
    (hf : ∀ g0 x kind text f, kind ≠ "отрицание" → «лаФормаХода» k «допущения» g0 x kind text = .ok f →
      0 ≤ «значениеФормы» v f)
    (c c' : «ЛаСост») (x : String) (h : «лаШаг» k «допущения» c x = .ok c')
    (hi : «лаВерно» («значениеФормы» v) c) : «лаВерно» («значениеФормы» v) c' := by
  unfold «лаШаг» at h
  split at h
  · simp only [pure, Except.pure, Except.ok.injEq] at h
    subst h; exact hi
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i m hmul
  have hm := «лаМножитель-неотрицателен» x m hmul
  dsimp only at h
  have hi1 : «лаВерно» («значениеФормы» v) { c with «номер» := c.«номер» + 1 } := hi
  split at h
  · simp only [pure, Except.pure, Except.ok.injEq] at h
    subst h; exact hi1
  split at h
  · split at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h
    · simp only [pure, Except.pure, Except.ok.injEq] at h
      subst h; exact hi1
  split at h
  · exact «лаОткрыть-верно» _ («лфЧисло-значение» v) k _ c' _ h hi1
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i hopen
  have hb : c.«вБлоке» = true := by simpa using hopen
  unfold «лаВнутри» at h
  split at h
  · refine «лаЗакрыть-верно» v _ c' ?_ h hi1
    exact hb
  rename_i hkind
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i f hform
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  simp only [pure, Except.pure, Except.ok.injEq] at h
  subst h
  refine ⟨hi1.1, ?_⟩
  intro _ hneg
  dsimp only at hneg ⊢
  rw [«лфСумма-значение»]
  have hsum : 0 ≤ «значениеФормы» v c.«сумма» := hi1.2 hb hneg
  show 0 ≤ «значениеФормы» v c.«сумма» + m * «значениеФормы» v f
  have hfn : 0 ≤ «значениеФормы» v f := by
    by_cases hk : «слово» x 3 = "отрицание"
    · unfold «лаФормаХода» at hform
      simp only [hk, ↓reduceIte, pure, Except.pure, Except.ok.injEq] at hform
      subst hform
      rw [«лфСумма-значение», «лфЧисло-значение»]
      omega
    · exact hf _ _ _ _ _ hk hform
  have := Int.mul_nonneg hm hfn
  omega

theorem «лаХоды-верны» (v : String → Int) (k : «ЛК») («допущения» : List String)
    (hf : ∀ g0 x kind text f, kind ≠ "отрицание" → «лаФормаХода» k «допущения» g0 x kind text = .ok f →
      0 ≤ «значениеФормы» v f) :
    ∀ (xs : List String) (c c' : «ЛаСост»), xs.foldlM («лаШаг» k «допущения») c = .ok c' →
      «лаВерно» («значениеФормы» v) c → «лаВерно» («значениеФормы» v) c' := by
  intro xs
  induction xs with
  | nil =>
    intro c c' h hi
    simp only [List.foldlM_nil, pure, Except.pure, Except.ok.injEq] at h
    subst h; exact hi
  | cons x r ih =>
    intro c c' h hi
    rw [List.foldlM_cons] at h
    cases hstep : «лаШаг» k «допущения» c x with
    | error e => rw [hstep] at h; cases h
    | ok c1 =>
      rw [hstep] at h
      exact ih c1 c' h («лаШаг-верен» v k «допущения» hf c c1 x hstep hi)

/-- **Сертификат Фаркаша состоятелен.** Каждая цель, которую прогон ходов счёл доказанной,
    не меньше нуля при значениях мономов, при которых не меньше нуля каждая форма
    допущения и границы. -/
theorem «лаБлоки-верны» (v : String → Int) (k : «ЛК») («свои» «допущения» : List String)
    (hf : ∀ g0 x kind text f, kind ≠ "отрицание" → «лаФормаХода» k «допущения» g0 x kind text = .ok f →
      0 ≤ «значениеФормы» v f)
    (proved : List «ЛФ») (pos : List String) (h : «лаБлоки» k «свои» «допущения» = .ok (proved, pos)) :
    ∀ f ∈ proved, 0 ≤ «значениеФормы» v f := by
  unfold «лаБлоки» at h
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  · rename_i c hfold
    split at h
    · simp [throw, throwThe, MonadExceptOf.throw] at h
    · simp only [pure, Except.pure, Except.ok.injEq, Prod.mk.injEq] at h
      have hi := «лаХоды-верны» v k «допущения» hf _ {} c hfold ⟨by simp, by simp⟩
      rw [← h.1]
      exact hi.1

theorem «режимЦели-носитель» (k0 : «ЛК») (g : String) (h : «режимЦели» k0 g ≠ "") :
    «режимЦели» k0 g = "exact" ∨ «режимЦели» k0 g = "nat" := by
  unfold «режимЦели» at h ⊢
  split
  · exact Or.inl rfl
  · split
    · exact Or.inr rfl
    · rename_i h1 h2
      simp [h1, h2] at h

theorem «допущения-верны» {s : «Исх»} (I : «ТолкованиеЛинейной» s) (w : I.«Мир») (f place : String)
    (hp : ∀ p ∈ «лаПосылки» s f place, I.«верно» w p) : ∀ d ∈ «лаДопущения» s f place, I.«верно» w d := by
  intro d hd
  unfold «лаДопущения» at hd
  simp only [List.mem_flatMap] at hd
  obtain ⟨p, hpm, c, hcm, hdc⟩ := hd
  have hc := I.«конъюнкт-верен» w p c (hp p hpm) hcm
  simp only [List.mem_cons, List.not_mem_nil, or_false] at hdc
  rcases hdc with e | e
  · subst e; exact hc
  · rw [e]; exact I.«раскрытие-допущения» w c hc

/-- **Место, принятое сертификатом, верно.** Если `«лаСертификат»` принял цель над
    исходником `s`, то она верна в каждом мире, где верны допущения. -/
theorem «лаСертификат-состоятелен» {s : «Исх»} (I : «ТолкованиеЛинейной» s) (k0 : «ЛК») (hs : k0.«исх» = s)
    («свои» «допущения» : List String) (g e : String)
    (h : «лаСертификат» k0 «свои» «допущения» g = .ok (true, e)) :
    ∀ w, (∀ d ∈ «допущения», I.«верно» w d) → I.«верно» w g := by
  intro w hd
  unfold «лаСертификат» at h
  dsimp only at h
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  split at h
  · simp [pure, Except.pure] at h
  rename_i _ hmode
  have hm := «режимЦели-носитель» k0 g hmode
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  split at h
  · simp [pure, Except.pure] at h
  rename_i op l r f sub hcmp
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i hcarrier
  split at h
  · simp [pure, Except.pure] at h
  rename_i hminus
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i proved pos hblocks
  split at h
  · simp [pure, Except.pure] at h
  rename_i hall
  have hall : («лаОбязательные» op f sub).all (fun o => proved.any («лфРавны» o)) = true := by simpa using hall
  have hk : ({ k0 with «режим» := «режимЦели» k0 g } : «ЛК»).«исх» = s := hs
  have hproved := «лаБлоки-верны» (I.«моном» w) _ «свои» «допущения»
    (fun g0 x kind text f hkind hform =>
      «форма-хода-неотрицательна» I w _ hk hm «допущения» hd g0 x kind text f hkind hform)
    proved pos hblocks
  have hob : ∀ o ∈ «лаОбязательные» op f sub, 0 ≤ «значениеФормы» (I.«моном» w) o := by
    intro o ho
    have := List.all_eq_true.mp hall o ho
    obtain ⟨p, hpm, hpe⟩ := List.any_eq_true.mp this
    have e1 := «лфРавны-значение» (I.«моном» w) _ _ hpe
    have := hproved p hpm
    omega
  apply I.«сравнение-верно» w _ g op l r f sub hk hm hcmp
  · intro hn
    have hn' : «режимЦели» k0 g = "nat" := hn
    simpa [hn'] using hcarrier
  · intro hn
    have hn' : «режимЦели» k0 g ≠ "nat" := hn
    simpa [hn'] using hminus
  · intro q hq
    exact hob q (by unfold «лаОбязательные»; simp [hq])
  · intro hne
    exact hob f (by unfold «лаОбязательные»; simp [hne])
  · intro heq
    have h1 := hob f (by unfold «лаОбязательные»; simp [heq])
    have h2 := hob («лфСумма» («лфЧисло» 0) f (-1)) (by unfold «лаОбязательные»; simp [heq])
    rw [«лфСумма-значение», «лфЧисло-значение»] at h2
    omega

theorem «лаНужно-верно» {s : «Исх»} (I : «ТолкованиеЛинейной» s) (w : I.«Мир») (k : «ЛК») (hs : k.«исх» = s)
    (hm : k.«режим» = "exact" ∨ k.«режим» = "nat") (proved : List «ЛФ»)
    (hp : ∀ f ∈ proved, 0 ≤ «значениеФормы» (I.«моном» w) f) (z : String)
    (hx : k.«режим» = "exact" ∨ «стороныТочны» k z true = true)
    (h : «лаНужно» k proved z = true) : I.«верно» w («лаЕдиница» z) := by
  unfold «лаНужно» at h
  split at h
  · rename_i op l r f sub hcmp
    obtain ⟨q, hq, he⟩ := List.any_eq_true.mp h
    have e1 := «лфРавны-значение» (I.«моном» w) _ _ he
    have := hp q hq
    exact I.«единица-читается» w k z op l r f sub hs hm hcmp hx (by omega)
  · simp at h

/-- **Место, принятое приёмом «строгий порядок произведения», верно.** -/
theorem «лаПроизведение-состоятельно» {s : «Исх»} (I : «ТолкованиеЛинейной» s) (k0 : «ЛК») (hs : k0.«исх» = s)
    («свои» «допущения» : List String) (g e : String)
    (h : «лаПроизведение» k0 «свои» «допущения» g = .ok (true, e)) :
    ∀ w, (∀ d ∈ «допущения», I.«верно» w d) → I.«верно» w g := by
  intro w hd
  unfold «лаПроизведение» at h
  dsimp only at h
  generalize hp : «ужатьТ» («уголок» ((«свои».find? (·.startsWith "ход 2 произведение ⟨")).getD "") 1) = p at h
  split at h
  · simp [pure, Except.pure] at h
  rename_i hshape
  simp only [Bool.or_eq_true, decide_eq_true_eq, not_or, Decidable.not_not, ne_eq] at hshape
  split at h
  · simp [pure, Except.pure] at h
  rename_i hmode
  have hm := «режимЦели-носитель» k0 _ hmode
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i hexact
  split at h
  · simp [throw, throwThe, MonadExceptOf.throw] at h
  rename_i proved pos hblocks
  split at h
  · simp [pure, Except.pure] at h
  rename_i hneed
  split at h
  · rename_i hsecond
    let k : «ЛК» := { k0 with «режим» := «режимЦели» k0 («лаЕдиница» («ужатьТ» ((«сверху» p "умножить на").headD ""))) }
    have hk : k.«исх» = s := hs
    have hmk : k.«режим» = "exact" ∨ k.«режим» = "nat" := hm
    have hproved := «лаБлоки-верны» (I.«моном» w) k «свои» «допущения»
      (fun g0 x kind text f hkind hform =>
        «форма-хода-неотрицательна» I w k hk hmk «допущения» hd g0 x kind text f hkind hform)
      proved pos hblocks
    have hxe : «стороныТочны» k («ужатьТ» ((«сверху» p "умножить на").headD "")) true = true := by
      simpa [k] using hexact
    have hx := «лаНужно-верно» I w k hk hmk proved hproved _ (Or.inr hxe) (by simpa [k] using hneed)
    apply I.«произведение-положительно» w k g p hk hmk hshape.1 hshape.2 hxe hx
    simp only [Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq] at hsecond
    rcases hsecond with hfact | ⟨hy, hneedy⟩
    · right
      unfold «лаПоФакту» at hfact
      obtain ⟨t, _, ht⟩ := List.any_eq_true.mp hfact
      simp only [Bool.and_eq_true, decide_eq_true_eq] at ht
      obtain ⟨d, hdm, hdt⟩ := List.any_eq_true.mp ht.2
      simp only [decide_eq_true_eq] at hdt
      exact ⟨d, hd d hdm, by rw [hdt]; exact ht.1⟩
    · left
      exact «лаНужно-верно» I w k hk hmk proved hproved _ hy hneedy
  · simp [pure, Except.pure] at h

/-- **Путь «линейная арифметика» состоятелен.** Если `«линейнаяАрифметика»` приняла место —
    сертификатом Фаркаша либо приёмом «строгий порядок произведения», — то его цель верна
    в каждом мире толкования, где верны посылки места: требования функции либо
    ограничения «таких что» утверждения. -/
theorem «линейная-арифметика-состоятельна» {s : «Исх»} (I : «ТолкованиеЛинейной» s)
    («свои» : List String) (f place g0 e : String)
    (h : «линейнаяАрифметика» s «свои» f place g0 = .ok (true, e)) :
    ∀ w, (∀ p ∈ «лаПосылки» s f place, I.«верно» w p) → I.«верно» w g0 := by
  intro w hp
  unfold «линейнаяАрифметика» at h
  dsimp only at h
  apply I.«тело-результата» w f
  apply I.«раскрытие-цели»
  split at h
  · exact «лаПроизведение-состоятельно» I _ rfl «свои» _ _ e h w («допущения-верны» I w f place hp)
  · exact «лаСертификат-состоятелен» I _ rfl «свои» _ _ e h w («допущения-верны» I w f place hp)

end «Второй»
