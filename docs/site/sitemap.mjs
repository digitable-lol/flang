// Карта сайта: какие страницы есть, из чего собираются, как называются.
//
// Один список — один источник правды. Добавить страницу значит дописать строку
// сюда; забыть вписать в оглавление невозможно, потому что оглавление строится
// отсюда же.
//
// Поле `из` — путь от корня репозитория. Если файла нет, сборка отказывает с
// именем — молча пропускать страницу нельзя, иначе сайт худеет незаметно.
//
// ДВУЯЗЫЧНОСТЬ выводится из имени файла, а не объявляется второй строкой: у
// `имя.ru.md` английская пара — соседний `имя.md`, ровно тот уклад, что уже
// работает у руководства. Английская страница встаёт по адресу
// `en/<имя>.html`. Для СОБСТВЕННЫХ страниц сайта (`docs/site/`) пара
// ОБЯЗАТЕЛЬНА: нет файла — сборка красная. Исключение одно и названо полем
// `печатается`. Для страниц вне `docs/site/` пара берётся по наличию.

export const РАЗДЕЛЫ = [
  {
    имя: 'Начало', англ: 'Start',
    страницы: [
      { адрес: 'index.html', имя: 'Что такое flang', из: 'docs/site/index.ru.md' },
      { адрес: 'install.html', имя: 'Установка', из: 'docs/site/install.ru.md' },
      { адрес: 'getting-started.html', имя: 'Первая программа', из: 'docs/site/getting-started.ru.md' },
      { адрес: 'tutorial.html', имя: 'Учебник', из: 'docs/site/tutorial.ru.md' },
      { адрес: 'editor.html', имя: 'Настройка редактора', из: 'docs/site/editor.ru.md' },
      /* ДОРОГА. Страниц у сайта много, а порядка между ними не было ни одного:
         после учебника читатель упирался в россыпь и выбирал наугад. Эта
         страница — единственное место, где сказано, что за чем и по какому
         признаку шаг считается взятым. Стоит последней в «Начале» ровно
         потому, что нужна она в тот момент, когда дорожка новичка кончилась. */
      { адрес: 'learning.html', имя: 'Как учить язык дальше', из: 'docs/site/learning.ru.md' },
      /* Страница беды стоит последней и в разделе для новичка: открывают её не
         по порядку, а в тот час, когда команда ответила не тем. */
      { адрес: 'troubleshooting.html', имя: 'Устранение неполадок', из: 'docs/site/troubleshooting.ru.md' },
    ],
  },
  {
    // Раздел стоит вторым намеренно: заходящий второй раз ищет не «что это
    // такое», а «что приехало в версию, которую я ставлю».
    //
    // ЕДИНИЦА ЗДЕСЬ — ВЫПУСК, а не вливание и не коммит. Так стоит у go, elixir
    // и rust. Журнал вливаний, стоявший тут раньше, печатался из тем слияний, а
    // темы здесь пишутся для команды («Слияние work/stdlib-json-time: json и
    // datetime влиты поверх правки затенения») — для второго пункта меню
    // публичного сайта это не годится. Печать заметок к выпускам, которой
    // раньше не было, теперь есть: `flang io scripts/releases-page.flang`.
    имя: 'Что изменилось', англ: 'What changed',
    страницы: [
      // `печатается` снимает требование английской пары ИЗ КАРТЫ: обе половины
      // печатает `flang io scripts/releases-page.flang` из тегов и заметок
      // выпусков, и руками их затрёт первая же перепечатка. Английская страница
      // при этом есть — она подхватывается по имени файла, как у всех.
      { адрес: 'releases.html', имя: 'Выпуски', из: 'docs/site/releases.ru.md', печатается: true },
      /* РОАДМАП ПЕРЕЕХАЛ ИЗ «НАЧАЛА», где стоял пятым пунктом — то есть на
         дорожке новичка, сразу за учебником. Читать там его нечем: страница
         состоит из внутренних замеров сборки (один вызов компилятора на четыре
         файла `.c`, `-flto`, размер бинарника в байтах, точка раскрутки). На
         вопрос пришедшего впервые она не отвечает ни строкой.
         Здесь она на месте: «что приехало» и «что приедет» — один вопрос,
         заданный дважды. */
      { адрес: 'roadmap.html', имя: 'Что будет дальше', из: 'docs/site/roadmap.ru.md' },
    ],
  },
  {
    имя: 'Язык', англ: 'Language',
    страницы: [
      /* ПОРЯДОК ЗДЕСЬ — ОТ ТОГО, ЧТО ПИШУТ, К ТОМУ, ЧЕМ ЭТО ЗАКРЕПЛЕНО.
         Спецификация стояла первой и была первым, что видел пришедший в раздел
         «Язык». Она не введение: это контракт на 1967 строк, где рядом с формой
         СНЯТО 2026-08-31 строк flang/SPEC.md = 1967
         языка лежат замеры кадров стека и разбор того, что обещала прежняя
         редакция таблицы. Читателю, который пришёл писать, раньше неё нужны
         операции и словарь; спецификация нужна ему потом — и стоит теперь
         потом. */
      /* Справочник стоит ПЕРВЫМ в разделе. Раздел открывался «Операциями», а те
         отвечают на вопрос «у меня список, нужна сумма без повторов — чем»:
         вопрос второй по счёту. Первый — «какие вообще есть конструкции и как
         они пишутся», и до этой страницы отвечать на него было нечем: ни одна
         страница сайта не перечисляла формы языка подряд. */
      { адрес: 'language.html', имя: 'Справочник конструкций', из: 'docs/site/language.ru.md' },
      /* Справочник библиотеки стоит сразу за справочником конструкций: первый
         отвечает «как это пишется», второй — «что уже написано и как это
         позвать». До него ни одна страница сайта не перечисляла модули
         библиотеки и их функции, и узнать о них можно было только чтением
         исходников. */
      { адрес: 'stdlib.html', имя: 'Справочник библиотеки', из: 'docs/site/stdlib.ru.md' },
      /* Спеки стоят в «Языке», а не в «Доказательствах»: это способ ПИСАТЬ
         правило, а не отчёт о том, что доказано. Страницы про fspec не было
         вовсе — раздел жил только в дереве, и пришедший на сайт о нём не узнавал. */
      /* Справочник команд стоит сразу за справочником конструкций: написав файл,
         разработчик первым делом ищет, чем его проверить и чем напечатать. До этой
         страницы ключи двенадцати команд лежали обрывками по всему сайту. */
      { адрес: 'cli.html', имя: 'Справочник команд', из: 'docs/site/cli.ru.md' },
      { адрес: 'fspec.html', имя: 'Спеки: доказанное правило', из: 'docs/site/fspec.ru.md' },
      { адрес: 'operations.html', имя: 'Операции языка', из: 'docs/site/operations.ru.md' },
      /* Страница, которую открывают в панике: компилятор отказал кодом
         «FLANG_…», и разработчику нужно одно — что это значит и что делать.
         Стоит рядом со справочником конструкций, потому что ищут её так же:
         по слову, а не чтением подряд. */
      { адрес: 'diagnostics.html', имя: 'Справочник отказов', из: 'docs/site/diagnostics.ru.md' },
      // Печатается из таблицы поверхностей языка. Руками не править — затрёт
      // сборка; сторож свежести — `glossary --check`.
      { адрес: 'glossary.html', имя: 'Словарь языка', из: 'docs/glossary.md' },
      { адрес: 'surfaces.html', имя: 'Четыре поверхности записи', из: 'docs/surfaces.md' },
      { адрес: 'packages.html', имя: 'Как писать пакеты', из: 'docs/site/packages.ru.md' },
      // Встраивание стоит ПОСЛЕ пакетов и ДО спецификации намеренно: пакет —
      // это как собрать библиотеку на flang, встраивание — как отдать её
      // программе на чужом языке. Второй вопрос задаётся только после первого,
      // а спецификация нужна обоим потом.
      { адрес: 'embedding.html', имя: 'Как встроить flang в чужую программу', из: 'docs/site/embedding.ru.md' },
    ],
  },
  {
    /* ЧТО ЯЗЫК УМЕЕТ. Раздела не было вовсе, и три работающие вещи — разговор с
       базой, процессы с надзором и категорная поверхность — не имели на сайте
       ни одной читательской страницы: про базу и процессы не говорилось нигде,
       а категорная поверхность стояла в меню черновиком контракта на полторы
       тысячи строк. Здесь про каждую сказано одно и то же по порядку: что это,
       как прогнать, где граница. */
    имя: 'Что язык умеет', англ: 'What the language can do',
    страницы: [
      /* КАТАЛОГ ПРИМЕРОВ СТОИТ ПЕРВЫМ, и стоит он здесь, а не в «Начале».
         Это не дорожка новичка — дорожка называется «Как учить язык дальше», и
         примеры в ней четвёртый шаг. Это перечень того, что на языке уже
         написано: пятнадцать наборов и один проект, с числом файлов у каждого.
         Отвечает он ровно на вопрос этого раздела — «а что на нём вообще
         пишут». Содержимое переехало из `examples/README.md`, где лежало
         русским текстом в файле с английским именем. */
      { адрес: 'examples.html', имя: 'Каталог примеров', из: 'docs/site/examples.ru.md' },
      { адрес: 'database.html', имя: 'Базы данных', из: 'docs/site/database.ru.md' },
      { адрес: 'processes.html', имя: 'Процессы, надзор, распределённость', из: 'docs/site/processes.ru.md' },
      { адрес: 'categories.html', имя: 'Категорная поверхность', из: 'docs/site/categories.ru.md' },
      /* ДВЕ ПРОГРАММЫ, РАЗОБРАННЫЕ ЦЕЛИКОМ. Соседи по разделу говорят, что
         язык умеет; эти две показывают, чего это стоило на живом коде — с
         ведомостью доказательства, весом вкладки и поимённым перечнем того,
         что упёрлось. Обе переехали из README каталогов: `shortener` собран из
         двух половин сразу (`web/shortener/README.md` — клиент,
         `examples/web/shortener/README.md` — служба), потому что половины
         описывали одну демонстрацию и повторяли друг друга;
         `browser-app` — из `web/app/README.md`. */
      { адрес: 'shortener.html', имя: 'Сокращатель ссылок: служба и клиент', из: 'docs/site/shortener.ru.md' },
      { адрес: 'browser-app.html', имя: 'Приложение в браузере', из: 'docs/site/browser-app.ru.md' },
    ],
  },
  {
    имя: 'Доказательства', англ: 'Proofs',
    страницы: [
      /* СТОИТ ПЕРВОЙ, и это не вкус. Раздел открывался страницей «зачем и как»,
         то есть объяснением приёма, а первый вопрос к языку, который называет
         себя доказуемым, другой: что именно доказано и чего не доказано. До
         этой страницы отвечать на него было нечем — граница между доказанным,
         прогнанным по значениям и просто объявленным лежала кусками по разным
         страницам, а половина «не доказано» не была написана вовсе. */
      { адрес: 'what-is-proved.html', имя: 'Что доказано, а что нет', из: 'docs/site/what-is-proved.ru.md' },
      /* СТОИТ ВТОРОЙ, сразу за «что доказано». Первый вопрос к доказуемому
         языку — что доказано; второй задаёт уже тот, кто сел писать: ядро
         отказало, и непонятно, ошибка это в моей теореме или язык такого не
         умеет. Отвечать на него было нечем ни одной страницей: коды отказов
         ядра не названы ни на сайте, ни в разделе ДИАГНОСТИКА руководства, куда
         за «полным списком» отсылал учебник. Тринадцать имён, и у каждого
         сказано, чинится оно теоремой или упирается в предел. */
      { адрес: 'proof-refused.html', имя: 'Ядро отказало: чья это ошибка', из: 'docs/site/proof-refused.ru.md' },
      /* СТОИТ ТРЕТЬИМ, сразу за «ядро отказало». Та страница отвечает на крик
         кодом, эта — на случай тише и обиднее: замечаний нет, код возврата
         ноль, а обещание стоит сеткой, то есть не доказано. Отвечать на «какую
         же запись ядро возьмёт» было нечем ни одной страницей: правила ядра
         описаны со стороны ядра, а не со стороны того, кто пишет обещание.
         Семь форм, и про каждую сказано прогоном, берётся она или нет; числа
         сняты 23 августа 2026 на стандартной библиотеке. */
      { адрес: 'kak-dokazat.html', имя: 'Какие обещания ядро берёт', из: 'docs/site/kak-dokazat.ru.md' },
      /* СТОИТ ЧЕТВЁРТЫМ, сразу за «какими обещаниями ядро берёт». Та страница
         говорит про формы записи вообще; эта — единственная, где те же правила
         приложены к чужой мерке: сорок пять классических лемм, выписанных
         дословно из исходников Coq (тег V8.19.2) и Lean/Mathlib4, переписанных
         на flang и прогнанных поимённо. Читателю, пришедшему из Coq или Lean,
         первый вопрос — «а моё-то возьмётся», и отвечать на него было нечем.
         Числа в ней сняты прогоном, и недоказанным названа причина: шесть
         причин на двадцать девять лемм. */
      { адрес: 'matematika.html', имя: 'Классика Coq и Lean: что берёт ядро', из: 'docs/site/matematika.ru.md' },
      { адрес: 'proofs.html', имя: 'Зачем и как', из: 'docs/site/proofs.ru.md' },
      /* Страница про службу для помощника стоит в «Доказательствах», а не в
         «Начале»: она не про то, как начать, а про то, что отвечает
         `flang --mcp-mode` и как это прописать помощнику. */
      { адрес: 'dlya-ii.html', имя: 'Служба для ИИ-помощника', из: 'docs/site/dlya-ii.ru.md' },
      { адрес: 'case-studies.html', имя: 'Разбор: 82 задачи с leetcode', из: 'docs/site/case-studies.ru.md' },
    ],
  },
  {
    имя: 'Почему так', англ: 'Why this way',
    страницы: [
      { адрес: 'single-source.html', имя: 'Один источник правды', из: 'docs/guide/single-source.ru.md' },
      { адрес: 'totality.html', имя: 'Что даёт признак «тотальная»', из: 'docs/guide/totality.ru.md' },
      // «Неподвижная точка» — наше внутреннее слово, и в меню оно ничего не
      // говорит. Имя пункта названо тем, что за ним стоит: компилятор,
      // написанный на самом flang, печатает сам себя без единого расхождения.
      /* СТРАНИЦА ПЕРЕЕХАЛА И ПЕРЕИМЕНОВАНА. Называлась «Две реализации и сверка
         их между собой», и обе половины этого имени перестали быть правдой:
         реализация одна, сверять её не с чем. То, что от страницы осталось
         правдой и стало главным, — круг раскрутки: компилятор печатает сам
         себя, и второй двоичный обязан совпасть с первым байт в байт. Прежний
         адрес не потерян: он в ПЕРЕЕЗДАХ. */
      { адрес: 'bootstrap-circle.html', имя: 'Круг раскрутки: компилятор собирает сам себя', из: 'docs/guide/bootstrap-circle.ru.md' },
      { адрес: 'developing.html', имя: 'Развитие языка', из: 'docs/guide/developing.ru.md' },
      { адрес: 'limits.html', имя: 'Известные ограничения', из: 'docs/guide/limits.ru.md' },
    ],
  },
  {
    /* КОНТРАКТЫ ПОВЕРХНОСТЕЙ СТОЯТ ЗА ДВЕРЬЮ УЧАСТНИКОВ, и вот довод.
       Раздел «Категорная поверхность» стоял в меню новичка, а первая страница
       за ним первой же своей строкой называла себя черновиком на согласование.
       Черновику на витрине не место — и не потому, что он плох, а потому, что
       читатель приходит за тем, чем можно пользоваться, и не обязан отличать
       принятое решение от обсуждаемого.
       Черновика больше нет: страница переписана и называет себя тем, что она
       есть, — контрактом поверхности для того, кто язык переносит или судит.
       Место её всё равно здесь: рядом с правилом языка в ней лежат коды
       диагностик, разбор отвергнутых редакций и поимённый список того, чего
       двоичный компилятор не проверяет. Тот же жанр у контракта процессов.
       Ни один из них не выброшен и адреса не сменил. Читателю про то же самое
       отвечают «Категорная поверхность» и «Процессы, надзор,
       распределённость» в разделе «Что язык умеет». */
    имя: 'Контракты поверхностей', англ: 'Surface contracts', дляУчастников: true,
    страницы: [
      /* СПЕЦИФИКАЦИЯ ЯДРА ПЕРЕЕХАЛА СЮДА ИЗ РАЗДЕЛА «ДОКАЗАТЕЛЬСТВА», где стояла
         третьим пунктом — на дорожке читателя. Жанр у неё тот же, что у трёх
         соседей по этому разделу: контракт на 4658 строк, где рядом с правилом
         СНЯТО 2026-08-31 строк flang/proof/SPEC.md = 4658
         ядра стоят пути к файлам реализации, имена проверок и разбор
         отвергнутых редакций. Читателю на тот же вопрос отвечают «Что доказано,
         а что нет» и «Зачем и как». Адрес не сменился. */
      { адрес: 'spec-proof.html', имя: 'Ядро доказательств — контракт', из: 'flang/proof/SPEC.md' },
      { адрес: 'spec-cat.html', имя: 'Категории и функторы — контракт', из: 'flang/cat/SPEC.md' },
      { адрес: 'spec-conc.html', имя: 'Процессы и отказоустойчивость — контракт', из: 'flang/conc/SPEC.md' },
      /* Спецификация языка стояла в разделе «Язык» последним пунктом и читалась
         как справка для пишущего. Это не справка: контракт на 1967 строк, где
         СНЯТО 2026-08-31 строк flang/SPEC.md = 1967
         рядом с формой языка лежат замеры кадров стека, разбор того, что
         обещала прежняя редакция таблицы, и раздел «Слои реализации» с прямой
         пометкой «для тех, кто развивает сам язык». Жанр рабочего документа, а
         не витрины; на витрине его место заняли «Справочник конструкций» и
         «Операции языка», которые ровно для читателя и написаны. */
      { адрес: 'spec.html', имя: 'Спецификация языка — контракт', из: 'flang/SPEC.md' },
    ],
  },
  {
    /* ВНУТРЕННЕЕ. Раздел стоял первым уровнем меню, и открывший сайт впервые
       упирался в отчёты о том, во сколько раз мы медленнее Python и сколько
       памяти держит арена. Это ценные документы — но для того, кто ДЕЛАЕТ
       язык, а не для того, кто его пробует. Читатель владельца сказал об этом
       прямо: «нейрослоп про какое-то исследование».
       Страницы никуда не делись и адресов не сменили: они собраны за одной
       дверью — `contributing.html`. */
    имя: 'Замеры', англ: 'Measurements', дляУчастников: true,
    страницы: [
      { адрес: 'benchmark-speed.html', имя: 'Скорость против Python и Node', из: 'docs/benchmark-speed.md' },
      { адрес: 'benchmark-proof-cost.html', имя: 'Цена доказательства против тестов', из: 'docs/benchmark-proof-cost.md' },
      /* ВТОРОЙ ЗАМЕР ТОЙ ЖЕ РАБОТЫ, и он не был опубликован вовсе. Сайт печатал
         первый замер («0 из 20»), а страницы про доказательства уже говорили
         «2 из 20» — по второму. Читатель, пошедший за подтверждением, попадал
         на отчёт, который этих чисел не содержит. Оба замера стоят рядом:
         движение видно только по паре. */
      { адрес: 'benchmark-proof-cost-2.html', имя: 'Цена доказательства, второй замер', из: 'docs/benchmark-proof-cost-2.md' },
      { адрес: 'benchmark-processes.html', имя: 'Сколько процессов тянет планировщик', из: 'docs/scheduler-benchmark.md' },
      { адрес: 'memory.html', имя: 'Память и области', из: 'docs/memory-and-regions.md' },
      { адрес: 'modules.html', имя: 'Модульность и пакеты', из: 'docs/modularity-and-packages.md' },
      { адрес: 'wasm.html', имя: 'WebAssembly через C', из: 'docs/wasm-via-c.md' },
    ],
  },
  {
    /* РАЗДЕЛ ПЕРЕЕХАЛ СО ВТОРОГО МЕСТА В КОНЕЦ, и довод, стоявший здесь раньше
       («заходящий второй раз ищет, что приехало с прошлого раза»), отменён не
       вкусом, а чтением самих страниц. Обе печатаются из тем вливаний, а темы
       здесь пишутся для команды: «Слияние work/stdlib-json-time: json и
       datetime влиты поверх правки затенения». Для команды это правильно, для
       второго пункта меню публичного сайта — нет: пришедший впервые упирается
       в него раньше, чем в раздел «Язык».
       Что на этом месте стоит у соседей — заметки к ВЫПУСКАМ, сгруппированные
       по тегам. Теперь такая печать есть: `flang io scripts/releases-page.flang`
       печатает страницу «Выпуски» из тегов `vX.Y.Z` и заметок
       `docs/release-notes.json`, и она стоит вторым пунктом. Журналы остались
       здесь — их читают те, кто развивает язык. */
    // Node, npm и пути к скриптам законны ЗДЕСЬ и только здесь. На страницах,
    // обращённых к читателю языка, всё делается командой `flang`: читатель
    // ставит язык, а не чинит его сборку.
    имя: 'Тем, кто развивает язык', англ: 'For contributors', дляУчастников: true,
    страницы: [
      // ДВЕРЬ. Единственная страница этой половины сайта, которую видно из
      // бокового меню новичка: одна строка внизу, а не восемь разделов.
      // Всё остальное внутреннее достижимо ссылками отсюда, и сборка эти
      // ссылки проверяет так же, как все прочие.
      { адрес: 'contributing.html', имя: 'Тем, кто делает язык', из: 'docs/site/contributing.ru.md' },
      /* ОТЧЁТ ПЕРЕЕХАЛ ИЗ РАЗДЕЛА «ДОКАЗАТЕЛЬСТВА», где стоял четвёртым пунктом,
         то есть на дорожке читателя. Читать там его нечем: это рабочий отчёт по
         дереву, где через строку стоят пути к файлам реализации, имена проверок
         и разбор того, что во что перенесено. Читателю на тот же вопрос отвечает
         «Что доказано, а что нет» — она написана для него и числа берёт прогоном.
         Адрес не сменился: внешняя ссылка на `overview.html` работает. */
      { адрес: 'overview.html', имя: 'Отчёт о доказательствах по дереву', из: 'docs/overview.ru.md' },
      { адрес: 'project-layout.html', имя: 'Раскладка репозитория', из: 'docs/guide/project-layout.ru.md' },
      // `печатается` снимает требование английской пары. Перевод печатаемой
      // страницы обязан приходить из печати, а не от переводчика: руками его
      // затрёт первый же `node scripts/build-changelog-page.mjs`. Освобождение,
      // названное в карте, честнее молчаливой дыры в стороже.
      { адрес: 'changelog.html', имя: 'Журнал вливаний', из: 'docs/site/changelog.md', печатается: true },
      { адрес: 'journal.html', имя: 'Журнал коммитов', из: 'CHANGELOG.md' },
    ],
  },
];

