"""A function that can end without return gives None: refused."""


def positive_or_nothing(x: int) -> int:
    if x > 0:
        return x
