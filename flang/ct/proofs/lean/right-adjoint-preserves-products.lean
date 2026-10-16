import Category

variable {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}

def tr (A : Adj F G) {a : C.Obj} {b : D.Obj} (f : D.Hom (F.obj a) b) : C.Hom a (G.obj b) :=
  C.comp (G.map f) (A.unit a)

def un (A : Adj F G) {a : C.Obj} {b : D.Obj} (g : C.Hom a (G.obj b)) : D.Hom (F.obj a) b :=
  D.comp (A.counit b) (F.map g)

theorem un_tr (A : Adj F G) {a : C.Obj} {b : D.Obj} (f : D.Hom (F.obj a) b) :
    un A (tr A f) = f := by
  unfold un tr
  rw [F.map_comp, ← D.assoc, ← A.counit_natural, D.assoc, A.left_triangle, D.comp_id]

theorem tr_un (A : Adj F G) {a : C.Obj} {b : D.Obj} (g : C.Hom a (G.obj b)) :
    tr A (un A g) = g := by
  unfold un tr
  rw [G.map_comp, C.assoc, A.unit_natural, ← C.assoc, A.right_triangle, C.id_comp]

theorem tr_after (A : Adj F G) {a : C.Obj} {b b' : D.Obj} (k : D.Hom b b') (f : D.Hom (F.obj a) b) :
    tr A (D.comp k f) = C.comp (G.map k) (tr A f) := by
  unfold tr
  rw [G.map_comp, C.assoc]

theorem un_after (A : Adj F G) {a : C.Obj} {b b' : D.Obj} (k : D.Hom b b') (g : C.Hom a (G.obj b)) :
    un A (C.comp (G.map k) g) = D.comp k (un A g) := by
  rw [← un_tr A (D.comp k (un A g)), tr_after, tr_un]

def right_adjoint_preserves_products (A : Adj F G) {b b' p : D.Obj}
    (P : Cat.Product D b b' p) : Cat.Product C (G.obj b) (G.obj b') (G.obj p) where
  fst := G.map P.fst
  snd := G.map P.snd
  pair f g := tr A (P.pair (un A f) (un A g))
  fst_pair f g := by rw [← tr_after, P.fst_pair, tr_un]
  snd_pair f g := by rw [← tr_after, P.snd_pair, tr_un]
  uniq h := by
    rw [un_after, un_after, ← P.uniq, tr_un]
