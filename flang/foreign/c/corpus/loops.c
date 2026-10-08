int factorial(int n)
{
    int result = 1;
    for (int i = 2; i <= n; i++)
        result = result * i;
    return result;
}

int sum_to(int n)
{
    int total = 0;
    for (int i = 1; i < n; i++)
        total += i;
    return total;
}

int count_multiples(int limit, int step)
{
    int count = 0;
    int i = 0;
    while (i < limit) {
        if (i % step == 0)
            count++;
        i++;
    }
    return count;
}

int power_of_two(int k)
{
    int p = 1;
    for (int i = 0; i < k; i++)
        p *= 2;
    return p;
}

int digits(int n)
{
    int count = 1;
    while (n >= 10) {
        n = n / 10;
        count++;
    }
    return count;
}
