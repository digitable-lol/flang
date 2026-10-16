import Category

def NatTrans.vcomp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F G H : Fun C D}
    (β : NatTrans G H) (α : NatTrans F G) : NatTrans F H where
  app a := D.comp (β.app a) (α.app a)
  natural f := by
    rw [← D.assoc, β.natural, D.assoc, α.natural, ← D.assoc]

def NatTrans.ident {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F : Fun C D) : NatTrans F F where
  app a := D.id (F.obj a)
  natural f := by rw [D.comp_id, D.id_comp]

theorem vertical_composition_is_associative {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}}
    {F G H K : Fun C D} (γ : NatTrans H K) (β : NatTrans G H) (α : NatTrans F G) :
    NatTrans.vcomp (NatTrans.vcomp γ β) α = NatTrans.vcomp γ (NatTrans.vcomp β α) := by
  apply NatTrans.ext
  funext a
  exact D.assoc _ _ _

theorem vertical_composition_has_units {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}}
    {F G : Fun C D} (α : NatTrans F G) :
    NatTrans.vcomp (NatTrans.ident G) α = α ∧ NatTrans.vcomp α (NatTrans.ident F) = α := by
  constructor
  · apply NatTrans.ext; funext a; exact D.id_comp _
  · apply NatTrans.ext; funext a; exact D.comp_id _
