"""A while loop that divides its number by 10: the measure is the number itself."""


def digits(n: int) -> int:
    count = 1
    while n >= 10:
        n = n // 10
        count = count + 1
    return count
