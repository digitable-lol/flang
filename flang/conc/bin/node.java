// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// ПОЛНЫЙ УЗЕЛ на цели java: таблица процессов, планировщик и связь.
//
// ── Из чего он собран ───────────────────────────────────────────────────────
//
// Ни одного решения в этом файле нет. Все три части решают напечатанные модули:
//
//   1. связь        flang/conc/svyaz.flang          — 11 событий, 8 велений
//   2. процессы     flang/conc/planirovshchik.flang — 7 событий, 6 велений
//   3. программа    flang/conc/examples/distributed.flang — обработчики
//
// Собраны они в один модуль flang/conc/uzel-zamer.flang и напечатаны
// компилятором в цель java. Хозяин собирается вместе с напечатанным одним
// javac под теми же ключами (-encoding UTF-8 -Xlint:all -Werror), а второй
// точки входа в Java не бывает: класс называют при запуске.
//
// Имя файла — node.java, а класса — HozyainUzla, и это законно: совпадать с
// именем файла обязан только ПУБЛИЧНЫЙ класс. Так соблюдается и правило Java, и
// общее для всех хозяев имя node.<цель>.
//
// ── Что делает этот файл и только он ────────────────────────────────────────
//
//   1. держит сокеты, часы, таймеры и очередь готовых;
//   2. переводит события мира в варианты двух эталонов;
//   3. исполняет веления, которые эталоны вернули;
//   4. зовёт обработчик по имени — это и есть та граница, из-за которой цикл
//      принадлежит хозяину: передать функцию туда, где она приезжает данными,
//      язык не умеет.
//
// Груз письма хозяин держит У СЕБЯ и кладёт в таблицу БИЛЕТ — число.
//
// ── Чем цель java отличается от шести прежних ───────────────────────────────
//
// Значение flang здесь — класс Value с тегом и полями, и читается он без
// объявления типа: тег числом, поля массивом пар. Разбор JSON пришлось
// ПОВТОРИТЬ, а не написать: он напечатан рядом (FlangCli.Json), но объявлен
// private внутри прогонщика. Разбирает он в java.util.Map, java.util.List и
// String — то есть в динамическое значение, и порог цены проходит.
//
// Печать числа и цитирование строки взяты у напечатанного (Value.numberText,
// Value.quoteJson): иначе число на проводе разошлось бы с остальными хозяевами
// (Double.toString даёт «2.0» там, где нужно «2»).
//
// Ожидание мира — опрос: сокеты со сроком в 1 мс, шаг 5 мс, выход по первым же
// байтам. Место в витке то же, что у select у остальных: между набором и
// пробегами, иначе первое письмо чужому ушло бы до знакомства.
//
// ── Чего здесь нет, и это названо ───────────────────────────────────────────
//
// НАДЗОРА. Отказ процесса доезжает до веления «Уронить процесс» и ложится в
// журнал, а перезапуска и порога отказов на этой цели нет: надзор выражен на
// flang отдельно (flang/self/conc.flang).
//
// БИЛЕТЫ НЕ ЧИСТЯТСЯ: словарь «билет → груз» растёт на долгой работе. То же у
// остальных хозяев; названо, не починено.
//
// Запуск (журнал построчным JSON на stdout, как у остальных хозяев):
//
//   java -cp . HozyainUzla --я счёт --слушать 127.0.0.1:0 --хэш <hex> \
//     --план-файл plan.json --размещение <json> [--срок 1000] [--жить 5]

