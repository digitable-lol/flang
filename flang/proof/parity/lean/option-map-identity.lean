inductive Maybe where
  | nothing : Maybe
  | just : Nat → Maybe

def mapId : Maybe → Maybe
  | .nothing => .nothing
  | .just v => .just v

theorem mapIdSelf (m : Maybe) : mapId m = m := by
  cases m <;> rfl
