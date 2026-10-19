"""Powers: repeated multiplication, a cube, and powers of two up to a bound."""


def power(base: int, exponent: int) -> int:
    if exponent <= 0:
        return 1
    return base * power(base, exponent - 1)


def cube(x: float) -> float:
    return x ** 3


def powers_of_two(count: int) -> list[int]:
    return [power(2, k) for k in range(count)]
