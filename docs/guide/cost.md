[Back to README](../../README.md) · [Documentation index](../README.md)

# The cost of a function before the run

How many steps a function takes, how much memory it uses and how many seconds
that is on this machine is printed before the run, as a polynomial in the input
sizes. The decision and its limits are in
[ADR-0083](../adr/0083-cost-is-known-before-the-run.md).

## The cost of a function

```
bootstrap/flang run-script cost docs/examples/web/orders-api.flang \
  --function 'Обработать запрос' --sizes '|хвостадреса|=132' \
  --profile scripts/cost/profiles/dev.profile
```

| option | what it does |
|---|---|
| `--function «Name»` | the function to price |
| `--all` | the cost of every function in the file, one line each |
| `--sizes 'н=20,|xs|=100'` | put in sizes and print numbers; without it only the polynomials |
| `--profile <file>` | turn steps into seconds and bytes with a machine profile |
| `--promise 'polynomial'` | exit 1 when the promised cost is below the derived one |
| `--no-printed` | do not print the program to C (no bound for printed C) |

Sizes are named like this: `н` is the value of the number `н`; `|s|` is the
bytes of the string `s`; `|xs|` is the length of the list `xs`; `|xs[]|` is the
size of its element.

The output says where each number comes from: "derived from the function"
means no assumptions; "ОЦЕНЕНО" (estimated) means there is an assumption and it
is printed; "оценки нет" (no estimate) comes with the reason. The bound is an
upper bound: a real run never costs more, but may cost much less.

## The cost of one run

`flang run --cost` prints what the run cost to standard error:

```
цена прогона: шагов 595213, пик памяти 179953664 байт, секунд 2.947812
```

Steps are the same counter that `--max-steps` limits. Seconds and memory
include the start of the interpreter (parsing and checking the program).

The printed runner (`flang emit --target c --cli`) answers a request carrying
`"cost":"1"` with the fields `"steps"`, `"handed"`, `"reserved"`, `"depth"` and
`"seconds"`.

## The machine profile

```
bootstrap/flang run-script cost:calibrate
```

prints the profile of this machine: seconds per step of the interpreter and of
printed C (low and high), seconds per unit of length, bytes per estimated byte,
the machine name, its cores and the load. Save the output in
`scripts/cost/profiles/<machine>.profile`. Take the profile on the machine the
program will run on.

## Validation and forgery

- `bootstrap/flang run-script cost:validate` — 21 functions at several sizes:
  the bound against the measured count, interpreted and printed to C.
- `bootstrap/flang run-script cost:forgery` — a promise below the bound and a
  `--max-steps` below it must both be refused; the answer is
  "подлог пойман: коды 1 0 0 1".
