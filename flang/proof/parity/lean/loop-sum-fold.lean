def sum : List Nat → Nat
  | [] => 0
  | x :: xs => x + sum xs

def loopSum (xs : List Nat) : Nat := Id.run do
  let mut total := 0
  for x in xs do
    total := total + x
  return total

theorem foldlSum (acc : Nat) (xs : List Nat) :
    xs.foldl (fun t x => t + x) acc = acc + sum xs := by
  induction xs generalizing acc with
  | nil => simp [sum]
  | cons x xs ih => simp [List.foldl, sum, ih]; omega

theorem loopSumIsSum (xs : List Nat) : loopSum xs = sum xs := by
  simp [loopSum, foldlSum]
