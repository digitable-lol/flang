# Oracle b: the answers of a printed program against the evaluator's.
#
#   jq -n -r --rawfile ev eval.tsv --rawfile ans ans-<t>.jsonl --arg t <target> -f compare.jq
#
# eval.tsv (search.fscript, «Строки оценки»): a line per call — exit code of
# `flang run`, type code, the printed value with Infinity/NaN made strings,
# the first FLANG_ code, and «да» when the call was outside the requirement.
# ans: a runner answer per call, in the same order. Out: a line
# "differs call <n>: evaluator <v>, <t> <v>" per call that differs; nothing
# when all agree. Calls outside the requirement (ledger hole 15), runs the
# evaluator refused as unproven (code 3) and fixed-width words the evaluator
# prints as null (ledger hole 13) are not compared.

def number_text:
  if . == "Infinity" or . == "inf" or . == "+Infinity" then "+inf"
  elif . == "-Infinity" or . == "-inf" then "-inf"
  elif . == "NaN" or . == "nan" or . == "-NaN" then "nan"
  else tonumber end;

def plain:
  if type == "object" then
    if has("w") then (.v | if test("^-?[0-9]+$") and (tonumber | fabs) < 9007199254740992 then tonumber else . end)
    elif has("n") then (.n | number_text)
    elif has("s") then .s
    elif has("l") then (.l | map(plain))
    elif has("r") then (.r | map({(.[0]): (.[1] | plain)}) | add // {})
    elif has("v") then ({"вариант": .v} + ((.f // []) | map({(.[0]): (.[1] | plain)}) | add // {}))
    else {unknown: .} end
  else . end;

def theirs: if .ok == true then (.value | plain) else {error: .code} end;
def words: ["u8", "i8", "u32", "i64", "u64"];

($ev | split("\n") | map(select(length > 0) | split("\t"))) as $e
| ($ans | split("\n") | map(select(length > 0) | (try fromjson catch {ok: false, code: "UNREADABLE"}))) as $a
| range(0; [($e | length), ($a | length)] | max) as $i
| ($e[$i] // ["-", "-", "", "-", "нет"]) as $row
| select($row[4] != "да" and $row[0] != "3")
| (if $row[0] == "0" then ($row[2] | try fromjson catch {unreadable: $row[2]}) else {error: $row[3]} end) as $mine
| select(($row[1] as $ty | words | index($ty)) == null or $mine != null)
| (($a[$i] // {ok: false, code: "NO ANSWER"}) | theirs) as $their
| select($mine != $their)
| "differs call \($i + 1): evaluator \($mine | tojson), \($t) \($their | tojson)"
