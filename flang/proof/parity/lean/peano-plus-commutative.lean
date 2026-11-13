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

theorem addSucc (n m : N) : add n (N.succ m) = N.succ (add n m) := by
  induction n with
  | zero => rfl
  | succ k ih => simp [add, ih]

theorem addComm (n m : N) : add n m = add m n := by
  induction n with
  | zero => simp [add, addZero]
  | succ k ih => simp [add, addSucc, ih]
