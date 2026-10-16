def maxOf (a b : Nat) : Nat := if b ≤ a then a else b

theorem maxOfGe (a b : Nat) : a ≤ maxOf a b := by
  unfold maxOf
  split <;> omega
