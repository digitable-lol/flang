import Category

theorem inverse_is_unique (C : Cat.{u, v}) {a b : C.Obj} (f : C.Hom a b) (g h : C.Hom b a)
    (left : C.comp g f = C.id a) (right : C.comp f h = C.id b) : g = h :=
  calc g = C.comp g (C.id b) := (C.comp_id g).symm
    _ = C.comp g (C.comp f h) := by rw [right]
    _ = C.comp (C.comp g f) h := (C.assoc g f h).symm
    _ = C.comp (C.id a) h := by rw [left]
    _ = h := C.id_comp h

theorem isomorphism_inverse_is_unique (C : Cat.{u, v}) {a b : C.Obj} (i j : Cat.Iso C a b)
    (same : i.hom = j.hom) : i.inv = j.inv := by
  apply inverse_is_unique C i.hom
  · exact i.inv_hom
  · rw [same]; exact j.hom_inv
