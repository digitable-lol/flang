import Category

theorem pullback_of_mono (C : Cat.{u, v}) {a b c p : C.Obj} (f : C.Hom a c) (m : C.Hom b c)
    (hm : Cat.Mono C m) (P : Cat.Pullback C f m p) : Cat.Mono C P.fst := by
  intro x u w e
  apply P.uniq u w e
  apply hm
  rw [← C.assoc, ← C.assoc, ← P.square, C.assoc, C.assoc, e]
