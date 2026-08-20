# Цеттелькастен flang

База знаний проекта. Здесь лежит **не то, что сделано** — это говорит история
коммитов, — а **почему решили так**: что померили, что оказалось ложным, какие
пути отвергли и по какому доводу.

Проверка на годность заметки: она отвечает на вопрос, который **встанет снова**.

## Как пользоваться

Заголовок каждой заметки — **утверждение**, а не тема. Читать можно с любой:
ссылки `[[слаг]]` ведут к соседям, и через два-три перехода собирается вся линия
рассуждения.

Если ищете конкретное — смотрите группы ниже. Если хотите понять проект с нуля —
начните с [цели](goal-of-the-language.md) и идите по ссылкам.

## Цель и рамки

- [Цель flang — доказуемость, доступная обычному программисту](goal-of-the-language.md)
- [Из восьми целей печати важна только C, остальное отложено](what-is-deferred.md)
- [Революция наступит ровно тогда, когда доказательство станет дешевле тестов](condition-for-the-revolution.md)
- [Разрыв между «доказано» и «правильно» — это спецификация](proven-is-not-correct.md)
- [Развилки, которые владелец выбрал сам](owner-decisions.md)
- [Отчёты пишутся простым инженерным языком, без проектного жаргона](write-in-plain-language.md)
- [Восемь десятых внутренних слов на сайте приходятся на одну печатаемую страницу, а не на прозу](most-site-jargon-comes-from-one-printed-page.md)

## Числа

- [Биты плавающей точки точны; неточен перевод десятичной записи в двоичную](floating-point-bits-are-exact.md)
- [Вопрос не «точно или приблизительно», а «точно в какой системе счисления»](exact-in-which-base.md)
- [Точные десятичные стоят ноль, а не в сто раз дороже](exact-decimals-are-free.md)
- [Языку нужны три типа чисел с разными гарантиями](three-number-types.md)
- [У double ломается ассоциативность, а равенство даже не рефлексивно](double-has-no-laws.md)
- [Бесконечность становится законной, если убрать вычитание](infinity-is-legal-without-subtraction.md)
- [Числа описываются категорией, но категория не вычисляет](numbers-as-a-category.md)
- [Счётчик типа `нат` внутри записи написать нельзя, и это меняет устройство программы](nat-counter-in-a-record-is-unwritable.md)
- [`нат` в объявлении снимает отказ по целости, но почти не добавляет доказанных мест](nat-v-obyavlenii-snimaet-celost-no-ne-granicy.md)

## Доказательства
- [Отметка слоя типов в дерево не выезжает: места проверок считаются только внутри компилятора, снаружи выйдет на 56 % больше](otmetka-sloya-tipov-ne-vyezzhaet-v-derevo-poetomu-schitat-mozhno-tolko-vnutri.md)
- [Точный шаг по `нат` доказывает только прямую рекурсию: цикл через три функции ядро отвергает](tochnyy-shag-dokazyvaet-tolko-pryamuyu-rekursiyu.md)

- [Узкое место прувера — сила правил, а не ненаписанные доказательства](the-bottleneck-is-rule-strength.md)
- [Невысказываемое утверждение дороже недоказуемого](unstatable-costs-more-than-unprovable.md)
- [Сила Coq не в ядре, а в библиотеке доказанных лемм](coq-strength-is-in-its-lemmas.md)
- [Поиск доказательства не должен ничему верить](proof-search-must-trust-nothing.md)
- [Ноль аксиом — проверяемое свойство, а не лозунг](zero-axioms.md)
- [Цена доказательства измерена: 0 из 20, и тесты нашли четыре ошибки против нуля](proof-cost-0-of-20.md)
- [Принципа индукции нет ни у одного встроенного типа](no-induction-for-builtin-types.md)
- [Узкое место переехало: принцип индукции появился, а цепляться ему не за что](bottleneck-moved-to-body-shape.md)
- [Тавтология закрывается даром, поэтому число «доказано без теоремы» само по себе ничего не значит](tautologies-close-for-free.md)
- [Форма, которую разбор уже отвергает, — самое дешёвое место для нового синтаксиса, и цена измерена](occupy-a-form-the-parser-already-rejects.md)
- [Новая форма языка, не доехавшая до генераторов кода, расходится с типами молча](a-language-form-must-reach-code-generation.md)

- [Замкнутую цель надо считать, а не выводить](closed-goals-must-be-computed.md)
- [Узкое место переехало третий раз: мешает форма утверждения, а не форма тела](bottleneck-moved-to-claim-shape.md)
- [Правило неотрицательности читает объявленное имя, но не вызов и не поле — и на этом обрывается цепочка лемм](rule-one-does-not-read-calls-and-fields.md)
- [Постусловие вызванной функции годится ядру в факты только ПОСЛЕ того, как оно доказано, — и этим же закрыт круг](callee-postcondition-is-a-fact-only-after-it-is-proved.md)
- [Файл, записанный на четырёх поверхностях, доказательство нести не может](proof-words-live-on-two-surfaces-of-four.md)
- [Свёртка в flang левая, и индукцию по списку к ней прицепить нельзя](left-fold-gives-no-list-induction.md)
- [Две трети того, что ядро не берёт у библиотеки, — это сравнение длины результата с длиной входа](claims-about-length-are-two-thirds-of-what-the-kernel-refuses.md)
- [Цели «равно» упёрлись в порядок слагаемых, а не в отсутствие индукции](ravenstvo-uperlos-v-poryadok-slagaemyh-a-ne-v-indukciyu.md)
- [Перенесённое правило состоит из ТРЁХ частей: самого правила, места вызова и текста отказа](porting-a-rule-means-porting-its-refusal-text.md)
- [Вывод, снятый на одной ветке, — не вывод о дереве](vyvod-na-vetke-ne-vyvod-o-dereve.md)
- [Именная граница длины переживает вычитание положительного, но не сложение](granica-perezhivaet-vychitanie.md)
- [Правый край сравнения сам по себе не закрыл ничего: закрыла ЛЕВАЯ сторона, прочитанная как мера списка](right-edge-alone-closes-nothing.md)
- [Узкое место переехало четвёртый раз: теперь мешает индукция, которую негде объявить](what-blocks-the-kernel-now-is-induction-without-a-theorem.md)
- [Автоматическая индукция по `разбор`у закрыла 9 утверждений, а из двенадцати заказанных — 5](auto-induction-on-match-closes-nine.md)
- [Содержательное и доказуемое почти не пересекаются: 83 содержательных утверждения, 19 доказанных, общих девять](soderzhatelnoe-i-dokazuemoe-pochti-ne-peresekayutsya.md)
- [Постусловие исполняется на каждом вызове, поэтому граф вызовов между постусловиями обязан быть без петель](postusloviya-schitayutsya-pri-rabote-poetomu-ih-graf-bez-petel.md)
- [Зазор между двумя печатями в C ловится только пятиминутной сборкой, и на файлах `self/` не ловится вовсе](emitter-twin-gap-is-only-caught-by-a-five-minute-build.md)
- [Класс «обращение по номеру» упёрся в целость числа, а не в границы](klass-nomera-uperlsya-v-celost-a-ne-v-granicy.md)
- [Поле «не минус ноль» на числовом типе закрыло два места, а не одиннадцать](pole-ne-minus-nol-zakrylo-dva-mesta-a-ne-odinnadcat.md) — с поправкой: пара на flang сделана, и правило про нижнюю границу видно через вычитание
- [Пометки не хватало 293 функциям из 2242 — остальным 1949 не хватает правил](pometki-ne-hvatalo-293-iz-2242.md)
- [Два правила завершаемости поодиночке дают 54 и 74, а вместе — 574](dva-pravila-zavershaemosti-vmeste-dayut-574.md)
- [Объявить `нат` и снять проверку из напечатанного кода удаётся только там, где вызывающий уже даёт натуральное](nat-snimaet-storozha-tolko-esli-vyzyvayushchiy-uzhe-daet-naturalnoe.md)
- [Отвергнутая теорема заслоняет прямой путь](a-rejected-theorem-blocks-the-direct-path.md)
- [Допущение индукции строится по месту вызова](an-induction-hypothesis-must-be-instantiated-at-the-call-site.md)
- [Левая свёртка упирается не в индукцию, а в то, что правило свёртки не читает постусловие вызванной функции](svortka-ne-chitaet-postuslovie-vyzvannoy.md)
- [Даровое утверждение узнаётся подменой тела заглушкой: 17 из 32 в двух модулях библиотеки](darovoe-utverzhdenie-uznayotsya-podmenoy-tela-zaglushkoy.md)
- [Постусловие считается при каждом вызове и печатается в код, поэтому обход внутри него меняет порядок цены функции](postuslovie-schitaetsya-pri-kazhdom-vyzove.md)
- [Семя в `bootstrap/` отстаёт от исходников ядра: четыре вида цели против пяти](semya-bootstrap-otstayot-ot-yadra.md)

