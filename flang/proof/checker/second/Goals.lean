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
  «неНеЧисло» : String → Prop
  «т-верно» : ∀ g, «истинно» («т» g) → «истинно» g
  «т-сохраняет» : ∀ g, «истинно» g → «истинно» («т» g)
  «ужать-верно» : ∀ a b, «ужатьТ» a = «ужатьТ» b → «истинно» a → «истинно» b
  «ужать-здесь» : ∀ a b c, «ужатьТ» a = «ужатьТ» b → «здесь» a c → «здесь» b c
  «да-верно» : «истинно» "да"
  «совпали-верно» : ∀ a b, «совпали» a b = true → «истинно» a → «истинно» b
  «тождество-верно» : ∀ t, («сторонаКорня» t "равно" "равен").«есть» = true →
    «ужатьТ» («сторонаКорня» t "равно" "равен").«лево» = «ужатьТ» («сторонаКорня» t "равно" "равен").«право» → «истинно» t
  «равен-здесь» : ∀ t, («сторонаКорня» t "равен" "равно").«есть» = true → «истинно» t →
    «здесь» («сторонаКорня» t "равен" "равно").«лево» («сторонаКорня» t "равен" "равно").«право»
  «порядок-верно» : ∀ f g i (fr gr : «Разрез»), «неравКорня» f = some (i, fr) → «неравКорня» g = some (i, gr) →
    «ужатьТ» fr.«лево» = «ужатьТ» gr.«лево» → «ужатьТ» fr.«право» = «ужатьТ» gr.«право» → «истинно» f → «истинно» g
  «если-факт» : ∀ f, («разрез» f "то").«есть» = true → («разрез» («разрез» f "то").«право» "иначе").«есть» = true →
    («разрез» f "то").«лево».startsWith "если " = true → «истинно» f →
    «здесь» («словаС» («разрез» f "то").«лево» 1) "да" → «истинно» («разрез» («разрез» f "то").«право» "иначе").«лево»
  «охрана-верна» : ∀ t, («разрез» t "то").«есть» = true → («разрез» («разрез» t "то").«право» "иначе").«есть» = true →
    («разрез» t "то").«лево».startsWith "если " = true → «ужатьТ» («разрез» («разрез» t "то").«право» "иначе").«право» = "да" →
    («здесь» («словаС» («разрез» t "то").«лево» 1) "да" → «истинно» («разрез» («разрез» t "то").«право» "иначе").«лево») →
    «истинно» t
  «метка-факт» : ∀ c f, «метка» c → f ∈ c.splitOn "\n" →
    (f.startsWith "+" = true → «здесь» (f.drop 1).toString "да") ∧ (f.startsWith "-" = true → «здесь» (f.drop 1).toString "нет")
  «даёт-да» : ∀ f g x y s n v st, «порядокСравнения» f = some (x, y, s) → «порядокСравнения» g = some (n, v, st) →
    x = n → y = v → (s || !st) = true → «здесь» f "да" → «истинно» g
  «даёт-нет» : ∀ f g a b s n v st, «порядокСравнения» f = some (a, b, s) → «порядокСравнения» g = some (n, v, st) →
    «неНеЧисло» a → «неНеЧисло» b → b = n → a = v → (!s || !st) = true → «здесь» f "нет" → «истинно» g
  «порядок-тождества» : ∀ g x, «порядокСравнения» g = some (x, x, false) → «неНеЧисло» x → «истинно» g
  «здесь-симм» : ∀ a b, «здесь» a b → «здесь» b a
  «метка-пуста» : «метка» ""
  «метка-плюс» : ∀ c0 c, «метка» (if c0 = "" then "+" ++ c else c0 ++ "\n" ++ "+" ++ c) ↔ («метка» c0 ∧ «здесь» c "да")
  «метка-минус» : ∀ c0 c, «метка» (if c0 = "" then "-" ++ c else c0 ++ "\n" ++ "-" ++ c) ↔ («метка» c0 ∧ «здесь» c "нет")
  «равно-здесь» : ∀ t, («разрез» t "равно").«есть» = true → «кореньСравнения» t = true → «истинно» t →
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
  «нейтральный-ноль» : ∀ t «ог», («разрез» t "плюс").«есть» = true → («сверху» («ужатьТ» t) "плюс").length = 2 →
    «безНуля» t ≠ "" → «истинно» «ог» → «держитНоль» («безНуля» t) «ог» = true → «здесь» t («безНуля» t)
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
  by_cases hb : (n = 0 || n > p.«дано».length || !r.«есть» || !«кореньСравнения» (p.«дано».getD (n - 1) "")) = true
  · simp only [hb, ↓reduceIte] at hq; subst hq; simp [«беда-оборвана»] at hok
  simp only [hb, Bool.false_eq_true, ↓reduceIte] at hq
  simp only [Bool.or_eq_true, decide_eq_true_eq, Bool.not_eq_true', not_or, Bool.not_eq_false] at hb
  obtain ⟨⟨⟨hn0, hnl⟩, hre⟩, hroot⟩ := hb
  have hlt : n - 1 < p.«дано».length := by omega
  have hmem : p.«дано».getD (n - 1) "" ∈ p.«дано» := by
    rw [List.getD_eq_getElem?_getD, List.getElem?_eq_getElem hlt]
    exact List.getElem_mem _
  have hlr : (∀ d ∈ p.«дано», I.«истинно» d) → I.«здесь» r.«лево» r.«право» := by
    intro hd
    have h := I.«равно-здесь» _ (by rw [hr]; exact hre) hroot (hd _ hmem)
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

/-- **Ход «нейтральный ноль» состоятелен** для утверждения, чьи ограничения верны: при
    посылке `т0 больше К`, `К` не меньше 0, `т0 плюс 0` равно `т0` (`«нейтральный-ноль»`);
    вне связывателя равное подставляется. Под связывателем ход не берётся. -/
theorem «ход-нейтральный-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hlim : ∀ g ∈ o.«ограничения», I.«истинно» g)
    (hw : «слово» l 3 = "нейтральный") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходНуля» p l o := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходНуля» p l o = q at hok hv
  unfold «ходНуля» at hq
  dsimp only at hq
  generalize ht : «т» («уголок» l 1) = t at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hB
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hC
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hD
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · subst hq; simp [«отказ-оборван»] at hok
  rename_i hF
  subst hq
  have hB' : («разрез» t "плюс").«есть» = true ∧ («сверху» («ужатьТ» t) "плюс").length = 2 := by
    simpa using hB
  have hD' : ∃ g ∈ o.«ограничения», «держитНоль» («безНуля» t) g = true := by
    simpa using hD
  obtain ⟨g, hg, hz⟩ := hD'
  have heq := I.«нейтральный-ноль» t g hB'.1 hB'.2 hC (hlim g hg) hz
  apply «одна-верна» I p _ h3 _ hv
  intro _ h
  exact I.«подстановка-равенства» _ t _ (by simpa using hF) heq (I.«т-верно» _ h)

