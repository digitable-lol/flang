import Checker
import Premises

open «Разбор»

namespace «Второй»

/-!
# Пути второго сверщика, судимые теоремой (ADR-0193, условие 3 дороги до 1.0)

Строка таблицы `flang/proof/tables/lean-soundness-debt.tsv` с состоянием `доказано`
называет теорему отсюда: если путь принял — не прибавил ни беды, ни непонятого, ни места
«на слове», — то то, что запись этим путём утверждает, следует из исходника.

Исходник здесь читается функциями второго сверщика (`таблицыИсходника`,
`зовомыеПлана`, `поручения`, `Исх.строка`): что они читают исходник так, как его
понимает язык, — сверка на корпусе, как и чтение формул (`RecordReader.lean`), а не
теорема. Теоремы говорят о решении пути, а не о чтении.
-/

/-- Суд принял: ни беды, ни непонятого, ни места на слове. С таким судом запись
    получает код 0 (`«исход»`). -/
def «Суд».«чист» (r : «Суд») : Prop := r.«беды» = [] ∧ r.«непонято» = [] ∧ r.«наСлово» = []

theorem «беда-не-пуста» (r : «Суд») (m : String) : (r.«беда» m).«беды» ≠ [] := by
  simp [«Суд».«беда»]

theorem «слово-не-пусто» (r : «Суд») (m : String) : (r.«слово» m).«наСлово» ≠ [] := by
  simp [«Суд».«слово»]

theorem «не-не-пусто» (r : «Суд») (m : String) : (r.«не» m).«непонято» ≠ [] := by
  simp [«Суд».«не»]

theorem «чист-беда» (r : «Суд») (m : String) : ¬ (r.«беда» m).«чист» := fun h => «беда-не-пуста» r m h.1
theorem «чист-слово» (r : «Суд») (m : String) : ¬ (r.«слово» m).«чист» := fun h => «слово-не-пусто» r m h.2.2
theorem «чист-не» (r : «Суд») (m : String) : ¬ (r.«не» m).«чист» := fun h => «не-не-пусто» r m h.2.1

theorem «еслиНе-беды» (r : «Суд») (c : Bool) (m : String) :
    (r.«еслиНе» c m).«беды» = [] ↔ r.«беды» = [] ∧ c = true := by
  unfold «Суд».«еслиНе»; cases c <;> simp [«Суд».«беда»]

theorem «и-чист'» {a b : «Суд»} (h : (a.«и» b).«чист») : a.«чист» ∧ b.«чист» := by
  obtain ⟨hb, hn, hw⟩ := h
  simp only [«Суд».«и», List.append_eq_nil_iff] at hb hn hw
  exact ⟨⟨hb.1, hn.1, hw.1⟩, ⟨hb.2, hn.2, hw.2⟩⟩

theorem «ложь-узла-чисто» {u : Option «Узел»} {r : «Суд»}
    (h : (match u with
      | some (.«ложь» bs) => ({ r with «беды» := r.«беды» ++ bs } : «Суд»)
      | _ => r).«чист») : r.«чист» := by
  split at h
  · obtain ⟨hb, hn, hw⟩ := h
    simp only [List.append_eq_nil_iff] at hb
    exact ⟨hb.1, hn, hw⟩
  · exact h

theorem «слово-приписано-чисто» {r : «Суд»} {x : List String}
    (h : ({ r with «наСлово» := r.«наСлово» ++ x } : «Суд»).«чист») : r.«чист» ∧ x = [] := by
  obtain ⟨hb, hn, hw⟩ := h
  simp only [List.append_eq_nil_iff] at hw
  exact ⟨⟨hb, hn, hw.1⟩, hw.2⟩

theorem «еслиНе-чисто» {r : «Суд»} {c : Bool} {m : String} (h : (r.«еслиНе» c m).«чист») : r.«чист» ∧ c = true := by
  unfold «Суд».«еслиНе» at h
  cases c
  · exact absurd h («чист-беда» _ _)
  · exact ⟨h, rfl⟩

theorem «если-и-чисто» {c : Bool} {r q : «Суд»} (h : (if c = true then r.«и» q else r).«чист») :
    r.«чист» ∧ (c = true → q.«чист») := by
  cases c
  · exact ⟨h, fun h' => by cases h'⟩
  · obtain ⟨h1, h2⟩ := «и-чист'» (by simpa using h)
    exact ⟨h1, fun _ => h2⟩

theorem «если-пусто» {c : Bool} {m : String} : «если» c m = [] ↔ c = true := by
  unfold «если»; cases c <;> simp

/-! ## Оглавление таблиц и шапка -/

/-- **Оглавление таблиц — ровно таблицы исходника.** Если путь `«судитьОглавление»`
    принял шапку, то каждая списочная таблица исходника записана в оглавлении своей
    строкой печати (имя, строки открытия и закрытия, звеньев), и каждая строка
    оглавления — строка печати таблицы исходника. -/
theorem «оглавление-по-исходнику» (s : «Исх») (hd : List String)
    (h : («судитьОглавление» s hd).«чист») :
    let «стр» := (hd.map «обрезать»).filter (·.startsWith "таблица «")
    (∀ t ∈ «таблицыИсходника» s, «строкаТаблицы» t ∈ «стр») ∧
    (∀ l ∈ «стр», ∃ t ∈ «таблицыИсходника» s, l = «строкаТаблицы» t) := by
  intro «стр»
  unfold «судитьОглавление» at h
  simp only at h
  split at h
  · rename_i hc
    obtain ⟨_, _, hn⟩ := h
    simp only [List.map_eq_nil_iff] at hn
    simp only [Bool.and_eq_true, List.isEmpty_iff] at hc
    refine ⟨fun t ht => by simp [hn] at ht, fun l hl => ?_⟩
    have : l ∈ «стр» := hl
    simp [«стр», hc.2] at this
  · obtain ⟨hb, _, _⟩ := h
    simp only [«бедыОглавления», List.append_eq_nil_iff, List.flatMap_eq_nil_iff] at hb
    obtain ⟨⟨⟨⟨_, _⟩, hl⟩, _⟩, ht⟩ := hb
    refine ⟨fun t htm => ?_, fun l hlm => ?_⟩
    · have := ht t htm
      rw [«если-пусто»] at this
      exact List.contains_iff_mem.mp this
    · have := hl l hlm
      obtain ⟨hm, _⟩ := this
      split at hm
      · rename_i t hf
        rw [«если-пусто»] at hm
        exact ⟨t, List.mem_of_find?_eq_some hf, by simpa using hm⟩
      · simp at hm

/-- **Шапка — по форме печати, и оглавление — таблицы исходника.** Если путь
    `«судитьШапку»` принял шапку, то каждая её строка — по форме печати
    (`«формаШапки?»`), и оглавление таблиц совпадает с таблицами исходника
    (теорема «оглавление-по-исходнику»). -/
theorem «шапка-по-исходнику» (s : «Исх») (hd : List String)
    (h : («судитьШапку» s hd).«чист») :
    (∀ l ∈ hd, «формаШапки?» («обрезать» l) = true) ∧
    let «стр» := (hd.map «обрезать»).filter (·.startsWith "таблица «")
    (∀ t ∈ «таблицыИсходника» s, «строкаТаблицы» t ∈ «стр») ∧
    (∀ l ∈ «стр», ∃ t ∈ «таблицыИсходника» s, l = «строкаТаблицы» t) := by
  obtain ⟨hb, hn, hw⟩ := h
  simp only [«судитьШапку», «Суд».«и», List.append_eq_nil_iff, List.flatMap_eq_nil_iff] at hb hn hw
  refine ⟨fun l hl => ?_, «оглавление-по-исходнику» s hd ⟨hb.2, hn.2, hw.2⟩⟩
  have := hb.1 («обрезать» l) (List.mem_map_of_mem hl)
  rwa [«если-пусто»] at this

/-! ## План -/

/-- **План выдаёт только разрешённое.** Если путь `«судитьПлан»` принял блок плана,
    то каждая строка исходника в функции, которую план зовёт (`«зовомыеПлана»`), выдаёт
    только поручения, о которых запись говорит строкой «поручение «x» функции «f» строка
    k», и на каждое из них в блоке плана исходника стоит строка «разрешает», которая его
    называет и записана строкой «разрешено» записи. -/
