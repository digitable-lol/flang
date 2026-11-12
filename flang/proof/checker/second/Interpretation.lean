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

end «Второй»