## Теория категорий

- [Теоркат переносит правду между вещами; логика устанавливает её про одну вещь](category-theory-transports-truth.md)
- [Естественное преобразование ловит ошибку, которую не видит больше ничто](natural-transformation-catches-what-nothing-else-does.md)
- [Связь двух модулей становится проверяемой ровно тогда, когда назван перевод данных](module-links-need-a-named-data-translation.md)
- [Словарь между двумя спеками разбирался целиком и не значил ничего](the-dictionary-between-specs-was-mute.md)

## Память

- [Память «на категорию» — это регионы, техника с именем](memory-per-category-is-regions.md)
- [Область памяти не отдаёт ничего до конца вызова: 1655 МиБ на сортировку 4000 чисел](arena-never-releases.md)
- [Для критичных систем стандарты запрещают динамическую память вообще](safety-standards-ban-dynamic-memory.md)
- [Чистота означает «без изменения на месте», а не «без выделения памяти»](purity-is-not-zero-allocation.md)
- [Игры и обработка видео — не наш случай, и причин ровно три](games-and-video-are-not-our-case.md)

## Скорость и цена доказуемости

- [Цена доказуемости — 2,5 % функций, а всё остальное медленно по другим причинам](provability-costs-2-5-percent.md)
- [Доля протухает молча, а счёт — нет: цена доказуемости за два дня уехала с 2,4 % на 1,1 %](a-share-goes-stale-a-count-does-not.md)
- [Мы медленнее Python в 1,4 раза, и компиляция сегодня не окупается никогда](slower-than-python-by-1-4.md)
- [Две правки дают 1,8 раза, и одна из них — две строки](biggest-win-for-least-work.md)
- [Вывод типов отдаёт доказанное отметкой на дереве, а не таблицей наружу](type-inference-answers-with-a-node-mark.md)
- [Снятая проверка типа даёт не отказ, а неверный ответ](a-dropped-type-check-gives-a-wrong-answer.md)
- [Межмодульная оптимизация ускорила не только работу, но и сборку большого файла](lto-speeds-up-the-build-too.md)
- [Сборка двоичного стоит минуту, а не час, — поэтому её место в CI на каждом пуше](sborka-dvoichnogo-stoit-minutu-a-ne-chas.md)
- [Прогон примеров при каждой проверке стоит 3 мс обычному файлу и 35 секунд двум самым большим](examples-cost-lands-on-two-files.md)
- [SHA-256 без единой битовой операции стоит 925 195 шагов интерпретатора на блок](sha256-bez-bitovyh-operaciy-stoit-925-tysyach-shagov.md)
- [Предел шагов интерпретатора решает, что вообще может быть примером](predel-shagov-interpretatora-opredelyaet-chto-mozhet-byt-primerom.md)

## Службы и долговечность

- [Чистота обработчика превращает восстановление из журнала в одну свёртку](chistota-obrabotchika-delaet-vosstanovlenie-svyortkoy.md)
- [Сокет-хозяин терял ответ ровно тогда, когда служба делала что-то между запросом и ответом](sluzhba-poluchila-pravo-podumat-mezhdu-zaprosom-i-otvetom.md)
- [Октеты в языке выразимы списком чисел, а не строкой, и решает это отсутствие «символа по коду»](oktety-v-yazyke-vyrazimy-spiskom-chisel-a-ne-strokoy.md)
- [Два исполнителя портили двоичный поток по-разному, и расхождение было не в кодировке, а в том, где каждый терял](dva-hozyaina-portili-dvoichnyy-potok-po-raznomu.md)
- [Пустая строка у «Прочитано» значит КОНЕЦ, и раскодировщик, вызванный руками, отдаёт её ещё в одном случае](pustaya-stroka-u-prochitano-znachit-konec-i-eto-lovushka-raskodirovshchika.md)
- [Открытая труба стандартного ввода — это не «ввода нет», а «ввод будет позже», и потомок ждёт до срока](otkrytaya-truba-vvoda-eto-ne-vvoda-net-a-vvod-budet-pozzhe.md)
- [Срок хозяина был не называем, и это одно держало сборку на JavaScript](srok-hozyaina-byl-ne-nazyvaem-i-eto-derzhalo-sborku-na-javascript.md)

## Процессы и конкурентность

