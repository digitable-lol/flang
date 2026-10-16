import Category

def Cat.Iso.trans {C : Cat.{u, v}} {a b c : C.Obj} (i : Cat.Iso C a b) (j : Cat.Iso C b c) :
    Cat.Iso C a c where
  hom := C.comp j.hom i.hom
  inv := C.comp i.inv j.inv
  inv_hom := by
    rw [C.assoc, ← C.assoc j.inv j.hom i.hom, j.inv_hom, C.id_comp, i.inv_hom]
  hom_inv := by
    rw [C.assoc, ← C.assoc i.hom i.inv j.inv, i.hom_inv, C.id_comp, j.hom_inv]
