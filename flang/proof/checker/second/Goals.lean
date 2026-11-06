import Moves

open «Разбор»

namespace «Второй»

/-!
# Модель ходов теоремы (ADR-0202)

Ход переписывает список целей прогона (`«Прогон»`). Ход состоятелен, если из верности
новых целей следует верность прежних: тогда прогон, дошедший до пустого списка целей,
доказал начальную цель.

Верность цели задаёт толкование (`«Толкование»`): что значит, что формула-текст верна,
что два терма равны при текущих значениях имён и что они равны при любых значениях. Его
поля — законы языка, на которых стоит каждый ход: подстановка равного, законы связок,
перестановка соседей, выбор по литералу, счёт замкнутого терма. Законы — посылки теорем,
а не аксиомы: теорема о ходе говорит «при этих законах языка ход не принимает ложного».
Чтение текста как терма — тоже посылка (`«подстановка-тождества»`,
`«подстановка-равенства»`): что `«вместо»` на тексте цели есть подстановка в терме,
сверено на корпусе, как и чтение формул (`RecordReader.lean`), а не доказано.
-/

structure «Толкование» where
  «истинно» : String → Prop
  «метка» : String → Prop
  «здесь» : String → String → Prop
  «тожд» : String → String → Prop
  «т-верно» : ∀ g, «истинно» («т» g) → «истинно» g
  «здесь-симм» : ∀ a b, «здесь» a b → «здесь» b a
  «метка-пуста» : «метка» ""
  «метка-плюс» : ∀ c0 c, «метка» (if c0 = "" then "+" ++ c else c0 ++ "\n" ++ "+" ++ c) ↔ («метка» c0 ∧ «здесь» c "да")
  «метка-минус» : ∀ c0 c, «метка» (if c0 = "" then "-" ++ c else c0 ++ "\n" ++ "-" ++ c) ↔ («метка» c0 ∧ «здесь» c "нет")
  «равно-здесь» : ∀ t, («разрез» t "равно").«есть» = true → «истинно» t →
    «здесь» («разрез» t "равно").«лево» («разрез» t "равно").«право»
  «подстановка-тождества» : ∀ g a b, «тожд» a b → «истинно» («вместо» g a b) → «истинно» g
  «подстановка-равенства» : ∀ g a b, «подСвязывателем» g = false → «здесь» a b →
    «истинно» («вместо» g a b) → «истинно» g
  «условие-признак» : ∀ g c, «подСвязывателем» g = false →
    ((g.splitOn s!"если {c} то ").length > 1 ∨ (g.splitOn s!"если ( {c} ) то ").length > 1) →
    «здесь» c "да" ∨ «здесь» c "нет"
  «соседи-тождество» : ∀ t op, (op = "плюс" ∨ op = "умножить на") → («сверху» t op).length = 2 →
    «тожд» t s!"{(«разрез» t op).«право»} {op} {(«разрез» t op).«лево»}"
  «выбор-да» : ∀ t, («разрез» t "то").«есть» = true → («разрез» («разрез» t "то").«право» "иначе").«есть» = true →
    («разрез» t "то").«лево».startsWith "если " = true → «словаС» («разрез» t "то").«лево» 1 = "да" →
    «тожд» t («разрез» («разрез» t "то").«право» "иначе").«лево»
  «выбор-нет» : ∀ t, («разрез» t "то").«есть» = true → («разрез» («разрез» t "то").«право» "иначе").«есть» = true →
    («разрез» t "то").«лево».startsWith "если " = true → «словаС» («разрез» t "то").«лево» 1 = "нет" →
    «тожд» t («разрез» («разрез» t "то").«право» "иначе").«право»
  «счёт-тождество» : ∀ a b, «значение» s!"( {a} ) равен ( {b} )" 64 = some (.«п» true) → «тожд» a b
  «и-притом» : ∀ t, («разрез» t "и притом").«есть» = true → («сверху» («ужатьТ» t) "и притом").length = 2 →
    «истинно» («т» («разрез» t "и притом").«лево») → «истинно» («т» («разрез» t "и притом").«право») → «истинно» t
  «или-лево» : ∀ t, («разрез» t "или").«есть» = true → («сверху» («ужатьТ» t) "или").length = 2 →
    «истинно» («т» («разрез» t "или").«лево») → «истинно» t
  «или-право» : ∀ t, («разрез» t "или").«есть» = true → («сверху» («ужатьТ» t) "или").length = 2 →
    «истинно» («т» («разрез» t "или").«право») → «истинно» t

