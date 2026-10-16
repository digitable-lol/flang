inductive Signal where
  | red | yellow | green
  deriving DecidableEq

def next : Signal → Signal
  | .red => .green
  | .green => .yellow
  | .yellow => .red

theorem nextCycle (s : Signal) : next (next (next s)) = s := by
  cases s <;> rfl
