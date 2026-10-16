def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

theorem appNil (xs : List Nat) : app xs [] = xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [app, ih]
