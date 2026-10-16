def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def rev : List Nat → List Nat
  | [] => []
  | x :: xs => app (rev xs) [x]

def count (x : Nat) : List Nat → Nat
  | [] => 0
  | y :: ys => (if y = x then 1 else 0) + count x ys

theorem countApp (x : Nat) (xs ys : List Nat) : count x (app xs ys) = count x xs + count x ys := by
  induction xs with
  | nil => simp [app, count]
  | cons y ys' ih => simp [app, count, ih]; omega

theorem countRev (x : Nat) (xs : List Nat) : count x (rev xs) = count x xs := by
  induction xs with
  | nil => rfl
  | cons y ys ih => simp [rev, countApp, ih, count]; omega