/** Каталог базы знаний. Страницы оттуда собираются сами, по файлам. */
export const БАЗА_ЗНАНИЙ = {
  // `дляУчастников` — то же, что у разделов: группа не стоит в меню новичка, а
  // открывается за дверью `contributing.html`. Заметки — рабочие записи о том,
  // что измерено и какой путь отвергнут; читателю языка они не нужны, а
  // участнику и агенту нужны обязательно, поэтому не выброшены, а убраны.
  дляУчастников: true,
  каталог: 'docs/zettel',
  указатель: 'docs/zettel/README.md',
  адресУказателя: 'knowledge.html',
  имяРаздела: 'База знаний',
  // Имя страницы заметки: knowledge-<слаг>.html. Так же их называет markdown.mjs
  // при разборе ссылок [[слаг]] — если менять, менять в обоих местах.
  адресЗаметки: (слаг) => `knowledge-${слаг}.html`,
};

/**
 * Переезды: старый адрес → новый.
 *
 * 17 августа 2026 страницы переименованы из транслита в английские слова
 * (`nachalo.html` → `getting-started.html`). Внешняя ссылка на старый адрес
 * ломается навсегда, и починить её мы не можем — она в чужой закладке, в чужом
 * письме, в чужом посте. Поэтому по каждому старому адресу лежит страница в
 * одну строку, уводящая на новый. Стоит она байты, а теряется без неё читатель.
 *
 * Список закрыт: сюда попадают только адреса, которые уже были опубликованы.
 * Новая страница переезда не заводит — ей неоткуда переезжать.
 */
