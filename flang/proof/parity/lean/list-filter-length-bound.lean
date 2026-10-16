theorem filterLengthLe (xs : List Nat) : (xs.filter (fun e => e > 0)).length ≤ xs.length := by
  induction xs with
  | nil => simp
  | cons x xs ih =>
    cases hx : decide (x > 0) <;> simp only [List.filter, hx, List.length_cons] <;> omega
