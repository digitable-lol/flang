import Category

def terminal_is_unique (C : Cat.{u, v}) {t t' : C.Obj} (T : Cat.Terminal C t)
    (T' : Cat.Terminal C t') : Cat.Iso C t t' where
  hom := T'.to t
  inv := T.to t'
  inv_hom := (T.uniq _).trans (T.uniq _).symm
  hom_inv := (T'.uniq _).trans (T'.uniq _).symm

theorem terminal_iso_is_unique (C : Cat.{u, v}) {t t' : C.Obj} (T' : Cat.Terminal C t')
    (f g : C.Hom t t') : f = g :=
  (T'.uniq f).trans (T'.uniq g).symm
