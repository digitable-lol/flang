# Digits of a number

`«Цифр в числе»` drops the last digit until the number is less than ten. The
compiler cannot see that the recursion ends and answers `FLANG_NOT_TOTAL`. Add
one line to make the check pass.

Done when `flang check` answers «замечаний нет».