/-- Цель номер `i` верна: при её условиях верна её формула. -/
def «Толкование».«цельВерна» (I : «Толкование») (p : «Прогон») (i : Nat) : Prop :=
  I.«метка» (p.«условияЦели» i) → I.«истинно» (p.«цели».getD i "")

/-- Прогон верен: при верных допущениях верна каждая цель. -/
def «Толкование».«верен» (I : «Толкование») (p : «Прогон») : Prop :=
  (∀ d ∈ p.«дано», I.«истинно» d) → ∀ i < p.«цели».length, I.«цельВерна» p i

theorem «getD-append-лево» (a b : List String) (i : Nat) (h : i < a.length) :
    (a ++ b).getD i "" = a.getD i "" := by
  simp [List.getD_eq_getElem?_getD, List.getElem?_append_left h]

theorem «getD-append-право» (a b : List String) (n j : Nat) (h : a.length = n) :
    (a ++ b).getD (n + j) "" = b.getD j "" := by
  subst h
  simp [List.getD_eq_getElem?_getD, List.getElem?_append_right]

theorem «getD-map-range» (f : Nat → String) (n j : Nat) (h : j < n) :
    ((List.range n).map f).getD j "" = f j := by
  simp [List.getD_eq_getElem?_getD, List.getElem?_map, List.getElem?_range h]

/-- **Замена первой цели.** Если из условий первой цели и верности новых целей при их
    условиях следует первая цель, то верность прогона после замены даёт верность прежнего. -/
theorem «заменитьСУсловиями-верен» (I : «Толкование») (p : «Прогон») («новые» «их» : List String)
    (hne : p.«цели» ≠ [])
    (hstep : (∀ d ∈ p.«дано», I.«истинно» d) → I.«метка» (p.«условияЦели» 0) →
      (∀ i < «новые».length, I.«метка» («их».getD i "") → I.«истинно» («новые».getD i "")) →
      I.«истинно» p.«первая») :
    I.«верен» (p.«заменитьСУсловиями» «новые» «их») → I.«верен» p := by
  intro hv hd i hi
  have hv' := hv hd
  obtain ⟨g, gs, hg⟩ : ∃ g gs, p.«цели» = g :: gs := by
    cases h : p.«цели» with
    | nil => exact absurd h hne
    | cons g gs => exact ⟨g, gs, rfl⟩
  simp only [«Прогон».«заменитьСУсловиями», hg, List.drop_succ_cons, List.drop_zero,
    List.length_cons, Nat.add_sub_cancel, «Толкование».«цельВерна», «Прогон».«условияЦели»,
    List.length_append] at hv'
  have hl : ((List.range «новые».length).map (fun i => «их».getD i "")).length = «новые».length := by simp
  cases i with
  | zero =>
    intro hm
    have hf : I.«истинно» p.«первая» := by
      apply hstep hd hm
      intro j hj hmj
      have h1 := hv' j (by omega)
      rw [«getD-append-лево» _ _ j hj, «getD-append-лево» _ _ j (by rw [hl]; exact hj),
        «getD-map-range» _ _ _ hj] at h1
      exact h1 hmj
    simpa [«Толкование».«цельВерна», «Прогон».«первая», hg] using hf
  | succ k =>
    intro hm
    have hk : k < gs.length := by rw [hg] at hi; simp at hi; omega
    have h1 := hv' («новые».length + k) (by omega)
    rw [«getD-append-право» _ _ _ _ rfl, «getD-append-право» _ _ _ _ hl,
      «getD-map-range» _ _ _ hk] at h1
    simp only [«Прогон».«условияЦели», hg, List.getD_cons_succ] at hm ⊢
    exact h1 hm

