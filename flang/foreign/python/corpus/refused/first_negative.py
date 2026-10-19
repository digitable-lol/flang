"""A return inside a loop: refused."""


def first_negative(xs: list[int]) -> int:
    for x in xs:
        if x < 0:
            return x
    return 0
