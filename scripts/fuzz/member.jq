# Does the value printed by `flang run` belong to the declared type?
# jq -n --arg t <type code> --argjson v <value> -f member.jq
# The value as JSON, with Infinity/-Infinity/NaN already turned into the
# strings "+inf", "-inf", "nan" (search.fscript, «Очистить значение»). $t is
# the type code the generator wrote next to the call (generator.flang,
# «Тип словами»). Output: true or false.

def ceil53: 9007199254740991;
def integral: (type == "number") and (. == (. | floor));
def nat: integral and . >= 0 and . <= ceil53;
def int: integral and . >= (0 - ceil53) and . <= ceil53;
def num: (type == "number") or (. == "+inf") or (. == "-inf") or (. == "nan");
def weight: ((type == "number") and . >= 0) or (. == "+inf");
def digits: (type == "string") and test("^-?[0-9]+$");
# Decimal strings are compared as strings: a double cannot tell 2^64 - 1
# from 2^64, and the edge of the word is exactly where the holes live.
def ule($a; $b): ($a | length) < ($b | length) or
  (($a | length) == ($b | length) and $a <= $b);
def dle($a; $b):
  if ($a | startswith("-")) and ($b | startswith("-")) then ule($b[1:]; $a[1:])
  elif ($a | startswith("-")) then true
  elif ($b | startswith("-")) then false
  else ule($a; $b) end;
def canon: if . == "-0" then "0" else sub("^(?<s>-?)0+(?<d>[0-9])"; "\(.s)\(.d)") end;
def word($lo; $hi):
  (if type == "number" then (if integral and (fabs < 9007199254740992) then (. | tostring) else "x" end)
   elif digits then canon else "x" end) as $d
  | $d != "x" and dle($lo; $d) and dle($d; $hi);
def exact: (type == "array") and all(.[]; integral and . >= 0 and . < 4194304)
  and ((length == 0) or (.[-1] != 0));

def member($t):
  if   $t == "N" or $t == "C" or $t == "M" then nat
  elif $t == "Z" then int
  elif $t == "R" then num
  elif $t == "W" then weight
  elif $t == "B" then type == "boolean"
  elif $t == "S" then type == "string"
  elif $t == "LN" then (type == "array") and all(.[]; nat)
  elif $t == "LZ" then (type == "array") and all(.[]; int)
  elif $t == "LR" then (type == "array") and all(.[]; num)
  elif $t == "P" then (type == "object") and ((keys | sort) == ["л", "п"])
    and (.["л"] | nat) and (.["п"] | int)
  elif $t == "I" then (type == "object") and
    ((.["вариант"] == "Нет" and (keys == ["вариант"])) or
     (.["вариант"] == "Есть" and (.["значение"] | nat)))
  elif $t == "IZ" then (type == "object") and
    ((.["вариант"] == "Ничего" and (keys == ["вариант"])) or
     (.["вариант"] == "Нечто" and (.["значение"] | int)))
  elif $t == "u8" then word("0"; "255")
  elif $t == "i8" then word("-128"; "127")
  elif $t == "u32" then word("0"; "4294967295")
  elif $t == "i64" then word("-9223372036854775808"; "9223372036854775807")
  elif $t == "u64" then word("0"; "18446744073709551615")
  elif $t == "X" then exact
  else false end;

$v | member($t)