/-- Первая цель снята: достаточно, чтобы она была верна. -/
theorem «снять-верна» (I : «Толкование») (p : «Прогон») (hne : p.«цели» ≠ [])
    (hstep : (∀ d ∈ p.«дано», I.«истинно» d) → I.«метка» (p.«условияЦели» 0) → I.«истинно» p.«первая») :
    I.«верен» (p.«заменить» []) → I.«верен» p := by
  apply «заменитьСУсловиями-верен» I p [] _ hne
  intro hd hm _
  exact hstep hd hm

/-- Модус-поненс, не оборванный, снимает цель, и из верного факта следует цель. -/
theorem «модус-закрыт» (I : «Толкование») (p : «Прогон») (a f b : String)
    (hok : («модусПоненс» p a f b).«оборван» = false) :
    «модусПоненс» p a f b = { p.«заменить» [] with «факт» := "" } ∧ (I.«истинно» b → I.«истинно» a) := by
  unfold «модусПоненс» at hok ⊢
  split
  · rename_i h
    refine ⟨rfl, fun hb => I.«т-верно» _ (I.«ужать-верно» _ _ h.symm (I.«т-сохраняет» _ hb))⟩
  · rename_i h0
    simp only [h0, ↓reduceIte] at hok
    dsimp only at hok ⊢
    split
    · rename_i hfr
      simp only [hfr, ↓reduceIte] at hok
      split
      · rename_i hfree
        simp [hfree, «отказ-оборван»] at hok
      · rename_i hfree
        simp only [hfree, Bool.false_eq_true, ↓reduceIte] at hok ⊢
        split
        · rename_i hg
          have hg' : («сторонаКорня» («т» («вместо» a («сторонаКорня» b "равен" "равно").«лево» («сторонаКорня» b "равен" "равно").«право»)) "равно" "равен").«есть» = true ∧
              «ужатьТ» («сторонаКорня» («т» («вместо» a («сторонаКорня» b "равен" "равно").«лево» («сторонаКорня» b "равен" "равно").«право»)) "равно" "равен").«лево» =
              «ужатьТ» («сторонаКорня» («т» («вместо» a («сторонаКорня» b "равен" "равно").«лево» («сторонаКорня» b "равен" "равно").«право»)) "равно" "равен").«право» := by
            simpa using hg
          refine ⟨rfl, fun hb => ?_⟩
          exact I.«подстановка-равенства» a _ _ (by simpa using hfree) (I.«равен-здесь» b hfr hb)
            (I.«т-верно» _ (I.«тождество-верно» _ hg'.1 hg'.2))
        · rename_i hg
          simp only [hg] at hok
          simp [«беда-оборвана»] at hok
    · rename_i hfr
      simp only [hfr, Bool.false_eq_true, ↓reduceIte] at hok
      split at hok
      · simp [«беда-оборвана»] at hok
      · rename_i fi fn ci cn hfi hci
        split
        · rename_i hc
          have hc' : (fi = ci ∧ «ужатьТ» fn.«лево» = «ужатьТ» cn.«лево») ∧ «ужатьТ» fn.«право» = «ужатьТ» cn.«право» := by
            simpa using hc
          refine ⟨rfl, fun hb => ?_⟩
          obtain ⟨⟨h1, h2⟩, h3⟩ := hc'
          subst h1
          exact I.«порядок-верно» b a fi fn cn hfi hci h2 h3 hb
        · rename_i hc
          simp only [hc] at hok
          simp [«беда-оборвана»] at hok
      · simp [«беда-оборвана»] at hok

