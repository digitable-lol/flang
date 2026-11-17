def largest (a b : Nat) : Nat :=
  if a > b then a else b

theorem largest_ge_left (a b : Nat) : largest a b ≥ a := by
  unfold largest; split <;> omega

theorem largest_ge_right (a b : Nat) : largest a b ≥ b := by
  unfold largest; split <;> omega

theorem largest_comm (a b : Nat) : largest a b = largest b a := by
  unfold largest; split <;> split <;> omega
