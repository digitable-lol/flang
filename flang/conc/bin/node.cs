// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Полный узел на ЧЕТВЁРТОЙ цели печати. Замер, а не пример.
//
// Вопрос тот же, что у соседей на Python и Go: сколько стоит мир на новой цели,
// если все решения печатает компилятор. Здесь он задан в третий раз, и уже не
// ради самого числа, а ради НАЗВАННОГО ПОРОГА: сосед измерил два хозяина и
// объявил, что цену следующей цели определяет наличие JSON в стандартной
// библиотеке. У C# он есть — System.Text.Json, — и это предсказание проверяется
// здесь целиком, а не на словах.
//
// Решений в этом файле нет ни одного. Связь считает `svyaz.flang`, таблицу
// процессов и планировщик — `planirovshchik.flang`, программу — её обработчики;
// все трое собраны в `uzel-zamer.flang` и напечатаны компилятором в цель csharp.
//
// Работа этого файла — четыре вещи и только они:
//
//  1. держать сокеты, часы и очередь готовых;
//  2. переводить события мира в варианты двух эталонов;
//  3. исполнять веления, которые эталоны вернули;
//  4. звать обработчик по ИМЕНИ — граница языка, из-за которой цикл
//     принадлежит хозяину.
//
// ── Чем C# отличается от Go, и почему это видно в числах ────────────────────
//
// Одна очередь событий вместо трёх таймеров — как у Go: BlockingCollection с
// сроком совмещает «дождись события» и «дождись тика» в ОДНОЙ строке мира, тогда
// как у Go на это уходят ticker и select. Зато ни у Go, ни у C# нет
// JSON-значений языка, поэтому кодирование провода и чтение полей записи
// выписаны руками. Это перевозка, а не решения.
//
// Своё, чего не было ни у Python, ни у Go: ВТОРАЯ ТОЧКА ВХОДА. Напечатанный
// проект уже несёт `FlangCli.Main`, и `flang.csproj` называет его в
// `StartupObject`. Хозяин добавляет свой `Main`, и выбрать его можно, не трогая
// напечатанного: `dotnet build -p:StartupObject=HozyainUzla`. Правки в чужой
// вывод компилятора это не требует — ключ сборки перекрывает свойство проекта.
//
// Второе своё: `TreatWarningsAsErrors` и `Nullable` в напечатанном проекте
// включены, и хозяин собирается под тем же режимом. Это не помеха, а условие:
// напечатанное и рукописное живут в ОДНОЙ сборке, послаблений для второго нет.
//
// Надзор: отказ процесса доезжает до веления «Уронить процесс», и хозяин
// передаёт его НАДЗОРУ — четвёртому напечатанному модулю, `nadzor.flang`. Кого
// поднимать, кого укладывать и когда передавать выше, решает он; хозяин только
// исполняет. Дерево надзора приезжает данными в плане, как и размещение.
#nullable enable

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading;

/// <summary>Хозяин узла для цели C#: мир, перевод, исполнение велений.</summary>
public static class HozyainUzla
{
    private const string Cel = "csharp";

    /* ── граница значений ─────────────────────────────────────────────────── */

    /// <summary>Поле записи или варианта по имени; нет поля — «ничто».</summary>
    private static Value Pole(Value znachenie, string imya)
    {
        foreach (Field p in znachenie.Fields)
        {
            if (p.Name == imya)
            {
                return p.Value;
            }
        }

        return Value.Nothing();
    }

    private static Value Variant(string imya, params Field[] polya) => Value.Variant(imya, polya);

    private static Field PoleZn(string imya, Value znachenie) => new Field(imya, znachenie);

    /* ── журнал наружу ────────────────────────────────────────────────────── */

    private static readonly JsonSerializerOptions Nastroyki = new JsonSerializerOptions
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly TextWriter Vyvod = NovyjVyvod();

