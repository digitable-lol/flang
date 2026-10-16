import Category

structure HomAdj {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} (F : Fun C D) (G : Fun D C) where
  φ : {a : C.Obj} → {b : D.Obj} → D.Hom (F.obj a) b → C.Hom a (G.obj b)
  ψ : {a : C.Obj} → {b : D.Obj} → C.Hom a (G.obj b) → D.Hom (F.obj a) b
  ψφ : ∀ {a b} (f : D.Hom (F.obj a) b), ψ (φ f) = f
  φψ : ∀ {a b} (g : C.Hom a (G.obj b)), φ (ψ g) = g
  φ_left : ∀ {a a' b} (h : C.Hom a' a) (f : D.Hom (F.obj a) b), φ (D.comp f (F.map h)) = C.comp (φ f) h
  φ_right : ∀ {a b b'} (k : D.Hom b b') (f : D.Hom (F.obj a) b), φ (D.comp k f) = C.comp (G.map k) (φ f)

variable {C : Cat.{u₁, v₁}} {D : Cat.{u₂, v₂}} {F : Fun C D} {G : Fun D C}

theorem HomAdj.φ_is_unit (H : HomAdj F G) {a b} (f : D.Hom (F.obj a) b) :
    H.φ f = C.comp (G.map f) (H.φ (D.id (F.obj a))) := by
  rw [← H.φ_right, D.comp_id]

theorem HomAdj.ψ_left {a a' b} (H : HomAdj F G) (h : C.Hom a' a) (g : C.Hom a (G.obj b)) :
    H.ψ (C.comp g h) = D.comp (H.ψ g) (F.map h) := by
  rw [← H.ψφ (D.comp (H.ψ g) (F.map h)), H.φ_left, H.φψ]

theorem HomAdj.ψ_right {a b b'} (H : HomAdj F G) (k : D.Hom b b') (g : C.Hom a (G.obj b)) :
    H.ψ (C.comp (G.map k) g) = D.comp k (H.ψ g) := by
  rw [← H.ψφ (D.comp k (H.ψ g)), H.φ_right, H.φψ]

theorem HomAdj.ψ_is_counit (H : HomAdj F G) {a b} (g : C.Hom a (G.obj b)) :
    H.ψ g = D.comp (H.ψ (C.id (G.obj b))) (F.map g) := by
  rw [← H.ψ_left, C.id_comp]

def HomAdj.toAdj (H : HomAdj F G) : Adj F G where
  unit a := H.φ (D.id (F.obj a))
  counit b := H.ψ (C.id (G.obj b))
  unit_natural f := by
    rw [← H.φ_is_unit, ← H.φ_left, D.id_comp]
  counit_natural g := by
    rw [← H.ψ_is_counit, ← H.ψ_right, C.comp_id]
  left_triangle a := by
    rw [← H.ψ_is_counit, H.ψφ]
  right_triangle b := by
    rw [← H.φ_is_unit, H.φψ]
