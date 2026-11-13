import Goals

open «Разбор»

namespace «Второй»

def «истинноМ» (w : «Мир») (g : String) : Prop :=
  ∃ f, «форм» g = some f ∧ «оценитьФ» f w = true

def «здесьМ» (w : «Мир») (a b : String) : Prop :=
  ∃ ta tb, «тело» a = some ta ∧ «тело» b = some tb ∧ _root_.«значение» ta w = _root_.«значение» tb w

def «меткаМ» (w : «Мир») (c : String) : Prop :=
  ∀ f ∈ c.splitOn "\n", (f.startsWith "+" = true → «здесьМ» w (f.drop 1).toString "да") ∧
    (f.startsWith "-" = true → «здесьМ» w (f.drop 1).toString "нет")

theorem «здесь-симм-М» (w : «Мир») (a b : String) (h : «здесьМ» w a b) : «здесьМ» w b a := by
  obtain ⟨ta, tb, ha, hb, he⟩ := h
  exact ⟨tb, ta, hb, ha, he.symm⟩

theorem «разрезать-пустую» : ("".splitOn "\n") = [""] := by
  simp only [String.splitOn]
  unfold String.splitOnAux
  have h1 : String.Pos.Raw.atEnd "" 0 = true := by decide
  have h2 : String.Pos.Raw.extract "" 0 0 = "" := by decide
  simp [h1, h2]

theorem «метка-пуста-М» (w : «Мир») : «меткаМ» w "" := by
  intro f hf
  rw [«разрезать-пустую»] at hf
  simp only [List.mem_singleton] at hf
  subst hf
  exact ⟨fun h => by simp at h, fun h => by simp at h⟩

theorem «обр-без-краёв» (s : String) (h1 : s.toList.head?.any Char.isWhitespace = false)
    (h2 : s.toList.getLast?.any Char.isWhitespace = false) : s.«обр» = s := by
  have a : s.toSlice.startsWith Char.isWhitespace = false := by
    rw [String.Slice.startsWith_bool_eq_head?]; simpa using h1
  have b : s.toSlice.endsWith Char.isWhitespace = false := by
    rw [String.Slice.endsWith_bool_eq_getLast?]; simpa using h2
  unfold String.«обр» String.trimAscii String.Slice.trimAscii String.Slice.trimAsciiStart
    String.Slice.trimAsciiEnd
  rw [String.Slice.dropWhile_eq_self a, String.Slice.dropEndWhile_eq_self b]
  simp

theorem «ужать-слова» (s : String) (h1 : s.toList.head?.any Char.isWhitespace = false)
    (h2 : s.toList.getLast?.any Char.isWhitespace = false) (h3 : «однаПара» s = false) : «ужать» s = s := by
  simp only [«ужать», «обр-без-краёв» s h1 h2, h3, Bool.false_eq_true, ite_false]

theorem «форм-да» : «форм» "да" = some .«да» := by
  have hz : «запасЧтения» "да" = 79 + 1 := by decide
  have hu : «ужать» "да" = "да" := «ужать-слова» _ (by decide) (by decide) (by decide)
  unfold «форм»
  rw [hz, «формЗ»]
  unfold «шагФормулы»
  rw [hu]
  simp only [ite_true]
  rfl

theorem «да-верно-М» (w : «Мир») : «истинноМ» w "да" :=
  ⟨.«да», «форм-да», rfl⟩

end «Второй»
