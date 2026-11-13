inductive Tree where
  | leaf : Tree
  | node : Nat → Tree → Tree → Tree

def app : List Nat → List Nat → List Nat
  | [], ys => ys
  | x :: xs, ys => x :: app xs ys

def len : List Nat → Nat
  | [] => 0
  | _ :: xs => 1 + len xs

def size : Tree → Nat
  | Tree.leaf => 0
  | Tree.node _ l r => (1 + size l) + size r

def walk : Tree → List Nat
  | Tree.leaf => []
  | Tree.node v l r => app (walk l) (v :: walk r)

theorem lenApp (xs ys : List Nat) : len (app xs ys) = len xs + len ys := by
  induction xs with
  | nil => simp [app, len]
  | cons x xs ih => simp [app, len, ih]; omega

theorem lenWalk (t : Tree) : len (walk t) = size t := by
  induction t with
  | leaf => rfl
  | node v l r ihl ihr => simp [walk, size, lenApp, len, ihl, ihr]; omega
