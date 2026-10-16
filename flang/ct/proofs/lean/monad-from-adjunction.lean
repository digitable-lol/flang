import Category

def Fun.comp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    (G : Fun D E) (F : Fun C D) : Fun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

def monad_from_adjunction {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}
    (A : Adj F G) : CatMonad C where
  T := Fun.comp G F
  η := A.unit
  μ a := G.map (A.counit (F.obj a))
  η_natural f := A.unit_natural f
  μ_natural {a b} f := by
    show C.comp (G.map (F.map f)) (G.map (A.counit (F.obj a)))
      = C.comp (G.map (A.counit (F.obj b))) (G.map (F.map (G.map (F.map f))))
    rw [← G.map_comp, ← G.map_comp, A.counit_natural]
  assoc a := by
    show C.comp (G.map (A.counit (F.obj a))) (G.map (F.map (G.map (A.counit (F.obj a)))))
      = C.comp (G.map (A.counit (F.obj a))) (G.map (A.counit (F.obj (G.obj (F.obj a)))))
    rw [← G.map_comp, ← G.map_comp, A.counit_natural]
  left_unit a := A.right_triangle (F.obj a)
  right_unit a := by
    show C.comp (G.map (A.counit (F.obj a))) (G.map (F.map (A.unit a))) = C.id (G.obj (F.obj a))
    rw [← G.map_comp, A.left_triangle, G.map_id]
