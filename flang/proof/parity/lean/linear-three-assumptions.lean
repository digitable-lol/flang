theorem chain (a b c d : Nat) (h1 : a < b) (h2 : b < c) (h3 : c ≤ d) : a < d := by
  omega
