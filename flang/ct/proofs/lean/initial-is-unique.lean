import Category

def terminal_is_unique (C : Cat.{u, v}) {t t' : C.Obj} (T : Cat.Terminal C t)
    (T' : Cat.Terminal C t') : Cat.Iso C t t' where
  hom := T'.to t
  inv := T.to t'
  inv_hom := (T.uniq _).trans (T.uniq _).symm
  hom_inv := (T'.uniq _).trans (T'.uniq _).symm

def initial_is_terminal_in_opposite (C : Cat.{u, v}) {i : C.Obj} (I : Cat.Initial C i) :
    Cat.Terminal C.op i where
  to x := I.from_ x
  uniq f := I.uniq f

def iso_of_opposite (C : Cat.{u, v}) {a b : C.Obj} (j : Cat.Iso C.op a b) : Cat.Iso C b a where
  hom := j.hom
  inv := j.inv
  inv_hom := j.hom_inv
  hom_inv := j.inv_hom

def initial_is_unique (C : Cat.{u, v}) {i i' : C.Obj} (I : Cat.Initial C i)
    (I' : Cat.Initial C i') : Cat.Iso C i i' :=
  iso_of_opposite C (terminal_is_unique C.op (initial_is_terminal_in_opposite C I')
    (initial_is_terminal_in_opposite C I))
