import Category

def Fun.comp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    (G : Fun D E) (F : Fun C D) : Fun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

def adjunctions_compose {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    {F : Fun C D} {G : Fun D C} {F' : Fun D E} {G' : Fun E D}
    (A : Adj F G) (B : Adj F' G') : Adj (Fun.comp F' F) (Fun.comp G G') where
  unit a := C.comp (G.map (B.unit (F.obj a))) (A.unit a)
  counit e := E.comp (B.counit e) (F'.map (A.counit (G'.obj e)))
  unit_natural {a a'} f := by
    show C.comp (G.map (G'.map (F'.map (F.map f)))) (C.comp (G.map (B.unit (F.obj a))) (A.unit a))
      = C.comp (C.comp (G.map (B.unit (F.obj a'))) (A.unit a')) f
    rw [← C.assoc, ← G.map_comp, B.unit_natural, G.map_comp, C.assoc, C.assoc, A.unit_natural]
  counit_natural {e e'} g := by
    show E.comp g (E.comp (B.counit e) (F'.map (A.counit (G'.obj e))))
      = E.comp (E.comp (B.counit e') (F'.map (A.counit (G'.obj e'))))
          (F'.map (F.map (G.map (G'.map g))))
    rw [← E.assoc, B.counit_natural, E.assoc, E.assoc, ← F'.map_comp, ← F'.map_comp,
      A.counit_natural]
  left_triangle a := by
    show E.comp (E.comp (B.counit (F'.obj (F.obj a)))
        (F'.map (A.counit (G'.obj (F'.obj (F.obj a))))))
        (F'.map (F.map (C.comp (G.map (B.unit (F.obj a))) (A.unit a))))
      = E.id (F'.obj (F.obj a))
    rw [F.map_comp, F'.map_comp]
    simp only [E.assoc]
    rw [← E.assoc (F'.map (A.counit _)) (F'.map (F.map (G.map _))), ← F'.map_comp,
      ← A.counit_natural, F'.map_comp]
    simp only [E.assoc]
    rw [← E.assoc (B.counit _), B.left_triangle, E.id_comp, ← F'.map_comp, A.left_triangle,
      F'.map_id]
  right_triangle e := by
    show C.comp (G.map (G'.map (E.comp (B.counit e) (F'.map (A.counit (G'.obj e))))))
        (C.comp (G.map (B.unit (F.obj (G.obj (G'.obj e))))) (A.unit (G.obj (G'.obj e))))
      = C.id (G.obj (G'.obj e))
    rw [G'.map_comp, G.map_comp]
    simp only [C.assoc]
    rw [← C.assoc (G.map (G'.map (F'.map _))), ← G.map_comp, B.unit_natural, G.map_comp]
    simp only [C.assoc]
    rw [← C.assoc (G.map (G'.map (B.counit _))), ← G.map_comp, B.right_triangle, G.map_id,
      C.id_comp, A.right_triangle]
