import Sections

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


end «Второй»
