"""Lists of lists: row sums and the trace of a square matrix."""


def row_sums(rows: list[list[int]]) -> list[int]:
    return [sum(row) for row in rows]


def trace(rows: list[list[int]]) -> int:
    t = 0
    for i in range(len(rows)):
        t = t + rows[i][i]
    return t
