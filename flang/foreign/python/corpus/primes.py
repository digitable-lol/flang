"""Primes: a test by trial division and the list of primes below a bound."""


def is_prime(n: int) -> bool:
    if n < 2:
        return False
    prime = True
    for d in range(2, n):
        if d * d <= n and n % d == 0:
            prime = False
    return prime


def primes_below(n: int) -> list[int]:
    return [k for k in range(n) if is_prime(k)]
