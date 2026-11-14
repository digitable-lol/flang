def countFrom (n i : Nat) : Nat :=
  if i < n then countFrom n (i + 1) else i
termination_by n - i

def countTo (n : Nat) : Nat := countFrom n 0

theorem countFromReaches (n i : Nat) (h : i ≤ n) : countFrom n i = n := by
  fun_induction countFrom n i with
  | case1 i hlt ih => exact ih (by omega)
  | case2 i hge => omega

theorem countToReaches (n : Nat) : countTo n = n := by
  simp [countTo, countFromReaches]
