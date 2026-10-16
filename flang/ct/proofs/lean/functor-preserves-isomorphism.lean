import Category

def Fun.mapIso {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F : Fun C D) {a b : C.Obj}
    (i : Cat.Iso C a b) : Cat.Iso D (F.obj a) (F.obj b) where
  hom := F.map i.hom
  inv := F.map i.inv
  inv_hom := by rw [← F.map_comp, i.inv_hom, F.map_id]
  hom_inv := by rw [← F.map_comp, i.hom_inv, F.map_id]
