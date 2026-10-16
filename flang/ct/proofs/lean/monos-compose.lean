import Category

theorem monos_compose (C : Cat.{u, v}) {a b c : C.Obj} (m : C.Hom a b) (n : C.Hom b c)
    (hm : Cat.Mono C m) (hn : Cat.Mono C n) : Cat.Mono C (C.comp n m) := by
  intro x p q w
  apply hm
  apply hn
  rw [← C.assoc, ← C.assoc, w]
