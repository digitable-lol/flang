import Category

def Fun.comp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    (G : Fun D E) (F : Fun C D) : Fun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

def NatTrans.vcomp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F G H : Fun C D}
    (β : NatTrans G H) (α : NatTrans F G) : NatTrans F H where
  app a := D.comp (β.app a) (α.app a)
  natural f := by
    rw [← D.assoc, β.natural, D.assoc, α.natural, ← D.assoc]

def NatTrans.hcomp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    {F F' : Fun C D} {G G' : Fun D E} (β : NatTrans G G') (α : NatTrans F F') :
    NatTrans (Fun.comp G F) (Fun.comp G' F') where
  app a := E.comp (G'.map (α.app a)) (β.app (F.obj a))
  natural {a b} f := by
    show E.comp (G'.map (F'.map f)) (E.comp (G'.map (α.app a)) (β.app (F.obj a)))
      = E.comp (E.comp (G'.map (α.app b)) (β.app (F.obj b))) (G.map (F.map f))
    rw [← E.assoc, ← G'.map_comp, α.natural, G'.map_comp, E.assoc, E.assoc, β.natural]

theorem interchange_law {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    {F F' F'' : Fun C D} {G G' G'' : Fun D E}
    (β' : NatTrans G' G'') (β : NatTrans G G') (α' : NatTrans F' F'') (α : NatTrans F F') :
    NatTrans.hcomp (NatTrans.vcomp β' β) (NatTrans.vcomp α' α)
      = NatTrans.vcomp (NatTrans.hcomp β' α') (NatTrans.hcomp β α) := by
  apply NatTrans.ext
  funext a
  show E.comp (G''.map (D.comp (α'.app a) (α.app a))) (E.comp (β'.app (F.obj a)) (β.app (F.obj a)))
    = E.comp (E.comp (G''.map (α'.app a)) (β'.app (F'.obj a)))
        (E.comp (G'.map (α.app a)) (β.app (F.obj a)))
  rw [G''.map_comp, E.assoc, ← E.assoc (G''.map (α.app a)), β'.natural (α.app a)]
  simp only [E.assoc]
