inductive Tree where
  | leaf : Tree
  | node : Nat → Tree → Tree → Tree

def mirror : Tree → Tree
  | .leaf => .leaf
  | .node v l r => .node v (mirror r) (mirror l)

theorem mirrorMirror (t : Tree) : mirror (mirror t) = t := by
  induction t with
  | leaf => rfl
  | node v l r ihl ihr => simp [mirror, ihl, ihr]
