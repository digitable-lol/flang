def binLength (n : Nat) : Nat :=
  if h : n < 1 then 0 else 1 + binLength (n / 2)
termination_by n
decreasing_by omega

theorem binLengthLe (n : Nat) : binLength n ≤ n := by
  induction n using Nat.strongRecOn with
  | ind n ih =>
    unfold binLength
    split
    · omega
    · have := ih (n / 2) (by omega)
      omega
