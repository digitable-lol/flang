inductive N where
  | zero : N
  | succ : N → N

def add : N → N → N
  | N.zero, m => m
  | N.succ n, m => N.succ (add n m)

theorem addZero (n : N) : add n N.zero = n := by
  induction n with
  | zero => rfl
  | succ k ih => simp [add, ih]