import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class HozyainUzla {

  private static final String CEL = "java";

  /* Устройство вывода — своё, с явной кодировкой: у System.out кодировка
     берётся из локали, и русские имена полей уехали бы вопросами. */
  private static final PrintStream VYHOD =
      new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8); // МИР

  private HozyainUzla() {}

  /* ── JSON: разбор ──────────────────────────────────────────────────────────
     ПЕРЕВОЗКА, а не решение. Тот же разбор компилятор печатает рядом в
     FlangCli.Json, но там он private. Число разбирается в String: на проводе
     оно и так едет текстом, а разбор в double с последующей печатью потерял бы
     «-0». Строка и число оттого неразличимы, и это не мешает: вид значения на
     проводе называет МЕТКА, а не тип узла JSON. */
  private static final class Chtec {
    private final int[] znaki;
    private int gde;

    Chtec(String istochnik) {
      this.znaki = istochnik.codePoints().toArray();
      this.gde = 0;
    }

    private void probely() {
      while (gde < znaki.length && Character.isWhitespace(znaki[gde])) {
        gde += 1;
      }
    }

    private int znak() {
      return gde < znaki.length ? znaki[gde] : -1;
    }

    private boolean slovo(String slovo) {
      for (int bukva : slovo.codePoints().toArray()) {
        if (znak() != bukva) {
          return false;
        }
        gde += 1;
      }
      return true;
    }

    private String stroka() {
      gde += 1;
      StringBuilder sobrano = new StringBuilder();
      while (true) {
        int znak = znak();
        if (znak < 0) {
          throw new IllegalStateException("строка без конца");
        }
        gde += 1;
        if (znak == '"') {
          return sobrano.toString();
        }
        if (znak != '\\') {
          sobrano.appendCodePoint(znak);
          continue;
        }
        int sled = znak();
        gde += 1;
        switch (sled) {
          case '"' -> sobrano.append('"');
          case '\\' -> sobrano.append('\\');
          case '/' -> sobrano.append('/');
          case 'b' -> sobrano.append('\b');
          case 'f' -> sobrano.append('\f');
          case 'n' -> sobrano.append('\n');
          case 'r' -> sobrano.append('\r');
          case 't' -> sobrano.append('\t');
          case 'u' -> {
            StringBuilder kod = new StringBuilder();
            for (int shag = 0; shag < 4; shag += 1) {
              kod.appendCodePoint(znak());
              gde += 1;
            }
            sobrano.appendCodePoint(Integer.parseInt(kod.toString(), 16));
          }
          default -> throw new IllegalStateException("неизвестный обратный слэш");
        }
      }
    }

    private String chislo() {
      int nachalo = gde;
      while (gde < znaki.length) {
        int znak = znaki[gde];
        boolean svoy = (znak >= '0' && znak <= '9')
            || znak == '-' || znak == '+' || znak == '.' || znak == 'e' || znak == 'E';
        if (!svoy) {
          break;
        }
        gde += 1;
      }
      if (gde == nachalo) {
        throw new IllegalStateException("не число");
      }
      return new String(znaki, nachalo, gde - nachalo);
    }

    Object znachenie() {
      probely();
      int znak = znak();
      if (znak == '{') {
        gde += 1;
        Map<String, Object> pary = new LinkedHashMap<>();
        probely();
        if (znak() == '}') {
          gde += 1;
          return pary;
        }
        while (true) {
          probely();
          if (znak() != '"') {
            throw new IllegalStateException("ключ не строка");
          }
          String klyuch = stroka();
          probely();
          if (znak() != ':') {
            throw new IllegalStateException("нет двоеточия");
          }
          gde += 1;
          pary.put(klyuch, znachenie());
          probely();
          if (znak() == ',') {
            gde += 1;
            continue;
          }
          if (znak() == '}') {
            gde += 1;
            return pary;
          }
          throw new IllegalStateException("запись без конца");
        }
      }
      if (znak == '[') {
        gde += 1;
        List<Object> vnutri = new ArrayList<>();
        probely();
        if (znak() == ']') {
          gde += 1;
          return vnutri;
        }
        while (true) {
          vnutri.add(znachenie());
          probely();
          if (znak() == ',') {
            gde += 1;
            continue;
          }
          if (znak() == ']') {
            gde += 1;
            return vnutri;
          }
          throw new IllegalStateException("список без конца");
        }
      }
      if (znak == '"') {
        return stroka();
      }
      if (znak == 't') {
        if (!slovo("true")) {
          throw new IllegalStateException("не true");
        }
        return Boolean.TRUE;
      }
      if (znak == 'f') {
        if (!slovo("false")) {
          throw new IllegalStateException("не false");
        }
        return Boolean.FALSE;
      }
      if (znak == 'n') {
        if (!slovo("null")) {
          throw new IllegalStateException("не null");
        }
        return null;
      }
      return chislo();
    }
  }

  private static Object razobrat(String istochnik) {
    Chtec chtec = new Chtec(istochnik);
    Object chto = chtec.znachenie();
    chtec.probely();
    if (chtec.gde != chtec.znaki.length) {
      throw new IllegalStateException("лишнее после значения");
    }
    return chto;
  }

  private static Object pole(Object gde, String imya) {
    return gde instanceof Map<?, ?> zapis ? zapis.get(imya) : null;
  }

  private static String tekstPolya(Object gde, String imya, String poUmolchaniyu) {
    Object chto = pole(gde, imya);
    return chto instanceof String tekst ? tekst : poUmolchaniyu;
  }

  /* ── JSON: печать. Записи журнала и кадры провода собираются текстом. ───── */
  private static String zapis(String... pary) {
    StringBuilder sobrano = new StringBuilder("{");
    for (int nomer = 0; nomer + 1 < pary.length; nomer += 2) {
      if (nomer > 0) {
        sobrano.append(',');
      }
      sobrano.append(Value.quoteJson(pary[nomer])).append(':').append(pary[nomer + 1]);
    }
    return sobrano.append('}').toString();
  }

  private static String tekst(String chto) {
    return Value.quoteJson(chto);
  }

  private static void skazat(String... pary) {
    VYHOD.println(zapis(pary)); // МИР
  }

  /** Единственное чтение часов во всём файле. */
  private static double chasy() {
    return System.currentTimeMillis(); // МИР
  }

  /* ── провод: те же метки, что у остальных хозяев ─────────────────────────
     Перевод, а не решение: правило «у каждого значения метка одной буквой»
     живёт в flang/conc/DISTRIBUTED.md, и разойтись с ним нельзя. */
  private static String zakodirovat(Value znachenie) {
    switch (znachenie.tag) {
      case Value.TAG_NOTHING:
        return "[\"н\"]";
      case Value.TAG_FLAG:
        return "[\"п\"," + (znachenie.bit ? "true" : "false") + "]";
      case Value.TAG_STRING:
        return "[\"с\"," + tekst(znachenie.str) + "]";
      case Value.TAG_NUMBER:
        return "[\"ч\"," + chisloNaruzhu(znachenie.num) + "]";
      case Value.TAG_LIST: {
        StringBuilder vnutri = new StringBuilder("[\"л\",[");
        Value[] chleny = Value.elements(znachenie);
        for (int nomer = 0; nomer < chleny.length; nomer += 1) {
          if (nomer > 0) {
            vnutri.append(',');
          }
          vnutri.append(zakodirovat(chleny[nomer]));
        }
        return vnutri.append("]]").toString();
      }
      case Value.TAG_RECORD:
        return "[\"з\"," + polyaNaruzhu(znachenie.fields) + "]";
      case Value.TAG_VARIANT:
        return "[\"в\"," + tekst(znachenie.str) + "," + polyaNaruzhu(znachenie.fields) + "]";
      default:
        throw new IllegalStateException("нечего кодировать: тег " + znachenie.tag);
    }
  }

  private static String polyaNaruzhu(Field[] polya) {
    StringBuilder sobrano = new StringBuilder("{");
    for (int nomer = 0; nomer < polya.length; nomer += 1) {
      if (nomer > 0) {
        sobrano.append(',');
      }
      sobrano.append(tekst(polya[nomer].name())).append(':').append(zakodirovat(polya[nomer].value()));
    }
    return sobrano.append('}').toString();
  }

  /** Число наружу — текстом по правилам ECMAScript, как у остальных хозяев. */
  private static String chisloNaruzhu(double chislo) {
    if (Double.isNaN(chislo)) {
      return "\"NaN\"";
    }
    if (chislo == Double.POSITIVE_INFINITY) {
      return "\"+∞\"";
    }
    if (chislo == Double.NEGATIVE_INFINITY) {
      return "\"-∞\"";
    }
    if (chislo == 0.0 && Double.doubleToRawLongBits(chislo) != 0L) {
      return "\"-0\"";
    }
    return Value.numberText(chislo);
  }

  private static double chisloVnutr(String tekst) {
    switch (tekst) {
      case "NaN":
        return Double.NaN;
      case "+∞":
        return Double.POSITIVE_INFINITY;
      case "-∞":
        return Double.NEGATIVE_INFINITY;
      default:
        return Double.parseDouble(tekst);
    }
  }

  private static Value raskodirovat(Object kod) {
    if (!(kod instanceof List<?> chleny) || chleny.isEmpty()) {
      throw new IllegalStateException("не значение на проводе");
    }
    String metka = chleny.get(0) instanceof String imya ? imya : "";
    Object pervoe = chleny.size() > 1 ? chleny.get(1) : null;
    switch (metka) {
      case "н":
        return Value.nothing();
      case "п":
        return Value.flag(Boolean.TRUE.equals(pervoe));
      case "с":
        return Value.text(pervoe instanceof String tekst ? tekst : "");
      case "ч":
        return Value.number(chisloVnutr(pervoe instanceof String tekst ? tekst : "0"));
      case "л": {
        List<?> vnutri = pervoe instanceof List<?> spisok ? spisok : List.of();
        Value[] chastey = new Value[vnutri.size()];
        for (int nomer = 0; nomer < chastey.length; nomer += 1) {
          chastey[nomer] = raskodirovat(vnutri.get(nomer));
        }
        return Value.list(chastey);
      }
      case "з":
        return Value.record(polyaVnutr(pervoe));
      case "в": {
        Object vtoroe = chleny.size() > 2 ? chleny.get(2) : null;
        return Value.variant(pervoe instanceof String imya ? imya : "", polyaVnutr(vtoroe));
      }
      default:
        throw new IllegalStateException("неизвестная метка значения «" + metka + "»");
    }
  }

  private static Field[] polyaVnutr(Object chto) {
    if (!(chto instanceof Map<?, ?> pary)) {
      return new Field[0];
    }
    Field[] polya = new Field[pary.size()];
    int nomer = 0;
    for (Map.Entry<?, ?> para : pary.entrySet()) {
      polya[nomer] = new Field(String.valueOf(para.getKey()), raskodirovat(para.getValue()));
      nomer += 1;
    }
    return polya;
  }

  /* ── каналы, процессы, узел ─────────────────────────────────────────────── */

  private static final class Kanal {
    private final String kto;
    private final String adres;
    private Socket soket;
    private String hvost = "";
    private double kogdaZvonit;
    private double posledniyPuls;
    private Value sostoyanie;

    Kanal(String kto, String adres, Value sostoyanie) {
      this.kto = kto;
      this.adres = adres;
      this.sostoyanie = sostoyanie;
    }
  }

  private static final class Process {
    private final String imya;
    private final String nachalnoe;
    private final String obrabotchik;
    private final double yaschik;

    Process(String imya, String nachalnoe, String obrabotchik, double yaschik) {
      this.imya = imya;
      this.nachalnoe = nachalnoe;
      this.obrabotchik = obrabotchik;
      this.yaschik = yaschik;
    }
  }

  private static final class Taymer {
    private final double kogda;
    private final String komu;
    private final double bilet;

    Taymer(double kogda, String komu, double bilet) {
      this.kogda = kogda;
      this.komu = komu;
      this.bilet = bilet;
    }
  }

  private static final class Uzel {
    private final String imya;
    private final List<Process> plan;
    private final String hesh;
    private final double srok;
    private final double puls;
    private final double pauza;
    private boolean rabotaet = true;
    private int semya;
    private final Ctx ctx = UzelZamera.newContext();
    private final Map<String, Value> sostoyaniya = new LinkedHashMap<>();
    private Value uzel;
    private final List<Kanal> kanaly = new ArrayList<>();
    private ServerSocket server;
    private long bilet;
    private final Map<Long, Value> gruzy = new HashMap<>();
    private final List<Taymer> taymery = new ArrayList<>();
    private Object posledniyKadr;
    private double sleduyuschiyStorozh;

    Uzel(String imya, List<Process> plan, Object razmeschenie, String hesh,
        double srok, double puls, double pauza, int semya) {
      this.imya = imya;
      this.plan = plan;
      this.hesh = hesh;
      this.srok = srok;
      this.puls = puls;
      this.pauza = pauza;
      this.semya = semya;

      Value[] processy = new Value[plan.size()];
      for (int nomer = 0; nomer < plan.size(); nomer += 1) {
        Process process = plan.get(nomer);
        String gde = tekstPolya(razmeschenie, process.imya, "");
        boolean svoy = gde.equals(imya);
        processy[nomer] = UzelZamera.fn_process_uzla(ctx, Value.text(process.imya), Value.flag(svoy),
            Value.text(svoy ? "" : gde), Value.flag(true), Value.text(""),
            Value.number(process.yaschik), Value.number(0), Value.emptyList());
        if (svoy) {
          sostoyaniya.put(process.imya, UzelZamera.call(ctx, process.nachalnoe, new Value[] {}));
        }
      }
      uzel = UzelZamera.fn_uzel_zanovo(ctx, Value.text(imya), Value.list(processy),
          Value.emptyList(), Value.text(""), Value.number(0), Value.flag(true));

      /* Соседи считаются по ПРЕДСТАВИТЕЛЯМ, а не по «звонить»: узел, которого
         набирает сосед, ждёт его ровно так же, и место под связь ему нужно
         такое же. Без этого принимающая сторона отказывала бы в соединении. */
      Object zvonit = pole(razmeschenie, "звонить");
      for (Process process : plan) {
        String gde = tekstPolya(razmeschenie, process.imya, "");
        if (gde.equals(imya) || najti(gde) >= 0) {
          continue;
        }
        Value svyaz = UzelZamera.fn_svyaz_uzla_zanovo(ctx, Value.text(gde), Value.flag(false),
            Value.flag(false), Value.flag(false), Value.flag(false), Value.flag(false), Value.number(0));
        kanaly.add(new Kanal(gde, tekstPolya(zvonit, gde, ""), svyaz));
      }
    }

    private int najti(String kto) {
      for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
        if (kanaly.get(nomer).kto.equals(kto)) {
          return nomer;
        }
      }
      return -1;
    }

    // ── мир: сокеты ────────────────────────────────────────────────────────
    private int slushat(String adres) throws IOException {
      int kray = adres.lastIndexOf(':');
      ServerSocket sluh = new ServerSocket(); // МИР
      sluh.setReuseAddress(true); // МИР
      sluh.bind(new InetSocketAddress(adres.substring(0, kray),
          Integer.parseInt(adres.substring(kray + 1))), 8); // МИР
      sluh.setSoTimeout(1); // МИР
      server = sluh;
      return sluh.getLocalPort(); // МИР
    }

    private void pozvonit(int nomer) {
      Kanal kanal = kanaly.get(nomer);
      if (kanal.soket != null || !rabotaet) {
        return;
      }
      int kray = kanal.adres.lastIndexOf(':');
      try {
        Socket sok = new Socket(kanal.adres.substring(0, kray),
            Integer.parseInt(kanal.adres.substring(kray + 1))); // МИР
        sok.setTcpNoDelay(true); // МИР
        sok.setSoTimeout(1); // МИР
        kanal.soket = sok;
        svyazSluchilas(nomer, UzelZamera.v_soket_zavyolsya(Value.number(chasy())));
      } catch (IOException beda) {
        svyazSluchilas(nomer, UzelZamera.v_zvonok_ne_udalsya());
      }
    }

    /** Кто позвонил, скажет его «привет»; до него связь безымянная, и место для
     *  неё берётся первое свободное. */
    private void prinyat() {
      if (server == null) {
        return;
      }
      Socket sok;
      try {
        sok = server.accept(); // МИР
      } catch (IOException beda) {
        return;
      }
      int svobodnyy = -1;
      for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
        if (kanaly.get(nomer).soket == null) {
          svobodnyy = nomer;
          break;
        }
      }
      if (svobodnyy < 0) {
        zakryt(sok);
        return;
      }
      try {
        sok.setTcpNoDelay(true); // МИР
        sok.setSoTimeout(1); // МИР
      } catch (IOException beda) {
        zakryt(sok);
        return;
      }
      kanaly.get(svobodnyy).soket = sok;
      svyazSluchilas(svobodnyy, UzelZamera.v_soket_zavyolsya(Value.number(chasy())));
    }

    private static void zakryt(Socket sok) {
      try {
        sok.close(); // МИР
      } catch (IOException beda) {
        // сокет и так негоден
      }
    }

    private void poslat(int nomer, String vid, String... pary) {
      Kanal kanal = kanaly.get(nomer);
      if (kanal.soket == null) {
        return;
      }
      Value gotova = Value.lookup(kanal.sostoyanie.fields, "готова");
      if ((gotova == null || !gotova.bit) && !vid.equals("привет")) {
        return;
      }
      String[] polya = new String[pary.length + 2];
      polya[0] = "в";
      polya[1] = tekst(vid);
      System.arraycopy(pary, 0, polya, 2, pary.length);
      try {
        OutputStream kuda = kanal.soket.getOutputStream();
        kuda.write((zapis(polya) + "\n").getBytes(StandardCharsets.UTF_8)); // МИР
        kuda.flush(); // МИР
      } catch (IOException beda) {
        svyazSluchilas(nomer, UzelZamera.v_soket_otkazal(Value.text("запись в сокет отказала")));
      }
    }

    /** Читает всё, что пришло. Отвечает, были ли байты, — по этому ответу круг
     *  выходит из ожидания мира раньше срока, как выходит select у остальных. */
    private boolean prochest(int nomer) {
      Kanal kanal = kanaly.get(nomer);
      if (kanal.soket == null) {
        return false;
      }
      byte[] kusok = new byte[65536];
      int dlina;
      try {
        InputStream otkuda = kanal.soket.getInputStream();
        dlina = otkuda.read(kusok); // МИР
      } catch (SocketTimeoutException tishina) {
        return false;
      } catch (IOException beda) {
        svyazSluchilas(nomer, UzelZamera.v_soket_otkazal(Value.text("сокет отказал")));
        return true;
      }
      if (dlina < 0) {
        svyazSluchilas(nomer, UzelZamera.v_soket_otkazal(Value.text("сокет закрыт")));
        return true;
      }
      svyazSluchilas(nomer, UzelZamera.v_bayty_prishli(Value.number(chasy())));
      kanal.hvost = kanal.hvost + new String(kusok, 0, dlina, StandardCharsets.UTF_8);
      while (kanal.soket != null) {
        int kray = kanal.hvost.indexOf('\n');
        if (kray < 0) {
          break;
        }
        String strokaKadra = kanal.hvost.substring(0, kray).trim();
        kanal.hvost = kanal.hvost.substring(kray + 1);
        if (strokaKadra.isEmpty()) {
          continue;
        }
        Object kadr;
        try {
          kadr = razobrat(strokaKadra);
        } catch (RuntimeException beda) {
          svyazSluchilas(nomer, UzelZamera.v_soket_otkazal(Value.text("кадр не разобран")));
          return true;
        }
        posledniyKadr = kadr;
        kadrom(nomer, kadr);
      }
      return true;
    }

    private void pribrat(int nomer) {
      Kanal kanal = kanaly.get(nomer);
      if (kanal.soket != null) {
        zakryt(kanal.soket); // МИР
        kanal.soket = null;
      }
      kanal.hvost = "";
    }

    // ── перевод: кадр провода → вариант эталона связи ──────────────────────
    private void kadrom(int nomer, Object kadr) {
      String vid = tekstPolya(kadr, "в", "");
      Value sobytie;
      switch (vid) {
        case "привет" -> sobytie = UzelZamera.v_prishyol_privet(
            Value.text(tekstPolya(kadr, "узел", "")), Value.text(tekstPolya(kadr, "хэш", "")));
        case "пульс" -> sobytie = UzelZamera.v_prishyol_puls();
        case "письмо" -> sobytie = UzelZamera.v_prishlo_pismo(Value.text(tekstPolya(kadr, "кому", "")));
        case "отбой" -> sobytie = UzelZamera.v_prishyol_otboy(
            Value.text(tekstPolya(kadr, "почему", "без причины")));
        default -> sobytie = UzelZamera.v_prishyol_chuzhoy_kadr(Value.text(vid));
      }
      svyazSluchilas(nomer, sobytie);
    }

    // ── единственная дорога от мира к решению о связи ──────────────────────
    private void svyazSluchilas(int nomer, Value sobytie) {
      Kanal kanal = kanaly.get(nomer);
      Value hod = UzelZamera.fn_shag_svyazi_uzla(ctx, kanal.sostoyanie, sobytie, Value.text(hesh),
          Value.number(srok), Value.number(pauza), Value.flag(rabotaet));
      kanal.sostoyanie = Flang.fieldGet(ctx, hod, "связь");
      for (Value velenie : Value.elements(Flang.fieldGet(ctx, hod, "веления"))) {
        ispolnitSvyaz(nomer, velenie);
      }
    }

    private static String vzyatTekst(Value velenie, String imya) {
      Value chto = Value.lookup(velenie.fields, imya);
      return chto == null ? "" : chto.str;
    }

    private static double vzyatChislo(Value velenie, String imya) {
      Value chto = Value.lookup(velenie.fields, imya);
      return chto == null ? 0.0 : chto.num;
    }

    private void ispolnitSvyaz(int nomer, Value velenie) {
      Kanal kanal = kanaly.get(nomer);
      switch (velenie.str) {
        case "Послать привет" -> poslat(nomer, "привет", "узел", tekst(imya), "хэш", tekst(hesh));
        case "Прибрать" -> {
          pribrat(nomer);
          uzelSluchilsya(UzelZamera.v_svyaz_poteryana(Value.text(kanal.kto), Value.text("сокет прибран")));
        }
        case "Связь заведена" -> {
          skazat("в", tekst("связь"), "узел", tekst(imya), "цель", tekst(CEL),
              "сосед", tekst(kanal.kto), "что", tekst("заведена"));
          uzelSluchilsya(UzelZamera.v_svyaz_gotova(Value.text(kanal.kto)));
        }
        case "Связь отвергнута" -> skazat("в", tekst("связь"), "узел", tekst(imya), "цель", tekst(CEL),
            "сосед", tekst(vzyatTekst(velenie, "сосед")), "что", tekst("отвергнута"),
            "почему", tekst(vzyatTekst(velenie, "почему")));
        case "Доложить о потере" -> dokladOSvyazi(kanal, "потеряна", vzyatTekst(velenie, "почему"));
        case "Доложить о несостоявшемся знакомстве" ->
            dokladOSvyazi(kanal, "не состоялась", vzyatTekst(velenie, "почему"));
        case "Позвонить снова" -> kanal.kogdaZvonit = chasy() + vzyatChislo(velenie, "пауза");
        case "Доставить письмо" -> {
          /* Эталон связи назвал АДРЕСАТА, груз оставил узлу — вот он. */
          Value gruz = raskodirovat(pole(posledniyKadr, "что"));
          uzelSluchilsya(UzelZamera.v_pismo_snaruzhi(
              Value.text(vzyatTekst(velenie, "кому")), Value.number(novyyBilet(gruz))));
        }
        default -> throw new IllegalStateException("узел не знает веления связи «" + velenie.str + "»");
      }
    }

    private void dokladOSvyazi(Kanal kanal, String chto, String pochemu) {
      skazat("в", tekst("связь"), "узел", tekst(imya), "цель", tekst(CEL),
          "сосед", tekst(kanal.kto), "что", tekst(chto), "почему", tekst(pochemu));
    }

    // ── билеты: груз живёт у хозяина, в таблице едет число ─────────────────
    private double novyyBilet(Value gruz) {
      bilet += 1;
      gruzy.put(bilet, gruz);
      return bilet;
    }

    // ── единственная дорога от мира к решению о процессах ──────────────────
    private void uzelSluchilsya(Value sobytie) {
      Value hod = UzelZamera.fn_shag_uzla_celikom(ctx, uzel, sobytie);
      uzel = Flang.fieldGet(ctx, hod, "узел");
      for (Value velenie : Value.elements(Flang.fieldGet(ctx, hod, "веления"))) {
        ispolnitUzel(velenie);
      }
    }

    private void ispolnitUzel(Value velenie) {
      switch (velenie.str) {
        case "Позвать обработчик" ->
            pozvat(vzyatTekst(velenie, "кто"), (long) vzyatChislo(velenie, "билет"));
        case "Послать по проводу" -> {
          int nomer = najti(vzyatTekst(velenie, "узел"));
          Value gruz = gruzy.get((long) vzyatChislo(velenie, "билет"));
          if (nomer >= 0 && gruz != null) {
            poslat(nomer, "письмо", "кому", tekst(vzyatTekst(velenie, "кому")),
                "что", zakodirovat(gruz));
          }
        }
        case "Поставить таймер" -> taymery.add(new Taymer(chasy() + vzyatChislo(velenie, "задержка"),
            vzyatTekst(velenie, "кому"), vzyatChislo(velenie, "билет")));
        case "Записать в журнал" -> skazat("в", tekst(vzyatTekst(velenie, "вид")),
            "узел", tekst(imya), "цель", tekst(CEL), "кто", tekst(vzyatTekst(velenie, "кто")),
            "почему", tekst(vzyatTekst(velenie, "почему")));
        // Надзора на этой цели нет — назван в шапке. Отказ виден в журнале.
        case "Уронить процесс" -> skazat("в", tekst("отказ"), "узел", tekst(imya), "цель", tekst(CEL),
            "процесс", tekst(vzyatTekst(velenie, "кто")), "код", tekst(vzyatTekst(velenie, "код")),
            "текст", tekst(vzyatTekst(velenie, "текст")));
        case "Письмо пропало" -> skazat("в", tekst("потеря"), "узел", tekst(imya), "цель", tekst(CEL),
            "кому", tekst(vzyatTekst(velenie, "кому")), "почему", tekst(vzyatTekst(velenie, "почему")));
        default ->
            throw new IllegalStateException("узел не знает веления планировщика «" + velenie.str + "»");
      }
    }

    // ── вызов обработчика по имени: та самая граница языка ─────────────────
    private void pozvat(String kto, long nomerBileta) {
      String obrabotchik = null;
      for (Process process : plan) {
        if (process.imya.equals(kto)) {
          obrabotchik = process.obrabotchik;
        }
      }
      Value gruz = gruzy.get(nomerBileta);
      Value sostoyanie = sostoyaniya.get(kto);
      if (obrabotchik == null || gruz == null || sostoyanie == null) {
        uzelSluchilsya(UzelZamera.v_obrabotchik_otkazal(
            Value.text("FLANG_PROCESS"), Value.text("обработчика или груза нет")));
        return;
      }
      Value itog;
      try {
        itog = UzelZamera.call(ctx, obrabotchik, new Value[] {sostoyanie, gruz});
      } catch (FlangError beda) {
        uzelSluchilsya(UzelZamera.v_obrabotchik_otkazal(
            Value.text(beda.code()), Value.text(beda.text())));
        return;
      }
      sostoyaniya.put(kto, Flang.fieldGet(ctx, itog, "состояние"));
      Value[] deystviya = Value.elements(Flang.fieldGet(ctx, itog, "действия"));
      Value[] velenya = new Value[deystviya.length];
      for (int nomer = 0; nomer < deystviya.length; nomer += 1) {
        velenya[nomer] = vDeystvie(deystviya[nomer]);
      }
      uzelSluchilsya(UzelZamera.v_obrabotchik_vernul(Value.list(velenya)));
    }

    /** Действие языка → действие планировщика. Перевод, а не решение: имена
     *  разные нарочно, иначе словарь действий языка и тип планировщика не
     *  собрались бы в один модуль. */
    private Value vDeystvie(Value deystvie) {
      Value komu = Value.lookup(deystvie.fields, "кому");
      Value chto = Value.lookup(deystvie.fields, "что");
      switch (deystvie.str) {
        case "отправить":
          return UzelZamera.v_veleno_slat(komu == null ? Value.text("") : komu,
              Value.number(novyyBilet(chto == null ? Value.nothing() : chto)));
        case "через": {
          Value zaderzhka = Value.lookup(deystvie.fields, "задержка");
          return UzelZamera.v_veleno_slat_pozzhe(komu == null ? Value.text("") : komu,
              Value.number(novyyBilet(chto == null ? Value.nothing() : chto)),
              zaderzhka == null ? Value.number(0) : zaderzhka);
        }
        case "отложить":
          return UzelZamera.v_veleno_otlozhit();
        case "продолжить":
          return UzelZamera.v_veleno_prodolzhit();
        case "остановить": {
          Value pochemu = Value.lookup(deystvie.fields, "почему");
          return UzelZamera.v_veleno_ostanovit(pochemu == null ? Value.text("") : pochemu);
        }
        default:
          throw new IllegalStateException("узел не знает действия «" + deystvie.str + "»");
      }
    }

    // ── круг: сокеты, часы, таймеры и очередь готовых ──────────────────────
    private double period() {
      return Math.max(20.0, srok / 5.0);
    }

    private double zhrebiy() {
      semya = semya + 0x6D2B79F5;
      int t = (semya ^ (semya >>> 15)) * (semya | 1);
      t ^= t + (t ^ (t >>> 7)) * (t | 61);
      return (Integer.toUnsignedLong(t ^ (t >>> 14))) / 4294967296.0;
    }

    /** Ждать мира. Selector здесь не нужен: сокеты со сроком в 1 мс дают тот же
     *  опрос вдвое короче. Место в витке — то же, что у select у остальных
     *  хозяев: между набором и пробегами. */
    private void zhdatMira() {
      double kray = chasy() + Math.min(period(), puls);
      while (true) {
        prinyat();
        boolean bylo = false;
        for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
          if (kanaly.get(nomer).soket != null && prochest(nomer)) {
            bylo = true;
          }
        }
        if (bylo || chasy() >= kray) {
          return;
        }
        try {
          Thread.sleep(5); // МИР
        } catch (InterruptedException prervali) {
          Thread.currentThread().interrupt();
          return;
        }
      }
    }

    private void krug(double dokole) {
      while (chasy() < dokole && rabotaet) {
        double seychas = chasy();
        for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
          Kanal kanal = kanaly.get(nomer);
          if (kanal.soket == null && seychas >= kanal.kogdaZvonit && !kanal.adres.isEmpty()) {
            pozvonit(nomer);
          }
        }
        zhdatMira();

        seychas = chasy();
        List<Taymer> sozrevshie = new ArrayList<>();
        List<Taymer> ostalnye = new ArrayList<>();
        for (Taymer taymer : taymery) {
          if (taymer.kogda <= seychas) {
            sozrevshie.add(taymer);
          } else {
            ostalnye.add(taymer);
          }
        }
        taymery.clear();
        taymery.addAll(ostalnye);
        for (Taymer taymer : sozrevshie) {
          uzelSluchilsya(UzelZamera.v_taymer_srabotal(Value.text(taymer.komu), Value.number(taymer.bilet)));
        }

        for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
          Kanal kanal = kanaly.get(nomer);
          Value gotova = Value.lookup(kanal.sostoyanie.fields, "готова");
          if (kanal.soket != null && gotova != null && gotova.bit
              && seychas - kanal.posledniyPuls >= puls) {
            kanal.posledniyPuls = seychas;
            poslat(nomer, "пульс");
          }
        }

        if (seychas >= sleduyuschiyStorozh) {
          sleduyuschiyStorozh = seychas + period();
          for (int nomer = 0; nomer < kanaly.size(); nomer += 1) {
            if (kanaly.get(nomer).soket != null) {
              svyazSluchilas(nomer, UzelZamera.v_storozh_prosnulsya(Value.number(seychas)));
            }
          }
        }

        // Пробеги — до покоя, но с уступкой миру после каждого витка.
        for (int shag = 0; shag < 64; shag += 1) {
          Value bylo = uzel;
          uzelSluchilsya(UzelZamera.v_pora_bezhat(Value.number(zhrebiy())));
          if (Value.equal(uzel, bylo)) {
            break;
          }
        }
      }
    }

    private String sostoyaniyaNaruzhu() {
      List<String> pary = new ArrayList<>();
      for (Map.Entry<String, Value> para : sostoyaniya.entrySet()) {
        pary.add(para.getKey());
        pary.add(zakodirovat(para.getValue()));
      }
      return zapis(pary.toArray(new String[0]));
    }
  }

  /* ── доводы, план, размещение ─────────────────────────────────────────── */

  private static Map<String, String> dovody(String[] argv) {
    Map<String, String> sobrannye = new LinkedHashMap<>();
    String imya = null;
    for (String dovod : argv) {
      if (dovod.startsWith("--")) {
        imya = dovod.substring(2);
        sobrannye.put(imya, "");
      } else if (imya != null) {
        sobrannye.put(imya, dovod);
        imya = null;
      }
    }
    return sobrannye;
  }

  private static String nuzhen(Map<String, String> klyuchi, String imya) {
    String chto = klyuchi.get(imya);
    if (chto == null) {
      throw new IllegalStateException("нужен довод --" + imya);
    }
    return chto;
  }

  private static double chisloKlyucha(Map<String, String> klyuchi, String imya, double poUmolchaniyu) {
    String chto = klyuchi.get(imya);
    return chto == null || chto.isEmpty() ? poUmolchaniyu : Double.parseDouble(chto);
  }

  private static List<Process> planIz(Map<String, String> klyuchi) throws IOException {
    String tekstPlana = klyuchi.getOrDefault("план", "");
    if (tekstPlana.isEmpty()) {
      tekstPlana = Files.readString(Path.of(nuzhen(klyuchi, "план-файл")), StandardCharsets.UTF_8); // МИР
    }
    Object plan = razobrat(tekstPlana);
    List<Process> processy = new ArrayList<>();
    Object spisok = pole(plan, "процессы");
    if (spisok instanceof List<?> chleny) {
      for (Object chlen : chleny) {
        Object dlina = pole(chlen, "ящик");
        processy.add(new Process(
            tekstPolya(chlen, "имя", ""),
            tekstPolya(chlen, "начальное", ""),
            tekstPolya(chlen, "обработчик", ""),
            dlina instanceof String tekstDliny ? chisloVnutr(tekstDliny) : 0.0));
      }
    }
    return processy;
  }

  public static void main(String[] argv) throws IOException {
    Map<String, String> klyuchi = dovody(argv);
    Uzel uzel = new Uzel(
        nuzhen(klyuchi, "я"),
        planIz(klyuchi),
        razobrat(nuzhen(klyuchi, "размещение")),
        nuzhen(klyuchi, "хэш"),
        chisloKlyucha(klyuchi, "срок", 1000),
        chisloKlyucha(klyuchi, "пульс", 200),
        chisloKlyucha(klyuchi, "пауза", 250),
        (int) chisloKlyucha(klyuchi, "семя", 7));

    String adres = klyuchi.getOrDefault("слушать", "");
    int port = adres.isEmpty() ? 0 : uzel.slushat(adres);
    skazat("в", tekst("поднят"), "узел", tekst(uzel.imya), "цель", tekst(CEL),
        "порт", Integer.toString(port),
        "хэш", tekst(uzel.hesh.substring(0, Math.min(12, uzel.hesh.length()))),
        "сроки", zapis("срок", Value.numberText(uzel.srok), "пульс", Value.numberText(uzel.puls),
            "пауза", Value.numberText(uzel.pauza)));

    // Начальные письма — тем же путём, каким приходят письма с провода.
    Object vbrosy = razobrat(klyuchi.getOrDefault("вбросить", "[]"));
    if (vbrosy instanceof List<?> chleny) {
      for (Object vbros : chleny) {
        Value gruz = raskodirovat(pole(vbros, "что"));
        uzel.uzelSluchilsya(UzelZamera.v_pismo_snaruzhi(
            Value.text(tekstPolya(vbros, "кому", "")), Value.number(uzel.novyyBilet(gruz))));
      }
    }

    uzel.krug(chasy() + chisloKlyucha(klyuchi, "жить", 5) * 1000.0);
    skazat("в", tekst("конец"), "узел", tekst(uzel.imya), "цель", tekst(CEL),
        "состояния", uzel.sostoyaniyaNaruzhu());
  }
}
