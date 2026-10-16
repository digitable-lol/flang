import Category

theorem Cat.Product.ext {C : Cat.{u, v}} {a b p : C.Obj} (P : Cat.Product C a b p) {x : C.Obj}
    (h k : C.Hom x p) (first : C.comp P.fst h = C.comp P.fst k)
    (second : C.comp P.snd h = C.comp P.snd k) : h = k := by
  rw [P.uniq h, P.uniq k, first, second]

def product_is_commutative (C : Cat.{u, v}) {a b p q : C.Obj} (P : Cat.Product C a b p)
    (Q : Cat.Product C b a q) : Cat.Iso C p q where
  hom := Q.pair P.snd P.fst
  inv := P.pair Q.snd Q.fst
  inv_hom := by
    apply P.ext
    · rw [← C.assoc, P.fst_pair, Q.snd_pair, C.comp_id]
    · rw [← C.assoc, P.snd_pair, Q.fst_pair, C.comp_id]
  hom_inv := by
    apply Q.ext
    · rw [← C.assoc, Q.fst_pair, P.snd_pair, C.comp_id]
    · rw [← C.assoc, Q.snd_pair, P.fst_pair, C.comp_id]