/-- Ход, после которого прогон не оборван, стоял в идущем прогоне на своём месте и при
    непустом списке целей. -/
theorem «шаг-допущен» (p : «Прогон») (l : String) (o : «Обст»)
    (hok : («ходШага» p l o).«оборван» = false) :
    p.«идёт» = true ∧ ((«слово» l 2).toNat?.getD 0) = p.«ходов» + 1 ∧ p.«цели» ≠ [] := by
  unfold «ходШага» at hok
  by_cases h1 : p.«идёт» = true
  · by_cases h2 : ((«слово» l 2).toNat?.getD 0) = p.«ходов» + 1
    · by_cases h3 : p.«цели» = []
      · simp [h1, h2, h3, «Прогон».«беда»] at hok
      · exact ⟨h1, h2, h3⟩
    · simp [h1, h2, «Прогон».«беда»] at hok
  · by_cases h4 : p.«оборван» = true
    · simp [h1, h4] at hok
    · simp [h1, h4, «Прогон».«беда»] at hok

/-- Одна новая цель вместо первой: достаточно, чтобы из неё следовала первая. -/
theorem «одна-верна» (I : «Толкование») (p : «Прогон») (c : String) (hne : p.«цели» ≠ [])
    (hstep : (∀ d ∈ p.«дано», I.«истинно» d) → I.«истинно» c → I.«истинно» p.«первая») :
    I.«верен» (p.«одна» c) → I.«верен» p := by
  apply «заменитьСУсловиями-верен» I p [c] _ hne
  intro hd hm h
  exact hstep hd (by simpa using h 0 (by simp) (by simpa using hm))

/-- **Ход «соседи» состоятелен.** Перестановка двух соседей суммы либо произведения —
    тождество языка (`«соседи-тождество»`), и подстановка тождества сохраняет цель. -/
theorem «ход-соседи-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "соседи") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходСоседей» p l := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходСоседей» p l = q at hok hv
  unfold «ходСоседей» at hq
  dsimp only at hq
  generalize ht : «т» («уголок» l 1) = t at hq
  have key : ∀ op, (op = "плюс" ∨ op = "умножить на") → («сверху» t op).length = 2 →
      q = p.«одна» («т» («вместо» p.«первая» t s!"{(«разрез» t op).«право»} {op} {(«разрез» t op).«лево»}")) →
      I.«верен» p := by
    intro op hop hl hq'
    subst hq'
    apply «одна-верна» I p _ h3 _ hv
    intro _ h
    exact I.«подстановка-тождества» _ t _ (I.«соседи-тождество» t op hop hl) (I.«т-верно» _ h)
  by_cases hp : («сверху» t "плюс").length = 2
  · simp only [hp, ↓reduceIte, show ¬ ("плюс" : String) = "" by decide] at hq
    split at hq
    · subst hq; simp [«Прогон».«беда»] at hok
    · exact key "плюс" (Or.inl rfl) hp hq.symm
  · by_cases hm : («сверху» t "умножить на").length = 2
    · simp only [hp, hm, ↓reduceIte, show ¬ ("умножить на" : String) = "" by decide] at hq
      split at hq
      · subst hq; simp [«Прогон».«беда»] at hok
      · exact key "умножить на" (Or.inr rfl) hm hq.symm
    · simp only [hp, hm, ↓reduceIte] at hq
      subst hq; simp [«Прогон».«беда»] at hok

theorem «отказ-оборван» (p : «Прогон») (t : String) : (p.«отказ» t).«оборван» = true := rfl
theorem «беда-оборвана» (p : «Прогон») (t : String) : (p.«беда» t).«оборван» = true := rfl