theorem «план-по-исходнику» (s : «Исх») (h : Array String) («блок» : List String)
    (hc : («судитьПлан» s h «блок»).«чист») :
    let p := «блокПланаИз» «блок»
    ∀ k ∈ s.«номера», (s.«зовомыеПлана» h p.«где»).contains («хозяинИз» h k) = true →
      ∀ x ∈ «поручения» (s.«строка» k),
        s!"поручение «{x}» функции «{«хозяинИз» h k}» строка {k}" ∈ p.«поручения» ∧
        ∃ l ∈ p.«разр», «ёлочка» l 1 = x ∧
          let m := «номерПосле» l "строка "
          m ∈ s.«блокПлана» p.«где» ∧ (s.«строка» m).startsWith "разрешает " = true ∧
            ((s.«строка» m).splitOn s!"«{x}»").length > 1 := by
  intro p k hk hz x hx
  obtain ⟨hb, _, _⟩ := hc
  simp only [«судитьПлан», «бедыПлана», List.append_eq_nil_iff, List.flatMap_eq_nil_iff] at hb
  have hk' := hb.2 k hk
  simp only [show (s.«зовомыеПлана» h («блокПланаИз» «блок»).«где»).contains («хозяинИз» h k) = true from hz,
    ↓reduceIte] at hk'
  simp only [List.flatMap_eq_nil_iff, List.append_eq_nil_iff] at hk'
  obtain ⟨h1, h2⟩ := hk' x hx
  rw [«если-пусто»] at h1 h2
  refine ⟨by simpa using h1, ?_⟩
  obtain ⟨l, hl, hl2⟩ := List.any_eq_true.mp h2
  simp only [Bool.and_eq_true, decide_eq_true_eq] at hl2
  obtain ⟨hx', hr⟩ := hl2
  refine ⟨l, hl, hx', ?_⟩
  simp only [«разрешеноВИсходнике», Bool.and_eq_true, List.contains_iff_mem, decide_eq_true_eq] at hr
  obtain ⟨⟨hm, hs⟩, hn⟩ := hr
  rw [hx'] at hn
  exact ⟨hm, hs, hn⟩

/-- Суд склейки принят — принят каждый склеенный. -/
theorem «свёртка-и-чиста» {α : Type} (f : α → «Суд») : ∀ (bs : List α) (r : «Суд»),
    (bs.foldl (fun r b => r.«и» (f b)) r).«чист» → r.«чист» ∧ ∀ b ∈ bs, (f b).«чист»
  | [], r, h => ⟨h, fun _ hb => by simp at hb⟩
  | b :: bs, r, h => by
    obtain ⟨h1, h2⟩ := «свёртка-и-чиста» f bs _ h
    obtain ⟨hb, hn, hw⟩ := h1
    simp only [«Суд».«и», List.append_eq_nil_iff] at hb hn hw
    refine ⟨⟨hb.1, hn.1, hw.1⟩, fun x hx => ?_⟩
    rcases List.mem_cons.mp hx with rfl | hx
    · exact ⟨hb.2, hn.2, hw.2⟩
    · exact h2 x hx

/-- **Каждый план записи выдаёт только разрешённое.** Если путь `«судитьПланы»` принял
    блоки планов, то каждый блок принят путём `«судитьПлан»` — и для него держится
    теорема «план-по-исходнику». -/
theorem «планы-по-исходнику» (s : «Исх») («блоки» : List (List String))
    (hc : («судитьПланы» s «блоки»).«чист») :
    ∀ b ∈ «блоки», («судитьПлан» s s.«хозяева» b).«чист» :=
  («свёртка-и-чиста» («судитьПлан» s s.«хозяева») «блоки» {} hc).2

/-! ## Снятие предусловия в точке вызова -/

/-- Решение о снятии с принятой формой: принято — значит вердикт «доказано», цель —
    снимаемое требование на доводах вызова, и принял блок вывода моделью либо ходы. -/
theorem «решение-снятия» (s : «Исх») (h : Array String) («строки» : List String)
    («опр» : List «Определение») («доказанные» «объявленные» : List String) (c : «Снятие») (r : «Суд»)
    (hr : («решениеСнятия» s h «строки» «опр» «доказанные» «объявленные» c r).«чист») :
    ∃ «цель», «цельСнятия» s c = some «цель» ∧
      c.«внутри».filter (fun l => l.startsWith "вердикт " || l = "вердикт") = ["вердикт доказано"] ∧
      («выводСнятия» c «цель» «строки» «опр» («звеньяВызоваЗв» s h c.«функция» c.«строка») = .ok none ∨
       let p := «проигратьБлок» («обстСнятия» s c «цель» «доказанные» «объявленные»)
       p.«беды» = [] ∧ p.«неВзялся» = [] ∧ p.«проиграно» ≠ 0) := by
  by_cases h1 : «хозяинИз» h c.«строка» ≠ c.«функция»
  · simp only [«решениеСнятия», ne_eq, h1, not_false_eq_true, ↓reduceIte] at hr
    exact absurd hr («чист-беда» _ _)
  by_cases h2 : (!(«вызовСнятия» s c).«с».startsWith s!"«{c.«зовёт»}»") = true
  · simp only [«решениеСнятия», h1, h2, ↓reduceIte] at hr
    exact absurd hr («чист-беда» _ _)
  by_cases h3 : («вызовСнятия» s c).«треб».isEmpty = true
  · simp only [«решениеСнятия», h1, h2, h3, ↓reduceIte] at hr
    exact absurd hr («чист-слово» _ _)
  cases hu : («вызовСнятия» s c).«у» with
  | none =>
    simp only [«решениеСнятия», h1, h2, h3, hu, Bool.false_eq_true, ↓reduceIte] at hr
    exact absurd hr («чист-беда» _ _)
  | some «у» =>
  by_cases h4 : («вызовСнятия» s c).«арги».length ≠ («вызовСнятия» s c).«парам».length
  · simp only [«решениеСнятия», ne_eq, not_false_eq_true, h1, h2, h3, hu, h4, Bool.false_eq_true, ↓reduceIte] at hr
    exact absurd hr («чист-беда» _ _)
  by_cases h5 : c.«внутри».filter (fun l => l.startsWith "вердикт " || l = "вердикт") ≠ ["вердикт доказано"]
  · simp only [«решениеСнятия», ne_eq, not_false_eq_true, h1, h2, h3, hu, h4, h5, Bool.false_eq_true, ↓reduceIte] at hr
    exact absurd hr («чист-слово» _ _)
  have hcel : «цельСнятия» s c = some («подставитьДоводы» «у» («вызовСнятия» s c).«парам» («вызовСнятия» s c).«арги») := by
    simp only [ne_eq, Decidable.not_not] at h4
    simp only [«цельСнятия», hu, h4, ↓reduceIte]
  refine ⟨_, hcel, by simpa using h5, ?_⟩
  by_cases h6 : «связаноВТеле» s h c.«функция» c.«строка»
      («подставитьДоводы» «у» («вызовСнятия» s c).«парам» («вызовСнятия» s c).«арги») = true
  · simp only [«решениеСнятия», h1, h2, h3, hu, h4, h5, h6, Bool.false_eq_true, ↓reduceIte] at hr
    exact absurd hr («чист-слово» _ _)
  by_cases h7 : (c.«внутри».any (·.startsWith "вывод ")) = true
  · left
    simp only [«решениеСнятия», h1, h2, h3, hu, h4, h5, h6, h7, Bool.false_eq_true, ↓reduceIte] at hr
    revert hr
    cases «выводСнятия» c («подставитьДоводы» «у» («вызовСнятия» s c).«парам» («вызовСнятия» s c).«арги»)
        «строки» «опр» («звеньяВызоваЗв» s h c.«функция» c.«строка») with
    | error e =>
      intro hr
      by_cases h8 : «строемВывода?» e = true
      · simp only [h8, ↓reduceIte] at hr; exact absurd hr («чист-беда» _ _)
      · simp only [h8, Bool.false_eq_true, ↓reduceIte] at hr; exact absurd hr («чист-не» _ _)
    | ok o =>
      cases o with
      | none => intro _; rfl
      | some e => intro hr; exact absurd hr («чист-беда» _ _)
  · right
    simp only [«решениеСнятия», ne_eq, h1, h2, h3, hu, h4, h5, h6, h7, Bool.false_eq_true, ↓reduceIte] at hr
    split at hr <;>
    · split at hr
      · exact absurd hr («чист-слово» _ _)
      split at hr
      · exact absurd hr («чист-слово» _ _)
      split at hr
      · exact absurd hr («чист-слово» _ _)
      rename_i h10
      intro p
      obtain ⟨hb, _, hw⟩ := hr
      simp only [List.append_eq_nil_iff, List.map_eq_nil_iff] at hw
      simp only [«Суд».«еслиНе»] at hb
      split at hb
      · rename_i h11
        refine ⟨List.isEmpty_iff.mp h11, hw.2, ?_⟩
        intro h12
        apply h10
        simp [h11, hw.2, h12, p]
      · exact absurd hb («беда-не-пуста» _ _)

/-- **Снятие принимает модель либо прогон ходов.** Если путь `«судитьСнятие»` принял
    блок снятия, то вердикт блока — «доказано», цель снятия — снимаемое требование
    зовомой на доводах этого вызова (`«цельСнятия»`), и либо блок `вывод` принят приёмкой
    модели (`«выводСнятия»` дал «принято»; тогда по теореме «выводСнятия-по-модели» цель
    следует из окружения), либо ходы свели цель прогоном `«проигратьБлок»` без беды и без
    места на слове — третьего пути к принятию нет. Ходы судит строка долга
    `«проигратьБлок»`. -/
theorem «снятие-по-модели-или-ходам» (s : «Исх») (h : Array String) («строки» : List String)
    («опр» : List «Определение») («правила» «доказанные» «объявленные» : List String) («блок» : List String)
    (hc : («судитьСнятие» s h «строки» «опр» «правила» «доказанные» «объявленные» «блок»).«чист») :
    ∃ «цель», «цельСнятия» s («прочестьСнятие» «блок») = some «цель» ∧
      («прочестьСнятие» «блок»).«внутри».filter (fun l => l.startsWith "вердикт " || l = "вердикт") = ["вердикт доказано"] ∧
      («выводСнятия» («прочестьСнятие» «блок») «цель» «строки» «опр»
          («звеньяВызоваЗв» s h («прочестьСнятие» «блок»).«функция» («прочестьСнятие» «блок»).«строка») = .ok none ∨
       let p := «проигратьБлок» («обстСнятия» s («прочестьСнятие» «блок») «цель» «доказанные» «объявленные»)
       p.«беды» = [] ∧ p.«неВзялся» = [] ∧ p.«проиграно» ≠ 0) := by
  unfold «судитьСнятие» at hc
  dsimp only at hc
  split at hc
  · rename_i hf
    rw [hc.1] at hf
    exact absurd hf (by decide)
  · exact «решение-снятия» s h «строки» «опр» «доказанные» «объявленные» _ _ hc

/-! ## Обязательства входа -/

/-- **Обязательство входа закрыто зовущими.** Если путь `«судитьОбязательства»` не нашёл
    ни беды, ни обязательства, закрыть которое нечем, то каждая строка обязательства
    утверждения — обязательство входа по форме записи над доводом функции, его заключение
    — «x не больше К_предст» либо «x : цел», строка, на которую оно указывает, стоит в
    функции и объявляет довод точной сеткой, и проверка зовущих `«закрытиеВхода»` закрыла
    его: на каждом вызове стоит литерал под К_предст (для «цел» — целый) либо довод
    зовущей под её обязательством, и примеры дают литерал. -/
theorem «обязательства-закрыты» (s : «Исх») («строки» «обр» : List String) («имя» «чья» : String)
    (hb : («судитьОбязательства» s «строки» «обр» «имя» «чья»).1.«беды» = [])
    (hn : («судитьОбязательства» s «строки» «обр» «имя» «чья»).2 = 0) :
    ∀ l ∈ «обр», l.startsWith "обязательство " = true →
      let x := «ёлочка» l 1
      let f := «т» («уголок» l 1)
      let k := «номерПосле» («после» l "⟩") "строка "
      l = s!"обязательство вход «{x}» ⟨{«уголок» l 1}⟩ строка {k} на зовущем" ∧ «имяВывода?» x = true ∧
        (f = s!"{x} : цел" ∨ f = s!"{x} не больше {«Кпредст»}") ∧
        (k ≥ 1 ∧ k ≤ s.«число» ∧ «хозяинИз» s.«хозяева» k = «чья») ∧
        «точныйВСтроке?» «строки» (s.«строка» k) x = true ∧
        «закрытиеВхода» s s.«хозяева» «строки» «чья» x (f = s!"{x} : цел") = none := by
  intro l hl hs
  simp only [«судитьОбязательства», List.flatMap_eq_nil_iff, List.mem_map, List.mem_filter,
    List.length_eq_zero_iff, List.filter_eq_nil_iff] at hb hn
  have hlb := hb _ ⟨l, ⟨hl, hs⟩, rfl⟩
  have hln := hn _ ⟨l, ⟨hl, hs⟩, rfl⟩
  unfold «обязательствоВхода» at hlb hln
  by_cases hv : (!l.startsWith "обязательство вход «") = true
  · simp [hv] at hlb
  simp only [hv, Bool.false_eq_true, ↓reduceIte, List.append_eq_nil_iff, «если-пусто»] at hlb hln
  obtain ⟨⟨⟨⟨⟨h1, h2⟩, h3⟩, h4⟩, h5⟩, h6⟩ := hlb
  simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.or_eq_true] at h1 h3 h4 h5
  refine ⟨h1, h2, h3, ⟨h4.1.1, h4.1.2, h4.2⟩, ?_, ?_⟩
  · rcases h5 with h5 | h5
    · simp [h4.1.1, h4.1.2, h4.2] at h5
    · exact h5
  · revert h6 hln
    cases «закрытиеВхода» s s.«хозяева» «строки» «чья» («ёлочка» l 1) (decide («т» («уголок» l 1) = s!"{«ёлочка» l 1} : цел")) with
    | none => intro _ _; simp
    | some q =>
      obtain ⟨p, b⟩ := q
      cases b <;> simp

/-! ## Места строк записи -/

/-- **Каждая строка стоит на своём месте.** Если путь `«судитьМеста»` принял запись, то
    каждая её строка, начатая словами из `«местаСтрок»` («для всех», «таких что»,
    «свидетель», «после подстановки», «прогон»), стоит не первой и сразу под строкой,
    после которой ей место по описанию формата. -/
