import Category

theorem opposite_is_involutive (C : Cat.{u, v}) : C.op.op = C := by
  cases C
  rfl

theorem terminal_in_opposite_is_initial (C : Cat.{u, v}) (t : C.Obj) (T : Cat.Terminal C.op t) :
    Nonempty (Cat.Initial C t) :=
  ⟨{ from_ := T.to, uniq := T.uniq }⟩
