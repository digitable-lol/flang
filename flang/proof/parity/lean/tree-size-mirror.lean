inductive Tree where
  | leaf : Tree
  | node : Nat → Tree → Tree → Tree

def mirror : Tree → Tree
  | .leaf => .leaf
  | .node v l r => .node v (mirror r) (mirror l)

def size : Tree → Nat
  | .leaf => 0
  | .node _ l r => 1 + size l + size r

theorem sizeMirror (t : Tree) : size (mirror t) = size t := by
  induction t with
  | leaf => rfl
  | node v l r ihl ihr => simp [mirror, size, ihl, ihr]; omega
