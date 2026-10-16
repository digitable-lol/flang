mutual
def isEven : Nat → Bool
  | 0 => true
  | n + 1 => isOdd n
def isOdd : Nat → Bool
  | 0 => false
  | n + 1 => isEven n
end

theorem evenNotOdd (n : Nat) : isEven n = !isOdd n := by
  induction n with
  | zero => rfl
  | succ k ih =>
    simp only [isEven, isOdd, ih, Bool.not_not]
