struct span {
    int start;
    int length;
};

int span_end(struct span s)
{
    return s.start + s.length;
}

int span_last(struct span s)
{
    return span_end(s) - 1;
}

int span_empty(struct span s)
{
    return s.length <= 0;
}
