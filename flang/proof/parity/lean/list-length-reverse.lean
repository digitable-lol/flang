def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def rev : List Nat → List Nat
  | [] => []
  | x :: xs => app (rev xs) [x]

theorem lengthApp (xs ys : List Nat) : (app xs ys).length = xs.length + ys.length := by
  induction xs with
  | nil => simp [app]
  | cons x xs ih => simp [app, ih]; omega

theorem lengthRev (xs : List Nat) : (rev xs).length = xs.length := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [rev, lengthApp, ih]
