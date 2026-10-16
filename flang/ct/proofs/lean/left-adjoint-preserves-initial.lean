import Category

variable {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}

theorem untranspose_transpose (A : Adj F G) {a : C.Obj} {b : D.Obj} (f : D.Hom (F.obj a) b) :
    D.comp (A.counit b) (F.map (C.comp (G.map f) (A.unit a))) = f := by
  rw [F.map_comp, ← D.assoc, ← A.counit_natural, D.assoc, A.left_triangle, D.comp_id]

def left_adjoint_preserves_initial (A : Adj F G) {i : C.Obj} (I : Cat.Initial C i) :
    Cat.Initial D (F.obj i) where
  from_ y := D.comp (A.counit y) (F.map (I.from_ (G.obj y)))
  uniq {y} f := by
    rw [← untranspose_transpose A f, I.uniq (C.comp (G.map f) (A.unit i))]
