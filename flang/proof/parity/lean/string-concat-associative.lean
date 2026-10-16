theorem concatAssoc (a b c : String) : (a ++ b) ++ c = a ++ (b ++ c) := by
  simp [String.append_assoc]