export const ПЕРЕЕЗДЫ = {
  'nachalo.html': 'getting-started.html',
  'izmeneniya.html': 'releases.html',
  'zhurnal.html': 'journal.html',
  'dokazatelstva.html': 'proofs.html',
  'obzor.html': 'overview.html',
  'odin-istochnik.html': 'single-source.html',
  'totalnost.html': 'totality.html',
  'dve-realizacii.html': 'bootstrap-circle.html',
  'two-implementations.html': 'bootstrap-circle.html',
  'razvitie.html': 'developing.html',
  'ogranicheniya.html': 'limits.html',
  'raskladka.html': 'project-layout.html',
  'zamer-skorosti.html': 'benchmark-speed.html',
  'zamer-tseny.html': 'benchmark-proof-cost.html',
  'zamer-processov.html': 'benchmark-processes.html',
  'pamyat.html': 'memory.html',
  'moduli.html': 'modules.html',
  'znanie.html': 'knowledge.html',
  // Страница «Чем проверена установка» снята: это был журнал прогонов
  // выпуска 0.5.1, и разработчику он не нужен. Адрес был опубликован —
  // значит, по нему остаётся строка, уводящая на «Установку».
  'install-evidence.html': 'install.html',
};

/**
 * Живые примеры кода на главной. Берутся из дерева, а не переписываются.
 *
 * Раньше этот список был объявлен и не использован ни разу: код на главной был
 * НАБРАН руками, а обещание «пример из дерева» держалось на честном слове.
 * Теперь сборка вырезает названное объявление из названного файла и подставляет
 * на место метки `@@пример:КЛЮЧ@@`. Переименовали функцию или переехал файл —
 * сборка отказывает с именем, а не печатает устаревший код.
 *
 * `объявление` — имя в ёлочках без ёлочек. `ключ` — то, что стоит в метке.
 * `подпись` печатается строкой под блоком, и путь к файлу сборка дописывает
 * сама: набранный руками путь протухает молча, а этот — нет.
 */
