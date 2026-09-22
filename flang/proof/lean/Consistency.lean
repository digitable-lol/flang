import «Приёмка»

/-!
# Состоятельность приёмки: «принят — значит верно» (ADR-0041 §2.1, веха 4)

Теорема «состоятельность»: `«Принят» з → «Судим» («окружение» з) («Факт-из» (цель з))`
— принятое утверждение выводится из своего окружения в каждом мире модели.
Доказательство — индукция по блоку (`«БлокПринят»`): у каждого принятого
шага его формула выводится из его открытых гипотез и окружения («Инв»), и
каждый случай `«ШагПринят»` закрывается леммой `Rules.lean`, поднятой на
термы в `Term.lean` («…-терм»).

## Чем закрыт каждый случай — поимённо

| правило | лемма `Rules.lean` | через |
|---|---|---|
| Т1, Н2, Н3 | «Т1» | «Т1-терм», «Н2-терм», «Н3-терм» |
| ГипО, ГипД | «ГипО», «ГипД» (гипотеза под собой; снятие — «Р1», «Р4») | у ГипД — факт «Л или П» из окружения через «или-разбор» |
| Кон1, Кон3 | «Кон1», «Кон2» (значение) | «Кон1-терм», «Кон3-терм» |
| Кон2 | «Р1» | своё «не-или» |
| Цел1, Цел2 | «Цел1», «Цел2» | «Цел1-терм», «Цел2-терм» |
| Св1 | «подстановка» + смысл `есть` | «Св1-терм» |
| Р1 | «Р1» | своё «если-да» |
| Р4 | «Р4» | сечение по факту «Л или П» из окружения |
| Или1, Или2, И1, И2 | «Или1», «Или2», «И1», «И2» | «…-терм» |
| Н1, Н4, Н5, Н7, Н8, Н9, Н10, Н12 | «Н1», «Н4», «Н5», «Н7», «Н8-второй», «Н9», «Н10», «Н12» | «…-терм» |
| Пред1, П1, П2, П3, П5, П6 | «Пред1», «П1», «П2», «П3», «П5», «П6» | «…-терм» |
| Д1, Д3, Д4, Д5, Д6 | «Д1», «Д3-днами», «Д4», «Д5», «Д6» | «…-терм» |
| О1, О2, О3, О4, О5, О8, О10 | «О1», «О2», «О3», «О4», «О5» (прибавка-имя — с «отрезок-числом»), «О8», «О10» | «…-терм» |
| О6 | «О6» (левая сторона представима — факт окружения «числа-представимы») | «О6-терм», «представимаЛевая-верно» |
| С1, С2, С3, С4 | «С1», «С2», «С3», «С4» | «…-терм» |
| СС1, СС2, СС3, СС4 | «СС1», «СС2», «СС3», «СС4», «СС4-противоречием» | «…-терм» |
| В1, В2, В3, В4 | «В1», «В2-…», «В3-…», «В4» | «…-терм» |
| Э1, Э2, Э3, Э4 | «Э1», «Э2», «Э3-приписать»/«Э3-добавить», «Э4» | «…-терм» |
| Э5, Э6 | «Э5», «Э6» («всеЭ-отобр») | «Э5-терм», «Э6-терм» |
| Т2 | — (о записи терма: переименование связанного имени) | «Т2-терм» в `Term.lean` |
| Ч1, Ч2, Ч3, Ч4, Ч6 | «Ч1», «Ч2», «Ч3», «Ч4», «Ч6» | «…-терм» |
| Ч5 | «Ч5» (начало сличено) | «Ч5-терм», «точныйТекст?-значение» |
| Разв2 | «подстановка» + факт «результат равен телу» | здесь |
| Пр1 | «Пр1» (пара ложна при любых значениях) | здесь, `False.elim` |
| М1 | «М1» (мера прибавления), «моно» и «точно» округления | «собрать-М1» здесь: вторая сторона — литерал меньше 2⁵³ по модулю |
| М2 | «М2-пустое-начало» | «мера2-значение», «собрать2-замена» здесь |
| К↑ | «К↑» (проекция произведения) | «полеСтороны-значение», «собрать2-замена» здесь |
| Разв1 (сумма) | «Разв1-сумма» (ветвь своего варианта) | «ветвь?-значение», «поляИмён-мир», «подстПар-значение» здесь |
| Разв3 | «Разв3» (β-редукция) | своё тело — «подстановка» + факт «результат равен телу»; вызов — «замФ-верно», «развёрнут?-верно» + факт «функция равна телу» здесь |

До задачи 3855 у строк Или1, Или2, И1, И2, Цел1, Цел2 лемм в `Rules.lean`
не было: случаи Или/И закрывались здесь своими леммами о булевых связках, а
Цел приёмка не брала вовсе.

## Подмножество — числом

Теорема доказана для 76 правил приёмки (`«покрыто» = 76`, проверено
`decide`) из 81 приёма `шаг_вывода`; из 15 именованных — для 15 (Разв1 — для
разбора выписанного конструктора суммы, Разв1 по строке тела вне приёмки).
Пять непокрытых и почему — в шапке `Acceptance.lean`.
-/

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

open «Знач»

/-! ## Леммы о суждении: расширение окружения и сечение -/

