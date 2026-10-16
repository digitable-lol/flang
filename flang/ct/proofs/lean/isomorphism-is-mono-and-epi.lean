import Category

theorem isomorphism_is_mono (C : Cat.{u, v}) {a b : C.Obj} (i : Cat.Iso C a b) :
    Cat.Mono C i.hom := by
  intro x p q w
  rw [← C.id_comp p, ← C.id_comp q, ← i.inv_hom, C.assoc, C.assoc, w]

theorem isomorphism_is_epi (C : Cat.{u, v}) {a b : C.Obj} (i : Cat.Iso C a b) :
    Cat.Epi C i.hom := by
  intro x p q w
  rw [← C.comp_id p, ← C.comp_id q, ← i.hom_inv, ← C.assoc, ← C.assoc, w]
