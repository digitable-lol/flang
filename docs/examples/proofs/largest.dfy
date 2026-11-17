function Largest(a: nat, b: nat): nat
  ensures Largest(a, b) >= a
  ensures Largest(a, b) >= b
{
  if a > b then a else b
}

lemma LargestCommutes(a: nat, b: nat)
  ensures Largest(a, b) == Largest(b, a)
{
}