theorem «расширение» {W : Type} {Γ Γ' : List («Факт» W)} {P : «Факт» W}
    (h : «Судим» Γ P) (hs : ∀ f ∈ Γ, f ∈ Γ') : «Судим» Γ' P :=
  fun w hw => h w (fun f hf => hw f (hs f hf))

theorem «сечение» {W : Type} {Γ : List («Факт» W)} {A P : «Факт» W}
    (hA : «Судим» Γ A) (h : «Судим» (A :: Γ) P) : «Судим» Γ P :=
  fun w hw => h w (fun f hf => by
    rcases List.mem_cons.mp hf with rfl | hf
    · exact hA w hw
    · exact hw f hf)

theorem «гип-склейка» (o1 o2 : List (Nat × «Форм»)) : «гип» (o1 ++ o2) = «гип» o1 ++ «гип» o2 := by
  simp [«гип»]

theorem «слева» {Γ : List («Факт» «Мир»)} {P : «Факт» «Мир»} (o1 o2 : List (Nat × «Форм»))
    (h : «Судим» («гип» o1 ++ Γ) P) : «Судим» («гип» (o1 ++ o2) ++ Γ) P := by
  rw [«гип-склейка»]
  exact «расширение» h (fun f hf => by
    rcases List.mem_append.mp hf with hf | hf
    · exact List.mem_append_left _ (List.mem_append_left _ hf)
    · exact List.mem_append_right _ hf)

theorem «справа» {Γ : List («Факт» «Мир»)} {P : «Факт» «Мир»} (o1 o2 : List (Nat × «Форм»))
    (h : «Судим» («гип» o2 ++ Γ) P) : «Судим» («гип» (o1 ++ o2) ++ Γ) P := by
  rw [«гип-склейка»]
  exact «расширение» h (fun f hf => by
    rcases List.mem_append.mp hf with hf | hf
    · exact List.mem_append_left _ (List.mem_append_right _ hf)
    · exact List.mem_append_right _ hf)

/-- Открытые гипотезы, все с одной формулой, — одно допущение. -/
theorem «одна-гипотеза» {Γ : List («Факт» «Мир»)} {P : «Факт» «Мир»} {o : List (Nat × «Форм»)} {c : «Форм»}
    (hc : ∀ p ∈ o, p.2 = c) (h : «Судим» («гип» o ++ Γ) P) : «Судим» («Факт-из» c :: Γ) P :=
  «расширение» h (fun f hf => by
    rcases List.mem_append.mp hf with hf | hf
    · simp only [«гип», List.mem_map] at hf
      obtain ⟨p, hp, rfl⟩ := hf
      rw [hc p hp]; exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ hf)

/-! ## Булевы связки формул -/

theorem «или-разбор» (l r : «Форм») (w : «Мир») (h : «Факт-из» (.«или» l r) w) :
    «Факт-из» l w ∨ «Факт-из» r w := by
  simp only [«Факт-из», «оценитьФ», Bool.or_eq_true] at *; exact h
theorem «если-да» (c q : «Форм») (w : «Мир») (h : «Факт-из» c w → «Факт-из» q w) :
    «Факт-из» (.«еслиФ» c q .«да») w := by
  simp only [«Факт-из», «оценитьФ»] at *
  cases hc : «оценитьФ» c w
  · simp
  · simp [h hc]

/-- «Л не меньше П» и «П не больше Л» — один факт. -/
theorem «зеркало» (l r : «ТермЧ») : «Факт-из» (.«неМеньше» l r) = «Факт-из» (.«неБольше» r l) := by
  funext w; simp [«Факт-из», «оценитьФ», «неМеньше»]

theorem «равен-под-потолком» (x : «Знач») (k2 k : Int) (h : «равен» x («кон» k2) = true) (hk : k2 ≤ k) :
    «неБольше» x («кон» k) = true := by
  cases x <;> simp_all [«равен», «неБольше»] <;> omega

theorem «П2-равен-терм» (Γ : List («Факт» «Мир»)) (t : «ТермЧ») (k2 k : Int) (hk : k2 ≤ k)
    (h : «Выводится» Γ (.«равен» t (.«лит» k2))) : «Выводится» Γ («≤К» t k) :=
  «подъём1» (fun w hr => («факт-потолок» _ _ w).mpr (by
    simp only [«Факт-из», «оценитьФ», «оценить»] at hr
    exact «равен-под-потолком» _ k2 k hr hk)) h

theorem «допущение-любое-в-окружении» (u : «Утверждение») (f : «Форм») (h : f ∈ u.«допущения») :
    «Факт-из» f ∈ «окружение» u := by
  simp only [«окружение»]
  apply List.mem_append_left
  apply List.mem_append_left; apply List.mem_append_left; apply List.mem_append_left; apply List.mem_append_left
  exact List.mem_map.mpr ⟨f, h, rfl⟩

theorem «шагПо-в» {«преж» : List «Принятый»} {k : Nat} {p : «Принятый»}
    (h : «шагПо» «преж» k = some p) : p ∈ «преж» := by
  unfold «шагПо» at h
  split at h
  · cases h
  · exact List.mem_of_getElem? h

theorem «порядок?-факт» {f : «Форм»} {e g : «ТермЧ»} (h : «порядок?» f = some (e, g)) :
    «Факт-из» f = «Факт-из» (.«неБольше» e g) := by
  unfold «порядок?» at h
  split at h <;> cases h
  · rfl
  · exact «зеркало» _ _

theorem «вЧленах-верно» (e : «ТермЧ») : ∀ (d : «Члены»), «вЧленах» e d = true → ∀ w, «оценить» e w ∈ «оценитьЧл» d w
  | .«нет», h, _ => by simp [«вЧленах»] at h
  | .«ещё» t r, h, w => by
    simp only [«вЧленах», Bool.or_eq_true] at h
    simp only [«оценитьЧл», List.mem_cons]
    rcases h with h | h
    · exact Or.inl (by rw [of_decide_eq_true h])
    · exact Or.inr («вЧленах-верно» e r h w)

theorem «строгий?-факт» {f : «Форм»} {e g : «ТермЧ»} (h : «строгий?» f = some (e, g)) :
    «Факт-из» f = «Факт-из» (.«меньше» e g) := by
  unfold «строгий?» at h
  split at h <;> cases h
  · rfl
  · funext w; simp [«Факт-из», «оценитьФ»]

theorem «посылкаО2-верно» {g : «ТермЧ»} {p : «Принятый»} (h : «посылкаО2» g p = true) (w : «Мир»)
    (hw : «Факт-из» p.«формула» w) : «неотр» («оценить» g w) = true ∨ «конечно» («оценить» g w) = true := by
  unfold «посылкаО2» at h
  split at h
  · rename_i g' hf
    have hg : g' = g := of_decide_eq_true h
    subst hg; rw [hf] at hw
    exact Or.inl ((«факт-неотр» _ w).mp hw)
  · rename_i g' k hf
    have hg : g' = g := of_decide_eq_true h
    subst hg; rw [hf] at hw
    exact Or.inr («Кон1» _ k ((«факт-потолок» _ _ w).mp hw))
  · rename_i g' hf
    simp only [Bool.and_eq_true, decide_eq_true_eq] at h
    obtain ⟨hg, -⟩ := h
    subst hg; rw [hf] at hw
    exact Or.inr ((«факт-кон» _ w).mp hw)
  · cases h

theorem «голова?-пусто» {x : «ТермС»} (h : «голова?» x = some none) : ∀ w, «оценитьС» x w = [] := by
  intro w
  cases x with
  | «пустой» => simp [«оценитьС»]
  | «выписан» d =>
    cases d with
    | «нет» => simp [«оценитьС», «оценитьЧл»]
    | «ещё» _ _ => simp [«голова?»] at h
  | _ => simp [«голова?»] at h

theorem «голова?-голова» {x : «ТермС»} {h : «ТермЧ»} (hx : «голова?» x = some (some h)) :
    ∀ w b t, «оценитьС» x w = b :: t → b = «оценить» h w := by
  intro w b t hbt
  cases x with
  | «выписан» d =>
    cases d with
    | «нет» => simp [«голова?»] at hx
    | «ещё» h' r =>
      simp only [«голова?», Option.some.injEq] at hx
      subst hx
      simp only [«оценитьС», «оценитьЧл», List.cons.injEq] at hbt
      exact hbt.1.symm
  | «приписать» h' r =>
    simp only [«голова?», Option.some.injEq] at hx
    subst hx
    simp only [«оценитьС», List.cons.injEq] at hbt
    exact hbt.1.symm
  | _ => simp [«голова?»] at hx

theorem «не-или» (c q : «Форм») (w : «Мир») (h : «Факт-из» c w → «Факт-из» q w) :
    «Факт-из» (.«или» (.«не» c) q) w := by
  simp only [«Факт-из», «оценитьФ»] at *
  cases hc : «оценитьФ» c w
  · simp
  · simp [h hc]

theorem «имя-накопителя» (w : «Мир») (a e : String) (acc v : «Знач») (hae : a ≠ e) :
    «оценить» (.«имя» a) («обновить» («обновить» w a acc) e v) = acc := by
  simp [«оценить», hae]

theorem «имя-накопителя-знач» (w : «Мир») (a e : String) (acc v : «Знач») (hae : a ≠ e) :
    «какЧисло» ((«обновить» («обновить» w a acc) e v).«имя» a) = acc := by
  simp [hae]

theorem «ветвьСчёта-верно» {s : «ТермЧ»} {a e : String} (hae : a ≠ e) (h : «ветвьСчёта» s a = true)
    (w : «Мир») (acc v : «Знач») (hacc : «неотр» acc = true) :
    «неотр» («оценить» s («обновить» («обновить» w a acc) e v)) = true := by
  unfold «ветвьСчёта» at h
  split at h
  · rename_i x
    have hx : x = a := by simpa using h
    subst hx; rw [«имя-накопителя» w x e acc v hae]; exact hacc
  · rename_i x k
    simp only [Bool.and_eq_true, beq_iff_eq, decide_eq_true_eq] at h
    obtain ⟨rfl, hk⟩ := h
    simp only [«оценить», «имя-накопителя-знач» w x e acc v hae]
    exact «Н5» _ _ _ hacc (by simp [«неотр»]; omega)
  · rename_i k x
    simp only [Bool.and_eq_true, beq_iff_eq, decide_eq_true_eq] at h
    obtain ⟨rfl, hk⟩ := h
    simp only [«оценить», «имя-накопителя-знач» w x e acc v hae]
    exact «Н5» _ _ _ (by simp [«неотр»]; omega) hacc
  · cases h

theorem «шагСчёта-верно» {s : «ТермЧ»} {a e : String} (hae : a ≠ e) (h : «шагСчёта» s a = true) :
    ∀ w acc v, «неотр» acc = true → «неотр» («оценить» s («обновить» («обновить» w a acc) e v)) = true := by
  intro w acc v hacc
  unfold «шагСчёта» at h
  simp only [Bool.or_eq_true] at h
  rcases h with h | h
  · exact «ветвьСчёта-верно» hae h w acc v hacc
  · split at h
    · rename_i c b d
      simp only [Bool.and_eq_true] at h
      simp only [«оценить»]
      exact «Н6» _ _ _ («ветвьСчёта-верно» hae h.1 w acc v hacc) («ветвьСчёта-верно» hae h.2 w acc v hacc)
    · cases h

theorem «положителенН8» (u : «Утверждение») (Γ : List («Факт» «Мир»)) (t : «ТермЧ»)
    (hΓ : ∀ f ∈ «окружение» u, f ∈ Γ) (h : «литералН8» t = true ∨ «отрезокН8» u t = true) :
    «Выводится» Γ (.«меньше» (.«лит» 0) t) ∧ «Выводится» Γ (.«кон» t) := by
  rcases h with h | h
  · cases t with
    | «лит» z =>
      simp only [«литералН8», decide_eq_true_eq] at h
      exact ⟨«подъём0» (fun w => by
          simp only [«Факт-из», «оценитьФ», «оценить»]; exact decide_eq_true h.1),
        «подъём0» (fun w => by simp [«Факт-из», «оценитьФ», «оценить», «конечно»])⟩
    | _ => simp [«литералН8»] at h
  · simp only [«отрезокН8», Bool.and_eq_true, List.any_eq_true] at h
    obtain ⟨⟨f1, hf1, h1⟩, ⟨f2, hf2, h2⟩⟩ := h
    have m1 := hΓ _ («допущение-любое-в-окружении» u f1 hf1)
    have m2 := hΓ _ («допущение-любое-в-окружении» u f2 hf2)
    constructor
    · split at h1
      · rename_i t' k
        simp only [decide_eq_true_eq] at h1
        obtain ⟨rfl, hk⟩ := h1
        exact «подъём1» (fun w hw => by
          simp only [«Факт-из», «оценитьФ», «оценить»] at hw ⊢
          exact «переходСтрого2» (show «неБольше» («кон» 0) («кон» k) = true from decide_eq_true hk) hw)
          («Т1» _ _ m1)
      · cases h1
    · split at h2
      · rename_i t' k
        simp only [decide_eq_true_eq] at h2
        subst h2
        exact «подъём1» (fun w hw => («факт-кон» _ w).mpr («Кон1» _ k ((«факт-потолок» _ _ w).mp hw)))
          («Т1» _ _ m2)
      · cases h2

theorem «второйН8-верно» {u : «Утверждение»} {x y v : «ТермЧ»} {b : Bool} (h : «второйН8» u x y = some (v, b)) :
    (v = y ∧ («литералН8» x = true ∨ «отрезокН8» u x = true)) ∨
    (v = x ∧ («литералН8» y = true ∨ «отрезокН8» u y = true)) := by
  unfold «второйН8» at h
  split at h
  · cases h; exact Or.inr ⟨rfl, Or.inl ‹_›⟩
  · split at h
    · cases h; exact Or.inl ⟨rfl, Or.inl ‹_›⟩
    · split at h
      · cases h; exact Or.inl ⟨rfl, Or.inr ‹_›⟩
      · split at h
        · cases h; exact Or.inr ⟨rfl, Or.inr ‹_›⟩
        · cases h

theorem «прибавкиО5-верно» {e g e' g' s : «ТермЧ»} (hc : (e', g', s, s) ∈ «прибавкиО5» e g) (w : «Мир») :
    «оценить» e w = «плюс» w.«о» («оценить» e' w) («оценить» s w) ∧
    «оценить» g w = «плюс» w.«о» («оценить» g' w) («оценить» s w) := by
  unfold «прибавкиО5» at hc
  split at hc
  · simp only [List.mem_cons, Prod.mk.injEq, List.not_mem_nil, or_false] at hc
    rcases hc with ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ <;>
      simp only [«оценить»] <;> simp [«плюс-перест»]
  · simp at hc

/-! ## М1: мера прибавления против округлённого «плюс 1» (ADR-0042 §2) -/

/-- За порогом округлённое не ниже порога: «кон m» с m ≥ порог либо +∞ — так
    велит монотонность округления («моно»), а на пороге оно точно («точно»). -/
theorem «за-порогом» («о» : «Округление») (n : Int) (h : «порог» ≤ n) :
    (∃ m, «о».«ф» n = «кон» m ∧ «порог» ≤ m) ∨ «о».«ф» n = «плюсБеск» := by
  have hm := «о».«моно» «порог» n h
  rw [«о».«точно» «порог» (by unfold «порог»; omega) (by omega)] at hm
  cases hx : «о».«ф» n with
  | «плюсБеск» => exact Or.inr rfl
  | «кон» m => exact Or.inl ⟨m, rfl, by rw [hx] at hm; simpa [«неБольше»] using hm⟩
  | _ => rw [hx] at hm; simp [«неБольше», «порог»] at hm

/-- Шесть отношений с литералом меньше порога по модулю: истинное на округлённом
    «n + 1» истинно и на точном — ниже порога они равны, выше — посылка ложна
    либо заключение истинно. -/
theorem «М1-значение» («о» : «Округление») (n : Int) (hn : 0 ≤ n) (k : Int)
    (hk1 : -«порог» < k) (hk2 : k < «порог») :
    («неБольше» («о».«ф» (n + 1)) («кон» k) = true → «неБольше» («кон» (n + 1)) («кон» k) = true) ∧
    («неБольше» («кон» k) («о».«ф» (n + 1)) = true → «неБольше» («кон» k) («кон» (n + 1)) = true) ∧
    («меньше» («о».«ф» (n + 1)) («кон» k) = true → «меньше» («кон» (n + 1)) («кон» k) = true) ∧
    («меньше» («кон» k) («о».«ф» (n + 1)) = true → «меньше» («кон» k) («кон» (n + 1)) = true) ∧
    («равен» («о».«ф» (n + 1)) («кон» k) = true → «равен» («кон» (n + 1)) («кон» k) = true) ∧
    («равен» («кон» k) («о».«ф» (n + 1)) = true → «равен» («кон» k) («кон» (n + 1)) = true) := by
  by_cases h : n + 1 ≤ «порог»
  · rw [«о».«точно» (n + 1) (by unfold «порог» at *; omega) h]
    exact ⟨id, id, id, id, id, id⟩
  · rcases «за-порогом» «о» (n + 1) (by omega) with ⟨m, hx, hm⟩ | hx <;> rw [hx] <;>
      refine ⟨?_, ?_, ?_, ?_, ?_, ?_⟩ <;> intro H <;>
      simp [«неБольше», «меньше», «равен»] at H ⊢ <;> unfold «порог» at * <;> omega

/-- Мера прибавления в модели: «( длина Л ) плюс 1» — округлённое n + 1, мера
    «добавить|приписать Э к Л» — точное n + 1, где n — длина Л. -/
theorem «мера1-значения» {s t : «ТермЧ»} (hm : «мера1» s t = true) (w : «Мир») :
    ∃ n : Int, 0 ≤ n ∧ «оценить» s w = w.«о».«ф» (n + 1) ∧ «оценить» t w = «кон» (n + 1) := by
  unfold «мера1» at hm
  split at hm
  · rename_i l e l'
    have hl : l = l' := of_decide_eq_true hm
    subst hl
    refine ⟨((«оценитьС» l w).length : Int), by omega, ?_, ?_⟩
    · simp [«оценить», «плюс», «чис»]
    · simp [«оценить», «оценитьС»]
  · rename_i l e l'
    have hl : l = l' := of_decide_eq_true hm
    subst hl
    refine ⟨((«оценитьС» l w).length : Int), by omega, ?_, ?_⟩
    · simp [«оценить», «плюс», «чис»]
    · simp [«оценить», «оценитьС»]
  · cases hm

/-- М1 состоятельна: отношение с литералом держится при переписке стороны мерой. -/
theorem «собрать-М1» (r : «ОтнЛит») (s t : «ТермЧ») (k : Int) (hm : «мера1» s t = true)
    (hk1 : -«порог» < k) (hk2 : k < «порог») (w : «Мир»)
    (h : «Факт-из» («собрать» r s k) w) : «Факт-из» («собрать» r t k) w := by
  obtain ⟨n, hn, hs, ht⟩ := «мера1-значения» hm w
  obtain ⟨a1, a2, a3, a4, a5, a6⟩ := «М1-значение» w.«о» n hn k hk1 hk2
  cases r <;> simp only [«собрать», «Факт-из», «оценитьФ», «оценить», «неМеньше», hs, ht] at h ⊢
  all_goals first | exact a1 h | exact a2 h | exact a3 h | exact a4 h | exact a5 h | exact a6 h

/-! ## М2: мера свёртки, растущей на одно звено за виток (ADR-0042 §2) -/

/-- Стороны М2 равны значением: «длина Л» и мера свёртки с пустого начала. -/
theorem «мера2-значение» {x y : «ТермЧ»} (hm : «мера2» x y = true) (w : «Мир») :
    «оценить» x w = «оценить» y w := by
  unfold «мера2» at hm
  split at hm
  · rename_i l l' a e d a'
    obtain ⟨rfl, rfl, hae⟩ := of_decide_eq_true hm
    have hlen := «М2-пустое-начало» (fun acc v => «оценитьС» (.«добавить» d (.«имяС» a)) («обновить» («обновитьС» w a acc) e v))
      (by intro acc v; simp [«оценитьС», hae]) («оценитьС» l w)
    simp only [«оценить»]
    rw [show («оценитьС» (.«свёрткаС» l .«пустой» a e (.«добавить» d (.«имяС» a))) w).length = («оценитьС» l w).length from hlen]
  · rename_i l l' a e d a'
    obtain ⟨rfl, rfl, hae⟩ := of_decide_eq_true hm
    have hlen := «М2-пустое-начало» (fun acc v => «оценитьС» (.«приписать» d (.«имяС» a)) («обновить» («обновитьС» w a acc) e v))
      (by intro acc v; simp [«оценитьС», hae]) («оценитьС» l w)
    simp only [«оценить»]
    rw [show («оценитьС» (.«свёрткаС» l .«пустой» a e (.«приписать» d (.«имяС» a))) w).length = («оценитьС» l w).length from hlen]
  · cases hm

/-- Отношение держится, когда сторону сменили на равную значением. -/
theorem «собрать2-замена» (c : «Отн2») (x y x' y' : «ТермЧ») (w : «Мир»)
    (hx : «оценить» x w = «оценить» x' w) (hy : «оценить» y w = «оценить» y' w)
    (h : «Факт-из» («собрать2» c x y) w) : «Факт-из» («собрать2» c x' y') w := by
  cases c <;> simp only [«собрать2», «Факт-из», «оценитьФ», «неМеньше»] at h ⊢ <;> rw [← hx, ← hy] <;> exact h

/-! ## К↑ и Разв1 для суммы (ADR-0042 §2, задача 6432) -/

/-- Поле, найденное по имени среди выписанных, носит значение своего тела. -/
theorem «полеП?-значение» (p : String) (t : «Тело») (w : «Мир») :
    ∀ (fs : «Поля»), «полеП?» p fs = some t → «найтиПоле» p («оценитьП» fs w) = some («значение» t w)
  | .«нет», h => by simp [«полеП?»] at h
  | .«ещё» q t' r, h => by
      simp only [«полеП?»] at h
      simp only [«оценитьП», «найтиПоле»]
      by_cases hq : q = p
      · simp only [hq, ↓reduceIte] at h ⊢
        cases h; rfl
      · simp only [hq, ↓reduceIte] at h ⊢
        exact «полеП?-значение» p t w r h

/-- Сторона-поле выписанного конструктора равна значением телу поля. -/
theorem «полеСтороны-значение» {x x' : «ТермЧ»} (h : «полеСтороны?» x' = some x) (w : «Мир») :
    «оценить» x' w = «оценить» x w := by
  unfold «полеСтороны?» at h
  split at h
  · rename_i k fs p
    simp only [Option.map_eq_some_iff] at h
    obtain ⟨t, ht, rfl⟩ := h
    simp only [«оценить», «оценитьСм», «полеЗнач», «полеП?-значение» p t w fs ht, Option.getD_some, «числом-верно»]
  · cases h

/-- Ветвь своего варианта: разбор суммы с этим вариантом оценивается ею. -/
theorem «ветвь?-значение» (k : String) (V : List (String × «Значение»)) (w : «Мир») :
    ∀ (cs : «Случаи») (bs : List (String × String)) (b : «Форм»), «ветвь?» k cs = some (bs, b) →
    «оценитьСл» cs (.«сумма» k V) w = «оценитьФ» b («связатьПоля» w bs (.«сумма» k V))
  | .«нет», bs, b, h => by simp [«ветвь?»] at h
  | .«ещё» k' bs' b' r, bs, b, h => by
      simp only [«ветвь?»] at h
      simp only [«оценитьСл», «вариантЗнач», Option.some.injEq]
      by_cases hk : k' = k
      · subst hk
        simp only [↓reduceIte] at h ⊢
        cases h; rfl
      · have hk' : ¬ k = k' := fun e => hk e.symm
        simp only [hk, hk', ↓reduceIte] at h ⊢
        exact «ветвь?-значение» k V w r bs b h

/-- Поля на местах имён ветви — те же связывания, что пары (имя, тело поля). -/
theorem «поляИмён-мир» (k : String) (fs : «Поля») (w : «Мир») :
    ∀ (bs : List (String × String)) (ps : List (String × «Тело»)), «поляИмён» fs bs = some ps →
    «связатьПоля» w bs (.«сумма» k («оценитьП» fs w)) = ps.foldr (fun q w' => «связать» w' q.1 («значение» q.2 w)) w
  | [], ps, h => by
      simp only [«поляИмён», Option.some.injEq] at h
      subst h; rfl
  | b :: r, ps, h => by
      simp only [«поляИмён»] at h
      split at h
      · rename_i t rest ht hr
        simp only [Option.some.injEq] at h
        subst h
        have ih := «поляИмён-мир» k fs w r rest hr
        simp only [«связатьПоля», List.foldr_cons] at ih ⊢
        rw [ih]
        simp only [«полеЗнач», «полеП?-значение» b.1 t w fs ht, Option.getD_some]
      · cases h

/-- Связывание имён, не свободных в теле, его значения не меняет. -/
theorem «значение-под-чужими» (t : «Тело») (w : «Мир») (vals : String × «Тело» → «Значение») :
    ∀ (r : List (String × «Тело»)), (∀ q ∈ r, q.1 ∉ «свободныеТело» t) →
    «значение» t (r.foldr (fun q w' => «связать» w' q.1 (vals q)) w) = «значение» t w
  | [], _ => rfl
  | q :: r, h => by
      simp only [List.foldr_cons]
      rw [«чужое-имяТело» t _ q.1 _ (h q List.mem_cons_self)]
      exact «значение-под-чужими» t w vals r (fun q' hq' => h q' (List.mem_cons_of_mem _ hq'))

/-- Цепь подстановок пар по порядку — формула в мире, где имена пар носят значения
    своих тел (первая пара заслоняет прочие). -/
theorem «подстПар-значение» (w : «Мир») : ∀ (b : «Форм») (ps : List (String × «Тело»)), «цепьЧиста» b ps = true →
    «оценитьФ» («подстПар» b ps) w = «оценитьФ» b (ps.foldr (fun q w' => «связать» w' q.1 («значение» q.2 w)) w)
  | b, [], _ => rfl
  | b, q :: r, h => by
      simp only [«цепьЧиста», Bool.and_eq_true, Bool.not_eq_true', List.all_eq_true] at h
      obtain ⟨⟨hz, hall⟩, hr⟩ := h
      simp only [«подстПар», List.foldr_cons]
      rw [«подстПар-значение» w _ r hr, «подстановкаФ» b q.1 q.2 _ («захват?-чисто» hz)]
      simp only [«мир-с»]
      rw [«значение-под-чужими» q.2 w (fun q' => «значение» q'.2 w) r (fun q' hq' hfree => by
        have h1 := hall q' hq'
        have h2 : («свободныеТело» q.2).contains q'.1 = true := by simpa using hfree
        first | (rw [h1] at h2; cases h2) | simp_all)]

/-! ## Разв3: развёртка вызова (ADR-0042 §2, задача 6432) -/

theorem «попаданиеЧ» {H : «Тело» → «Тело» → Bool} {w : «Мир»}
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) {a b : «ТермЧ»}
    (h : H (.«число» a) (.«число» b) = true) : «оценить» a w = «оценить» b w := by
  have e := HH _ _ h
  simp only [«значение»] at e
  first | exact «Значение».«число».inj e | exact e
theorem «попаданиеС» {H : «Тело» → «Тело» → Bool} {w : «Мир»}
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) {a b : «ТермС»}
    (h : H (.«список» a) (.«список» b) = true) : «оценитьС» a w = «оценитьС» b w := by
  have e := HH _ _ h
  simp only [«значение»] at e
  first | exact «Значение».«список».inj e | exact e
theorem «попаданиеТ» {H : «Тело» → «Тело» → Bool} {w : «Мир»}
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) {a b : «ТермТ»}
    (h : H (.«текст» a) (.«текст» b) = true) : «оценитьТ» a w = «оценитьТ» b w := by
  have e := HH _ _ h
  simp only [«значение»] at e
  first | exact «Значение».«текст».inj e | exact e
theorem «попаданиеФ» {H : «Тело» → «Тело» → Bool} {w : «Мир»}
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) {a b : «Форм»}
    (h : H (.«признак» a) (.«признак» b) = true) : «оценитьФ» a w = «оценитьФ» b w := by
  have e := HH _ _ h
  simp only [«значение»] at e
  first | exact «Значение».«признак».inj e | exact e
theorem «попаданиеСм» {H : «Тело» → «Тело» → Bool} {w : «Мир»}
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) {a b : «ТермСм»}
    (h : H (.«сумма» a) (.«сумма» b) = true) : «оценитьСм» a w = «оценитьСм» b w := by
  have e := HH _ _ h
  simp only [«значение»] at e
  exact e