theorem «закрыть-условием» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hnn : ∀ x, «безНеЧисла» o x = true → I.«неНеЧисло» x) (hne : p.«цели» ≠ [])
    (hok : («закрытьУсловиемВетви» p l o).«оборван» = false)
    (hv : I.«верен» («закрытьУсловиемВетви» p l o)) : I.«верен» p := by
  generalize hq : «закрытьУсловиемВетви» p l o = q at hok hv
  unfold «закрытьУсловиемВетви» at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i x y st hg
  dsimp only at hq
  split at hq
  · rename_i hany
    subst hq
    apply «снять-верна» I p hne _ hv
    intro _ hm
    obtain ⟨f, hf, hd⟩ := List.any_eq_true.mp hany
    have hfl := I.«метка-факт» _ f hm hf
    split at hd
    · rename_i hplus
      split at hd
      · rename_i a b s0 hab
        have hd' : (a = x ∧ b = y) ∧ (s0 || !st) = true := by simpa using hd
        obtain ⟨⟨rfl, rfl⟩, hs⟩ := hd'
        exact I.«даёт-да» _ _ a b s0 a b st hab hg rfl rfl hs (hfl.1 hplus)
      · simp at hd
    · rename_i hplus
      split at hd
      · rename_i hminus
        split at hd
        · rename_i a b s0 hab
          have hd' : ((((«безНеЧисла» o a = true ∧ «безНеЧисла» o b = true) ∧ b = x) ∧ a = y) ∧ (!s0 || !st) = true) := by
            simpa using hd
          obtain ⟨⟨⟨⟨ha, hb⟩, rfl⟩, rfl⟩, hs⟩ := hd'
          exact I.«даёт-нет» _ _ a b s0 b a st hab hg (hnn a ha) (hnn b hb) rfl rfl hs (hfl.2 hminus)
        · simp at hd
      · simp at hd
  · subst hq; simp [«беда-оборвана»] at hok

theorem «закрыть-порядком» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hnn : ∀ x, «безНеЧисла» o x = true → I.«неНеЧисло» x) (hne : p.«цели» ≠ [])
    (hok : («закрытьПорядкомТождества» p l o).«оборван» = false)
    (hv : I.«верен» («закрытьПорядкомТождества» p l o)) : I.«верен» p := by
  generalize hq : «закрытьПорядкомТождества» p l o = q at hok hv
  unfold «закрытьПорядкомТождества» at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  split at hq
  · rename_i x y hg
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hxy
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hx
    subst hq
    have hxy' : x = y := by simpa using hxy
    subst hxy'
    apply «снять-верна» I p hne _ hv
    intro _ _
    exact I.«порядок-тождества» _ x hg (hnn x (by simpa using hx))
  · subst hq; simp [«беда-оборвана»] at hok

