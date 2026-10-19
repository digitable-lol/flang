"""Quicksort with comprehensions: the parts are shorter than the list."""


def quicksort(xs: list[int]) -> list[int]:
    if len(xs) == 0:
        return []
    pivot = xs[0]
    rest = xs[1:]
    smaller = [y for y in rest if y < pivot]
    larger = [y for y in rest if y >= pivot]
    return quicksort(smaller) + [pivot] + quicksort(larger)
