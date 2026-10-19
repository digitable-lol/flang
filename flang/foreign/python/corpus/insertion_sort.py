"""Insertion sort: insert by recursion on the tail, sort by a loop."""


def insert(x: int, xs: list[int]) -> list[int]:
    if not xs:
        return [x]
    if x <= xs[0]:
        return [x] + xs
    return [xs[0]] + insert(x, xs[1:])


def sort(xs: list[int]) -> list[int]:
    result: list[int] = []
    for x in xs:
        result = insert(x, result)
    return result
