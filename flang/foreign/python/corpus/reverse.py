"""Reversing a list and checking a palindrome."""


def reverse(xs: list[int]) -> list[int]:
    result: list[int] = []
    for x in xs:
        result = [x] + result
    return result


def is_palindrome(text: str) -> bool:
    ok = True
    for i in range(len(text) // 2):
        if text[i] != text[-1 - i]:
            ok = False
    return ok
