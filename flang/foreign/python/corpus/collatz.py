"""Collatz steps: nobody has proved that this recursion always ends."""


def steps(n: int) -> int:
    if n <= 1:
        return 0
    if n % 2 == 0:
        return 1 + steps(n // 2)
    return 1 + steps(3 * n + 1)
