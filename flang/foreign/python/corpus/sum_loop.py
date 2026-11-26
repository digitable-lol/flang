"""The sum from 1 to n, counted by a loop."""


def sum_to(n: int) -> int:
    total = 0
    for i in range(1, n + 1):
        total += i
    return total
