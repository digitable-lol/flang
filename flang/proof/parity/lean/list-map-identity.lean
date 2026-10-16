theorem mapIdSelf (xs : List Nat) : xs.map (fun e => e) = xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [ih]
