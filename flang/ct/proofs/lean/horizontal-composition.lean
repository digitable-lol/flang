import Category

def Fun.comp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    (G : Fun D E) (F : Fun C D) : Fun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

theorem horizontal_composition_is_well_defined {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}}
    {E : Cat.{u₃, v₃}} {F F' : Fun C D} {G G' : Fun D E}
    (β : NatTrans G G') (α : NatTrans F F') (a : C.Obj) :
    E.comp (G'.map (α.app a)) (β.app (F.obj a)) = E.comp (β.app (F'.obj a)) (G.map (α.app a)) :=
  β.natural (α.app a)

def NatTrans.hcomp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    {F F' : Fun C D} {G G' : Fun D E} (β : NatTrans G G') (α : NatTrans F F') :
    NatTrans (Fun.comp G F) (Fun.comp G' F') where
  app a := E.comp (G'.map (α.app a)) (β.app (F.obj a))
  natural {a b} f := by
    show E.comp (G'.map (F'.map f)) (E.comp (G'.map (α.app a)) (β.app (F.obj a)))
      = E.comp (E.comp (G'.map (α.app b)) (β.app (F.obj b))) (G.map (F.map f))
    rw [← E.assoc, ← G'.map_comp, α.natural, G'.map_comp, E.assoc, E.assoc, β.natural]
