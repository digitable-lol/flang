import Category

theorem squares_paste (C : Cat.{u, v}) {a b c d e f' : C.Obj}
    (f : C.Hom a b) (g : C.Hom b c) (p : C.Hom a d) (q : C.Hom b e) (r : C.Hom c f')
    (h : C.Hom d e) (k : C.Hom e f')
    (left : C.comp q f = C.comp h p) (right : C.comp r g = C.comp k q) :
    C.comp r (C.comp g f) = C.comp (C.comp k h) p := by
  rw [← C.assoc, right, C.assoc, left, ← C.assoc]

theorem functor_keeps_commuting_square {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F : Fun C D)
    {a b c d : C.Obj} (f : C.Hom a b) (g : C.Hom b d) (h : C.Hom a c) (k : C.Hom c d)
    (square : C.comp g f = C.comp k h) :
    D.comp (F.map g) (F.map f) = D.comp (F.map k) (F.map h) := by
  rw [← F.map_comp, square, F.map_comp]
