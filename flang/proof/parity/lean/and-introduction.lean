theorem andIntro (a b c : Nat) (h1 : a ≤ b) (h2 : b ≤ c) : a ≤ c ∧ a ≤ b := by
  constructor
  · omega
  · exact h1
