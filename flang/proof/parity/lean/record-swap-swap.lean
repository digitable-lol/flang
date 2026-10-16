structure Pair where
  first : Nat
  second : Nat

def swap (p : Pair) : Pair := { first := p.second, second := p.first }

theorem swapSwap (p : Pair) : swap (swap p) = p := by
  cases p
  rfl
