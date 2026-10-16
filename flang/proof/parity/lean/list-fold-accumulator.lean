def sumWith : Nat → List Nat → Nat
  | acc, [] => acc
  | acc, x :: xs => sumWith (acc + x) xs

theorem sumWithAcc (n : Nat) (xs : List Nat) : sumWith n xs = n + sumWith 0 xs := by
  induction xs generalizing n with
  | nil => rfl
  | cons x xs ih =>
    simp only [sumWith]
    rw [ih (n + x), ih (0 + x)]
    omega
