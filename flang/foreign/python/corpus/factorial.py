"""Factorial by a loop over range and by recursion."""


def factorial_loop(n: int) -> int:
    result = 1
    for i in range(1, n + 1):
        result = result * i
    return result


def factorial(n: int) -> int:
    if n <= 0:
        return 1
    return n * factorial(n - 1)
