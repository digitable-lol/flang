"""A countdown that stops only at zero: on a negative number it never ends."""


def countdown(n: int) -> int:
    if n == 0:
        return 0
    return countdown(n - 1)


def countdown_safe(n: int) -> int:
    if n <= 0:
        return 0
    return countdown_safe(n - 1)
