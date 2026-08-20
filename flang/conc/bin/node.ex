# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
defmodule HozyainUzla do
  @moduledoc """
  ПОЛНЫЙ УЗЕЛ на цели elixir: таблица процессов, планировщик и связь.

  ── Из чего он собран ───────────────────────────────────────────────────────

  Ни одного решения в этом файле нет. Все три части решают напечатанные модули:

    1. связь        `flang/conc/svyaz.flang`          — 11 событий, 8 велений
    2. процессы     `flang/conc/planirovshchik.flang` — 7 событий, 6 велений
    3. программа    `flang/conc/examples/distributed.flang` — обработчики

  Собраны они в один модуль `flang/conc/uzel-zamer.flang` и напечатаны
  компилятором в цель elixir. Один модуль, а не три, по названной причине:
  печать обрезает рантайм по набору использованных встроенных, и у трёх модулей
  вышло бы три разных `flang_runtime.ex` с одним именем модуля `Flang.Rt`.

  ── Что делает этот файл и только он ────────────────────────────────────────

    1. держит сокеты, часы, таймеры и очередь готовых;
    2. переводит события мира в варианты двух эталонов;
    3. исполняет веления, которые эталоны вернули;
    4. зовёт обработчик по имени — это и есть та граница, из-за которой цикл
       принадлежит хозяину: передать функцию туда, где она приезжает данными,
       язык не умеет.

  Груз письма хозяин держит У СЕБЯ и кладёт в таблицу БИЛЕТ — число. Решение про
  имена, длину ящика, живость и потолок в груз не смотрит ни разу, а протащить
  чужой тип через таблицу было бы нечем: полиморфизма в языке нет.

  ── Чем цель elixir отличается от четырёх прежних ───────────────────────────

  Значение flang здесь — размеченный кортеж (`{:num, _}`, `{:str, _}`,
  `{:rec, поля}`, `{:var, имя, поля}`), и читается он СОПОСТАВЛЕНИЕМ ОБРАЗЦА без
  единого объявления типа. Ровно на этом пороге и меряется цена хозяина: у C#
  `JsonElement` — типизированное дерево только для чтения, и перевозки вышло
  вдвое больше, чем у Go. Здесь перевозки меньше всех.

  Второе отличие — неизменяемость: узла-объекта с полями, которые меняет метод,
  на BEAM нет, и состояние хозяина протаскивается через каждую функцию. Это
  добавляет строк, но ни одного решения: `u` входит и выходит.

  Третье — разбор JSON БЕРЁТСЯ У НАПЕЧАТАННОГО: `Flang.Json` печатает сам
  компилятор в `flang_cli.ex`, и писать свой было бы третьим источником правды о
  том же. Печать JSON своя: `Flang.Json` только читает.

  ── Надзор ──────────────────────────────────────────────────────────────────

  Отказ процесса доезжает до веления «Уронить процесс», и хозяин передаёт его
  НАДЗОРУ — четвёртому напечатанному модулю, `flang/conc/nadzor.flang`. Кого
  поднимать, кого укладывать и когда передавать выше, решает он; хозяин только
  исполняет. Дерево надзора приезжает данными в плане, как и размещение.

  ── Чего здесь нет, и это названо ───────────────────────────────────────────

  БИЛЕТЫ НЕ ЧИСТЯТСЯ: словарь «билет → груз» растёт на долгой работе. То же у
  `node.py`, `node.go` и `node.cs`; названо, не починено.

  Запуск (журнал построчным JSON на stdout, как у остальных хозяев):

      elixir -pa _build -e 'HozyainUzla.main(System.argv())' -- \\
        --я счёт --слушать 127.0.0.1:0 --хэш <hex> --план-файл plan.json \\
        --размещение <json> [--срок 1000] [--пульс 200] [--пауза 250] [--жить 5]
  """

  import Bitwise

  @cel "elixir"

  # ── граница значений: снаружи Elixir, внутри значения flang ───────────────
  defp vn({:str, tekst}), do: tekst
  defp vn({:num, chislo}), do: chislo
  defp vn({:flag, priznak}), do: priznak
  defp pole(znachenie, imya), do: Flang.Rt.field_get(znachenie, imya)
  defp spisok(znachenie), do: Flang.Rt.items(znachenie)

  defp skazat(zapis) do
    IO.binwrite(:standard_io, json_tekst(zapis) <> "\n")
  end

  defp chasy do
    System.system_time(:millisecond) * 1.0
  end

  # ── печать JSON: наши записи журнала и кадры провода ──────────────────────
  # Читает JSON напечатанный `Flang.Json`; печатать он не умеет, и вот печать.
  defp json_tekst({:o, pary}) do
    "{" <>
      Enum.map_join(pary, ",", fn {klyuch, znachenie} ->
        Flang.Json.quote_string(klyuch) <> ":" <> json_tekst(znachenie)
      end) <> "}"
  end

  defp json_tekst(spisok) when is_list(spisok), do: "[" <> Enum.map_join(spisok, ",", &json_tekst/1) <> "]"
  defp json_tekst(tekst) when is_binary(tekst), do: Flang.Json.quote_string(tekst)
  defp json_tekst(true), do: "true"
  defp json_tekst(false), do: "false"
  defp json_tekst(nil), do: "null"
  defp json_tekst(chislo) when is_integer(chislo), do: Integer.to_string(chislo)
  defp json_tekst(chislo) when is_float(chislo), do: Float.to_string(chislo)

  # ── провод: те же метки, что у узла на JavaScript ─────────────────────────
  # Перевод, а не решение: правило «у каждого значения метка одной буквой» живёт
  # в `flang/conc/distributed.mjs`, и разойтись с ним нельзя — иначе письмо с
  # одной цели другая не прочтёт.
  defp zakodirovat(:nothing), do: ["н"]
  defp zakodirovat({:flag, priznak}), do: ["п", priznak]
  defp zakodirovat({:str, tekst}), do: ["с", tekst]
  defp zakodirovat({:num, chislo}), do: ["ч", chislo_naruzhu(chislo)]
  defp zakodirovat({:list, _, _} = znachenie), do: ["л", Enum.map(spisok(znachenie), &zakodirovat/1)]
  defp zakodirovat({:rec, polya}), do: ["з", {:o, Enum.map(polya, &pole_naruzhu/1)}]
  defp zakodirovat({:var, imya, polya}), do: ["в", imya, {:o, Enum.map(polya, &pole_naruzhu/1)}]

  defp pole_naruzhu({imya, znachenie}), do: {imya, zakodirovat(znachenie)}

  defp chislo_naruzhu(:nan), do: "NaN"
  defp chislo_naruzhu(:inf), do: "+∞"
  defp chislo_naruzhu(:ninf), do: "-∞"
  defp chislo_naruzhu(chislo), do: chislo

  defp raskodirovat(["н"]), do: Flang.Rt.nothing()
  defp raskodirovat(["п", priznak]), do: Flang.Rt.flag(priznak == true)
  defp raskodirovat(["с", tekst]), do: Flang.Rt.text(tekst)
  defp raskodirovat(["ч", chislo]), do: Flang.Rt.number(chislo_vnutr(chislo))
  defp raskodirovat(["л", vnutri]), do: Flang.Rt.list(Enum.map(vnutri || [], &raskodirovat/1))

  defp raskodirovat(["з", {:object, pary}]),
    do: Flang.Rt.record(Enum.map(pary, &pole_vnutr/1))

  defp raskodirovat(["в", imya, {:object, pary}]),
    do: Flang.Rt.variant(imya, Enum.map(pary, &pole_vnutr/1))

  defp raskodirovat(chuzhoe), do: raise("неизвестная метка значения: #{inspect(chuzhoe)}")

  defp pole_vnutr({imya, znachenie}), do: {imya, raskodirovat(znachenie)}

  defp chislo_vnutr("NaN"), do: :nan
  defp chislo_vnutr("+∞"), do: :inf
  defp chislo_vnutr("-∞"), do: :ninf

  defp chislo_vnutr(tekst) when is_binary(tekst) do
    case Float.parse(tekst) do
      {chislo, ""} -> chislo
      _ -> raise("число не разобрано: #{tekst}")
    end
  end

  # ── жребий: mulberry32, тот же генератор, что у свидетеля ─────────────────
  # Не решение о мире: на входе число, на выходе число.
  defp zhrebiy(u) do
    semya = band(u.semya + 0x6D2B79F5, 0xFFFFFFFF)
    t = band(bxor(semya, bsr(semya, 15)) * bor(semya, 1), 0xFFFFFFFF)
    t = band(bxor(t, t + band(bxor(t, bsr(t, 7)) * bor(t, 61), 0xFFFFFFFF)), 0xFFFFFFFF)
    {band(bxor(t, bsr(t, 14)), 0xFFFFFFFF) / 4_294_967_296.0, %{u | semya: semya}}
  end

  # ── каналы: одна связь — сокет, буфер и состояние от эталона связи ────────
  defp kanal(u, kto), do: Enum.find(u.kanaly, fn k -> k.kto == kto end)
  defp kanal_po_soketu(u, sok), do: Enum.find(u.kanaly, fn k -> k.soket == sok end)

  defp s_kanalom(u, novyy) do
    %{u | kanaly: Enum.map(u.kanaly, fn k -> if k.kto == novyy.kto, do: novyy, else: k end)}
  end

  defp svobodnyy_kanal(u), do: Enum.find(u.kanaly, fn k -> k.soket == nil end)

  defp novyy_kanal(kto, adres) do
    %{
      kto: kto,
      adres: adres,
      soket: nil,
      hvost: "",
      kogda_zvonit: 0.0,
      posledniy_puls: 0.0,
      sostoyanie:
        UzelZamera.fn_svyaz_uzla_zanovo(
          Flang.Rt.text(kto),
          Flang.Rt.flag(false),
          Flang.Rt.flag(false),
          Flang.Rt.flag(false),
          Flang.Rt.flag(false),
          Flang.Rt.flag(false),
          Flang.Rt.number(0)
        )
    }
  end

  # ── мир: сокеты. Все обращения к сети — в этих шести местах ───────────────
  defp slushat(u, nil), do: {u, 0}

  defp slushat(u, adres) do
    {hozyain, port} = adres_para(adres)
    nastroyki = [:binary, {:active, false}, {:reuseaddr, true}, {:packet, :raw}, {:ip, adres_ip(hozyain)}]
    {:ok, sluh} = :gen_tcp.listen(port, nastroyki)  # МИР
    {:ok, nastoyaschiy} = :inet.port(sluh)  # МИР
    {%{u | server: sluh}, nastoyaschiy}
  end

  defp pozvonit(u, kto) do
    k = kanal(u, kto)

    if k.soket != nil or not u.rabotaet do
      u
    else
      {hozyain, port} = adres_para(k.adres)
      nastroyki = [:binary, {:active, :once}, {:packet, :raw}, {:nodelay, true}]

      case :gen_tcp.connect(String.to_charlist(hozyain), port, nastroyki, 1000) do  # МИР
        {:ok, sok} ->
          u = s_kanalom(u, %{k | soket: sok})
          svyaz_sluchilas(u, kto, UzelZamera.v_soket_zavyolsya(Flang.Rt.number(chasy())))

        {:error, _} ->
          svyaz_sluchilas(u, kto, UzelZamera.v_zvonok_ne_udalsya())
      end
    end
  end

  defp prinyat(%{server: nil} = u), do: u

  defp prinyat(u) do
    case :gen_tcp.accept(u.server, 0) do  # МИР
      {:ok, sok} -> prinyatogo_pristroit(u, sok)
      {:error, _} -> u
    end
  end

  # Кто позвонил, скажет его «привет»; до него связь безымянная, и место для неё
  # берётся первое свободное.
  defp prinyatogo_pristroit(u, sok) do
    case svobodnyy_kanal(u) do
      nil ->
        :gen_tcp.close(sok)  # МИР
        u

      k ->
        :inet.setopts(sok, [{:active, :once}, {:nodelay, true}])  # МИР
        u = s_kanalom(u, %{k | soket: sok})
        svyaz_sluchilas(u, k.kto, UzelZamera.v_soket_zavyolsya(Flang.Rt.number(chasy())))
    end
  end

  defp poslat(u, kto, vid, pary) do
    k = kanal(u, kto)

    cond do
      k == nil or k.soket == nil ->
        u

      not vn(pole(k.sostoyanie, "готова")) and vid != "привет" ->
        u

      true ->
        tekst = json_tekst({:o, [{"в", vid} | pary]}) <> "\n"

        case :gen_tcp.send(k.soket, tekst) do  # МИР
          :ok -> u
          {:error, _} -> svyaz_sluchilas(u, kto, UzelZamera.v_soket_otkazal(Flang.Rt.text("запись в сокет отказала")))
        end
    end
  end

  defp pribrat(u, kto) do
    k = kanal(u, kto)
    if k.soket != nil, do: :gen_tcp.close(k.soket)  # МИР
    s_kanalom(u, %{k | soket: nil, hvost: ""})
  end

  # ── чтение: байты пришли, из них кадры ────────────────────────────────────
  defp dannye_prishli(u, sok, dannye) do
    case kanal_po_soketu(u, sok) do
      nil ->
        u

      k0 ->
        u = svyaz_sluchilas(u, k0.kto, UzelZamera.v_bayty_prishli(Flang.Rt.number(chasy())))
        k = kanal(u, k0.kto)
        u = kadry(s_kanalom(u, %{k | hvost: k.hvost <> dannye}), k0.kto)
        posle = kanal(u, k0.kto)
        if posle.soket != nil, do: :inet.setopts(posle.soket, [{:active, :once}])  # МИР
        u
    end
  end

  defp kadry(u, kto) do
    k = kanal(u, kto)

    if k.soket == nil do
      u
    else
      case :binary.split(k.hvost, "\n") do
        [_nedopisannaya] ->
          u

        [stroka, ostatok] ->
          u = s_kanalom(u, %{k | hvost: ostatok})
          u = if String.trim(stroka) == "", do: u, else: kadr_stroki(u, kto, stroka)
          kadry(u, kto)
      end
    end
  end

  defp kadr_stroki(u, kto, stroka) do
    case Flang.Json.parse(stroka) do
      {:ok, kadr} -> kadrom(%{u | posledniy_kadr: kadr}, kto, kadr)
      :error -> svyaz_sluchilas(u, kto, UzelZamera.v_soket_otkazal(Flang.Rt.text("кадр не разобран")))
    end
  end

  # ── перевод: кадр провода → вариант эталона связи ─────────────────────────
  defp kadrom(u, kto, kadr) do
    vid = tekst_polya(kadr, "в", "")

    sobytie =
      case vid do
        "привет" ->
          UzelZamera.v_prishyol_privet(
            Flang.Rt.text(tekst_polya(kadr, "узел", "")),
            Flang.Rt.text(tekst_polya(kadr, "хэш", ""))
          )

        "пульс" ->
          UzelZamera.v_prishyol_puls()

        "письмо" ->
          UzelZamera.v_prishlo_pismo(Flang.Rt.text(tekst_polya(kadr, "кому", "")))

        "отбой" ->
          UzelZamera.v_prishyol_otboy(Flang.Rt.text(tekst_polya(kadr, "почему", "без причины")))

        _ ->
          UzelZamera.v_prishyol_chuzhoy_kadr(Flang.Rt.text(vid))
      end

    svyaz_sluchilas(u, kto, sobytie)
  end

  defp tekst_polya(kadr, imya, po_umolchaniyu) do
    case Flang.Json.field(kadr, imya) do
      {:ok, tekst} when is_binary(tekst) -> tekst
      _ -> po_umolchaniyu
    end
  end

  # ── единственная дорога от мира к решению о связи ─────────────────────────
  defp svyaz_sluchilas(u, kto, sobytie) do
    k = kanal(u, kto)

    hod =
      UzelZamera.fn_shag_svyazi_uzla(
        k.sostoyanie,
        sobytie,
        Flang.Rt.text(u.hesh),
        Flang.Rt.number(u.srok),
        Flang.Rt.number(u.pauza),
        Flang.Rt.flag(u.rabotaet)
      )

    u = s_kanalom(u, %{k | sostoyanie: pole(hod, "связь")})

    Enum.reduce(spisok(pole(hod, "веления")), u, fn velenie, akk ->
      ispolnit_svyaz(akk, kto, velenie)
    end)
  end

  defp ispolnit_svyaz(u, kto, {:var, imya, _} = velenie) do
    case imya do
      "Послать привет" ->
        poslat(u, kto, "привет", [{"узел", u.imya}, {"хэш", u.hesh}])

      "Прибрать" ->
        u = pribrat(u, kto)
        uzel_sluchilsya(u, UzelZamera.v_svyaz_poteryana(Flang.Rt.text(kto), Flang.Rt.text("сокет прибран")))

      "Связь заведена" ->
        skazat({:o, [{"в", "связь"}, {"узел", u.imya}, {"цель", @cel}, {"сосед", kto}, {"что", "заведена"}]})
        uzel_sluchilsya(u, UzelZamera.v_svyaz_gotova(Flang.Rt.text(kto)))

      "Связь отвергнута" ->
        skazat(
          {:o,
           [
             {"в", "связь"},
             {"узел", u.imya},
             {"цель", @cel},
             {"сосед", vn(pole(velenie, "сосед"))},
             {"что", "отвергнута"},
             {"почему", vn(pole(velenie, "почему"))}
           ]}
        )

        u

      "Доложить о потере" ->
        doklad_o_svyazi(u, kto, "потеряна", vn(pole(velenie, "почему")))

      "Доложить о несостоявшемся знакомстве" ->
        doklad_o_svyazi(u, kto, "не состоялась", vn(pole(velenie, "почему")))

      "Позвонить снова" ->
        k = kanal(u, kto)
        s_kanalom(u, %{k | kogda_zvonit: chasy() + vn(pole(velenie, "пауза"))})

      "Доставить письмо" ->
        # Эталон связи назвал АДРЕСАТА, груз оставил узлу — вот он.
        {u, bilet} = novyy_bilet(u, raskodirovat(chto_kadra(u.posledniy_kadr)))
        uzel_sluchilsya(u, UzelZamera.v_pismo_snaruzhi(pole(velenie, "кому"), Flang.Rt.number(bilet)))

      _ ->
        raise("узел не знает веления связи «#{imya}»")
    end
  end

  defp doklad_o_svyazi(u, kto, chto, pochemu) do
    skazat(
      {:o,
       [
         {"в", "связь"},
         {"узел", u.imya},
         {"цель", @cel},
         {"сосед", kto},
         {"что", chto},
         {"почему", pochemu}
       ]}
    )

    u
  end

  defp chto_kadra(kadr) do
    case Flang.Json.field(kadr, "что") do
      {:ok, gruz} -> gruz
      :error -> raise("кадр письма без груза")
    end
  end

  # ── билеты: груз живёт у хозяина, в таблице едет число ────────────────────
  defp novyy_bilet(u, gruz) do
    nomer = u.bilet + 1
    {%{u | bilet: nomer, gruzy: Map.put(u.gruzy, nomer, gruz)}, nomer * 1.0}
  end

  # ── единственная дорога от мира к решению о процессах ─────────────────────
  defp uzel_sluchilsya(u, sobytie) do
    hod = UzelZamera.fn_shag_uzla_celikom(u.uzel, sobytie)
    u = %{u | uzel: pole(hod, "узел")}

    Enum.reduce(spisok(pole(hod, "веления")), u, fn velenie, akk ->
      ispolnit_uzel(akk, velenie)
    end)
  end

  defp ispolnit_uzel(u, {:var, imya, _} = velenie) do
    case imya do
      "Позвать обработчик" ->
        pozvat(u, vn(pole(velenie, "кто")), trunc(vn(pole(velenie, "билет"))))

      "Послать по проводу" ->
        po_provodu(u, vn(pole(velenie, "узел")), vn(pole(velenie, "кому")), trunc(vn(pole(velenie, "билет"))))

      "Поставить таймер" ->
        srabotaet = chasy() + vn(pole(velenie, "задержка"))
        %{u | taymery: u.taymery ++ [{srabotaet, vn(pole(velenie, "кому")), vn(pole(velenie, "билет"))}]}

      "Записать в журнал" ->
        skazat(
          {:o,
           [
             {"в", vn(pole(velenie, "вид"))},
             {"узел", u.imya},
             {"цель", @cel},
             {"кто", vn(pole(velenie, "кто"))},
             {"почему", vn(pole(velenie, "почему"))}
           ]}
        )

        u

      "Уронить процесс" ->
        skazat(
          {:o,
           [
             {"в", "отказ"},
             {"узел", u.imya},
             {"цель", @cel},
             {"процесс", vn(pole(velenie, "кто"))},
             {"код", vn(pole(velenie, "код"))},
             {"текст", vn(pole(velenie, "текст"))}
           ]}
        )

        # Отказ уходит НАДЗОРУ, а не в журнал: решает напечатанный
        # `nadzor.flang`, здесь только дорога к нему.
        nadzor_sluchilsya(u, vn(pole(velenie, "кто")), vn(pole(velenie, "код")))

      "Письмо пропало" ->
        skazat(
          {:o,
           [
             {"в", "потеря"},
             {"узел", u.imya},
             {"цель", @cel},
             {"кому", vn(pole(velenie, "кому"))},
             {"почему", vn(pole(velenie, "почему"))}
           ]}
        )

        u

      _ ->
        raise("узел не знает веления планировщика «#{imya}»")
    end
  end

  defp po_provodu(u, kto, komu, nomer) do
    gruz = Map.get(u.gruzy, nomer)

    if kanal(u, kto) == nil or gruz == nil do
      u
    else
      poslat(u, kto, "письмо", [{"кому", komu}, {"что", zakodirovat(gruz)}])
    end
  end

  # ── единственная дорога от отказа к решению надзора ────────────────────
  defp nadzor_sluchilsya(u, kto, kod) do
    hod =
      UzelZamera.fn_shag_nadzora_uzla(
        u.derevo,
        Flang.Rt.text(kto),
        Flang.Rt.text(kod),
        Flang.Rt.number(chasy())
      )

    Enum.reduce(spisok(pole(hod, "веления")), %{u | derevo: pole(hod, "дерево")}, fn velenie, akk ->
      ispolnit_nadzor(akk, velenie)
    end)
  end

  defp ispolnit_nadzor(u, {:var, imya, _} = velenie) do
    kto = vn(pole(velenie, "кто"))

    case imya do
      "Поднять" ->
        # Перезапуск трогает состояние и не трогает ящик — это решено на flang;
        # здесь состояние берётся тем же путём, что при подъёме узла.
        u = %{u | uzel: UzelZamera.fn_ozhivit_process_uzla(u.uzel, Flang.Rt.text(kto))}

        u =
          case Enum.find(u.plan, fn p -> p.imya == kto end) do
            nil -> u
            p -> %{u | sostoyaniya: Map.put(u.sostoyaniya, kto, UzelZamera.call(p.nachalnoe, []))}
          end

        skazat({:o, [{"в", "надзор"}, {"узел", u.imya}, {"цель", @cel}, {"что", "поднят"}, {"кто", kto}]})
        u

      "Уложить" ->
        u = %{
          u
          | uzel:
              UzelZamera.fn_ulozhit_process_uzla(
                u.uzel,
                Flang.Rt.text(kto),
                Flang.Rt.text("остановлен надзором")
              )
        }

        skazat(
          {:o,
           [
             {"в", "надзор"},
             {"узел", u.imya},
             {"цель", @cel},
             {"что", "уложен"},
             {"кто", kto},
             {"надзор", vn(pole(velenie, "надзор"))}
           ]}
        )

        u

      "Решено" ->
        skazat(
          {:o,
           [
             {"в", "надзор"},
             {"узел", u.imya},
             {"цель", @cel},
             {"что", "решено"},
             {"кто", kto},
             {"надзор", vn(pole(velenie, "надзор"))},
             {"стратегия", vn(pole(velenie, "стратегия"))}
           ]}
        )

        u

      "Некому надзирать" ->
        skazat(
          {:o,
           [
             {"в", "надзор"},
             {"узел", u.imya},
             {"цель", @cel},
             {"что", "некому"},
             {"кто", kto},
             {"надзор", vn(pole(velenie, "надзор"))}
           ]}
        )

        %{u | uzel: UzelZamera.fn_ostanovit_uzel_celikom(u.uzel), rabotaet: false}

      inoe ->
        raise("узел не знает веления надзора «#{inoe}»")
    end
  end

  # ── вызов обработчика по имени: та самая граница языка ────────────────────
  defp pozvat(u, kto, nomer) do
    obrabotchik = obrabotchik_ot(u, kto)
    gruz = Map.get(u.gruzy, nomer)
    sostoyanie = Map.get(u.sostoyaniya, kto)

    if obrabotchik == nil or gruz == nil or sostoyanie == nil do
      uzel_sluchilsya(
        u,
        UzelZamera.v_obrabotchik_otkazal(Flang.Rt.text("FLANG_PROCESS"), Flang.Rt.text("обработчика или груза нет"))
      )
    else
      case poschitat(obrabotchik, sostoyanie, gruz) do
        {:ok, itog} -> otklik_prinyat(u, kto, itog)
        {:beda, kod, tekst} ->
          uzel_sluchilsya(u, UzelZamera.v_obrabotchik_otkazal(Flang.Rt.text(kod), Flang.Rt.text(tekst)))
      end
    end
  end

  defp poschitat(obrabotchik, sostoyanie, gruz) do
    {:ok, UzelZamera.call(obrabotchik, [sostoyanie, gruz])}
  rescue
    beda in Flang.Error -> {:beda, beda.code || "FLANG_INTERNAL", Exception.message(beda)}
  end

  defp otklik_prinyat(u, kto, itog) do
    u = %{u | sostoyaniya: Map.put(u.sostoyaniya, kto, pole(itog, "состояние"))}

    {u, deystviya} =
      Enum.reduce(spisok(pole(itog, "действия")), {u, []}, fn d, {akk, sobrannye} ->
        {akk, perevedyonnoe} = v_deystvie(akk, d)
        {akk, [perevedyonnoe | sobrannye]}
      end)

    uzel_sluchilsya(u, UzelZamera.v_obrabotchik_vernul(Flang.Rt.list(Enum.reverse(deystviya))))
  end

  defp obrabotchik_ot(u, kto) do
    case Enum.find(u.plan, fn p -> p.imya == kto end) do
      nil -> nil
      p -> p.obrabotchik
    end
  end

  # Действие языка → действие планировщика. Перевод, а не решение: имена разные
  # нарочно, иначе словарь действий языка и тип планировщика не собрались бы в
  # один модуль.
  defp v_deystvie(u, {:var, "отправить", _} = d) do
    {u, bilet} = novyy_bilet(u, pole(d, "что"))
    {u, UzelZamera.v_veleno_slat(pole(d, "кому"), Flang.Rt.number(bilet))}
  end

  defp v_deystvie(u, {:var, "через", _} = d) do
    {u, bilet} = novyy_bilet(u, pole(d, "что"))
    {u, UzelZamera.v_veleno_slat_pozzhe(pole(d, "кому"), Flang.Rt.number(bilet), pole(d, "задержка"))}
  end

  defp v_deystvie(u, {:var, "отложить", _}), do: {u, UzelZamera.v_veleno_otlozhit()}
  defp v_deystvie(u, {:var, "продолжить", _}), do: {u, UzelZamera.v_veleno_prodolzhit()}

  defp v_deystvie(u, {:var, "остановить", _} = d),
    do: {u, UzelZamera.v_veleno_ostanovit(pole(d, "почему"))}

  defp v_deystvie(_u, {:var, imya, _}), do: raise("узел не знает действия «#{imya}»")

  # ── круг: сокеты, часы, таймеры и очередь готовых ─────────────────────────
  defp period(u), do: max(20.0, u.srok / 5.0)

  defp krug(u, dokole) do
    if chasy() < dokole and u.rabotaet do
      u
      |> zvonki()
      |> prinyat()
      |> zhdat()
      |> taymery()
      |> pulsy()
      |> storozh()
      |> probegi(64)
      |> krug(dokole)
    else
      u
    end
  end

  defp zvonki(u) do
    seychas = chasy()

    Enum.reduce(u.kanaly, u, fn k0, akk ->
      k = kanal(akk, k0.kto)
      if k.soket == nil and seychas >= k.kogda_zvonit and k.adres != "", do: pozvonit(akk, k.kto), else: akk
    end)
  end

  defp zhdat(u) do
    zhdyom = trunc(min(period(u), u.puls))

    receive do  # МИР
      {:tcp, sok, dannye} -> dannye_prishli(u, sok, dannye)
      {:tcp_closed, sok} -> soket_slomalsya(u, sok, "сокет закрыт")
      {:tcp_error, sok, _} -> soket_slomalsya(u, sok, "сокет отказал")
    after
      zhdyom -> u
    end
  end

  defp soket_slomalsya(u, sok, pochemu) do
    case kanal_po_soketu(u, sok) do
      nil -> u
      k -> svyaz_sluchilas(u, k.kto, UzelZamera.v_soket_otkazal(Flang.Rt.text(pochemu)))
    end
  end

  defp taymery(u) do
    seychas = chasy()
    {sozrevshie, ostalnye} = Enum.split_with(u.taymery, fn {kogda, _, _} -> kogda <= seychas end)

    Enum.reduce(sozrevshie, %{u | taymery: ostalnye}, fn {_, komu, bilet}, akk ->
      uzel_sluchilsya(akk, UzelZamera.v_taymer_srabotal(Flang.Rt.text(komu), Flang.Rt.number(bilet)))
    end)
  end

  defp pulsy(u) do
    seychas = chasy()

    Enum.reduce(u.kanaly, u, fn k0, akk ->
      k = kanal(akk, k0.kto)

      if k.soket != nil and vn(pole(k.sostoyanie, "готова")) and seychas - k.posledniy_puls >= u.puls do
        poslat(s_kanalom(akk, %{k | posledniy_puls: seychas}), k.kto, "пульс", [])
      else
        akk
      end
    end)
  end

  defp storozh(u) do
    seychas = chasy()

    if seychas >= u.sleduyuschiy_storozh do
      Enum.reduce(u.kanaly, %{u | sleduyuschiy_storozh: seychas + period(u)}, fn k0, akk ->
        k = kanal(akk, k0.kto)

        if k.soket != nil,
          do: svyaz_sluchilas(akk, k.kto, UzelZamera.v_storozh_prosnulsya(Flang.Rt.number(seychas))),
          else: akk
      end)
    else
      u
    end
  end

  # Пробеги — до покоя, но с уступкой миру после каждого: иначе пульс не уйдёт,
  # и связь порвалась бы от собственной занятости.
  defp probegi(u, 0), do: u

  defp probegi(u, ostalos) do
    bylo = u.uzel
    {vypal, u} = zhrebiy(u)
    u = uzel_sluchilsya(u, UzelZamera.v_pora_bezhat(Flang.Rt.number(vypal)))
    if u.uzel == bylo, do: u, else: probegi(u, ostalos - 1)
  end

  # ── сборка узла из плана и размещения ─────────────────────────────────────
  defp novyy_uzel(imya, plan, razmeschenie, hesh, sroki, semya, razmeschenie_nadzora) do
    processy =
      Enum.map(plan, fn p ->
        gde = gde_zhivyot(razmeschenie, p.imya)
        svoy = gde == imya

        UzelZamera.fn_process_uzla(
          Flang.Rt.text(p.imya),
          Flang.Rt.flag(svoy),
          Flang.Rt.text(if svoy, do: "", else: gde),
          Flang.Rt.flag(true),
          Flang.Rt.text(""),
          Flang.Rt.number(p.yaschik),
          Flang.Rt.number(0),
          Flang.Rt.list([])
        )
      end)

    sostoyaniya =
      for p <- plan, gde_zhivyot(razmeschenie, p.imya) == imya, into: %{} do
        {p.imya, UzelZamera.call(p.nachalnoe, [])}
      end

    # Соседи считаются по ПРЕДСТАВИТЕЛЯМ, а не по «звонить»: узел, которого
    # набирает сосед, ждёт его ровно так же, и место под связь ему нужно такое
    # же. Без этого принимающая сторона отказывала бы в соединении, потому что
    # канала под него не заведено.
    kanaly =
      plan
      |> Enum.map(fn p -> gde_zhivyot(razmeschenie, p.imya) end)
      |> Enum.reject(fn gde -> gde == imya end)
      |> Enum.uniq()
      |> Enum.map(fn gde -> novyy_kanal(gde, kuda_zvonit(razmeschenie, gde)) end)

    %{
      imya: imya,
      plan: plan,
      hesh: hesh,
      srok: sroki.srok,
      puls: sroki.puls,
      pauza: sroki.pauza,
      rabotaet: true,
      semya: band(semya, 0xFFFFFFFF),
      sostoyaniya: sostoyaniya,
      uzel:
        UzelZamera.fn_uzel_zanovo(
          Flang.Rt.text(imya),
          Flang.Rt.list(processy),
          Flang.Rt.list([]),
          Flang.Rt.text(""),
          Flang.Rt.number(0),
          Flang.Rt.flag(true)
        ),
      kanaly: kanaly,
      server: nil,
      bilet: 0,
      gruzy: %{},
      taymery: [],
      posledniy_kadr: nil,
      sleduyuschiy_storozh: 0.0,
      derevo: derevo_nadzora(razmeschenie_nadzora)
    }
  end

  # Дерево надзора — данные, ровно как размещение. Решает по нему напечатанный
  # `nadzor.flang`, а не этот файл.
  defp derevo_nadzora(nadzory) do
    nadzirateli =
      Enum.map(nadzory, fn n ->
        UzelZamera.fn_nadziratel_uzla(
          Flang.Rt.text(n.imya),
          Flang.Rt.number(n.porog),
          Flang.Rt.number(n.okno),
          Flang.Rt.text(n.inache)
        )
      end)

    svyazi = fn klyuch ->
      Enum.flat_map(nadzory, fn n ->
        Enum.map(Map.get(n, klyuch, []), fn s ->
          UzelZamera.fn_svyaz_nadzora_uzla(
            Flang.Rt.text(s.kto),
            Flang.Rt.text(n.imya),
            Flang.Rt.text(s.strategiya)
          )
        end)
      end)
    end

    UzelZamera.fn_derevo_nadzora_uzla(
      Flang.Rt.list(nadzirateli),
      Flang.Rt.list(svyazi.(:processy)),
      Flang.Rt.list(svyazi.(:nadzory))
    )
  end

  # ── доводы, план, размещение ──────────────────────────────────────────────
  defp dovody([], sobrannye, _imya), do: sobrannye

  defp dovody([<<"--", imya::binary>> | ostalnye], sobrannye, _), do:
    dovody(ostalnye, Map.put(sobrannye, imya, true), imya)

  defp dovody([_znachenie | ostalnye], sobrannye, nil), do: dovody(ostalnye, sobrannye, nil)

  defp dovody([znachenie | ostalnye], sobrannye, imya), do:
    dovody(ostalnye, Map.put(sobrannye, imya, znachenie), nil)

  defp json_iz_teksta(tekst) do
    case Flang.Json.parse(tekst) do
      {:ok, uzel} -> uzel
      :error -> raise("не разобран JSON: #{tekst}")
    end
  end

  defp plan_iz_teksta(klyuchi) do
    tekst =
      case Map.get(klyuchi, "план") do
        gotovyy when is_binary(gotovyy) -> gotovyy
        _ -> File.read!(Map.fetch!(klyuchi, "план-файл"))  # МИР
      end

    json_iz_teksta(tekst)
  end

  defp plan_iz(plan) do
    {:ok, spisok_processov} = Flang.Json.field(plan, "процессы")

    Enum.map(spisok_processov, fn p ->
      %{
        imya: tekst_polya(p, "имя", ""),
        nachalnoe: tekst_polya(p, "начальное", ""),
        obrabotchik: tekst_polya(p, "обработчик", ""),
        yaschik: yaschik_iz(p)
      }
    end)
  end

  # Надзоры плана — данные для дерева надзора.
  defp nadzory_iz(plan) do
    spisok =
      case Flang.Json.field(plan, "надзоры") do
        {:ok, spisok} when is_list(spisok) -> spisok
        _ -> []
      end

    Enum.map(spisok, fn n ->
      %{
        imya: tekst_polya(n, "имя", ""),
        porog: chislo_polya(n, "порог"),
        okno: chislo_polya(n, "окно"),
        inache: tekst_polya(n, "иначе", "остановить"),
        processy: svyazi_iz(n, "процессы"),
        nadzory: svyazi_iz(n, "надзоры")
      }
    end)
  end

  defp svyazi_iz(n, klyuch) do
    case Flang.Json.field(n, klyuch) do
      {:ok, spisok} when is_list(spisok) ->
        Enum.map(spisok, fn s ->
          %{kto: tekst_polya(s, "кто", ""), strategiya: tekst_polya(s, "стратегия", "")}
        end)

      _ ->
        []
    end
  end

  defp chislo_polya(gde, imya) do
    case Flang.Json.field(gde, imya) do
      {:ok, tekst} when is_binary(tekst) -> chislo_vnutr(tekst)
      _ -> 0
    end
  end

  defp yaschik_iz(p) do
    case Flang.Json.field(p, "ящик") do
      {:ok, dlina} when is_binary(dlina) -> chislo_vnutr(dlina)
      _ -> 0
    end
  end

  defp gde_zhivyot(razmeschenie, imya), do: tekst_polya(razmeschenie, imya, "")

  defp kuda_zvonit(razmeschenie, gde) do
    case Flang.Json.field(razmeschenie, "звонить") do
      {:ok, kuda} -> tekst_polya(kuda, gde, "")
      :error -> ""
    end
  end

  defp chislo_klyucha(klyuchi, imya, po_umolchaniyu) do
    case Map.get(klyuchi, imya) do
      tekst when is_binary(tekst) -> chislo_vnutr(tekst)
      _ -> po_umolchaniyu
    end
  end

  defp adres_para(adres) do
    [port | naoborot] = adres |> String.split(":") |> Enum.reverse()
    {naoborot |> Enum.reverse() |> Enum.join(":"), String.to_integer(port)}
  end

  defp adres_ip(hozyain) do
    {:ok, ip} = :inet.parse_address(String.to_charlist(hozyain))
    ip
  end

  # ── главное ───────────────────────────────────────────────────────────────
  def main(argv) do
    :io.setopts(:standard_io, encoding: :latin1)  # МИР
    UzelZamera.new_context()
    klyuchi = dovody(argv, %{}, nil)

    sroki = %{
      srok: chislo_klyucha(klyuchi, "срок", 1000.0),
      puls: chislo_klyucha(klyuchi, "пульс", 200.0),
      pauza: chislo_klyucha(klyuchi, "пауза", 250.0)
    }

    plan = plan_iz_teksta(klyuchi)

    u =
      novyy_uzel(
        Map.fetch!(klyuchi, "я"),
        plan_iz(plan),
        json_iz_teksta(Map.fetch!(klyuchi, "размещение")),
        Map.fetch!(klyuchi, "хэш"),
        sroki,
        trunc(chislo_klyucha(klyuchi, "семя", 7.0)),
        nadzory_iz(plan)
      )

    {u, port} = slushat(u, if(is_binary(klyuchi["слушать"]), do: klyuchi["слушать"], else: nil))

    skazat(
      {:o,
       [
         {"в", "поднят"},
         {"узел", u.imya},
         {"цель", @cel},
         {"порт", port},
         {"хэш", String.slice(u.hesh, 0, 12)},
         {"сроки", {:o, [{"срок", trunc(u.srok)}, {"пульс", trunc(u.puls)}, {"пауза", trunc(u.pauza)}]}}
       ]}
    )

    # Начальные письма — тем же путём, каким приходят письма с провода.
    u =
      Enum.reduce(json_iz_teksta(Map.get(klyuchi, "вбросить", "[]")), u, fn vbros, akk ->
        {akk, bilet} = novyy_bilet(akk, raskodirovat(chto_kadra(vbros)))
        uzel_sluchilsya(akk, UzelZamera.v_pismo_snaruzhi(Flang.Rt.text(tekst_polya(vbros, "кому", "")), Flang.Rt.number(bilet)))
      end)

    u = krug(u, chasy() + chislo_klyucha(klyuchi, "жить", 5.0) * 1000.0)

    skazat(
      {:o,
       [
         {"в", "конец"},
         {"узел", u.imya},
         {"цель", @cel},
         {"состояния", {:o, Enum.map(u.sostoyaniya, fn {imya, znachenie} -> {imya, zakodirovat(znachenie)} end)}}
       ]}
    )
  end
end