export const ПРИМЕРЫ_НА_ГЛАВНОЙ = [
  {
    ключ: 'факториал',
    файл: 'examples/rosetta/factorial.flang',
    объявление: 'Факториал',
    подпись: 'Взято из дерева целиком, знак в знак —',
  },
  {
    ключ: 'factorial',
    файл: 'examples/rosetta/factorial-english.flang',
    объявление: 'Factorial',
    подпись: 'Taken from the tree verbatim —',
  },
  /* Сборка сообщения протокола PostgreSQL. Пример выбран не за красоту: на нём
     разом видно постусловие с именем, пример внутри функции и то, что вся
     работа с байтами — обычная тотальная функция. Русская и английская записи
     ссылаются на ОДНО объявление: английской поверхности у этого модуля нет, и
     выдумывать вторую копию значило бы завести расхождение на пустом месте. */
  {
    ключ: 'простой-запрос',
    файл: 'flang/stdlib/postgres.flang',
    объявление: 'Простой запрос',
    подпись: 'Взято из дерева целиком, знак в знак —',
  },
  {
    ключ: 'simple-query',
    файл: 'flang/stdlib/postgres.flang',
    объявление: 'Простой запрос',
    подпись: 'Taken from the tree verbatim —',
  },
];

/**
 * Переезды страниц базы знаний: старый адрес `znanie-<транслит>.html` → новый
 * `knowledge-<английские слова>.html`. Заполняется вместе с переименованием
 * заметок; пустой список законен — значит, ничего ещё не переезжало.
 */
