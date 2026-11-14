def halfOfEven (x : Nat) : Option Nat :=
  if x % 2 = 0 then some (x / 2) else none

def bindHalf : Option Nat → Option Nat
  | none => none
  | some v => halfOfEven v

theorem bindSome (x : Nat) : bindHalf (some x) = halfOfEven x := by
  simp [bindHalf]

theorem bindNoneTwice : bindHalf (bindHalf none) = none := by
  simp [bindHalf]
