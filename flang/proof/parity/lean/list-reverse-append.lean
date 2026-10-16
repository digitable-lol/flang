def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def rev : List Nat → List Nat
  | [] => []
  | x :: xs => app (rev xs) [x]

theorem appNil (xs : List Nat) : app xs [] = xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [app, ih]

theorem appAssoc (xs ys zs : List Nat) : app (app xs ys) zs = app xs (app ys zs) := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [app, ih]

theorem revApp (xs ys : List Nat) : rev (app xs ys) = app (rev ys) (rev xs) := by
  induction xs with
  | nil => simp [app, rev, appNil]
  | cons x xs ih => simp [app, rev, ih, appAssoc]
