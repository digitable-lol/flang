inductive N where
  | zero : N
  | succ : N → N

def pow2 : N → Nat
  | N.zero => 1
  | N.succ n => pow2 n + pow2 n

theorem pow2Pos (n : N) : 1 ≤ pow2 n := by
  induction n with
  | zero => simp [pow2]
  | succ k ih => simp only [pow2]; omega
