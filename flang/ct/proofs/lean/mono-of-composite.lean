import Category

theorem mono_of_composite (C : Cat.{u, v}) {a b c : C.Obj} (f : C.Hom a b) (g : C.Hom b c)
    (h : Cat.Mono C (C.comp g f)) : Cat.Mono C f := by
  intro x p q w
  apply h
  rw [C.assoc, C.assoc, w]
