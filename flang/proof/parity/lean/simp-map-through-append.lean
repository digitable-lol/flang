def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

theorem mapApp (xs ys : List Nat) :
    (app xs ys).map (fun x => x * 2) = app (xs.map (fun x => x * 2)) (ys.map (fun x => x * 2)) := by
  induction xs with
  | nil => simp [app]
  | cons x xs ih => simp [app, ih]
