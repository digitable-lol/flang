universe u v u₁ v₁ u₂ v₂ u₃ v₃

structure PCat where
  Obj : Type u
  Hom : Obj → Obj → Type v
  id : (a : Obj) → Hom a a
  comp : {a b c : Obj} → Hom b c → Hom a b → Hom a c
  id_comp : ∀ {a b : Obj} (f : Hom a b), comp (id b) f = f
  comp_id : ∀ {a b : Obj} (f : Hom a b), comp f (id a) = f
  assoc : ∀ {a b c d : Obj} (h : Hom c d) (g : Hom b c) (f : Hom a b),
    comp (comp h g) f = comp h (comp g f)

structure PFun (C : PCat.{u₁, v₁}) (D : PCat.{u₂, v₂}) where
  obj : C.Obj → D.Obj
  map : {a b : C.Obj} → C.Hom a b → D.Hom (obj a) (obj b)
  map_id : ∀ (a : C.Obj), map (C.id a) = D.id (obj a)
  map_comp : ∀ {a b c : C.Obj} (g : C.Hom b c) (f : C.Hom a b),
    map (C.comp g f) = D.comp (map g) (map f)

structure PNat {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F G : PFun C D) where
  app : (a : C.Obj) → D.Hom (F.obj a) (G.obj a)
  natural : ∀ {a b : C.Obj} (f : C.Hom a b),
    D.comp (G.map f) (app a) = D.comp (app b) (F.map f)

inductive Path (C : PCat.{u, v}) : C.Obj → C.Obj → Type (max u v)
  | nil (a : C.Obj) : Path C a a
  | cons {a b c : C.Obj} (f : C.Hom b c) (p : Path C a b) : Path C a c

namespace Path

variable {C : PCat.{u, v}}

def eval : {a b : C.Obj} → Path C a b → C.Hom a b
  | a, _, nil _ => C.id a
  | _, _, cons f p => C.comp f (eval p)

def append : {a b c : C.Obj} → Path C b c → Path C a b → Path C a c
  | _, _, _, nil _, q => q
  | _, _, _, cons f p, q => cons f (append p q)

theorem eval_append : ∀ {a b c : C.Obj} (p : Path C b c) (q : Path C a b),
    eval (append p q) = C.comp (eval p) (eval q)
  | _, _, _, nil _, q => by simp only [append, eval, C.id_comp]
  | _, _, _, cons f p, q => by simp only [append, eval, eval_append p q, C.assoc]

theorem append_assoc : ∀ {a b c d : C.Obj} (p : Path C c d) (q : Path C b c) (r : Path C a b),
    append (append p q) r = append p (append q r)
  | _, _, _, _, nil _, _, _ => by simp only [append]
  | _, _, _, _, cons f p, q, r => by simp only [append, append_assoc p q r]

end Path

inductive Term (C : PCat.{u, v}) : C.Obj → C.Obj → Type (max u v)
  | atom {a b : C.Obj} (f : C.Hom a b) : Term C a b
  | ident (a : C.Obj) : Term C a a
  | comp {a b c : C.Obj} (g : Term C b c) (f : Term C a b) : Term C a c

namespace Term

variable {C : PCat.{u, v}}

def denote : {a b : C.Obj} → Term C a b → C.Hom a b
  | _, _, atom f => f
  | a, _, ident _ => C.id a
  | _, _, comp g f => C.comp (denote g) (denote f)

def opened : {a b : C.Obj} → Term C a b → Path C a b
  | _, _, atom f => Path.cons f (Path.nil _)
  | a, _, ident _ => Path.cons (C.id a) (Path.nil a)
  | _, _, comp g f => Path.append (opened g) (opened f)

def withoutUnits : {a b : C.Obj} → Term C a b → Path C a b
  | _, _, atom f => Path.cons f (Path.nil _)
  | a, _, ident _ => Path.nil a
  | _, _, comp g f => Path.append (withoutUnits g) (withoutUnits f)

theorem eval_opened : ∀ {a b : C.Obj} (t : Term C a b), Path.eval (opened t) = denote t
  | _, _, atom f => by simp only [opened, denote, Path.eval, C.comp_id]
  | _, _, ident _ => by simp only [opened, denote, Path.eval, C.comp_id]
  | _, _, comp g f => by simp only [opened, denote, Path.eval_append, eval_opened g, eval_opened f]

theorem eval_withoutUnits : ∀ {a b : C.Obj} (t : Term C a b), Path.eval (withoutUnits t) = denote t
  | _, _, atom f => by simp only [withoutUnits, denote, Path.eval, C.comp_id]
  | _, _, ident _ => by simp only [withoutUnits, denote, Path.eval]
  | _, _, comp g f => by
    simp only [withoutUnits, denote, Path.eval_append, eval_withoutUnits g, eval_withoutUnits f]