/-- Ход «закрыть по свойству» при верном внесённом факте снимает цель. -/
theorem «закрыть-по-свойству» (I : «Толкование») (p : «Прогон») (l : String) (hne : p.«цели» ≠ [])
    (hfact : p.«факт» ≠ "" → I.«истинно» p.«факт»)
    (hok : («закрытьПоСвойству» p l).«оборван» = false)
    (hv : I.«верен» («закрытьПоСвойству» p l)) : I.«верен» p := by
  generalize hq : «закрытьПоСвойству» p l = q at hok hv
  unfold «закрытьПоСвойству» at hq
  dsimp only at hq
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hf0
  have hF := hfact hf0
  split at hq
  · subst hq
    obtain ⟨he, himp⟩ := «модус-закрыт» I p _ _ _ hok
    rw [he] at hv
    exact «снять-верна» I p hne (fun _ _ => himp hF) hv
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hA
  split at hq
  · subst hq; simp [«беда-оборвана»] at hok
  rename_i hB
  have hA' : (((«разрез» p.«первая» "то").«есть» = true ∧ («разрез» («разрез» p.«первая» "то").«право» "иначе").«есть» = true) ∧
      («разрез» p.«первая» "то").«лево».startsWith "если " = true) ∧
      «ужатьТ» («словаС» («разрез» p.«первая» "то").«лево» 1) = «ужатьТ» («обрезать» («уголок» l 1)) := by
    simpa using hA
  obtain ⟨⟨⟨hc1, hc2⟩, hc3⟩, hc4⟩ := hA'
  have hB' : «ужатьТ» («разрез» («разрез» p.«первая» "то").«право» "иначе").«право» = "да" := by simpa using hB
  split at hq
  · rename_i hG
    have hG' : ((«разрез» p.«факт» "то").«есть» = true ∧ («разрез» («разрез» p.«факт» "то").«право» "иначе").«есть» = true) ∧
        («разрез» p.«факт» "то").«лево».startsWith "если " = true := by simpa using hG
    obtain ⟨⟨hf1, hf2⟩, hf3⟩ := hG'
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hU
    have hU' : «ужатьТ» («словаС» («разрез» p.«факт» "то").«лево» 1) = «ужатьТ» («обрезать» («уголок» l 1)) := by
      simpa using hU
    subst hq
    obtain ⟨he, himp⟩ := «модус-закрыт» I p _ _ _ hok
    rw [he] at hv
    apply «снять-верна» I p hne _ hv
    intro _ _
    apply I.«охрана-верна» _ hc1 hc2 hc3 hB'
    intro hy
    apply himp
    apply I.«если-факт» _ hf1 hf2 hf3 hF
    exact I.«ужать-здесь» _ _ _ (hc4.trans hU'.symm) hy
  · subst hq
    obtain ⟨he, himp⟩ := «модус-закрыт» I p _ _ _ hok
    rw [he] at hv
    apply «снять-верна» I p hne _ hv
    intro _ _
    exact I.«охрана-верна» _ hc1 hc2 hc3 hB' (fun _ => himp hF)

/-- **Ход «закрыть» состоятелен** во всех семи формах, когда верны требования
    доказываемой функции, типы её доводов исключают не-число там, где так говорит
    `«безНеЧисла»`, и внесённый факт верен: допущение (`дано`), равенство себе
    (`тождеством`, равенство языка рефлексивно), `да` (`истиной`), требование функции
    (`требованием`), условие ветви (`условием ветви`), `Т не больше Т` (`порядком
    тождества`), модус-поненс по факту (`по свойству`). -/
theorem «ход-закрыть-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hreq : ∀ (n : Nat) («имя» : String), o.«исх».«хозяин» n = o.«функция» →
      (o.«исх».«по» n).startsWith s!"требует «{«имя»}» " = true →
      I.«истинно» («т» («после» (o.«исх».«по» n) s!"требует «{«имя»}» ")))
    (hnn : ∀ x, «безНеЧисла» o x = true → I.«неНеЧисло» x)
    (hfact : p.«факт» ≠ "" → I.«истинно» p.«факт»)
    (hw : «слово» l 3 = "закрыть") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходЗакрытия» p l o := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходЗакрытия» p l o = q at hok hv
  unfold «ходЗакрытия» at hq
  dsimp only at hq
  split at hq
  · subst hq; exact «закрыть-условием» I p l o hnn h3 hok hv
  · subst hq; exact «закрыть-порядком» I p l o hnn h3 hok hv
  · split at hq
    · rename_i hc
      subst hq
      have hc' : («ужатьТ» (p.«дано».getD («номерПосле» l "закрыть дано " - 1) "") = «ужатьТ» p.«первая» ∧
          1 ≤ «номерПосле» l "закрыть дано ") ∧ «номерПосле» l "закрыть дано " ≤ p.«дано».length := by
        simpa using hc
      obtain ⟨⟨hu, hn1⟩, hn2⟩ := hc'
      apply «снять-верна» I p h3 _ hv
      intro hd _
      have hlt : «номерПосле» l "закрыть дано " - 1 < p.«дано».length := by omega
      have hmem : p.«дано».getD («номерПосле» l "закрыть дано " - 1) "" ∈ p.«дано» := by
        rw [List.getD_eq_getElem?_getD, List.getElem?_eq_getElem hlt]
        exact List.getElem_mem _
      exact I.«ужать-верно» _ _ hu (hd _ hmem)
    · subst hq; simp [«беда-оборвана»] at hok
  · split at hq
    · rename_i hc
      subst hq
      have hc' : («сторонаКорня» p.«первая» "равно" "равен").«есть» = true ∧
          «ужатьТ» («сторонаКорня» p.«первая» "равно" "равен").«лево» = «ужатьТ» («сторонаКорня» p.«первая» "равно" "равен").«право» := by
        simpa using hc
      apply «снять-верна» I p h3 _ hv
      intro _ _
      exact I.«тождество-верно» _ hc'.1 hc'.2
    · subst hq; simp [«беда-оборвана»] at hok
  · split at hq
    · rename_i hc
      subst hq
      apply «снять-верна» I p h3 _ hv
      intro _ _
      rw [hc]
      exact I.«да-верно»
    · subst hq; simp [«беда-оборвана»] at hok
  · split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hA
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hB
    split at hq
    · subst hq; simp [«беда-оборвана»] at hok
    rename_i hC
    subst hq
    apply «снять-верна» I p h3 _ hv
    intro _ _
    have hA' : (o.«исх».«по» («номерПосле» l "строка ")).startsWith s!"требует «{«ёлочка» l 1}» " = true := by
      simpa using hA
    have hB' : o.«исх».«хозяин» («номерПосле» l "строка ") = o.«функция» := by simpa using hB
    have hC' : «совпали» («т» («после» (o.«исх».«по» («номерПосле» l "строка ")) s!"требует «{«ёлочка» l 1}» "))
        («т» p.«первая») = true := by simpa using hC
    exact I.«т-верно» _ (I.«совпали-верно» _ _ hC' (hreq _ _ hB' hA'))
  · subst hq; exact «закрыть-по-свойству» I p l h3 hfact hok hv
  · subst hq; simp [«беда-оборвана»] at hok

/-- **Ход «подставить пусть» состоятелен**, когда единственное связывание `пусть` имени в
    доказываемой функции даёт имени в цели его значение (посылка `hlet`); вне связывателя
    равное подставляется. Под связывателем и при двух `пусть` одного имени ход не берётся. -/
theorem «ход-подставить-состоятелен» (I : «Толкование») (p : «Прогон») (l : String) (o : «Обст»)
    (hlet : ∀ (n : Nat), o.«исх».«хозяин» n = o.«функция» →
      («какЧитаетЯзык» (o.«исх».«по» n)).startsWith "пусть " = true →
      ((o.«исх».«внутри» o.«функция»).filter (fun i =>
        («какЧитаетЯзык» (o.«исх».«по» i)).startsWith "пусть " &&
          «слово» («какЧитаетЯзык» (o.«исх».«по» i)) 2 = «слово» («какЧитаетЯзык» (o.«исх».«по» n)) 2)).length = 1 →
      I.«здесь» («слово» («какЧитаетЯзык» (o.«исх».«по» n)) 2) («т» («словаС» («какЧитаетЯзык» (o.«исх».«по» n)) 3)))
    (hw : «слово» l 3 = "подставить") (hok : («ходШага» p l o).«оборван» = false)
    (hv : I.«верен» («ходШага» p l o)) : I.«верен» p := by
  obtain ⟨h1, h2, h3⟩ := «шаг-допущен» p l o hok
  have e : «ходШага» p l o = «ходПусть» p l o := by simp [«ходШага», h1, h2, h3, hw]
  rw [e] at hok hv
  generalize hq : «ходПусть» p l o = q at hok hv
  unfold «ходПусть» at hq
  simp only [Id.run] at hq
  generalize hn : «номерПосле» l "строка " = n at hq
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  rename_i hx
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  rename_i hh
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «отказ-оборван»] at hok
  rename_i hu
  split at hq
  · subst hq; simp [pure, «беда-оборвана»] at hok
  split at hq
  · subst hq; simp [pure, «отказ-оборван»] at hok
  rename_i hf
  simp only [pure] at hq
  subst hq
  have hx' : («какЧитаетЯзык» (o.«исх».«по» n)).startsWith "пусть " = true := by
    simp only [Bool.or_eq_true, Bool.not_eq_true', decide_eq_true_eq, not_or] at hx
    simpa using hx.1
  have hh' : o.«исх».«хозяин» n = o.«функция» := by simpa using hh
  have hu' := Decidable.of_not_not hu
  apply «одна-верна» I p _ h3 _ hv
  intro _ h
  exact I.«подстановка-равенства» _ _ _ (by simpa using hf) (hlet n hh' hx' hu') (I.«т-верно» _ h)

/-! ## Прогон блока ходов целиком -/

/-- Начальная цель посылки верна при верных допущениях индукции этого прогона. -/
def «Толкование».«верноНачало» (I : «Толкование») (o : «Обст») (p : «Прогон») : Prop :=
  (∀ d ∈ p.«дано», I.«истинно» d) → I.«истинно» (o.«начальная» p.«вариант»)

/-- Идущий прогон не оборван, и его верность даёт начальную цель посылки. -/
def «Толкование».«держит» (I : «Толкование») (o : «Обст») (p : «Прогон») : Prop :=
  p.«идёт» = true → p.«оборван» = false ∧ (I.«верен» p → I.«верноНачало» o p)

theorem «держит-не-идёт» (I : «Толкование») (o : «Обст») (p : «Прогон») (h : p.«идёт» = false) :
    I.«держит» o p := by
  intro hi; rw [h] at hi; exact absurd hi (by decide)

theorem «держит-беда» (I : «Толкование») (o : «Обст») (p : «Прогон») (t : String) :
    I.«держит» o (p.«беда» t) := «держит-не-идёт» I o _ rfl

/-- Сведение без целей верно само: начальная цель доказана. -/
theorem «конец-доказал» (I : «Толкование») (o : «Обст») (p : «Прогон»)
    (hi : p.«идёт» = true) (he : p.«цели» = []) (hd : I.«держит» o p) : I.«верноНачало» o p := by
  apply (hd hi).2
  intro _ i hlt
  rw [he] at hlt
  exact absurd hlt (Nat.not_lt_zero _)

/-- **Ход «цель»**: начальная цель варианта посылки становится единственной целью, и верность
    прогона даёт её. -/
theorem «ход-цель-состоятелен» (I : «Толкование») (o : «Обст») (p : «Прогон») (s0 : String)
    (hp : («обрезать» s0).startsWith "посылка " = false) (hs : («обрезать» s0).startsWith "ход " = true)
    (hw : «слово» («обрезать» s0) 2 = "цель") : I.«держит» o («шагБлока» o p s0) := by
  unfold «шагБлока»
  simp only [hp, hs, hw, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
  split
  · exact «держит-беда» I o _ _
  · intro _
    refine ⟨rfl, fun hv _ => ?_⟩
    have h0 := hv (by simp) 0 (by simp)
    simp only [«Толкование».«цельВерна», «Прогон».«условияЦели»] at h0
    exact h0 (by simpa using I.«метка-пуста»)

/-- **Ход «дано»**: допущение индукции добавляется к допущениям прогона; верность прогона
    при всех допущениях даёт начальную цель, как и до хода. -/
theorem «ход-дано-состоятелен» (I : «Толкование») (o : «Обст») (p : «Прогон») (s0 : String)
    (hp : («обрезать» s0).startsWith "посылка " = false) (hs : («обрезать» s0).startsWith "ход " = true)
    (hw : «слово» («обрезать» s0) 2 = "дано") (hh : I.«держит» o p) : I.«держит» o («шагБлока» o p s0) := by
  unfold «шагБлока»
  simp only [hp, hs, hw, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
  unfold «ходДопущения»
  dsimp only
  split
  · exact «держит-беда» I o _ _
  split
  · exact «держит-беда» I o _ _
  split
  · exact «держит-беда» I o _ _
  intro hi
  obtain ⟨hob, himp⟩ := hh hi
  refine ⟨hob, fun hv hd => ?_⟩
  have hv' : I.«верен» p := by
    intro _ i hlt
    exact hv hd i hlt
  exact himp hv' (fun d hdm => hd d (List.mem_append_left _ hdm))

/-- **Ход «конец»** закрывает сведение: прогон перестаёт идти. -/
theorem «ход-конец-состоятелен» (I : «Толкование») (o : «Обст») (p : «Прогон») (s0 : String)
    (hp : («обрезать» s0).startsWith "посылка " = false) (hs : («обрезать» s0).startsWith "ход " = true)
    (hw : «слово» («обрезать» s0) 2 = "конец") : I.«держит» o («шагБлока» o p s0) := by
  unfold «шагБлока»
  simp only [hp, hs, hw, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
  split
  · split
    · exact «держит-беда» I o _ _
    · rename_i h1 _
      exact «держит-не-идёт» I o _ (by simpa using h1)
  · split
    · exact «держит-беда» I o _ _
    · exact «держит-не-идёт» I o _ rfl

/-- Каждый ход, судимый `«ходШага»`, в рамке блока состоятелен: теоремы родов хода выше дают
    это для своих родов при своих посылках. -/
def «ходыСостоятельны» (I : «Толкование») (o : «Обст») : Prop :=
  ∀ p l, («вРамке» p («ходШага» («безФакта» p l) l o)).«оборван» = false →
    I.«верен» («вРамке» p («ходШага» («безФакта» p l) l o)) → I.«верен» p

theorem «верен-безФакта» (I : «Толкование») (p : «Прогон») (s : String) :
    I.«верен» («безФакта» p s) ↔ I.«верен» p := by
  unfold «безФакта»; split <;> exact Iff.rfl

theorem «безФакта-идёт» (p : «Прогон») (s : String) : («безФакта» p s).«идёт» = p.«идёт» := by
  unfold «безФакта»; split <;> rfl

theorem «шагБлока-прочий» (o : «Обст») (p : «Прогон») (s0 : String)
    (hp' : («обрезать» s0).startsWith "посылка " = false) (hs : («обрезать» s0).startsWith "ход " = true)
    (h1 : ¬ «слово» («обрезать» s0) 2 = "цель") (h2 : ¬ «слово» («обрезать» s0) 2 = "дано")
    (h3 : ¬ «слово» («обрезать» s0) 2 = "конец") :
    «шагБлока» o p s0 = «вРамке» p («ходШага» («безФакта» p («обрезать» s0)) («обрезать» s0) o) := by
  unfold «шагБлока»
  simp only [hp', hs, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
  try (split <;> simp_all)

theorem «шаг-держит» (I : «Толкование») (o : «Обст») (H : «ходыСостоятельны» I o)
    (p : «Прогон») (s0 : String) (hh : I.«держит» o p) : I.«держит» o («шагБлока» o p s0) := by
  by_cases hp : («обрезать» s0).startsWith "посылка " = true
  · unfold «шагБлока»; simp only [hp, ↓reduceIte]
    exact «держит-не-идёт» I o _ rfl
  have hp' : («обрезать» s0).startsWith "посылка " = false := by simpa using hp
  by_cases hs : («обрезать» s0).startsWith "ход " = true
  · by_cases h1 : «слово» («обрезать» s0) 2 = "цель"
    · exact «ход-цель-состоятелен» I o p s0 hp' hs h1
    by_cases h2 : «слово» («обрезать» s0) 2 = "дано"
    · exact «ход-дано-состоятелен» I o p s0 hp' hs h2 hh
    by_cases h3 : «слово» («обрезать» s0) 2 = "конец"
    · exact «ход-конец-состоятелен» I o p s0 hp' hs h3
    rw [«шагБлока-прочий» o p s0 hp' hs h1 h2 h3]
    intro hq
    have hq' : («ходШага» («безФакта» p («обрезать» s0)) («обрезать» s0) o).«идёт» = true ∧ p.«идёт» = true := by
      simpa [«вРамке»] using hq
    obtain ⟨hpo, himp⟩ := hh hq'.2
    have hob : («вРамке» p («ходШага» («безФакта» p («обрезать» s0)) («обрезать» s0) o)).«оборван» = false := by
      simp [«вРамке», hq'.1, hq'.2, hpo]
    refine ⟨hob, fun hv => ?_⟩
    exact himp (H p _ hob hv)
  · have hs' : («обрезать» s0).startsWith "ход " = false := by simpa using hs
    unfold «шагБлока»; simp only [hp', hs', Bool.false_eq_true, ↓reduceIte, Bool.not_false]
    exact hh

/-- Прогон блока с призраком: при каждом принятом `ход конец` запоминается прогон, чьё
    сведение закрыто. -/
def «конецПринят» (p : «Прогон») (s0 : String) : Bool :=
  !(«обрезать» s0).startsWith "посылка " && («обрезать» s0).startsWith "ход " &&
    «слово» («обрезать» s0) 2 = "конец" && p.«идёт» && p.«цели».isEmpty

def «шагБлокаС» (o : «Обст») (st : «Прогон» × List «Прогон») (s0 : String) : «Прогон» × List «Прогон» :=
  («шагБлока» o st.1 s0, if «конецПринят» st.1 s0 then st.2 ++ [st.1] else st.2)

theorem «призрак-тот-же» (o : «Обст») : ∀ (ss : List String) (st : «Прогон» × List «Прогон»),
    (ss.foldl («шагБлокаС» o) st).1 = ss.foldl («шагБлока» o) st.1
  | [], _ => rfl
  | s :: ss, st => by
    simp only [List.foldl_cons]
    exact «призрак-тот-же» o ss _

theorem «шаг-счёт» (o : «Обст») (p : «Прогон») (s0 : String) :
    («шагБлока» o p s0).«проиграно» = p.«проиграно» + (if «конецПринят» p s0 then 1 else 0) := by
  by_cases hp : («обрезать» s0).startsWith "посылка " = true
  · have hc : «конецПринят» p s0 = false := by simp [«конецПринят», hp]
    rw [hc]; unfold «шагБлока»; simp only [hp, ↓reduceIte]
    split <;> simp [«Прогон».«беда»]
  have hp' : («обрезать» s0).startsWith "посылка " = false := by simpa using hp
  by_cases hs : («обрезать» s0).startsWith "ход " = true
  · by_cases h3 : «слово» («обрезать» s0) 2 = "конец"
    · unfold «шагБлока» «конецПринят»
      simp only [hp', hs, h3, Bool.false_eq_true, ↓reduceIte, Bool.not_true, Bool.not_false, Bool.true_and,
        decide_true]
      by_cases hi : p.«идёт» = true
      · by_cases he : p.«цели».isEmpty = true
        · simp [hi, he]
        · simp [hi, he, «Прогон».«беда»]
      · have hi' : p.«идёт» = false := by simpa using hi
        simp only [hi']
        by_cases ho : p.«оборван» = false <;> simp [ho, «Прогон».«беда»]
    have hc : «конецПринят» p s0 = false := by simp [«конецПринят», h3]
    rw [hc]
    simp only [Bool.false_eq_true, ↓reduceIte, Nat.add_zero]
    by_cases h1 : «слово» («обрезать» s0) 2 = "цель"
    · unfold «шагБлока»; simp only [hp', hs, h1, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
      split <;> simp [«Прогон».«беда»]
    by_cases h2 : «слово» («обрезать» s0) 2 = "дано"
    · unfold «шагБлока»; simp only [hp', hs, h2, Bool.false_eq_true, ↓reduceIte, Bool.not_true]
      unfold «ходДопущения»; dsimp only
      split <;> (try split) <;> (try split) <;> simp [«Прогон».«беда»]
    rw [«шагБлока-прочий» o p s0 hp' hs h1 h2 h3]
    simp [«вРамке»]
  · have hs' : («обрезать» s0).startsWith "ход " = false := by simpa using hs
    have hc : «конецПринят» p s0 = false := by simp [«конецПринят», hs']
    rw [hc]; unfold «шагБлока»; simp [hp', hs']

theorem «свёртка-блока» (I : «Толкование») (o : «Обст») (H : «ходыСостоятельны» I o) :
    ∀ (ss : List String) (st : «Прогон» × List «Прогон»), I.«держит» o st.1 → (∀ q ∈ st.2, I.«верноНачало» o q) →
      st.1.«проиграно» = st.2.length →
      let r := ss.foldl («шагБлокаС» o) st
      I.«держит» o r.1 ∧ (∀ q ∈ r.2, I.«верноНачало» o q) ∧ r.1.«проиграно» = r.2.length
  | [], st, h1, h2, h3 => ⟨h1, h2, h3⟩
  | s :: ss, st, h1, h2, h3 => by
    simp only [List.foldl_cons]
    apply «свёртка-блока» I o H ss
    · exact «шаг-держит» I o H st.1 s h1
    · unfold «шагБлокаС»
      split
      · rename_i hc
        intro q hq
        rcases List.mem_append.mp hq with hq | hq
        · exact h2 q hq
        · have hq' : q = st.1 := by simpa using hq
          subst hq'
          unfold «конецПринят» at hc
          have hc' : ((((!(«обрезать» s).startsWith "посылка ") = true ∧ («обрезать» s).startsWith "ход " = true) ∧
              «слово» («обрезать» s) 2 = "конец") ∧ st.1.«идёт» = true) ∧ st.1.«цели».isEmpty = true := by
            simpa using hc
          exact «конец-доказал» I o _ hc'.1.2 (by simpa using hc'.2) h1
      · exact h2
    · unfold «шагБлокаС»
      simp only [«шаг-счёт» o st.1 s, h3]
      split <;> simp

/-- **Прогон блока ходов состоятелен** при состоятельности каждого хода, судимого
    `«ходШага»` в рамке блока (`«ходыСостоятельны»`; теоремы родов хода дают её для своих
    родов): `«проигратьБлок»` насчитывает проигранных сведений столько,
    сколько закрыл `ход конец`, и каждое закрытое сведение доказало начальную цель своей
    посылки при верных допущениях индукции. -/
theorem «блок-состоятелен» (I : «Толкование») (o : «Обст») (H : «ходыСостоятельны» I o) :
    «проигратьБлок» o = «завершитьБлок» (o.«свои».foldl («шагБлокаС» o) ({}, [])).1 ∧
    («проигратьБлок» o).«проиграно» = (o.«свои».foldl («шагБлокаС» o) ({}, [])).2.length ∧
    ∀ q ∈ (o.«свои».foldl («шагБлокаС» o) ({}, [])).2, I.«верноНачало» o q := by
  have e : «проигратьБлок» o = «завершитьБлок» (o.«свои».foldl («шагБлокаС» o) ({}, [])).1 := by
    unfold «проигратьБлок»; rw [«призрак-тот-же»]
  obtain ⟨_, h2, h3⟩ := «свёртка-блока» I o H o.«свои» ({}, []) («держит-не-идёт» I o _ rfl)
    (fun _ h => by simp at h) rfl
  refine ⟨e, ?_, h2⟩
  rw [e]
  unfold «завершитьБлок»
  split <;> simp [«Прогон».«беда», h3]

end «Второй»
