def mem (x : Nat) : List Nat → Bool
  | [] => false
  | y :: ys => if y = x then true else mem x ys

def place (x : Nat) : List Nat → Nat
  | [] => 0
  | y :: ys => if y = x then 1 else (if place x ys = 0 then 0 else 1 + place x ys)

theorem notFoundNotMember (x : Nat) (xs : List Nat) :
    if place x xs = 0 then mem x xs = false else mem x xs = true := by
  induction xs with
  | nil => simp [place, mem]
  | cons y ys ih =>
    simp only [place, mem]
    split
    · simp
    · split
      · simp_all
      · simp_all
