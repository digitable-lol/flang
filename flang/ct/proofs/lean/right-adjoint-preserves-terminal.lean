import Category

variable {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}

theorem transpose_untranspose (A : Adj F G) {a : C.Obj} {b : D.Obj} (g : C.Hom a (G.obj b)) :
    C.comp (G.map (D.comp (A.counit b) (F.map g))) (A.unit a) = g := by
  rw [G.map_comp, C.assoc, A.unit_natural, ← C.assoc, A.right_triangle, C.id_comp]

def right_adjoint_preserves_terminal (A : Adj F G) {t : D.Obj} (T : Cat.Terminal D t) :
    Cat.Terminal C (G.obj t) where
  to x := C.comp (G.map (T.to (F.obj x))) (A.unit x)
  uniq {x} f := by
    rw [← transpose_untranspose A f, T.uniq (D.comp (A.counit t) (F.map f))]
