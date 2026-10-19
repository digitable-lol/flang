"""A list changed in place with append: refused."""


def doubled(xs: list[int]) -> list[int]:
    result: list[int] = []
    for x in xs:
        result.append(2 * x)
    return result
