"""Strings: repeating, counting a letter, and the initials of words."""


def repeat(word: str, times: int) -> str:
    result = ""
    for _ in range(times):
        result = result + word
    return result


def count_letter(text: str, letter: str) -> int:
    count = 0
    for c in text:
        if c == letter:
            count = count + 1
    return count


def shout(text: str) -> str:
    return text + "!" if len(text) > 0 else "?"
