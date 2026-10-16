def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def rev : List Nat → List Nat
  | [] => []
  | x :: xs => app (rev xs) [x]

theorem revSnoc (xs : List Nat) (x : Nat) : rev (app xs [x]) = x :: rev xs := by
  induction xs with
  | nil => rfl
  | cons y ys ih => simp [app, rev, ih]

theorem revRev (xs : List Nat) : rev (rev xs) = xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih =>
    calc rev (rev (x :: xs)) = rev (app (rev xs) [x]) := rfl
      _ = x :: rev (rev xs) := revSnoc (rev xs) x
      _ = x :: xs := by rw [ih]
