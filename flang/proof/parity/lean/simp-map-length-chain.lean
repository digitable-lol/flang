theorem mapMapLength (xs : List Nat) :
    ((xs.map (fun x => x + 1)).map (fun y => y * 2)).length = xs.length := by
  simp
