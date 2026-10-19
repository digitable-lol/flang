"""The largest element and its position, found by a loop."""


def largest(xs: list[int]) -> int:
    best = xs[0]
    for x in xs[1:]:
        if x > best:
            best = x
    return best


def position_of_largest(xs: list[int]) -> int:
    best = xs[0]
    place = 0
    for i in range(len(xs)):
        if xs[i] > best:
            best = xs[i]
            place = i
    return place
