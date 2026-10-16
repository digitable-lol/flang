def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

theorem lengthApp (xs ys : List Nat) : (app xs ys).length = xs.length + ys.length := by
  induction xs with
  | nil => simp [app]
  | cons x xs ih => simp [app, ih]; omega

theorem lengthSnoc (xs : List Nat) (x : Nat) : (app xs [x]).length = xs.length + 1 := by
  simp [lengthApp]