/-- **Ход «замена» состоятелен.** Допущение-равенство верно при текущих значениях имён
    (`«равно-здесь»`); вне связывателя подстановка равного сохраняет цель
    (`«подстановка-равенства»`). Под связывателем ход не берётся. -/
theorem «ход-замена-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "замена") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходЗамены» p l := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходЗамены» p l = q at hok hv
  unfold «ходЗамены» at hq
  dsimp only at hq
  generalize hn : «номерПосле» l "по дано " = n at hq
  generalize hr : «разрез» (p.«дано».getD (n - 1) "") "равно" = r at hq
  by_cases hb : (n = 0 || n > p.«дано».length || !r.«есть») = true
  · simp only [hb, ↓reduceIte] at hq; subst hq; simp [«беда-оборвана»] at hok
  simp only [hb, Bool.false_eq_true, ↓reduceIte] at hq
  simp only [Bool.or_eq_true, decide_eq_true_eq, Bool.not_eq_true', not_or, Bool.not_eq_false] at hb
  obtain ⟨⟨hn0, hnl⟩, hre⟩ := hb
  have hlt : n - 1 < p.«дано».length := by omega
  have hmem : p.«дано».getD (n - 1) "" ∈ p.«дано» := by
    rw [List.getD_eq_getElem?_getD, List.getElem?_eq_getElem hlt]
    exact List.getElem_mem _
  have hlr : (∀ d ∈ p.«дано», I.«истинно» d) → I.«здесь» r.«лево» r.«право» := by
    intro hd
    have h := I.«равно-здесь» _ (by rw [hr]; exact hre) (hd _ hmem)
    rwa [hr] at h
  have key : ∀ a b, ((∀ d ∈ p.«дано», I.«истинно» d) → I.«здесь» a b) →
      q = p.«одна» («т» («вместо» p.«первая» a b)) → «подСвязывателем» p.«первая» = false →
      I.«верен» p := by
    intro a b hab hq' hfree
    subst hq'
    apply «одна-верна» I p _ h3 _ hv
    intro hd h
    exact I.«подстановка-равенства» _ a b hfree (hab hd) (I.«т-верно» _ h)
  by_cases ho : (l.splitOn " обратно").length > 1
  · simp only [ho, ↓reduceIte] at hq
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    split at hq
    · subst hq; simp [«отказ-оборван»] at hok
    rename_i hf
    exact key _ _ (fun hd => I.«здесь-симм» _ _ (hlr hd)) hq.symm (by simpa using hf)
  · simp only [ho, ↓reduceIte] at hq
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    split at hq
    · subst hq; simp [«отказ-оборван»] at hok
    rename_i hf
    exact key _ _ hlr hq.symm (by simpa using hf)

/-- **Ход «выбор» состоятелен.** `если да то А иначе Б` есть `А`, `если нет …` — `Б`:
    тождества языка (`«выбор-да»`, `«выбор-нет»`). -/
theorem «ход-выбор-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "выбор") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходВыбора» p l := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходВыбора» p l = q at hok hv
  unfold «ходВыбора» at hq
  dsimp only at hq
  generalize ht : «т» («уголок» l 1) = t at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hA
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hB
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  subst hq
  have hA' : (((«разрез» t "то").«есть» = true ∧ («разрез» («разрез» t "то").«право» "иначе").«есть» = true) ∧
      («разрез» t "то").«лево».startsWith "если " = true) := by simpa using hA
  obtain ⟨⟨hA1, hA2⟩, hA3⟩ := hA'
  apply «одна-верна» I p _ h3 _ hv
  intro _ h
  have h' := I.«т-верно» _ h
  by_cases hy : «словаС» («разрез» t "то").«лево» 1 = "да"
  · simp only [hy, ↓reduceIte] at h'
    exact I.«подстановка-тождества» _ t _ (I.«выбор-да» t hA1 hA2 hA3 hy) h'
  · have hn : «словаС» («разрез» t "то").«лево» 1 = "нет" := by
      have hB' : ¬«словаС» («разрез» t "то").«лево» 1 = "да" → «словаС» («разрез» t "то").«лево» 1 = "нет" := by
        simpa using hB
      exact hB' hy
    simp only [hy, ↓reduceIte] at h'
    exact I.«подстановка-тождества» _ t _ (I.«выбор-нет» t hA1 hA2 hA3 hn) h'

