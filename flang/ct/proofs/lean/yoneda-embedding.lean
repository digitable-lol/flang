import Category

def homTo (C : Cat.{u, v}) (a : C.Obj) : Fun C.op Cat.types.{v} where
  obj x := C.Hom x a
  map g := fun h => C.comp h g
  map_id _ := funext fun h => C.comp_id h
  map_comp g f := funext fun h => (C.assoc h f g).symm

def embedding_forward (C : Cat.{u, v}) (a b : C.Obj) (α : NatTrans (homTo C a) (homTo C b)) :
    C.Hom a b :=
  α.app a (C.id a)

def embedding_backward (C : Cat.{u, v}) (a b : C.Obj) (f : C.Hom a b) :
    NatTrans (homTo C a) (homTo C b) where
  app _ := fun h => C.comp f h
  natural _ := funext fun h => C.assoc f h _

theorem embedding_forward_backward (C : Cat.{u, v}) (a b : C.Obj) (f : C.Hom a b) :
    embedding_forward C a b (embedding_backward C a b f) = f :=
  C.comp_id f

theorem embedding_backward_forward (C : Cat.{u, v}) (a b : C.Obj)
    (α : NatTrans (homTo C a) (homTo C b)) :
    embedding_backward C a b (embedding_forward C a b α) = α := by
  apply NatTrans.ext
  funext x h
  show C.comp (α.app a (C.id a)) h = α.app x h
  have n : C.comp (α.app a (C.id a)) h = α.app x (C.comp (C.id a) h) :=
    congrFun (α.natural (a := a) (b := x) h) (C.id a)
  exact n.trans (congrArg (α.app x) (C.id_comp h))
