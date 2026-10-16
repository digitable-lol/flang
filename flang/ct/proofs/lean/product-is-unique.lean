import Category

theorem Cat.Product.ext {C : Cat.{u, v}} {a b p : C.Obj} (P : Cat.Product C a b p) {x : C.Obj}
    (h k : C.Hom x p) (first : C.comp P.fst h = C.comp P.fst k)
    (second : C.comp P.snd h = C.comp P.snd k) : h = k := by
  rw [P.uniq h, P.uniq k, first, second]

def product_is_unique (C : Cat.{u, v}) {a b p p' : C.Obj} (P : Cat.Product C a b p)
    (P' : Cat.Product C a b p') : Cat.Iso C p p' where
  hom := P'.pair P.fst P.snd
  inv := P.pair P'.fst P'.snd
  inv_hom := by
    apply P.ext
    · rw [← C.assoc, P.fst_pair, P'.fst_pair, C.comp_id]
    · rw [← C.assoc, P.snd_pair, P'.snd_pair, C.comp_id]
  hom_inv := by
    apply P'.ext
    · rw [← C.assoc, P'.fst_pair, P.fst_pair, C.comp_id]
    · rw [← C.assoc, P'.snd_pair, P.snd_pair, C.comp_id]
