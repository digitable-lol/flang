def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

theorem memApp (x : Nat) (xs ys : List Nat) (h : x ∈ xs) : x ∈ app xs ys := by
  induction xs with
  | nil => cases h
  | cons y ys' ih =>
    cases h with
    | head => exact List.Mem.head _
    | tail _ h' => exact List.Mem.tail _ (ih h')
