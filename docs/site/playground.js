/* Песочница flang на странице: рабочее место из редактора слева и результата
   справа, с именованными раскладками (сетапами) под разные занятия.

   Проверяет не этот файл, а компилятор, собранный в WebAssembly: он работает
   в отдельном потоке (`playground/flang_host_browser.js`) и отдаёт сюда
   разобранный ответ — машинный отчёт `check --proof --json`, дерево разбора
   `flang ast`, сообщения об ошибках с местом и ответ независимой проверки.
   Здесь этот ответ только раскладывается по экрану.

   Файл делится на две части. Первая — таблицы и чистые функции: что открыть
   по ссылке, как назвать ответ компилятора, какие строки отметить. Она не
   трогает документ, поэтому её исполняет и Node: рецепт `playground:page`
   гонит через неё настоящие ответы компилятора и краснеет на исключении или
   пустом заголовке. Вторая часть (после проверки `typeof document`) строит
   страницу и рисует то, что вернула первая.

   Слова языка для подсветки берутся из таблицы лексера
   (flang/self/lexer.flang, «Куски таблицы»): сборка сайта кладёт их на
   страницу блоком `#flang-lexicon`, второго списка слов здесь нет. */
(function () {
  'use strict';

  /* ── Стартовые программы ────────────────────────────────────────────────
     У каждой названы функция и аргументы её примера: кнопка «Запустить»
     работает сразу. `playground:starters` гонит каждую через три кнопки. */
  var STARTERS = [
    { key: 'hello', fn: 'Удвоить', args: '{"н": 21}', text: [
      'модуль «Привет»', '',
      'тотальная функция «Удвоить»', '  принимает н: неотрицательное', '  возвращает число',
      '  обеспечивает «удвоенное не меньше исходного» результат не меньше н',
      '  пример «дважды два»', '    дано н равно 2', '    ожидается 4', '  н плюс н', ''].join('\n') },
    { key: 'proof', fn: 'Сумма', args: '{"числа": [1, 2, 3]}', text: [
      'модуль «Сумма списка»', '',
      'тотальная функция «Сумма»', '  принимает числа: список неотрицательное', '  возвращает число',
      '  обеспечивает «сумма не отрицательна» результат не меньше 0',
      '  пример «один, два, три»', '    дано числа равно [1, 2, 3]', '    ожидается 6',
      '  разбор числа', '    случай пусто', '      то 0', '    случай голова и хвост',
      '      то голова плюс («Сумма» от хвост)', ''].join('\n') },
    { key: 'monad', fn: 'Обернуть', args: '{"значение": 7}', text: [
      'модуль «Монада»', '',
      'тип «Возможно» от «А»', '  вариант «Есть» содержит значение: «А»', '  вариант «Нет»', '',
      'монада «Возможно» от «А»', '  возврат «Обернуть»', '  соединение «Сплющить»', '',
      'тотальная функция «Обернуть» от «А»', '  принимает значение: «А»', '  возвращает «Возможно» от «А»',
      '  пример «число заворачивается»', '    дано значение равно 7', '    ожидается вариант «Есть» с значение равным 7',
      '  вариант «Есть» с значение равным значение', '',
      'тотальная функция «Сплющить» от «А»', '  принимает вложенное: «Возможно» от («Возможно» от «А»)',
      '  возвращает «Возможно» от «А»',
      '  пример «два слоя становятся одним»',
      '    дано вложенное равно вариант «Есть» с значение равным (вариант «Есть» с значение равным 5)',
      '    ожидается вариант «Есть» с значение равным 5',
      '  разбор вложенное', '    случай вариант «Есть» с значение как внутри', '      то внутри',
      '    случай «Нет»', '      то вариант «Нет»', ''].join('\n') },
    { key: 'loop', fn: 'Лучшая прибыль', args: '{"голова": 7, "хвост": [1, 5, 3, 6, 4]}', text: [
      'модуль «Сделка»', '',
      'тотальная функция «Лучшая прибыль»', '  принимает голова: число, хвост: список числа', '  возвращает число',
      '  пример «купить за 1, продать за 6»', '    дано голова равно 7', '    дано хвост равно [1, 5, 3, 6, 4]',
      '    ожидается 5',
      '  цикл «Сделка»', '    для каждого цена из хвост',
      '    храним минимум: число равным голова, прибыль: число равным 0', '    в конце прибыль',
      '    пусть ниже равно если цена меньше минимум то цена иначе минимум',
      '    пусть лучше равно если (цена минус ниже) больше прибыль то (цена минус ниже) иначе прибыль',
      '    дальше: минимум станет ниже, прибыль станет лучше', ''].join('\n') },
    { key: 'klass', slug: 'class', fn: 'После вклада', args: '{}', text: [
      'модуль «Банк»', '',
      'класс «Счёт»', '  владелец: строка', '  остаток: число',
      '  всегда «остаток не отрицателен» остаток не меньше 0', '',
      '  метод «Положить» принимает сумма: число', '    требует «сумма не отрицательна» сумма не меньше 0',
      '    остаток станет остаток плюс сумма', '',
      'интерфейс «Фигура»', '  метод «Площадь» возвращает число', '',
      'класс «Квадрат» есть «Фигура»', '  сторона: число', '  метод «Площадь» возвращает число',
      '    сторона умножить на сторона', '',
      'функция «После вклада»', '  возвращает число', '  пример «десять и тридцать»', '    ожидается 40',
      '  пусть счёт равно запись «Счёт» с «владелец» равным "Анна" и «остаток» равным 10',
      '  («Счёт: Положить» от счёт и 30).остаток', ''].join('\n') },
    { key: 'emitC', slug: 'emit-c', emit: 'c', fn: 'Удвоить', args: '{"н": 21}', text: null }
  ];
  STARTERS[5].text = STARTERS[0].text;
  function starterOf(word) {
    return STARTERS.filter(function (s) { return (s.slug || s.key) === word || s.key === word; })[0] || null;
  }

  /* ── Сетапы ─────────────────────────────────────────────────────────────
     Сетап — именованная рабочая раскладка: с чего начать, что показано справа
     и что делает главная кнопка. Его адрес — `#setup=<key>`.

       key      имя в адресе
       name     название на плитке; note — строка под ним
       starter  стартовая программа: ключ из STARTERS; либо text — свой текст
       lang     язык редактора слева, если это не flang
       views    что справа, вкладками; первая открыта сразу
       enter    что делает Ctrl+Enter и главная кнопка:
                run | check | test | emit | translate
       buttons  какие кнопки видны, главная первой
       call     показать поля «функция» и «аргументы»
       passes   как узнать, что стартовая программа прошла главную кнопку
                (сверяет `playground:page`)

     Новый сетап — новая строка этой таблицы: плитка, адрес, проверка страницы
     и черновик появляются сами. */
  /* Пример для сетапа «Свой текст»: короткий текст с двумя ошибками. Пробы
     (`playground:page`) сверяют, что из него прочитано и что найдено. */
  var PROSE_EXAMPLE = ['Все киты — млекопитающие. Все млекопитающие дышат. Следовательно, все киты дышат.',
    'Дельфин — млекопитающее. Следовательно, дельфин — кит.', 'Некоторые киты не дышат.',
    'Об этом писали ещё в прошлом веке.', ''].join('\n');
  var SETUPS = [
    { key: 'first', starter: 'hello', views: ['run', 'result', 'terminal'], enter: 'run', buttons: ['run', 'check'], call: true,
      name: { ru: 'Первая программа', en: 'First program' },
      note: { ru: 'функция и её тесты', en: 'a function and its tests' } },
    { key: 'proof', starter: 'proof', views: ['result', 'formula', 'picture', 'terminal'], enter: 'check', buttons: ['check'],
      labels: { result: { ru: 'Доказательства', en: 'Proofs' } },
      name: { ru: 'Доказательства', en: 'Proofs' },
      note: { ru: 'что доказано, что нет', en: 'what is proved, what is not' } },
    { key: 'tests', views: ['tests', 'terminal'], enter: 'test', buttons: ['test', 'check'],
      name: { ru: 'Тесты', en: 'Tests' },
      note: { ru: 'вход, ожидалось, получено', en: 'input, expected, actual' },
      text: [
        'модуль «Скидка»', '',
        'тотальная функция «Цена со скидкой»', '  принимает цена: неотрицательное, скидка: неотрицательное',
        '  возвращает число',
        '  пример «без скидки»', '    дано цена равно 200', '    дано скидка равно 0', '    ожидается 200',
        '  пример «четверть»', '    дано цена равно 200', '    дано скидка равно 25', '    ожидается 150',
        '  пример «даром»', '    дано цена равно 80', '    дано скидка равно 100', '    ожидается 0',
        '  цена минус ((цена умножить на скидка) делить на 100)', ''].join('\n') },
    { key: 'emit', starter: 'emit-c', views: ['emit', 'terminal'], enter: 'emit', buttons: ['emit', 'check'],
      name: { ru: 'Генерация кода', en: 'Code generation' },
      note: { ru: 'C, Go, Rust, JS и другие', en: 'C, Go, Rust, JS and more' } },
    { key: 'reasoning', views: ['result', 'terminal'], enter: 'check', buttons: ['check'],
      labels: { result: { ru: 'Вывод', en: 'Verdict' } },
      name: { ru: 'Рассуждение по-русски', en: 'Reasoning in Russian' },
      note: { ru: 'следует или нет', en: 'follows or not' },
      text: [
        'Понятие: человек, люди.', 'Понятие: грек, греки.', 'Свойство: смертен, смертны.', '',
        'Все люди смертны. Все греки — люди. Следовательно, все греки смертны.', ''].join('\n') },
    { key: 'formula', views: ['result', 'formula', 'terminal'], enter: 'check', buttons: ['check'],
      labels: { result: { ru: 'Проверка', en: 'Check' } },
      name: { ru: 'Формула', en: 'Formula' },
      note: { ru: '∀ и ∃ → проверка', en: '∀ and ∃ → check' },
      text: '∀ x ∈ ℤ, ∀ y ∈ ℤ, x + y = y + x\n' },
    { key: 'prose', views: ['argue', 'terminal'], enter: 'argue', buttons: ['argue'],
      name: { ru: 'Свой текст', en: 'Your own text' },
      note: { ru: 'что прочитано, где ошибки', en: 'what is read, where it goes wrong' },
      text: PROSE_EXAMPLE },
    { key: 'c', lang: 'c', views: ['foreign'], enter: 'translate', buttons: ['translate'],
      name: { ru: 'C → flang', en: 'C → flang' },
      note: { ru: 'перевод и проверка', en: 'translate and check' },
      text: ['int max(int a, int b) {', '  if (a > b) return a;', '  return b;', '}', ''].join('\n') },
    { key: 'python', lang: 'python', views: ['foreign'], enter: 'translate', buttons: ['translate'],
      name: { ru: 'Python → flang', en: 'Python → flang' },
      note: { ru: 'перевод и проверка', en: 'translate and check' },
      text: ['def max_of_two(a: int, b: int) -> int:', '    if a > b:', '        return a', '    return b', ''].join('\n') }
  ];
  function setupOf(key) { return SETUPS.filter(function (s) { return s.key === key; })[0] || null; }
  function setupText(s) { return s.starter ? starterOf(s.starter).text : s.text; }

  /* ── Слова интерфейса ───────────────────────────────────────────────────── */
  function inputs(map) { return Object.keys(map || {}).map(function (k) { return k + ' = ' + map[k]; }).join(', '); }
  var WORDS = { en: {
    example: 'Example', check: 'Check', share: 'Share', reset: 'Reset', checking: 'checking…',
    runGo: 'Run', testGo: 'Tests', running: 'running…', fnLabel: 'function', argsLabel: 'arguments, JSON', fnHint: 'name without « »',
    version: function (v) { return 'flang ' + v + ', runs in this tab'; }, versionUnknown: 'the compiler is not loaded yet',
    done: 'Done', notDone: 'Not done', exitCode: 'exit code ', starters: 'Starters', pageExamples: 'Examples on this page',
    limitTitle: 'Stopped: the step limit', timeoutTitle: 'Stopped: took too long',
    timeoutLead: function (sec) { return 'The run took more than ' + sec + ' seconds, so the playground stopped it to keep the tab alive. The compiler will load again on the next run. Check that your functions terminate, or run this program in a terminal.'; },
    unprovenLead: '«flang run» does not run a program that is not fully proved. Fix the proof, or run it without one.', trustGo: 'Run without the proof (--trust)',
    noFunction: 'There is no function in the text to run.', badArgs: 'The arguments are not a JSON object, for example {"н": 21}.',
    needProgram: 'This button works with a flang program: the first line is «модуль …».',
    workerDown: 'The compiler did not load. Check the connection and reload the page; without WebAssembly the playground does not work.',
    starterNames: { hello: 'First program', proof: 'Proof by induction', monad: 'Monad: three laws proved', loop: 'Loop with kept values', klass: 'Class and interface', emitC: 'Code generation: C' },
    linkCopied: 'link copied: the text is in the address, nothing is sent to a server', ms: 'ms',
    tabs: { run: 'Result', result: 'Check', tests: 'Tests', formula: 'Formulas', emit: 'Code', foreign: 'Translation', picture: 'Pictures', terminal: 'Terminal' },
    loading: function (pct) { return 'downloading the compiler: ' + pct + ' %'; }, ready: 'compiler loaded', preparing: 'preparing the compiler…',
    loadNote: 'The first run downloads the compiler, about 10 MB. After that it stays in the browser cache.',
    emitLead: 'The same program in another language, generated by «flang emit». The compiler runs in this tab.',
    emitting: 'generating…', emitFailed: 'No code generated', emitRefusedLead: '«flang emit» generates code only for a program that passes the check.', runtimeNote: 'Runtime library files are copied as they are and are not shown here: ',
    emitFrom: { 'формула': 'The formula was first translated to flang; the code is generated from that program.', 'рассуждение': 'The reasoning was first turned into a flang program; the code is generated from it.' },
    emitStale: 'The text has changed.', print: 'Generate', emitGo: 'Generate', emitDone: 'Code generated',
    foreignLead: 'Write a function in C. A translator turns it into a flang program, and the kernel checks the result right away.',
    translateGo: 'Translate and check', translating: 'translating…', soon: 'soon', soonNote: 'The Python translator is not in this build yet.',
    readFailed: 'The text was not read', notTranslated: 'Not translated', fnProved: 'Translated and proved', fnUnproved: 'Translated, not everything is proved',
    fnFailed: 'Translated, the check failed', fnRefuted: 'Translated: a counterexample is found',
    refutedLead: function (c) { return 'The postcondition «' + c.обещание + '» is broken on ' + inputs(c.входы) + '. flang computed this at the bounds of int.'; },
    refuted: function (c) { return 'refuted: ' + inputs(c.входы); }, boundsClean: 'not proved; no violation at the bounds of int, but that is not a proof',
    intNote: 'The result is declared «число»: in flang a sum of «целое» values is «число», so the translator writes «возвращает число» and states the bounds of int as postconditions.',
    noFunctions: 'There are no function definitions in the text.', inFlang: 'In flang',
    cSubset: 'The C subset: int and struct of int fields, if/else, while, for, return, + − * / % and comparisons. Overflow and division by zero become conditions the kernel has to prove.',
    foreignLabel: 'source in C', fallacy: 'Fallacy: ', card: 'fallacy card', hints: 'Possible fallacies (check them yourself): ', boundary: 'What the form does not decide: ', unparsedSentence: 'Not read: sentence ',
    editor: 'flang source, reasoning or formula',
    press: function (word) { return 'Press «' + word + '» or Ctrl+Enter.'; },
    proved: 'Proved for all values', examples: 'Checked on tests only', counter: 'Does not hold: here is a counterexample',
    unproved: 'Not proved', error: 'Error', errorAt: 'Error on line ', errors: function (n) { return 'Errors: ' + n; }, clean: 'No errors', partial: 'Not everything was checked',
    follows: 'Follows', notRead: 'The text was not read', formulaRefused: 'The formula was not read', failed: 'The check did not run',
    provedLead: 'Every statement holds for every input, not only for the tests written.',
    examplesLead: 'The tests found no violation, but this is not a proof for the remaining values.',
    unprovedLead: 'Some statements have neither a proof nor tests.',
    cleanLead: 'Syntax, types and termination are fine. The program states nothing to prove.',
    partialLead: 'Some declarations are accepted but their structure is not checked by the compiler.',
    terminal: 'Compiler output, as in a terminal', program: 'The program the reasoning became', noTerminal: 'The compiler output appears here after the first run.',
    independent: { ok: 'Independent check: a separate program replayed the proof record and it matched.', bad: 'The independent check did not confirm the proof record.', partial: 'The independent check went through only a part of the proof record: it has no method for the rest, so that part stands unconfirmed.', imports: 'The independent check is not available for programs with «использует».', none: '' },
    kinds: { 'утверждение': 'statement', 'постусловие': 'postcondition', 'закон': 'law', 'statement': 'statement', 'postcondition': 'postcondition' },
    of: ' of ', premises: 'premises', from: ' is derived from ', notFrom: ' is not derived from ', counterexample: 'Counterexample: ',
    line: 'line ', goLine: function (n) { return 'line ' + n; }, about: 'about this error',
    noFormula: 'There are no statements to show as a formula yet. Check a program with «утверждение» or «обеспечивает».',
    outside: 'Outside the formula notation: ', latexSource: 'LaTeX source', toEditor: 'Open in the editor', asFlang: 'In flang', rendered: 'Formula',
    noPicture: 'Pictures are drawn for categories, functors, monoids, sets and proofs. This text has none of them.',
    category: 'Category ', functor: 'Functor ', monoid: 'Monoid ', sets: 'Sets', proof: 'Proof of ',
    square: 'square for ', triangle: 'composition ', assoc: 'associativity', units: 'unit laws',
    marks: { proved: 'proved', examples: 'tests only', violated: 'refuted', unproved: 'not proved', conditional: 'not proved', unknown: 'not checked', passed: 'passed', failed: 'failed', error: 'error' },
    induction: 'induction on ', cases: 'case ', base: 'base', step: 'step', rule: 'rule ', byTypes: 'from the declared argument types',
    byComputation: 'by computing a closed goal', hypothesis: 'by the induction hypothesis',
    claim: {
      proved: 'proved for all inputs', induction: function (c) { return 'proved by induction on «' + c.param + '» (type «' + c.type + '»)'; },
      conditional: 'proved under a condition that is not proved itself', grid: function (n) { return 'checked on tests only: ' + n + ' values'; },
      declared: 'no proof and no tests — add a theorem', refused: 'the kernel could not derive the goal', violated: 'there is an input where it is false',
      unchecked: 'not checked: the compiler stopped earlier'
    },
    law: function (kind, n) { return (kind === 'моноид' ? 'monoid laws' : kind === 'категория' ? 'category laws' : 'commuting squares') + ' checked on tests: ' + n + ' values'; },
    lawProved: 'laws proved for all values', assumed: 'accepted without checking: ',
    lawKinds: { 'категория': 'category', 'моноид': 'monoid', 'связь': 'functor', 'преобразование': 'natural transformation' },
    cols: { status: 'Status', what: 'Statement', how: 'How', name: 'Test', input: 'Input', expected: 'Expected', got: 'Actual' },
    noClaims: 'The program states nothing to prove. Add «обеспечивает» to a function or an «утверждение».',
    testsPassed: function (n) { return 'Tests passed: ' + n + ' of ' + n; },
    testsFailed: function (bad, n) { return 'Tests failed: ' + bad + ' of ' + n; },
    noTests: 'There are no tests in the program', noTestsLead: 'A test is an «пример» inside a function: «дано» names the arguments, «ожидается» the result.',
    testsHead: 'Tests', callOf: function (fn, args) { return '«' + fn + '»' + (args ? ' with ' + args : ''); },
    draftSaved: 'draft saved in this browser', draftOff: 'the draft is not saved: browser storage is unavailable', draftReset: 'the draft is reset to the starter program',
    libSlow: 'With a library the check takes about 10 s — press «Check».',
    libUnknown: function (name, similar) { return 'There is no module «' + name + '» in the library. Library modules have English names' + (similar.length ? '; similar ones: ' + similar.map(function (x) { return '«' + x + '»'; }).join(', ') : '') + '.'; },
    libList: 'all modules', setups: 'Setups', menu: 'Sections',
    python: {
      note: 'The translator reads a part of Python: functions with whole numbers (int) and True or False (bool), if, elif and else, while, for over range(…) or over a list, return, assignments = += -= *= //= %=, the signs + − * // %, comparisons (a chain too: a < b < c), and, or, not, and calls of your own functions. A parameter without a type is read as int. Division by zero becomes a condition the kernel has to check.',
      foreignLead: 'Write a function in Python. A translator turns it into a flang program, and the kernel checks the result right away.',
      foreignLabel: 'source in Python',
      intNote: 'Whole numbers in Python have no upper limit, so the translation adds no limits either. flang counts them exactly up to 9 007 199 254 740 991; beyond that the result is not exact.',
      refutedLead: function (c) { return 'The condition «' + c.обещание + '» is broken on ' + inputs(c.входы) + '. flang computed this.'; },
      boundsClean: 'not proved; the kernel found no input that breaks it, but that is not a proof'
    }
  }, ru: {
    example: 'Пример', check: 'Проверить', share: 'Поделиться', reset: 'Сбросить', checking: 'проверяю…',
    runGo: 'Запустить', testGo: 'Тесты', running: 'считаю…', fnLabel: 'функция', argsLabel: 'аргументы, JSON', fnHint: 'имя без ёлочек',
    version: function (v) { return 'flang ' + v + ', работает в этой вкладке'; }, versionUnknown: 'компилятор ещё не загружен',
    done: 'Выполнено', notDone: 'Не выполнено', exitCode: 'код возврата ', starters: 'Стартовые программы', pageExamples: 'Примеры этой страницы',
    limitTitle: 'Остановлено: предел шагов', timeoutTitle: 'Остановлено: слишком долго',
    timeoutLead: function (sec) { return 'Запуск шёл дольше ' + sec + ' секунд, и песочница остановила его, чтобы вкладка не зависла. Компилятор загрузится заново при следующем запуске. Проверьте, что функции завершаются, или запустите программу в терминале.'; },
    unprovenLead: '«flang run» не запускает программу, в которой доказано не всё. Исправьте доказательство или запустите без него.', trustGo: 'Запустить без доказательства (--trust)',
    noFunction: 'В тексте нет функции, которую можно запустить.', badArgs: 'Аргументы — не объект JSON; пример: {"н": 21}.',
    needProgram: 'Эта кнопка работает с программой на flang: первая строка — «модуль …».',
    workerDown: 'Компилятор не загрузился. Проверьте связь и обновите страницу; без WebAssembly песочница не работает.',
    starterNames: { hello: 'Первая программа', proof: 'Доказательство индукцией', monad: 'Монада: три закона доказаны', loop: 'Цикл с хранимыми значениями', klass: 'Класс и интерфейс', emitC: 'Генерация кода на C' },
    linkCopied: 'ссылка скопирована: текст в адресе, на сервер не уходит ничего', ms: 'мс',
    tabs: { run: 'Результат', result: 'Проверка', tests: 'Тесты', formula: 'Формулы', emit: 'Код', foreign: 'Перевод', picture: 'Рисунки', terminal: 'Терминал' },
    loading: function (pct) { return 'загружаю компилятор: ' + pct + ' %'; }, ready: 'компилятор загружен', preparing: 'готовлю компилятор…',
    loadNote: 'Первый запуск скачивает компилятор, около 10 МБ. Дальше он берётся из кеша браузера.',
    emitLead: 'Та же программа на другом языке: её генерирует команда «flang emit». Компилятор работает в этой вкладке.',
    emitting: 'генерирую…', emitFailed: 'Код не сгенерирован', emitRefusedLead: '«flang emit» генерирует код только для программы, которая проходит проверку.', runtimeNote: 'Файлы библиотеки времени выполнения копируются как есть и здесь не показаны: ',
    emitFrom: { 'формула': 'Формулу сначала перевели на flang; код сгенерирован из этой программы.', 'рассуждение': 'Рассуждение сначала превратили в программу на flang; код сгенерирован из неё.' },
    emitStale: 'Текст изменился.', print: 'Сгенерировать', emitGo: 'Сгенерировать', emitDone: 'Код сгенерирован',
    foreignLead: 'Напишите функцию на C. Переводчик сделает из неё программу на flang, и ядро сразу её проверит.',
    translateGo: 'Перевести и проверить', translating: 'перевожу…', soon: 'скоро', soonNote: 'Переводчика с Python в этой сборке ещё нет.',
    readFailed: 'Текст не прочитан', notTranslated: 'Не переведена', fnProved: 'Переведена и доказана', fnUnproved: 'Переведена, доказано не всё',
    fnFailed: 'Переведена, проверка не прошла', fnRefuted: 'Переведена: найден контрпример',
    refutedLead: function (c) { return 'Постусловие «' + c.обещание + '» нарушено на входе ' + inputs(c.входы) + '. Это посчитал flang на границах int.'; },
    refuted: function (c) { return 'опровергнуто: ' + inputs(c.входы); }, boundsClean: 'не доказано; на границах int нарушений нет, но это не доказательство',
    intNote: 'Результат объявлен числом: в flang сумма целых — число, поэтому переводчик пишет «возвращает число», а границы int записывает постусловиями.',
    noFunctions: 'В тексте нет определений функций.', inFlang: 'На flang',
    cSubset: 'Подмножество C: int и struct из полей int, if/else, while, for, return, + − * / % и сравнения. Переполнение и деление на ноль становятся условиями, которые ядро должно доказать.',
    foreignLabel: 'исходник на C', fallacy: 'Ошибка: ', card: 'карточка ошибки', hints: 'Возможные ошибки (проверьте сами): ', boundary: 'Чего форма не решает: ', unparsedSentence: 'Не прочитано предложение ',
    editor: 'исходник на flang, рассуждение или формула',
    press: function (word) { return 'Нажмите «' + word + '» или Ctrl+Enter.'; },
    proved: 'Доказано для всех значений', examples: 'Проверено только на тестах', counter: 'Не выполняется: вот контрпример',
    unproved: 'Не доказано', error: 'Ошибка', errorAt: 'Ошибка в строке ', errors: function (n) { return 'Ошибок: ' + n; }, clean: 'Ошибок нет', partial: 'Проверено не всё',
    follows: 'Следует', notRead: 'Текст не прочитан', formulaRefused: 'Формула не прочитана', failed: 'Проверка не запустилась',
    provedLead: 'Каждое утверждение верно на всех входах, а не только на написанных тестах.',
    examplesLead: 'На тестах нарушений нет, но для остальных значений это не доказательство.',
    unprovedLead: 'У части утверждений нет ни доказательства, ни тестов.',
    cleanLead: 'Разбор, типы и завершение в порядке. Доказывать в программе нечего.',
    partialLead: 'Часть объявлений принята, но их устройство компилятор не проверяет.',
    terminal: 'Вывод компилятора, как в терминале', program: 'Программа, в которую превратилось рассуждение', noTerminal: 'Здесь появится вывод компилятора после первого запуска.',
    independent: { ok: 'Независимая проверка: отдельная программа заново прошла запись доказательства, и она сошлась.', bad: 'Независимая проверка не подтвердила запись доказательства.', partial: 'Независимая проверка прошла только часть записи доказательства: для остального у неё нет способа, и эта часть осталась без перепроверки.', imports: 'Независимая проверка программ с «использует» здесь недоступна.', none: '' },
    kinds: { 'утверждение': 'утверждение', 'постусловие': 'постусловие', 'закон': 'закон', 'statement': 'утверждение', 'postcondition': 'постусловие' },
    of: ' функции ', premises: 'посылок', from: ' выводится из ', notFrom: ' не выводится из ', counterexample: 'Контрпример: ',
    line: 'строка ', goLine: function (n) { return 'строка ' + n; }, about: 'справка по этой ошибке',
    noFormula: 'Показывать формулой пока нечего. Проверьте программу с «утверждение» или «обеспечивает».',
    outside: 'Вне записи формул: ', latexSource: 'Исходник LaTeX', toEditor: 'Открыть в редакторе', asFlang: 'На flang', rendered: 'Формула',
    noPicture: 'Рисунки строятся для категорий, функторов, моноидов, множеств и доказательств. В этом тексте их нет.',
    category: 'Категория ', functor: 'Функтор ', monoid: 'Моноид ', sets: 'Множества', proof: 'Доказательство: ',
    square: 'квадрат для ', triangle: 'композиция ', assoc: 'ассоциативность', units: 'единица',
    marks: { proved: 'доказано', examples: 'проверено только на тестах', violated: 'опровергнуто', unproved: 'не доказано', conditional: 'не доказано', unknown: 'не проверялось', passed: 'прошёл', failed: 'не прошёл', error: 'ошибка' },
    induction: 'индукция по ', cases: 'случай ', base: 'база', step: 'шаг', rule: 'правило ', byTypes: 'из объявленных типов аргументов',
    byComputation: 'вычислением замкнутой цели', hypothesis: 'по предположению индукции',
    claim: {
      proved: 'доказано для всех входов', induction: function (c) { return 'доказано индукцией по «' + c.param + '» (тип «' + c.type + '»)'; },
      conditional: 'доказано при условии, которое само не доказано', grid: function (n) { return 'проверено только на тестах: значений ' + n; },
      declared: 'нет ни доказательства, ни тестов — добавьте теорему', refused: 'ядро не смогло вывести цель', violated: 'есть вход, на котором утверждение ложно',
      unchecked: 'не проверялось: компилятор остановился раньше'
    },
    law: function (kind, n) { return (kind === 'моноид' ? 'законы моноида' : kind === 'категория' ? 'законы категории' : 'коммутативность квадратов') + ' проверены на тестах: значений ' + n; },
    lawProved: 'законы доказаны для всех значений', assumed: 'принято без проверки: ',
    lawKinds: { 'категория': 'категория', 'моноид': 'моноид', 'связь': 'функтор', 'преобразование': 'преобразование' },
    cols: { status: 'Статус', what: 'Утверждение', how: 'Как', name: 'Тест', input: 'Вход', expected: 'Ожидалось', got: 'Получено' },
    noClaims: 'Доказывать в программе нечего. Добавьте функции «обеспечивает» или напишите «утверждение».',
    testsPassed: function (n) { return 'Тесты пройдены: ' + n + ' из ' + n; },
    testsFailed: function (bad, n) { return 'Не прошло тестов: ' + bad + ' из ' + n; },
    noTests: 'В программе нет тестов', noTestsLead: 'Тест — это «пример» внутри функции: «дано» называет аргументы, «ожидается» — результат.',
    testsHead: 'Тесты', callOf: function (fn, args) { return '«' + fn + '»' + (args ? ' от ' + args : ''); },
    draftSaved: 'черновик сохранён в этом браузере', draftOff: 'черновик не сохраняется: хранилище браузера недоступно', draftReset: 'черновик сброшен к стартовой программе',
    libSlow: 'С библиотекой проверка занимает около 10 с — нажмите «Проверить».',
    libUnknown: function (name, similar) { return 'Модуля «' + name + '» в библиотеке нет. Модули библиотеки названы по-английски' + (similar.length ? '; похожие: ' + similar.map(function (x) { return '«' + x + '»'; }).join(', ') : '') + '.'; },
    libList: 'все модули', setups: 'Сетапы', menu: 'Разделы',
    python: {
      note: 'Переводчик понимает часть Python: функции с целыми числами (int) и значениями True и False (bool), if, elif и else, while, for по range(…) или по списку, return, присваивания = += -= *= //= %=, знаки + − * // %, сравнения (и цепочкой: a < b < c), and, or, not и вызовы своих функций. Параметр без типа читается как int. Деление на ноль становится условием, которое должно проверить ядро.',
      foreignLead: 'Напишите функцию на Python. Переводчик сделает из неё программу на flang, и ядро сразу её проверит.',
      foreignLabel: 'исходник на Python',
      intNote: 'Целые числа в Python не ограничены сверху, поэтому перевод не добавляет никаких границ. flang считает такие числа точно до 9 007 199 254 740 991; дальше результат неточен.',
      refutedLead: function (c) { return 'Условие «' + c.обещание + '» нарушено на входе ' + inputs(c.входы) + '. Это посчитал flang.'; },
      boundsClean: 'не доказано; ядро не нашло входа, на котором условие нарушено, но это не доказательство'
    }
  } };
  WORDS.en.tabs.argue = 'Reasoning';
  WORDS.ru.tabs.argue = 'Рассуждение';
  WORDS.en.prose = {
    go: 'Check the reasoning', checking: 'reading the text…', example: 'Example', exampleTitle: 'Put the example text into the editor',
    lead: 'Paste a paragraph or a short article in Russian. flang reads it with its own grammar and dictionary, writes the logical form of every sentence it can read, and gives every step of the reasoning to the proof kernel. No language model is called: a sentence the grammar cannot read stays unread, and the reason is shown.',
    more: 'How the check works', moreCommand: 'A long article, with markup written by a language model, is checked by the command flang run-script argue:article in a clone of the repository.',
    source: 'Word features: the OpenCorpora dictionary, CC BY-SA 3.0. The dictionary data on this site is under that license; the flang code is under its own (BSD-2-Clause).',
    count: function (n, max) { return n + ' of ' + max + ' characters'; },
    tooLong: function (max) { return 'The playground takes up to ' + max + ' characters.'; },
    refused: 'The text was not checked',
    state: { parsed: 'parsed', nominal: 'nominal sentence, not a judgment', unparsed: 'not parsed', long: 'too long for the playground', error: 'not parsed' },
    grammarWhy: function (g) { return g.причина + (g.слово ? ': «' + g.слово + '»' : ''); },
    parses: function (n) { return n === 1 ? 'one parse' : n + ' parses'; }, roles: 'roles: ',
    noForm: 'no logical form: ',
    coverage: function (c) { return 'The grammar parsed ' + (c.разобрано + c.назывных) + ' of ' + c.всего + ' sentences' + (c.назывных ? ' (nominal: ' + c.назывных + ')' : '') + (c.длинных ? '; too long: ' + c.длинных : '') + '. A logical form, which the kernel judges, was built for ' + (c.прочитано + c.частично) + '.'; },
    findings: function (n) { return 'Findings: ' + n; }, noFindings: 'No findings in what was read', nothingRead: 'No sentence got a logical form',
    steps: function (a) { return 'Steps of reasoning: ' + a.шагов + '; follows: ' + a.следует + ', does not follow: ' + a.неСледует + ', not decided: ' + a.неРешено + '.'; },
    cut: function (n) { return ' The kernel was not asked ' + n + ' more questions: the playground limit.'; },
    sentences: 'Sentences', form: 'logical form', why: 'why', report: 'Report', draft: 'Draft markup: what the grammar wrote',
    progress: { словарь: 'the dictionary…', разбор: 'reading the sentences…', ядро: function (k, n) { return 'kernel: step ' + k + ' of ' + n; } },
    dictionary: function (d) { return d.файлов ? 'dictionary files read: ' + d.файлов : 'the dictionary did not load: only built-in words and ending guesses'; }
  };
  WORDS.ru.prose = {
    go: 'Проверить рассуждение', checking: 'читаю текст…', example: 'Пример', exampleTitle: 'Поставить в редактор текст-пример',
    lead: 'Вставьте абзац или короткую статью на русском. flang читает её своей грамматикой и словарём, пишет логическую форму каждого предложения, которое смог прочитать, и отдаёт каждый шаг рассуждения ядру доказательств. Языковую модель песочница не вызывает: предложение, которое грамматика не прочла, остаётся непрочитанным, и рядом сказано почему.',
    more: 'Как устроена проверка', moreCommand: 'Длинную статью с разметкой от языковой модели проверяет команда flang run-script argue:article в клоне репозитория.',
    source: 'Признаки слов: словарь OpenCorpora, CC BY-SA 3.0. Данные словаря на этом сайте — под этой лицензией, код flang — под своей (BSD-2-Clause).',
    count: function (n, max) { return n + ' из ' + max + ' знаков'; },
    tooLong: function (max) { return 'Песочница берёт до ' + max + ' знаков.'; },
    refused: 'Текст не проверен',
    state: { parsed: 'разобрано', nominal: 'назывное предложение, не суждение', unparsed: 'не разобрано', long: 'слишком длинное для песочницы', error: 'не разобрано' },
    grammarWhy: function (g) { return g.причина + (g.слово ? ': «' + g.слово + '»' : ''); },
    parses: function (n) { return 'разборов: ' + n; }, roles: 'роли: ',
    noForm: 'логическая форма не построена: ',
    coverage: function (c) { return 'Грамматика разобрала предложений: ' + (c.разобрано + c.назывных) + ' из ' + c.всего + (c.назывных ? ' (назывных: ' + c.назывных + ')' : '') + (c.длинных ? '; слишком длинных: ' + c.длинных : '') + '. Логическая форма, которую судит ядро, построена у ' + (c.прочитано + c.частично) + '.'; },
    findings: function (n) { return 'Находок: ' + n; }, noFindings: 'В прочитанном находок нет', nothingRead: 'Ни у одного предложения нет логической формы',
    steps: function (a) { return 'Шагов рассуждения: ' + a.шагов + '; следует: ' + a.следует + ', не следует: ' + a.неСледует + ', ядро не решило: ' + a.неРешено + '.'; },
    cut: function (n) { return ' Ещё ' + n + ' вопросов ядру не задано: предел песочницы.'; },
    sentences: 'Предложения', form: 'логическая форма', why: 'почему', report: 'Отчёт', draft: 'Черновик разметки: что записала грамматика',
    progress: { словарь: 'словарь…', разбор: 'разбираю предложения…', ядро: function (k, n) { return 'ядро: шаг ' + k + ' из ' + n; } },
    dictionary: function (d) { return d.файлов ? 'прочитано файлов словаря: ' + d.файлов : 'словарь не загрузился: отвечают встроенные слова и догадка по окончанию'; }
  };
  var T = WORDS.ru;
  function useWords(lang) { T = WORDS[lang] || WORDS.ru; return T; }

  /* ── Адрес ──────────────────────────────────────────────────────────────── */
  function addressFields(hash) {
    var out = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (part) {
      var eq = part.indexOf('=');
      var key = eq < 0 ? part : part.slice(0, eq);
      if (!key) return;
      try { out[key] = eq < 0 ? '' : decodeURIComponent(part.slice(eq + 1)); } catch (e) { out[key] = part.slice(eq + 1); }
    });
    return out;
  }
  /* Вид текста по первой значащей строке — то же правило, что у компилятора
     (text-kind.flang). Здесь оно нужно только чтобы выбрать сетап для ссылки,
     в которой сетап не назван; чем проверять текст, решает компилятор. */
  function guessKind(text) {
    var lines = String(text || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (!s || s.indexOf('//') === 0) continue;
      if (/^(модуль|module|категория|category)(\s|$)/.test(s)) return 'flang';
      if (/^(∀|∃|\\forall|\\exists|forall\b|exists\b)/.test(s)) return 'формула';
      return 'рассуждение';
    }
    return 'flang';
  }
  var STARTER_SETUP = { hello: 'first', proof: 'proof', monad: 'proof', loop: 'first', klass: 'first', emitC: 'emit' };
  var TODO_SETUP = { check: 'proof', test: 'tests', run: 'first', emit: 'emit' };
  /* Что открыть по адресу. Поля прежних ссылок (`code`, `text`, `example`,
     `do`, `fn`, `args`, `target`, флаг `run`) читаются как раньше; `setup`
     называет сетап прямо. `text` здесь — уже расшифрованный текст программы
     из `code`/`text` или null. Возвращает null, если адрес ничего не просит. */
  function planOf(fields, text) {
    var f = fields || {};
    var todo = f.do !== undefined ? f.do : f.run !== undefined ? 'check' : '';
    var starter = f.example ? starterOf(f.example) : null;
    var named = f.setup ? setupOf(f.setup) : null;
    var hasText = text !== null && text !== undefined;
    if (!named && !hasText && !starter) return null;
    var key = named ? named.key : null;
    if (!key && hasText && (todo === '' || todo === 'check')) {
      var kind = guessKind(text);
      key = kind === 'рассуждение' ? 'reasoning' : kind === 'формула' ? 'formula' : todo ? 'proof' : 'first';
    }
    if (!key && TODO_SETUP[todo]) key = TODO_SETUP[todo];
    if (!key && starter) key = STARTER_SETUP[starter.key];
    var setup = setupOf(key || 'first');
    return {
      setup: setup.key,
      text: hasText ? text : starter ? starter.text : null,
      fn: f.fn !== undefined ? f.fn : starter && !hasText ? starter.fn || '' : hasText ? '' : null,
      args: f.args !== undefined ? f.args : starter && !hasText ? starter.args || '' : hasText ? '' : null,
      todo: todo,
      target: f.target || (starter && starter.emit) || ''
    };
  }

  /* ── Ответ компилятора → заголовок, отметки, сообщения ──────────────────── */
  function claimState(c) {
    var v = c.verdict || '';
    if (v === 'proved' || v === 'proved-induction') return 'proved';
    if (v === 'violated') return 'violated';
    if (v === 'grid') return 'examples';
    if (v === 'conditional' || v === 'proved-conditional') return 'conditional';
    return 'unproved';
  }
  function claimWords(c) {
    var v = c.verdict || '';
    if (v === 'proved-induction' && c.induction) return T.claim.induction(c.induction);
    if (v === 'proved') return c.byType ? T.claim.proved + ' (' + T.byTypes + ')' : T.claim.proved;
    if (v === 'grid') return T.claim.grid(c.grid || 0);
    if (v === 'conditional' || v === 'proved-conditional') return T.claim.conditional;
    if (v === 'refused') return T.claim.refused;
    if (v === 'violated') return T.claim.violated;
    return T.claim.declared;
  }
  function lawState(l) { return l.verdict === 'violated' ? 'violated' : l.verdict === 'grid' ? 'examples' : l.verdict === 'proved' ? 'proved' : 'unknown'; }

  var VIOLATION = /^FLANG_(EXAMPLE|PROPERTY|EQUALITY_|TRANSFORM_|FUNCTOR_|MONOID_|CATEGORY_|LAW)/;

  /* Сообщения компилятора: по одному на ошибку, без повторов. Код, вложенный
     в текст («FLANG_EXAMPLE: FLANG_PROPERTY: …»), поднимается в код сообщения. */
  function problemsOf(diags) {
    var seen = {}, out = [];
    (diags || []).forEach(function (d) {
      var code = d.код || '', text = String(d.текст || '');
      var inner = /^(FLANG_[A-Z0-9_]+):\s*(.*)$/.exec(text);
      if (inner) { code = inner[1]; text = inner[2]; }
      var key = code + '\u0000' + (d.строка || '') + '\u0000' + text;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ code: code, line: d.строка || null, column: d.столбец || null, text: text });
    });
    return out;
  }
  function problemMarks(list) {
    return list.filter(function (p) { return p.line; }).map(function (p) { return { line: p.line, column: p.column, length: p.length || 0, kind: 'error' }; });
  }
  /* Ненайденный модуль компилятор относит к первой строке файла. Место
     переносится на саму строку «использует «…»» с этим именем. */
  function placeImports(list, text) {
    var lines = String(text || '').split('\n');
    list.forEach(function (p) {
      if (p.code !== 'FLANG_IMPORT_NOT_FOUND') return;
      for (var j = 0; j < lines.length; j++) {
        var m = /^(\s*(?:использует|uses)\s+)«([^»]+)»/u.exec(lines[j]);
        if (m && p.text.indexOf('«' + m[2] + '»') >= 0) { p.line = j + 1; p.column = m[1].length + 1; p.length = m[2].length + 2; return; }
      }
    });
    return list;
  }
  function errorTitle(list) {
    if (list.length > 1) return T.errors(list.length);
    return list[0] && list[0].line ? T.errorAt + list[0].line : T.error;
  }

  /* Функции самого текста: дерево программы с «использует» несёт и функции
     библиотеки, а строки и примеры нужны только свои. */
  function ownNames(text) {
    var names = [], re = /(?:функция|function)\s+«([^»]+)»/gu, m;
    while ((m = re.exec(String(text || '')))) names.push(m[1]);
    return names;
  }
  function ownFunctions(tree, text) {
    var fns = (tree && tree.functions) || [];
    if (text === undefined || text === null) return fns;
    var names = ownNames(text);
    return names.map(function (n) { return fns.filter(function (f) { return f.name === n; })[0]; }).filter(Boolean);
  }
  function firstFunction(text) { return ownNames(text)[0] || ''; }

  function exampleOf(tree, diag) {
    var fns = (tree && tree.functions) || [];
    for (var i = 0; i < fns.length; i++) {
      var f = fns[i];
      if (diag.текст.indexOf('«' + f.name + '»') < 0) continue;
      var exs = f.examples || [];
      for (var j = 0; j < exs.length; j++) if (diag.текст.indexOf('«' + exs[j].name + '»') >= 0) return { fn: f, ex: exs[j] };
    }
    return null;
  }
  function postconditionOf(tree, diag) {
    var fns = (tree && tree.functions) || [];
    for (var i = 0; i < fns.length; i++) {
      var f = fns[i];
      if (diag.текст.indexOf('«' + f.name + '»') < 0) continue;
      var posts = f.postconditions || [];
      for (var j = 0; j < posts.length; j++) if (diag.текст.indexOf('«' + posts[j].name + '»') >= 0) return { fn: f, post: posts[j] };
    }
    return null;
  }
  function valueText(v) {
    if (v === null || v === undefined) return 'ничто';
    if (typeof v === 'string') return '"' + v + '"';
    if (Array.isArray(v)) return '[' + v.map(valueText).join(', ') + ']';
    if (typeof v === 'object') return '{' + Object.keys(v).map(function (k) { return k + ': ' + valueText(v[k]); }).join(', ') + '}';
    return String(v);
  }
  function argsText(args) { return Object.keys(args || {}).map(function (k) { return k + ' = ' + valueText(args[k]); }).join(', '); }
  function lineOf(node) { return (node && node.span && node.span.line) || null; }

  var TIME_LIMIT_MS = 120000;

  /* Итог проверки: заголовок, одна фраза, сообщения об ошибках (каждое один
     раз) и отметки строк. */
  function summarize(answer, text) {
    var r = answer.разбор || {};
    var s = { state: 'error', title: T.failed, lead: '', items: [], marks: [], counter: '', problems: [] };
    if (answer.остановлено) {
      s.title = answer.остановлено === 'время' ? T.timeoutTitle : T.failed;
      s.lead = answer.остановлено === 'время' ? T.timeoutLead(TIME_LIMIT_MS / 1000) : T.workerDown;
      return s;
    }
    if (r.рассуждение) {
      var q = r.рассуждение;
      if (!q.прочитано) {
        s.title = T.notRead; s.items = (q.жалобы || []).map(function (x) { return { state: 'error', text: x }; });
        return s;
      }
      var nums = T.premises + ' ' + (q.номераПосылок || []).join(', ');
      var said = '«' + q.заключение.replace(/^Следовательно,\s*/u, '').replace(/[.!]\s*$/u, '') + '»';
      if (q.приговор === 'Follows') { s.state = 'proved'; s.title = T.follows; s.lead = said + T.from + nums; }
      else if (q.приговор === 'Does not follow') { s.state = 'violated'; s.title = T.counter; s.lead = said + T.notFrom + nums; s.counter = q.контрпример; }
      else { s.state = 'unproved'; s.title = T.unproved; }
      return s;
    }
    if (r.формула && r.формула.code) {
      s.title = T.formulaRefused; s.lead = r.формула.why;
      return s;
    }
    var diags = r.замечания || [];
    var ledger = r.ведомость;
    if (!ledger) {
      if (!diags.length) { s.title = T.failed; s.lead = r.ловушка || ''; return s; }
      var violation = diags.filter(function (d) { return VIOLATION.test(d.код); })[0];
      if (violation) {
        s.state = 'violated'; s.title = T.counter;
        var said1 = problemsOf([violation])[0];
        var hit = exampleOf(r.дерево, violation), post = postconditionOf(r.дерево, violation);
        if (hit) {
          s.counter = '«' + hit.fn.name + '»: ' + argsText(hit.ex.args);
          said1.line = lineOf(hit.ex);
        } else if (post) said1.line = lineOf(post.post);
        if (said1.line) s.marks.push({ line: said1.line, kind: 'fail' });
        if (hit && post && lineOf(post.post)) s.marks.push({ line: lineOf(post.post), kind: 'fail' });
        s.problems = [said1];
        return s;
      }
      s.problems = placeImports(problemsOf(diags), text);
      s.title = errorTitle(s.problems);
      s.marks = problemMarks(s.problems);
      return s;
    }
    var claims = ledger.claims || [];
    var laws = ledger.laws || [];
    var states = [];
    claims.forEach(function (c) {
      var st = claimState(c); states.push(st);
      var who = (T.kinds[c.kind] || c.kind) + ' «' + c.name + '»' + (c.of ? T.of + '«' + c.of + '»' : '');
      s.items.push({ state: st, text: who + ' — ' + claimWords(c) });
    });
    var lawProved = ledger.lawClaims && ledger.lawClaims.total > 0 && ledger.lawClaims.proved === ledger.lawClaims.total;
    laws.forEach(function (l) {
      var st = lawProved && l.verdict === 'grid' ? 'proved' : lawState(l); states.push(st);
      var kind = T.lawKinds[l.kind] || l.kind;
      s.items.push({ state: st, text: kind + ' «' + l.name + '» — ' + (st === 'proved' ? T.lawProved : T.law(l.kind, (l.grid && l.grid.values) || 0)) });
    });
    (ledger.assumed || []).forEach(function (a) { states.push('unproved'); s.items.push({ state: 'unproved', text: T.assumed + (a.name || a.claim || JSON.stringify(a)) }); });
    var has = function (x) { return states.indexOf(x) >= 0; };
    if (has('violated')) { s.state = 'violated'; s.title = T.counter; }
    else if (has('unproved') || has('conditional')) { s.state = 'unproved'; s.title = T.unproved; s.lead = T.unprovedLead; }
    else if (has('examples')) { s.state = 'examples'; s.title = T.examples; s.lead = T.examplesLead; }
    else if (states.length) { s.state = 'proved'; s.title = T.proved; s.lead = T.provedLead; }
    else { s.state = 'proved'; s.title = T.clean; s.lead = T.cleanLead; }
    if (answer.код === 2 && s.state === 'proved') { s.state = 'unproved'; s.title = T.partial; s.lead = T.partialLead; }
    return s;
  }

  /* Панель доказательств: по строке на каждое постусловие, утверждение и
     закон. У строки статус (доказано / проверено только на тестах / не
     доказано / опровергнуто), слова о том, как это получено, и номер строки
     исходника. Когда компилятор остановился на нарушении и отчёта нет,
     строки берутся из дерева разбора: нарушенное — «опровергнуто» с ответом
     компилятора, остальные — «не проверялось». */
  function proofRows(answer, text) {
    var r = answer.разбор || {}, tree = r.дерево, ledger = r.ведомость, rows = [];
    var fns = ownFunctions(tree, text), statements = (tree && tree.statements) || [];
    function lineFor(kind, name, of) {
      if (of) {
        var f = fns.filter(function (x) { return x.name === of; })[0];
        var p = f && (f.postconditions || []).filter(function (x) { return x.name === name; })[0];
        return lineOf(p) || lineOf(f);
      }
      return lineOf(statements.filter(function (x) { return x.name === name; })[0]);
    }
    if (ledger) {
      (ledger.claims || []).forEach(function (c) {
        rows.push({ state: claimState(c), kind: T.kinds[c.kind] || c.kind, name: c.name, of: c.of || '', how: claimWords(c), line: lineFor(c.kind, c.name, c.of), counter: '' });
      });
      var lawProved = ledger.lawClaims && ledger.lawClaims.total > 0 && ledger.lawClaims.proved === ledger.lawClaims.total;
      (ledger.laws || []).forEach(function (l) {
        var st = lawProved && l.verdict === 'grid' ? 'proved' : lawState(l);
        rows.push({ state: st, kind: T.lawKinds[l.kind] || l.kind, name: l.name, of: '', how: st === 'proved' ? T.lawProved : T.law(l.kind, (l.grid && l.grid.values) || 0), line: null, counter: '' });
      });
      (ledger.assumed || []).forEach(function (a) {
        rows.push({ state: 'unproved', kind: '', name: a.name || a.claim || JSON.stringify(a), of: '', how: T.assumed.replace(/:\s*$/, ''), line: null, counter: '' });
      });
      return rows;
    }
    var broken = (r.замечания || []).filter(function (d) { return VIOLATION.test(d.код); });
    function brokenBy(name, of) {
      return broken.filter(function (d) { return d.текст.indexOf('«' + name + '»') >= 0 && (!of || d.текст.indexOf('«' + of + '»') >= 0); })[0];
    }
    fns.forEach(function (f) {
      (f.postconditions || []).forEach(function (p) {
        var hit = brokenBy(p.name, f.name);
        rows.push({ state: hit ? 'violated' : 'unknown', kind: T.kinds['постусловие'], name: p.name, of: f.name, how: hit ? T.claim.violated : T.claim.unchecked, line: lineOf(p), counter: '' });
      });
    });
    statements.forEach(function (st) {
      var hit = brokenBy(st.name, '');
      rows.push({ state: hit ? 'violated' : 'unknown', kind: T.kinds['утверждение'], name: st.name, of: '', how: hit ? T.claim.violated : T.claim.unchecked, line: lineOf(st), counter: '' });
    });
    return rows;
  }

  function independentWords(answer, text) {
    var r = answer.разбор || {};
    if (!r.сверка || r.сверка.код === null || r.сверка.код === undefined) return '';
    if (r.сверка.код === 0) return T.independent.ok;
    if (r.сверка.код === 3) return T.independent.partial;
    if (/использует/.test(text)) return T.independent.imports;
    var proved = ((r.ведомость && r.ведомость.claims) || []).some(function (c) { return claimState(c) === 'proved'; });
    return proved || r.рассуждение ? T.independent.bad : '';
  }

  /* Таблица тестов: имя, вход и ожидаемое — из дерева разбора; прошёл тест или
     нет и что получено — из ответа `flang test`. Строка ответа о несошедшемся
     тесте называет функцию и тест в ёлочках; полученное значение стоит в ней
     после последнего «получено». Если формат строки сменится, вместо значения
     в ячейке окажется вся строка компилятора — таблица не опустеет. */
  function testRows(answer, text) {
    var lines = String(answer.вывод || '').split('\n'), rows = [];
    ownFunctions(answer.дерево, text).forEach(function (f) {
      (f.examples || []).forEach(function (ex) {
        var said = lines.filter(function (l) { return l.indexOf('«' + ex.name + '»') >= 0 && l.indexOf('«' + f.name + '»') >= 0; })[0];
        var got = said ? /(?:получено|got)\s+(.*)$/u.exec(said) : null;
        rows.push({
          state: said ? 'failed' : answer.код === 0 || answer.код === 1 ? 'passed' : 'unknown',
          fn: f.name, name: ex.name, input: argsText(ex.args), expected: valueText(ex.expected),
          got: said ? (got ? got[1] : said) : answer.код === 0 || answer.код === 1 ? valueText(ex.expected) : '', line: lineOf(ex)
        });
      });
    });
    return rows;
  }

  /* Ответ на команду (`run`, `test`, `emit`) или проверку — одним видом для
     страницы: состояние, заголовок, фраза, сообщения, отметки строк и строки
     таблиц. Заголовок не бывает пустым: страница ставит его в строку состояния
     вместо «проверяю…». */
  function present(action, answer, text) {
    answer = answer || {};
    var v = { action: action, state: 'error', title: '', lead: '', counter: '', items: [], problems: [], marks: [], rows: [], tests: [], value: '', call: '', retry: false, terminal: '' };
    if (action === 'check') {
      var s = summarize(answer, text);
      v.state = s.state; v.title = s.title; v.lead = s.lead; v.counter = s.counter; v.items = s.items; v.problems = s.problems; v.marks = s.marks;
      v.rows = (answer.разбор || {}).рассуждение || (answer.разбор || {}).формула && (answer.разбор || {}).формула.code ? [] : proofRows(answer, text);
      v.note = independentWords(answer, String(text || ''));
      v.terminal = String((answer.разбор || {}).терминал || answer.вывод || '').trim();
      return v;
    }
    v.terminal = ((answer.команда ? '$ ' + answer.команда + '\n' : '') + String(answer.вывод || '')).trim();
    if (answer.остановлено) {
      v.title = answer.остановлено === 'время' ? T.timeoutTitle : T.notDone;
      v.lead = answer.остановлено === 'время' ? T.timeoutLead(TIME_LIMIT_MS / 1000) : T.workerDown;
      return v;
    }
    v.problems = placeImports(problemsOf(answer.замечания).filter(function (p) { return p.code !== 'FLANG_PLAYGROUND'; }), text);
    v.marks = problemMarks(v.problems);
    if (action === 'test') {
      v.tests = testRows(answer, text);
      var bad = v.tests.filter(function (t) { return t.state === 'failed'; });
      bad.forEach(function (t) { if (t.line) v.marks.push({ line: t.line, kind: 'fail' }); });
      if (v.problems.length) v.title = errorTitle(v.problems);
      else if (answer.вид && answer.вид !== 'flang' && answer.вид !== 'категория') { v.title = T.notDone; v.lead = T.needProgram; }
      else if (answer.код !== 0 && answer.код !== 1) { v.title = T.notDone; v.lead = T.exitCode + answer.код; }
      else if (!v.tests.length) { v.state = 'unproved'; v.title = T.noTests; v.lead = T.noTestsLead; }
      else if (bad.length || answer.код !== 0) {
        if (!bad.length) v.tests.forEach(function (t) { t.state = 'unknown'; t.got = ''; });
        v.state = 'violated'; v.title = T.testsFailed(bad.length || v.tests.length, v.tests.length);
      }
      else { v.state = 'proved'; v.title = T.testsPassed(v.tests.length); }
      return v;
    }
    if (action === 'emit') {
      var files = answer.файлы || [];
      if (answer.код === 0 && files.length) { v.state = 'proved'; v.title = T.emitDone; }
      else { v.title = v.problems.length ? errorTitle(v.problems) : T.emitFailed; v.lead = v.problems.length ? '' : T.emitRefusedLead; }
      return v;
    }
    v.value = String(answer.стандартный || '').trim();
    if (answer.предел) { v.title = T.limitTitle; v.lead = T.exitCode + answer.код; }
    else if (answer.код === 0) { v.state = 'proved'; v.title = T.done; }
    else if (answer.код === 3) { v.state = 'unproved'; v.title = T.notDone; v.lead = T.unprovenLead; v.retry = true; }
    else if (v.problems.length) v.title = errorTitle(v.problems);
    else if (answer.вид && answer.вид !== 'flang' && answer.вид !== 'категория') { v.title = T.notDone; v.lead = T.needProgram; }
    else { v.title = T.notDone; v.lead = T.exitCode + answer.код; }
    return v;
  }

  /* Что запустить кнопкой «Запустить», когда поля пусты: первая функция
     текста и аргументы её первого теста. Поле, заполненное человеком, не
     трогается. */
  function callOf(tree, text, fn, args) {
    var name = String(fn || '').trim().replace(/^«|»$/g, '') || firstFunction(text);
    var f = ownFunctions(tree, text).filter(function (x) { return x.name === name; })[0];
    var out = { fn: name, args: String(args || '').trim() };
    if (!out.args && f && (f.params || []).length && (f.examples || []).length) out.args = JSON.stringify(f.examples[0].args || {});
    return out;
  }

  /* Слово под ошибкой: от столбца до конца слова, имя в ёлочках — целиком. */
  var LETTER = /[\p{L}\p{N}_]/u;
  function wordAt(lineText, column) {
    var s = String(lineText || ''), i = Math.max(0, (column || 1) - 1);
    if (!s.length) return [0, 0];
    if (i >= s.length) return [s.length - 1, s.length];
    var e = i + 1;
    if (s[i] === '«') { e = s.indexOf('»', i); e = e < 0 ? s.length : e + 1; }
    else if (LETTER.test(s[i])) while (e < s.length && LETTER.test(s[e])) e += 1;
    return [i, e];
  }

  /* Модули библиотеки названы по-английски. «использует «Списки»» компилятор
     не найдёт; подсказка называет похожие модули. Похожесть: совпадение без
     учёта регистра, общее начало слова или русская основа из словаря ниже. */
  var STEMS = [['спис', 'list'], ['строк', 'string'], ['числ', 'number'], ['множеств', 'set'], ['словар', 'dictionar'], ['дерев', 'tree'],
    ['логик', 'logic'], ['дат', 'date'], ['врем', 'time'], ['рациональн', 'rational'], ['дроб', 'rational'], ['статистик', 'statistic'],
    ['результат', 'result'], ['возможн', 'optional'], ['необязательн', 'optional'], ['автомат', 'automaton'], ['математик', 'math'],
    ['текст', 'text'], ['хеш', 'hash'], ['хэш', 'hash'], ['таблиц', 'hash'], ['реестр', 'registry'], ['формат', 'format'], ['юникод', 'unicode'],
    ['высш', 'higher'], ['больш', 'bignum'], ['json', 'json']];
  function libraryHint(text, modules) {
    var known = modules || [], lines = String(text || '').split('\n');
    if (!known.length) return null;
    for (var j = 0; j < lines.length; j++) {
      var m = /^(\s*(?:использует|uses)\s+)«([^»]+)»(\s+(?:из|from)\s+")?/u.exec(lines[j]);
      if (!m || m[3] || known.indexOf(m[2]) >= 0) continue;
      var low = m[2].toLowerCase(), wanted = [low];
      STEMS.forEach(function (p) { if (low.indexOf(p[0]) >= 0) wanted.push(p[1]); });
      var rank = function (k) {
        var kl = k.toLowerCase(), best = 9;
        wanted.forEach(function (w, n) {
          if (n === 0 && (kl === w || (w.length > 2 && (kl.indexOf(w) === 0 || w.indexOf(kl) === 0)))) best = 0;
          else if (n > 0 && kl.indexOf(w) === 0) best = Math.min(best, 1);
          else if (n > 0 && kl.indexOf(w) > 0) best = Math.min(best, 2);
        });
        return best;
      };
      var similar = known.filter(function (k) { return rank(k) < 9; })
        .sort(function (a, b) { return rank(a) - rank(b) || a.length - b.length || (a < b ? -1 : 1); }).slice(0, 4);
      return { line: j + 1, column: m[1].length + 1, name: m[2], similar: similar, text: T.libUnknown(m[2], similar) };
    }
    return null;
  }
  function usesLibrary(text) { return /^\s*(?:использует|uses)\s/mu.test(String(text || '')); }

  /* ── Свой текст ─────────────────────────────────────────────────────────
     Ответ потока на действие «статья» → что показать: итог, покрытие,
     предложения с пометкой и блоки отчёта. Отчёт приходит текстом Markdown;
     `mdBlocks` раскладывает его на заголовки, цитаты, списки, таблицы и абзацы. */
  var PROSE_LIMIT = 6000;
  function mdBlocks(md) {
    var out = [], last = null;
    String(md || '').split('\n').forEach(function (line) {
      var m;
      if (!line.trim()) { last = null; return; }
      if ((m = /^(#{1,3}) (.*)$/.exec(line))) { out.push({ kind: 'h' + m[1].length, text: m[2] }); last = null; return; }
      if ((m = /^> ?(.*)$/.exec(line))) {
        if (!last || last.kind !== 'quote') { last = { kind: 'quote', lines: [] }; out.push(last); }
        if (m[1].trim()) last.lines.push(m[1]);
        return;
      }
      if (/^\|/.test(line)) {
        if (/^\|[\s|:-]+\|$/.test(line)) return;
        if (!last || last.kind !== 'table') { last = { kind: 'table', rows: [] }; out.push(last); }
        last.rows.push(line.replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/));
        return;
      }
      if ((m = /^- (.*)$/.exec(line))) {
        if (!last || last.kind !== 'list') { last = { kind: 'list', items: [] }; out.push(last); }
        last.items.push(m[1]);
        return;
      }
      if ((m = /^\s+(\S.*)$/.exec(line)) && last && last.kind === 'list') { last.items[last.items.length - 1] += ' ' + m[1]; return; }
      if (last && last.kind === 'p') { last.text += ' ' + line.trim(); return; }
      last = { kind: 'p', text: line.trim() }; out.push(last);
    });
    return out;
  }
  function argueView(answer) {
    var P = T.prose;
    var v = { state: 'error', title: P.refused, lead: '', coverage: '', rows: [], blocks: [], draft: '', dictionary: '', numbers: null, marks: null };
    if (!answer) return v;
    if (answer.остановлено) {
      v.title = answer.остановлено === 'время' ? T.timeoutTitle : T.failed;
      v.lead = answer.остановлено === 'время' ? T.timeoutLead(TIME_LIMIT_MS / 1000) : T.workerDown;
      return v;
    }
    var a = answer.разбор && answer.разбор.статья;
    if (!a) { v.lead = String(answer.отказ || answer.вывод || '').replace(/^FLANG_PLAYGROUND /, ''); return v; }
    var c = a.покрытие;
    v.rows = (a.предложения || []).map(function (p, j) {
      var g = p.грамматика || { состояние: 'error', разборов: 0, причина: '', слово: '', роли: [] };
      var notes = g.состояние === 'parsed' ? [P.parses(g.разборов) + ((g.роли || []).length ? '; ' + P.roles + g.роли.join(', ') : '')]
        : g.состояние === 'unparsed' || g.состояние === 'error' ? [P.grammarWhy(g)] : [];
      return { n: j + 1, text: p.текст, state: g.состояние, label: P.state[g.состояние] || g.состояние, notes: notes,
        form: p.состояние, forms: p.формы || [], reasons: p.состояние === 'read' ? [] : p.причины || [], kinds: p.виды || [] };
    });
    v.coverage = P.coverage(c);
    v.numbers = { sentences: c.всего, parsed: c.разобрано + c.назывных, nominal: c.назывных, read: c.прочитано, partly: c.частично, unread: c.нет, error: c.сбой, findings: a.находок, steps: a.шагов, jobs: a.заданий, asked: a.решено };
    var read = c.прочитано + c.частично;
    v.state = (a.ошибкиРазметки || []).length ? 'error' : a.находок > 0 ? 'violated' : read === 0 ? 'unproved' : 'proved';
    v.title = v.state === 'error' ? P.refused : a.находок > 0 ? P.findings(a.находок) : read === 0 ? P.nothingRead : P.noFindings;
    v.lead = P.steps(a) + (a.заданий > a.решено ? P.cut(a.заданий - a.решено) : '');
    v.blocks = mdBlocks(a.отчёт).filter(function (b) { return b.kind !== 'h1'; });
    v.draft = a.разметка || '';
    v.dictionary = P.dictionary(a.словарь || {});
    return v;
  }

  var PAGE = {
    starters: STARTERS, setups: SETUPS, setupOf: setupOf, setupText: setupText, starterOf: starterOf, words: WORDS, useWords: useWords,
    addressFields: addressFields, guessKind: guessKind, planOf: planOf, present: present, summarize: summarize, proofRows: proofRows,
    testRows: testRows, problemsOf: problemsOf, callOf: callOf, wordAt: wordAt, libraryHint: libraryHint, usesLibrary: usesLibrary,
    firstFunction: firstFunction, argueView: argueView, mdBlocks: mdBlocks, proseExample: PROSE_EXAMPLE
  };
  if (typeof globalThis !== 'undefined') { globalThis.флангЗаготовки = STARTERS; globalThis.флангСтраница = PAGE; }
  if (typeof document === 'undefined') return;
  var holder = document.querySelector('main pre.lang-playground');
  if (!holder) return;

  var EN = document.documentElement.lang === 'en';
  var LANG = EN ? 'en' : 'ru';
  useWords(LANG);
  var ROOT = (document.querySelector('.poisk') || { getAttribute: function () { return ''; } }).getAttribute('data-koren') || '';
  /* KaTeX 0.16.11 лежит в дереве (docs/site/vendor/katex, лицензия MIT рядом):
     со стороннего адреса формулы пропадали там, где он закрыт, а без стилей и
     шрифтов разметка KaTeX показывает формулу дважды и вперемешку. */
  var KATEX = ROOT + 'vendor/katex/';
  function jsonBlock(id, otherwise) {
    try {
      var node = document.getElementById(id);
      return node ? JSON.parse(node.textContent) : otherwise;
    } catch (e) {
      return otherwise;
    }
  }
  /* Сборка сайта кладёт на страницу имена модулей библиотеки и коды ошибок,
     у которых есть строка в справочнике. */
  var MODULES = jsonBlock('flang-library', []);
  var CODES = jsonBlock('flang-codes', []);

  /* ── мелочи ─────────────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'; });
  }
  function toAddress(text) {
    var bytes = new TextEncoder().encode(text), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64(word) {
    var s = atob(word.replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  function toBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromAddress(hash) {
    var m = /(?:^#|&)text=([A-Za-z0-9_-]*)/.exec(hash || '');
    if (!m) return null;
    try {
      return new TextDecoder().decode(fromBase64(m[1]));
    } catch (e) {
      return null;
    }
  }
  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function inflate(word) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('DecompressionStream'));
    return pipe(fromBase64(word), new DecompressionStream('deflate-raw')).then(function (b) { return new TextDecoder().decode(b); });
  }
  function addressOf(text) {
    var plain = '#text=' + toAddress(text);
    if (typeof CompressionStream === 'undefined') return Promise.resolve(plain);
    return pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'))
      .then(function (b) { return '#code=' + toBase64(b); })
      .catch(function () { return plain; });
  }

  /* ── подсветка ──────────────────────────────────────────────────────────── */
  var LEXICON = [];
  try {
    var lexNode = document.getElementById('flang-lexicon');
    if (lexNode) LEXICON = JSON.parse(lexNode.textContent);
  } catch (e) {
    LEXICON = [];
  }
  var PHRASES = new Map();
  LEXICON.forEach(function (w) {
    var first = w.split(' ')[0];
    if (!PHRASES.has(first)) PHRASES.set(first, []);
    PHRASES.get(first).push(w);
  });
  PHRASES.forEach(function (list) { list.sort(function (a, b) { return b.length - a.length; }); });

  function segments(src) {
    var out = [], i = 0, n = src.length, plain = '';
    function flush() { if (plain) { out.push([plain, '']); plain = ''; } }
    function push(text, cls) { flush(); out.push([text, cls]); }
    while (i < n) {
      var c = src[i];
      if (c === '/' && src[i + 1] === '/') {
        var e = src.indexOf('\n', i); if (e < 0) e = n;
        push(src.slice(i, e), 'tok-kommentariy'); i = e; continue;
      }
      if (c === '"') {
        var end;
        if (src.slice(i, i + 3) === '"""') { end = src.indexOf('"""', i + 3); end = end < 0 ? n : end + 3; }
        else {
          end = i + 1;
          while (end < n && src[end] !== '"' && src[end] !== '\n') end += src[end] === '\\' ? 2 : 1;
          if (src[end] === '"') end += 1;
        }
        push(src.slice(i, end), 'tok-stroka'); i = end; continue;
      }
      if (c === '«') {
        var close = src.indexOf('»', i);
        var nl = src.indexOf('\n', i);
        if (close < 0 || (nl >= 0 && nl < close)) close = (nl < 0 ? n : nl) - 1;
        push(src.slice(i, close + 1), 'tok-imya'); i = close + 1; continue;
      }
      var prevLetter = i > 0 && LETTER.test(src[i - 1]);
      if (/[0-9]/.test(c) && !prevLetter) {
        var m = /^[0-9]+(?:\.[0-9]+)?/.exec(src.slice(i, i + 40));
        push(m[0], 'tok-chislo'); i += m[0].length; continue;
      }
      if (LETTER.test(c) && !prevLetter) {
        var wm = /^[\p{L}\p{N}_]+/u.exec(src.slice(i, i + 80));
        var word = wm[0], hit = null, list = PHRASES.get(word);
        if (list) {
          for (var k = 0; k < list.length && !hit; k++) {
            var p = list[k];
            if (src.startsWith(p, i) && !LETTER.test(src[i + p.length] || '')) hit = p;
          }
        }
        if (hit) { push(hit, 'tok-slovo'); i += hit.length; }
        else { plain += word; i += word.length; }
        continue;
      }
      plain += c; i += 1;
    }
    flush();
    return out;
  }

  function highlightHtml(src, deco) { return linesHtml(segments(src), deco); }

  /* Подсветка напечатанного и чужих языков: пять тех же видов токенов, что у
     flang (слово, строка, число, комментарий), по таблице слов языка. Это не
     разбор языка, а раскраска: ошибка в ней меняет цвет, а не смысл. */
  var C_WORDS = 'auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false NULL';
  var LANGS = {
    c: { line: '//', block: true, quotes: '"\'', words: C_WORDS + ' include define ifndef ifdef endif pragma' },
    cpp: { line: '//', block: true, quotes: '"\'', words: C_WORDS + ' class namespace template typename public private protected virtual override new delete using nullptr auto constexpr noexcept std this throw try catch operator explicit friend mutable include define ifndef endif pragma' },
    go: { line: '//', block: true, quotes: '"\'`', words: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false error string int int64 bool' },
    rust: { line: '//', block: true, quotes: '"', words: 'as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Some None Ok Err Box Vec String Option Result' },
    java: { line: '//', block: true, quotes: '"\'', words: 'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while true false var String' },
    js: { line: '//', block: true, quotes: '"\'`', words: 'async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield' },
    ts: { line: '//', block: true, quotes: '"\'`', words: 'async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield type interface readonly number string boolean unknown any never as' },
    elixir: { line: '#', block: false, quotes: '"', atoms: true, words: 'def defp defmodule defstruct defmacro do end if else unless case cond with fn when and or not in true false nil import alias require use raise rescue try after receive' },
    python: { line: '#', block: false, quotes: '"\'', triple: true, words: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self' },
    csharp: { line: '//', block: true, quotes: '"\'', words: 'abstract as bool break byte case catch char class const continue decimal default delegate do double else enum false finally for foreach if in int interface internal is long namespace new null object out override params private protected public readonly ref return sealed short static string struct switch this throw true try typeof using var virtual void while' },
    make: { line: '#', block: false, quotes: '', words: '' },
    text: { line: '', block: false, quotes: '', words: '' }
  };
  Object.keys(LANGS).forEach(function (k) { var set = new Set(); LANGS[k].words.split(' ').forEach(function (w) { if (w) set.add(w); }); LANGS[k].set = set; });
  function langOfPath(path) {
    var m = /\.([A-Za-z]+)$/.exec(path), ext = m ? m[1].toLowerCase() : '';
    if (/(^|\/)Makefile$/.test(path) || ext === 'toml' || ext === 'mod') return 'make';
    return { c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', go: 'go', rs: 'rust', java: 'java', js: 'js', mjs: 'js', ts: 'ts', ex: 'elixir', exs: 'elixir', py: 'python', cs: 'csharp' }[ext] || 'text';
  }
  function codeSegments(src, lang) {
    var L = LANGS[lang] || LANGS.text, out = [], i = 0, n = src.length, plain = '';
    function flush() { if (plain) { out.push([plain, '']); plain = ''; } }
    function push(t, cls) { flush(); out.push([t, cls]); }
    while (i < n) {
      var c = src[i], e;
      if (L.line && src.startsWith(L.line, i)) { e = src.indexOf('\n', i); if (e < 0) e = n; push(src.slice(i, e), 'tok-kommentariy'); i = e; continue; }
      if (L.block && c === '/' && src[i + 1] === '*') { e = src.indexOf('*/', i + 2); e = e < 0 ? n : e + 2; push(src.slice(i, e), 'tok-kommentariy'); i = e; continue; }
      if (L.quotes.indexOf(c) >= 0 && c) {
        if (L.triple && src.startsWith(c + c + c, i)) { e = src.indexOf(c + c + c, i + 3); e = e < 0 ? n : e + 3; }
        else {
          e = i + 1;
          while (e < n && src[e] !== c && (c === '`' || src[e] !== '\n')) e += src[e] === '\\' ? 2 : 1;
          if (src[e] === c) e += 1;
        }
        push(src.slice(i, e), 'tok-stroka'); i = e; continue;
      }
      var prev = i > 0 && /[\p{L}\p{N}_]/u.test(src[i - 1]);
      if (L.atoms && c === ':' && /[a-z_]/.test(src[i + 1] || '') && !prev && src[i - 1] !== ':') {
        var am = /^:[a-z_][A-Za-z0-9_]*[?!]?/.exec(src.slice(i, i + 80)); push(am[0], 'tok-stroka'); i += am[0].length; continue;
      }
      if (/[0-9]/.test(c) && !prev) { var nm = /^(0x[0-9a-fA-F_]+|[0-9][0-9_]*(\.[0-9_]+)?([eE][-+]?[0-9]+)?)[A-Za-z0-9]*/.exec(src.slice(i, i + 60)); push(nm[0], 'tok-chislo'); i += nm[0].length; continue; }
      if (/[\p{L}_#]/u.test(c) && !prev) {
        var wm = /^[#]?[\p{L}\p{N}_]+[?!]?/u.exec(src.slice(i, i + 120));
        var w = wm ? wm[0] : c;
        if (L.set.has(w.replace(/^#/, ''))) push(w, 'tok-slovo'); else plain += w;
        i += w.length; continue;
      }
      plain += c; i += 1;
    }
    flush();
    return out;
  }
  /* Раскрашенные строки. `deco.bad` — номера строк, отмеченных целиком;
     `deco.ranges` — по номеру строки отрезок столбцов, подчёркнутый волной. */
  function linesHtml(segs, deco) {
    var bad = deco && deco.bad, ranges = (deco && deco.ranges) || {};
    var lines = [[]], cols = [0];
    function put(text, cls) {
      var j = lines.length - 1, start = cols[j], r = ranges[j + 1], pieces = [[text, false]];
      var a = r ? Math.max(r[0], start) : 0, b = r ? Math.min(r[1], start + text.length) : 0;
      if (r && a < b) pieces = [[text.slice(0, a - start), false], [text.slice(a - start, b - start), true], [text.slice(b - start), false]];
      pieces.forEach(function (p) {
        if (!p[0]) return;
        var c = (cls ? cls : '') + (p[1] ? (cls ? ' ' : '') + 'pg-squiggle' : '');
        lines[j].push(c ? '<span class="' + c + '">' + esc(p[0]) + '</span>' : esc(p[0]));
      });
      cols[j] = start + text.length;
    }
    segs.forEach(function (s) {
      s[0].split('\n').forEach(function (part, j) {
        if (j > 0) { lines.push([]); cols.push(0); }
        if (part) put(part, s[1]);
      });
    });
    return lines.map(function (parts, j) {
      return '<span class="pg-line' + (bad && bad.has(j + 1) ? ' pg-line-bad' : '') + '">' + (parts.join('') || ' ') + '</span>';
    }).join('');
  }
  /* Подсветка рассуждения и формулы. Какой текст в редакторе, решает не эта
     раскраска, а то же правило, что выбирает проверку (text-kind.flang через
     обвязку): страница спрашивает вид у потока с компилятором. Раскраска —
     не разбор: ошибка в ней меняет цвет, а не приговор.
     Рассуждение: связки (все, некоторые, ни один, не, следовательно, значит,
     если…то…) — tok-connective; слова словаря «Понятие:»/«Свойство:» и прочие
     слова предложений — термины (tok-term); «Имя:» и слова с заглавной буквы
     не в начале предложения — имена (tok-name); заголовки словаря — tok-heading.
     Формула: кванторы — tok-quantifier; знаки и команды LaTeX — tok-sign;
     ℕ ℤ ℚ ℝ и \mathbb{…} — tok-term; переменные — tok-name; числа — tok-chislo. */
  var CONNECTIVES = ['ни один', 'ни одна', 'ни одно', 'ни одни', 'так как', 'потому что', 'если', 'то', 'все', 'всё', 'всякий', 'всякая',
    'всякое', 'каждый', 'каждая', 'каждое', 'любой', 'любая', 'любое', 'некоторые', 'некоторый', 'некоторая', 'некоторое', 'не',
    'нет', 'следовательно', 'значит', 'поэтому', 'отсюда', 'итак', 'поскольку', 'и', 'или', 'является', 'являются', 'есть', 'это',
    'all', 'every', 'some', 'no', 'not', 'therefore', 'so', 'hence', 'if', 'then', 'is', 'are', 'and', 'or'];
  var CONNECTIVE_SET = new Set(CONNECTIVES);
  var CONNECTIVE_PHRASES = CONNECTIVES.filter(function (w) { return w.indexOf(' ') > 0; });
  var DICTIONARY = /^(\s*)(Понятие|Свойство|Имя|Concept|Property|Name):/;
  function reasoningSegments(src) {
    var out = [], terms = new Set(), names = new Set();
    src.split('\n').forEach(function (line) {
      var d = DICTIONARY.exec(line);
      if (!d) return;
      var into = /Имя|Name/.test(d[2]) ? names : terms;
      line.slice(d[0].length).split(/[,.;]/).forEach(function (w) { w = w.trim().toLowerCase(); if (w) into.add(w); });
    });
    var lines = src.split('\n');
    lines.forEach(function (line, j) {
      if (j > 0) out.push(['\n', '']);
      var d = DICTIONARY.exec(line);
      var rest = line, cls = null;
      if (d) {
        out.push([d[1], '']); out.push([d[2] + ':', 'tok-heading']);
        rest = line.slice(d[0].length); cls = /Имя|Name/.test(d[2]) ? 'tok-name' : 'tok-term';
      }
      var i = 0, startOfSentence = !d && (j === 0 || /[.!?]\s*$/.test(lines[j - 1]) || !lines[j - 1].trim());
      while (i < rest.length) {
        var c = rest[i];
        if (!LETTER.test(c)) {
          var k = i; while (k < rest.length && !LETTER.test(rest[k])) k += 1;
          var gap = rest.slice(i, k);
          out.push([gap, /—/.test(gap) && !cls ? 'tok-connective' : '']);
          if (/[.!?]/.test(gap)) startOfSentence = true;
          i = k; continue;
        }
        var wm = /^[\p{L}\p{N}_-]+/u.exec(rest.slice(i, i + 80)), word = wm[0], low = word.toLowerCase();
        if (cls) { out.push([word, cls]); i += word.length; continue; }
        var phrase = null;
        for (var q = 0; q < CONNECTIVE_PHRASES.length && !phrase; q++) {
          var ph = CONNECTIVE_PHRASES[q];
          if (rest.slice(i, i + ph.length).toLowerCase() === ph && !LETTER.test(rest[i + ph.length] || '')) phrase = rest.slice(i, i + ph.length);
        }
        if (phrase) { out.push([phrase, 'tok-connective']); i += phrase.length; startOfSentence = false; continue; }
        var kind = CONNECTIVE_SET.has(low) ? 'tok-connective'
          : names.has(low) || (!startOfSentence && /^\p{Lu}/u.test(word)) ? 'tok-name'
          : 'tok-term';
        out.push([word, kind]); i += word.length; startOfSentence = false;
      }
    });
    return out;
  }
  var QUANTIFIER = /^(∀|∃|\\forall\b|\\exists\b|forall\b|exists\b)/;
  var SETS = /^(ℕ|ℤ|ℚ|ℝ|\\mathbb\{[A-Za-z]\})/;
  function formulaSegments(src) {
    var out = [], i = 0;
    while (i < src.length) {
      var rest = src.slice(i, i + 40), m;
      if ((m = QUANTIFIER.exec(rest))) { out.push([m[0], 'tok-quantifier']); i += m[0].length; continue; }
      if ((m = SETS.exec(rest))) { out.push([m[0], 'tok-term']); i += m[0].length; continue; }
      if ((m = /^\\[A-Za-z]+|^\\[,;! ]/.exec(rest))) { out.push([m[0], 'tok-sign']); i += m[0].length; continue; }
      if ((m = /^[0-9]+(?:\.[0-9]+)?/.exec(rest))) { out.push([m[0], 'tok-chislo']); i += m[0].length; continue; }
      if ((m = /^[\p{L}_][\p{L}\p{N}_']*/u.exec(rest))) { out.push([m[0], CONNECTIVE_SET.has(m[0]) ? 'tok-connective' : 'tok-name']); i += m[0].length; continue; }
      if (/\s/.test(src[i])) { out.push([src[i], '']); i += 1; continue; }
      out.push([src[i], 'tok-sign']); i += 1;
    }
    return out;
  }
  function codeHtml(src, lang, deco) {
    if (lang === 'flang') return highlightHtml(src, deco);
    if (lang === 'reasoning') return linesHtml(reasoningSegments(src), deco);
    if (lang === 'formula') return linesHtml(formulaSegments(src), deco);
    return linesHtml(codeSegments(src, lang), deco);
  }
  function codeBlock(src, lang) {
    var pre = el('pre', 'lang-' + lang), code = el('code');
    code.innerHTML = codeHtml(src, lang, null);
    pre.appendChild(code);
    return pre;
  }

  /* ── KaTeX из дерева, по требованию ─────────────────────────────────────
     Формула показывается вёрсткой только когда пришли и скрипт, и стили:
     разметка KaTeX без стилей читается как мусор. Не пришло что-то одно —
     остаётся запись формулы обычным текстом (запасной вид), исходник LaTeX
     свёрнут под ней. */
  var katexLoading = null;
  function katex() {
    if (window.katex && katexStyled) return Promise.resolve(window.katex);
    if (!katexLoading) {
      katexLoading = new Promise(function (resolve, reject) {
        var left = 2, failed = false;
        function done() { left -= 1; if (left === 0 && !failed) { katexStyled = true; resolve(window.katex); } }
        function fail() { if (!failed) { failed = true; katexLoading = null; reject(new Error('katex')); } }
        var css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = KATEX + 'katex.min.css';
        css.onload = done; css.onerror = fail;
        document.head.appendChild(css);
        var s = document.createElement('script');
        s.src = KATEX + 'katex.min.js';
        s.onload = function () { if (window.katex) done(); else fail(); };
        s.onerror = fail;
        document.head.appendChild(s);
      });
    }
    return katexLoading;
  }
  var katexStyled = false;
  function texBlock(tex, plain) {
    var box = el('div', 'pg-tex');
    var fallback = el('p', 'pg-formula-plain', plain || tex);
    box.appendChild(fallback);
    var d = el('details', 'pg-tex-raw');
    d.appendChild(el('summary', null, T.latexSource));
    d.appendChild(el('code', 'pg-tex-source', tex));
    if (plain) box.appendChild(d);
    katex().then(function (k) {
      var shown = el('div', 'pg-tex-shown');
      try {
        k.render(tex, shown, { throwOnError: true, displayMode: true, strict: 'ignore', output: 'htmlAndMathml' });
      } catch (e) { return; /* формула вне KaTeX — остаётся текст */ }
      box.insertBefore(shown, box.firstChild);
      fallback.hidden = true;
      if (!d.parentNode) box.appendChild(d);
      box.setAttribute('data-tex', 'rendered');
    }, function () { box.setAttribute('data-tex', 'text'); });
    return box;
  }

  /* ── разметка рабочего места ────────────────────────────────────────────── */
  /* Языки, с которых песочница переводит во flang. Один язык — одна строка;
     готовым язык делает переводчик в сборке песочницы (`ПЕРЕВОДЧИКИ` в
     обвязке). Неготовый показан кнопкой с подписью «скоро». */
  var FOREIGN = [
    { lang: 'c', name: 'C', ready: true, note: function () { return T.cSubset; } },
    { lang: 'python', name: 'Python', ready: true, note: function () { return T.python.note; } }
  ];
  /* Слово вкладки перевода для выбранного языка: у Python свои, у C — общие. */
  function foreignWord(key) { return (foreignState.lang === 'python' && T.python[key]) || T[key]; }
  var examples = [];
  STARTERS.forEach(function (st) {
    examples.push({ name: T.starterNames[st.key], text: st.text, lang: 'flang', starter: st.slug || st.key, fn: st.fn || '', args: st.args || '', emit: st.emit || '' });
  });
  var blocks = document.querySelectorAll('main pre');
  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    if (blk === holder) continue;
    var txt = blk.textContent;
    var foreign = FOREIGN.filter(function (f) { return f.ready && blk.classList.contains('lang-' + f.lang) && blk.hasAttribute('data-playground-title'); })[0];
    var ok = foreign || blk.classList.contains('lang-text') || (blk.classList.contains('lang-flang') && /^\s*(модуль|категория)\s/.test(txt));
    if (!ok) continue;
    var before = blk.previousElementSibling;
    var name = blk.getAttribute('data-playground-title') ||
      (before && before.tagName === 'P' ? before.textContent.split(/[:.]/)[0].trim() : '');
    examples.push({ name: name || (T.example + ' ' + (examples.length + 1)), text: txt, lang: foreign ? foreign.lang : 'flang' });
  }

  var root = el('div', 'playground');
  holder.replaceWith(root);
  var current = SETUPS[0];

  /* Плитки сетапов: обычные ссылки `#setup=<key>`, открывает их тот же код,
     что читает адрес при загрузке. */
  var setupBar = el('nav', 'pg-setups'); setupBar.setAttribute('aria-label', T.setups);
  var setupTiles = {};
  SETUPS.forEach(function (s) {
    var a = el('a', 'pg-setup'); a.href = '#setup=' + s.key; a.setAttribute('data-setup', s.key);
    a.appendChild(el('span', 'pg-setup-name', s.name[LANG]));
    a.appendChild(el('span', 'pg-setup-note', s.note[LANG]));
    setupBar.appendChild(a); setupTiles[s.key] = a;
  });

  var bar = el('div', 'playground-bar');
  var actionBox = el('div', 'pg-actions');
  var ACTIONS = { run: T.runGo, check: T.check, test: T.testGo, emit: T.emitGo, translate: T.translateGo, argue: T.prose.go };
  var actionButtons = {};
  Object.keys(ACTIONS).forEach(function (k) {
    var bt = el('button', 'pg-action playground-' + k, ACTIONS[k]); bt.type = 'button'; bt.setAttribute('data-action', k);
    bt.addEventListener('click', function () { doAction(k, false); });
    actionButtons[k] = bt;
  });
  var select = el('select', 'playground-examples');
  select.setAttribute('aria-label', T.example);
  var groups = { starter: el('optgroup'), page: el('optgroup') };
  groups.starter.label = T.starters; groups.page.label = T.pageExamples;
  var placeholder = el('option', null, T.example + '…'); placeholder.value = ''; placeholder.disabled = true;
  select.appendChild(placeholder);
  examples.forEach(function (ex, j) {
    var o = el('option', null, ex.name); o.value = String(j);
    groups[ex.starter ? 'starter' : 'page'].appendChild(o);
  });
  select.appendChild(groups.starter);
  if (groups.page.children.length) select.appendChild(groups.page);
  select.value = '';
  var shareButton = el('button', 'pg-tool playground-share', T.share); shareButton.type = 'button';
  var resetButton = el('button', 'pg-tool playground-reset', T.reset); resetButton.type = 'button';
  var tools = el('div', 'pg-tools');
  tools.appendChild(select); tools.appendChild(shareButton); tools.appendChild(resetButton);
  bar.appendChild(actionBox); bar.appendChild(tools);

  var callBar = el('div', 'playground-call');
  var fnInput = el('input', 'playground-fn'); fnInput.type = 'text'; fnInput.placeholder = T.fnHint;
  fnInput.setAttribute('aria-label', T.fnLabel); fnInput.spellcheck = false; fnInput.setAttribute('autocapitalize', 'off');
  var argsInput = el('input', 'playground-args'); argsInput.type = 'text'; argsInput.placeholder = '{"н": 21}';
  argsInput.setAttribute('aria-label', T.argsLabel); argsInput.spellcheck = false; argsInput.setAttribute('autocapitalize', 'off');
  var fnWrap = el('label', 'playground-field', T.fnLabel + ' '); fnWrap.appendChild(fnInput);
  var argsWrap = el('label', 'playground-field playground-field-wide', T.argsLabel + ' '); argsWrap.appendChild(argsInput);
  callBar.appendChild(fnWrap); callBar.appendChild(argsWrap);

  var statusBar = el('div', 'pg-statusbar');
  var status = el('span', 'playground-status'); status.setAttribute('role', 'status');
  var hintLine = el('span', 'pg-hintline');
  var draftNote = el('span', 'pg-draft');
  var versionNote = el('span', 'playground-version', T.versionUnknown);
  statusBar.appendChild(status); statusBar.appendChild(hintLine); statusBar.appendChild(draftNote); statusBar.appendChild(versionNote);

  /* Редактор: прозрачное поле ввода над раскрашенной копией текста и столбец
     номеров строк слева. Ошибка с известным столбцом подчёркивает слово;
     несошедшийся тест и ошибка без столбца отмечают строку. Правки клавишами
     (Tab, Enter, ёлочки) идут через `insertText` — отмена браузера их помнит.

     Шов для настоящего редактора: остальной код знает редактор только по
     этому набору — `root`, `input.value`, `set`, `mark`, `goTo`, `onEdit`,
     `lang`, `repaint`. Замена поля ввода на CodeMirror — новая `makeEditor`
     с теми же шестью именами. */
  var OPENER = /^\s*(?:(?:тотальная\s+)?функция|пример|разбор|случай|цикл|класс|интерфейс|тип|метод|утверждение|теорема|монада|моноид|объект|категория\s+«)/u;
  function makeEditor(lang, label, onRun, smart) {
    var box = el('div', 'pg-editor');
    var gutter = el('pre', 'pg-gutter'); gutter.setAttribute('aria-hidden', 'true');
    var paintLayer = el('pre', 'pg-paint'); paintLayer.setAttribute('aria-hidden', 'true');
    var area = el('textarea', 'playground-input');
    area.spellcheck = false; area.setAttribute('wrap', 'off'); area.setAttribute('aria-label', label);
    area.setAttribute('autocapitalize', 'off'); area.setAttribute('autocomplete', 'off'); area.setAttribute('autocorrect', 'off');
    box.appendChild(gutter); box.appendChild(paintLayer); box.appendChild(area);
    var ed = { root: box, input: area, marks: [], lang: lang };
    function deco() {
      var bad = new Set(), ranges = {}, lines = null;
      ed.marks.forEach(function (m) {
        if (!m.line) return;
        if (!m.column) { bad.add(m.line); return; }
        lines = lines || area.value.split('\n');
        if (!ranges[m.line]) ranges[m.line] = m.length ? [m.column - 1, m.column - 1 + m.length] : wordAt(lines[m.line - 1], m.column);
      });
      return { bad: bad, ranges: ranges };
    }
    ed.repaint = function () {
      var marked = new Set(ed.marks.map(function (m) { return m.line; }));
      paintLayer.innerHTML = codeHtml(area.value, ed.lang, deco()) + '<span class="pg-line"> </span>';
      var count = area.value.split('\n').length, html = '';
      for (var j = 1; j <= count; j++) html += '<span class="pg-num' + (marked.has(j) ? ' pg-num-bad' : '') + '">' + j + '</span>';
      gutter.innerHTML = html + '<span class="pg-num"> </span>';
      ed.sync();
    };
    ed.sync = function () {
      paintLayer.scrollTop = area.scrollTop; paintLayer.scrollLeft = area.scrollLeft;
      gutter.scrollTop = area.scrollTop;
    };
    ed.set = function (text) { area.value = text; ed.marks = []; area.scrollTop = 0; ed.repaint(); };
    ed.mark = function (list) { ed.marks = (list || []).filter(function (m) { return m && m.line; }); ed.repaint(); };
    ed.goTo = function (line, column) {
      var all = area.value.split('\n'), pos = 0;
      for (var j = 0; j < line - 1 && j < all.length; j++) pos += all[j].length + 1;
      pos += Math.max(0, Math.min((column || 1) - 1, (all[line - 1] || '').length));
      area.focus(); area.selectionStart = area.selectionEnd = pos;
      var lh = parseFloat(getComputedStyle(area).lineHeight) || 18;
      area.scrollTop = Math.max(0, (line - 3) * lh);
    };
    /* Вставка, которую помнит отмена: `insertText` кладёт правку в историю
       поля. Где команды нет, текст меняется напрямую — без истории, но верно. */
    function insert(text, from, to, caret) {
      area.focus(); area.setSelectionRange(from, to);
      var done = false;
      try { done = document.execCommand(text === '' ? 'delete' : 'insertText', false, text); } catch (e) { done = false; }
      if (!done) { area.setRangeText(text, from, to, 'end'); area.dispatchEvent(new Event('input', { bubbles: true })); }
      if (caret !== undefined) area.setSelectionRange(caret, caret);
    }
    ed.insert = insert;
    function lineStart(pos) { return area.value.lastIndexOf('\n', pos - 1) + 1; }
    function indentBlock(s, e, out) {
      var from = lineStart(s), to = area.value.indexOf('\n', Math.max(e - 1, s)); if (to < 0) to = area.value.length;
      var linesIn = area.value.slice(from, to).split('\n');
      var linesOut = linesIn.map(function (l) { return out ? l.replace(/^ {1,2}/, '') : (l ? '  ' + l : l); });
      var first = linesOut[0].length - linesIn[0].length, textOut = linesOut.join('\n');
      insert(textOut, from, to);
      area.setSelectionRange(Math.max(from, s + first), from + textOut.length);
    }
    var fixing = false;
    area.addEventListener('input', function (ev) {
      /* `<<` → «…», `>>` → »: ёлочки набираются с любой раскладки. */
      if (smart && !fixing && !ev.isComposing && area.selectionStart === area.selectionEnd) {
        var c = area.selectionStart, two = area.value.slice(c - 2, c);
        if (two === '<<' || two === '>>') {
          fixing = true;
          if (two === '<<') insert('«»', c - 2, c, c - 1);
          else if (area.value[c] === '»') insert('', c - 2, c, c - 1);
          else insert('»', c - 2, c);
          fixing = false;
          return;
        }
      }
      if (fixing) return;
      ed.marks = []; ed.repaint(); if (ed.onEdit) ed.onEdit();
    });
    area.addEventListener('scroll', ed.sync);
    area.addEventListener('keydown', function (ev) {
      var s = area.selectionStart, e = area.selectionEnd, v = area.value;
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); onRun(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
      if (ev.key === 'Tab') {
        ev.preventDefault();
        if (ev.shiftKey || v.slice(s, e).indexOf('\n') >= 0) indentBlock(s, e, ev.shiftKey);
        else insert('  ', s, e);
      } else if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        var head = v.slice(lineStart(s), s), pad = /^[ \t]*/.exec(head)[0];
        if (smart && ed.lang === 'flang' && OPENER.test(head)) pad += '  ';
        insert('\n' + pad, s, e);
      } else if (smart && ev.key === '«') {
        ev.preventDefault();
        insert('«' + v.slice(s, e) + '»', s, e, s === e ? s + 1 : undefined);
      } else if (smart && ev.key === '»' && s === e && v[s] === '»') {
        ev.preventDefault(); area.setSelectionRange(s + 1, s + 1);
      } else if (smart && ev.key === 'Backspace' && s === e && v[s - 1] === '«' && v[s] === '»') {
        ev.preventDefault(); insert('', s - 1, s + 1);
      }
    });
    return ed;
  }

  var main = makeEditor('flang', T.editor, function () { doAction(current.enter, false); }, true);
  var input = main.input;
  var editors = el('div', 'pg-editors');
  editors.appendChild(main.root);

  var VIEWS = ['run', 'result', 'tests', 'emit', 'foreign', 'argue', 'formula', 'picture', 'terminal'];
  var tabs = el('div', 'pg-tabs'); tabs.setAttribute('role', 'tablist');
  var panels = {};
  var tabButtons = {};
  VIEWS.forEach(function (key) {
    var t = el('button', 'pg-tab', T.tabs[key]);
    t.type = 'button'; t.setAttribute('role', 'tab'); t.id = 'pg-tab-' + key;
    t.setAttribute('aria-controls', 'pg-panel-' + key);
    var p = el('div', 'pg-panel'); p.setAttribute('role', 'tabpanel'); p.id = 'pg-panel-' + key;
    p.setAttribute('aria-labelledby', t.id); p.setAttribute('data-panel', key);
    t.addEventListener('click', function () { showTab(key); });
    tabs.appendChild(t); tabButtons[key] = t; panels[key] = p;
  });
  var tabShown = {};
  function showTab(key) {
    if (!panels[key]) return;
    tabButtons[key].hidden = false;
    Object.keys(panels).forEach(function (k) {
      panels[k].hidden = k !== key;
      tabButtons[k].setAttribute('aria-selected', k === key ? 'true' : 'false');
      tabButtons[k].tabIndex = k === key ? 0 : -1;
    });
    root.setAttribute('data-tab', key);
    if (tabShown[key]) tabShown[key]();
  }
  tabs.addEventListener('keydown', function (ev) {
    var keys = Object.keys(panels).filter(function (k) { return !tabButtons[k].hidden; }), now = keys.indexOf(root.getAttribute('data-tab'));
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      var next = keys[(now + (ev.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
      showTab(next); tabButtons[next].focus(); ev.preventDefault();
    }
  });

  /* Первая загрузка компилятора: полоса с долей скачанного. */
  var loader = el('div', 'pg-loader'); loader.hidden = true; loader.setAttribute('role', 'status');
  var loaderText = el('p', 'pg-loader-text');
  var loaderBar = el('progress', 'pg-loader-bar'); loaderBar.max = 100;
  loader.appendChild(loaderText); loader.appendChild(loaderBar); loader.appendChild(el('p', 'pg-hint', T.loadNote));

  var left = el('section', 'pg-left'), right = el('section', 'pg-right'), work = el('div', 'pg-work');
  left.appendChild(bar); left.appendChild(callBar); left.appendChild(editors); left.appendChild(statusBar);
  right.appendChild(tabs); right.appendChild(loader);
  var panelBox = el('div', 'pg-panels');
  Object.keys(panels).forEach(function (k) { panelBox.appendChild(panels[k]); });
  right.appendChild(panelBox);
  work.appendChild(left); work.appendChild(right);
  root.appendChild(setupBar); root.appendChild(work);

  /* ── черновик ───────────────────────────────────────────────────────────
     Текст каждого сетапа сохраняется в хранилище браузера на каждую правку.
     Хранилища может не быть (частное окно, запрет в настройках) — тогда
     страница работает как раньше, а в строке состояния сказано, что черновик
     не сохраняется. */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* хранилища нет */ } }
  };
  var DRAFT = 'flang-playground-draft:', LAST = 'flang-playground-setup';
  /* Значение поля, набранное человеком (а не подставленное страницей), и текст
     программы, для которого страница подставляла значения. */
  var autoFor = null;
  function own(field) { return field.getAttribute('data-auto') !== field.value; }
  function kept(field) { return own(field) ? field.value.trim() : ''; }
  function editorOf(s) { return s.lang ? foreignState.editor : main; }
  function saveDraft() {
    var saved = store.set(DRAFT + current.key, JSON.stringify({ text: editorOf(current).input.value, fn: kept(fnInput), args: kept(argsInput) }));
    draftNote.textContent = saved ? T.draftSaved : T.draftOff;
    root.setAttribute('data-draft', saved ? 'saved' : 'off');
  }
  function readDraft(key) {
    try {
      var d = JSON.parse(store.get(DRAFT + key) || 'null');
      return d && typeof d.text === 'string' ? d : null;
    } catch (e) {
      return null;
    }
  }
  [fnInput, argsInput].forEach(function (field) { field.addEventListener('input', saveDraft); });

  /* ── редактор ───────────────────────────────────────────────────────────── */
  function repaint() { main.repaint(); }
  function setText(text) {
    main.set(text);
    kindSoon();
  }
  /* Проверка при наборе: через полсекунды после правки срабатывает главная
     кнопка сетапа. Программу с библиотекой так не проверяют — это около десяти
     секунд; вместо этого строка состояния подсказывает нажать кнопку, а если
     модуль назван не так, как в библиотеке, называет похожие. */
  var liveTimer = null;
  function libraryNote(text) {
    var hint = libraryHint(text, MODULES);
    hintLine.textContent = hint ? hint.text : T.libSlow;
    if (hint) main.mark([{ line: hint.line, column: hint.column, length: hint.name.length + 2, kind: 'error' }]);
    return hint;
  }
  function liveSoon() {
    clearTimeout(liveTimer);
    if (current.enter === 'translate' || current.enter === 'argue') return;
    liveTimer = setTimeout(function () {
      var text = input.value;
      hintLine.textContent = '';
      if (!text.trim()) return;
      if (usesLibrary(text)) { status.textContent = ''; libraryNote(text); return; }
      doAction(current.enter, true);
    }, 500);
  }
  main.onEdit = function () { saveDraft(); emitStale(); kindSoon(); liveSoon(); };
  /* Вид текста для подсветки спрашивается у потока с компилятором — там то же
     правило, что выбирает проверку. Пока ответа нет (или песочница не
     собрана), текст красится по первой строке. */
  var KIND_LANG = { 'flang': 'flang', 'категория': 'flang', 'рассуждение': 'reasoning', 'формула': 'formula' };
  var kindAsked = 0, kindTimer = null;
  function paintAs(kind) {
    root.setAttribute('data-text-kind', kind);
    if (main.lang !== KIND_LANG[kind]) { main.lang = KIND_LANG[kind]; main.repaint(); }
  }
  function askKind() {
    var n = ++kindAsked;
    if (!warmed) { paintAs(guessKind(main.input.value)); return; }
    post(main.input.value, { действие: 'вид' }, false).then(function (a) {
      if (n !== kindAsked || !a || !KIND_LANG[a.вид]) return;
      paintAs(a.вид);
    });
  }
  function kindSoon() { clearTimeout(kindTimer); kindTimer = setTimeout(askKind, 150); }
  function goToLine(line, column) { main.goTo(line, column); }

  /* ── поток с компилятором ───────────────────────────────────────────────── */
  var worker = null, counter = 0, waiting = {}, loadedOnce = false, warmed = null, onStep = null;
  /* Размер несжатого компилятора: сервер отдаёт его сжатым и длины не называет,
     поэтому доля считается от этого числа и не доходит до ста, пока файл не
     пришёл целиком. */
  var COMPILER_BYTES = 42000000;
  function stopWorker(why) {
    if (worker) worker.terminate();
    worker = null; warmed = null; loadedOnce = false; loader.hidden = true;
    Object.keys(waiting).forEach(function (k) {
      var cb = waiting[k]; delete waiting[k];
      cb({ код: 5, итог: 'остановлено', остановлено: why, вывод: 'FLANG_PLAYGROUND ' + (why === 'время' ? T.timeoutLead(TIME_LIMIT_MS / 1000) : T.workerDown), разбор: null, замечания: [] });
    });
  }
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(ROOT + 'playground/flang_host_browser.js', { type: 'module' });
    worker.addEventListener('message', function (ev) {
      if (ev.data && ev.data.ход) { if (onStep) onStep(ev.data.ход); return; }
      if (ev.data && ev.data.прогресс) {
        var pr = ev.data.прогресс;
        if (pr.файл === 'flang.wasm' && !loadedOnce) {
          var pct = Math.min(99, Math.round(100 * pr.байт / (pr.всего || COMPILER_BYTES)));
          if (pr.готово) { loadedOnce = true; loaderText.textContent = T.preparing; loaderBar.removeAttribute('value'); }
          else { loaderText.textContent = T.loading(pct); loaderBar.value = pct; }
          root.setAttribute('data-compiler-load', pr.готово ? 'ready' : String(pct));
        }
        return;
      }
      var cb = waiting[ev.data.номер];
      if (cb) { delete waiting[ev.data.номер]; cb(ev.data); }
    });
    worker.addEventListener('error', function () { stopWorker('сбой'); });
    return worker;
  }
  function post(text, extra, timed) {
    return new Promise(function (resolve) {
      counter += 1;
      var n = counter, timer = null;
      waiting[n] = function (answer) { clearTimeout(timer); resolve(answer); };
      var msg = { номер: n, текст: text, база: new URL(ROOT + 'playground/', location.href).href };
      Object.keys(extra || {}).forEach(function (k) { msg[k] = extra[k]; });
      ensureWorker().postMessage(msg);
      if (timed) timer = setTimeout(function () { if (waiting[n]) stopWorker('время'); }, TIME_LIMIT_MS);
    });
  }
  /* Компилятор весит десятки мегабайт, поэтому качается не при открытии
     страницы, а при первом касании песочницы: пока человек правит текст,
     модуль уже загружается. */
  function warm() {
    if (warmed) return warmed;
    loader.hidden = false; loaderText.textContent = T.loading(0); loaderBar.value = 0;
    warmed = post('', { действие: 'прогреть' }, false).then(function (a) {
      loader.hidden = true;
      if (a && a.версия) {
        versionNote.textContent = T.version(a.версия);
        root.setAttribute('data-compiler-version', a.версия);
      }
      return a;
    });
    return warmed;
  }
  function ask(text, extra) {
    return warm().then(function (w) {
      if (w && w.остановлено) return w;
      return post(text, extra, true);
    });
  }
  ['pointerdown', 'focusin', 'keydown'].forEach(function (evName) { root.addEventListener(evName, warm, { once: true }); });

  /* ── рисование ответа ───────────────────────────────────────────────────── */
  /* Код ошибки — ссылка на строку справочника, если такая строка есть. */
  function codeNode(code) {
    if (!/^FLANG_/.test(code || '')) return null;
    if (CODES.length && CODES.indexOf(code) < 0) return el('code', 'pg-code', code);
    var a = el('a', 'pg-code', code);
    a.href = ROOT + (EN ? 'en/' : '') + 'diagnostics.html#' + code; a.target = '_blank'; a.rel = 'noopener'; a.title = T.about;
    return a;
  }
  function lineButton(line, column, ed) {
    var bt = el('button', 'pg-mark-line', T.goLine(line)); bt.type = 'button';
    bt.addEventListener('click', function (ev) { ev.stopPropagation(); (ed || main).goTo(line, column); });
    return bt;
  }
  function problemNode(p, ed) {
    var box = el('div', 'pg-problem');
    if (p.line) box.appendChild(lineButton(p.line, p.column, ed));
    box.appendChild(el('span', 'pg-problem-text', p.text));
    var code = codeNode(p.code);
    if (code) box.appendChild(code);
    return box;
  }
  function verdictCard(v) {
    var card = el('div', 'pg-verdict pg-' + v.state);
    card.appendChild(el('p', 'pg-verdict-title', v.title));
    if (v.lead) card.appendChild(el('p', 'pg-verdict-lead', v.lead));
    if (v.counter) {
      var ce = el('p', 'pg-counter');
      ce.appendChild(el('strong', null, T.counterexample));
      ce.appendChild(el('code', null, v.counter));
      card.appendChild(ce);
    }
    (v.problems || []).forEach(function (p) { card.appendChild(problemNode(p)); });
    return card;
  }
  function libraryNode(text) {
    var hint = usesLibrary(text) ? libraryHint(text, MODULES) : null;
    if (!hint) return null;
    var p = el('p', 'pg-libhint', hint.text + ' ');
    var a = el('a', null, T.libList); a.href = ROOT + (EN ? 'en/' : '') + 'library-api.html'; a.target = '_blank'; a.rel = 'noopener';
    p.appendChild(a);
    return p;
  }
  function table(cls, heads) {
    var t = el('table', 'pg-table ' + cls), head = el('thead'), tr = el('tr');
    heads.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    head.appendChild(tr); t.appendChild(head);
    var body = el('tbody'); t.appendChild(body);
    var wrap = el('div', 'pg-table-wrap'); wrap.appendChild(t);
    return { node: wrap, body: body };
  }
  function clickableRow(tr, line) {
    if (!line) return;
    tr.classList.add('pg-row-go'); tr.setAttribute('data-line', String(line));
    tr.addEventListener('click', function () { goToLine(line); });
  }
  function proofTable(rows) {
    var t = table('pg-proofs', [T.cols.status, T.cols.what, T.cols.how]);
    rows.forEach(function (row) {
      var tr = el('tr', 'pg-row pg-' + row.state);
      var st = el('td', 'pg-cell-status'); st.appendChild(mark(row.state)); tr.appendChild(st);
      var what = el('td');
      what.appendChild(el('span', 'pg-claim-kind', row.kind ? row.kind + ' ' : ''));
      what.appendChild(el('span', 'pg-claim-name', '«' + row.name + '»'));
      if (row.of) what.appendChild(el('span', 'pg-claim-of', T.of + '«' + row.of + '»'));
      if (row.line) { what.appendChild(document.createTextNode(' ')); what.appendChild(lineButton(row.line)); }
      tr.appendChild(what);
      var how = el('td', null, row.how);
      if (row.counter) { var c = el('p', 'pg-counter'); c.appendChild(el('strong', null, T.counterexample)); c.appendChild(el('span', null, row.counter)); how.appendChild(c); }
      tr.appendChild(how);
      clickableRow(tr, row.line);
      t.body.appendChild(tr);
    });
    return t.node;
  }
  function testTable(rows) {
    var t = table('pg-tests', [T.cols.name, T.cols.input, T.cols.expected, T.cols.got]);
    rows.forEach(function (row) {
      var tr = el('tr', 'pg-row pg-' + row.state);
      var nameCell = el('td');
      nameCell.appendChild(mark(row.state));
      nameCell.appendChild(el('span', 'pg-claim-name', ' «' + row.name + '»'));
      nameCell.appendChild(el('span', 'pg-claim-of', T.of + '«' + row.fn + '»'));
      tr.appendChild(nameCell);
      [row.input, row.expected, row.got].forEach(function (x) { var td = el('td'); td.appendChild(el('code', null, x)); tr.appendChild(td); });
      clickableRow(tr, row.line);
      t.body.appendChild(tr);
    });
    return t.node;
  }

  function renderCheck(panel, v, answer, text) {
    panel.textContent = '';
    var card = verdictCard(v);
    panel.appendChild(card);
    var r = answer.разбор || {};
    var rc = r.рассуждение && r.рассуждение.проверка;
    if (rc) reasoningCheck(card, panel, rc);
    var lib = libraryNode(text);
    if (lib && v.problems.length) card.appendChild(lib);
    if (r.формула && !r.формула.code) {
      panel.appendChild(formulaCard({ name: '', plain: r.формула.plain, tex: r.формула.tex }));
      if (r.формула.unit) {
        panel.appendChild(el('p', 'pg-formula-name', T.asFlang));
        panel.appendChild(codeBlock(r.формула.unit, 'flang'));
      }
    }
    if (v.rows.length) panel.appendChild(proofTable(v.rows));
    else if (v.items.length) {
      var ul = el('ul', 'pg-items');
      v.items.forEach(function (it) { ul.appendChild(el('li', 'pg-item pg-' + it.state, it.text)); });
      panel.appendChild(ul);
    } else if (r.ведомость && !r.формула) panel.appendChild(el('p', 'pg-hint', T.noClaims));
    if (v.note) panel.appendChild(el('p', 'pg-note', v.note));
    if (r.рассуждение && r.рассуждение.прочитано) {
      var ol = el('ol', 'pg-sentences');
      (r.рассуждение.предложения || []).forEach(function (x) { ol.appendChild(el('li', null, x.replace(/^\d+\.\s*/, ''))); });
      panel.appendChild(ol);
      var pd = el('details', 'pg-details');
      pd.appendChild(el('summary', null, T.program));
      pd.appendChild(codeBlock(r.рассуждение.программа, 'flang'));
      panel.appendChild(pd);
    }
  }
  function renderTests(panel, v) {
    panel.textContent = '';
    panel.appendChild(verdictCard(v));
    if (v.tests.length) panel.appendChild(testTable(v.tests));
  }
  function renderRun(panel, v, tv, retry) {
    panel.textContent = '';
    var card = verdictCard(v);
    if (v.state === 'proved') {
      var line = el('p', 'pg-run-line');
      line.appendChild(el('code', 'pg-run-call', v.call));
      line.appendChild(el('span', 'pg-run-arrow', ' → '));
      line.appendChild(el('strong', 'pg-run-value', v.value));
      card.appendChild(line);
    }
    if (v.retry && retry) {
      var again = el('button', 'pg-tool', T.trustGo); again.type = 'button';
      again.addEventListener('click', retry);
      card.appendChild(again);
    }
    panel.appendChild(card);
    if (tv && (tv.tests.length || tv.state === 'unproved')) {
      panel.appendChild(el('h4', 'pg-section pg-' + tv.state, tv.title));
      if (tv.tests.length) panel.appendChild(testTable(tv.tests));
      else panel.appendChild(el('p', 'pg-hint', tv.lead));
    }
  }
  function renderTerminal(textOut) {
    panels.terminal.textContent = '';
    if (!textOut) { panels.terminal.appendChild(el('p', 'pg-hint', T.noTerminal)); return; }
    panels.terminal.appendChild(el('pre', 'playground-output pg-terminal', textOut));
  }

  /* Разбор рассуждения: имя ошибки формы со ссылкой на карточку, возможные
     ошибки содержания (только подсказкой) и граница того, что форма решает. */
  function reasoningCheck(card, panel, rc) {
    if (rc.fallacy && rc.fallacy.name) {
      var f = el('p', 'pg-fallacy');
      f.appendChild(el('strong', null, T.fallacy + rc.fallacy.name));
      if (rc.fallacy.why) f.appendChild(document.createTextNode(' — ' + rc.fallacy.why));
      if (rc.fallacy.url) {
        f.appendChild(document.createTextNode(' '));
        var a = el('a', null, T.card); a.href = rc.fallacy.url; a.target = '_blank'; a.rel = 'noopener';
        f.appendChild(a);
      }
      card.appendChild(f);
    }
    (rc.unparsed || []).forEach(function (u) { card.appendChild(el('p', 'pg-verdict-lead', T.unparsedSentence + u.sentence + ': «' + u.text + '» — ' + u.reason)); });
    if ((rc.hints || []).length) {
      var h = el('div', 'pg-hints');
      h.appendChild(el('p', 'pg-formula-name', T.hints));
      var ul = el('ul', 'pg-items');
      rc.hints.forEach(function (x) {
        var li = el('li', 'pg-item pg-unknown');
        li.appendChild(document.createTextNode(x.name + (x.phrase ? ' — «' + x.phrase + '»' : '') + (x.why ? ': ' + x.why : '') + ' '));
        if (x.url) { var a = el('a', null, T.card); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
        ul.appendChild(li);
      });
      h.appendChild(ul);
      panel.appendChild(h);
    }
    if (rc.boundary) panel.appendChild(el('p', 'pg-hint pg-boundary', T.boundary + rc.boundary));
  }

  function formulaCard(f) {
    var box = el('div', 'pg-formula');
    if (f.name) box.appendChild(el('p', 'pg-formula-name', f.name));
    if (f.tex) box.appendChild(texBlock(f.tex, f.plain));
    else if (f.plain) box.appendChild(el('p', 'pg-formula-plain', f.plain));
    if (f.why) box.appendChild(el('p', 'pg-formula-why', T.outside + f.why));
    return box;
  }

  function renderFormulas(panel, answer) {
    panel.textContent = '';
    var list = ((answer.разбор || {}).формулы || []);
    var own = (answer.разбор || {}).формула;
    if (own && !own.code) list = [{ имя: '', plain: own.plain, tex: own.tex, why: '' }].concat(list);
    if (!list.length) { panel.appendChild(el('p', 'pg-hint', T.noFormula)); return; }
    list.forEach(function (f) {
      var label = f.имя ? (T.kinds[f.вид] || f.вид) + ' «' + f.имя + '»' + (f.чья ? T.of + '«' + f.чья + '»' : '') : '';
      panel.appendChild(formulaCard({ name: label, plain: f.plain, tex: f.tex, why: f.why }));
    });
  }

  /* ── генерация кода: flang → язык ───────────────────────────────────────── */
  var TARGETS = [
    { target: 'c', name: 'C' }, { target: 'cpp', name: 'C++' }, { target: 'go', name: 'Go' }, { target: 'rust', name: 'Rust' },
    { target: 'java', name: 'Java' }, { target: 'js', name: 'JavaScript' }, { target: 'ts', name: 'TypeScript' },
    { target: 'elixir', name: 'Elixir' }, { target: 'python', name: 'Python' }, { target: 'csharp', name: 'C#' }
  ];
  var emitState = { target: 'go', text: null, cache: {}, file: {} };
  var emitStale = function () {};
  (function buildEmit() {
    var p = panels.emit;
    var picker = el('div', 'pg-langs'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', T.tabs.emit);
    var buttons = {};
    TARGETS.forEach(function (t) {
      var bt = el('button', 'pg-lang', t.name); bt.type = 'button'; bt.setAttribute('data-target', t.target);
      bt.addEventListener('click', function () { emitState.target = t.target; refresh(false); });
      picker.appendChild(bt); buttons[t.target] = bt;
    });
    var again = el('button', 'pg-tool', T.print); again.type = 'button';
    var note = el('p', 'pg-hint pg-stale'); note.hidden = true; note.textContent = T.emitStale + ' ';
    note.appendChild(again);
    var out = el('div', 'pg-emit-out');
    p.appendChild(picker); p.appendChild(note); p.appendChild(out);
    out.appendChild(el('p', 'pg-hint', T.emitLead));
    again.addEventListener('click', function () { emitState.cache = {}; emitState.text = input.value; refresh(false); });
    emitStale = function () { if (emitState.text !== null && emitState.text !== input.value) note.hidden = false; };
    function show(answer, v) {
      out.textContent = '';
      root.setAttribute('data-emit-target', answer.цель || emitState.target);
      root.setAttribute('data-emit-code', String(answer.код));
      if (v.state !== 'proved') {
        var card = verdictCard(v);
        var lib = libraryNode(emitState.text || '');
        if (lib && v.problems.length) card.appendChild(lib);
        out.appendChild(card);
      } else {
        if (T.emitFrom[answer.вид]) out.appendChild(el('p', 'pg-hint', T.emitFrom[answer.вид]));
        var files = answer.файлы;
        var mainFile = files.filter(function (f) { return langOfPath(f.путь) !== 'make' && langOfPath(f.путь) !== 'text'; })[0] || files[0];
        var chosen = files.filter(function (f) { return f.путь === emitState.file[answer.цель]; })[0] || mainFile;
        var fileBar = el('div', 'pg-files'); fileBar.setAttribute('role', 'group');
        var code = el('div', 'pg-emit-code');
        files.forEach(function (f) {
          var fb = el('button', 'pg-file', f.путь); fb.type = 'button';
          fb.setAttribute('aria-pressed', f === chosen ? 'true' : 'false');
          fb.addEventListener('click', function () {
            emitState.file[answer.цель] = f.путь;
            Array.prototype.forEach.call(fileBar.children, function (x) { x.setAttribute('aria-pressed', x === fb ? 'true' : 'false'); });
            code.textContent = ''; code.appendChild(codeBlock(f.текст, langOfPath(f.путь)));
          });
          fileBar.appendChild(fb);
        });
        code.appendChild(codeBlock(chosen.текст, langOfPath(chosen.путь)));
        out.appendChild(fileBar); out.appendChild(code);
        if ((answer.рантайм || []).length) out.appendChild(el('p', 'pg-hint', T.runtimeNote + answer.рантайм.join(', ')));
      }
    }
    function refresh(quiet) {
      Object.keys(buttons).forEach(function (k) { buttons[k].setAttribute('aria-pressed', k === emitState.target ? 'true' : 'false'); });
      if (emitState.text === null) emitState.text = input.value;
      note.hidden = emitState.text === input.value;
      var key = emitState.target, text = emitState.text, cached = emitState.cache[key];
      var job = begin(T.emitting, quiet);
      if (!cached && !quiet) { out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.emitting)); }
      root.removeAttribute('data-emit-code');
      return guard(job, (cached ? Promise.resolve(cached) : ask(text, { действие: 'напечатать', цель: key })).then(function (answer) {
        if (emitState.text === text) emitState.cache[key] = answer;
        if (!alive(job)) return answer;
        if (emitState.text === text && emitState.target !== key) return refresh(quiet);
        var v = present('emit', answer, text);
        if (emitState.text === text && emitState.target === key) show(answer, v);
        renderTerminal(String(answer.вывод || '').trim());
        settle(job, v, 'emit');
        return answer;
      }));
    }
    emitState.refresh = refresh;
    emitState.reset = function () {
      emitState.cache = {}; emitState.text = null; note.hidden = true;
      out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.emitLead));
      root.removeAttribute('data-emit-code');
    };
    emitState.fresh = function () { if (emitState.text !== input.value) { emitState.cache = {}; emitState.text = input.value; } };
  })();

  /* ── свой текст: что прочитано и где ошибки ─────────────────────────────
     Текст в главном редакторе; справа — итог, покрытие, предложения с
     пометкой, отчёт ядра и черновик разметки. Поток присылает ход работы
     сообщениями `{ ход }`: словарь, разбор, шаг ядра k из n. */
  var argueState = { reset: function () {}, check: function () { return Promise.resolve(null); } };
  (function buildArgue() {
    var P = T.prose, p = panels.argue;
    var tools = el('div', 'pg-prose-tools');
    var exampleButton = el('button', 'pg-tool', P.example); exampleButton.type = 'button'; exampleButton.title = P.exampleTitle;
    exampleButton.addEventListener('click', function () { setText(PROSE_EXAMPLE); saveDraft(); updateCount(); });
    var count = el('span', 'pg-hint pg-prose-count');
    var more = el('a', null, P.more); more.href = ROOT + (EN ? 'en/' : '') + 'argue.html';
    tools.appendChild(exampleButton); tools.appendChild(count); tools.appendChild(more);
    var out = el('div', 'pg-prose-out');
    p.appendChild(tools);
    p.appendChild(el('p', 'pg-hint', P.lead));
    p.appendChild(out);
    var foot = el('div', 'pg-prose-foot');
    foot.appendChild(el('p', 'pg-hint', P.moreCommand));
    foot.appendChild(el('p', 'pg-hint', P.source));
    p.appendChild(foot);
    function updateCount() {
      var n = input.value.length;
      count.textContent = P.count(n, PROSE_LIMIT);
      count.classList.toggle('pg-error', n > PROSE_LIMIT);
    }
    input.addEventListener('input', function () { if (current.enter === 'argue') updateCount(); });
    function inline(text) {
      var box = el('span'), re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g, at = 0, m;
      text = String(text);
      while ((m = re.exec(text))) {
        if (m.index > at) box.appendChild(document.createTextNode(text.slice(at, m.index)));
        box.appendChild(m[2] !== undefined ? el('strong', null, m[2]) : el('code', null, m[3]));
        at = m.index + m[0].length;
      }
      if (at < text.length) box.appendChild(document.createTextNode(text.slice(at)));
      return box;
    }
    function blockNode(b) {
      if (b.kind === 'h2' || b.kind === 'h3') { var h = el(b.kind === 'h2' ? 'h4' : 'h5', 'pg-prose-h'); h.appendChild(inline(b.text)); return h; }
      if (b.kind === 'quote') {
        var q = el('blockquote', 'pg-prose-quote');
        b.lines.forEach(function (line) { var pq = el('p'); pq.appendChild(inline(line)); q.appendChild(pq); });
        return q;
      }
      if (b.kind === 'list') {
        var ul = el('ul', 'pg-prose-list');
        b.items.forEach(function (it) { var li = el('li'); li.appendChild(inline(it)); ul.appendChild(li); });
        return ul;
      }
      if (b.kind === 'table') {
        var wrap = el('div', 'pg-prose-table'), table = el('table');
        b.rows.forEach(function (row, j) {
          var tr = el('tr');
          row.forEach(function (cell) { var td = el(j === 0 ? 'th' : 'td'); td.appendChild(inline(cell)); tr.appendChild(td); });
          table.appendChild(tr);
        });
        wrap.appendChild(table);
        return wrap;
      }
      var para = el('p'); para.appendChild(inline(b.text)); return para;
    }
    function sentenceNode(r) {
      var li = el('li', 'pg-prose-sentence pg-prose-' + r.state);
      li.setAttribute('data-state', r.state);
      var head = el('p', 'pg-prose-line');
      var tone = { parsed: 'proved', nominal: 'examples', unparsed: 'unproved', long: 'unknown', error: 'error' }[r.state] || 'unknown';
      head.appendChild(el('span', 'pg-mark pg-' + tone, r.label));
      head.appendChild(document.createTextNode(' ' + r.text));
      li.appendChild(head);
      (r.notes || []).forEach(function (note) { li.appendChild(el('p', 'pg-prose-why', note)); });
      r.forms.forEach(function (f) { var fp = el('p', 'pg-prose-form'); fp.appendChild(el('code', null, f)); li.appendChild(fp); });
      r.reasons.forEach(function (why, j) {
        var wp = el('p', 'pg-prose-why'), kind = r.kinds[j] || P.why;
        wp.appendChild(el('strong', null, P.noForm));
        if (why.indexOf(kind) < 0) wp.appendChild(document.createTextNode(kind + ': '));
        wp.appendChild(document.createTextNode(why));
        li.appendChild(wp);
      });
      return li;
    }
    function render(v) {
      out.textContent = '';
      var card = el('div', 'pg-verdict pg-' + v.state);
      card.appendChild(el('p', 'pg-verdict-title', v.title));
      if (v.lead) card.appendChild(el('p', 'pg-verdict-lead', v.lead));
      if (v.coverage) card.appendChild(el('p', 'pg-verdict-lead', v.coverage));
      out.appendChild(card);
      if (v.rows.length) {
        out.appendChild(el('h4', 'pg-prose-h', P.sentences));
        var ol = el('ol', 'pg-prose-sentences');
        v.rows.forEach(function (r) { ol.appendChild(sentenceNode(r)); });
        out.appendChild(ol);
      }
      if (v.blocks.length) {
        var rep = el('section', 'pg-prose-report');
        rep.appendChild(el('h4', 'pg-prose-h', P.report));
        v.blocks.forEach(function (b) { rep.appendChild(blockNode(b)); });
        out.appendChild(rep);
      }
      if (v.draft) {
        var d = el('details', 'pg-details');
        d.appendChild(el('summary', null, P.draft));
        d.appendChild(el('pre', 'playground-output', v.draft));
        out.appendChild(d);
      }
      if (v.dictionary) out.appendChild(el('p', 'pg-hint', v.dictionary));
    }
    function check(quiet) {
      var text = input.value;
      updateCount();
      if (!text.trim()) return Promise.resolve(null);
      var job = begin(P.checking, quiet);
      out.textContent = '';
      var progress = el('p', 'pg-hint pg-prose-progress', P.checking);
      out.appendChild(progress);
      root.removeAttribute('data-prose-verdict');
      onStep = function (h) {
        if (job.n !== seq) return;
        var words = h.что === 'ядро' ? P.progress.ядро(h.сделано + 1, h.всего) : P.progress[h.что] || P.checking;
        progress.textContent = words; status.textContent = words;
      };
      return guard(job, ask(text, { действие: 'статья' }).then(function (answer) {
        onStep = null;
        if (!alive(job)) return answer;
        var v = argueView(answer);
        render(v);
        renderTerminal(answer.вывод || '');
        root.setAttribute('data-prose-verdict', v.state);
        if (v.numbers) root.setAttribute('data-prose-read', v.numbers.read + '/' + v.numbers.sentences);
        settle(job, v, 'argue');
        return answer;
      }));
    }
    argueState.check = check;
    argueState.reset = function () { out.textContent = ''; root.removeAttribute('data-prose-verdict'); updateCount(); };
  })();

  /* ── перевод: C → flang ─────────────────────────────────────────────────── */
  var foreignState = { lang: 'c', editor: null };
  (function buildForeign() {
    var p = panels.foreign;
    var picker = el('div', 'pg-langs'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', T.tabs.foreign);
    var buttons = {};
    var ed = makeEditor('c', T.foreignLabel, function () { doAction('translate', false); }, false);
    ed.root.hidden = true;
    ed.onEdit = function () { saveDraft(); };
    editors.appendChild(ed.root);
    foreignState.editor = ed;
    var note = el('p', 'pg-hint');
    var out = el('div', 'pg-foreign-out');
    FOREIGN.forEach(function (f) {
      var bt = el('button', 'pg-lang', f.name + (f.ready ? '' : ' · ' + T.soon)); bt.type = 'button';
      bt.setAttribute('data-lang', f.lang);
      if (!f.ready) { bt.disabled = true; bt.title = f.note(); }
      bt.addEventListener('click', function () { choose(f.lang); });
      picker.appendChild(bt); buttons[f.lang] = bt;
    });
    function choose(lang) {
      var f = FOREIGN.filter(function (x) { return x.lang === lang; })[0];
      foreignState.lang = lang; ed.lang = lang; ed.repaint();
      Object.keys(buttons).forEach(function (k) { buttons[k].setAttribute('aria-pressed', k === lang ? 'true' : 'false'); });
      note.textContent = f.note();
      lead.textContent = foreignWord('foreignLead'); ed.input.setAttribute('aria-label', foreignWord('foreignLabel'));
    }
    var lead = el('p', 'pg-hint', T.foreignLead);
    p.appendChild(picker); p.appendChild(lead); p.appendChild(note); p.appendChild(out);
    choose('c');
    function translate(quiet) {
      var text = ed.input.value;
      if (!text.trim()) return Promise.resolve(null);
      var job = begin(T.translating, quiet);
      out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.translating));
      root.removeAttribute('data-foreign-verdict');
      ed.mark([]);
      return guard(job, ask(text, { действие: 'перевести', язык: foreignState.lang }).then(function (answer) {
        if (!alive(job)) return answer;
        out.textContent = '';
        var verdict = 'proved';
        if (answer.остановлено) {
          verdict = 'error';
          out.appendChild(verdictCard(present('run', answer, text)));
        } else if (answer.отказ) {
          verdict = 'error';
          var card = el('div', 'pg-verdict pg-error');
          card.appendChild(el('p', 'pg-verdict-title', answer.отказ.строка ? T.errorAt + answer.отказ.строка : T.readFailed));
          card.appendChild(problemNode({ line: answer.отказ.строка, column: null, text: answer.отказ.причина, code: '' }, ed));
          out.appendChild(card);
          if (answer.отказ.строка) ed.mark([{ line: answer.отказ.строка, kind: 'error' }]);
        } else if (!(answer.функции || []).length) {
          verdict = answer.код === 2 ? 'error' : 'unproved';
          out.appendChild(el('p', 'pg-hint', answer.код === 2 ? answer.вывод : T.noFunctions));
        }
        var badLines = [];
        (answer.функции || []).forEach(function (f) {
          var box = el('section', 'pg-fn');
          var head = el('h4', 'pg-fn-name', f.имя + ' ');
          head.appendChild(lineButton(f.строка, 1, ed));
          box.appendChild(head);
          if (f.отказы.length) {
            verdict = verdict === 'error' ? 'error' : 'unproved';
            badLines.push({ line: f.строка, kind: 'error' });
            var c1 = el('div', 'pg-verdict pg-unproved');
            c1.appendChild(el('p', 'pg-verdict-title', T.notTranslated));
            var ul = el('ul', 'pg-items');
            f.отказы.filter(function (x, j, all) { return all.indexOf(x) === j; }).forEach(function (r) { ul.appendChild(el('li', 'pg-item pg-error', r)); });
            c1.appendChild(ul);
            box.appendChild(c1);
            out.appendChild(box);
            return;
          }
          var s = summarize(f);
          var refuted = f.контрпримеры || [];
          var st = refuted.length ? 'violated' : f.код === 0 ? 'proved' : f.код === 3 ? 'unproved' : 'error';
          if (st === 'error' || st === 'violated') verdict = verdict === 'error' ? 'error' : 'violated';
          else if (st === 'unproved' && verdict === 'proved') verdict = 'unproved';
          var c2 = el('div', 'pg-verdict pg-' + st);
          c2.appendChild(el('p', 'pg-verdict-title', st === 'proved' ? T.fnProved : st === 'violated' ? T.fnRefuted : st === 'unproved' ? T.fnUnproved : T.fnFailed));
          if (st === 'violated') refuted.forEach(function (c) { c2.appendChild(el('p', 'pg-verdict-lead', foreignWord('refutedLead')(c))); });
          else if (st !== 'proved' && s.lead) c2.appendChild(el('p', 'pg-verdict-lead', s.lead));
          if (st === 'error') s.problems.forEach(function (pr) { c2.appendChild(problemNode({ line: null, column: null, text: pr.text, code: pr.code })); });
          box.appendChild(c2);
          var claims = ((f.разбор && f.разбор.ведомость && f.разбор.ведомость.claims) || []);
          var fnItems = claims.length ? claims.map(function (c) {
            var who = (T.kinds[c.kind] || c.kind) + ' «' + c.name + '»';
            var hit = refuted.filter(function (r) { return r.обещание === c.name; })[0];
            if (hit) return { state: 'violated', text: who + ' — ' + T.refuted(hit) };
            var cs = claimState(c);
            if (cs === 'unproved' && /^обязательство /.test(c.name)) return { state: 'unproved', text: who + ' — ' + foreignWord('boundsClean') };
            return { state: cs, text: who + ' — ' + claimWords(c) };
          }) : s.items;
          if (fnItems.length) {
            var items = el('ul', 'pg-items');
            fnItems.forEach(function (it) { items.appendChild(el('li', 'pg-item pg-' + it.state, it.text)); });
            box.appendChild(items);
          }
          box.appendChild(el('p', 'pg-formula-name', T.inFlang));
          box.appendChild(codeBlock(f.исходник, 'flang'));
          box.appendChild(el('p', 'pg-hint', foreignWord('intNote')));
          var open = el('button', 'pg-tool', T.toEditor); open.type = 'button';
          open.addEventListener('click', function () { openSetup('proof', { text: f.исходник, fn: '', args: '' }); input.focus(); });
          box.appendChild(open);
          out.appendChild(box);
        });
        if (badLines.length) ed.mark(badLines);
        root.setAttribute('data-foreign-verdict', verdict);
        root.setAttribute('data-foreign-functions', String((answer.функции || []).length));
        var titles = { proved: T.fnProved, violated: T.fnRefuted, unproved: T.fnUnproved, error: answer.отказ ? T.readFailed : T.fnFailed };
        var td = el('details', 'pg-details');
        td.appendChild(el('summary', null, T.terminal));
        td.appendChild(el('pre', 'playground-output', (answer.вывод || '').trim()));
        out.appendChild(td);
        settle(job, { state: verdict, title: (answer.функции || []).length || answer.отказ ? titles[verdict] : T.noFunctions, marks: null }, 'foreign');
        return answer;
      }));
    }
    foreignState.translate = translate;
    foreignState.choose = choose;
    foreignState.reset = function () { out.textContent = ''; root.removeAttribute('data-foreign-verdict'); };
  })();

  /* ── рисунки (SVG своими руками) ────────────────────────────────────────── */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uid = 0;
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function textWidth(s, size) { return Math.max(24, String(s).length * (size || 13) * 0.6 + 16); }
  function newSvg(w, h, label) {
    var s = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img', 'aria-label': label, class: 'pg-svg' });
    var id = 'pg-arrow-' + (++uid);
    var defs = svgEl('defs');
    var m = svgEl('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'pg-arrowhead' }));
    defs.appendChild(m); s.appendChild(defs);
    s.arrowId = id;
    return s;
  }
  function box(svg, x, y, label, cls) {
    var w = textWidth(label), h = 28;
    var g = svgEl('g', { class: 'pg-node ' + (cls || '') });
    g.appendChild(svgEl('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 6 }));
    g.appendChild(svgEl('text', { x: x, y: y + 4.5, 'text-anchor': 'middle' }, label));
    svg.appendChild(g);
    return { x: x, y: y, w: w, h: h };
  }
  function edgePoint(n, tx, ty) {
    var dx = tx - n.x, dy = ty - n.y;
    if (!dx && !dy) return { x: n.x, y: n.y };
    var sx = (n.w / 2 + 3) / Math.abs(dx || 1e-9), sy = (n.h / 2 + 3) / Math.abs(dy || 1e-9), k = Math.min(sx, sy);
    return { x: n.x + dx * k, y: n.y + dy * k };
  }
  function arrow(svg, a, b, label, opts) {
    opts = opts || {};
    var off = opts.offset || 0;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var mx = (a.x + b.x) / 2 + nx * off * 2, my = (a.y + b.y) / 2 + ny * off * 2;
    var p = edgePoint(a, mx, my), q = edgePoint(b, mx, my);
    var path = off ? 'M' + p.x + ',' + p.y + ' Q' + mx + ',' + my + ' ' + q.x + ',' + q.y : 'M' + p.x + ',' + p.y + ' L' + q.x + ',' + q.y;
    svg.appendChild(svgEl('path', { d: path, class: 'pg-edge' + (opts.dashed ? ' pg-dashed' : ''), 'marker-end': 'url(#' + svg.arrowId + ')' }));
    if (label) {
      var lx = (a.x + b.x) / 2 + nx * (off + (opts.side || 1) * 12), ly = (a.y + b.y) / 2 + ny * (off + (opts.side || 1) * 12);
      var t = svgEl('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', class: 'pg-edge-label' }, label);
      svg.appendChild(t);
    }
  }
  function mark(state) {
    var m = el('span', 'pg-mark pg-' + state, T.marks[state] || state);
    return m;
  }
  function figure(title, state, svg, note) {
    var f = el('figure', 'pg-figure');
    var cap = el('figcaption');
    cap.appendChild(el('span', 'pg-figure-title', title));
    if (state) cap.appendChild(mark(state));
    f.appendChild(cap);
    var scroller = el('div', 'pg-figure-body');
    scroller.appendChild(svg);
    f.appendChild(scroller);
    if (note) f.appendChild(el('p', 'pg-figure-note', note));
    return f;
  }

  function lawFor(ledger, kind, name, diags, codes) {
    var bad = (diags || []).some(function (d) { return codes.test(d.код) && d.текст.indexOf('«' + name + '»') >= 0; });
    if (bad) return 'violated';
    var l = ((ledger && ledger.laws) || []).filter(function (x) { return x.kind === kind && x.name === name; })[0];
    if (!l) return ledger ? 'unknown' : 'unknown';
    if (ledger.lawClaims && ledger.lawClaims.total > 0 && ledger.lawClaims.proved === ledger.lawClaims.total && l.verdict === 'grid') return 'proved';
    return lawState(l);
  }

  function morphismTable(tree) {
    var byName = {};
    ((tree && tree.morphisms) || []).forEach(function (m) { byName[m.name] = m; });
    function ends(name, seen) {
      var m = byName[name];
      if (!m || (seen || {})[name]) return null;
      if (m.kind === 'composition') {
        var s2 = Object.assign({}, seen || {}); s2[name] = true;
        var l = ends(m.left, s2), r = ends(m.right, s2);
        return l && r ? { from: r.from, to: l.to, composite: true, left: m.left, right: m.right } : null;
      }
      return { from: m.domain, to: m.codomain, identity: !!m.identity };
    }
    return { byName: byName, ends: ends };
  }

  function layout(names, cx, cy) {
    var n = names.length, pos = {};
    if (n === 1) pos[names[0]] = { x: cx, y: cy };
    else if (n === 2) { pos[names[0]] = { x: cx - 150, y: cy }; pos[names[1]] = { x: cx + 150, y: cy }; }
    else if (n === 4) {
      pos[names[0]] = { x: cx - 150, y: cy - 70 }; pos[names[1]] = { x: cx + 150, y: cy - 70 };
      pos[names[3]] = { x: cx + 150, y: cy + 70 }; pos[names[2]] = { x: cx - 150, y: cy + 70 };
    } else {
      var r = Math.max(110, n * 34);
      names.forEach(function (nm, j) {
        var a = -Math.PI / 2 + (2 * Math.PI * j) / n;
        pos[nm] = { x: cx + r * Math.cos(a) * 1.5, y: cy + r * Math.sin(a) };
      });
    }
    return pos;
  }

  function categoryFigure(cat, tree, ledger, diags) {
    var mt = morphismTable(tree);
    var arrows = [];
    var objects = [];
    function addObj(o) { if (o && objects.indexOf(o) < 0) objects.push(o); }
    (cat.equalities || []).forEach(function (e) { addObj(e.object); });
    (cat.morphisms || []).forEach(function (name) {
      var e = mt.ends(name);
      if (!e || e.identity) return;
      addObj(e.from); addObj(e.to);
      arrows.push({ name: name, from: e.from, to: e.to, composite: e.composite, left: e.left, right: e.right });
    });
    var n = objects.length;
    var w = n <= 2 ? 520 : n === 4 ? 540 : Math.max(520, 140 + n * 70 * 1.5), h = n <= 2 ? 150 : n === 4 ? 260 : Math.max(260, 60 + n * 60);
    var svg = newSvg(w, h, T.category + '«' + cat.name + '»');
    var pos = layout(objects, w / 2, h / 2);
    var nodes = {};
    objects.forEach(function (o) { nodes[o] = box(svg, pos[o].x, pos[o].y, o); });
    var pairCount = {};
    arrows.forEach(function (a) {
      var key = [a.from, a.to].sort().join('\u0000');
      var k = pairCount[key] = (pairCount[key] || 0) + 1;
      var reverse = a.from > a.to;
      var off = k === 1 && !arrows.some(function (b) { return b !== a && b.from === a.to && b.to === a.from; }) ? 0 : (reverse ? -1 : 1) * 14 * k;
      if (a.from === a.to) return;
      arrow(svg, nodes[a.from], nodes[a.to], a.name, { offset: off, dashed: a.composite });
    });
    var state = lawFor(ledger, 'категория', cat.name, diags, /^FLANG_(EQUALITY_|CATEGORY_|COMPOSITION_|LAW)/);
    var list = [figure(T.category + '«' + cat.name + '»', state, svg)];
    arrows.filter(function (a) { return a.composite; }).forEach(function (a) {
      var l = mt.ends(a.left), r = mt.ends(a.right);
      if (!l || !r) return;
      var t = newSvg(420, 210, T.triangle + '«' + a.name + '»');
      var A = box(t, 80, 160, r.from), B = box(t, 210, 50, r.to), C = box(t, 340, 160, l.to);
      arrow(t, A, B, a.right, { side: 1 }); arrow(t, B, C, a.left, { side: 1 }); arrow(t, A, C, a.name, { dashed: true, side: -1 });
      list.push(figure(T.triangle + '«' + a.name + '» = «' + a.left + '» ∘ «' + a.right + '»', state, t));
    });
    return list;
  }

  function functorFigures(fn, tree, ledger, diags) {
    var mt = morphismTable(tree);
    var objMap = {};
    (fn.objects || []).forEach(function (o) { objMap[o.from] = o; });
    var state = lawFor(ledger, 'связь', fn.name, diags, /^FLANG_(FUNCTOR_|LAW)/);
    return (fn.morphisms || []).map(function (m) {
      var src = mt.ends(m.from), dst = mt.ends(m.to);
      var sq = newSvg(520, 230, T.square + '«' + m.from + '»');
      if (!src) return figure(T.functor + '«' + fn.name + '»', state, sq);
      var fa = objMap[src.from] ? objMap[src.from].to : (dst ? dst.from : '?');
      var fb = objMap[src.to] ? objMap[src.to].to : (dst ? dst.to : '?');
      var A = box(sq, 110, 45, src.from), B = box(sq, 410, 45, src.to), FA = box(sq, 110, 185, fa), FB = box(sq, 410, 185, fb);
      arrow(sq, A, B, m.from, { side: -1 }); arrow(sq, FA, FB, m.to, { side: 1 });
      arrow(sq, A, FA, objMap[src.from] ? objMap[src.from].gives : '', { side: 1 });
      arrow(sq, B, FB, objMap[src.to] ? objMap[src.to].gives : '', { side: -1 });
      return figure(T.functor + '«' + fn.name + '»: «' + fn.from + '» → «' + fn.to + '», ' + T.square + '«' + m.from + '»', state, sq);
    });
  }

  function monoidFigures(mo, ledger, diags) {
    var op = '«' + mo.operation + '»', state = lawFor(ledger, 'моноид', mo.name, diags, /^FLANG_(MONOID_|LAW)/);
    var a = newSvg(520, 230, T.assoc);
    var M3 = box(a, 110, 45, 'M × M × M'), M2a = box(a, 410, 45, 'M × M'), M2b = box(a, 110, 185, 'M × M'), M = box(a, 410, 185, 'M');
    arrow(a, M3, M2a, op + ' × 1', { side: -1 }); arrow(a, M3, M2b, '1 × ' + op, { side: 1 });
    arrow(a, M2a, M, op, { side: -1 }); arrow(a, M2b, M, op, { side: 1 });
    var u = newSvg(520, 200, T.units);
    var L = box(u, 90, 50, 'M'), C = box(u, 260, 50, 'M × M'), R = box(u, 430, 50, 'M'), D = box(u, 260, 165, 'M');
    var unit = mo.unit && mo.unit.kind === 'literal' ? valueText(mo.unit.value) : 'e';
    arrow(u, L, C, '(' + unit + ', 1)', { side: -1 }); arrow(u, R, C, '(1, ' + unit + ')', { side: 1 });
    arrow(u, C, D, op, { side: 1 }); arrow(u, L, D, '1', { side: 1, dashed: true }); arrow(u, R, D, '1', { side: -1, dashed: true });
    var carrier = mo.carrier ? (mo.carrier.name || { string: 'строка', number: 'число', exactInt: 'точное целое' }[mo.carrier.kind] || mo.carrier.kind) : '';
    return [
      figure(T.monoid + '«' + mo.name + '» — ' + T.assoc, state, a, 'M = ' + carrier),
      figure(T.monoid + '«' + mo.name + '» — ' + T.units, state, u, 'M = ' + carrier + ', e = ' + unit)
    ];
  }

  /* Множества: функции без параметров, чьё тело — список строк. */
  function setsOf(tree) {
    var sets = [];
    ((tree && tree.functions) || []).forEach(function (f) {
      if ((f.params || []).length) return;
      var b = f.body;
      if (!b || b.kind !== 'list' || !Array.isArray(b.items)) return;
      var items = b.items.filter(function (x) { return x && x.kind === 'literal' && typeof x.value === 'string'; }).map(function (x) { return x.value; });
      if (items.length !== b.items.length) return;
      sets.push({ name: f.name, items: items });
    });
    return sets;
  }
  function callsIn(node, out) {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) { node.forEach(function (x) { callsIn(x, out); }); return out; }
    if (node.kind === 'call' && node.name) out.push(node.name);
    Object.keys(node).forEach(function (k) { if (k !== 'span') callsIn(node[k], out); });
    return out;
  }
  function vennFigure(tree, ledger) {
    var sets = setsOf(tree);
    if (!sets.length) return null;
    var statements = (tree.statements || []);
    var used = [];
    statements.forEach(function (st) {
      callsIn(st.expr, []).forEach(function (n) { if (sets.some(function (s) { return s.name === n; }) && used.indexOf(n) < 0) used.push(n); });
    });
    var chosen = (used.length ? used : sets.map(function (s) { return s.name; })).slice(0, 3).map(function (n) { return sets.filter(function (s) { return s.name === n; })[0]; });
    var W = 560, H = 350;
    var svg = newSvg(W, H, T.sets);
    var circles;
    var A = chosen[0], B = chosen[1], C = chosen[2];
    var inA = function (x) { return A.items.indexOf(x) >= 0; }, inB = function (x) { return B && B.items.indexOf(x) >= 0; }, inC = function (x) { return C && C.items.indexOf(x) >= 0; };
    var all = [];
    chosen.forEach(function (s) { s.items.forEach(function (x) { if (all.indexOf(x) < 0) all.push(x); }); });
    var regions = {};
    all.forEach(function (x) { var k = (inA(x) ? 'a' : '') + (inB(x) ? 'b' : '') + (inC(x) ? 'c' : ''); (regions[k] = regions[k] || []).push(x); });
    var anchors;
    if (chosen.length === 1) { circles = [[W / 2, H / 2, 120]]; anchors = { a: [W / 2, H / 2] }; }
    else if (chosen.length === 2) {
      var aInB = A.items.every(inB), bInA = B.items.every(inA);
      var shared = A.items.some(inB);
      if (aInB || bInA) {
        var big = aInB ? 1 : 0;
        circles = big === 1 ? [[W / 2 - 40, H / 2 + 10, 75], [W / 2, H / 2, 145]] : [[W / 2, H / 2, 145], [W / 2 - 40, H / 2 + 10, 75]];
        anchors = big === 1 ? { ab: [W / 2 - 40, H / 2 + 10], b: [W / 2 + 85, H / 2] } : { ab: [W / 2 - 40, H / 2 + 10], a: [W / 2 + 85, H / 2] };
      } else if (!shared) {
        circles = [[W / 2 - 130, H / 2, 105], [W / 2 + 130, H / 2, 105]];
        anchors = { a: [W / 2 - 130, H / 2], b: [W / 2 + 130, H / 2] };
      } else {
        circles = [[W / 2 - 70, H / 2, 120], [W / 2 + 70, H / 2, 120]];
        anchors = { a: [W / 2 - 120, H / 2], ab: [W / 2, H / 2], b: [W / 2 + 120, H / 2] };
      }
    } else {
      circles = [[W / 2 - 65, 125, 100], [W / 2 + 65, 125, 100], [W / 2, 215, 100]];
      anchors = { a: [W / 2 - 112, 100], b: [W / 2 + 112, 100], c: [W / 2, 262], ab: [W / 2, 85], ac: [W / 2 - 60, 196], bc: [W / 2 + 60, 196], abc: [W / 2, 158] };
    }
    var classes = ['pg-set-a', 'pg-set-b', 'pg-set-c'];
    circles.forEach(function (c, j) { svg.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: c[2], class: 'pg-set ' + classes[j] })); });
    circles.forEach(function (c, j) {
      var lx = c[0] + (j === 0 ? -c[2] * 0.55 : j === 1 ? c[2] * 0.55 : 0), ly = j === 2 ? c[1] + c[2] + 16 : c[1] - c[2] - 8;
      if (chosen.length === 2 && circles[0][2] !== circles[1][2]) ly = c[1] - c[2] - 8 + (j === 0 && circles[0][2] < circles[1][2] ? c[2] * 0.25 : 0);
      svg.appendChild(svgEl('text', { x: lx, y: Math.max(14, Math.min(H - 4, ly)), 'text-anchor': 'middle', class: 'pg-set-name' }, '«' + chosen[j].name + '»'));
    });
    Object.keys(regions).forEach(function (k) {
      var at = anchors[k];
      if (!at) return;
      var items = regions[k];
      items.forEach(function (x, j) {
        svg.appendChild(svgEl('text', { x: at[0], y: at[1] + (j - (items.length - 1) / 2) * 16 + 4, 'text-anchor': 'middle', class: 'pg-set-item' }, x));
      });
    });
    var f = figure(T.sets, null, svg);
    var claims = ((ledger && ledger.claims) || []);
    if (statements.length) {
      var ul = el('ul', 'pg-items');
      statements.forEach(function (st) {
        var c = claims.filter(function (x) { return x.name === st.name; })[0];
        var stt = c ? claimState(c) : 'unknown';
        var li = el('li', 'pg-item pg-' + stt);
        li.appendChild(document.createTextNode('«' + st.name + '» '));
        li.appendChild(mark(stt));
        ul.appendChild(li);
      });
      f.appendChild(ul);
    }
    return f;
  }

  /* Дерево доказательства: утверждение → способ → случаи → шаги. */
  function proofTree(o, formulas) {
    var d = o.discharge;
    if (!d) return null;
    var f = (formulas || []).filter(function (x) { return x.имя === o.name; })[0];
    var rootLabel = [(T.kinds[o.kind] || o.kind) + ' «' + o.name + '»'];
    if (f && f.plain) rootLabel.push(f.plain);
    var tree = { label: rootLabel, state: /доказано/.test(d.verdict) ? 'proved' : 'unproved', kids: [] };
    var method;
    if (d.induction) method = { label: [T.induction + '«' + d.induction.param + '»', '(' + d.induction.type + ')'], kids: [] };
    else if (d.by === 'declaration' && d.byType) method = { label: [T.byTypes, d.rule ? T.rule + '«' + d.rule + '»' : ''], kids: [] };
    else if (d.rule) method = { label: [T.rule + '«' + d.rule + '»'], kids: [] };
    else method = { label: [T.byComputation], kids: [] };
    tree.kids.push(method);
    (d.cases || []).forEach(function (c) {
      var node = { label: [T.cases + '«' + (c.label || c.variant) + '» — ' + (c.kind === 'base' ? T.base : c.kind === 'step' ? T.step : c.kind || ''), c.rule ? T.rule + '«' + c.rule + '»' : ''], state: /доказано/.test(c.verdict) ? 'proved' : 'unproved', kids: [] };
      (c.stepRules || []).forEach(function (sr) {
        var how = c.case && c.case.steps && c.case.steps[sr.step - 1] && c.case.steps[sr.step - 1].by && c.case.steps[sr.step - 1].by.rule === 'hypothesis' ? T.hypothesis : '';
        node.kids.push({ label: [T.step + ' ' + sr.step + ' (' + T.line + sr.line + ')', how || (T.rule + '«' + sr.rule + '»')], kids: [] });
      });
      method.kids.push(node);
    });
    function lines(n) { return n.label.filter(Boolean).map(function (s) { return s.length > 64 ? s.slice(0, 63) + '…' : s; }); }
    function measure(n) {
      n.lines = lines(n);
      n.w = Math.max.apply(null, n.lines.map(function (s) { return textWidth(s, 12.5); })) + 8;
      n.h = n.lines.length * 16 + 12;
      n.kids.forEach(measure);
      var kw = n.kids.reduce(function (s, k) { return s + k.span; }, 0) + Math.max(0, n.kids.length - 1) * 16;
      n.span = Math.max(n.w, kw);
    }
    measure(tree);
    var levelGap = 34, depthH = [];
    (function heights(n, d0) { depthH[d0] = Math.max(depthH[d0] || 0, n.h); n.kids.forEach(function (k) { heights(k, d0 + 1); }); })(tree, 0);
    var ys = [10];
    for (var j = 1; j < depthH.length; j++) ys[j] = ys[j - 1] + depthH[j - 1] + levelGap;
    var W = tree.span + 20, H = ys[ys.length - 1] + depthH[depthH.length - 1] + 10;
    var svg = newSvg(W, H, T.proof + o.name);
    function place(n, x0, d0) {
      n.x = x0 + n.span / 2; n.y = ys[d0];
      var x = x0 + (n.span - (n.kids.reduce(function (s, k) { return s + k.span; }, 0) + Math.max(0, n.kids.length - 1) * 16)) / 2;
      n.kids.forEach(function (k) { place(k, x, d0 + 1); x += k.span + 16; });
    }
    place(tree, 10, 0);
    (function draw(n) {
      n.kids.forEach(function (k) {
        svg.appendChild(svgEl('path', { d: 'M' + n.x + ',' + (n.y + n.h) + ' L' + k.x + ',' + (k.y - 2), class: 'pg-edge', 'marker-end': 'url(#' + svg.arrowId + ')' }));
        draw(k);
      });
      var g = svgEl('g', { class: 'pg-node pg-tree-node' + (n.state ? ' pg-node-' + n.state : '') });
      g.appendChild(svgEl('rect', { x: n.x - n.w / 2, y: n.y, width: n.w, height: n.h, rx: 6 }));
      n.lines.forEach(function (s, i) { g.appendChild(svgEl('text', { x: n.x, y: n.y + 19 + i * 16, 'text-anchor': 'middle', class: i ? 'pg-tree-sub' : '' }, s)); });
      svg.appendChild(g);
    })(tree);
    return figure(T.proof + '«' + o.name + '»', tree.state, svg);
  }

  function renderPictures(panel, answer) {
    panel.textContent = '';
    var r = answer.разбор || {};
    var tree = r.дерево, ledger = r.ведомость, diags = r.замечания || [];
    var figs = [];
    if (tree) {
      (tree.categories || []).forEach(function (c) { figs = figs.concat(categoryFigure(c, tree, ledger, diags)); });
      (tree.legacy || []).forEach(function (l) { if (l.construct === 'functorFile') figs = figs.concat(functorFigures(l.value, tree, ledger, diags)); });
      (tree.monoids || []).forEach(function (m) { figs = figs.concat(monoidFigures(m, ledger, diags)); });
      var v = vennFigure(tree, ledger);
      if (v) figs.push(v);
    }
    ((ledger && ledger.obligations) || []).forEach(function (o) {
      if (o.kind === 'totality') return;
      var t = proofTree(o, r.формулы);
      if (t) figs.push(t);
    });
    if (!figs.length) { panel.appendChild(el('p', 'pg-hint', T.noPicture)); return 0; }
    figs.forEach(function (f) { panel.appendChild(f); });
    return figs.length;
  }

  /* ── действия ───────────────────────────────────────────────────────────
     У каждого запуска номер: ответ, который пришёл после того, как начат
     следующий запуск, не рисуется. Исключение при рисовании не оставляет в
     строке состояния «проверяю…» — оно показано карточкой ошибки. */
  var seq = 0;
  function setBusy(on) { Object.keys(actionButtons).forEach(function (k) { actionButtons[k].disabled = on; }); }
  function begin(word, quiet) {
    seq += 1;
    root.removeAttribute('data-playground-verdict');
    status.textContent = word;
    if (!quiet) setBusy(true);
    return { n: seq, at: Date.now(), quiet: !!quiet };
  }
  function alive(job) {
    if (!job.quiet) setBusy(false);
    return job.n === seq;
  }
  function settle(job, v, view) {
    root.setAttribute('data-playground-verdict', v.state);
    status.textContent = v.title + ' · ' + (Date.now() - job.at) + ' ' + T.ms;
    if (v.marks) editorOf(current).mark(v.marks);
    if (!job.quiet || root.getAttribute('data-tab') === view) showTab(view);
  }
  function guard(job, promise) {
    return promise.catch(function (e) {
      setBusy(false);
      if (job.n !== seq) return null;
      var v = { state: 'error', title: T.failed, lead: String((e && e.message) || e), problems: [], marks: null };
      var panel = panels[root.getAttribute('data-tab')] || panels.result;
      panel.textContent = ''; panel.appendChild(verdictCard(v));
      settle(job, v, root.getAttribute('data-tab') || 'result');
      return null;
    });
  }

  function doCheck(quiet) {
    var text = input.value, job = begin(T.checking, quiet);
    return guard(job, ask(text).then(function (answer) {
      if (!alive(job)) return answer;
      var v = present('check', answer, text);
      renderCheck(panels.result, v, answer, text);
      renderFormulas(panels.formula, answer);
      var pics = renderPictures(panels.picture, answer);
      renderTerminal(v.terminal);
      root.setAttribute('data-playground-pictures', String(pics));
      root.removeAttribute('data-playground-command');
      settle(job, v, 'result');
      return answer;
    }));
  }
  function doTest(quiet) {
    var text = input.value, job = begin(T.running, quiet);
    return guard(job, ask(text, { действие: 'команда', команда: 'test', ключи: {} }).then(function (answer) {
      if (!alive(job)) return answer;
      var v = present('test', answer, text);
      renderTests(panels.tests, v);
      renderTerminal(v.terminal);
      root.setAttribute('data-playground-command', 'test');
      root.setAttribute('data-playground-code', String(answer.код));
      settle(job, v, 'tests');
      return answer;
    }));
  }
  /* Поле, которое заполнила сама страница, считается пустым, как только текст
     программы изменился: функцию могли переименовать, и тогда берётся новая
     первая функция и её тест. */
  function typed(field) { return own(field) || input.value === autoFor ? field.value.trim() : ''; }
  [fnInput, argsInput].forEach(function (field) { field.addEventListener('input', function () { field.removeAttribute('data-auto'); }); });
  function objectOf(json) {
    if (!json) return {};
    try {
      var parsed = JSON.parse(json);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  function doRun(quiet, trust) {
    var text = input.value, job = begin(T.running, quiet);
    var fn = typed(fnInput), args = typed(argsInput), call = null, v = null;
    var withTests = current.enter === 'run';
    function refused(words) {
      v = present('run', { код: 2 }, text); v.title = T.notDone; v.lead = words;
      renderRun(panels.run, v, null, null); renderTerminal('');
      settle(job, v, 'run');
      return null;
    }
    return guard(job, (!fn || !args ? ask(text, { действие: 'дерево' }) : Promise.resolve(null)).then(function (t) {
      call = callOf(t && (t.дерево || (t.разбор && t.разбор.дерево)), text, fn, args);
      if (!call.fn || objectOf(call.args) === null) return null;
      if (!fn) { fnInput.value = call.fn; fnInput.setAttribute('data-auto', call.fn); }
      if (!args) { argsInput.value = call.args; argsInput.setAttribute('data-auto', call.args); }
      if (!fn || !args) autoFor = text;
      return ask(text, { действие: 'команда', команда: 'run', ключи: { функция: call.fn, доводы: call.args, наВеру: !!trust } });
    }).then(function (answer) {
      if (!alive(job)) return answer;
      if (!call.fn) return refused(T.noFunction);
      if (objectOf(call.args) === null) return refused(T.badArgs);
      v = present('run', answer, text);
      v.call = T.callOf(call.fn, argsText(objectOf(call.args)));
      root.setAttribute('data-playground-command', 'run');
      root.setAttribute('data-playground-code', String(answer.код));
      var retry = v.retry && !trust ? function () { doRun(false, true); } : null;
      if (!withTests || answer.остановлено) {
        renderRun(panels.run, v, null, retry); renderTerminal(v.terminal);
        settle(job, v, 'run');
        return answer;
      }
      return ask(text, { действие: 'команда', команда: 'test', ключи: {} }).then(function (testAnswer) {
        if (!alive(job)) return answer;
        var tv = present('test', testAnswer, text);
        renderRun(panels.run, v, tv.problems.length ? null : tv, retry);
        renderTerminal(v.terminal + '\n\n' + tv.terminal);
        v.marks = v.marks.concat(tv.problems.length ? [] : tv.marks);
        settle(job, v, 'run');
        return answer;
      });
    }));
  }
  function doAction(word, quiet) {
    if (word === 'run') return doRun(quiet, false);
    if (word === 'check') return doCheck(quiet);
    if (word === 'test') return doTest(quiet);
    if (word === 'emit') { emitState.fresh(); return emitState.refresh(quiet); }
    if (word === 'translate') return foreignState.translate(quiet);
    if (word === 'argue') return argueState.check(quiet);
    return Promise.resolve(null);
  }
  tabShown.emit = function () { if (emitState.text === null) doAction('emit', true); };
  [fnInput, argsInput].forEach(function (field) {
    field.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); doRun(false, false); } });
  });

  /* ── сетапы ─────────────────────────────────────────────────────────────
     Открыть сетап: плитка, кнопки, вкладки справа и текст. Текст берётся из
     `given.text` (адрес, пример), иначе из черновика, иначе стартовый. */
  function openSetup(key, given) {
    var s = setupOf(key) || SETUPS[0];
    given = given || {};
    current = s; seq += 1; clearTimeout(liveTimer); setBusy(false);
    root.setAttribute('data-setup', s.key);
    Object.keys(setupTiles).forEach(function (k) {
      if (k === s.key) setupTiles[k].setAttribute('aria-current', 'page'); else setupTiles[k].removeAttribute('aria-current');
    });
    actionBox.textContent = '';
    s.buttons.forEach(function (k, j) {
      actionButtons[k].classList.toggle('pg-primary', j === 0);
      actionButtons[k].title = j === 0 ? 'Ctrl+Enter' : '';
      actionBox.appendChild(actionButtons[k]);
    });
    callBar.hidden = !s.call;
    VIEWS.forEach(function (k) {
      tabButtons[k].hidden = s.views.indexOf(k) < 0;
      tabButtons[k].textContent = s.labels && s.labels[k] ? s.labels[k][LANG] : T.tabs[k];
    });
    main.root.hidden = !!s.lang; foreignState.editor.root.hidden = !s.lang;
    if (s.lang) foreignState.choose(s.lang);
    var hasText = given.text !== null && given.text !== undefined;
    var draft = hasText ? null : readDraft(s.key);
    var starter = s.starter ? starterOf(s.starter) : null;
    var text = hasText ? given.text : draft ? draft.text : setupText(s);
    var fn = typeof given.fn === 'string' ? given.fn : draft ? draft.fn || '' : '';
    var args = typeof given.args === 'string' ? given.args : draft ? draft.args || '' : '';
    fnInput.value = fn; argsInput.value = args;
    fnInput.removeAttribute('data-auto'); argsInput.removeAttribute('data-auto');
    /* Функция и аргументы стартовой программы стоят в полях как подсказка:
       стоит переписать программу — и они уступят её первой функции. */
    autoFor = text;
    if (starter && text === starter.text) {
      if (!fn) { fnInput.value = starter.fn || ''; fnInput.setAttribute('data-auto', fnInput.value); }
      if (!args) { argsInput.value = starter.args || ''; argsInput.setAttribute('data-auto', argsInput.value); }
    }
    if (s.lang) foreignState.editor.set(text); else setText(text);
    draftNote.textContent = draft ? T.draftSaved : '';
    root.setAttribute('data-draft', draft ? 'saved' : 'none');
    ['run', 'result', 'tests'].forEach(function (k) {
      panels[k].textContent = ''; panels[k].appendChild(el('p', 'pg-hint', T.press(ACTIONS[s.enter])));
    });
    panels.formula.textContent = ''; panels.formula.appendChild(el('p', 'pg-hint', T.noFormula));
    panels.picture.textContent = ''; panels.picture.appendChild(el('p', 'pg-hint', T.noPicture));
    renderTerminal('');
    emitState.reset(); foreignState.reset(); argueState.reset();
    if (given.target) emitState.target = given.target;
    else if (starter && starter.emit && !draft && !hasText) emitState.target = starter.emit;
    status.textContent = ''; hintLine.textContent = '';
    root.removeAttribute('data-playground-verdict');
    showTab(s.views[0]);
    store.set(LAST, s.key);
    /* Компилятор уже загружен — результат показан сразу, без нажатия. */
    if (warmed && !given.hold && text.trim() && s.enter !== 'argue') {
      if (!s.lang && usesLibrary(text)) libraryNote(text);
      else doAction(s.enter, true);
    }
    return s;
  }

  function chooseExample(j) {
    var ex = examples[j];
    if (!ex) return;
    root.setAttribute('data-example-lang', ex.lang);
    var kind = guessKind(ex.text);
    var away = !!current.lang || current.key === 'reasoning' || current.key === 'formula';
    var key = ex.lang !== 'flang' ? ex.lang : ex.emit ? 'emit' : kind === 'рассуждение' ? 'reasoning' : kind === 'формула' ? 'formula'
      : away ? (ex.starter ? STARTER_SETUP[starterOf(ex.starter).key] : 'proof') : current.key;
    openSetup(key, { text: ex.text, fn: ex.fn || '', args: ex.args || '', target: ex.emit || '' });
    saveDraft();
    select.value = '';
  }
  select.addEventListener('change', function () { if (select.value !== '') chooseExample(Number(select.value)); });
  resetButton.addEventListener('click', function () {
    store.del(DRAFT + current.key);
    openSetup(current.key, {});
    status.textContent = T.draftReset;
  });
  shareButton.addEventListener('click', function () {
    addressOf(editorOf(current).input.value).then(function (tail) {
      var fn = fnInput.value.trim(), args = argsInput.value.trim();
      var address = location.href.replace(/#.*$/, '') + '#setup=' + current.key + '&' + tail.slice(1) +
        (current.call && fn ? '&fn=' + encodeURIComponent(fn) : '') + (current.call && args ? '&args=' + encodeURIComponent(args) : '') +
        (current.enter === 'emit' ? '&target=' + emitState.target : '');
      history.replaceState(null, '', address);
      if (navigator.clipboard) navigator.clipboard.writeText(address).catch(function () {});
      status.textContent = T.linkCopied;
    });
  });

  /* ── адрес ──────────────────────────────────────────────────────────────── */
  function textFromFields(f) {
    if (f.code !== undefined) return inflate(f.code).catch(function () { return null; });
    if (f.text !== undefined) return Promise.resolve(fromAddress('#text=' + f.text));
    return Promise.resolve(null);
  }
  function fromHash() {
    var f = addressFields(location.hash);
    return textFromFields(f).then(function (t) {
      var plan = planOf(f, t);
      if (!plan) return false;
      openSetup(plan.setup, { text: plan.text, fn: plan.fn, args: plan.args, target: plan.target, hold: !!plan.todo });
      root.setAttribute('data-address', 'read');
      if (plan.todo) doAction(plan.todo, false);
      return true;
    });
  }
  window.addEventListener('hashchange', fromHash);
  fromHash().then(function (read) {
    if (!read) openSetup((setupOf(store.get(LAST)) || SETUPS[0]).key, {});
    root.setAttribute('data-ready', 'yes');
  });

  /* Для проб из браузера без рук и для следующих слоёв страницы (несколько
     файлов, обозреватель библиотеки, консоль): всё, что умеет рабочее место,
     доступно отсюда. `ask` — прямой вопрос потоку с компилятором. */
  window.флангПесочница = {
    run: function (text) { if (text !== undefined && text !== input.value) setText(text); return doCheck(false); },
    setText: setText, showTab: showTab, examples: examples, highlight: highlightHtml, code: codeHtml,
    choose: chooseExample, addressOf: addressOf, warm: warm, ask: ask, page: PAGE,
    command: function (word, keys) {
      if (word !== 'run') return doAction(word, false);
      if (keys && keys.функция !== undefined) fnInput.value = keys.функция;
      if (keys && keys.доводы !== undefined) argsInput.value = keys.доводы;
      return doRun(false, !!(keys && keys.наВеру));
    },
    runFunction: function () { return doRun(false, false); },
    setTimeLimit: function (ms) { TIME_LIMIT_MS = ms; },
    print: function (target) { emitState.target = target; return doAction('emit', false); },
    translate: function (text, lang) {
      if (!current.lang) openSetup(lang || 'c', { hold: true, text: text });
      else if (text !== undefined) foreignState.editor.set(text);
      if (lang) foreignState.choose(lang);
      return foreignState.translate(false);
    },
    setup: function (key, given) { return openSetup(key, given || {}); }, act: doAction,
    editor: function () { return editorOf(current); }, current: function () { return current; }
  };
})();
