"""Greatest common divisor by Euclid, and the least common multiple."""


def gcd(a: int, b: int) -> int:
    if b == 0:
        return abs(a)
    return gcd(b, a % b)


def lcm(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return abs(a * b) // gcd(a, b)
