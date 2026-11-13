def ins (v : Nat) : List Nat → List Nat
  | [] => [v]
  | x :: xs => if v ≤ x then v :: x :: xs else x :: ins v xs

def lowerBound (g : Nat) : List Nat → Bool
  | [] => true
  | x :: xs => decide (g ≤ x) && lowerBound g xs

def sorted : List Nat → Bool
  | [] => true
  | x :: xs => lowerBound x xs && sorted xs

theorem lowerBoundIns (g v : Nat) (xs : List Nat) :
    lowerBound g (ins v xs) = (decide (g ≤ v) && lowerBound g xs) := by
  induction xs with
  | nil => simp [ins, lowerBound]
  | cons x xs ih =>
    simp only [ins]
    split
    · simp [lowerBound]
    · simp [lowerBound, ih]
      cases decide (g ≤ x) <;> cases decide (g ≤ v) <;> simp

theorem lowerBoundMono (g h : Nat) (xs : List Nat) (hg : g ≤ h) (hb : lowerBound h xs = true) :
    lowerBound g xs = true := by
  induction xs with
  | nil => rfl
  | cons x xs ih =>
    simp [lowerBound] at hb ⊢
    exact ⟨by omega, ih hb.2⟩

theorem sortedIns (v : Nat) (xs : List Nat) (h : sorted xs = true) : sorted (ins v xs) = true := by
  induction xs with
  | nil => simp [ins, sorted, lowerBound]
  | cons x xs ih =>
    simp [sorted] at h
    simp only [ins]
    split
    · rename_i hv
      simp [sorted, lowerBound, hv, h.1, h.2]
      exact lowerBoundMono v x xs hv h.1
    · rename_i hv
      simp [sorted, lowerBoundIns, h.1, ih h.2]
      omega