mutual
theorem «замЧ-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «ТермЧ»), «замЧ» H a b = true → «оценить» a w = «оценить» b w
  | .«лит» x1, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«имя» x1, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«плюс» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценить»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«минус» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценить»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«умножить» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценить»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«остаток» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценить»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«если» x1 x2 x3, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2 y3
        obtain ⟨⟨h1, h2⟩, h3⟩ := hs
        simp only [«оценить»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2, «замЧ-верно» H w HH x3 y3 h3]
  | .«длина» x1, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценить»]
        rw [«замС-верно» H w HH x1 y1 h1]
  | .«кодСимвола» x1, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценить»]
        rw [«замТ-верно» H w HH x1 y1 h1]
  | .«свёртка» x1 x2 x3 x4 x5, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«разбор» x1 x2 x3 x4 x5, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«вызов» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«оценить»]
        rw [«замД-верно» H w HH x2 y2 h2]
  | .«поле» x1 x2, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h2
        simp only [«оценить»]
        rw [«замСм-верно» H w HH x1 y1 h1]
  | .«ярлык» x1, b, h => by
      unfold «замЧ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеЧ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
theorem «замС-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «ТермС»), «замС» H a b = true → «оценитьС» a w = «оценитьС» b w
  | .«пустой», b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«имяС» x1, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«выписан» x1, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьС»]
        rw [«замЧл-верно» H w HH x1 y1 h1]
  | .«приписать» x1 x2, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьС»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замС-верно» H w HH x2 y2 h2]
  | .«добавить» x1 x2, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьС»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замС-верно» H w HH x2 y2 h2]
  | .«отбор» x1 x2 x3, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«отобразить» x1 x2 x3, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«еслиС» x1 x2 x3, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2 y3
        obtain ⟨⟨h1, h2⟩, h3⟩ := hs
        simp only [«оценитьС»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замС-верно» H w HH x2 y2 h2, «замС-верно» H w HH x3 y3 h3]
  | .«свёрткаС» x1 x2 x3 x4 x5, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«вызовС» x1 x2, b, h => by
      unfold «замС» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеС» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«оценитьС»]
        rw [«замД-верно» H w HH x2 y2 h2]