- [BEAM не обходит операционную систему, и C зависит от неё ровно так же](beam-does-not-bypass-the-os.md)
- [Динамическое порождение процессов есть в модели и в C, а нет — у двух целей печати](no-spawn-in-two-targets.md)
- [Планировщик тянет миллион работающих процессов, а стена осталась одна из трёх — очередь готовых](scheduler-holds-a-million-processes.md)
- [Инвариант процесса пишется постусловием обработчика, и третьего рода обязательства для этого не нужно](process-invariant-is-a-handler-postcondition.md)
- [Постусловие на обработчике заводит восьмой вид отказа мимо замкнутого множества](handler-postcondition-escapes-the-closed-set.md)
- [Тупик, потерянное письмо и успешное завершение дают у прогона один и тот же исход «покой»](quiescence-hides-deadlock.md)
- [Граница мира у горячей замены проходит по пяти чужим проходам, а не по часам и сокетам](hot-swap-boundary-runs-through-five-passes-not-through-a-clock.md)
- [Кандидат на горячую замену разбирается ОТДЕЛЬНО, поэтому имена типов работающей программы в нём назвать можно, а функции её позвать нельзя](a-candidate-parses-alone-so-it-names-types-but-cannot-call-functions.md)
- [Из четырёх утверждений, которых ждут от планировщика процессов, ядро не берёт ни одного](what-a-scheduler-needs-proved.md)
- [Распределённость делится на мир и провод в отношении 459 к 119, и печатать компилятор умеет только провод](raspredelyonnost-delitsya-na-mir-i-provod.md)
- [Решение о мире переносимо, даже когда сам мир — нет: у слоя связи узла это 554 строки против 42](reshenie-o-mire-perenosimo-a-mir-net.md)
- [Узел нельзя написать обычной программой на flang, и мешает этому одна строка проверки типов](uzel-ne-pishetsya-obychnoy-programmoy-iz-za-literalnogo-adresata.md)
- [Планировщик узла переносим: из 224 строк мира в нём пять, а решений 219 — и они печатаются во все восемь целей](planirovshchik-uzla-perenosim-219-resheniy-iz-224-strok.md)
- [Груз письма едет билетом, а не значением, — и этим отсутствие полиморфизма перестаёт мешать](gruz-pisma-edet-biletom-a-ne-znacheniem.md)
- [JSON в стандартной библиотеке снижает МИР хозяина, а не его РАЗМЕР](json-v-stdlib-snizhaet-mir-a-ne-razmer.md)
- [Рукописный хозяин живёт по правилам напечатанного проекта, а не по своим](ruchnoy-hozyain-zhivyot-po-pravilam-napechatannogo-proekta.md)
- [Воспроизводимость по семени кончается ровно на границе узла](seme-uporyadochivaet-tolko-vnutri-uzla.md)
- [«Число» на входной границе напечатанной программы уже, чем «число» внутри языка](chislo-na-vhodnoy-granice-uzhe-chem-v-yazyke.md)
- [Правило «это не отказ» без срока — не осторожность, а поломка](pravilo-eto-ne-otkaz-obyazano-imet-srok.md)
- [Когда свидетеля не отдают наружу, эталон сверяют с третьим тем, что в дереве уже есть](etalon-sverennyy-s-tretim-artefaktom.md)
- [Через TCP нельзя обещать ровное число доставок — обещать надо разложение](rovnoe-chislo-cherez-tcp-obeshchat-nelzya.md)
- [Адресат обязан быть литералом ради ТИПА ГРУЗА, а не ради планировщика: оба планировщика уже умеют вычисленный адрес](adresat-obyazan-byt-literalom-radi-tipa-gruza-a-ne-radi-planirovshchika.md)
- [Девяти обработчикам из десяти вытеснение не нужно: срок известен до запуска](nine-handlers-in-ten-need-no-preemption.md)
- [Оценку витков нельзя ввезти ни в один слой компилятора: имена совпадают, а переименования при ввозе в языке нет](boundedness-cannot-be-imported.md)

## Самораскрутка и метод проверки

- [Прогон работы и сверка целей ловят разное, и ни один из двух не заменяет другого](progon-raboty-i-sverka-celey-lovyat-raznoe.md)

- [Дважды за один замер врал прибор, а не предмет — и оба раза это выглядело как находка](the-instrument-lied-not-the-subject.md)