theorem associativity_law_is_sound {a b : C.Obj} (s t : Term C a b)
    (h : opened s = opened t) : denote s = denote t := by
  rw [← eval_opened s, ← eval_opened t, h]

theorem unit_law_is_sound {a b : C.Obj} (s t : Term C a b)
    (h : withoutUnits s = withoutUnits t) : denote s = denote t := by
  rw [← eval_withoutUnits s, ← eval_withoutUnits t, h]

end Term

namespace Path

def map {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F : PFun C D) :
    {a b : C.Obj} → Path C a b → Path D (F.obj a) (F.obj b)
  | a, _, nil _ => nil (F.obj a)
  | _, _, cons f p => cons (F.map f) (map F p)

theorem eval_map {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F : PFun C D) :
    ∀ {a b : C.Obj} (p : Path C a b), eval (map F p) = F.map (eval p)
  | _, _, nil _ => by simp only [map, eval, F.map_id]
  | _, _, cons f p => by simp only [map, eval, eval_map F p, F.map_comp]

theorem map_append {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F : PFun C D) :
    ∀ {a b c : C.Obj} (p : Path C b c) (q : Path C a b),
      map F (append p q) = append (map F p) (map F q)
  | _, _, _, nil _, _ => by simp only [map, append]
  | _, _, _, cons f p, q => by simp only [map, append, map_append F p q]

theorem functoriality_law_is_sound {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F : PFun C D)
    {a b : C.Obj} (s t : Term C a b) (h : Term.withoutUnits s = Term.withoutUnits t) :
    eval (map F (Term.withoutUnits s)) = F.map (Term.denote t) := by
  rw [eval_map, h, Term.eval_withoutUnits]

theorem rewrite_is_sound {a b c d : C.Obj} (pre : Path C c d) (mid mid' : Path C b c) (post : Path C a b)
    (h : eval mid = eval mid') :
    eval (append pre (append mid post)) = eval (append pre (append mid' post)) := by
  rw [eval_append, eval_append, eval_append, eval_append, h]

theorem rewrite_under_functor_is_sound {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} (F : PFun C D)
    {a b c d : D.Obj} {x y : C.Obj} (pre : Path D c d) (mid mid' : Path C x y)
    (post : Path D a b) (eb : F.obj x = b) (ec : F.obj y = c)
    (h : eval mid = eval mid') :
    eval (append pre (append (eb ▸ ec ▸ map F mid) post)) =
      eval (append pre (append (eb ▸ ec ▸ map F mid') post)) := by
  subst eb; subst ec
  apply rewrite_is_sound
  rw [eval_map, eval_map, h]

theorem naturality_square_is_sound {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} {F G : PFun C D}
    (t : PNat F G) : ∀ {a b : C.Obj} (q : Path C a b),
      eval (append (map G q) (cons (t.app a) (nil (F.obj a)))) = eval (cons (t.app b) (map F q))
  | _, _, nil _ => by simp only [map, append]
  | _, _, cons f q => by
    have h := naturality_square_is_sound t q
    simp only [map, append, eval] at h ⊢
    rw [h, ← D.assoc, t.natural, D.assoc]

end Path

def PFun.comp {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} {E : PCat.{u₃, v₃}}
    (G : PFun D E) (F : PFun C D) : PFun C E where
  obj a := G.obj (F.obj a)
  map f := G.map (F.map f)
  map_id a := by rw [F.map_id, G.map_id]
  map_comp g f := by rw [F.map_comp, G.map_comp]

def PFun.ident (C : PCat.{u, v}) : PFun C C where
  obj a := a
  map f := f
  map_id _ := rfl
  map_comp _ _ := rfl

namespace Path

theorem map_comp_functor {C : PCat.{u₁, v₁}} {D : PCat.{u₂, v₂}} {E : PCat.{u₃, v₃}}
    (G : PFun D E) (F : PFun C D) :
    ∀ {a b : C.Obj} (p : Path C a b), map (PFun.comp G F) p = map G (map F p)
  | _, _, nil _ => by simp only [map]; rfl
  | _, _, cons f p => by simp only [map, map_comp_functor G F p]; rfl

theorem map_ident {C : PCat.{u, v}} : ∀ {a b : C.Obj} (p : Path C a b), map (PFun.ident C) p = p
  | _, _, nil _ => by simp only [map]; rfl
  | _, _, cons f p => by simp only [map, map_ident p]; rfl

end Path

