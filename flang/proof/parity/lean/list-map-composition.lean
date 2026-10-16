theorem mapComp (xs : List Nat) :
    (xs.map (fun e => e + 1)).map (fun e => e * 2) = xs.map (fun e => (e + 1) * 2) := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [ih]
