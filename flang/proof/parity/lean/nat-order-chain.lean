theorem calcChain (a b c d : Nat) (h1 : a ≤ b) (h2 : b ≤ c) (h3 : c ≤ d) : a ≤ d :=
  calc a ≤ b := h1
    _ ≤ c := h2
    _ ≤ d := h3