export const ПЕРЕЕЗДЫ_ЗАМЕТОК = {
  "znanie-adresatsiya-po-soderzhimomu.html": "knowledge-content-addressing.html",
  "znanie-arena-ne-otdayot.html": "knowledge-arena-never-releases.html",
  "znanie-beam-ne-obkhodit-os.html": "knowledge-beam-does-not-bypass-the-os.html",
  "znanie-beskonechnost-zakonna-bez-vychitaniya.html": "knowledge-infinity-is-legal-without-subtraction.html",
  "znanie-bliznec-otstayot-ot-uehavshego-etalona.html": "knowledge-twin-lags-behind-the-reference.html",
  "znanie-bytovaya-sverka.html": "knowledge-byte-for-byte-comparison.html",
  "znanie-chetyre-kuska-javascript.html": "knowledge-four-pieces-of-javascript.html",
  "znanie-chisla-kak-kategoriya.html": "knowledge-numbers-as-a-category.html",
  "znanie-chislo-bez-nazvannogo-izmeritelya.html": "knowledge-a-number-without-a-named-measure.html",
  "znanie-chistota-ne-znachit-bez-pamyati.html": "knowledge-purity-is-not-zero-allocation.html",
  "znanie-chto-daet-bolshe-vsego-za-menshuyu-rabotu.html": "knowledge-biggest-win-for-least-work.html",
  "znanie-chto-otlozheno.html": "knowledge-what-is-deferred.html",
  "znanie-chto-vhodit-v-hash.html": "knowledge-what-goes-into-the-hash.html",
  "znanie-dlya-raket-pamyat-zapreshchena.html": "knowledge-safety-standards-ban-dynamic-memory.html",
  "znanie-dokazano-ne-znachit-pravilno.html": "knowledge-proven-is-not-correct.html",
  "znanie-dolg-na-neslitoy-vetke.html": "knowledge-debt-closed-on-an-unmerged-branch.html",
  "znanie-dva-proekta-svyazany-generatorami.html": "knowledge-two-projects-tied-by-generators.html",
  "znanie-dva-yadra-ne-slivayutsya-tekstom.html": "knowledge-two-cores-do-not-merge-as-text.html",
  "znanie-flag-lto-uskoryaet-i-sborku.html": "knowledge-lto-speeds-up-the-build-too.html",
  "znanie-formy-tela-uzkoe-mesto-pereehalo.html": "knowledge-bottleneck-moved-to-claim-shape.html",
  "znanie-hash-vnutri-imena-snaruzhi.html": "knowledge-hash-inside-names-outside.html",
  "znanie-igry-i-video-ne-nash-sluchay.html": "knowledge-games-and-video-are-not-our-case.html",
  "znanie-imena-a-ne-hashi.html": "knowledge-names-not-hashes.html",
  "znanie-induktsii-net-u-vstroennykh-tipov.html": "knowledge-no-induction-for-builtin-types.html",
  "znanie-invariant-processa-eto-postuslovie-obrabotchika.html": "knowledge-process-invariant-is-a-handler-postcondition.html",
  "znanie-izyatie.html": "knowledge-a-removal-must-turn-a-test-red.html",
  "znanie-komanda-otvechaet-provereno-ne-proveriv.html": "knowledge-checked-without-checking.html",
  "znanie-kontrolnaya-summa-v-zamere.html": "knowledge-checksum-inside-the-benchmark.html",
  "znanie-levaya-svyortka-ne-daet-induktsii-po-spisku.html": "knowledge-left-fold-gives-no-list-induction.html",
  "znanie-medlennee-python-v-1-4.html": "knowledge-slower-than-python-by-1-4.html",
  "znanie-minus-nol-klass.html": "knowledge-minus-zero-is-a-class.html",
  "znanie-nan-dostizhim.html": "knowledge-nan-is-reachable.html",
  "znanie-net-porodit.html": "knowledge-no-spawn-in-two-targets.html",
  "znanie-net-storozhevoy-stranitsy-v-wasm.html": "knowledge-no-guard-page-in-wasm.html",
  "znanie-nevyskazyvaemoe-dorozhe.html": "knowledge-unstatable-costs-more-than-unprovable.html",
  "znanie-ne-vyvod-regionov.html": "knowledge-region-inference-misses-the-point.html",
  "znanie-nol-aksiom.html": "knowledge-zero-axioms.html",
  "znanie-otritsatelnyy-rezultat-tsenen.html": "knowledge-a-measured-zero-is-valuable.html",
  "znanie-pamyat-na-kategoriyu-eto-regiony.html": "knowledge-memory-per-category-is-regions.html",
  "znanie-peredacha-sostoyaniya.html": "knowledge-handoff-goes-in-a-file.html",
  "znanie-perenos-fayla-tiho-vyklyuchaet-storozha.html": "knowledge-renaming-a-file-silently-disables-the-guard.html",
  "znanie-pervyy-zakon-krasneyushchiy-na-chestnoy-programme.html": "knowledge-natural-transformation-catches-what-nothing-else-does.html",
  "znanie-pisat-prostym-yazykom.html": "knowledge-write-in-plain-language.html",
  "znanie-planirovshchik-desyatki-tysyach.html": "knowledge-scheduler-holds-a-million-processes.html",
  "znanie-plavayushchaya-tochka.html": "knowledge-floating-point-bits-are-exact.html",
  "znanie-poisk-ne-imeet-prava-verit.html": "knowledge-proof-search-must-trust-nothing.html",
  "znanie-pokoy-ne-otlichaetsya-ot-tupika.html": "knowledge-quiescence-hides-deadlock.html",
  "znanie-pole-otmyvalo-znachenie.html": "knowledge-a-record-field-laundered-a-value.html",
  "znanie-postuslovie-obrabotchika-mimo-zamknutogo-mnozhestva.html": "knowledge-handler-postcondition-escapes-the-closed-set.html",
  "znanie-pribor-vral-a-ne-predmet.html": "knowledge-the-instrument-lied-not-the-subject.html",
  "znanie-proverki-perestayushchie-sravnivat.html": "knowledge-checks-that-stopped-comparing.html",
  "znanie-razbor-gugla.html": "knowledge-what-the-popular-stories-get-wrong.html",
  "znanie-resheniya-vladeltsa.html": "knowledge-owner-decisions.html",
  "znanie-sila-coq-v-lemmakh.html": "knowledge-coq-strength-is-in-its-lemmas.html",
  "znanie-slovar-mezhdu-spekami-byl-nemym.html": "knowledge-the-dictionary-between-specs-was-mute.html",
  "znanie-snyataya-proverka-tipa-eto-ne-otkaz.html": "knowledge-a-dropped-type-check-gives-a-wrong-answer.html",
  "znanie-spisok-rukami-perezhivaet-derevo.html": "knowledge-a-hand-written-list-outlives-the-tree.html",
  "znanie-ssylka-lomaetsya-pri-kopirovanii.html": "knowledge-relative-links-break-on-copy.html",
  "znanie-sverka-ne-vidit-tozhdestva-obektov.html": "knowledge-byte-comparison-misses-object-identity.html",
  "znanie-svoy-generator-mashinnogo-koda.html": "knowledge-our-own-machine-code-generator.html",
  "znanie-svyaz-moduley-i-perevod-dannyh.html": "knowledge-module-links-need-a-named-data-translation.html",
  "znanie-tavtologiya-zakryvaetsya-darom.html": "knowledge-tautologies-close-for-free.html",
  "znanie-teorkat-perenosit-pravdu.html": "knowledge-category-theory-transports-truth.html",
  "znanie-tikhie-konflikty-sliyaniya.html": "knowledge-silent-merge-conflicts.html",
  "znanie-tip-uzla-otdayotsya-otmetkoy.html": "knowledge-type-inference-answers-with-a-node-mark.html",
  "znanie-tochno-v-kakoy-sisteme.html": "knowledge-exact-in-which-base.html",
  "znanie-tochnye-drobi-besplatny.html": "knowledge-exact-decimals-are-free.html",
  "znanie-tri-tipa-chisel.html": "knowledge-three-number-types.html",
  "znanie-tsel-yazyka.html": "knowledge-goal-of-the-language.html",
  "znanie-tsena-dokazatelstva-0-iz-20.html": "knowledge-proof-cost-0-of-20.html",
  "znanie-tsena-dokazuemosti-2-5-protsenta.html": "knowledge-provability-costs-2-5-percent.html",
  "znanie-u-double-net-zakonov.html": "knowledge-double-has-no-laws.html",
  "znanie-unison-izmeren.html": "knowledge-unison-measured.html",
  "znanie-uslovie-revolyutsii.html": "knowledge-condition-for-the-revolution.html",
  "znanie-usloviya-esli-dali-nol.html": "knowledge-reading-if-conditions-closed-zero-goals.html",
  "znanie-uzkoe-mesto-ne-v-avtomatike.html": "knowledge-the-bottleneck-is-rule-strength.html",
  "znanie-uzkoe-mesto-pereehalo-na-formu-tela.html": "knowledge-bottleneck-moved-to-body-shape.html",
  "znanie-vtoruyu-realizatsiyu-vozmestit-nechem.html": "knowledge-the-second-implementation-cannot-be-replaced.html",
  "znanie-wasm-cherez-c-besplatno.html": "knowledge-wasm-via-c-is-free.html",
  "znanie-yadro-dokazalo-lozh.html": "knowledge-the-core-proved-a-falsehood.html",
  "znanie-yadro-prinimaet-lozh-klass.html": "knowledge-the-core-accepts-falsehood-a-class.html",
  "znanie-z3-orakul-a-ne-sudya.html": "knowledge-z3-as-oracle-not-judge.html",
  "znanie-zamknutuyu-tsel-nado-schitat.html": "knowledge-closed-goals-must-be-computed.html",
  "znanie-zamorozhennyy-etalon.html": "knowledge-a-frozen-reference-changes-the-check.html",
};
