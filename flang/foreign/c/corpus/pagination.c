int page_count(int items, int per_page)
{
    int full = items / per_page;
    return full + 1;
}

int remaining(int capacity, int used)
{
    int left = capacity - used;
    return left;
}
