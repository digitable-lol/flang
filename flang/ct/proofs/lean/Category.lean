universe u v u₁ v₁ u₂ v₂ u₃ v₃

structure Cat where
  Obj : Type u
  Hom : Obj → Obj → Type v
  id : (a : Obj) → Hom a a
  comp : {a b c : Obj} → Hom b c → Hom a b → Hom a c
  id_comp : ∀ {a b : Obj} (f : Hom a b), comp (id b) f = f
  comp_id : ∀ {a b : Obj} (f : Hom a b), comp f (id a) = f
  assoc : ∀ {a b c d : Obj} (h : Hom c d) (g : Hom b c) (f : Hom a b),
    comp (comp h g) f = comp h (comp g f)

namespace Cat

def op (C : Cat.{u, v}) : Cat.{u, v} where
  Obj := C.Obj
  Hom a b := C.Hom b a
  id a := C.id a
  comp g f := C.comp f g
  id_comp f := C.comp_id f
  comp_id f := C.id_comp f
  assoc h g f := (C.assoc f g h).symm

def types : Cat.{u + 1, u} where
  Obj := Type u
  Hom a b := a → b
  id _ := fun x => x
  comp g f := fun x => g (f x)
  id_comp _ := rfl
  comp_id _ := rfl
  assoc _ _ _ := rfl

structure Iso (C : Cat.{u, v}) (a b : C.Obj) where
  hom : C.Hom a b
  inv : C.Hom b a
  inv_hom : C.comp inv hom = C.id a
  hom_inv : C.comp hom inv = C.id b

def Mono (C : Cat.{u, v}) {a b : C.Obj} (m : C.Hom a b) : Prop :=
  ∀ {x : C.Obj} (p q : C.Hom x a), C.comp m p = C.comp m q → p = q

def Epi (C : Cat.{u, v}) {a b : C.Obj} (e : C.Hom a b) : Prop :=
  ∀ {x : C.Obj} (p q : C.Hom b x), C.comp p e = C.comp q e → p = q

structure Terminal (C : Cat.{u, v}) (t : C.Obj) where
  to : (x : C.Obj) → C.Hom x t
  uniq : ∀ {x : C.Obj} (f : C.Hom x t), f = to x

structure Initial (C : Cat.{u, v}) (i : C.Obj) where
  from_ : (x : C.Obj) → C.Hom i x
  uniq : ∀ {x : C.Obj} (f : C.Hom i x), f = from_ x

structure Product (C : Cat.{u, v}) (a b p : C.Obj) where
  fst : C.Hom p a
  snd : C.Hom p b
  pair : {x : C.Obj} → C.Hom x a → C.Hom x b → C.Hom x p
  fst_pair : ∀ {x : C.Obj} (f : C.Hom x a) (g : C.Hom x b), C.comp fst (pair f g) = f
  snd_pair : ∀ {x : C.Obj} (f : C.Hom x a) (g : C.Hom x b), C.comp snd (pair f g) = g
  uniq : ∀ {x : C.Obj} (h : C.Hom x p), h = pair (C.comp fst h) (C.comp snd h)

structure Pullback (C : Cat.{u, v}) {a b c : C.Obj} (f : C.Hom a c) (g : C.Hom b c) (p : C.Obj) where
  fst : C.Hom p a
  snd : C.Hom p b
  square : C.comp f fst = C.comp g snd
  lift : {x : C.Obj} → (h : C.Hom x a) → (k : C.Hom x b) → C.comp f h = C.comp g k → C.Hom x p
  fst_lift : ∀ {x : C.Obj} (h : C.Hom x a) (k : C.Hom x b) (w : C.comp f h = C.comp g k),
    C.comp fst (lift h k w) = h
  snd_lift : ∀ {x : C.Obj} (h : C.Hom x a) (k : C.Hom x b) (w : C.comp f h = C.comp g k),
    C.comp snd (lift h k w) = k
  uniq : ∀ {x : C.Obj} (l l' : C.Hom x p), C.comp fst l = C.comp fst l' →
    C.comp snd l = C.comp snd l' → l = l'

structure Equalizer (C : Cat.{u, v}) {a b : C.Obj} (f g : C.Hom a b) (e : C.Obj) where
  ι : C.Hom e a
  eq : C.comp f ι = C.comp g ι
  lift : {x : C.Obj} → (h : C.Hom x a) → C.comp f h = C.comp g h → C.Hom x e
  ι_lift : ∀ {x : C.Obj} (h : C.Hom x a) (w : C.comp f h = C.comp g h), C.comp ι (lift h w) = h
  uniq : ∀ {x : C.Obj} (l l' : C.Hom x e), C.comp ι l = C.comp ι l' → l = l'

end Cat

structure Fun (C : Cat.{u₁, v₁}) (D : Cat.{u₂, v₂}) where
  obj : C.Obj → D.Obj
  map : {a b : C.Obj} → C.Hom a b → D.Hom (obj a) (obj b)
  map_id : ∀ (a : C.Obj), map (C.id a) = D.id (obj a)
  map_comp : ∀ {a b c : C.Obj} (g : C.Hom b c) (f : C.Hom a b),
    map (C.comp g f) = D.comp (map g) (map f)

structure NatTrans {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F G : Fun C D) where
  app : (a : C.Obj) → D.Hom (F.obj a) (G.obj a)
  natural : ∀ {a b : C.Obj} (f : C.Hom a b),
    D.comp (G.map f) (app a) = D.comp (app b) (F.map f)

theorem NatTrans.ext {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F G : Fun C D} :
    ∀ (α β : NatTrans F G), α.app = β.app → α = β
  | ⟨_, _⟩, ⟨_, _⟩, rfl => rfl

structure Adj {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F : Fun C D) (G : Fun D C) where
  unit : (a : C.Obj) → C.Hom a (G.obj (F.obj a))
  counit : (b : D.Obj) → D.Hom (F.obj (G.obj b)) b
  unit_natural : ∀ {a a' : C.Obj} (f : C.Hom a a'),
    C.comp (G.map (F.map f)) (unit a) = C.comp (unit a') f
  counit_natural : ∀ {b b' : D.Obj} (g : D.Hom b b'),
    D.comp g (counit b) = D.comp (counit b') (F.map (G.map g))
  left_triangle : ∀ (a : C.Obj), D.comp (counit (F.obj a)) (F.map (unit a)) = D.id (F.obj a)
  right_triangle : ∀ (b : D.Obj), C.comp (G.map (counit b)) (unit (G.obj b)) = C.id (G.obj b)

structure CatMonad (C : Cat.{u, v}) where
  T : Fun C C
  η : (a : C.Obj) → C.Hom a (T.obj a)
  μ : (a : C.Obj) → C.Hom (T.obj (T.obj a)) (T.obj a)
  η_natural : ∀ {a b : C.Obj} (f : C.Hom a b), C.comp (T.map f) (η a) = C.comp (η b) f
  μ_natural : ∀ {a b : C.Obj} (f : C.Hom a b),
    C.comp (T.map f) (μ a) = C.comp (μ b) (T.map (T.map f))
  assoc : ∀ (a : C.Obj), C.comp (μ a) (T.map (μ a)) = C.comp (μ a) (μ (T.obj a))
  left_unit : ∀ (a : C.Obj), C.comp (μ a) (η (T.obj a)) = C.id (T.obj a)
  right_unit : ∀ (a : C.Obj), C.comp (μ a) (T.map (η a)) = C.id (T.obj a)
