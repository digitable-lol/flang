def len : List Nat → Nat
  | [] => 0
  | _ :: xs => 1 + len xs

def ins (v : Nat) : List Nat → List Nat
  | [] => [v]
  | x :: xs => if v ≤ x then v :: x :: xs else x :: ins v xs

def sort : List Nat → List Nat
  | [] => []
  | x :: xs => ins x (sort xs)

theorem lenIns (v : Nat) (xs : List Nat) : len (ins v xs) = 1 + len xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih =>
    simp only [ins]
    split <;> simp [len, ih]

theorem lenSort (xs : List Nat) : len (sort xs) = len xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [sort, lenIns, len, ih]