theorem «замТ-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «ТермТ»), «замТ» H a b = true → «оценитьТ» a w = «оценитьТ» b w
  | .«литТ» x1, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«имяТ» x1, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«склейка» x1 x2, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьТ»]
        rw [«замТ-верно» H w HH x1 y1 h1, «замТ-верно» H w HH x2 y2 h2]
  | .«еслиТ» x1 x2 x3, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2 y3
        obtain ⟨⟨h1, h2⟩, h3⟩ := hs
        simp only [«оценитьТ»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замТ-верно» H w HH x2 y2 h2, «замТ-верно» H w HH x3 y3 h3]
  | .«вызовТ» x1 x2, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«оценитьТ»]
        rw [«замД-верно» H w HH x2 y2 h2]
  | .«кСтроке» x1, b, h => by
      unfold «замТ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеТ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
theorem «замФ-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «Форм»), «замФ» H a b = true → «оценитьФ» a w = «оценитьФ» b w
  | .«да», b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«нет», b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«имяФ» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«неБольше» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«неМеньше» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«меньше» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«больше» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«равен» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«равенС» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замС-верно» H w HH x1 y1 h1, «замС-верно» H w HH x2 y2 h2]
  | .«равенТ» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замТ-верно» H w HH x1 y1 h1, «замТ-верно» H w HH x2 y2 h2]
  | .«содержит» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замС-верно» H w HH x1 y1 h1, «замЧ-верно» H w HH x2 y2 h2]
  | .«неУбывает» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замС-верно» H w HH x1 y1 h1]
  | .«пусто» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замС-верно» H w HH x1 y1 h1]
  | .«пустоТ» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замТ-верно» H w HH x1 y1 h1]
  | .«начинается» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замТ-верно» H w HH x1 y1 h1, «замТ-верно» H w HH x2 y2 h2]
  | .«кон» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1]
  | .«цел» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1]
  | .«помещается» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замЧ-верно» H w HH x1 y1 h1]
  | .«всех» x1 x2 x3, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«есть» x1 x2 x3, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«и» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замФ-верно» H w HH x2 y2 h2]
  | .«или» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьФ»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замФ-верно» H w HH x2 y2 h2]
  | .«не» x1, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«оценитьФ»]
        rw [«замФ-верно» H w HH x1 y1 h1]
  | .«еслиФ» x1 x2 x3, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2 y3
        obtain ⟨⟨h1, h2⟩, h3⟩ := hs
        simp only [«оценитьФ»]
        rw [«замФ-верно» H w HH x1 y1 h1, «замФ-верно» H w HH x2 y2 h2, «замФ-верно» H w HH x3 y3 h3]
  | .«вызовФ» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«оценитьФ»]
        rw [«замД-верно» H w HH x2 y2 h2]
  | .«разборСм» x1 x2, b, h => by
      unfold «замФ» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеФ» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
theorem «замТело-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «Тело»), «замТело» H a b = true → «значение» a w = «значение» b w
  | .«число» x1, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«значение»]
        rw [«замЧ-верно» H w HH x1 y1 h1]
  | .«список» x1, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«значение»]
        rw [«замС-верно» H w HH x1 y1 h1]
  | .«текст» x1, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«значение»]
        rw [«замТ-верно» H w HH x1 y1 h1]
  | .«признак» x1, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«значение»]
        rw [«замФ-верно» H w HH x1 y1 h1]
  | .«сумма» x1, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1
        have h1 := hs
        simp only [«значение»]
        rw [«замСм-верно» H w HH x1 y1 h1]
  | .«вызов» x1 x2, b, h => by
      unfold «замТело» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact HH _ _ hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«значение»]
        rw [«замД-верно» H w HH x2 y2 h2]
theorem «замД-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «Доводы»), «замД» H a b = true → «оценитьД» a w = «оценитьД» b w
  | .«нет», b, h => by
      unfold «замД» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with he | hs
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«ещё» x1 x2, b, h => by
      unfold «замД» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with he | hs
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьД»]
        rw [«замТело-верно» H w HH x1 y1 h1, «замД-верно» H w HH x2 y2 h2]
theorem «замЧл-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «Члены»), «замЧл» H a b = true → «оценитьЧл» a w = «оценитьЧл» b w
  | .«нет», b, h => by
      unfold «замЧл» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with he | hs
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«ещё» x1 x2, b, h => by
      unfold «замЧл» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with he | hs
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        simp only [«оценитьЧл»]
        rw [«замЧ-верно» H w HH x1 y1 h1, «замЧл-верно» H w HH x2 y2 h2]
theorem «замСм-верно» (H : «Тело» → «Тело» → Bool) (w : «Мир»)
    (HH : ∀ A B, H A B = true → «значение» A w = «значение» B w) :
    ∀ (a b : «ТермСм»), «замСм» H a b = true → «оценитьСм» a w = «оценитьСм» b w
  | .«вариант» x1 x2, b, h => by
      unfold «замСм» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеСм» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«имяСм» x1, b, h => by
      unfold «замСм» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеСм» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
  | .«вызовСм» x1 x2, b, h => by
      unfold «замСм» at h
      simp only [Bool.or_eq_true, decide_eq_true_eq] at h
      rcases h with (hH | he) | hs
      · exact «попаданиеСм» HH hH
      · subst he; rfl
      · cases b <;> simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.false_eq_true] at hs
        rename_i y1 y2
        obtain ⟨h1, h2⟩ := hs
        subst h1
        simp only [«оценитьСм»]
        rw [«замД-верно» H w HH x2 y2 h2]
end


theorem «оценитьД-списком» (w : «Мир») :
    ∀ (ds : «Доводы»), «оценитьД» ds w = («доводыСписком» ds).map (fun t => «значение» t w)
  | .«нет» => rfl
  | .«ещё» t r => by
      simp only [«оценитьД», «доводыСписком», List.map_cons]
      rw [«оценитьД-списком» w r]

theorem «связатьВсе-пары» (w : «Мир») (g : «Тело» → «Значение») :
    ∀ (ps : List String) (dl : List «Тело»),
    «связатьВсе» w ps (dl.map g) = (ps.zip dl).foldr (fun q w' => «связать» w' q.1 (g q.2)) w
  | [], _ => by simp [«связатьВсе»]
  | _ :: _, [] => by simp [«связатьВсе»]
  | x :: ps, t :: dl => by
      have ih := «связатьВсе-пары» w g ps dl
      simp only [«связатьВсе», List.map_cons, List.zip_cons_cons, List.foldr_cons] at ih ⊢
      rw [ih]

