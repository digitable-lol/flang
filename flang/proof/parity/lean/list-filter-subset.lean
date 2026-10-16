theorem filterSubset (xs : List Nat) : ∀ e ∈ xs.filter (fun x => x > 0), e ∈ xs := by
  intro e h
  exact (List.mem_filter.mp h).1
