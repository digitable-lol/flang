import Category

variable {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}

def Adj.transpose (A : Adj F G) {a : C.Obj} {b : D.Obj} (f : D.Hom (F.obj a) b) :
    C.Hom a (G.obj b) :=
  C.comp (G.map f) (A.unit a)

def Adj.untranspose (A : Adj F G) {a : C.Obj} {b : D.Obj} (g : C.Hom a (G.obj b)) :
    D.Hom (F.obj a) b :=
  D.comp (A.counit b) (F.map g)

theorem untranspose_transpose (A : Adj F G) {a : C.Obj} {b : D.Obj} (f : D.Hom (F.obj a) b) :
    A.untranspose (A.transpose f) = f := by
  unfold Adj.untranspose Adj.transpose
  rw [F.map_comp, ← D.assoc, ← A.counit_natural, D.assoc, A.left_triangle, D.comp_id]

theorem transpose_untranspose (A : Adj F G) {a : C.Obj} {b : D.Obj} (g : C.Hom a (G.obj b)) :
    A.transpose (A.untranspose g) = g := by
  unfold Adj.untranspose Adj.transpose
  rw [G.map_comp, C.assoc, A.unit_natural, ← C.assoc, A.right_triangle, C.id_comp]

theorem transpose_is_natural (A : Adj F G) {a a' : C.Obj} {b b' : D.Obj}
    (h : C.Hom a' a) (f : D.Hom (F.obj a) b) (k : D.Hom b b') :
    A.transpose (D.comp k (D.comp f (F.map h))) = C.comp (G.map k) (C.comp (A.transpose f) h) := by
  unfold Adj.transpose
  rw [G.map_comp, G.map_comp, C.assoc, C.assoc, A.unit_natural, C.assoc]
