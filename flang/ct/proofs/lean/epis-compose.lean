import Category

theorem monos_compose (C : Cat.{u, v}) {a b c : C.Obj} (m : C.Hom a b) (n : C.Hom b c)
    (hm : Cat.Mono C m) (hn : Cat.Mono C n) : Cat.Mono C (C.comp n m) := by
  intro x p q w
  apply hm
  apply hn
  rw [← C.assoc, ← C.assoc, w]

theorem epi_is_mono_in_opposite (C : Cat.{u, v}) {a b : C.Obj} (e : C.Hom a b) :
    Cat.Epi C e ↔ Cat.Mono C.op e :=
  Iff.rfl

theorem epis_compose (C : Cat.{u, v}) {a b c : C.Obj} (e : C.Hom a b) (k : C.Hom b c)
    (he : Cat.Epi C e) (hk : Cat.Epi C k) : Cat.Epi C (C.comp k e) :=
  monos_compose C.op k e hk he
