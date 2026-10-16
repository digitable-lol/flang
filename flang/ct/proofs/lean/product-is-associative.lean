import Category

theorem Cat.Product.ext {C : Cat.{u, v}} {a b p : C.Obj} (P : Cat.Product C a b p) {x : C.Obj}
    (h k : C.Hom x p) (first : C.comp P.fst h = C.comp P.fst k)
    (second : C.comp P.snd h = C.comp P.snd k) : h = k := by
  rw [P.uniq h, P.uniq k, first, second]

def product_is_associative (C : Cat.{u, v}) {a b c ab abc bc abc' : C.Obj}
    (P : Cat.Product C a b ab) (Q : Cat.Product C ab c abc)
    (R : Cat.Product C b c bc) (S : Cat.Product C a bc abc') : Cat.Iso C abc abc' where
  hom := S.pair (C.comp P.fst Q.fst) (R.pair (C.comp P.snd Q.fst) Q.snd)
  inv := Q.pair (P.pair S.fst (C.comp R.fst S.snd)) (C.comp R.snd S.snd)
  inv_hom := by
    apply Q.ext
    · apply P.ext
      · simp only [← C.assoc, Q.fst_pair, P.fst_pair, S.fst_pair, C.comp_id]
      · simp only [← C.assoc, Q.fst_pair, P.snd_pair]
        simp only [C.assoc, S.snd_pair]
        simp only [R.fst_pair, C.comp_id]
    · simp only [← C.assoc, Q.snd_pair]
      simp only [C.assoc, S.snd_pair, R.snd_pair, C.comp_id]
  hom_inv := by
    apply S.ext
    · simp only [← C.assoc, S.fst_pair]
      simp only [C.assoc, Q.fst_pair, P.fst_pair, C.comp_id]
    · apply R.ext
      · simp only [← C.assoc, S.snd_pair, R.fst_pair]
        simp only [C.assoc, Q.fst_pair, P.snd_pair, C.comp_id]
      · simp only [← C.assoc, S.snd_pair, R.snd_pair]
        simp only [Q.snd_pair, C.comp_id]
