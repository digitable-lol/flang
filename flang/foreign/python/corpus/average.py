"""Sum, mean and the share of positive numbers in a list."""


def total(xs: list[int]) -> int:
    s = 0
    for x in xs:
        s += x
    return s


def mean(xs: list[float]) -> float:
    if len(xs) == 0:
        return 0.0
    s = 0.0
    count = 0
    for x in xs:
        s = s + x
        count = count + 1
    return s / count


def positive_share(xs: list[int]) -> float:
    if not xs:
        return 0.0
    return len([x for x in xs if x > 0]) / len(xs)