theorem «подстПарТ-значение» (w : «Мир») : ∀ (b : «Тело») (ps : List (String × «Тело»)), «цепьЧистаТ» b ps = true →
    «значение» («подстПарТ» b ps) w = «значение» b (ps.foldr (fun q w' => «связать» w' q.1 («значение» q.2 w)) w)
  | b, [], _ => rfl
  | b, q :: r, h => by
      simp only [«цепьЧистаТ», Bool.and_eq_true, Bool.not_eq_true', List.all_eq_true] at h
      obtain ⟨⟨hz, hall⟩, hr⟩ := h
      simp only [«подстПарТ», List.foldr_cons]
      rw [«подстПарТ-значение» w _ r hr, «подстановкаТело» b q.1 q.2 _ («захват?-чисто» hz)]
      simp only [«мир-с»]
      rw [«значение-под-чужими» q.2 w (fun q' => «значение» q'.2 w) r (fun q' hq' hfree => by
        have h1 := hall q' hq'
        have h2 : («свободныеТело» q.2).contains q'.1 = true := by simpa using hfree
        first | (rw [h1] at h2; cases h2) | simp_all)]

/-! ### Одновременная подстановка доводов (задача 2844)

Приёмка ставит доводы на места параметров РАЗОМ: параметры → свежие метки,
метки → доводы (`«подстРазом»`). Лемма значения для неё — `«подстРазом-значение»`
ниже; она и стоит под Разв3 вместо `«подстПарТ-значение»`. Свежесть меток не
предполагается: её проверяет `«меткиСвежи?»`, и из этой проверки здесь берутся
все нужные факты. Согласие двух миров — первого прохода над вторым и
одновременного связывания — снимает `«согласиеТело»`. -/

/-- Мир, собранный связыванием пар, на чужом имени — исходный. -/
theorem «фолд-чужое» (w : «Мир») (g : String × «Тело» → «Значение») :
    ∀ (l : List (String × «Тело»)) (y : String), y ∉ l.map (·.1) →
    (l.foldr (fun q v => «связать» v q.1 (g q)) w).«имя» y = w.«имя» y
  | [], _, _ => rfl
  | q :: r, y, h => by
      simp only [List.map_cons, List.mem_cons, not_or] at h
      simp only [List.foldr_cons, «связать-имя», h.1, ↓reduceIte]
      exact «фолд-чужое» w g r y h.2

/-- Мир, собранный связыванием пар с попарно различными именами: каждое имя
    носит значение своей пары. -/
theorem «фолд-своё» (w : «Мир») (g : String × «Тело» → «Значение») :
    ∀ (l : List (String × «Тело»)), (l.map (·.1)).Nodup → ∀ p ∈ l,
    (l.foldr (fun q v => «связать» v q.1 (g q)) w).«имя» p.1 = g p
  | [], _, _, hp => absurd hp (by simp)
  | q :: r, hn, p, hp => by
      simp only [List.map_cons, List.nodup_cons] at hn
      rcases List.mem_cons.1 hp with rfl | hp'
      · simp
      · have hne : p.1 ≠ q.1 := fun he => hn.1 (List.mem_map.2 ⟨p, hp', he⟩)
        simp only [List.foldr_cons, «связать-имя», hne, ↓reduceIte]
        exact «фолд-своё» w g r hn.2 p hp'

/-- Округление и стрелки вызовов связывание пар не трогает. -/
theorem «фолд-о» (w : «Мир») (g : String × «Тело» → «Значение») :
    ∀ (l : List (String × «Тело»)), (l.foldr (fun q v => «связать» v q.1 (g q)) w).«о» = w.«о»
  | [] => rfl
  | _ :: r => «фолд-о» w g r

theorem «фолд-функции» (w : «Мир») (g : String × «Тело» → «Значение») :
    ∀ (l : List (String × «Тело»)),
    (l.foldr (fun q v => «связать» v q.1 (g q)) w).«функции» = w.«функции»
  | [] => rfl
  | _ :: r => «фолд-функции» w g r

/-- Имена пар второго прохода — это и есть метки. -/
theorem «парыДоводов-имена» : ∀ (ps : List (String × «Тело»)) (ms : List String),
    ms.length = ps.length → («парыДоводов» ps ms).map (·.1) = ms
  | [], [], _ => rfl
  | [], _ :: _, hl => by simp at hl
  | _ :: _, [], hl => by simp at hl
  | q :: r, m :: ms, hl => by
      simp only [«парыДоводов», List.map_cons]
      rw [«парыДоводов-имена» r ms (by simpa using hl)]

/-- Заместитель в мире, где его метка носит значение довода, значит ровно то же,
    что довод в исходном мире. Сорт заместителя — сорт довода, и потому на всяком
    месте оба читаются одинаково. -/
theorem «заместитель-значение» (w W : «Мир») (m : String) (a : «Тело»)
    (hok : W.«о» = w.«о») (hfn : W.«функции» = w.«функции»)
    (hm : W.«имя» m = «значение» a w)
    (hy : ∀ y ∈ «свободныеТело» a, W.«имя» y = w.«имя» y) :
    «значение» («заместитель» m a) W = «значение» a w := by
  cases a with
  | «число» t => simp only [«заместитель», «значение», «оценить», hm, «какЧисло»]
  | «список» l => simp only [«заместитель», «значение», «оценитьС», hm, «какСписок»]
  | «текст» t => simp only [«заместитель», «значение», «оценитьТ», hm, «какТекст»]
  | «признак» u => simp only [«заместитель», «значение», «оценитьФ», hm, «какПризнак»]
  | «сумма» c => simp only [«заместитель», «значение», «оценитьСм», hm, «какСумма-оценитьСм»]
  | «вызов» f d => exact «согласиеТело» _ W w ⟨hok, hfn, hy⟩

/-- Мир первого прохода, поставленный над миром второго, согласен с миром
    одновременного связывания на всяком имени, которое второй проход не трогает. -/
theorem «миры-разом» (w W : «Мир») (hok : W.«о» = w.«о») (hfn : W.«функции» = w.«функции») :
    ∀ (ps : List (String × «Тело»)) (ms : List String), ms.length = ps.length →
      (∀ p ∈ «парыДоводов» ps ms, W.«имя» p.1 = «значение» p.2 w) →
      (∀ q ∈ ps, ∀ y ∈ «свободныеТело» q.2, W.«имя» y = w.«имя» y) →
      ∀ y, W.«имя» y = w.«имя» y →
        ((«парыМеток» ps ms).foldr (fun q v => «связать» v q.1 («значение» q.2 W)) W).«имя» y
          = (ps.foldr (fun q v => «связать» v q.1 («значение» q.2 w)) w).«имя» y
  | [], _, _, _, _, _, hy => hy
  | _ :: _, [], hl, _, _, _, _ => by simp at hl
  | q :: r, m :: ms, hl, hd, ha, y, hy => by
      simp only [«парыМеток», List.foldr_cons, «связать-имя»]
      by_cases hq : y = q.1
      · simp only [hq, ↓reduceIte]
        exact «заместитель-значение» w W m q.2 hok hfn
          (hd (m, q.2) (by simp [«парыДоводов»])) (ha q (by simp))
      · simp only [hq, ↓reduceIte]
        exact «миры-разом» w W hok hfn r ms (by simpa using hl)
          (fun p hp => hd p (by simp [«парыДоводов», hp]))
          (fun q' hq' => ha q' (by simp [hq'])) y hy

/-- ОДНОВРЕМЕННАЯ ПОДСТАНОВКА: доводы, вставшие на места параметров разом, значат
    то же, что тело в мире, где ВСЕ параметры носят значения своих доводов,
    снятые в исходном мире. Порядок пар ни на что не влияет — в этом всё отличие
    от `«подстПарТ-значение»`, которой хватало лишь чистой цепи. -/
