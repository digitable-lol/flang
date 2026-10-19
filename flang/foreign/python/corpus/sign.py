"""Sign and absolute value: if/elif/else and the conditional expression."""


def sign(x: int) -> int:
    if x > 0:
        return 1
    elif x < 0:
        return -1
    else:
        return 0


def absolute(x: float) -> float:
    return x if x >= 0 else -x


def clamp(x: int, low: int, high: int) -> int:
    if x < low:
        return low
    if x > high:
        return high
    return x