    private static TextWriter NovyjVyvod()
    {
        var pisatel = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)); // МИР
        pisatel.AutoFlush = true;
        return pisatel;
    }

    private static void Skazat(Dictionary<string, object?> zapis)
    {
        Vyvod.WriteLine(JsonSerializer.Serialize(zapis, Nastroyki)); // МИР
    }

    /// <summary>Часы — единственное чтение часов во всём файле.</summary>
    private static double Chasy() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); // МИР

    /* ── провод: те же метки, что у узла на JavaScript ─────────────────────── */
    /* Перевод, а не решение: правило «у каждого значения метка одной буквой»
       живёт в `flang/conc/distributed.mjs`, и разойтись с ним нельзя. */

    private static object?[] Zakodirovat(Value znachenie)
    {
        switch (znachenie.Tag)
        {
            case Value.TagNothing:
                return new object?[] { "н" };
            case Value.TagFlag:
                return new object?[] { "п", znachenie.Bit };
            case Value.TagString:
                return new object?[] { "с", znachenie.Str };
            case Value.TagNumber:
                double ch = znachenie.Num;
                if (double.IsNaN(ch))
                {
                    return new object?[] { "ч", "NaN" };
                }

                if (double.IsPositiveInfinity(ch))
                {
                    return new object?[] { "ч", "+∞" };
                }

                if (double.IsNegativeInfinity(ch))
                {
                    return new object?[] { "ч", "-∞" };
                }

                return new object?[] { "ч", ch };
            case Value.TagList:
                int dlina = Value.Size(znachenie);
                var elementy = new object?[dlina];
                for (int i = 0; i < dlina; i += 1)
                {
                    elementy[i] = Zakodirovat(Value.At(znachenie, i));
                }

                return new object?[] { "л", elementy };
            case Value.TagRecord:
                return new object?[] { "з", PolyaNaruzhu(znachenie) };
            case Value.TagVariant:
                return new object?[] { "в", znachenie.Str, PolyaNaruzhu(znachenie) };
            default:
                throw new InvalidOperationException("нечего кодировать");
        }
    }

    private static Dictionary<string, object?> PolyaNaruzhu(Value znachenie)
    {
        var polya = new Dictionary<string, object?>();
        foreach (Field p in znachenie.Fields)
        {
            polya[p.Name] = Zakodirovat(p.Value);
        }

        return polya;
    }

    private static Value Raskodirovat(JsonElement kod)
    {
        if (kod.ValueKind != JsonValueKind.Array || kod.GetArrayLength() == 0)
        {
            return Value.Nothing();
        }

        string metka = kod[0].GetString() ?? "";
        int dlina = kod.GetArrayLength();
        switch (metka)
        {
            case "н":
                return Value.Nothing();
            case "п":
                return Value.Flag(dlina > 1 && kod[1].ValueKind == JsonValueKind.True);
            case "с":
                return Value.Text(dlina > 1 ? kod[1].GetString() ?? "" : "");
            case "ч":
                if (dlina > 1 && kod[1].ValueKind == JsonValueKind.Number)
                {
                    return Value.Number(kod[1].GetDouble());
                }

                if (dlina > 1 && kod[1].ValueKind == JsonValueKind.String)
                {
                    switch (kod[1].GetString())
                    {
                        case "NaN":
                            return Value.Number(double.NaN);
                        case "+∞":
                            return Value.Number(double.PositiveInfinity);
                        case "-∞":
                            return Value.Number(double.NegativeInfinity);
                        default:
                            return Value.Number(0);
                    }
                }

                return Value.Number(0);
            case "л":
                if (dlina < 2 || kod[1].ValueKind != JsonValueKind.Array)
                {
                    return Value.EmptyList();
                }

                var elementy = new Value[kod[1].GetArrayLength()];
                for (int i = 0; i < elementy.Length; i += 1)
                {
                    elementy[i] = Raskodirovat(kod[1][i]);
                }

                return Value.List(elementy);
            case "з":
                return Value.Record(PolyaVnutr(kod, 1));
            case "в":
                return Value.Variant(dlina > 1 ? kod[1].GetString() ?? "" : "", PolyaVnutr(kod, 2));
            default:
                return Value.Nothing();
        }
    }

    private static Field[] PolyaVnutr(JsonElement kod, int nomer)
    {
        if (kod.GetArrayLength() <= nomer || kod[nomer].ValueKind != JsonValueKind.Object)
        {
            return Array.Empty<Field>();
        }

        var polya = new List<Field>();
        foreach (JsonProperty p in kod[nomer].EnumerateObject())
        {
            polya.Add(new Field(p.Name, Raskodirovat(p.Value)));
        }

        return polya.ToArray();
    }

    /// <summary>
    /// Жребий — mulberry32, тот же генератор, что у свидетеля. Это не мир: на
    /// входе число, на выходе число.
    /// </summary>
    private sealed class Zhrebiy
    {
        private uint sostoyanie;

        internal Zhrebiy(uint semya)
        {
            sostoyanie = semya;
        }

        internal double Dalshe()
        {
            sostoyanie += 0x6D2B79F5;
            uint t = sostoyanie;
            t = (t ^ (t >> 15)) * (t | 1);
            t ^= t + ((t ^ (t >> 7)) * (t | 61));
            return (t ^ (t >> 14)) / 4294967296.0;
        }
    }

    /* ── связь ────────────────────────────────────────────────────────────── */

    private sealed class Kanal
    {
        internal string Kto = "";
        internal string Adres = "";
        internal TcpClient? Soedinenie;
        internal NetworkStream? Potok;
        internal string Hvost = "";
        internal double KogdaZvonit;
        internal double PoslednijPuls;
        internal Value Sostoyanie = Value.Nothing();
    }

    /// <summary>
    /// Событие провода — одна очередь на всё, что приезжает из сети: принятое
    /// соединение, кусок байтов, конец. Одна, потому что ПОРЯДОК этих событий
    /// наблюдаем, а две очереди порядок между собой не держат.
    /// </summary>
    private sealed class SobytieProvoda
    {
        internal Kanal? Kanal;
        internal string Chto = "";
        internal string Kusok = "";
        internal string Pochemu = "";
        internal TcpClient? Soedinenie;
    }

    private sealed class Taymer
    {
        internal double Kogda;
        internal string Komu = "";
        internal double Bilet;
    }

    private sealed class ProcessPlana
    {
        internal string Imya = "";
        internal string Nachalnoe = "";
        internal string Obrabotchik = "";
        internal double? Yaschik;
    }

    private sealed class SvyazPlana
    {
        internal string Kto = "";
        internal string Strategiya = "";
    }

    private sealed class NadzorPlana
    {
        internal string Imya = "";
        internal double Porog;
        internal double Okno;
        internal string Inache = "остановить";
        internal List<SvyazPlana> Processy = new List<SvyazPlana>();
        internal List<SvyazPlana> Nadzory = new List<SvyazPlana>();
    }

    private sealed class Uzel
    {
        internal string Imya = "";
        internal string Hesh = "";
        internal int Srok;
        internal int Puls;
        internal int Pauza;
        internal Ctx Kontekst = UzelZamera.NewContext();
        internal Value Sostoyanie = Value.Nothing();
        internal Dictionary<string, Value> Sostoyaniya = new Dictionary<string, Value>();
        internal Dictionary<string, Kanal> Kanaly = new Dictionary<string, Kanal>();
        internal List<string> Poryadok = new List<string>();
        internal List<ProcessPlana> Plan = new List<ProcessPlana>();
        internal Zhrebiy Zhrebiy = new Zhrebiy(7);
        internal int Bilet;
        internal Dictionary<int, Value> Gruzy = new Dictionary<int, Value>();
        internal List<Taymer> Taymery = new List<Taymer>();
        internal JsonElement PoslednijKadr;
        internal Value Derevo = Value.Nothing();
        internal bool Rabotaet = true;
        internal BlockingCollection<SobytieProvoda> Vhod = new BlockingCollection<SobytieProvoda>(256);
        internal TcpListener? Slushatel;
    }

    private static Value Pozvat(Uzel u, string imya, params Value[] dovody)
    {
        return UzelZamera.Call(u.Kontekst, imya, dovody);
    }

    private static Uzel Zavesti(
        string imya,
        List<ProcessPlana> plan,
        Dictionary<string, string> razmeschenie,
        Dictionary<string, string> zvonit,
        string hesh,
        int srok,
        int puls,
        int pauza,
        uint semya,
        List<NadzorPlana> nadzory)
    {
        var u = new Uzel
        {
            Imya = imya, Hesh = hesh, Srok = srok, Puls = puls, Pauza = pauza,
            Plan = plan, Zhrebiy = new Zhrebiy(semya),
        };
        var processy = new List<Value>();
        foreach (ProcessPlana p in plan)
        {
            string gde = razmeschenie.TryGetValue(p.Imya, out string? nayden) ? nayden : "";
            bool svoy = gde == imya;
            processy.Add(Pozvat(
                u,
                "Процесс узла",
                Value.Text(p.Imya),
                Value.Flag(svoy),
                Value.Text(svoy ? "" : gde),
                Value.Flag(true),
                Value.Text(""),
                Value.Number(p.Yaschik ?? 0),
                Value.Number(0),
                Value.EmptyList()));
            if (svoy)
            {
                u.Sostoyaniya[p.Imya] = Pozvat(u, p.Nachalnoe);
            }
            else if (!u.Kanaly.ContainsKey(gde))
            {
                u.Kanaly[gde] = new Kanal
                {
                    Kto = gde,
                    Adres = zvonit.TryGetValue(gde, out string? adres) ? adres : "",
                    Sostoyanie = Pozvat(
                        u,
                        "Связь узла заново",
                        Value.Text(gde),
                        Value.Flag(false),
                        Value.Flag(false),
                        Value.Flag(false),
                        Value.Flag(false),
                        Value.Flag(false),
                        Value.Number(0)),
                };
                u.Poryadok.Add(gde);
            }
        }

        u.Sostoyanie = Pozvat(
            u,
            "Узел заново",
            Value.Text(imya),
            Value.List(processy.ToArray()),
            Value.EmptyList(),
            Value.Text(""),
            Value.Number(0),
            Value.Flag(true));

        // Дерево надзора — данные, ровно как размещение. Решает по нему
        // напечатанный `nadzor.flang`, а не этот файл.
        var nadzirateli = new List<Value>();
        var nadProcessom = new List<Value>();
        var nadNadzorom = new List<Value>();
        foreach (NadzorPlana n in nadzory)
        {
            nadzirateli.Add(Pozvat(
                u, "Надзиратель узла",
                Value.Text(n.Imya), Value.Number(n.Porog), Value.Number(n.Okno), Value.Text(n.Inache)));
            foreach (SvyazPlana svyaz in n.Processy)
            {
                nadProcessom.Add(Pozvat(
                    u, "Связь надзора узла",
                    Value.Text(svyaz.Kto), Value.Text(n.Imya), Value.Text(svyaz.Strategiya)));
            }

            foreach (SvyazPlana svyaz in n.Nadzory)
            {
                nadNadzorom.Add(Pozvat(
                    u, "Связь надзора узла",
                    Value.Text(svyaz.Kto), Value.Text(n.Imya), Value.Text(svyaz.Strategiya)));
            }
        }

        u.Derevo = Pozvat(
            u, "Дерево надзора узла",
            Value.List(nadzirateli.ToArray()),
            Value.List(nadProcessom.ToArray()),
            Value.List(nadNadzorom.ToArray()));
        return u;
    }

    /* ── единственная дорога от отказа к решению надзора ────────────────────── */

    private static void NadzorSluchilsya(Uzel u, string kto, string kod)
    {
        Value hod = Pozvat(u, "Шаг надзора узла", u.Derevo, Value.Text(kto), Value.Text(kod), Value.Number(Chasy()));
        u.Derevo = Pole(hod, "дерево");
        foreach (Value velenie in Value.Elements(Pole(hod, "веления")))
        {
            IspolnitNadzor(u, velenie);
        }
    }

    private static void IspolnitNadzor(Uzel u, Value velenie)
    {
        string Stroka(string imya) => Pole(velenie, imya).Str;

        switch (velenie.Str)
        {
            case "Поднять":
                // Перезапуск трогает состояние и не трогает ящик — это решено на
                // flang; здесь состояние берётся тем же путём, что при подъёме узла.
                u.Sostoyanie = Pozvat(u, "Оживить процесс узла", u.Sostoyanie, Value.Text(Stroka("кто")));
                foreach (ProcessPlana p in u.Plan)
                {
                    if (p.Imya == Stroka("кто"))
                    {
                        u.Sostoyaniya[p.Imya] = Pozvat(u, p.Nachalnoe);
                    }
                }

                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "надзор", ["узел"] = u.Imya, ["цель"] = Cel,
                    ["что"] = "поднят", ["кто"] = Stroka("кто"),
                });
                break;
            case "Уложить":
                u.Sostoyanie = Pozvat(
                    u, "Уложить процесс узла", u.Sostoyanie,
                    Value.Text(Stroka("кто")), Value.Text("остановлен надзором"));
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "надзор", ["узел"] = u.Imya, ["цель"] = Cel, ["что"] = "уложен",
                    ["кто"] = Stroka("кто"), ["надзор"] = Stroka("надзор"),
                });
                break;
            case "Решено":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "надзор", ["узел"] = u.Imya, ["цель"] = Cel, ["что"] = "решено",
                    ["кто"] = Stroka("кто"), ["надзор"] = Stroka("надзор"),
                    ["стратегия"] = Stroka("стратегия"),
                });
                break;
            case "Некому надзирать":
                u.Sostoyanie = Pozvat(u, "Остановить узел целиком", u.Sostoyanie);
                u.Rabotaet = false;
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "надзор", ["узел"] = u.Imya, ["цель"] = Cel, ["что"] = "некому",
                    ["кто"] = Stroka("кто"), ["надзор"] = Stroka("надзор"),
                });
                break;
            default:
                throw new InvalidOperationException($"узел не знает веления надзора «{velenie.Str}»");
        }
    }

    /* ── мир: сокеты. Все обращения к сети — в этих пяти местах ────────────── */

    private static int Slushat(Uzel u, string adres)
    {
        string[] kuski = adres.Split(':');
        var slushatel = new TcpListener(IPAddress.Parse(kuski[0]), int.Parse(kuski[1], CultureInfo.InvariantCulture));
        slushatel.Start(); // МИР
        u.Slushatel = slushatel;
        var potok = new Thread(() =>
        {
            while (true)
            {
                TcpClient soedinenie;
                try
                {
                    soedinenie = slushatel.AcceptTcpClient(); // МИР
                }
                catch (Exception)
                {
                    return;
                }

                u.Vhod.Add(new SobytieProvoda { Chto = "принято", Soedinenie = soedinenie });
            }
        });
        potok.IsBackground = true;
        potok.Start();
        return ((IPEndPoint)slushatel.LocalEndpoint).Port; // МИР
    }

    private static void Pozvonit(Uzel u, Kanal k)
    {
        if (k.Soedinenie != null || !u.Rabotaet || k.Adres == "")
        {
            return;
        }

        string[] kuski = k.Adres.Split(':');
        var soedinenie = new TcpClient();
        try
        {
            soedinenie.Connect(kuski[0], int.Parse(kuski[1], CultureInfo.InvariantCulture)); // МИР
        }
        catch (Exception)
        {
            soedinenie.Dispose(); // МИР
            SvyazSluchilas(u, k, Variant("Звонок не удался"));
            return;
        }

        Priladit(u, k, soedinenie);
    }

    private static void Priladit(Uzel u, Kanal k, TcpClient soedinenie)
    {
        k.Soedinenie = soedinenie;
        k.Potok = soedinenie.GetStream();
        NetworkStream potok = k.Potok;
        var chitatel = new Thread(() => Chitat(u, k, potok));
        chitatel.IsBackground = true;
        chitatel.Start();
        SvyazSluchilas(u, k, Variant("Сокет завёлся", PoleZn("сейчас", Value.Number(Chasy()))));
    }

    private static void Chitat(Uzel u, Kanal k, NetworkStream potok)
    {
        var bufer = new byte[65536];
        while (true)
        {
            int skolko;
            try
            {
                skolko = potok.Read(bufer, 0, bufer.Length); // МИР
            }
            catch (Exception)
            {
                u.Vhod.Add(new SobytieProvoda { Kanal = k, Chto = "конец", Pochemu = "сокет закрыт" });
                return;
            }

            if (skolko > 0)
            {
                u.Vhod.Add(new SobytieProvoda
                {
                    Kanal = k, Chto = "байты", Kusok = Encoding.UTF8.GetString(bufer, 0, skolko),
                });
            }

            if (skolko <= 0)
            {
                u.Vhod.Add(new SobytieProvoda { Kanal = k, Chto = "конец", Pochemu = "сокет закрыт" });
                return;
            }
        }
    }

    private static void Poslat(Uzel u, Kanal k, Dictionary<string, object?> kadr)
    {
        NetworkStream? potok = k.Potok;
        if (k.Soedinenie == null || potok == null)
        {
            return;
        }

        if (!Pole(k.Sostoyanie, "готова").Bit && (kadr["в"] as string) != "привет")
        {
            return;
        }

        byte[] bayty = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(kadr, Nastroyki) + "\n");
        try
        {
            potok.Write(bayty, 0, bayty.Length); // МИР
        }
        catch (Exception)
        {
            SvyazSluchilas(u, k, Variant("Сокет отказал", PoleZn("почему", Value.Text("запись в сокет отказала"))));
        }
    }

    private static void Pribrat(Kanal k)
    {
        if (k.Soedinenie != null)
        {
            k.Soedinenie.Close(); // МИР
            k.Soedinenie = null;
            k.Potok = null;
        }

        k.Hvost = "";
    }

    /* ── перевод: кадр провода → вариант эталона связи ─────────────────────── */

    private static void Kadrom(Uzel u, Kanal k, JsonElement kadr)
    {
        Value Strokoy(string imya, string poumolchaniyu)
        {
            return kadr.TryGetProperty(imya, out JsonElement chast) && chast.ValueKind == JsonValueKind.String
                ? Value.Text(chast.GetString() ?? poumolchaniyu)
                : Value.Text(poumolchaniyu);
        }

        string vid = kadr.TryGetProperty("в", out JsonElement metka) && metka.ValueKind == JsonValueKind.String
            ? metka.GetString() ?? ""
            : "";
        u.PoslednijKadr = kadr;
        switch (vid)
        {
            case "привет":
                SvyazSluchilas(u, k, Variant(
                    "Пришёл привет", PoleZn("узел", Strokoy("узел", "")), PoleZn("хэш", Strokoy("хэш", ""))));
                break;
            case "пульс":
                SvyazSluchilas(u, k, Variant("Пришёл пульс"));
                break;
            case "письмо":
                SvyazSluchilas(u, k, Variant("Пришло письмо", PoleZn("кому", Strokoy("кому", ""))));
                break;
            case "отбой":
                SvyazSluchilas(u, k, Variant("Пришёл отбой", PoleZn("почему", Strokoy("почему", "без причины"))));
                break;
            default:
                SvyazSluchilas(u, k, Variant("Пришёл чужой кадр", PoleZn("вид", Value.Text(vid))));
                break;
        }
    }

    /* ── единственная дорога от мира к решению о связи ─────────────────────── */

    private static void SvyazSluchilas(Uzel u, Kanal k, Value sobytie)
    {
        Value hod = Pozvat(
            u,
            "Шаг связи узла",
            k.Sostoyanie,
            sobytie,
            Value.Text(u.Hesh),
            Value.Number(u.Srok),
            Value.Number(u.Pauza),
            Value.Flag(u.Rabotaet));
        k.Sostoyanie = Pole(hod, "связь");
        foreach (Value velenie in Value.Elements(Pole(hod, "веления")))
        {
            IspolnitSvyaz(u, k, velenie);
        }
    }

    private static void IspolnitSvyaz(Uzel u, Kanal k, Value velenie)
    {
        string Stroka(string imya) => Pole(velenie, imya).Str;

        switch (velenie.Str)
        {
            case "Послать привет":
                Poslat(u, k, new Dictionary<string, object?>
                {
                    ["в"] = "привет", ["узел"] = u.Imya, ["хэш"] = u.Hesh,
                });
                break;
            case "Прибрать":
                Pribrat(k);
                UzelSluchilsya(u, Variant(
                    "Связь потеряна",
                    PoleZn("узел", Value.Text(k.Kto)),
                    PoleZn("почему", Value.Text("сокет прибран"))));
                break;
            case "Связь заведена":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "связь", ["узел"] = u.Imya, ["цель"] = Cel, ["сосед"] = k.Kto, ["что"] = "заведена",
                });
                UzelSluchilsya(u, Variant("Связь готова", PoleZn("узел", Value.Text(k.Kto))));
                break;
            case "Связь отвергнута":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "связь", ["узел"] = u.Imya, ["цель"] = Cel, ["сосед"] = Stroka("сосед"),
                    ["что"] = "отвергнута", ["почему"] = Stroka("почему"),
                });
                break;
            case "Доложить о потере":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "связь", ["узел"] = u.Imya, ["цель"] = Cel, ["сосед"] = k.Kto,
                    ["что"] = "потеряна", ["почему"] = Stroka("почему"),
                });
                break;
            case "Доложить о несостоявшемся знакомстве":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "связь", ["узел"] = u.Imya, ["цель"] = Cel, ["сосед"] = k.Kto,
                    ["что"] = "не состоялась", ["почему"] = Stroka("почему"),
                });
                break;
            case "Позвонить снова":
                k.KogdaZvonit = Chasy() + Pole(velenie, "пауза").Num;
                break;
            case "Доставить письмо":
                Value gruz = u.PoslednijKadr.TryGetProperty("что", out JsonElement chto)
                    ? Raskodirovat(chto)
                    : Value.Nothing();
                UzelSluchilsya(u, Variant(
                    "Письмо снаружи",
                    PoleZn("кому", Value.Text(Stroka("кому"))),
                    PoleZn("билет", Value.Number(NovyjBilet(u, gruz)))));
                break;
            default:
                throw new InvalidOperationException("узел не знает веления связи «" + velenie.Str + "»");
        }
    }

    /* ── билеты: груз живёт у хозяина, в таблице едет число ────────────────── */

    private static double NovyjBilet(Uzel u, Value gruz)
    {
        u.Bilet += 1;
        u.Gruzy[u.Bilet] = gruz;
        return u.Bilet;
    }

    /* ── единственная дорога от мира к решению о процессах ─────────────────── */

    private static void UzelSluchilsya(Uzel u, Value sobytie)
    {
        Value hod = Pozvat(u, "Шаг узла целиком", u.Sostoyanie, sobytie);
        u.Sostoyanie = Pole(hod, "узел");
        foreach (Value velenie in Value.Elements(Pole(hod, "веления")))
        {
            IspolnitUzel(u, velenie);
        }
    }

    private static void IspolnitUzel(Uzel u, Value velenie)
    {
        string Stroka(string imya) => Pole(velenie, imya).Str;
        double Chislo(string imya) => Pole(velenie, imya).Num;

        switch (velenie.Str)
        {
            case "Позвать обработчик":
                PozvatObrabotchik(u, Stroka("кто"), (int)Chislo("билет"));
                break;
            case "Послать по проводу":
                /* Ключ спрашивается через ContainsKey, а не TryGetValue: у
                   `Value` включён nullable-контекст напечатанного проекта, и
                   `out Value` под ним — ошибка CS8600, а `out Value?` потребовал
                   бы проверки на null там, где её смысла нет. */
                string kudaUzel = Stroka("узел");
                int nomerGruza = (int)Chislo("билет");
                if (u.Kanaly.ContainsKey(kudaUzel) && u.Gruzy.ContainsKey(nomerGruza))
                {
                    Poslat(u, u.Kanaly[kudaUzel], new Dictionary<string, object?>
                    {
                        ["в"] = "письмо", ["кому"] = Stroka("кому"),
                        ["что"] = Zakodirovat(u.Gruzy[nomerGruza]),
                    });
                }

                break;
            case "Поставить таймер":
                u.Taymery.Add(new Taymer
                {
                    Kogda = Chasy() + Chislo("задержка"), Komu = Stroka("кому"), Bilet = Chislo("билет"),
                });
                break;
            case "Записать в журнал":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = Stroka("вид"), ["узел"] = u.Imya, ["цель"] = Cel,
                    ["кто"] = Stroka("кто"), ["почему"] = Stroka("почему"),
                });
                break;
            case "Уронить процесс":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "отказ", ["узел"] = u.Imya, ["цель"] = Cel, ["процесс"] = Stroka("кто"),
                    ["код"] = Stroka("код"), ["текст"] = Stroka("текст"),
                });

                // Отказ уходит НАДЗОРУ, а не в журнал: решает напечатанный
                // `nadzor.flang`, здесь только дорога к нему.
                NadzorSluchilsya(u, Stroka("кто"), Stroka("код"));
                break;
            case "Письмо пропало":
                Skazat(new Dictionary<string, object?>
                {
                    ["в"] = "потеря", ["узел"] = u.Imya, ["цель"] = Cel,
                    ["кому"] = Stroka("кому"), ["почему"] = Stroka("почему"),
                });
                break;
            default:
                throw new InvalidOperationException("узел не знает веления планировщика «" + velenie.Str + "»");
        }
    }

    /* ── вызов обработчика по имени: та самая граница языка ────────────────── */

    private static void PozvatObrabotchik(Uzel u, string kto, int bilet)
    {
        string imya = "";
        foreach (ProcessPlana p in u.Plan)
        {
            if (p.Imya == kto)
            {
                imya = p.Obrabotchik;
            }
        }

        if (imya == "" || !u.Gruzy.ContainsKey(bilet))
        {
            UzelSluchilsya(u, Variant(
                "Обработчик отказал",
                PoleZn("код", Value.Text("FLANG_PROCESS")),
                PoleZn("текст", Value.Text("обработчика или груза нет"))));
            return;
        }

        Value gruz = u.Gruzy[bilet];

        Value itog;
        try
        {
            itog = UzelZamera.Call(u.Kontekst, imya, new Value[] { u.Sostoyaniya[kto], gruz });
        }
        catch (FlangError beda)
        {
            UzelSluchilsya(u, Variant(
                "Обработчик отказал",
                PoleZn("код", Value.Text(beda.Code)),
                PoleZn("текст", Value.Text(beda.Text))));
            return;
        }

        u.Sostoyaniya[kto] = Pole(itog, "состояние");
        Value[] deystviya = Value.Elements(Pole(itog, "действия"));
        var perevedyonnye = new Value[deystviya.Length];
        for (int i = 0; i < deystviya.Length; i += 1)
        {
            perevedyonnye[i] = VDeystvie(u, deystviya[i]);
        }

        UzelSluchilsya(u, Variant("Обработчик вернул", PoleZn("действия", Value.List(perevedyonnye))));
    }

    /// <summary>
    /// Действие языка → действие планировщика. Перевод, а не решение: имена
    /// разные нарочно, иначе словарь действий языка и тип планировщика не
    /// собрались бы в один модуль.
    /// </summary>
    private static Value VDeystvie(Uzel u, Value d)
    {
        switch (d.Str)
        {
            case "отправить":
                return Variant(
                    "Велено слать",
                    PoleZn("кому", Pole(d, "кому")),
                    PoleZn("билет", Value.Number(NovyjBilet(u, Pole(d, "что")))));
            case "через":
                return Variant(
                    "Велено слать позже",
                    PoleZn("кому", Pole(d, "кому")),
                    PoleZn("билет", Value.Number(NovyjBilet(u, Pole(d, "что")))),
                    PoleZn("задержка", Pole(d, "задержка")));
            case "отложить":
                return Variant("Велено отложить");
            case "продолжить":
                return Variant("Велено продолжить");
            case "остановить":
                return Variant("Велено остановить", PoleZn("почему", Pole(d, "почему")));
            default:
                throw new InvalidOperationException("узел не знает действия «" + d.Str + "»");
        }
    }

    /* ── круг: сокеты, часы, таймеры и очередь готовых ─────────────────────── */

    private static Kanal? SvobodnyjKanal(Uzel u)
    {
        foreach (string imya in u.Poryadok)
        {
            if (u.Kanaly[imya].Soedinenie == null)
            {
                return u.Kanaly[imya];
            }
        }

        return null;
    }

    private static void Bayty(Uzel u, Kanal k, string kusok)
    {
        SvyazSluchilas(u, k, Variant("Байты пришли", PoleZn("сейчас", Value.Number(Chasy()))));
        k.Hvost += kusok;
        while (k.Hvost.Contains('\n') && k.Soedinenie != null)
        {
            int kray = k.Hvost.IndexOf('\n');
            string stroka = k.Hvost.Substring(0, kray).Trim();
            k.Hvost = k.Hvost.Substring(kray + 1);
            if (stroka == "")
            {
                continue;
            }

            JsonElement kadr;
            try
            {
                kadr = JsonDocument.Parse(stroka).RootElement.Clone();
            }
            catch (JsonException)
            {
                SvyazSluchilas(u, k, Variant("Сокет отказал", PoleZn("почему", Value.Text("кадр не разобран"))));
                return;
            }

            Kadrom(u, k, kadr);
        }
    }

    private static void Krug(Uzel u, double dokole)
    {
        int period = Math.Max(u.Srok / 5, 20);
        double sleduyuschijStorozh = Chasy() + period;
        while (Chasy() < dokole && u.Rabotaet)
        {
            foreach (string imya in u.Poryadok)
            {
                Kanal k = u.Kanaly[imya];
                if (k.Soedinenie == null && Chasy() >= k.KogdaZvonit)
                {
                    Pozvonit(u, k);
                }
            }

            /* Одна строка мира на «дождись события ИЛИ дождись срока»: у Go на
               это уходят ticker и select, здесь очередь умеет ждать сама. */
            if (u.Vhod.TryTake(out SobytieProvoda? sobytie, period)) // МИР
            {
                PoSobytiyu(u, sobytie);
            }

            double seychas = Chasy();
            var ostavshiesya = new List<Taymer>();
            foreach (Taymer t in u.Taymery)
            {
                if (t.Kogda <= seychas)
                {
                    UzelSluchilsya(u, Variant(
                        "Таймер сработал",
                        PoleZn("кому", Value.Text(t.Komu)),
                        PoleZn("билет", Value.Number(t.Bilet))));
                }
                else
                {
                    ostavshiesya.Add(t);
                }
            }

            u.Taymery = ostavshiesya;
            foreach (string imya in u.Poryadok)
            {
                Kanal k = u.Kanaly[imya];
                if (k.Soedinenie != null && Pole(k.Sostoyanie, "готова").Bit
                    && seychas - k.PoslednijPuls >= u.Puls)
                {
                    k.PoslednijPuls = seychas;
                    Poslat(u, k, new Dictionary<string, object?> { ["в"] = "пульс" });
                }
            }

            if (seychas >= sleduyuschijStorozh)
            {
                sleduyuschijStorozh = seychas + period;
                foreach (string imya in u.Poryadok)
                {
                    Kanal k = u.Kanaly[imya];
                    if (k.Soedinenie != null)
                    {
                        SvyazSluchilas(u, k, Variant("Сторож проснулся", PoleZn("сейчас", Value.Number(seychas))));
                    }
                }
            }

            /* Пробеги — до покоя, но с уступкой миру после каждого: иначе пульс
               не уйдёт, и связь порвалась бы от собственной занятости. */
            for (int vitkov = 0; vitkov < 64; vitkov += 1)
            {
                Value bylo = u.Sostoyanie;
                UzelSluchilsya(u, Variant("Пора бежать", PoleZn("жребий", Value.Number(u.Zhrebiy.Dalshe()))));
                if (Value.Equal(bylo, u.Sostoyanie))
                {
                    break;
                }
            }
        }
    }

    private static void PoSobytiyu(Uzel u, SobytieProvoda sobytie)
    {
        switch (sobytie.Chto)
        {
            case "принято":
                Kanal? svobodnyj = SvobodnyjKanal(u);
                if (svobodnyj == null)
                {
                    sobytie.Soedinenie?.Close(); // МИР
                    return;
                }

                if (sobytie.Soedinenie != null)
                {
                    Priladit(u, svobodnyj, sobytie.Soedinenie);
                }

                break;
            case "байты":
                if (sobytie.Kanal != null && sobytie.Kanal.Soedinenie != null)
                {
                    Bayty(u, sobytie.Kanal, sobytie.Kusok);
                }

                break;
            case "конец":
                if (sobytie.Kanal != null && sobytie.Kanal.Soedinenie != null)
                {
                    SvyazSluchilas(
                        u, sobytie.Kanal, Variant("Сокет отказал", PoleZn("почему", Value.Text(sobytie.Pochemu))));
                }

                break;
            default:
                break;
        }
    }

    /* ── доводы ───────────────────────────────────────────────────────────── */

    public static int Main(string[] argv)
    {
        return Flang.WithDeepStack(() => Rabota(argv));
    }

    private static int Rabota(string[] argv)
    {
        var klyuchi = new Dictionary<string, string>();
        string imya = "";
        foreach (string dovod in argv)
        {
            if (dovod.StartsWith("--", StringComparison.Ordinal))
            {
                imya = dovod.Substring(2);
                klyuchi[imya] = "да";
            }
            else if (imya != "")
            {
                klyuchi[imya] = dovod;
                imya = "";
            }
        }

        string Klyuch(string kakoy, string poumolchaniyu)
        {
            return klyuchi.TryGetValue(kakoy, out string? znachenie) ? znachenie : poumolchaniyu;
        }

        int Chislo(string kakoy, int poumolchaniyu)
        {
            return klyuchi.TryGetValue(kakoy, out string? znachenie)
                && int.TryParse(znachenie, NumberStyles.Integer, CultureInfo.InvariantCulture, out int schitano)
                ? schitano
                : poumolchaniyu;
        }

        JsonElement syroyPlan = JsonDocument.Parse(File.ReadAllText(Klyuch("план-файл", ""))).RootElement; // МИР
        var plan = new List<ProcessPlana>();
        foreach (JsonElement p in syroyPlan.GetProperty("процессы").EnumerateArray())
        {
            plan.Add(new ProcessPlana
            {
                Imya = p.GetProperty("имя").GetString() ?? "",
                Nachalnoe = p.GetProperty("начальное").GetString() ?? "",
                Obrabotchik = p.GetProperty("обработчик").GetString() ?? "",
                Yaschik = p.TryGetProperty("ящик", out JsonElement ya) && ya.ValueKind == JsonValueKind.Number
                    ? ya.GetDouble()
                    : null,
            });
        }

        var nadzory = new List<NadzorPlana>();
        if (syroyPlan.TryGetProperty("надзоры", out JsonElement syryeNadzory))
        {
            foreach (JsonElement n in syryeNadzory.EnumerateArray())
            {
                var nadzor = new NadzorPlana
                {
                    Imya = n.GetProperty("имя").GetString() ?? "",
                    Porog = n.TryGetProperty("порог", out JsonElement por) ? por.GetDouble() : 0,
                    Okno = n.TryGetProperty("окно", out JsonElement okn) ? okn.GetDouble() : 0,
                    Inache = n.TryGetProperty("иначе", out JsonElement ina) ? ina.GetString() ?? "остановить" : "остановить",
                };
                foreach (string klyuch in new[] { "процессы", "надзоры" })
                {
                    if (!n.TryGetProperty(klyuch, out JsonElement spisok))
                    {
                        continue;
                    }

                    foreach (JsonElement svyaz in spisok.EnumerateArray())
                    {
                        var para = new SvyazPlana
                        {
                            Kto = svyaz.GetProperty("кто").GetString() ?? "",
                            Strategiya = svyaz.GetProperty("стратегия").GetString() ?? "",
                        };
                        if (klyuch == "процессы")
                        {
                            nadzor.Processy.Add(para);
                        }
                        else
                        {
                            nadzor.Nadzory.Add(para);
                        }
                    }
                }

                nadzory.Add(nadzor);
            }
        }

        JsonElement razmeschenie = JsonDocument.Parse(Klyuch("размещение", "{}")).RootElement;
        var gde = new Dictionary<string, string>();
        var zvonit = new Dictionary<string, string>();
        foreach (JsonProperty p in razmeschenie.EnumerateObject())
        {
            if (p.Name == "звонить")
            {
                foreach (JsonProperty sosed in p.Value.EnumerateObject())
                {
                    zvonit[sosed.Name] = sosed.Value.GetString() ?? "";
                }

                continue;
            }

            gde[p.Name] = p.Value.GetString() ?? "";
        }

        Uzel u = Zavesti(
            Klyuch("я", ""), plan, gde, zvonit, Klyuch("хэш", ""),
            Chislo("срок", 1000), Chislo("пульс", 200), Chislo("пауза", 250), (uint)Chislo("семя", 7),
            nadzory);

        int port = 0;
        if (klyuchi.ContainsKey("слушать"))
        {
            port = Slushat(u, klyuchi["слушать"]);
        }

        string heshKorotko = u.Hesh.Length > 12 ? u.Hesh.Substring(0, 12) : u.Hesh;
        Skazat(new Dictionary<string, object?>
        {
            ["в"] = "поднят", ["узел"] = u.Imya, ["цель"] = Cel, ["порт"] = port, ["хэш"] = heshKorotko,
        });

        if (klyuchi.ContainsKey("вбросить"))
        {
            foreach (JsonElement pismo in JsonDocument.Parse(klyuchi["вбросить"]).RootElement.EnumerateArray())
            {
                Value gruz = pismo.TryGetProperty("что", out JsonElement chto)
                    ? Raskodirovat(chto)
                    : Value.Nothing();
                UzelSluchilsya(u, Variant(
                    "Письмо снаружи",
                    PoleZn("кому", Value.Text(
                        pismo.TryGetProperty("кому", out JsonElement komu) ? komu.GetString() ?? "" : "")),
                    PoleZn("билет", Value.Number(NovyjBilet(u, gruz)))));
            }
        }

        double zhit = double.TryParse(
            Klyuch("жить", "5"), NumberStyles.Float, CultureInfo.InvariantCulture, out double skolko) ? skolko : 5;
        Krug(u, Chasy() + (zhit * 1000));

        var sostoyaniya = new Dictionary<string, object?>();
        foreach (KeyValuePair<string, Value> para in u.Sostoyaniya)
        {
            sostoyaniya[para.Key] = Zakodirovat(para.Value);
        }

        Skazat(new Dictionary<string, object?>
        {
            ["в"] = "конец", ["узел"] = u.Imya, ["цель"] = Cel, ["состояния"] = sostoyaniya,
        });
        return 0;
    }
}
