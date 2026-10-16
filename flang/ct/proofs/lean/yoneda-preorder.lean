structure Preorder' (α : Type u) where
  le : α → α → Prop
  refl : ∀ a, le a a
  trans : ∀ {a b c}, le a b → le b c → le a c

theorem yoneda_for_preorder {α : Type u} (P : Preorder' α) (a b : α) :
    P.le a b ↔ ∀ c, P.le c a → P.le c b :=
  ⟨fun h _ hc => P.trans hc h, fun h => h a (P.refl a)⟩

theorem yoneda_for_preorder_detects_equivalence {α : Type u} (P : Preorder' α) (a b : α)
    (h : ∀ c, P.le c a ↔ P.le c b) : P.le a b ∧ P.le b a :=
  ⟨(h a).mp (P.refl a), (h b).mpr (P.refl b)⟩
