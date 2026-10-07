int midpoint(int lo, int hi)
{
    return (lo + hi) / 2;
}

int clamp(int x, int lo, int hi)
{
    if (x < lo)
        return lo;
    if (x > hi)
        return hi;
    return x;
}
