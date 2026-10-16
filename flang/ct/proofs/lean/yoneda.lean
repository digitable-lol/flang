import Category

def homFrom (C : Cat.{u, v}) (a : C.Obj) : Fun C Cat.types.{v} where
  obj b := C.Hom a b
  map g := fun h => C.comp g h
  map_id _ := funext fun h => C.id_comp h
  map_comp g f := funext fun h => C.assoc g f h

def yoneda_forward (C : Cat.{u, v}) (a : C.Obj) (F : Fun C Cat.types.{v})
    (α : NatTrans (homFrom C a) F) : F.obj a :=
  α.app a (C.id a)

def yoneda_backward (C : Cat.{u, v}) (a : C.Obj) (F : Fun C Cat.types.{v})
    (x : F.obj a) : NatTrans (homFrom C a) F where
  app _ := fun f => F.map f x
  natural g := funext fun f => (congrFun (F.map_comp g f) x).symm

theorem yoneda_forward_backward (C : Cat.{u, v}) (a : C.Obj) (F : Fun C Cat.types.{v})
    (x : F.obj a) : yoneda_forward C a F (yoneda_backward C a F x) = x :=
  congrFun (F.map_id a) x

theorem yoneda_backward_forward (C : Cat.{u, v}) (a : C.Obj) (F : Fun C Cat.types.{v})
    (α : NatTrans (homFrom C a) F) : yoneda_backward C a F (yoneda_forward C a F α) = α := by
  apply NatTrans.ext
  funext b f
  show F.map f (α.app a (C.id a)) = α.app b f
  have h := congrFun (α.natural f) (C.id a)
  exact h.trans (congrArg (α.app b) (C.comp_id f))
