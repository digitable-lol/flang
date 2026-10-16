import Category

def natural_isomorphism_inverse {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F G : Fun C D}
    (α : NatTrans F G) (inv : (a : C.Obj) → D.Hom (G.obj a) (F.obj a))
    (inv_hom : ∀ a, D.comp (inv a) (α.app a) = D.id (F.obj a))
    (hom_inv : ∀ a, D.comp (α.app a) (inv a) = D.id (G.obj a)) : NatTrans G F where
  app := inv
  natural {a b} f :=
    calc D.comp (F.map f) (inv a)
        = D.comp (D.comp (inv b) (α.app b)) (D.comp (F.map f) (inv a)) := by
          rw [inv_hom, D.id_comp]
      _ = D.comp (inv b) (D.comp (D.comp (α.app b) (F.map f)) (inv a)) := by
          simp only [D.assoc]
      _ = D.comp (inv b) (D.comp (D.comp (G.map f) (α.app a)) (inv a)) := by
          rw [α.natural]
      _ = D.comp (inv b) (G.map f) := by
          rw [D.assoc, hom_inv, D.comp_id]
