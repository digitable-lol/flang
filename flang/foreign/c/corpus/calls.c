int abs_diff(int a, int b)
{
    return a > b ? a - b : b - a;
}

int distance(int a, int b)
{
    return abs_diff(a, b);
}

int larger(int a, int b)
{
    return a > b ? a : b;
}

int at_least_zero(int x)
{
    return larger(x, 0);
}

int fib(int n)
{
    return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
