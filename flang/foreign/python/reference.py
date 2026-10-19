"""The answers of the Python original: the reference the flang translation is compared with.

Usage: python3 -I reference.py PROGRAM.py INPUTS

INPUTS holds one call per line: the function name, a tab, and the arguments
as a Python list literal.  For every line the script prints the line number,
a tab, and either the value in the notation `flang run` prints (JSON without
spaces, numbers as JavaScript writes them) or `error` and the name of the
exception Python raised.

This is the only Python in the translator: the translator itself is written
in flang, and Python is needed only to know what the original answers.
"""

import ast
import decimal
import importlib.util
import json
import math
import sys


def number(value):
    """A number written the way JavaScript writes it, as `flang run` does."""
    if isinstance(value, bool):
        raise TypeError("bool is not a number here")
    if isinstance(value, int):
        return str(value)
    if math.isnan(value):
        return "NaN"
    if math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"
    if value == 0:
        return "0"
    sign, digits, exponent = decimal.Decimal(repr(value)).as_tuple()
    text = "".join(str(d) for d in digits)
    point = len(text) + exponent
    text = text.rstrip("0")
    size = len(text)
    if size <= point <= 21:
        written = text + "0" * (point - size)
    elif 0 < point <= 21:
        written = text[:point] + "." + text[point:]
    elif -6 < point <= 0:
        written = "0." + "0" * (-point) + text
    else:
        power = point - 1
        written = text[0] + ("." + text[1:] if size > 1 else "") + "e" + ("+" if power > 0 else "-") + str(abs(power))
    return ("-" if sign else "") + written


def shown(value):
    """A value in the notation of `flang run`."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(shown(item) for item in value) + "]"
    raise TypeError("a value outside the subset: " + type(value).__name__)


def main():
    program, inputs = sys.argv[1], sys.argv[2]
    spec = importlib.util.spec_from_file_location("original", program)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with open(inputs, encoding="utf-8") as lines:
        calls = [line.rstrip("\n").split("\t", 1) for line in lines if line.strip()]
    for place, (name, arguments) in enumerate(calls, start=1):
        try:
            answer = shown(getattr(module, name)(*ast.literal_eval(arguments)))
        except Exception as error:  # every refusal of Python is an answer here
            answer = "error " + type(error).__name__
        print(str(place) + "\t" + answer)


if __name__ == "__main__":
    main()
