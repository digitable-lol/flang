inductive Maybe where
  | nothing : Maybe
  | just : Nat → Maybe

def addOne : Maybe → Maybe
  | .nothing => .nothing
  | .just v => .just (v + 1)

def addTwice : Maybe → Maybe
  | .nothing => .nothing
  | .just v => .just ((v + 1) + 1)

theorem addOneTwice (m : Maybe) : addOne (addOne m) = addTwice m := by
  cases m <;> rfl
