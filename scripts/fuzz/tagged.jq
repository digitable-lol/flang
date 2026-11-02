# Between the values `flang run` prints and the tagged values of the
# printed programs' runner protocol (flang_cli.c, "Значения размечены тегами").
#
#   jq -R -c --arg dir request-tsv --arg fn - -f tagged.jq calls.uniq  -> a request line per call
#     (a call line: «Имя» TAB {named args} TAB type TAB guard)
#   jq -c --arg dir answer --arg fn - -f tagged.jq answer.json           -> plain value or {"error": code}
# compare.jq loads this file for the second direction.

def tag:
  if type == "number" then {n: tostring}
  elif type == "string" then {s: .}
  elif type == "boolean" or type == "null" then .
  elif type == "array" then {l: map(tag)}
  elif has("variant") then {v: .variant, f: ((.fields // {}) | to_entries | map([.key, (.value | tag)]))}
  else {r: (to_entries | map([.key, (.value | tag)]))}
  end;

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

if $dir == "request-tsv" then (split("\t") | {fn: (.[0] | ltrimstr("«") | rtrimstr("»")), args: (.[1] | fromjson | to_entries | map(.value | tag))})
elif $dir == "request" then {fn: $fn, args: (to_entries | map(.value | tag))}
elif .ok == true then (.value | plain)
else {error: .code} end