theorem «подстРазом-значение» (w : «Мир») (b : «Тело») (ps : List (String × «Тело»))
    (ms : List String) (h : «разомЧисто?» b ps ms = true) :
    «значение» («подстРазом» b ps ms) w
      = «значение» b (ps.foldr (fun q w' => «связать» w' q.1 («значение» q.2 w)) w) := by
  rw [«разомЧисто?», Bool.and_eq_true, Bool.and_eq_true] at h
  obtain ⟨⟨hS, hM⟩, hA⟩ := h
  rw [«меткиСвежи?», Bool.and_eq_true, Bool.and_eq_true] at hS
  obtain ⟨⟨hlenD, hnodD⟩, hall⟩ := hS
  have hlen : ms.length = ps.length := of_decide_eq_true hlenD
  have hnod : ms.Nodup := of_decide_eq_true hnodD
  have hfr : ∀ m ∈ ms, m ∉ «свободныеТело» b ∧ ∀ q ∈ ps, m ∉ «свободныеТело» q.2 := by
    intro m hm
    have hx := List.all_eq_true.1 hall m hm
    simp only [Bool.and_eq_true, Bool.not_eq_true', List.contains_eq_mem,
      decide_eq_false_iff_not, List.all_eq_true, beq_eq_false_iff_ne, ne_eq] at hx
    exact ⟨hx.1.1, fun q hq => (hx.2 q hq).2⟩
  have hnm := «парыДоводов-имена» ps ms hlen
  have hoth : ∀ y, y ∉ ms →
      ((«парыДоводов» ps ms).foldr (fun q v => «связать» v q.1 («значение» q.2 w)) w).«имя» y
        = w.«имя» y := fun y hy => «фолд-чужое» w _ _ y (by rw [hnm]; exact hy)
  have hown : ∀ p ∈ «парыДоводов» ps ms,
      ((«парыДоводов» ps ms).foldr (fun q v => «связать» v q.1 («значение» q.2 w)) w).«имя» p.1
        = «значение» p.2 w := «фолд-своё» w _ _ (by rw [hnm]; exact hnod)
  rw [«подстРазом», «подстПарТ-значение» w _ («парыДоводов» ps ms) hA,
    «подстПарТ-значение» _ b («парыМеток» ps ms) hM]
  refine «согласиеТело» b _ _ ⟨?_, ?_, fun y hy => ?_⟩
  · rw [«фолд-о», «фолд-о», «фолд-о»]
  · rw [«фолд-функции», «фолд-функции», «фолд-функции»]
  · exact «миры-разом» w _ («фолд-о» w _ _) («фолд-функции» w _ _) ps ms hlen hown
      (fun q hq y' hy' => hoth y' (fun hy'm => ((hfr y' hy'm).2 q hq) hy')) y
      (hoth y (fun hym => (hfr y hym).1 hy))

/-- Тело «Разности»: «а минус б». -/
def «тело-разности» : «Тело» := .«число» (.«минус» (.«имя» "а") (.«имя» "б"))

/-- Пары «параметр — довод» вызова «Разность» от б и а: параметр каждой пары
    стоит доводом другой — здесь порядок и решает. -/
def «пары-обмена» : List (String × «Тело») :=
  [("а", .«число» (.«имя» "б")), ("б", .«число» (.«имя» "а"))]

/-- ПАМЯТЬ О ЛОВУШКЕ 57 (опора `razv3-kontrol-chestnaya`, аудит 2844): там, где
    решает порядок, цепь «подстПарТ» не равна одновременной подстановке — ни
    термом, ни значением. Условия одновременной подстановки при этом выполнены
    («разомЧисто?» — да), то есть проверкой одно от другого не отличить: вызов
    «Разность» от б и а при теле «а минус б» разом даёт «б минус а» (при а = 0,
    б = 1 это 1), а по одному — «а минус а» (это 0). -/
theorem «Разв3-по-одному-не-разом» :
    «разомЧисто?» «тело-разности» «пары-обмена» («меткиДоводов» 2) = true ∧
    «подстРазом» «тело-разности» «пары-обмена» («меткиДоводов» 2)
      = .«число» (.«минус» (.«имя» "б") (.«имя» "а")) ∧
    «подстПарТ» «тело-разности» «пары-обмена»
      = .«число» (.«минус» (.«имя» "а") (.«имя» "а")) ∧
    «какЧисло» («значение» (.«число» (.«минус» (.«имя» "б") (.«имя» "а"))) «мир-а0-б1») = «кон» 1 ∧
    «какЧисло» («значение» (.«число» (.«минус» (.«имя» "а") (.«имя» "а"))) «мир-а0-б1») = «кон» 0 := by
  refine ⟨?_, ?_, ?_, ?_, ?_⟩
  · simp [«тело-разности», «пары-обмена», «разомЧисто?», «меткиСвежи?», «цепьЧистаТ»,
      «парыМеток», «парыДоводов», «меткиДоводов», «меткаДовода», «заместитель», «подстПарТ»,
      «подстТело», «подст», «захват?», «свободныеТело», «свободные», «связанныеТело»,
      «связанные», «метка», «зовётся», «Тело».«числом», «голое», «ярлыкЗова?»]
  · simp [«тело-разности», «пары-обмена», «подстРазом», «подстПарТ», «парыМеток», «парыДоводов»,
      «меткиДоводов», «меткаДовода», «заместитель», «подстТело», «подст», «Тело».«числом»]
  · simp [«тело-разности», «пары-обмена», «подстПарТ», «подстТело», «подст», «Тело».«числом»]
  all_goals
    simp [«значение», «оценить», «мир-а0-б1», «мир-встречный», «связать», «какЧисло»,
      «минус», «плюс», «отр», «чис», «Грубо», «окрГрубо», «порог»]

/-- Вызов функции, равной своему телу, есть тело с доводами на местах параметров. -/
theorem «развёртка?-значение» (d : «Определение») (w : «Мир») (hd : «определение-есть» d w)
    {f : String} {ds : «Доводы»} {R : «Тело»} (h : «развёртка?» d f ds = some R) :
    w.«функции» («вызываемая» w f) («оценитьД» ds w) = «значение» R w := by
  unfold «развёртка?» at h
  split at h
  · rename_i hc
    obtain ⟨rfl, hob, hlen, hch⟩ := hc
    cases h
    rw [«вызываемая-объявленная» w hob, «оценитьД-списком», hd ((«доводыСписком» ds).map (fun t => «значение» t w)) (by simp [hlen]),
      «связатьВсе-пары», «подстРазом-значение» w _ _ _ hch]
  · cases h

/-- Узел-вызов равен значением своему итогу, прочитанному сортом узла. -/
theorem «вызовТела?-значение» {A : «Тело»} {f : String} {ds : «Доводы»} {R : «Тело»} {w : «Мир»}
    (h : «вызовТела?» A = some (f, ds)) (hv : w.«функции» («вызываемая» w f) («оценитьД» ds w) = «значение» R w) :
    «значение» A w = «значение» («сортом» A R) w := by
  unfold «вызовТела?» at h
  split at h <;> (try cases h)
  all_goals simp only [«сортом», «значение», «оценить», «оценитьС», «оценитьТ», «оценитьФ», «оценитьСм»]
  · rw [«числом-верно», hv]
  · rw [«списком-верно», hv]
  · rw [«текстом-верно», hv]
  · rw [«признаком-верно», hv]
  · rw [«суммой-верно», hv]
  · exact hv

/-- Замена, которую велит «развёрнут?», сохраняет значение — при факте «функция
    равна своему телу». -/
theorem «развёрнут?-верно» (d : «Определение») (w : «Мир») (hd : «определение-есть» d w) :
    ∀ A B, «развёрнут?» d A B = true → «значение» A w = «значение» B w := by
  intro A B h
  unfold «развёрнут?» at h
  split at h
  · rename_i f ds hA
    split at h
    · rename_i R hR
      simp only [decide_eq_true_eq] at h
      subst h
      exact «вызовТела?-значение» hA («развёртка?-значение» d w hd hR)
    · cases h
  · cases h

/-! ## Инвариант блока и случай на правило -/

/-- Каждый принятый шаг выводится из своих открытых гипотез и окружения. -/
def «Инв» (u : «Утверждение») («преж» : List «Принятый») : Prop :=
  ∀ p ∈ «преж», «Судим» («гип» p.«откр» ++ «окружение» u) («Факт-из» p.«формула»)

theorem «шаг-верен» (u : «Утверждение») («преж» : List «Принятый») («ш» : «Шаг») (p : «Принятый»)
    (h : «ШагПринят» u «преж» «ш» p) (hinv : «Инв» u «преж») :
    «Судим» («гип» p.«откр» ++ «окружение» u) («Факт-из» p.«формула») := by
  cases h with
  | «Т1» n ho hp hd hs =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    exact «Т1-терм» _ _ («допущение-в-окружении» u n _ hd)
  | «Кон1» n t k ho hp hf hd =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Кон1-терм» _ t k («допущение-в-окружении» u n _ hd)
  | «Кон3» n q t ho hp h1 hf hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Кон3-терм» _ t (hp1 ▸ hinv q («шагПо-в» h1))
  | «Цел1» n q t m ho hp h1 hf hm hp1 =>
    simp only [«итог»]
    rw [hf]
    have hq := hinv q («шагПо-в» h1)
    rcases hp1 with hp1 | hp1
    · exact «Цел1-терм» _ t m hm (Or.inl (hp1 ▸ hq))
    · exact «Цел1-терм» _ t m hm (Or.inr (hp1 ▸ hq))
  | «Цел2» n x d ho hp hf hd ht hob =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    obtain ⟨o, hom, hox, hof, hon⟩ := hob
    have := «обязательство-в-окружении» u o hom
    rw [hof] at this
    exact «Цел2-терм» _ _ this
  | «Св1» n q m t b ho hp h1 hf hz hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Св1-терм» _ m t b («захват?-чисто» hz) (hp1 ▸ hinv q («шагПо-в» h1))
  | «Или1» n q l r ho hp h1 hf hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Или1-терм» _ l r (hp1 ▸ hinv q («шагПо-в» h1))
  | «Или2» n q l r ho hp h1 hf hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Или2-терм» _ l r (hp1 ▸ hinv q («шагПо-в» h1))
  | «И1» n q l r ho hp h1 hp1 hf =>
    simp only [«итог»]
    rw [hf]; exact «И1-терм» _ l r (hp1 ▸ hinv q («шагПо-в» h1))
  | «И2» n q l r ho hp h1 hp1 hf =>
    simp only [«итог»]
    rw [hf]; exact «И2-терм» _ l r (hp1 ▸ hinv q («шагПо-в» h1))
  | «ГипО» ho hp =>
    simp only [«итог», «гип», List.map_cons, List.map_nil, List.singleton_append]
    exact «ГипО» _ _
  | «ГипД» n l r ho hp hd hf =>
    simp only [«гип», List.map_cons, List.map_nil, List.singleton_append]
    have hΓ : «Судим» («окружение» u) (fun w => «Факт-из» l w ∨ «Факт-из» r w) :=
      «подъём1» (fun w => «или-разбор» l r w) («Т1» _ _ («допущение-в-окружении» u n _ hd))
    exact «ГипД» _ _ _ _ hΓ (hf.imp (congrArg «Факт-из») (congrArg «Факт-из»))
  | «Р1» hn m ph pm c q ho hp hh hm hg hf hc hq hotkr =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    have h1 : «Судим» («Факт-из» c :: «окружение» u) («Факт-из» q) :=
      «одна-гипотеза» (fun p hp => (hotkr p hp).2) (hq ▸ hinv pm («шагПо-в» hm))
    exact «подъём1» (fun w => «если-да» c q w) («Р1» _ _ _ h1)
  | «Р4» m1 m2 p1 p2 pa pb a b n l r ho hp h1 h2 hf1 hf2 ha hb hab hpa hpb hga hgb hstr hstr' hfa hfb hd hpol =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    have hA : «Судим» («Факт-из» a.2 :: «окружение» u) («Факт-из» «ш».«формула») :=
      «одна-гипотеза» («единственная-все» ha).2 (hf1 ▸ hinv p1 («шагПо-в» h1))
    have hB : «Судим» («Факт-из» b.2 :: «окружение» u) («Факт-из» «ш».«формула») :=
      «одна-гипотеза» («единственная-все» hb).2 (hf2 ▸ hinv p2 («шагПо-в» h2))
    have hor : «Факт-из» (.«или» l r) ∈ «окружение» u := «допущение-в-окружении» u n _ hd
    have hΓ : «Судим» («окружение» u) (fun w => «Факт-из» l w ∨ «Факт-из» r w) :=
      «подъём1» (fun w => «или-разбор» l r w) («Т1» _ _ hor)
    rw [hfa, hfb] at *
    rcases hpol with ⟨hl, hr⟩ | ⟨hr, hl⟩
    · rw [hl] at hA; rw [hr] at hB
      exact «сечение» hΓ («Р4» _ _ _ _ hA hB)
    · rw [hr] at hA; rw [hl] at hB
      exact «сечение» hΓ («Р4» _ _ _ _ hB hA)
  | «Н1» k ho hp hf hk =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Н1-терм» _ k hk
  | «Н2» n t ho hp hf hd =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Н2-терм» _ t («допущение-в-окружении» u n _ hd)
  | «Н3» n x d ho hp hf hd hdno =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Н3-терм» _ _ («дно-в-окружении» u n x d hd hdno)
  | «Н4» l ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Н4-терм» _ l
  | «Н5» n m p1 p2 l r ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Н5-терм» _ l r («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1))) («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Н9» n q t ho hp h1 hf hp1 hkon =>
    simp only [«итог»]
    rw [hf]; exact «Н9-терм» _ t (hp1 ▸ hinv q («шагПо-в» h1))
  | «Н12» n m p1 p2 l r k ho hp h1 h2 hf hp1 hp2 hpor =>
    simp only [«итог»]
    rw [hf]
    have hpor' : «Факт-из» (.«неБольше» r l) ∈ «гип» (p1.«откр» ++ p2.«откр») ++ «окружение» u := by
      apply List.mem_append_right
      rcases hpor with hpor | hpor
      · exact «допущение-любое-в-окружении» u _ hpor
      · rw [← «зеркало»]; exact «допущение-любое-в-окружении» u _ hpor
    exact «Н12-терм» _ l r k («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2))) hpor'
  | «Пред1» n x d ho hp hf hd ht hob =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    obtain ⟨o, hom, hox, hof, hon⟩ := hob
    have := «обязательство-в-окружении» u o hom
    rw [hof] at this
    exact «Пред1-терм» _ _ this
  | «П1» a k ho hp hf hk =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «П1-терм» _ a k hk
  | «П2-строка» n t k k2 ho hp hf hd hk =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    rcases hd with hd | hd
    · exact «П2-терм» _ t k2 k hk («допущение-в-окружении» u n _ hd)
    · exact «П2-равен-терм» _ t k2 k hk («Т1» _ _ («допущение-в-окружении» u n _ hd))
  | «П2-шаг» n q t k k2 ho hp h1 hf hp1 hk =>
    simp only [«итог»]
    rw [hf]
    rcases hp1 with hp1 | hp1
    · exact «подъём1» (fun w hw => («факт-потолок» _ _ w).mpr
        («П2» _ k2 k ((«факт-потолок» _ _ w).mp hw) hk)) (hp1 ▸ hinv q («шагПо-в» h1))
    · exact «П2-равен-терм» _ t k2 k hk (hp1 ▸ hinv q («шагПо-в» h1))
  | «П3» n q x k ho hp h1 hf hpred hp1 hk =>
    simp only [«итог»]
    rw [hf]; exact «П3-терм» _ _ k hk (hp1 ▸ hinv q («шагПо-в» h1))
  | «П5» n m p1 p2 l r k ho hp h1 h2 hf hp1 hp2 hk1 hk2 =>
    simp only [«итог»]
    rw [hf]
    exact «П5-терм» _ l r k hk1 hk2 («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Э1» e b ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Э1-терм» _ e b
  | «Э2» e x l u2 b ho hp hf hz he hb =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf, hb]
    exact «Э2-терм» _ e x l u2 («захват?-чисто» hz) he
  | «Э3-приписать» n m p1 p2 e d l b ho hp h1 h2 hf hz hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Э3-приписать-терм» _ e d l b («захват?-чисто» hz)
      («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1))) («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Э3-добавить» n m p1 p2 e d l b ho hp h1 h2 hf hz hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Э3-добавить-терм» _ e d l b («захват?-чисто» hz)
      («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1))) («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Э4» n m p1 p2 e c a b q ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Э4-терм» _ e c a b q
      («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1))) («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Т2» n a e l b ho hp hd hf hz he =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    exact «Т2-терм» _ a e l b («захват?-чисто» hz) he («допущение-в-окружении» u n _ hd)
  | «Э5» n m p1 p2 e x r b ho hp h1 h2 hf hz hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Э5-терм» _ e x r b («захват?-чисто» hz)
      («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1))) («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Э6» n q e x l f b ho hp h1 hf hz hzx hx hp1 =>
    simp only [«итог»]
    rw [hf]
    exact «Э6-терм» _ e x l f b («захват?-чисто» hz) hx (hp1 ▸ hinv q («шагПо-в» h1))
  | «Разв2» n m q t ho hp h1 ht hpl hz hp1 =>
    simp only [«итог»]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    intro w hw
    have hr : «результат-есть» t w := hw _ (List.mem_append_right _ («результат-в-окружении» u m t ht))
    have hv := hq w hw
    simp only [«Факт-из»] at hv ⊢
    rw [«подстановкаФ» _ _ _ _ («захват?-чисто» hz)] at hv
    simp only [«мир-с»] at hv
    unfold «результат-есть» at hr
    rw [← hr, «связать-своё»] at hv
    exact hv
  | «СС1» l ho hp hf hl =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «СС1-терм» _ l («безСоседей-верно» hl)
  | «О1» n e g f ho hp hf hd hpf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    have hfin := «допущение-в-окружении» u n f hd
    rw [«порядок?-факт» hpf] at hfin
    rw [«порядок?-факт» hf]; exact «О1-терм» _ e g hfin
  | «В2» e l ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rcases hf with hf | hf <;> rw [hf]
    · exact («В2-терм» _ e l).1
    · exact («В2-терм» _ e l).2
  | «Ч1» t ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Ч1-терм» _ t
  | «В1» d e ho hp hf hin =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «В1-терм» _ e d («вЧленах-верно» e d hin)
  | «Д1» n k g ho hp hf hd =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [«порядок?-факт» hf, ← «зеркало»]
    exact «Д1-терм» _ g k («допущение-в-окружении» u n _ hd)
  | «Д6» k ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [«порядок?-факт» hf]; exact «Д6-терм» _ k
  | «С1» n e g f ho hp hf hne hd hpf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    have hfin := «допущение-в-окружении» u n f hd
    rw [«строгий?-факт» hpf] at hfin
    rw [«строгий?-факт» hf]; exact «С1-терм» _ e g hfin
  | «Н10» n m p1 p2 t d ho hp h1 h2 hf hd hcel hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    have q1 := hp1 ▸ hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp2, ← «зеркало»] at q2
    exact «Н10-терм» _ t d hd («справа» _ _ q2) («слева» _ _ q1)
  | «П6» n m p1 p2 t d k ho hp h1 h2 hf hd hk hcel hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    have q1 := hp1 ▸ hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp2, ← «зеркало»] at q2
    exact «П6-терм» _ t d k hd hk («справа» _ _ q2) («слева» _ _ q1)
  | «О2» n q g ho hp h1 hf hp1 =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    exact «О2-терм» _ g _ («посылкаО2-верно» hp1) (hinv q («шагПо-в» h1))
  | «С4-строка» n a k g f ho hp hf hne hd hpf hk =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    have hfin := «допущение-в-окружении» u n f hd
    rw [«строгий?-факт» hpf] at hfin
    rw [«строгий?-факт» hf]; exact «С4-терм» _ a k g hk («Т1» _ _ hfin)
  | «С4-шаг» n q a k g ho hp h1 hf hne hpf hk =>
    simp only [«итог»]
    have hq := hinv q («шагПо-в» h1)
    rw [«строгий?-факт» hpf] at hq
    rw [«строгий?-факт» hf]; exact «С4-терм» _ a k g hk hq
  | «Ч2» t ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Ч2-терм» _ t
  | «Ч6» n m p1 p2 t b q ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Ч6-терм» _ t b q («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Д5» n m p1 p2 l r a b ho hp h1 h2 hf hp1 hp2 ha hb hab =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp1] at q1
    rw [«порядок?-факт» hp2] at q2
    exact «Д5-терм» _ l r a b ha hb hab («слева» _ _ q1) («справа» _ _ q2)
  | «О8» x y c ho hp hf =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [«порядок?-факт» hf]; exact «О8-терм» _ _ y c
  | «О4» n q a d g ho hp h1 hf hp1 had =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    exact «О4-терм» _ a d g had (hp1 ▸ hinv q («шагПо-в» h1))
  | «О10» n m p1 p2 e c g ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp1] at q1
    rw [«порядок?-факт» hp2] at q2
    exact «О10-терм» _ e c g («слева» _ _ q1) («справа» _ _ q2)
  | «Ч3» n q l r q' ho hp h1 hf hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Ч3-терм» _ l r q' (hp1 ▸ hinv q («шагПо-в» h1))
  | «В3» n q d e l ho hp h1 hf hp1 =>
    simp only [«итог»]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    rcases hf with hf | hf <;> rw [hf]
    · exact («В3-терм» _ d e l hq).1
    · exact («В3-терм» _ d e l hq).2
  | «В4» n m p1 p2 c a b e ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «В4-терм» _ c a b e («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «Ч4» n m p1 p2 c a b q ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «Ч4-терм» _ c a b q («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «О3» n m p1 p2 c a b g ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp1] at q1
    rw [«порядок?-факт» hp2] at q2
    exact «О3-терм» _ c a b g («слева» _ _ q1) («справа» _ _ q2)
  | «С2» n m p1 p2 c a b g ho hp h1 h2 hf hne hp1 hp2 =>
    simp only [«итог»]
    rw [«строгий?-факт» hf]
    have q1 := hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«строгий?-факт» hp1] at q1
    rw [«строгий?-факт» hp2] at q2
    exact «С2-терм» _ c a b g («слева» _ _ q1) («справа» _ _ q2)
  | «С3» n q a d g ho hp h1 hf hne hp1 had =>
    simp only [«итог»]
    rw [«строгий?-факт» hf]
    exact «С3-терм» _ a d g had (hp1 ▸ hinv q («шагПо-в» h1))
  | «Д4» n m p1 p2 c a b k da db ho hp h1 h2 hf hp1 hp2 hka hkb =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    exact «Д4-терм» _ c a b k da db hka hkb («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «СС2» n l ho hp hf hd =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «СС2-терм» _ l («допущение-в-окружении» u n _ hd)
  | «СС3-пустой» n q g x ho hp h1 hf hx hp1 =>
    simp only [«итог»]
    rw [hf]; exact «СС3-пустой-терм» _ g x («голова?-пусто» hx) (hp1 ▸ hinv q («шагПо-в» h1))
  | «СС3» n m p1 p2 g hh x ho hp h1 h2 hf hx hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp2] at q2
    exact «СС3-терм» _ g hh x («голова?-голова» hx) («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ q2)
  | «СС4» n m p1 p2 c a b ho hp h1 h2 hf hp1 hp2 =>
    simp only [«итог»]
    rw [hf]
    exact «СС4-терм» _ c a b («слева» _ _ (hp1 ▸ hinv p1 («шагПо-в» h1)))
      («справа» _ _ (hp2 ▸ hinv p2 («шагПо-в» h2)))
  | «СС4-охрана» n m q c a b ho hp h1 hf hd hp1 =>
    simp only [«итог»]
    rw [hf]
    have hc : «Факт-из» c ∈ «гип» q.«откр» ++ «окружение» u :=
      List.mem_append_right _ («допущение-в-окружении» u m c hd)
    exact «СС4-охрана-терм» _ c a b («Т1» _ _ hc) (hp1 ▸ hinv q («шагПо-в» h1))
  | «Кон2» hn m ph pm t q ho hp hh hm hg hf hc hq hotkr =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]
    have h1 : «Судим» («Факт-из» (.«равен» (.«минус» t t) (.«лит» 0)) :: «окружение» u) («Факт-из» q) :=
      «одна-гипотеза» (fun p hp => (hotkr p hp).2) (hq ▸ hinv pm («шагПо-в» hm))
    exact «подъём1» (fun w => «не-или» _ _ w) («Р1» _ _ _ h1)
  | «Н7» n q l n0 a e s ho hp h1 hf hae hs hp1 =>
    simp only [«итог»]
    rw [hf]; exact «Н7-терм» _ l n0 a e s (hp1 ▸ hinv q («шагПо-в» h1)) («шагСчёта-верно» hae hs)
  | «Н8» n q x y v b ho hp h1 hf hv hp1 =>
    simp only [«итог»]
    rw [hf]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    have hΓ : ∀ f ∈ «окружение» u, f ∈ «гип» q.«откр» ++ «окружение» u := fun f hf => List.mem_append_right _ hf
    rcases «второйН8-верно» hv with ⟨rfl, hx⟩ | ⟨rfl, hy⟩
    · obtain ⟨a1, a2⟩ := «положителенН8» u _ x hΓ hx
      exact «Н8-терм» _ x v a1 a2 hq
    · obtain ⟨a1, a2⟩ := «положителенН8» u _ y hΓ hy
      have := «Н8-терм» _ y v a1 a2 hq
      intro w hw
      have := this w hw
      simp only [«Факт-из», «оценитьФ», «оценить», «неМеньше»] at this ⊢
      rw [«умножить-перест»]; exact this
  | «О5» n q e g e' g' k ho hp h1 hf hc hp1 =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv q («шагПо-в» h1)
    rw [«порядок?-факт» hp1] at q1
    exact «О5-терм» _ e g e' g' (.«лит» k) (fun w => («прибавкиО5-верно» hc w).1)
      (fun w => («прибавкиО5-верно» hc w).2) (fun _ => True) (fun w _ => rfl) (fun w _ => trivial) q1
  | «О5-отрезок» n m k q q2 q3 e g e' g' s d b ho hp h1 h2 h3 hf hc hp1 hp2 hd hp3 =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv q («шагПо-в» h1)
    rw [«порядок?-факт» hp1] at q1
    have r2 := hp2 ▸ hinv q2 («шагПо-в» h2)
    have r3 := hp3 ▸ hinv q3 («шагПо-в» h3)
    exact «О5-терм» _ e g e' g' s (fun w => («прибавкиО5-верно» hc w).1) (fun w => («прибавкиО5-верно» hc w).2)
      (fun w => «Факт-из» (.«неМеньше» s (.«лит» d)) w ∧ «Факт-из» (.«неБольше» s (.«лит» b)) w)
      (fun w hw => («отрезок-числом» _ d b hd
        (by simpa [«Факт-из», «оценитьФ», «оценить», «неМеньше»] using hw.1)
        (by simpa [«Факт-из», «оценитьФ», «оценить»] using hw.2)).1)
      («подъём2» (fun w a c => ⟨a, c⟩) («слева» _ _ («справа» _ _ r2)) («справа» _ _ r3))
      («слева» _ _ («слева» _ _ q1))
  | «О6» n q e g g' k ho hp h1 hf hc hk hp1 he =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv q («шагПо-в» h1)
    rw [«порядок?-факт» hp1] at q1
    exact «О6-терм» _ e g g' (.«лит» k) (fun w => «слагаемыеО6-верно» hc w)
      (fun _ => True) (fun w _ => by simp [«оценить», «неотр», «конечно», hk]) (fun w _ => trivial)
      «числа-представимы» (fun w hw => «представимаЛевая-верно» he w hw)
      (fun w hw => hw _ (List.mem_append_right _ («числа-в-окружении» u))) q1
  | «О6-отрезок» n m k q q2 q3 e g g' s d b ho hp h1 h2 h3 hf hc hp1 hp2 hd hp3 he =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv q («шагПо-в» h1)
    rw [«порядок?-факт» hp1] at q1
    have r2 := hp2 ▸ hinv q2 («шагПо-в» h2)
    have r3 := hp3 ▸ hinv q3 («шагПо-в» h3)
    exact «О6-терм» _ e g g' s (fun w => «слагаемыеО6-верно» hc w)
      (fun w => «Факт-из» (.«неМеньше» s (.«лит» d)) w ∧ «Факт-из» (.«неБольше» s (.«лит» b)) w)
      (fun w hw =>
        have r := «отрезок-числом» _ d b hd
          (by simpa [«Факт-из», «оценитьФ», «оценить», «неМеньше»] using hw.1)
          (by simpa [«Факт-из», «оценитьФ», «оценить»] using hw.2)
        ⟨r.2.1, r.2.2⟩)
      («подъём2» (fun w a c => ⟨a, c⟩) («слева» _ _ («справа» _ _ r2)) («справа» _ _ r3))
      «числа-представимы» (fun w hw => «представимаЛевая-верно» he w hw)
      (fun w hw => hw _ (List.mem_append_right _ («числа-в-окружении» u)))
      («слева» _ _ («слева» _ _ q1))
  | «Ч5» t q a b ho hp hf ht hq h =>
    simp only [«итог», «гип», List.map_nil, List.nil_append]
    rw [hf]; exact «Ч5-терм» _ t q a b ht hq h
  | «Д3» n m p1 p2 l r a b ho hp h1 h2 hf hp1 hp2 ha hb hab =>
    simp only [«итог»]
    rw [«порядок?-факт» hf]
    have q1 := hinv p1 («шагПо-в» h1)
    have q2 := hinv p2 («шагПо-в» h2)
    rw [«порядок?-факт» hp1] at q1
    rw [«порядок?-факт» hp2] at q2
    exact «Д3-терм» _ l r a b ha hb hab («слева» _ _ q1) («справа» _ _ q2)
  | «Пр1» n m p1 p2 a b ho hp h1 h2 hp1 hp2 =>
    simp only [«итог»]
    intro w hw
    have e1 := «слева» p1.«откр» p2.«откр» (hinv p1 («шагПо-в» h1)) w hw
    have e2 := «справа» p1.«откр» p2.«откр» (hinv p2 («шагПо-в» h2)) w hw
    rw [hp1] at e1
    rw [hp2] at e2
    simp only [«Факт-из», «оценитьФ»] at e1 e2
    exact («Пр1» _ _ e1 e2).elim
  | «М1» n q r s t k ho hp h1 hp1 hf hm hk1 hk2 =>
    simp only [«итог»]
    rw [hf]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    exact fun w hw => «собрать-М1» r s t k hm hk1 hk2 w (hq w hw)
  | «М2» n q c x y x' y' ho hp h1 hp1 hf hm =>
    simp only [«итог»]
    rw [hf]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    intro w hw
    rcases hm with ⟨rfl, hm⟩ | ⟨rfl, hm⟩
    · exact «собрать2-замена» c x y x y' w rfl («мера2-значение» hm w) (hq w hw)
    · exact «собрать2-замена» c x y x' y w («мера2-значение» hm w) rfl (hq w hw)
  | «К↑» n q c x y x' y' ho hp h1 hp1 hf hm =>
    simp only [«итог»]
    rw [hf]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    intro w hw
    rcases hm with ⟨rfl, hm⟩ | ⟨rfl, hm⟩
    · exact «собрать2-замена» c x y x' y w («полеСтороны-значение» hm w).symm rfl (hq w hw)
    · exact «собрать2-замена» c x y x y' w rfl («полеСтороны-значение» hm w).symm (hq w hw)
  | «Разв1» n q k fs cs bs b ps ho hp h1 hf hv hps hc hp1 =>
    simp only [«итог»]
    rw [hf]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    intro w hw
    have hb := hq w hw
    simp only [«Факт-из»] at hb ⊢
    rw [«подстПар-значение» w b ps hc] at hb
    simp only [«оценитьФ», «оценитьСм»]
    rw [«ветвь?-значение» k _ w cs bs b hv, «поляИмён-мир» k fs w bs ps hps]
    exact hb
  | «Разв3-своё» n m q t ho hp h1 ht hz hp1 =>
    simp only [«итог»]
    have hq := hp1 ▸ hinv q («шагПо-в» h1)
    intro w hw
    have hr : «результат-есть» t w := hw _ (List.mem_append_right _ («результат-в-окружении» u m t ht))
    have hv := hq w hw
    simp only [«Факт-из»] at hv ⊢
    rw [«подстановкаФ» _ _ _ _ («захват?-чисто» hz)] at hv
    simp only [«мир-с»] at hv
    unfold «результат-есть» at hr
    rw [← hr, «связать-своё»] at hv
    exact hv
  | «Разв3-вызов» n m q d ho hp h1 hd hm hr =>
    simp only [«итог»]
    have hq := hinv q («шагПо-в» h1)
    intro w hw
    have hdef : «определение-есть» d w :=
      hw _ (List.mem_append_right _ («определение-в-окружении» u d hd))
    have heq := «замФ-верно» («развёрнут?» d) w («развёрнут?-верно» d w hdef) _ _ hr
    have hv := hq w hw
    simp only [«Факт-из»] at hv ⊢
    rw [heq]; exact hv

