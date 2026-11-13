def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def len : List Nat → Nat
  | [] => 0
  | _ :: xs => 1 + len xs

def flat : List (List Nat) → List Nat
  | [] => []
  | r :: rs => app r (flat rs)

def lens : List (List Nat) → Nat
  | [] => 0
  | r :: rs => len r + lens rs

theorem lenApp (xs ys : List Nat) : len (app xs ys) = len xs + len ys := by
  induction xs with
  | nil => simp [app, len]
  | cons x xs ih => simp [app, len, ih]; omega

theorem lenFlat (rs : List (List Nat)) : len (flat rs) = lens rs := by
  induction rs with
  | nil => rfl
  | cons r rs ih => simp [flat, lens, lenApp, ih]
