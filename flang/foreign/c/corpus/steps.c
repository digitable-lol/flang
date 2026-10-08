int at_least(int x, int lo)
{
    int r = x;
    if (r < lo)
        r = lo;
    return r;
}

int absolute(int x)
{
    int r;
    if (x <= 0)
        r = -x;
    else
        r = x;
    return r;
}

int saturating_increment(int x)
{
    int y = x;
    if (y < 2147483647)
        y = y + 1;
    return y;
}
