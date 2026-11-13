theorem emptyEdges (a b : String) : (("" ++ a) ++ "") ++ (b ++ "") = a ++ b := by
  simp
