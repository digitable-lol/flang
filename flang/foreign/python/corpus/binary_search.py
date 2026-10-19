"""Binary search in a sorted list: correct, but its measure is not visible to the translator."""


def search(xs: list[int], target: int, low: int, high: int) -> int:
    if low > high:
        return -1
    middle = (low + high) // 2
    if xs[middle] == target:
        return middle
    if xs[middle] < target:
        return search(xs, target, middle + 1, high)
    return search(xs, target, low, middle - 1)


def find(xs: list[int], target: int) -> int:
    return search(xs, target, 0, len(xs) - 1)
