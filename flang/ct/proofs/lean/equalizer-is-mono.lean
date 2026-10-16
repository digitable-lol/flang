import Category

theorem equalizer_is_mono (C : Cat.{u, v}) {a b e : C.Obj} (f g : C.Hom a b)
    (E : Cat.Equalizer C f g e) : Cat.Mono C E.ι := by
  intro x p q w
  exact E.uniq p q w
