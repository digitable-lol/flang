"""A module-level total changed by a function: refused."""

TOTAL = 0


def add(x: int) -> int:
    global TOTAL
    TOTAL = TOTAL + x
    return TOTAL
