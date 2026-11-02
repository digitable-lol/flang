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

end «Второй»
