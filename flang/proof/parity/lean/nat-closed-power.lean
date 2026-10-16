def pow2 : Nat → Nat
  | 0 => 1
  | n + 1 => 2 * pow2 n

theorem pow2Ten : pow2 10 = 1024 := by decide