/-- Цель деления: условие верно либо ложно, и подстановка его значения сохраняет цель. -/
theorem «деление-верно» (I : «Толкование») (g c : String) (hfree : «подСвязывателем» g = false)
    (hin : (g.splitOn s!"если {c} то ").length > 1 ∨ (g.splitOn s!"если ( {c} ) то ").length > 1)
    (hy : I.«здесь» c "да" → I.«истинно» («т» («вместо» g c "да")))
    (hn : I.«здесь» c "нет" → I.«истинно» («т» («вместо» g c "нет"))) : I.«истинно» g := by
  rcases I.«условие-признак» g c hfree hin with h | h
  · exact I.«подстановка-равенства» g c _ hfree h (I.«т-верно» _ (hy h))
  · exact I.«подстановка-равенства» g c _ hfree h (I.«т-верно» _ (hn h))

/-- **Ход «деление» состоятелен** в обеих формах: `деление ⟨У⟩` и `деление с условием ⟨У⟩`.
    Условие, стоящее в цели после `если`, — признак (`«условие-признак»`); вне связывателя
    его значение подставляется (`«подстановка-равенства»`). Под связывателем ход не берётся. -/
theorem «ход-деление-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "деление") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  by_cases hf : («слово» l 4).startsWith "⟨" = true
  · have e : «ходШага» p l o = «ходДеления» p l := by simp [«ходШага», h1, h2, h3, hw, hf]
    rw [e] at hok hv
    generalize hq : «ходДеления» p l = q at hok hv
    unfold «ходДеления» at hq
    dsimp only at hq
    generalize ht : «т» («уголок» l 1) = c at hq
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hA
    split at hq
    · subst hq; simp [«отказ-оборван»] at hok
    rename_i hB
    subst hq
    apply «заменитьСУсловиями-верен» I p _ _ h3 _ hv
    intro _ _ hall
    have hA' : (p.«первая».splitOn s!"если {c} то ").length ≤ 1 →
        1 < (p.«первая».splitOn s!"если ( {c} ) то ").length := by simpa using hA
    have hin : (p.«первая».splitOn s!"если {c} то ").length > 1 ∨
        (p.«первая».splitOn s!"если ( {c} ) то ").length > 1 := by
      rcases Nat.lt_or_ge 1 (p.«первая».splitOn s!"если {c} то ").length with hx | hx
      · exact Or.inl hx
      · exact Or.inr (hA' hx)
    apply «деление-верно» I _ c (by simpa using hB) hin
    · intro _; simpa using hall 0 (by simp) (by simpa using ‹I.«метка» (p.«условияЦели» 0)›)
    · intro _; simpa using hall 1 (by simp) (by simpa using ‹I.«метка» (p.«условияЦели» 0)›)
  · have e : «ходШага» p l o = «ходДеленияСУсловием» p l := by simp [«ходШага», h1, h2, h3, hw, hf]
    rw [e] at hok hv
    generalize hq : «ходДеленияСУсловием» p l = q at hok hv
    unfold «ходДеленияСУсловием» at hq
    dsimp only at hq
    generalize ht : «т» («уголок» l 1) = c at hq
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hA
    split at hq
    · subst hq; simp [«отказ-оборван»] at hok
    rename_i hB
    subst hq
    apply «заменитьСУсловиями-верен» I p _ _ h3 _ hv
    intro _ hm hall
    have hA' : (p.«первая».splitOn s!"если {c} то ").length ≤ 1 →
        1 < (p.«первая».splitOn s!"если ( {c} ) то ").length := by simpa using hA
    have hin : (p.«первая».splitOn s!"если {c} то ").length > 1 ∨
        (p.«первая».splitOn s!"если ( {c} ) то ").length > 1 := by
      rcases Nat.lt_or_ge 1 (p.«первая».splitOn s!"если {c} то ").length with hx | hx
      · exact Or.inl hx
      · exact Or.inr (hA' hx)
    apply «деление-верно» I _ c (by simpa using hB) hin
    · intro hy
      have := hall 0 (by simp)
      simp only [List.getD_cons_zero] at this
      exact this ((I.«метка-плюс» _ c).mpr ⟨hm, hy⟩)
    · intro hn
      have := hall 1 (by simp)
      simp only [List.getD_cons_succ, List.getD_cons_zero] at this
      exact this ((I.«метка-минус» _ c).mpr ⟨hm, hn⟩)

/-- **Ход «связка» состоятелен.** Цель `(Л) и притом (П)` следует из `Л` и `П`, цель
    `(Л) или (П)` — из названной половины (`«и-притом»`, `«или-лево»`, `«или-право»`). -/
theorem «ход-связка-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "связка") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходСвязки» p l := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходСвязки» p l = q at hok hv
  unfold «ходСвязки» at hq
  dsimp only at hq
  generalize hs : «обрезать» («уголок» l 1) = sv at hq
  generalize hk : «слово» («обрезать» («после» l "⟩")) 1 = k at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hA
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hB
  have hB' : («разрез» p.«первая» sv).«есть» = true ∧ («сверху» («ужатьТ» p.«первая») sv).length = 2 := by
    simpa using hB
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · rename_i hand
    subst hand
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    subst hq
    apply «заменитьСУсловиями-верен» I p _ _ h3 _ hv
    intro _ hm hall
    have ha := hall 0 (by simp) (by simpa using hm)
    have hb := hall 1 (by simp) (by simpa using hm)
    simp only [List.getD_cons_zero, List.getD_cons_succ] at ha hb
    exact I.«и-притом» _ hB'.1 hB'.2 ha hb
  · rename_i hand
    have hor : sv = "или" := by
      have : sv = "и притом" ∨ sv = "или" := by
        rcases Classical.em (sv = "и притом") with h | h
        · exact Or.inl h
        · exact Or.inr (by simpa [h] using hA)
      rcases this with h | h
      · exact absurd h hand
      · exact h
    subst hor
    split at hq
    · subst hq
      apply «одна-верна» I p _ h3 _ hv
      intro _ h
      exact I.«или-лево» _ hB'.1 hB'.2 h
    split at hq
    · subst hq
      apply «одна-верна» I p _ h3 _ hv
      intro _ h
      exact I.«или-право» _ hB'.1 hB'.2 h
    · subst hq; simp [«беда-оборвана»] at hok

/-- **Ход «вычислить» состоятелен.** Записанное значение замкнутого терма сверено счётом
    равенства (`«счёт-тождество»`); тот же терм вместо себя цели не меняет. -/
theorem «ход-вычислить-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hw : «слово» l 3 = "вычислить") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходВычисления» p l := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходВычисления» p l = q at hok hv
  unfold «ходВычисления» at hq
  dsimp only at hq
  generalize ha : «т» («уголок» l 1) = a at hq
  generalize hb : «т» («уголок» l 2) = b at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · subst hq
    apply «одна-верна» I p _ h3 _ hv
    intro _ h
    exact h
  split at hq
  · subst hq; simp [«отказ-оборван»] at hok
  split at hq
  · rename_i heq
    subst hq
    apply «одна-верна» I p _ h3 _ hv
    intro _ h
    exact I.«подстановка-тождества» _ a b (I.«счёт-тождество» a b heq) (I.«т-верно» _ h)
  · subst hq; simp [«беда-оборвана»] at hok

end «Второй»
