def fact : Nat → Nat
  | 0 => 1
  | n + 1 => (n + 1) * fact n

theorem factPos (n : Nat) : 0 < fact n := by
  induction n with
  | zero => decide
  | succ k ih => exact Nat.mul_pos (Nat.succ_pos k) ih
