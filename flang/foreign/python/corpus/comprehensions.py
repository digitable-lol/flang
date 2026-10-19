"""List comprehensions: squares, even numbers, and a count."""


def squares(xs: list[int]) -> list[int]:
    return [x * x for x in xs]


def evens(xs: list[int]) -> list[int]:
    return [x for x in xs if x % 2 == 0]


def count_between(xs: list[int], low: int, high: int) -> int:
    return sum([1 for x in xs if low <= x <= high])
