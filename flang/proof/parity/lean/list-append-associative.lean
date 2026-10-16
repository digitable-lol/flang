def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

theorem appAssoc (xs ys zs : List Nat) : app (app xs ys) zs = app xs (app ys zs) := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [app, ih]
