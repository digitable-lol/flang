int days_in_month(int month, int leap)
{
    if (month == 4 || month == 6 || month == 9 || month == 11)
        return 30;
    return 31;
}

int quarter_of(int month)
{
    if (month <= 3)
        return 1;
    if (month <= 6)
        return 2;
    if (month <= 9)
        return 3;
    return 4;
}
