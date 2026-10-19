"""Division as Python does it: floor division and remainder take the sign of the divisor."""


def floor_div(a: int, b: int) -> int:
    return a // b


def remainder(a: int, b: int) -> int:
    return a % b


def ratio(a: int, b: int) -> float:
    return a / b