- [Самораскрутка меряется четырьмя кусками JavaScript, три закрыты](four-pieces-of-javascript.md)
- [Одна причина, названная сразу за группу, прячет остальные — и держит в долге тех, кого не держит ничто](one-named-reason-for-a-group-hides-the-others.md)
- [Стена «слой связывается асинхронно» стоит 263 синхронных места вызова, а не одной правки](the-sync-wall-costs-263-call-sites.md)
- [Внутренний предел витков умножается на цену витка и обязан помещаться во внешний бюджет слоя](an-inner-step-limit-multiplies-into-the-outer-budget.md)
- [От JavaScript остаётся только цель печати, второе мнение отменено вместе с ловушкой Томпсона](javascript-ostayotsya-tolko-celyu-pechati.md)
- [Печать в JavaScript упирается не в рантайм внутри модуля, а в отсутствие границы входа: 102 программы из 102 разойдутся с Node](pechat-v-js-derzhit-granica-vhoda-a-ne-runtime-v-literalah.md)
- [Перенос оракула яруса III — не одна задача, а пять разных, и две из них другого рода](perenos-oracula-yarusa-tri-razlozhen-na-pyat-raznyh-zadach.md)
- [Запись ответов свидетеля снимается ДО удаления, и замораживать надо не только ответы, но и список входов](zapis-otvetov-snimaetsya-do-udaleniya.md)
- [Переключение слоя не всегда опускает потолок: у `sets` он ВЫРОС, и это не провал](pereklyuchenie-sloya-ne-vsegda-opuskaet-potolok.md)
- [Порча, попавшая в недостижимую ветвь, лечится КОРПУСОМ, а не другой порчей](porcha-v-nedostizhimuyu-vetv-lechitsya-korpusom.md)
- [Признак, прочитанный печатью, ложен на каждом входе — и сверка этого не видит](priznak-uznayotsya-razborom-a-ne-pechatyu.md)
- [Отказ прогона, отданный значением, — граница, а не одна функция: её ловят исключением 33 места](run-outcome-as-a-value-is-a-boundary-not-a-function.md)
- [Пяти командам двоичного цена разная, и дешевле всех оказался `ast`, а `lock` с `package` держал brotli (поправлено дважды: не держит, и цена вышла в 7 раз выше пересчёта)](pyat-komand-dvoichnogo-cena-kazhdoy.md)
- [Снятое препятствие — не цена: `lock` и `package` стоили 2 066 строк C при оценке в 280](cena-komandy-schitaetsya-po-rabote-a-ne-po-snyatomu-prepyatstviyu.md)
- [Цена цели печати — не столкновения имён (1 из 197), а долг эталона, который прятала сверка с вычитанием](cena-celi-pechati-eto-dolg-etalona-a-ne-stolknoveniya.md)
- [Цена втаскивания цели печати в двоичный считается встречей имён: у Elixir 262 столкновения на 436 объявлений](cena-celi-pechati-v-dvoichnom-eto-vstrecha-imyon.md)
- [Двоичный расходится с Node на корпусе не печатью, а границей входа: у цели C — 161 программа из 163](granica-vhoda-a-ne-pechat-razvodit-dvoichnyy-s-node.md)
- [Разводить столкновения имён по одному дороже, чем дать всем объявлениям цели один суффикс: у C# столкнулось 322 из 392, и судей у них три](suffiks-celi-na-vse-obyavleniya-deshevle-chem-razvedenie-stolknoveniy.md)
- [Карта столкновений имён, снятая по каждой цели порознь, слепа к столкновениям целей между собой: у go с rust их пять](karta-stolknoveniy-schitala-cel-so-stvolom-a-ne-cel-s-celyu.md)
- [Без блока «Граница входа» напечатанный C# собирается, но падает при запуске; чинится 136 строками на flang, а не вычитанием в проверке](granica-vhoda-ne-napisana-u-pyati-celey-i-eto-vidno-tolko-syrym-diffom.md)
- [У двоичного два входа: цель печати достаётся прогонщику JSON даром, а ключу `--target` — в 90 строк C](vtashchit-cel-v-zamykanie-eto-polovina-raboty.md)
- [Ведомость двоичного бывает слабее ведомости на Node и никогда не сильнее](vedomost-dvoichnogo-byvaet-slabee-i-nikogda-ne-silnee.md)
- [Печать обязана спросить у проверки, а урезанное подмножество — назвать себя, а не молчать](pechat-obyazana-sprosit-u-proverki-a-podmnozhestvo-nazvat.md)
- [Слой, попавший в точку раскрутки, заморожен до её перепечатки: одна неиспользуемая функция красит побайтовую сверку](a-layer-inside-the-bootstrap-point-is-frozen-until-it-is-reprinted.md)
- [Подмена чтения исходников обязана стоять внутри обхода, а не перед ним](podmena-chteniya-stoit-vnutri-obhoda-a-ne-pered-nim.md)
- [Побайтовая сверка со свидетелем — главный метод проверки](byte-for-byte-comparison.md)
- [Проверка, зовущая свидетеля напрямую, не держит правило работающего слоя](a-check-that-calls-the-witness-does-not-hold-the-working-layer.md)
- [Побайтовая сверка данных не видит зависимости от тождества объектов](byte-comparison-misses-object-identity.md)
- [Вторую независимую реализацию возместить нечем — её можно только сохранить в проверках](the-second-implementation-cannot-be-replaced.md)
- [Снятая правка обязана красить тест](a-removal-must-turn-a-test-red.md)
- [Порча попадает туда, где считают, только если корпус сверки доходит до каталога с единственным случаем](a-corruption-lands-only-where-the-corpus-reaches.md)
- [Проверка, переставшая сравнивать, продолжает зеленеть](checks-that-stopped-comparing.md)
- [Проверка, переведённая на двоичный, выпадает из прогона молча — потому что CI не собирал двоичный ни разу](proverka-perevedyonnaya-na-dvoichnyy-vypadaet-iz-ci-molcha.md)
- [После удаления реализации на JavaScript набор проб отдаёт ноль, а не «почти всё»](posle-udaleniya-vtoroy-realizacii-nabor-prob-otdayot-nol.md)
- [Автопочинка чисел правит лист и оставляет итог — предложение начинает врать связнее](avtopochinka-chisel-pravit-list-i-ostavlyaet-itog.md)
- [Побайтовая сверка вычитала блок из вывода свидетеля — и зеленела на том, без чего программа не работает](granica-vhoda-vychitalas-iz-sverki-i-sverka-zelenela-vpustuyu.md)
- [Два правила языка живут только в реализации на JavaScript, и сверка двух реализаций их не видит](dva-pravila-yazyka-zhivut-tolko-v-javascript.md)
- [`flang test` на слое без своих примеров зеленеет всегда — а таких слоёв 11 683 строки](flang-test-na-etalone-bez-svoih-primerov-zeleneet-vsegda.md)
- [Правило, на которое не наступает ни одна программа корпуса, невидимо для сверки эталона](pravilo-bez-nositelya-v-korpuse-nevidimo-dlya-svercki.md)
- [Отказ компилятора на стороне flang — значение, поэтому «программа отвергнута» проверяется обычным примером](otkaz-na-storone-flang-eto-znachenie-znachit-ego-vidit-primer.md)
- [Блок кода в документации, который обязан отказать, помечается внутри самого блока](blok-dokumentacii-obyazannyy-otkazat-pomechaetsya-vnutri-sebya.md)
- [Сверка двух реализаций слепнет на том, что вычли до сравнения](sverka-dvuh-realizaciy-slepnet-na-tom-chto-vychli-do-sravneniya.md)
- [Сверка не видит различия, которого нет в представлении, — и остаётся зелёной на настоящей ошибке](a-comparison-cannot-see-a-distinction-the-representation-cannot-express.md)
- [Неверный довод при верном выводе опаснее неверного вывода](nevernyy-dovod-pri-vernom-vyvode.md)
- [Бывают конфликты слияния, которых git не показывает](silent-merge-conflicts.md)
- [Разрешать конфликт «по блоку за раз» — лотерея: автослияние уже применило удаления другой стороны](resolving-a-conflict-block-by-block-is-a-lottery.md)
- [Ветка, у последнего коммита которой оба родителя уже в стволе, не несёт ничего](vetka-bez-svoih-roditeley-nichego-ne-neset.md)
- [Красное после слияния — не обязательно своё: мерить его надо на самом стволе, отдельным рабочим деревом](a-red-inherited-from-the-trunk-must-be-measured-on-the-trunk.md)
- [Отставшая ведомость чаще отстала на стволе, чем на ветке, — и раскладывать её надо пофайльно, иначе убыль спрячется](a-stale-ledger-must-be-split-per-file-or-the-decrease-hides.md)
- [Номера строк и числа в задании — это дешёвая проверка того, на той ли ветке заведено рабочее дерево](line-numbers-in-a-task-verify-the-branch-it-was-written-against.md)
- [Сторона на flang для анализа завершаемости не читает `обеспечивает`, и это тот же баг, который свидетель у себя уже чинил](totality-twin-does-not-read-postconditions.md)
- [Структурный размер значения доказывается тотальным, если спускаться в поле образца, а не в результат поиска по ключу](structural-size-becomes-total-when-you-descend-into-the-pattern-field.md)
- [Круг взаимной рекурсии по дереву разрезается записью-нагрузкой, слияние функций не обязательно](krug-obhoda-dereva-razrezaetsya-zapisyu-nagruzki.md)
- [Липкий бит на чужом каталоге останавливает `git merge` целиком, а обходится одним коммитом](a-sticky-bit-in-a-shared-tree-stops-git-merge.md)
- [Объединение вариантов закрытой суммы — законное слияние, и оно обязано покраснеть у каждого, кто эту сумму разбирает](merging-two-branches-into-one-closed-sum.md)
- [Два ядра, выросшие порознь от одной точки, текстом не сливаются](two-cores-do-not-merge-as-text.md)
- [Две реализации одного файла, выросшие порознь, бывают не соперниками, а половинами](two-rewrites-of-one-file-may-be-halves.md)
- [Долг, закрытый на неслитой ветке, остаётся открытым долгом](debt-closed-on-an-unmerged-branch.md)
- [`git cherry` не видит содержимое, приехавшее в ветку слиянием, — «своего ноль» надо перепроверять сравнением деревьев](git-cherry-does-not-see-content-that-arrived-by-merge.md)
- [Файл, взятый целиком из другой ветки, приносит с собой её долги](transplanted-file-brings-its-own-debt.md)
- [Эталон отстаёт от свидетеля, который уехал, — отставание надо мерить](twin-lags-behind-the-reference.md)
- [Сверка эталона не ловила забытую команду: на ключе свидетель отказывает раньше, чем доходит до команды](spravka-bliznetsa-otstayot-tam-gde-korpus-idyot-s-klyuchom.md)
- [Из двух половин доставки язык доказывает только «не больше одного»](at-most-once-is-the-only-provable-half.md)
- [Измеренный ноль ценнее ненайденного правила](a-measured-zero-is-valuable.md)
- [Пустой раздел отчёта и посчитанный ноль — разные новости, и убирать надо пересказ, а не сведение](an-empty-section-and-a-counted-zero-are-not-the-same-news.md)
- [Замер скорости проверяет себя контрольной суммой](checksum-inside-the-benchmark.md)
- [Переименование файла не краснеет, а тихо выключает проверку чисел в прозе](renaming-a-file-silently-disables-the-guard.md)
- [Переименование понятия — не замена по дереву: у слова оказывается три значения](renaming-a-word-is-not-search-and-replace.md)
- [Имя порождённого файла чинится в имени модуля, а не в генераторе кода](a-generated-file-name-is-fixed-in-the-module-name.md)
- [Сборка релиза ломалась молча: имя выхода переименовали в трёх местах из четырёх, а четвёртое зовут руками](a-hard-coded-binary-name-outlives-its-rename.md)
- [Вторую сторону сверки можно заморозить, но проверка меняет род](a-frozen-reference-changes-the-check.md) — и перед заморозкой надо спросить, кем свидетель служил: вторым мнением, реализацией или точкой отсчёта для порчи
- [Перечень, записанный в проверке руками, переживает дерево](a-hand-written-list-outlives-the-tree.md)
- [Команда может ответить «проверено», не проверив ничего](checked-without-checking.md)
- [Число прозы без названного измерителя не перепроверяется, а заменяется другим числом](a-number-without-a-named-measure.md)
- [Измеритель числа умирает раньше, чем само число в прозе](izmeritel-chisla-umiraet-ran-she-chem-chislo-v-proze.md) — и тогда страницу нечем обновить честно; выживают те проверки прозы, которым не нужен компилятор
- [Набранное число расходится между страницами; подставленное — не может](typed-numbers-drift-substituted-ones-cannot.md)
- [Число, у которого нет ключа подстановки, расходится не с другой страницей, а со своим же отчётом](a-number-with-no-key-drifts-from-its-own-report.md) — главная сайта цитировала предыдущее поколение замера скорости, и знак сравнения был перевёрнут
- [Объявленный и ни разу не вызванный список — это обещание без исполнителя](a-declared-and-never-called-list-is-a-promise-with-no-executor.md) — комментарий над мёртвым кодом неотличим от комментария над живым
- [Журнал, записывающий короткий хеш коммита, догнать правкой коммита нельзя](amend-cannot-catch-up-a-journal-that-records-hashes.md)
- [Относительная ссылка ломается ровно при копировании каталога](relative-links-break-on-copy.md)
- [Замер собранного артефакта врёт молча: `make` не пересобирает, а отвечает «nothing to be done»](measuring-a-stale-artifact.md)
- [`git ls-files | grep '\.flang$'` насчитал 390 файлов там, где их 826: git берёт пути с не-ASCII в кавычки](git-quotes-non-ascii-paths-and-a-count-loses-them.md)
- [Прогон в общем каталоге теряется молча: чужой процесс пишет в файл с тем же именем](a-shared-log-path-silently-replaces-your-run.md)
- [Числа в прозе сторожатся, имена модулей — нет, и врут дольше](module-names-in-prose-are-unguarded.md)
- [Проверка кодов отказа смотрит только приставку `FLANG_`, поэтому восемь кодов из семнадцати обещаны прозой и не существуют нигде](a-code-guard-that-matches-one-prefix-checks-only-that-prefix.md)
- [Втаскивание модуля в компилятор стоит по столкновениям имён, а не по размеру модуля](vtaskivanie-modulya-platit-za-vstrechu-a-ne-za-razmer.md)
- [Граница входа была долгом печати, а не вычитания в проверке: без неё напечатанный крейт Rust не собирается](granica-vhoda-eto-dolg-pechati-a-ne-vychitanie-v-proverke.md)
- [Разбиение имени на слова у эталонов печати сделано таблицей ASCII, а у свидетеля — классами Юникода](slovar-simvolov-slova-na-flang-asciiynyy-a-u-svidetelya-yunikodnyy.md)
- [Вычтенный в сверке блок «границы входа» был дырой: напечатанная Java без него не запускается](printed-java-without-entry-table-does-not-start.md)
- [Двоичный не печатает сам себя в Java: список занятых имён пересобирается на каждую функцию](java-printer-rebuilds-the-taken-name-list-per-function.md)
- [Цикл поручений принадлежит хозяину, а не языку: чего стоил `flang io` в двоичном](cikl-porucheniy-prinadlezhit-hozyainu-a-ne-yazyku.md)
- [Имя файла теряется между разбором и «Бедой», и языковой сервер в двоичном упирается именно в этот разрыв](imya-fayla-teryaetsya-mezhdu-razborom-i-bedoy.md)
- [Круг раскрутки разорван — двоичный пересобирает себя без Node побайтово, но свои исходники проверить не может и считает медленнее Node](bootstrap-circle-is-broken-but-the-binary-cannot-check-itself.md)
- [Печать в C ищет исходники рантайма рядом с ДВОИЧНЫМ, и в дереве репозитория это работает по совпадению раскладки](pechat-v-c-ishchet-runtime-ryadom-s-dvoichnym.md)
- [Двоичный `flang lsp` не отвечает, пока стандартный ввод открыт, — и потому редактору не годится, хотя побайтовую сверку проходит](dvoichnyy-lsp-ne-otvechaet-poka-vvod-otkryt.md)
- [Из двух таблиц слов на flang сторожится одна, и вторая уже отстала на четыре фразы](tablica-poverhnostey-otstala-na-chetyre-frazy.md)
- [Напечатать правила подсветки из таблицы языка мало: съедает слова сам редактор](napechatannye-pravila-podsvetki-proveryayutsya-tolko-samim-redaktorom.md)

## Устройство репозитория

- [Старый проект FTS нельзя вынести дёшево: от него зависят все восемь генераторов кода flang](two-projects-tied-by-generators.md)
- [Прощальный абзац — «что здесь было и куда делось» — переживает то, о чём прощается, и держит мёртвые пути дольше всей остальной прозы](a-farewell-paragraph-outlives-what-it-says-goodbye-to.md)
- [Инструкция для посторонних, зовущая внутренний прогон, публикует чужую машину, а не удобство](a-convenience-script-in-contributing-publishes-your-machine.md)
- [Лицензионный гейт берёт новый каталог под опубликованным путём сразу, и первый же файл без шапки красит CI](the-license-gate-covers-new-files-from-birth.md)
- [Копия упаковщика, живущая в чужом репозитории, расходится с деревом в обе стороны](a-packaging-copy-in-another-repository-drifts-both-ways.md)
- [Выпуск был замкнут сам на себя: набор требовал релизного архива, а собрать его прогону было нечем](vypusk-ne-mog-sostoyatsya-nabor-treboval-arhiv-kotorogo-nikto-ne-sobiral.md)
- [Путь, который во всём дереве встречается только на стороне чтения, — это файл, которого у пользователя нет](a-path-only-ever-read-is-a-file-nobody-has.md)
- [Режим `--mode=u=rw,go=r`, заданный ради повторимости архива, запирает каталоги наглухо](a-tar-mode-for-files-locks-directories.md)
- [Проверку пути установки нельзя целиком написать на flang: хозяин убивает процесс на 30 000 мс, а сборка идёт 128 000 мс](host-timeout-of-30-seconds-keeps-builds-out-of-flang-plans.md)
- [Указатель поиска по 244 страницам весит 371 КиБ, если класть заголовки и первые 700 знаков, а не весь текст](a-client-side-index-holds-headings-not-full-text.md)
- [Страница, написанная как отчёт о нашей работе, читателю языка бесполезна — даже если каждое число в ней верно](a-page-that-reports-our-work-is-not-a-guide.md)
- [Подстановка, не попавшая в образец, доезжает до читателя двойными скобками — и молча](a-substitution-that-misses-the-pattern-reaches-the-reader.md)

## Интерфейс инструмента

- [Голая команда открывает оболочку, а справку печатает только тот, кого о ней спросили](bare-command-opens-the-shell.md)
- [Двоичный файл — подмножество языка, и подмножество обязано называть себя](the-installed-binary-is-a-named-subset.md)
- [Из npm и из brew приезжали разные компиляторы: на одном корпусе они разошлись на 54 вызовах из 59](dve-ustanovki-otvechali-po-raznomu-na-54-vyzova-iz-59.md)
- [Урезанная сборка обязана сказать, чего она не проверила](urezannaya-sborka-obyazana-skazat-chego-ne-proverila.md)
- [Справка расходится между двумя реализациями чаще всего остального — и молча](cli-help-diverges-between-the-two-implementations.md)
- [У двоичного нет целых проверок, а не только более слабая ведомость, — и его собственная справка об этом молчит](dvoichnyy-molchit-o-proverkah-kotoryh-v-nyom-net.md)
- [Сообщение, объясняющее устройство инструмента, читается как поломка — и признак у таких сообщений всего три](a-tool-that-explains-itself-instead-of-the-persons-work.md)
- [Путь установки не проходил целиком никто, и потому `flang emit --target c` не работал ни у одного поставившего язык](the-installed-path-was-never-walked-end-to-end.md)
- [Числовой код выхода нельзя вывести из именованного кода отказа — его берут из природы беды](an-exit-code-cannot-come-from-a-named-failure.md)
- [Знак сайта на 24 пикселях держит одну строку брусков, а не две — и видно это только на растре в натуральную величину](a-24-pixel-mark-holds-one-row-not-two.md)
- [Написание, которого нет в таблице слов, в документацию не попадает вовсе](spellings-outside-the-word-table-stay-undocumented.md)
- [Примеров по корпусу прогоняется вдвое больше, чем объявлено, а девять файлов на 11 683 строки отчитываются чужими](primerov-progonyaetsya-vdvoe-bolshe-chem-obyavleno.md)
- [Прогонщик корпуса написан на flang целиком; на C осталось 59 строк невыразимого и 419 строк перевозки](instrument-yazyka-pishetsya-na-yazyke-krome-effektov.md)
- [Первый же прогон по корпусу нашёл шесть расхождений между двоичным и свидетелем, и два из них — в опасную сторону](progon-po-korpusu-nashyol-shest-rashozhdeniy-mezhdu-realizaciyami.md)
- [Проверка в тесте, читавшая `.flang` своим разбором, оживает прогоном двоичного — но не всякая, и граница проходит по лексике и по обязательствам](proverki-v-testah-zhivut-progonom-dvoichnogo-a-ne-vtorym-razborom.md)
- [Проверку, которая зовёт компилятор, а не разбирает `.flang` сама, переносить на flang почти нечего — мешает только чтение ответа](proverka-zovushchaya-kompilyator-perenositsya-na-flang-mehanicheski.md)
- [Двоичный уже отвечает про любую свою функцию, и новую команду под это заводить не надо](dvoichnyy-otvechaet-pro-lyubuyu-svoyu-funkciyu-cherez-progonshchik.md)
- [Поток токенов наружу стоит вчетверо дешевле дерева, и две проверки прозы оживают именно им, а не `flang ast`](potok-tokenov-naruzhu-deshevle-dereva-vchetvero.md)
- [Прогонщик двоичного открывает ВСЁ замыкание компилятора — новая команда нужна только там, где у ответа свой вид вывода](progonshchik-dvoichnogo-otkryvaet-vsyo-zamykanie.md)
- [Таблица, разложенная на несколько строк ради поиска, расходится молча — и ловит это только тот, кто её ПЕРЕЧИСЛЯЕТ](proizvodnye-tablicy-odnogo-fakta-rashodyatsya-molcha.md)

## Найденные ошибки

- [Строчное имя варианта в голом «случай «имя»» читается как связывание имени, а не как вариант](strochnoe-imya-varianta-v-golom-sluchae-eto-svyazyvanie-imeni.md)
- [Функцию без аргументов нельзя позвать через ввоз, хотя местную — можно](nulyarnuyu-funkciyu-nelzya-pozvat-cherez-vvoz.md)
- [Свёртка, отмечающая находку пустотой накопленного, теряет пустой ответ — это класс](svyortka-otmechayushchaya-nahodku-pustotoy-teryaet-pustoy-otvet.md)
- [Рукописная копия обнаруживает себя столкновением имён в день, когда библиотека дорастает до неё](rukopisnaya-kopiya-obnaruzhivaet-sebya-stolknoveniem-imyon.md)
- [`http.flang` считает Content-Length знаками в обе стороны, и потому чинить одну сторону нельзя](content-length-schitaetsya-znakami-v-obe-storony.md)

- [Вариант суммы, названный как вариант встроенного «Отклик», отключает все встроенные типы ввода-вывода, а диагностика жалуется на другое](variant-nazvannyy-kak-vstroennyy-vyrubaet-vstroennye-tipy.md)
- [Ядро печатало «доказано индукцией» об утверждении, которое рантайм отвергал](the-core-proved-a-falsehood.md)
- [Поле записи отмывало значение из-за симметричного сравнения типов](a-record-field-laundered-a-value.md)
- [NaN достижим изнутри языка и делает «очевидные» правила ложными](nan-is-reachable.md)
- [Ядро принимает ложь дважды за сутки — это класс дефектов](the-core-accepts-falsehood-a-class.md)
- [Минус ноль всплыл четыре раза — это класс, а не отдельные ошибки](minus-zero-is-a-class.md)
- [Тип не держит инвариант, поэтому очевидные утверждения о дереве поиска ложны](tip-ne-derzhit-invariant-poetomu-ochevidnye-utverzhdeniya-o-dereve-lozhny.md)
- [Один нулевой байт внутри исходника прячет весь файл от `grep` — и счётчик по дереву молча теряет 162 примера](odin-nul-v-ishodnike-pryachet-fajl-ot-grep.md)
- [Поле встроенного словаря, названное ключевым словом, ставится и не читается](a-dictionary-field-named-like-a-keyword-cannot-be-read.md)
- [Постусловие «обращение не меняет длины строки» ложно, и ломает его одинокий суррогат](obrashchenie-stroki-lozhno-na-odinokom-surrogate.md)
- [Постусловие о длине, прошедшее сетку, всё ещё может быть ложным — ловит фаззинг напечатанного кода](a-grid-passed-length-claim-can-still-be-false-on-surrogates.md)
- [Литерал `"\uD83D"` в любом `.flang` этого дерева ломает сверку самоприменения — и это не чинится](literal-s-odinokim-surrogatom-lomaet-samoprimenenie.md)
- [Целочисленное деление не даёт ядру `нат` — границу приходится называть постусловием](celochislennoe-delenie-ne-daet-yadru-nat.md)
- [Словарь встроенных форм лежал в девяти местах, и три копии уже разошлись](a-dictionary-copied-into-nine-places-drifts-silently.md)
- [Сторона на flang может уже существовать под чужим именем — проверять до того, как писать](a-side-may-already-exist-check-before-writing.md)
- [Отбрасывание недостижимого на стороне flang даёт тот же ответ и стоит в 180 раз дороже](otbrasyvanie-nedostizhimogo-na-flang-stoit-180-raz.md)
- [Замок снимает места, а генератор кода их печатает — отсюда расхождение в 337 байт](zamok-snimaet-mesta-a-generator-ih-pechataet.md)
- [Адрес модуля в замке — sha256 его исходника, а сжатия в формате нет вовсе](adres-modulya-eto-sha256-ishodnika.md)
- [В WebAssembly нет сторожевой страницы, поэтому заниженная константа стека портит память молча](no-guard-page-in-wasm.md)
- [Жирный вокруг встроенного кода не собирался на сайте ни разу](bold-around-inline-code-never-rendered.md)
- [Страница `man` показывала вместо примера `--args` обрывок `'{`, и проверка была зелёной](the-man-page-swallowed-the-args-example.md)
- [Порядок ключей в `results` — поверхность: подпись входа замороженной записи считается от него](poryadok-klyuchey-results-eto-poverhnost.md)
- [Одна ссылка на ненаписанную заметку останавливает публикацию сайта целиком](one-dangling-note-link-stops-the-whole-site.md)
- [Строка плана, прочитанная как результат, — вот как страницы начинают обещать несуществующее](a-plan-row-read-as-a-result-is-how-pages-start-promising.md)
- [Проверка, живущая внутри одной команды, — это класс дефектов, и он всплыл трижды](a-check-that-skips-a-check-is-a-class.md)
- [Сокет-хозяин терял ответ ровно тогда, когда служба делала что-то между запросом и ответом](sluzhba-poluchila-pravo-podumat-mezhdu-zaprosom-i-otvetom.md)
- [Слой законов не различает списки по типу элемента: ключ у всякого списка — `list:null`](the-law-layer-cannot-tell-two-list-types-apart.md)
- [Макрос `_POSIX_C_SOURCE` открывает функцию на glibc и закрывает её на Darwin](a-feature-macro-that-opens-on-glibc-closes-on-darwin.md)
- [У напечатанной программы две двери, а граница входа стояла только у одной](printed-program-has-two-doors.md)
- [Граница входа у программ, напечатанных двоичным, была пуста, и закрыл её перенос одной таблицы на flang](entry-table-moved-to-flang-closes-the-binary-border.md)
- [Тип функции на английской поверхности не записывается словами: `to number` съедает встроенная форма](a-longer-builtin-phrase-eats-a-type-on-the-english-surface.md)
- [Изменившийся вердикт при снятии правки — ещё не доказанная ложь](a-changed-verdict-on-removal-is-not-a-proven-lie.md)
- [`git stash` общий на все рабочие деревья](git-stash-is-shared-across-worktrees.md)

## Отвергнутые пути

- [Оракулу законов мешала тотальность, а не отсутствие функций первого класса](oraculu-meshala-totalnost-a-ne-pervyy-klass.md)
- [«Вынут из решения» и «вынут из загрузки» — два разных события, и второе бывает дороже первого](vynut-iz-resheniya-i-vynut-iz-zagruzki-eto-dva-sobytiya.md)
- [Автоматический вывод регионов — мимо цели, а не дорого](region-inference-misses-the-point.md)
- [Z3 можно взять оракулом, нельзя судьёй](z3-as-oracle-not-judge.md)
- [Чтение условий `если` закрывает ноль целей](reading-if-conditions-closed-zero-goals.md)
- [Пакет npm нельзя унести из корня в подкаталог: он уедет пустым, а не подорожает](paket-npm-ne-uedet-v-podkatalog.md)

## Модульность и пакеты

- [Модуль, не подключённый ни к чему, копит уже занятые имена — и подключить его потом нельзя](dva-imeni-v-raznyh-modulyah-nelzya-svesti-v-odnu-programmu.md)
- [Адресация по содержимому: версий нет, есть хеши](content-addressing.md)
- [Unison установлен и измерен: ромб он решает не так, как обещает лозунг](unison-measured.md)
- [Гипотеза про адресацию по содержимому не работает у нас — и не из-за хешей](names-not-hashes.md)
- [В хеш входит контракт, но не доказательство — у теоремы свой адрес](what-goes-into-the-hash.md)
- [Хеш содержимого — идентичность внутри, имена и версии — интерфейс снаружи](hash-inside-names-outside.md)
- [Из хеша код не выводится: у средней функции flang вдвое больше содержания, чем влезает в адрес](iz-hesha-kod-ne-vyvoditsya.md)
- [Подпись не определяет функцию: на нашей библиотеке она однозначна в 36,5 % случаев](spetsifikatsiya-ne-opredelyaet-funktsiyu.md)
- [Законы годятся указателем, а не выводом — но в стандартной библиотеке их объявлено ноль](zakony-kak-ukazatel.md)
- [Чужие пакеты надо хранить: из трёх укладов два — это один в два слоя, а третий не про наше десятилетие](chuzhie-pakety-nado-hranit.md)
- [`pull` у Unison привозит весь код, а не ссылки: хеш — способ не дублировать, а не способ не хранить](pull-privozit-ves-kod.md)
- [Ромб у Unison ломается не от подъёма версии, а от правки типа: за семь версий `base` не изменился ни один тип](romb-lomaetsya-ot-pravki-tipa.md)
- [Синтез из спецификации упирается в 75 узлов дерева — и медианная функция нашей библиотеки ровно этого размера](sintez-upiraetsya-v-75-uzlov.md)
- [Библиотеку сегодня не выводят из спеки — её пишут агентом, а теорема работает храповиком](hrapovik-vmesto-vyvoda.md)
- [Вывод из спецификации работает там, где область сузили нарочно, — и у flang такая область уже есть: словарь между спеками](vyvod-rabotaet-na-uzkoy-oblasti.md)
- [Пакет — это замок, которому дали имя и версию: семь шагов подключения стали двумя](paket-eto-zamok-s-imenem-i-versiey.md)
- [Кешировать доказательство сегодня дороже, чем доказать заново: 111 мс против 145 мс на всём корпусе](keshirovat-dokazatelstvo-dorozhe-chem-dokazat.md)
- [Столкновения имён в замыкании компилятора считаются обходом текста за 0,1 с — там же, где связывание отвечает за 6 минут](stolknoveniya-imyon-schitayutsya-obhodom-teksta-za-desyatye-doli-sekundy.md)

## Внешнее и объёмы
- [Труба соединения возит текст, а не октеты, и это закрывает все двоичные протоколы](truba-soedineniya-vozit-tekst-a-ne-oktety.md)
- [Поток, который нечем разметить по границам, дочитывается завершителем фазы](zavershitel-fazy-perechityvaet-potok-kotoryy-nechem-kadrirovat.md)

- [Что в популярных рассказах о доказуемых языках верно, а что ложно](what-the-popular-stories-get-wrong.md)
- [Свой генератор машинного кода — примерно месяц, и на доказуемость не влияет](our-own-machine-code-generator.md)
- [WebAssembly получается через C даром: девятая цель печати не нужна](wasm-via-c-is-free.md)
- [До настоящего приложения в браузере не хватает трёх кусков, и они посчитаны](browser-app-gap.md) — с поправкой: два утверждения опровергнуты замером
- [Генератор печатает все функции приложения и молча роняет объявление `план`](emit-pechataet-funkcii-plana-no-ne-sam-plan.md) — с поправкой: закрыто, и все три части закрыты по-разному
- [Признак «печатать отдельным файлом» — это «во вкладку не едет», а не «одинаково для всех программ»](ispolnitel-plana-pechataetsya-vnutr-modulya-a-progonshchik-ryadom.md) — и ещё два: сверка зеленеет на том, чего не видно в следе (2 дыры из 5 порч), и потолок рабочего пути
- [Браузер не говорит со службой на flang, и корень у пяти расхождений один — нет формы «символ по коду»](brauzer-ne-govorit-so-sluzhboy-iz-za-otsutstviya-znaka-po-kodu.md)
- [Песочницу в браузере держит POSIX-слой оболочки, а не размер компилятора](playground-blocked-by-repl-posix-not-by-size.md)
- [Обёртка, которая ругается на ненулевой код возврата, прячет результат под видом сбоя](a-wrapper-that-rejects-on-nonzero-exit-hides-the-result.md)

## Передача работы

- [Состояние проекта передаётся файлом `docs/PEREDACHA.md`, а не пересказом](handoff-goes-in-a-file.md)

**Начинаете работу с чистого листа или с другой учётной записи — читайте
передачу состояния первой.** Там пути, ветки, что сделано, чего не хватает, что
делать дальше по отдаче и чего делать нельзя. Здесь — почему решили так; там —
где мы сейчас. Что это за файл и почему он один, сказано в заметке
[Состояние проекта передаётся файлом, а не пересказом](handoff-goes-in-a-file.md).

Лежит он в двух местах, и путь к нему зависит от того, откуда вы читаете:

| откуда читаете | путь |
|---|---|
| репозиторий (`docs/zettel/`) | `docs/PEREDACHA.md` — на уровень выше этого файла |
| копия для всех пользователей машины (`/srv/flang-znanie/`) | `PEREDACHA.md` — РЯДОМ с этим файлом |

**Ссылки здесь нарочно нет, и это не небрежность.** Относительный путь верен
ровно в одном из двух мест: `../PEREDACHA.md` из репозитория попадает в
`docs/PEREDACHA.md`, а из копии — в `/srv/PEREDACHA.md`, которого не существует.
Ломалась при этом та самая ссылка, ради которой абзац написан: её читают, зайдя
с другой учётной записи, то есть как раз через копию. Оба пути названы текстом —
тогда самодостаточны оба места. Ссылки на соседние заметки этой беды не имеют:
они лежат рядом и в репозитории, и в копии.

## Как добавлять

Одна заметка — одна мысль. Формат:

```markdown
# Заголовок-утверждение, а не тема

Суть в первом абзаце.

**Чем подтверждено.** Число, прогон, ветка и коммит — чтобы можно было проверить.

**Чем ограничено.** Где это перестаёт быть верным.

Связано: [[слаг-соседа]], [[другой-слаг]]
```

Правила:

1. **Заголовок — утверждение.** «Ассоциативность у double не держится», а не «Про
   ассоциативность». Если заголовок не утверждение, заметка ещё не додумана.
2. **Числа с происхождением.** Измеренное отделять от оценённого прямо в тексте.
3. **Простым языком** — [пояснение](write-in-plain-language.md).
4. **Ссылка на несуществующую заметку — не ошибка.** Она помечает то, что стоит
   написать.
5. **Отрицательный результат — полноценная заметка.** Отвергнутый путь с доводом
   экономит больше, чем ещё одно описание успеха.
6. **Имя файла — английские слова через дефис, перевод заголовка, а не транслит.**
   `checks-that-stopped-comparing`, а не `proverki-perestayushchie-sravnivat`.
   Текст заметки остаётся русским; по-английски только имя, потому что из него
   получается адрес страницы `knowledge-<слаг>.html`.

Добавили заметку — впишите строку в этот индекс.
