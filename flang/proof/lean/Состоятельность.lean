import «Приёмка»

/-!
# Состоятельность приёмки: «принят — значит верно» (ADR-0041 §2.1, веха 4)

Теорема «состоятельность»: `«Принят» з → «Судим» («окружение» з) («Факт-из» (цель з))`
— принятое утверждение выводится из своего окружения в каждом мире модели.
Доказательство — индукция по блоку (`«БлокПринят»`): у каждого принятого
шага его формула выводится из его открытых гипотез и окружения («Инв»), и
каждый случай `«ШагПринят»` закрывается леммой `Правила.lean`, поднятой на
термы в `Терм.lean` («…-терм»).

## Чем закрыт каждый случай — поимённо

| правило | лемма `Правила.lean` | через |
|---|---|---|
| Т1, Н2, Н3, ГипО, ГипД | «Т1» | «Т1-терм», «Н2-терм», «Н3-терм» |
| Кон1 | «Кон1» | «Кон1-терм» |
| Кон3 | «Кон2» (значение) | «Кон3-терм» |
| Св1 | «подстановка» + смысл `есть` | «Св1-терм» |
| Р1 | «Р1» | своё «если-да» |
| Р4 | «Р4» | сечение по факту «Л или П» из окружения |
| Н1, Н4, Н5, Н9, Н12 | «Н1», «Н4», «Н5», «Н9», «Н12» | «…-терм» |
| Пред1, П1, П2, П3, П5 | «Пред1», «П1», «П2», «П3», «П5» | «…-терм» |
| Э1, Э2, Э3, Э4 | «Э1», «Э2», «Э3-приписать»/«Э3-добавить», «Э4» | «…-терм» |
| Разв2 | «подстановка» + факт «результат равен телу» | здесь |
| Или1, Или2, И1, И2 | «Или1», «Или2», «И1», «И2» | «…-терм» |
| Цел1, Цел2 | «Цел1», «Цел2» | «Цел1-терм», «Цел2-терм» |

До задачи 3855 у строк Или1, Или2, И1, И2, Цел1, Цел2 лемм в `Правила.lean`
не было: случаи Или/И закрывались здесь своими леммами о булевых связках, а
Цел приёмка не брала вовсе.

## Подмножество — числом

Теорема доказана для 31 правила приёмки (`«покрыто» = 31`, проверено
`decide`) из 70 приёмов `шаг_вывода`; из 13 именованных приёмов — для всех 13.
-/

set_option linter.unusedVariables false

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
  apply List.mem_append_left; apply List.mem_append_left; apply List.mem_append_left
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
    exact «Т1» _ _ List.mem_cons_self
  | «ГипД» n l r ho hp hd hf =>
    simp only [«гип», List.map_cons, List.map_nil, List.singleton_append]
    exact «Т1» _ _ List.mem_cons_self
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

/-- Число покрытых правил; сверщик именует 70 приёмов в `шаг_вывода`. -/
theorem «покрыто-число» : «покрыто» = 46 := by decide
