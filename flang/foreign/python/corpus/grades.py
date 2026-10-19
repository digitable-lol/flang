"""Grades by score: an elif chain and a comprehension over a list of scores."""


def grade(score: int) -> str:
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    elif score >= 60:
        return "C"
    return "F"


def report(scores: list[int]) -> list[str]:
    return [grade(s) for s in scores]


def passed(scores: list[int]) -> int:
    return len([s for s in scores if grade(s) != "F"])