theorem «места-по-форме» («зап» : String) (hc : («судитьМеста» «зап»).«чист») :
    let v := («зап».splitOn "\n").map «обрезать»
    ∀ i < v.length, ∀ pm ∈ «местаСтрок», (v.getD i "").startsWith pm.1 = true →
      i > 0 ∧ pm.2.any ((v.getD (i - 1) "").startsWith ·) = true := by
  intro v i hi pm hpm hs
  have h := hc.1
  simp only [«судитьМеста», List.flatMap_eq_nil_iff, List.mem_range] at h
  have := h i hi pm hpm
  have key : ¬ (((v.getD i "").startsWith pm.1 &&
      !(decide (i > 0) && pm.2.any ((if i > 0 then v.getD (i - 1) "" else "").startsWith ·))) = true) := by
    intro hk
    simp only [v] at hk
    simp only [hk, ↓reduceIte] at this
    exact List.cons_ne_nil _ _ this
  rw [hs, Bool.true_and, Bool.not_eq_true, Bool.not_eq_false', Bool.and_eq_true, decide_eq_true_eq] at key
  obtain ⟨h0, h1⟩ := key
  simp only [h0, ↓reduceIte] at h1
  exact ⟨h0, h1⟩

/-! ## Посылки индукции -/

theorem «и-чист» {a b : «Суд»} (h : (a.«и» b).«чист») : a.«чист» ∧ b.«чист» := by
  obtain ⟨hb, hn, hw⟩ := h
  simp only [«Суд».«и», List.append_eq_nil_iff] at hb hn hw
  exact ⟨⟨hb.1, hn.1, hw.1⟩, ⟨hb.2, hn.2, hw.2⟩⟩

theorem «повторы-снятий-чисты» : ∀ (cs : List «Снятие») («было» : List String),
    («повторыСнятий» cs «было»).«чист» →
      (cs.map «ключСнятия»).Nodup ∧ ∀ c ∈ cs, «ключСнятия» c ∉ «было»
  | [], _, _ => by simp
  | c :: cs, «было», h => by
    simp only [«повторыСнятий»] at h
    obtain ⟨h1, h2⟩ := «и-чист» h
    obtain ⟨_, hk⟩ := «еслиНе-чисто» h1
    obtain ⟨hn, hm⟩ := «повторы-снятий-чисты» cs («было» ++ [«ключСнятия» c]) h2
    have hk' : «ключСнятия» c ∉ «было» := by simpa using hk
    refine ⟨?_, ?_⟩
    · refine List.nodup_cons.mpr ⟨?_, hn⟩
      intro hin
      obtain ⟨d, hd, he⟩ := List.mem_map.mp hin
      exact hm d hd (by simp [he])
    · intro d hd
      rcases List.mem_cons.mp hd with rfl | hd
      · exact hk'
      · exact fun hb => hm d hd (by simp [hb])

/-- **Снятия — обо всей программе.** Если путь `«судитьСнятия»` принял непустой набор
    блоков снятия, то каждый блок принят путём `«судитьСнятие»` (теорема
    «снятие-по-модели-или-ходам»), ни одно место снятия не записано дважды, и блоков,
    чья зовомая что-то требует, ровно столько, сколько мест вызова под «требует» в телах
    исходника (`«местСнятия»`). -/
theorem «снятия-полны» (s : «Исх») («строки» : List String) («опр» : List «Определение»)
    («правила» «доказанные» «объявленные» : List String) («блоки» : List (List String))
    (hne : «блоки» ≠ [])
    (hc : («судитьСнятия» s «строки» «опр» «правила» «доказанные» «объявленные» «блоки»).«чист») :
    (∀ b ∈ «блоки», («судитьСнятие» s s.«хозяева» «строки» «опр» «правила» «доказанные» «объявленные» b).«чист») ∧
    ((«блоки».map «прочестьСнятие»).map «ключСнятия»).Nodup ∧
    «местСнятия» s = «снятийСТребованием» s («блоки».map «прочестьСнятие») := by
  have he : «блоки».isEmpty = false := by
    cases «блоки» with
    | nil => exact absurd rfl hne
    | cons _ _ => rfl
  simp only [«судитьСнятия», he, Bool.false_eq_true, ↓reduceIte] at hc
  obtain ⟨h1, hm⟩ := «еслиНе-чисто» hc
  obtain ⟨hp, hr⟩ := «и-чист» h1
  refine ⟨(«свёртка-и-чиста» _ «блоки» {} hr).2, («повторы-снятий-чисты» _ [] hp).1, ?_⟩
  simpa using hm

/-- **Посылки — по своим частям.** Путь `«судитьПосылки»` принял блок посылок ровно
    тогда, когда приняли все четыре его части: правила посылок, поля посылок, строки
    сведения и покрытие вариантов (теоремы ниже). -/
theorem «посылки-по-частям» (s : «Исх») («свои» : List String) («имя_т» «чья» «вердикт» «место» «о_чём» : String)
    («проигран» «ходыСчитаются» : Bool)
    (hc : («судитьПосылки» s «свои» «имя_т» «чья» «вердикт» «место» «о_чём» «проигран» «ходыСчитаются»).«чист») :
    («судитьПравилаПосылок» «свои» «о_чём»).«чист» ∧ («судитьПоляПосылок» s «свои» «имя_т» «чья»).«чист» ∧
      («судитьСведение» «свои» «имя_т»).«чист» ∧
      («судитьПокрытие» s «свои» «имя_т» «вердикт» «место» «проигран» «ходыСчитаются»).«чист» := by
  unfold «судитьПосылки» at hc
  obtain ⟨h123, h4⟩ := «и-чист» hc
  obtain ⟨h12, h3⟩ := «и-чист» h123
  obtain ⟨h1, h2⟩ := «и-чист» h12
  exact ⟨h1, h2, h3, h4⟩

/-- **Правила посылок — правила ядра.** Если путь `«судитьПравилаПосылок»` принял блок,
    то каждая посылка закрыта правилом, которое ядро знает (`«правилаЯдра»`). -/
theorem «правила-посылок-известны» («свои» : List String) («о_чём» : String)
    (hc : («судитьПравилаПосылок» «свои» «о_чём»).«чист») :
    ∀ q ∈ «посылкиБлока» «свои», «правилаЯдра».contains q.«правило» = true := by
  intro q hq
  have h := hc.1
  simp only [«судитьПравилаПосылок», «Суд».«еслиНе»] at h
  split at h
  · rename_i he
    simp only [List.isEmpty_iff, List.filter_eq_nil_iff, List.mem_map] at he
    have := he _ ⟨q, hq, rfl⟩
    simpa using this
  · exact absurd h («беда-не-пуста» _ _)

/-- **Вердикт по объявлению стоит один.** Если путь `«судитьОбъявлениеПравила»` принял
    блок, где назван вердикт правилом либо «по объявлению», то в блоке нет ни посылок,
    ни принципа индукции. -/
theorem «объявление-правила-одно» («свои» : List String) («о_чём» : String)
    (hc : («судитьОбъявлениеПравила» «свои» «о_чём»).«чист») :
    let «обр» := «свои».map «обрезать»
    («обр».any (·.startsWith "правило «") || «обр».any (·.startsWith "по объявлению ")) = true →
      («обр».any (·.startsWith "посылка ")) = false ∧ («обр».any (·.startsWith "принцип тип ")) = false := by
  intro «обр» hp
  have h := hc.1
  simp only [«судитьОбъявлениеПравила»] at h
  have hp' : ((«свои».map «обрезать»).any (·.startsWith "правило «") ||
      («свои».map «обрезать»).any (·.startsWith "по объявлению ")) = true := hp
  simp only [hp', Bool.not_true, Bool.false_eq_true, ↓reduceIte, «Суд».«еслиНе»] at h
  split at h
  · split at h
    · rename_i h1 h2
      exact ⟨by simpa [«обр»] using h2, by simpa [«обр»] using h1⟩
    · exact absurd h («беда-не-пуста» _ _)
  · split at h
    · exact absurd h («беда-не-пуста» _ _)
    · exact absurd h («беда-не-пуста» _ _)

/-- **Строки посылок — по образцам формата.** Если путь `«судитьСтрокиПосылок»` принял
    блок, то каждая его строка, начатая словом из `«образцыПосылок»`, ложится на один из
    образцов этого слова, и строка «объявление» стоит сразу под строкой «принцип». -/
theorem «строки-посылок-по-образцам» («свои» : List String) («о_чём» : String)
    (hc : («судитьСтрокиПосылок» «свои» «о_чём»).«чист») :
    let «обр» := «свои».map «обрезать»
    ∀ i < «обр».length,
      (∀ np ∈ «образцыПосылок», («обр».getD i "").startsWith np.1 = true → np.2.any («поОбразцу» («обр».getD i "")) = true) ∧
      ((«обр».getD i "").startsWith "объявление" = true → i > 0 ∧ («обр».getD (i - 1) "").startsWith "принцип тип " = true) := by
  intro «обр» i hi
  have h := hc.1
  simp only [«судитьСтрокиПосылок», List.flatMap_eq_nil_iff, List.mem_range, List.append_eq_nil_iff] at h
  obtain ⟨h1, h2⟩ := h i hi
  refine ⟨fun np hnp hs => ?_, fun hs => ?_⟩
  · obtain ⟨n, os⟩ := np
    have := h1 (n, os) hnp
    have hs' : ((«свои».map «обрезать»).getD i "").startsWith n = true := hs
    simp only [hs', ↓reduceIte, «если-пусто»] at this
    exact this
  · have hs' : ((«свои».map «обрезать»).getD i "").startsWith "объявление" = true := hs
    simp only [hs', ↓reduceIte, «если-пусто», Bool.and_eq_true, decide_eq_true_eq] at h2
    exact h2

/-- **Поля посылок — по форме и по исходнику.** Если путь `«судитьПоляПосылок»` принял
    блок, то у каждой посылки вид «base» либо «step» и такой, какого ждёт её имя либо
    вариант типа; посылка, закрытая сведением, шагов не объявляет, и случай на её вариант
    в функции есть; посылка, закрытая шагами, объявляет их не меньше одного и не больше,
    чем в случае того же варианта; иначе посылка не закрыта. -/
theorem «поля-посылок-по-форме» (s : «Исх») («свои» : List String) («имя_т» «чья» : String)
    (hc : («судитьПоляПосылок» s «свои» «имя_т» «чья»).«чист») :
    ∀ q ∈ «посылкиБлока» «свои»,
      (q.«вид» = "base" ∨ q.«вид» = "step") ∧ («видПосылкиЖдём» s «свои» q).all (· = q.«вид») = true ∧
      ((q.«закрыта» = "reduction" ∧ q.«шагов» = 0 ∧ «сведениеЕсть» s «свои» «чья» q = true) ∨
       (q.«закрыта» = "term" ∧ q.«шагов» ≥ 1 ∧ («шаговСлучая» s «свои» q.«вариант»).all (q.«шагов» ≤ ·) = true)) := by
  intro q hq
  have h := hc.1
  simp only [«судитьПоляПосылок», List.flatMap_eq_nil_iff] at h
  have := h q hq
  unfold «бедыПоляПосылки» at this
  simp only [List.append_eq_nil_iff, «если-пусто»] at this
  obtain ⟨⟨h1, h2⟩, h3⟩ := this
  simp only [Bool.or_eq_true, decide_eq_true_eq] at h1
  refine ⟨h1, h2, ?_⟩
  split at h3
  · rename_i hr
    simp only [List.append_eq_nil_iff, «если-пусто», decide_eq_true_eq] at h3
    exact Or.inl ⟨hr, h3.1, h3.2⟩
  · rename_i ht
    simp only [List.append_eq_nil_iff, «если-пусто», Bool.and_eq_true, decide_eq_true_eq] at h3
    exact Or.inr ⟨ht, h3.2.1, h3.2.2⟩
  · simp at h3

/-- **Сведение названо посылкой.** Если путь `«судитьСведение»` принял блок, то каждое
    правило, названное строкой «сведение», закрывает хотя бы одну посылку блока. -/
theorem «сведение-названо-посылкой» («свои» : List String) («имя_т» : String)
    (hc : («судитьСведение» «свои» «имя_т»).«чист») :
    ∀ l ∈ («свои».map «обрезать»).filter (·.startsWith "сведение «"),
      ∃ q ∈ «посылкиБлока» «свои», q.«правило» = «ёлочка» l 1 := by
  intro l hl
  have h := hc.1
  simp only [«судитьСведение», List.flatMap_eq_nil_iff, List.mem_map] at h
  have := h _ ⟨l, hl, rfl⟩
  rw [«если-пусто»] at this
  simpa [List.contains_iff_mem] using this

/-- **Принцип — по объявлению типа.** Если путь `«судитьПринцип»` принял принцип
    индукции, то под ним ровно одна строка «объявление», и она такая, какую даёт
    объявление типа довода в исходнике; если исходник тип довода объявил, то по такому
    типу индукция есть, носитель принципа следует из вида объявления, и принцип назван
    над этим типом. -/
theorem «принцип-по-объявлению» (s : «Исх») («свои» : List String) («имя_т» «место» : String) (p : «Принцип»)
    (hc : («судитьПринцип» s «свои» «имя_т» «место» p).«чист») :
    let «объявлено» := «объявленоПринципа» s «свои» «место» p
    let «об» := s.«объявлениеТипа» («имяТипа» «объявлено»)
    ((«свои».map «обрезать»).filter (·.startsWith "объявление")) = [«объявлениеЖдём» p «об»] ∧
      («объявлено» ≠ "" → («об».«вид» != .«нет») = true ∧ «носительПоОбъявлению» p «об» = true ∧
        (p.«тип» = «имяТипа» «объявлено» ∨ p.«тип» = «об».«основа»)) := by
  intro «объявлено» «об»
  unfold «судитьПринцип» at hc
  dsimp only at hc
  split at hc
  · exact absurd hc («чист-слово» _ _)
  · obtain ⟨hb, _, _⟩ := hc
    simp only [List.append_eq_nil_iff] at hb
    obtain ⟨⟨h1, h2⟩, h3⟩ := hb
    rw [«если-пусто»] at h2
    simp only [h2, ↓reduceIte, List.append_eq_nil_iff, «если-пусто», decide_eq_true_eq, Bool.or_eq_true] at h3
    obtain ⟨⟨h31, h32⟩, h33⟩ := h3
    refine ⟨?_, fun hne => ?_⟩
    · rcases h33 with h | h
      · exact absurd h h32
      · revert h2 h31 h
        generalize List.filter (fun x => x.startsWith "объявление") (List.map «обрезать» «свои») = L
        intro h2 h31 h
        match L with
        | [] => simp at h2
        | [a] =>
          simp only [List.headD_cons] at h
          subst h
          rfl
        | _ :: _ :: _ => simp at h31
    · have hne' : «объявленоПринципа» s «свои» «место» p ≠ "" := hne
      simp only [ne_eq, hne', not_false_eq_true, ↓reduceIte, List.append_eq_nil_iff, «если-пусто»,
        Bool.or_eq_true, decide_eq_true_eq] at h1
      obtain ⟨⟨ha, hb'⟩, hc'⟩ := h1
      refine ⟨ha, ?_, hc'⟩
      rcases hb' with hb' | hb'
      · simp only [bne, hb', Bool.not_true, Bool.false_eq_true] at ha
      · exact hb'

/-- Принятое покрытие принципа: что `«покрытиеПринципа»` требует, когда принял. -/
theorem «покрытие-принципа» (s : «Исх») («свои» : List String) («имя_т» «место» : String) (p : «Принцип»)
    (hc : («покрытиеПринципа» s «свои» «имя_т» «место» p).«чист») :
    let «посылки» := «посылкиБлока» «свои»
    («судитьПринцип» s «свои» «имя_т» «место» p).«чист» ∧
    (∀ w, p.«носитель» ≠ .«чужой» w) ∧
    ((p.«носитель» == .«отрезокФормой») = true → «посылки».length = 2 ∧
      («посылки».filter (fun q => q.«имя» = "дно" && q.«вид» = "base")).length = 1 ∧
      («посылки».filter (fun q => q.«имя» = "спуск" && q.«вид» = "step")).length = 1) ∧
    ((«свои».map «обрезать»).find? (·.startsWith "индукция по «")).all (fun l => «ёлочка» l 1 = p.«по») = true ∧
    «доводИндукцииЕсть» s «свои» «место» p = true ∧
    (∀ q ∈ «посылки», «имяПосылкиСвоё» p q = true) ∧
    ((p.«носитель» != .«алгебра») = false →
      (s.«вариантыТипаПринципа» p.«тип»).length = «посылки».length ∧
      ∀ v ∈ s.«вариантыТипаПринципа» p.«тип», ∃ q ∈ «посылки», q.«вариант» = v) := by
  intro «посылки»
  unfold «покрытиеПринципа» at hc
  dsimp only at hc
  split at hc
  · rename_i hw
    obtain ⟨_, hps⟩ := «и-чист» hc
    simp [hps.2.2] at hw
  · obtain ⟨hb, hn, hw⟩ := hc
    simp only [«Суд».«и», List.append_eq_nil_iff, List.flatMap_eq_nil_iff, «если-пусто»] at hb hn hw
    obtain ⟨⟨⟨⟨⟨⟨⟨h1, h2⟩, h3⟩, hps⟩, h4⟩, h5⟩, h6⟩, h7⟩ := hb
    refine ⟨⟨hps, hn.2, hw.2⟩, ?_, ?_, h4, h5, h6, ?_⟩
    · intro w hw'
      rw [hw'] at h1
      simp at h1
    · intro hf
      simp only [hf, ↓reduceIte, «если-пусто», Bool.and_eq_true, decide_eq_true_eq] at h3
      exact ⟨h3.1.1, h3.1.2, h3.2⟩
    · intro ha
      simp only [ha, Bool.false_eq_true, ↓reduceIte, List.append_eq_nil_iff, «если-пусто», decide_eq_true_eq,
        List.isEmpty_iff, List.filter_eq_nil_iff, Bool.not_eq_true', List.any_eq_false] at h7
      refine ⟨h7.1, fun v hv => ?_⟩
      have := h7.2 v hv
      exact Classical.byContradiction fun hne => this (fun x hx hxv => hne ⟨x, hx, hxv⟩)

/-- **Посылки покрывают варианты.** Если путь `«судитьПокрытие»` принял блок с вердиктом
    «доказано», то каждая посылка доказана; ни одна не сведена правилом без записанного
    хода, когда утверждение не проиграно; а при принципе индукции — принцип по объявлению
    типа (теорема «принцип-по-объявлению»), носитель известен, спуск формой — ровно «дно»
    base и «спуск» step, индукция идёт по доводу, который у места есть, посылки названы
    своими именами, и у принципа над алгеброй посылок столько же, сколько вариантов типа,
    и каждый вариант типа покрыт посылкой. Сами посылки судят ходы и крюки — их строки
    долга. -/
theorem «посылки-покрывают-варианты» (s : «Исх») («свои» : List String) («имя_т» «вердикт» «место» : String)
    («проигран» «ходыСчитаются» : Bool)
    (hc : («судитьПокрытие» s «свои» «имя_т» «вердикт» «место» «проигран» «ходыСчитаются»).«чист»)
    (hv : «вердикт» = "доказано") :
    (∀ q ∈ «посылкиБлока» «свои», q.«вердикт» = "доказано") ∧
    («проигран» = false → «посылкиВДолгу» «свои» «ходыСчитаются» = []) ∧
    ∀ p, «принципБлока» «свои» = some p → («покрытиеПринципа» s «свои» «имя_т» «место» p).«чист» := by
  unfold «судитьПокрытие» at hc
  dsimp only at hc
  have key : ∀ r : «Суд», (r.«еслиНе» (decide («вердикт» ≠ "доказано") ||
        decide ((List.filter (fun x => decide (x.«вердикт» ≠ "доказано")) («посылкиБлока» «свои»)).length = 0))
        (s!"теорема «{«имя_т»}»: вердикт «доказано», а посылок не доказано {(List.filter (fun x => decide (x.«вердикт» ≠ "доказано")) («посылкиБлока» «свои»)).length}")).«чист» →
      r.«чист» ∧ ∀ q ∈ «посылкиБлока» «свои», q.«вердикт» = "доказано" := by
    intro r hr
    unfold «Суд».«еслиНе» at hr
    split at hr
    · rename_i hcnd
      refine ⟨hr, fun q hq => ?_⟩
      simp only [hv, ne_eq, not_true_eq_false, decide_false, Bool.false_or, decide_eq_true_eq,
        List.length_eq_zero_iff, List.filter_eq_nil_iff, decide_eq_true_eq, Decidable.not_not] at hcnd
      exact hcnd q hq
    · exact absurd hr («чист-беда» _ _)
  split at hc
  · obtain ⟨hr0, hq⟩ := key _ hc
    refine ⟨hq, fun hp => ?_, fun p hp => by rename_i hn; rw [hn] at hp; cases hp⟩
    have := hr0.2.2
    simp only [hp, Bool.not_false, ↓reduceIte, List.map_eq_nil_iff] at this
    exact this
  · rename_i p0 hp0
    obtain ⟨h1, h2⟩ := «и-чист» hc
    obtain ⟨hr0, hq⟩ := key _ h1
    refine ⟨hq, fun hp => ?_, fun p hp => ?_⟩
    · have := hr0.2.2
      simp only [hp, Bool.not_false, ↓reduceIte, List.map_eq_nil_iff] at this
      exact this
    · rw [hp0] at hp
      cases hp
      exact h2

/-! ## Теорема исходника: разметка, гипотезы, цель, имена, число шагов, закрытие -/

theorem «допущения-по-исходнику» (s : «Исх») («имяТ» : String) (j : Nat) (ds : List String)
    (h : «бедыДопущений» s «имяТ» j ds = []) : ∀ d ∈ ds, «т» («уголок» d 1) = «т» (s.«допущениеНаСтроке» d) := by
  induction ds generalizing j with
  | nil => intro d hd; simp at hd
  | cons d ds ih =>
    intro x hx
    simp only [«бедыДопущений», List.append_eq_nil_iff, «если-пусто», decide_eq_true_eq] at h
    rcases List.mem_cons.mp hx with rfl | hx
    · exact h.1
    · exact ih (j + 1) h.2 x hx

/-- **Разметка теоремы — по исходнику.** Если путь `«судитьРазметку»` принял теорему, то
    строка её начала — «теорема «имя»» либо «следует «имя»», разметка записи (теорема,
    дано, допущения, цель, индукция, случаи, шаги, «доказано») совпадает с разметкой
    печати исходника, и каждое допущение записи — утверждение своей строки «дано». -/
theorem «разметка-по-исходнику» (t : «Теорема») («начало» : Nat) (hc : («судитьРазметку» t «начало»).«чист») :
    (t.«исх».«по» «начало» = s!"теорема «{t.«имяТ»}»" ∨ t.«исх».«по» «начало» = s!"следует «{t.«имяТ»}»") ∧
    («разметкиТеоремы» t «начало»).1 = («разметкиТеоремы» t «начало»).2 ∧
    ∀ d ∈ t.«все» "допущение ", «т» («уголок» d 1) = «т» (t.«исх».«допущениеНаСтроке» d) := by
  have h := hc.1
  simp only [«судитьРазметку», List.append_eq_nil_iff, «если-пусто», Bool.or_eq_true, decide_eq_true_eq] at h
  exact ⟨h.1.1, h.1.2, «допущения-по-исходнику» _ _ 1 _ h.2⟩

/-- **Гипотезы теоремы — допущения утверждения.** Если путь `«судитьСнятиеГипотез»`
    принял теорему, то каждая её гипотеза («допущение») — факт типа довода («не меньше
    0» над натуральным) либо конъюнкт ограничения «таких что» или требования функции. -/
theorem «гипотезы-сняты» (t : «Теорема») (hc : («судитьСнятиеГипотез» t).«чист») :
    ∀ d ∈ t.«все» "допущение ", t.«фактТипа» («т» («уголок» d 1)) = true ∨
      t.«ограниченияГипотез».any («среди_конъюнктов» («т» («уголок» d 1)) ·) = true := by
  intro d hd
  have h := hc.1
  simp only [«судитьСнятиеГипотез», List.flatMap_eq_nil_iff] at h
  have := h d hd
  rw [«если-пусто»] at this
  simpa using this

/-- **Теорема доказывает обещанное.** Если путь `«судитьЦель»` принял теорему, то её цель
    (`«утверждаемое»`) совпадает с тем, что обещает утверждение (`«обещано»`), с точностью до
    свидетеля существования. -/
theorem «цель-обещанная» (t : «Теорема») («где» : Nat) (hc : («судитьЦель» t «где»).«чист») :
    t.«цельОбещанная» «где» = true := by
  have h := hc.1
  simp only [«судитьЦель», «Суд».«еслиНе»] at h
  split at h
  · assumption
  · exact absurd h («беда-не-пуста» _ _)

/-- **Имена записи — имена исходника.** Если путь `«судитьИмена»` принял теорему, то каждая
    строка «дано «n»» либо «индукция по «n»» записи с номером строки называет имя, что
    стоит на этой строке исходника. -/
theorem «имена-по-исходнику» (t : «Теорема») (hc : («судитьИмена» t).«чист») :
    ∀ z ∈ t.«обр», «имяНаСтроке» t.«исх» z = true := by
  intro z hz
  have h := hc.1
  simp only [«судитьИмена», List.flatMap_eq_nil_iff] at h
  have := h z hz
  rw [«если-пусто»] at this
  exact this

/-- **Число шагов случая — объявленное.** Если путь `«судитьЧислоШагов»` принял теорему,
    то у каждого случая записи шагов написано ровно столько, сколько объявлено. -/
theorem «шаги-по-объявлению» (t : «Теорема») (hc : («судитьЧислоШагов» t).«чист») :
    ∀ c ∈ «случаиШагов» t.«обр», c.1 = c.2.1 := by
  intro c hcm
  have h := hc.1
  simp only [«судитьЧислоШагов», List.flatMap_eq_nil_iff] at h
  obtain ⟨k, f, g⟩ := c
  have := h (k, f, g) hcm
  simp only [«если-пусто», decide_eq_true_eq] at this
  exact this

/-- **Доказанная теорема закрыта.** Если путь `«судитьЗакрытие»` принял теорему с
    вердиктом «доказано», то в записи стоит «следовательно доказано да», закрывающих шагов
    не меньше, чем случаев (и не меньше одного), и у каждого случая есть закрывающий шаг. -/
theorem «закрытие-полное» (t : «Теорема») (hc : («судитьЗакрытие» t).«чист») (hv : t.«вердикт» = "доказано") :
    «слово» («после» (t.«первая» "следовательно доказано ") "доказано ") 1 = "да" ∧
    ((t.«все» "шаг ").filter (fun x => «шагВид» x = "закрывающий")).length ≥
      (if (t.«все» "случай строка").length > 0 then (t.«все» "случай строка").length else 1) ∧
    «незакрытыеСлучаи» t.«обр» = 0 := by
  have h := hc.1
  simp only [«судитьЗакрытие», «еслиНе-беды», hv, decide_true, Bool.not_true,
    Bool.false_or, decide_eq_true_eq] at h
  exact ⟨h.1.1.2, h.1.2, h.2⟩

/-- **Теорема исходника принята по частям.** Если путь `«судитьТеорему»` принял теорему,
    то её приняли разметка, гипотезы, цель, имена, число шагов и закрытие (теоремы выше),
    шаги теоремы (`«Теорема».«судитьШаги»`) и прогон ходов (`«проигратьБлок»`) без беды и
    без места на слове, посылки (`«судитьПосылки»`), и ни один шаг не остался на слове: шаги
    по закону закрыл блок `вывод`, принятый моделью (`«Суд».«выводом»`), а шаги по телу —
    прогон узлов (`«проигратьУзел»`). Сами шаги, ходы и узлы судят их строки долга. -/
theorem «теорема-по-частям» (t : «Теорема») («заг» : String) («строки» : List String) («опр» : List «Определение»)
    (hc : («судитьТеорему» t «заг» «строки» «опр»).«чист») :
    let «цель» := t.«цельСтроки»
    let a := t.«судитьШаги» «цель»
    let p := «проигратьБлок» («обстТеоремы» t «цель»)
    let «узел» := if t.«вердикт» = "доказано" then some («проигратьУзел» t.«счёт» («местоТеоремы» t «цель»)) else none
    («судитьРазметку» t («номерПосле» (t.«первая» "теорема «") "строка ")).«чист» ∧ («судитьСнятиеГипотез» t).«чист» ∧
    («судитьЦель» t («номерПосле» «заг» "строка ")).«чист» ∧ («судитьИмена» t).«чист» ∧ («судитьЧислоШагов» t).«чист» ∧
    a.«суд».«чист» ∧ («судитьЗакрытие» t).«чист» ∧ p.«беды» = [] ∧ p.«неВзялся» = [] ∧
    («судитьПосылки» t.«исх» t.«обр» t.«имяТ» t.«чья» t.«вердикт» t.«место» s!"теорема «{t.«имяТ»}»" («узелПроигран» «узел») true).«чист» ∧
    (a.«закон» = [] ∨ (t.«выводЗаконов?» a.«закон» = true ∧ (t.«выводСуд» «заг» «строки» «опр»).«чист»)) ∧
    (a.«тело» = [] ∨ «узелПроигран» «узел» = true ∨ (p.«ходамиВсе» t.«обр» = true ∧ a.«тело».all «поПредположению» = true)) := by
  intro «цель» a p «узел»
  unfold «судитьТеорему» at hc
  obtain ⟨h5, hx⟩ := «слово-приписано-чисто» hc
  obtain ⟨h4, hpos⟩ := «и-чист» h5
  have h3 := «ложь-узла-чисто» h4
  obtain ⟨h2, hnv⟩ := «слово-приписано-чисто» h3
  obtain ⟨h1, hpb⟩ := «еслиНе-чисто» h2
  obtain ⟨h0, hq⟩ := «если-и-чисто» h1
  obtain ⟨h06, h7⟩ := «и-чист» h0
  obtain ⟨h05, h6⟩ := «и-чист» h06
  obtain ⟨h04, h5'⟩ := «и-чист» h05
  obtain ⟨h03, h4'⟩ := «и-чист» h04
  obtain ⟨h02, h3'⟩ := «и-чист» h03
  obtain ⟨h01, h2'⟩ := «и-чист» h02
  obtain ⟨_, h1'⟩ := «и-чист'» h01
  simp only [List.append_eq_nil_iff, List.map_eq_nil_iff] at hx hnv
  refine ⟨h1', h2', h3', h4', h5', h6, h7, List.isEmpty_iff.mp hpb, hnv, hpos, ?_, ?_⟩
  · by_cases hz : t.«выводЗаконов?» (t.«судитьШаги» t.«цельСтроки»).«закон» = true
    · by_cases hq' : ((t.«выводСуд» «заг» «строки» «опр»).«беды».isEmpty && (t.«выводСуд» «заг» «строки» «опр»).«непонято».isEmpty) = true
      · exact Or.inr ⟨hz, hq hz⟩
      · left
        have := hx.1
        simp only [hz, Bool.true_and, hq'] at this
        exact this
    · left
      have := hx.1
      simp only [hz, Bool.false_and, Bool.false_eq_true, ↓reduceIte] at this
      exact this
  · by_cases hu : «узелПроигран» (if t.«вердикт» = "доказано" then some («проигратьУзел» t.«счёт» («местоТеоремы» t t.«цельСтроки»))
        else none) = true
    · exact Or.inr (Or.inl hu)
    · by_cases hw : ((«проигратьБлок» («обстТеоремы» t t.«цельСтроки»)).«ходамиВсе» t.«обр» &&
          (t.«судитьШаги» t.«цельСтроки»).«тело».all «поПредположению») = true
      · simp only [Bool.and_eq_true] at hw
        exact Or.inr (Or.inr hw)
      · left
        have := hx.2
        simp only [hu, hw, Bool.false_or, Bool.false_eq_true, ↓reduceIte] at this
        exact this

/-! ## Тотальность: модель зовов и фундированность

Модель: зов `зов (g, b) (f, a)` — вычисление функции `f` на значении `a` зовёт `g` на
значении `b`. О языке — две посылки (`«ЯзыкЗовов»`): каждый зов из тела `f` назван в её
теле (`«Исх».«зовы»`), и самовызов, чьи все записанные в теле доводы на убывающем месте —
убывающие формы (часть значения, связанная разбором убывающего довода, либо «довод минус
положительный литерал» над отрезком с дном 0), уменьшает меру значения `μ`. Теорема: если
путь `«судитьТотальности»` принял блоки записи, то зовы между функциями с блоками
фундированы — бесконечной цепочки зовов нет, каждая такая функция завершается. -/

/-- Фундированность по рангу и мере: если каждый зов идёт к функции меньшего ранга
    либо к той же функции на меньшей мере, бесконечной цепочки зовов нет. -/
theorem «фундированность-по-рангу» {α : Type} (R : String × α → String × α → Prop) («ранг» : String → Nat)
    (μ : α → Nat) (h : ∀ g b f a, R (g, b) (f, a) → «ранг» g < «ранг» f ∨ (g = f ∧ μ b < μ a)) :
    WellFounded R := by
  have hw : WellFounded (fun (p q : Nat × Nat) => Prod.Lex (· < ·) (· < ·) p q) :=
    (Prod.lex Nat.lt_wfRel Nat.lt_wfRel).wf
  refine Subrelation.wf (r := InvImage (fun (p q : Nat × Nat) => Prod.Lex (· < ·) (· < ·) p q)
    (fun x => («ранг» x.1, μ x.2))) ?_ (InvImage.wf _ hw)
  intro ⟨g, b⟩ ⟨f, a⟩ hr
  rcases h g b f a hr with h1 | ⟨rfl, h2⟩
  · exact Prod.Lex.left _ _ h1
  · exact Prod.Lex.right _ h2

theorem «свернуть-ранги-определено» (rk : String → Option Nat) : ∀ (gl : List String) (acc : Option Nat) (r : Nat),
    gl.foldl (fun acc g => match acc, rk g with
      | some a, some r => some (max a (r + 1)) | _, _ => none) acc = some r → acc.isSome
  | [], acc, r, h => by simp at h; simp [h]
  | g :: gl, acc, r, h => by
    simp only [List.foldl_cons] at h
    have := «свернуть-ранги-определено» rk gl _ r h
    revert this
    cases acc <;> simp

/-- Свёртка рангов: каждый зовомый с рангом, и его ранг меньше итога; итог не меньше
    начального. -/
theorem «свернуть-ранги-меньше» (rk : String → Option Nat) : ∀ (gl : List String) (a0 r : Nat),
    gl.foldl (fun acc g => match acc, rk g with
      | some a, some r => some (max a (r + 1)) | _, _ => none) (some a0) = some r →
    a0 ≤ r ∧ ∀ g ∈ gl, ∃ rg, rk g = some rg ∧ rg < r
  | [], a0, r, h => by simp at h; exact ⟨by omega, fun g hg => by simp at hg⟩
  | g :: gl, a0, r, h => by
    simp only [List.foldl_cons] at h
    cases hg : rk g with
    | none =>
      rw [hg] at h
      have := «свернуть-ранги-определено» rk gl none r h
      simp at this
    | some rg =>
      rw [hg] at h
      obtain ⟨h1, h2⟩ := «свернуть-ранги-меньше» rk gl _ r h
      refine ⟨by omega, fun x hx => ?_⟩
      rcases List.mem_cons.mp hx with rfl | hx
      · exact ⟨rg, hg, by omega⟩
      · exact h2 x hx

theorem «свернуть-ранги-топливо» (rk rk' : String → Option Nat) (hk : ∀ g r, rk g = some r → rk' g = some r) :
    ∀ (gl : List String) (acc : Option Nat) (r : Nat),
    gl.foldl (fun acc g => match acc, rk g with
      | some a, some r => some (max a (r + 1)) | _, _ => none) acc = some r →
    gl.foldl (fun acc g => match acc, rk' g with
      | some a, some r => some (max a (r + 1)) | _, _ => none) acc = some r
  | [], acc, r, h => h
  | g :: gl, acc, r, h => by
    simp only [List.foldl_cons] at h ⊢
    cases acc with
    | none =>
      have := «свернуть-ранги-определено» rk gl none r (by simpa using h)
      simp at this
    | some a =>
      cases hg : rk g with
      | none =>
        rw [hg] at h
        have := «свернуть-ранги-определено» rk gl none r h
        simp at this
      | some rg =>
        rw [hg] at h
        rw [hk g rg hg]
        exact «свернуть-ранги-топливо» rk rk' hk gl _ r h

/-- Ранг с бо́льшим топливом не меняется. -/
theorem «ранг-топливо» («все» : List «Тотальность») : ∀ (n : Nat) (f : String) (r : Nat),
    «ранг» «все» n f = some r → «ранг» «все» (n + 1) f = some r
  | 0, _, _, h => by simp [«ранг»] at h
  | n + 1, f, r, h => by
    unfold «ранг» at h ⊢
    split at h
    · exact «свернуть-ранги-топливо» _ _ («ранг-топливо» «все» n) _ _ _ h
    · exact h

theorem «ранг-топливо-больше» («все» : List «Тотальность») (n m : Nat) (f : String) (r : Nat)
    (hnm : n ≤ m) (h : «ранг» «все» n f = some r) : «ранг» «все» m f = some r := by
  induction hnm with
  | refl => exact h
  | step _ ih => exact «ранг-топливо» «все» _ f r ih

/-- У композиции с рангом каждый записанный зовомый имеет ранг меньше. -/
theorem «ранг-композиции» («все» : List «Тотальность») (n : Nat) (f : String) (r : Nat) (nm : String) (st : Nat)
    (zs : List «Зов») (hf : «все».find? (·.«имя» = f) = some (.«композиция» nm st zs))
    (h : «ранг» «все» (n + 1) f = some r) :
    ∀ g ∈ «зовомыеЗаписи» zs, ∃ rg, «ранг» «все» n g = some rg ∧ rg < r := by
  unfold «ранг» at h
  rw [hf] at h
  exact («свернуть-ранги-меньше» _ _ 0 r h).2

/-- Самовызов от `x` в строке `i` — убывающая форма по записи и исходнику. Структурная
    рекурсия: `x` — часть, названная витком строки `i`, поле варианта той же суммы `d`, и
    `x` связано этим полем в случае разбора убывающего довода `a`. Шаговая: `x` — «a минус
    c» с положительным литералом c, и дно `d` — отрезок с дном 0. -/
def «убываетВЗаписи» (s : «Исх») (f a d : String) («структурный» : Bool) (vs : List «Виток») (i : Nat) (x : String) : Prop :=
  if «структурный» then
    ∃ v ∈ vs, v.«строка» = i ∧ ∃ «поле» «в», v.«часть» = some (x, «поле», «в») ∧
      (match s.«строкаВарианта» d «в» with
        | some l => («поляВарианта» l).any (fun q => q.1 = «поле» && «голо» q.2 = d && q.2.startsWith "«")
        | none => false) = true ∧
      (s.«внутри» f).any (fun j =>
        let l := s.«строка» j
        l.startsWith "случай " && «имяВарианта» (l.«сн» 7) = «в» &&
          ((l.splitOn s!"{«поле»} как {x}").length > 1) && s.«разборСлучая» f j = a) = true
  else
    (s.«видТипа» d == .«отрезок») = true ∧
    ∃ y c m, «надвое» x "минус" = some (y, c) ∧ «ужать» y = a ∧ «Разбор».«литерал?» c = some m ∧ m > 0

/-- Строки тела, где тело упоминает саму функцию. -/
def «строкиСамовызовов» (s : «Исх») (f : String) : List Nat :=
  ((s.«зовы» f).filter (·.1 = f) |>.map (·.2)).eraseDups

theorem «рекурсия-по-модели» (s : «Исх») (k : Array String) (f : String) («структурный» : Bool) (n : Nat)
    (a d : String) (vs : List «Виток») («сам» : List (String × Nat)) («чужие» : List String)
    (h : «бедыРекурсии» s k f «структурный» n a d vs «сам» «чужие» = []) :
    «сам» ≠ [] ∧ «чужие» = [] ∧ ∀ i ∈ («сам».map (·.2)).eraseDups, ∀ x ∈ «самовызовыСтроки» k f i n,
      «убываетВЗаписи» s f a d «структурный» vs i x := by
  unfold «бедыРекурсии» at h
  simp only [List.append_eq_nil_iff, List.flatMap_eq_nil_iff] at h
  obtain ⟨⟨⟨⟨⟨⟨⟨h1, h2⟩, h3⟩, hkind⟩, h5⟩, hvit⟩, hself⟩, hch⟩ := h
  refine ⟨?_, ?_, fun i hi x hx => ?_⟩
  · rw [«если-пусто»] at h1
    simpa using h1
  · cases «чужие» with
    | nil => rfl
    | cons g gs => have := hch g (List.mem_cons_self ..); simp at this
  · unfold «бедыСамовызовов» at hself
    simp only [List.append_eq_nil_iff, List.flatMap_eq_nil_iff] at hself
    have hx' := (hself i hi).2 x hx
    rw [«если-пусто»] at hx'
    unfold «убываетВЗаписи»
    cases hs : «структурный»
    · simp only [hs, «самовызовУбывает», Bool.false_eq_true, ↓reduceIte] at hx' hkind ⊢
      rw [«если-пусто»] at hkind
      refine ⟨hkind, ?_⟩
      revert hx'
      cases «надвое» x "минус" with
      | none => simp
      | some p =>
        obtain ⟨y, c⟩ := p
        intro hx'
        simp only [Bool.and_eq_true, decide_eq_true_eq] at hx'
        obtain ⟨hy, hc⟩ := hx'
        revert hc
        cases hm : «Разбор».«литерал?» c with
        | none => simp
        | some m => intro hc; exact ⟨y, c, m, rfl, hy, hm, by simpa using hc⟩
    · simp only [hs, «самовызовУбывает», ↓reduceIte] at hx' hvit ⊢
      obtain ⟨v, hv, hv2⟩ := List.any_eq_true.mp hx'
      simp only [Bool.and_eq_true, decide_eq_true_eq] at hv2
      obtain ⟨hvi, hvp⟩ := hv2
      refine ⟨v, hv, hvi, ?_⟩
      have hw := hvit v hv
      unfold «витокСтруктуры» at hw
      revert hvp hw
      cases hp : v.«часть» with
      | none => simp
      | some q =>
        obtain ⟨y, «поле», «в»⟩ := q
        intro hvp hw
        simp only [decide_eq_true_eq] at hvp
        subst hvp
        simp only [List.append_eq_nil_iff, «если-пусто»] at hw
        exact ⟨«поле», «в», rfl, hw.1.1, hw.1.2⟩

/-- **Блок тотальности принят — по модели зовов.** Если путь `«судитьБлок»` принял блок,
    то у композиции тело себя не зовёт, каждый зов тела записан, и у каждого записанного
    зовомого есть свой блок; у рекурсии (structure, step) тело других функций не зовёт, и
    каждый самовызов в каждой строке, где тело упоминает себя, — убывающая форма
    (`«убываетВЗаписи»`). -/
theorem «блок-по-модели» (s : «Исх») («все» : List «Тотальность») (t : «Тотальность»)
    (hc : («судитьБлок» s «все» t).«чист») :
    let f := t.«имя»
    let k := «кодИсходника» s.«текст»
    (∀ nm st zs, t = .«композиция» nm st zs →
      (∀ p ∈ s.«зовы» f, p.1 ≠ f) ∧ (∀ p ∈ s.«зовы» f, p.1 ∈ «зовомыеЗаписи» zs) ∧
      ∀ g ∈ «зовомыеЗаписи» zs, «все».any (·.«имя» = g) = true) ∧
    (∀ nm st m a d vs sc («структурный» : Bool),
      (t = .«структура» nm st m a d vs sc ∧ «структурный» = true ∨ t = .«шаг» nm st m a d vs sc ∧ «структурный» = false) →
      (∃ p ∈ s.«зовы» f, p.1 = f) ∧ (∀ p ∈ s.«зовы» f, p.1 = f) ∧
      ∀ i ∈ «строкиСамовызовов» s f, ∀ x ∈ «самовызовыСтроки» k f i m, «убываетВЗаписи» s f a d «структурный» vs i x) := by
  intro f k
  obtain ⟨hb, _, _⟩ := hc
  cases t with
  | «композиция» nm0 st0 zs0 =>
    refine ⟨fun nm st zs ht => ?_, fun nm st m a d vs sc b ht => ?_⟩
    · cases ht
      simp only [«судитьБлок», List.append_eq_nil_iff] at hb
      obtain ⟨⟨_, hk⟩, _⟩ := hb
      unfold «бедыКомпозиции» at hk
      simp only [List.append_eq_nil_iff, List.flatMap_eq_nil_iff, «если-пусто», List.isEmpty_iff,
        List.filter_eq_nil_iff, decide_eq_true_eq] at hk
      obtain ⟨⟨hs, hz⟩, hch⟩ := hk
      have hself : ∀ p ∈ s.«зовы» f, p.1 ≠ f := fun p hp => hs p hp
      refine ⟨hself, fun p hp => ?_, fun g hg => ?_⟩
      · have hm : p.1 ∈ (List.map (fun x => x.fst) (List.filter (fun x => decide (x.fst ≠ f)) (s.«зовы» f))).eraseDups := by
          rw [List.mem_eraseDups]
          exact List.mem_map.mpr ⟨p, List.mem_filter.mpr ⟨hp, by simpa using hself p hp⟩, rfl⟩
        exact List.contains_iff_mem.mp (hch p.1 hm)
      · obtain ⟨z, hzm, hzg⟩ := List.mem_filterMap.mp hg
        have := hz z hzm
        cases z with
        | «прим» _ => simp at hzg
        | «функ» g' m' =>
          simp only [Option.some.injEq] at hzg
          subst hzg
          simp only [List.append_eq_nil_iff, «если-пусто»] at this
          exact this.1.2
    · rcases ht with ⟨ht, _⟩ | ⟨ht, _⟩ <;> cases ht
  | «структура» nm0 st0 m0 a0 d0 vs0 sc0 =>
    refine ⟨(fun nm st zs ht => by cases ht), fun nm st m a d vs sc b ht => ?_⟩
    rcases ht with ⟨ht, hb'⟩ | ⟨ht, _⟩
    · cases ht
      subst hb'
      simp only [«судитьБлок», List.append_eq_nil_iff] at hb
      obtain ⟨hne0, hch, hdec⟩ := «рекурсия-по-модели» _ _ _ _ _ _ _ _ _ _ hb.2
      refine ⟨?_, fun p hp => Classical.byContradiction fun hne => ?_, hdec⟩
      · obtain ⟨p, hp⟩ := List.exists_mem_of_ne_nil _ hne0
        obtain ⟨hp1, hp2⟩ := List.mem_filter.mp hp
        exact ⟨p, hp1, by simpa using hp2⟩
      have : p.1 ∈ (List.map (fun x => x.fst) (List.filter (fun x => decide (x.fst ≠ f)) (s.«зовы» f))).eraseDups := by
        rw [List.mem_eraseDups]
        exact List.mem_map.mpr ⟨p, List.mem_filter.mpr ⟨hp, by simpa using hne⟩, rfl⟩
      rw [hch] at this
      simp at this
    · cases ht
  | «шаг» nm0 st0 m0 a0 d0 vs0 sc0 =>
    refine ⟨(fun nm st zs ht => by cases ht), fun nm st m a d vs sc b ht => ?_⟩
    rcases ht with ⟨ht, _⟩ | ⟨ht, hb'⟩
    · cases ht
    · cases ht
      subst hb'
      simp only [«судитьБлок», List.append_eq_nil_iff] at hb
      obtain ⟨hne0, hch, hdec⟩ := «рекурсия-по-модели» _ _ _ _ _ _ _ _ _ _ hb.2
      refine ⟨?_, fun p hp => Classical.byContradiction fun hne => ?_, hdec⟩
      · obtain ⟨p, hp⟩ := List.exists_mem_of_ne_nil _ hne0
        obtain ⟨hp1, hp2⟩ := List.mem_filter.mp hp
        exact ⟨p, hp1, by simpa using hp2⟩
      have : p.1 ∈ (List.map (fun x => x.fst) (List.filter (fun x => decide (x.fst ≠ f)) (s.«зовы» f))).eraseDups := by
        rw [List.mem_eraseDups]
        exact List.mem_map.mpr ⟨p, List.mem_filter.mpr ⟨hp, by simpa using hne⟩, rfl⟩
      rw [hch] at this
      simp at this

/-- Блок рекурсии, у которого каждый самовызов — убывающая форма; у композиции — ложь
    (композиция себя не зовёт). -/
def «убывающийБлок» (s : «Исх») (t : «Тотальность») : Prop :=
  match t with
  | .«композиция» _ _ _ => False
  | .«структура» f _ m a d vs _ => ∀ i ∈ «строкиСамовызовов» s f, ∀ x ∈ «самовызовыСтроки» («кодИсходника» s.«текст») f i m,
      «убываетВЗаписи» s f a d true vs i x
  | .«шаг» f _ m a d vs _ => ∀ i ∈ «строкиСамовызовов» s f, ∀ x ∈ «самовызовыСтроки» («кодИсходника» s.«текст») f i m,
      «убываетВЗаписи» s f a d false vs i x

/-- **Тотальности приняты — по блокам и по рангу.** Если путь `«судитьТотальности»`
    принял блоки записи, то каждый разобранный блок принят путём `«судитьБлок»`, и у каждой
    функции с блоком считается ранг зовов (кругов через композиции нет). -/
theorem «тотальности-по-блокам» (s : «Исх») («обещано» : Option Nat) («блоки» : List (List String))
    (hc : («судитьТотальности» s «обещано» «блоки»).«чист») :
    let «все» := «блоки».filterMap «разобратьБлок»
    (∀ t ∈ «все», («судитьБлок» s «все» t).«чист») ∧ ∀ t ∈ «все», («ранг» «все» («все».length + 1) t.«имя»).isSome := by
  intro «все»
  unfold «судитьТотальности» at hc
  obtain ⟨h1, hr⟩ := «еслиНе-чисто» hc
  obtain ⟨h0, _⟩ := «еслиНе-чисто» h1
  refine ⟨(«свёртка-и-чиста» («судитьБлок» s «все») «все» _ h0).2, fun t ht => ?_⟩
  simp only [List.isEmpty_iff, List.map_eq_nil_iff, List.filter_eq_nil_iff, Option.isNone_iff_eq_none] at hr
  have := hr t ht
  cases h : «ранг» «все» («все».length + 1) t.«имя» with
  | none => exact absurd h this
  | some _ => rfl

/-- **Принятая тотальность фундирована.** Пусть `зов (g, b) (f, a)` — модель зовов
    программы: вычисление `f` на `a` зовёт `g` на `b`. Посылки о языке: каждый зов из
    тела `f` назван в теле (`hcall`), и самовызов функции, у которой каждый блок —
    убывающий (`«убывающийБлок»`: каждый записанный в теле самовызов — часть значения,
    связанная разбором убывающего довода, либо «довод минус положительный литерал» над
    отрезком), уменьшает меру значения (`hmeasure`). Тогда, если путь `«судитьТотальности»`
    принял блоки записи, зовы между функциями с блоками фундированы: бесконечной цепочки
    зовов нет, и каждая функция с блоком завершается. -/
theorem «тотальность-фундирована» {α : Type} (s : «Исх») («обещано» : Option Nat) («блоки» : List (List String))
    (hc : («судитьТотальности» s «обещано» «блоки»).«чист»)
    («зов» : String × α → String × α → Prop) (μ : α → Nat)
    (hcall : ∀ g b f a, «зов» (g, b) (f, a) → ∃ i, (g, i) ∈ s.«зовы» f)
    (hmeasure : ∀ f a b, «зов» (f, b) (f, a) →
      (∀ t ∈ «блоки».filterMap «разобратьБлок», t.«имя» = f → «убывающийБлок» s t) → μ b < μ a) :
    let «все» := «блоки».filterMap «разобратьБлок»
    WellFounded (fun (q p : String × α) => «зов» q p ∧ «все».any (·.«имя» = q.1) = true ∧ «все».any (·.«имя» = p.1) = true) := by
  intro «все»
  obtain ⟨hblocks, hrank⟩ := «тотальности-по-блокам» s «обещано» «блоки» hc
  let N := «все».length + 1
  refine «фундированность-по-рангу» _ (fun f => («ранг» «все» N f).getD 0) μ ?_
  intro g b f a ⟨hz, hg, hf⟩
  obtain ⟨tf, htf⟩ : ∃ tf, «все».find? (·.«имя» = f) = some tf := by
    cases h : «все».find? (·.«имя» = f) with
    | none =>
      rw [List.find?_eq_none] at h
      obtain ⟨x, hx, hx2⟩ := List.any_eq_true.mp hf
      exact absurd hx2 (h x hx)
    | some t => exact ⟨t, rfl⟩
  have htfm : tf ∈ «все» := List.mem_of_find?_eq_some htf
  have htfn : tf.«имя» = f := by simpa using List.find?_some htf
  obtain ⟨i, hi⟩ := hcall g b f a hz
  have hmod := «блок-по-модели» s «все» tf (hblocks tf htfm)
  simp only [htfn] at hmod
  obtain ⟨hcomp, hrec⟩ := hmod
  cases htf' : tf with
  | «композиция» nm st zs =>
    obtain ⟨hne, hrec', hhave⟩ := hcomp nm st zs htf'
    left
    have hgz := hrec' (g, i) hi
    have hrf := hrank tf htfm
    rw [htfn] at hrf
    obtain ⟨r, hr⟩ := Option.isSome_iff_exists.mp hrf
    rw [htf'] at htf
    obtain ⟨rg, hrg, hlt⟩ := «ранг-композиции» «все» («все».length) f r nm st zs htf hr g hgz
    show («ранг» «все» N g).getD 0 < («ранг» «все» N f).getD 0
    have hN : N = «все».length + 1 := rfl
    rw [hN, «ранг-топливо» «все» _ g rg hrg]
    have hr' : «ранг» «все» («все».length + 1) f = some r := hr
    rw [hr']
    exact hlt
  | «структура» nm st m a0 d vs sc =>
    obtain ⟨_, hall, hdec⟩ := hrec nm st m a0 d vs sc true (Or.inl ⟨htf', rfl⟩)
    have hgf : g = f := hall (g, i) hi
    subst hgf
    right
    refine ⟨rfl, hmeasure g a b hz fun t ht htn => ?_⟩
    have hm2 := «блок-по-модели» s «все» t (hblocks t ht)
    simp only [htn] at hm2
    obtain ⟨hc2, hr2⟩ := hm2
    obtain ⟨⟨p, hp, hp1⟩, _, _⟩ := hrec nm st m a0 d vs sc true (Or.inl ⟨htf', rfl⟩)
    cases ht' : t with
    | «композиция» nm' st' zs' => exact absurd hp1 ((hc2 nm' st' zs' ht').1 p hp)
    | «структура» nm' st' m' a' d' vs' sc' =>
      have := (hr2 nm' st' m' a' d' vs' sc' true (Or.inl ⟨ht', rfl⟩)).2.2
      simp only [«убывающийБлок»]
      have hn : nm' = g := by rw [ht'] at htn; exact htn
      subst hn
      exact this
    | «шаг» nm' st' m' a' d' vs' sc' =>
      have := (hr2 nm' st' m' a' d' vs' sc' false (Or.inr ⟨ht', rfl⟩)).2.2
      simp only [«убывающийБлок»]
      have hn : nm' = g := by rw [ht'] at htn; exact htn
      subst hn
      exact this
  | «шаг» nm st m a0 d vs sc =>
    obtain ⟨_, hall, hdec⟩ := hrec nm st m a0 d vs sc false (Or.inr ⟨htf', rfl⟩)
    have hgf : g = f := hall (g, i) hi
    subst hgf
    right
    refine ⟨rfl, hmeasure g a b hz fun t ht htn => ?_⟩
    have hm2 := «блок-по-модели» s «все» t (hblocks t ht)
    simp only [htn] at hm2
    obtain ⟨hc2, hr2⟩ := hm2
    obtain ⟨⟨p, hp, hp1⟩, _, _⟩ := hrec nm st m a0 d vs sc false (Or.inr ⟨htf', rfl⟩)
    cases ht' : t with
    | «композиция» nm' st' zs' => exact absurd hp1 ((hc2 nm' st' zs' ht').1 p hp)
    | «структура» nm' st' m' a' d' vs' sc' =>
      have := (hr2 nm' st' m' a' d' vs' sc' true (Or.inl ⟨ht', rfl⟩)).2.2
      simp only [«убывающийБлок»]
      have hn : nm' = g := by rw [ht'] at htn; exact htn
      subst hn
      exact this
    | «шаг» nm' st' m' a' d' vs' sc' =>
      have := (hr2 nm' st' m' a' d' vs' sc' false (Or.inr ⟨ht', rfl⟩)).2.2
      simp only [«убывающийБлок»]
      have hn : nm' = g := by rw [ht'] at htn; exact htn
      subst hn
      exact this

/-! ## Утверждение: какими путями принимается доказанное -/

/-- Суд о доказанном утверждении принят — значит принял один из путей решения. -/
theorem «суд-доказанного» (u : «ФормаУтв») («к» : «Контекст») («нечем» : Nat) (r : «Суд»)
    (hc : («судДоказанного» u «к» «нечем» r).«чист») (hd : u.«доказано» = true) :
    r.«чист» ∧
    ((u.«есть» "вывод " = true ∧ (u.«выводСуд» «к»).«чист» ∧ «нечем» = 0) ∨
     (u.«ходамиВерх» = true ∧ («проигратьБлок» (u.«обстХодов» «к»)).«беды» = [] ∧
        («проигратьБлок» (u.«обстХодов» «к»)).«неВзялся» = [] ∧ («проигратьБлок» (u.«обстХодов» «к»)).«проиграно» > 0) ∨
     (u.«пр» = some "правило «кольцо точного целого»" ∧ «кольцоТочногоЦелого» «к».«исх» u.«обр» u.«чья» u.«цель0» = .ok ()) ∨
     (let h := «крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)
      h.«беды» = [] ∧ h.«снял» ≠ "") ∨
     (let h := «крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)
      h.«беды» = [] ∧ u.«ходамиСписка» «к» = true)) := by
  unfold «судДоказанного» at hc
  simp only [hd, Bool.true_and] at hc
  by_cases hv : u.«есть» "вывод " = true
  · simp only [hv, ↓reduceIte] at hc
    by_cases hpx : (!u.«есть» "посылка " && !u.«естьХоды») = true
    · simp only [hpx, ↓reduceIte] at hc
      by_cases hn : «нечем» > 0
      · simp only [hn, ↓reduceIte] at hc
        exact absurd hc («чист-слово» _ _)
      · simp only [hn, ↓reduceIte] at hc
        obtain ⟨hr0, hq⟩ := «и-чист'» hc
        obtain ⟨hr1, _⟩ := «еслиНе-чисто» hr0
        obtain ⟨hr2, _⟩ := «еслиНе-чисто» hr1
        exact ⟨hr2, Or.inl ⟨hv, hq, by omega⟩⟩
    · simp only [hpx, Bool.false_eq_true, ↓reduceIte] at hc
      exfalso
      obtain ⟨hr1, h2⟩ := «еслиНе-чисто» hc
      obtain ⟨_, h1⟩ := «еслиНе-чисто» hr1
      exact hpx (by rw [h1, h2]; rfl)
  · simp only [hv, Bool.false_eq_true, ↓reduceIte] at hc
    by_cases hm : u.«ходамиВерх» = true
    · simp only [hm, ↓reduceIte] at hc
      by_cases hz : ((«проигратьБлок» (u.«обстХодов» «к»)).«беды».isEmpty && decide ((«проигратьБлок» (u.«обстХодов» «к»)).«проиграно» = 0) &&
          («проигратьБлок» (u.«обстХодов» «к»)).«неВзялся».isEmpty) = true
      · simp only [hz, ↓reduceIte] at hc
        exact absurd hc («чист-слово» _ _)
      · simp only [hz, Bool.false_eq_true, ↓reduceIte] at hc
        obtain ⟨hr1, hw⟩ := «слово-приписано-чисто» hc
        obtain ⟨hr2, hb⟩ := «еслиНе-чисто» hr1
        have hw' : («проигратьБлок» (u.«обстХодов» «к»)).«неВзялся» = [] := by simpa using hw
        refine ⟨hr2, Or.inr (Or.inl ⟨hm, List.isEmpty_iff.mp hb, hw', ?_⟩)⟩
        simp only [hb, hw', List.isEmpty_nil, Bool.true_and, Bool.and_true, decide_eq_true_eq] at hz
        omega
    · simp only [hm, Bool.false_eq_true, ↓reduceIte] at hc
      by_cases hp : u.«пр» = some "правило «кольцо точного целого»"
      · simp only [hp, decide_true, ↓reduceIte] at hc
        revert hc
        cases hk : «кольцоТочногоЦелого» «к».«исх» u.«обр» u.«чья» u.«цель0» with
        | ok _ => intro hc; exact ⟨hc, Or.inr (Or.inr (Or.inl ⟨hp, rfl⟩))⟩
        | error e => intro hc; exact absurd hc («чист-беда» _ _)
      · simp only [hp, decide_false, Bool.false_eq_true, ↓reduceIte] at hc
        by_cases hx : u.«есть» "ход " = true
        · simp only [hx, ↓reduceIte] at hc
          obtain ⟨h2, _⟩ := «еслиНе-чисто» hc
          by_cases hs : («крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)).«снял» = ""
          · by_cases hl : u.«ходамиСписка» «к» = true
            · simp only [hs, hl, decide_true, Bool.not_true, Bool.and_false, Bool.false_eq_true, ↓reduceIte] at h2
              obtain ⟨hb, hn, hw⟩ := h2
              simp only [List.append_eq_nil_iff] at hb
              exact ⟨⟨hb.1, hn, hw⟩, Or.inr (Or.inr (Or.inr (Or.inr ⟨hb.2, hl⟩)))⟩
            · simp only [Bool.not_eq_true] at hl
              simp only [hs, hl, decide_true, Bool.not_false, Bool.and_true, ↓reduceIte] at h2
              exact absurd h2 («чист-слово» _ _)
          · simp only [hs, decide_false, Bool.false_and, Bool.false_eq_true, ↓reduceIte] at h2
            obtain ⟨hb, hn, hw⟩ := h2
            simp only [List.append_eq_nil_iff] at hb
            exact ⟨⟨hb.1, hn, hw⟩, Or.inr (Or.inr (Or.inr (Or.inl ⟨hb.2, hs⟩)))⟩
        · simp only [hx, Bool.false_eq_true, ↓reduceIte] at hc
          by_cases hs : («крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)).«снял» = ""
          · by_cases hl : u.«ходамиСписка» «к» = true
            · simp only [hs, hl, decide_true, Bool.not_true, Bool.and_false, Bool.false_eq_true, ↓reduceIte] at hc
              obtain ⟨hb, hn, hw⟩ := hc
              simp only [List.append_eq_nil_iff] at hb
              exact ⟨⟨hb.1, hn, hw⟩, Or.inr (Or.inr (Or.inr (Or.inr ⟨hb.2, hl⟩)))⟩
            · simp only [Bool.not_eq_true] at hl
              simp only [hs, hl, decide_true, Bool.not_false, Bool.and_true, ↓reduceIte] at hc
              exact absurd hc («чист-слово» _ _)
          · simp only [hs, decide_false, Bool.false_and, Bool.false_eq_true, ↓reduceIte] at hc
            obtain ⟨hb, hn, hw⟩ := hc
            simp only [List.append_eq_nil_iff] at hb
            exact ⟨⟨hb.1, hn, hw⟩, Or.inr (Or.inr (Or.inr (Or.inl ⟨hb.2, hs⟩)))⟩

/-- **Доказанное утверждение принимается только путями решения.** Если путь
    `«судитьУтверждение»` принял утверждение с вердиктом «доказано», то либо запись назвала
    теорему исходника, и её принял путь `«судитьТеорему»` (теорема «теорема-по-частям»),
    либо обязательства входа приняты, посылки приняты, и принял один из путей решения:
    блок вывода приёмкой модели (`«Суд».«выводом»`, теорема «выводом-по-модели»), прогон
    ходов (`«проигратьБлок»`), кольцо точного целого (`«кольцоТочногоЦелого»`), крюки
    по телу (`«крюкиПоТелу»`) либо ходы под посылками списка (`«ходыПодПосылками»`). Пути
    без модели — строки долга. -/
theorem «утверждение-по-путям» («к» : «Контекст») («блок» : String)
    (hc : («судитьУтверждение» «к» «блок»).«чист») :
    let u := («формаУтверждения» «к» «блок»).1
    let o := «судитьОбязательства» «к».«исх» «к».«строки» u.«обр» u.«имя» u.«чья»
    u.«доказано» = true →
    (u.«есть» "теорема «" = true ∧ («судитьТеорему» (u.«теорема» «к») u.«заг» «к».«строки» «к».«опр»).«чист») ∨
    (u.«есть» "теорема «" = false ∧ o.1.«чист» ∧
      («судитьПосылки» «к».«исх» u.«обр» u.«имя» u.«чья» u.«вердикт» u.«место» s!"утверждение «{u.«имя»}»"
        («проигранДоказанного» u «к» o.2) false).«чист» ∧
      ((u.«есть» "вывод " = true ∧ (u.«выводСуд» «к»).«чист» ∧ o.2 = 0) ∨
       (u.«ходамиВерх» = true ∧ («проигратьБлок» (u.«обстХодов» «к»)).«беды» = [] ∧
          («проигратьБлок» (u.«обстХодов» «к»)).«неВзялся» = [] ∧ («проигратьБлок» (u.«обстХодов» «к»)).«проиграно» > 0) ∨
       (u.«пр» = some "правило «кольцо точного целого»" ∧ «кольцоТочногоЦелого» «к».«исх» u.«обр» u.«чья» u.«цель0» = .ok ()) ∨
       (let h := «крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)
        h.«беды» = [] ∧ h.«снял» ≠ "") ∨
       (let h := «крюкиПоТелу» { «исх» := «к».«исх», «огл» := «к».«огл» } (u.«местоКрюков» «к»)
        h.«беды» = [] ∧ u.«ходамиСписка» «к» = true))) := by
  intro u o hd
  have hu : u = («формаУтверждения» «к» «блок»).1 := rfl
  unfold «судитьУтверждение» at hc
  generalize hf : «формаУтверждения» «к» «блок» = f at hc hu
  obtain ⟨u0, r0⟩ := f
  simp only at hc hu
  subst hu
  unfold «решениеУтверждения» at hc
  dsimp only at hc
  split at hc
  · rename_i ht
    exact Or.inl ⟨ht, («и-чист'» hc).2⟩
  · rename_i ht
    right
    simp only [Bool.not_eq_true] at ht
    obtain ⟨hr, hpos⟩ := «и-чист'» hc
    obtain ⟨hr', hdec⟩ := «суд-доказанного» u «к» _ _ hr hd
    obtain ⟨_, ho⟩ := «и-чист'» hr'
    exact ⟨ht, ho, hpos, hdec⟩

end «Второй»
