import Category

def Fun.ident (C : Cat.{u, v}) : Fun C C where
  obj a := a
  map f := f
  map_id _ := rfl
  map_comp _ _ := rfl

theorem identity_functor_keeps_composition (C : Cat.{u, v}) {a b c : C.Obj}
    (g : C.Hom b c) (f : C.Hom a b) :
    (Fun.ident C).map (C.comp g f) = C.comp ((Fun.ident C).map g) ((Fun.ident C).map f) :=
  (Fun.ident C).map_comp g f
