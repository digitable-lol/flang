int average(int total, int count)
{
    return total / count;
}

int average_or_zero(int total, int count)
{
    if (count == 0)
        return 0;
    return total / count;
}

int positive_average(int total, int count)
{
    if (count <= 0)
        return 0;
    return total / count;
}

int sign(int x)
{
    if (x > 0)
        return 1;
    if (x < 0)
        return -1;
    return 0;
}
