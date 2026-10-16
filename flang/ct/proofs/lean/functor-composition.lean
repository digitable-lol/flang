import Category

def Fun.comp {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {E : Cat.{u₃, v₃}}
    (G : Fun D E) (F : Fun C D) : Fun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

theorem functor_composition_keeps_composition {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}}
    {E : Cat.{u₃, v₃}} (G : Fun D E) (F : Fun C D) {a b c : C.Obj}
    (g : C.Hom b c) (f : C.Hom a b) :
    G.map (F.map (C.comp g f)) = E.comp (G.map (F.map g)) (G.map (F.map f)) :=
  (Fun.comp G F).map_comp g f

theorem functor_composition_keeps_identity {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}}
    {E : Cat.{u₃, v₃}} (G : Fun D E) (F : Fun C D) (a : C.Obj) :
    G.map (F.map (C.id a)) = E.id (G.obj (F.obj a)) :=
  (Fun.comp G F).map_id a