theorem «блок-верен» (u : «Утверждение») : ∀ («шаги» : List «Шаг») («преж» «итог» : List «Принятый»),
    «БлокПринят» u «шаги» «преж» «итог» → «Инв» u «преж» → «Инв» u «итог»
  | _, _, _, .«конец» _, hinv => hinv
  | _, _, _, .«шаг» h hhv, hinv =>
    «блок-верен» u _ _ _ hhv (fun p hp => by
      rcases List.mem_append.mp hp with hp | hp
      · exact hinv p hp
      · simp only [List.mem_singleton] at hp
        subst hp
        exact «шаг-верен» u _ _ _ h hinv)

/-- **Состоятельность приёмки**: принятое утверждение выводится из своего
    окружения. Это и есть строка ADR-0041 §2.1: `Принят з → Судим (допущения з) (цель з)`. -/
theorem «состоятельность» (u : «Утверждение») (h : «Принят» u) :
    «Судим» («окружение» u) («Факт-из» u.«цель») := by
  obtain ⟨v, «итог», «посл», hv, hc, hb, hl, hf, ho⟩ := h
  have hinv := «блок-верен» u _ _ _ hb (fun p hp => by simp at hp)
  have hmem : «посл» ∈ «итог» := by
    obtain ⟨l', hl'⟩ := List.getLast?_eq_some_iff.mp hl
    rw [hl']; simp
  have := hinv «посл» hmem
  rw [ho, hf] at this
  simpa [«гип»] using this

/-- То же — для разрешимой приёмки: `принят? з = true → Судим (окружение з) (цель з)`. -/
theorem «состоятельность-разрешимо» (u : «Утверждение») (h : «принят?» u = true) :
    «Судим» («окружение» u) («Факт-из» u.«цель») :=
  «состоятельность» u («принят?-верно» u h)

/-- Число покрытых правил; сверщик именует 81 приём в `шаг_вывода`. -/
theorem «покрыто-число» : «покрыто» = 76 := by decide
