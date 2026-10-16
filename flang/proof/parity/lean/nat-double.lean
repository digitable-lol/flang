def double (n : Nat) : Nat := n + n

theorem doubleIsTwice (n : Nat) : double n = 2 * n := by
  unfold double
  omega
