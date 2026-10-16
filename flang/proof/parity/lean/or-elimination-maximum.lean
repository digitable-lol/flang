def maxOf (a b : Nat) : Nat := if b ≤ a then a else b

theorem maxOfOneOf (a b : Nat) : maxOf a b = a ∨ maxOf a b = b := by
  unfold maxOf
  split
  · exact Or.inl rfl
  · exact Or.inr rfl
