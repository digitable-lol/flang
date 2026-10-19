/* Песочница flang на странице: редактор с подсветкой, итог проверки
   человеческими словами, формулы с кванторами, ввод формулы и рисунки.

   Проверяет не этот файл, а компилятор, собранный в WebAssembly: он работает
   в отдельном потоке (`playground/flang_host_browser.js`) и отдаёт сюда
   разобранный ответ — машинную ведомость `check --proof --json`, дерево
   разбора `flang ast`, замечания с местом и ответ независимой проверки
   записи. Здесь этот ответ только РАСКЛАДЫВАЕТСЯ: ни одно слово итога не
   выуживается из русского текста компилятора.

   Слова языка для подсветки берутся из таблицы лексера
   (flang/self/lexer.flang, «Куски таблицы»): сборка сайта кладёт их на
   страницу блоком `#flang-lexicon`, второго списка слов здесь нет. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var holder = document.querySelector('main pre.lang-playground');
  if (!holder) return;

  var EN = document.documentElement.lang === 'en';
  var ROOT = (document.querySelector('.poisk') || { getAttribute: function () { return ''; } }).getAttribute('data-koren') || '';
  var KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';

  var T = EN ? {
    example: 'Example', check: 'Check', share: 'Share', checking: 'checking… (the first run downloads the compiler)',
    linkCopied: 'the link carries the text; nothing is sent to a server', ms: 'ms',
    tabs: { result: 'Result', formula: 'Formulas', emit: 'flang → language', foreign: 'language → flang', input: 'Formula → flang', picture: 'Pictures' },
    loading: function (mb) { return 'downloading the compiler: ' + mb + ' MB'; }, ready: 'compiler loaded',
    emitLead: 'The same program printed by «flang emit» into every target language. The compiler in this tab prints it, nothing is sent anywhere.',
    emitting: 'printing…', emitFailed: 'Not printed', runtimeNote: 'Runtime files are copied into the output as they are and are not shown here: ',
    emitFrom: { 'формула': 'The formula was first translated to flang; this is that program.', 'рассуждение': 'The reasoning was first turned into a flang program; this is that program.' },
    buildHow: 'Compiler output', emitStale: 'The text in the editor changed. Press «Print» to print it again.', print: 'Print',
    foreignLead: 'Write a function in another language. A translator turns it into flang, and the kernel checks the result right away. The translator is not trusted: whatever it writes, the kernel judges.',
    translateGo: 'Translate and check', translating: 'translating…', soon: 'soon', soonNote: 'The Python translator is not in this build yet.',
    readFailed: 'The text was not read', notTranslated: 'Not translated', fnProved: 'Translated and proved', fnUnproved: 'Translated, not everything is proved',
    fnFailed: 'Translated, the check failed', noFunctions: 'There are no function definitions in the text.', inFlang: 'In flang',
    cSubset: 'The C subset: int and struct of int fields, if/else, while, for, return, + − * / % and comparisons. Overflow and division by zero become obligations the kernel has to prove.',
    foreignLabel: 'source in another language', fallacy: 'Fallacy: ', card: 'fallacy card', hints: 'Possible fallacies (check them yourself): ', boundary: 'What the form does not decide: ', unparsedSentence: 'Not read: sentence ',
    lineNo: 'line numbers',
    editor: 'flang source or reasoning', press: 'Press «Check» or Ctrl+Enter.',
    proved: 'Proved for all values', examples: 'Checked on examples only', counter: 'Does not follow: here is a counterexample',
    unproved: 'Not proved', error: 'Error', errorAt: 'Error on line ', clean: 'No errors', partial: 'Not everything was checked',
    follows: 'Follows', notRead: 'The text was not read', formulaRefused: 'The formula was not read', failed: 'The check did not run',
    provedLead: 'Every statement holds for every input, not only for the examples written.',
    examplesLead: 'No violations on the examples, but this is not a proof for the remaining values.',
    unprovedLead: 'Some statements have neither a proof nor examples.',
    cleanLead: 'Syntax, types and termination are fine. The program states nothing to prove.',
    partialLead: 'Some declarations are accepted but their structure is not checked by the compiler.',
    errorLead: 'The compiler stopped here; the line is marked in the editor.',
    details: 'Details', terminal: 'Compiler output, as in a terminal', program: 'The program the reasoning became',
    independent: { ok: 'Independent check: a separate program replayed the proof record and it matched.', bad: 'Independent check did not confirm the proof record.', imports: 'Independent check is not available for programs with «использует».', none: '' },
    kinds: { 'утверждение': 'statement', 'постусловие': 'postcondition', 'закон': 'law', 'statement': 'statement', 'postcondition': 'postcondition' },
    of: ' of ', premises: 'premises', from: ' is derived from ', notFrom: ' is not derived from ', counterexample: 'Counterexample: ',
    line: 'line ', column: ', column ',
    noFormula: 'There are no statements to show as a formula yet. Check a program with «утверждение» or «обеспечивает».',
    outside: 'Outside the formula notation: ', latexSource: 'LaTeX source',
    inputLead: 'Write a statement with ∀ / ∃ or in LaTeX. It is translated to flang and checked by the kernel right away.',
    inputPlaceholder: '∀ x ∈ ℤ, ∀ y ∈ ℤ, x + y = y + x', translate: 'Translate and check', toEditor: 'Open in the editor',
    asFlang: 'In flang', rendered: 'Formula',
    noPicture: 'Pictures are drawn for categories, functors, monoids, sets and proofs. This text has none of them.',
    category: 'Category ', functor: 'Functor ', monoid: 'Monoid ', sets: 'Sets', proof: 'Proof of ',
    square: 'square for ', triangle: 'composition ', assoc: 'associativity', units: 'unit laws',
    marks: { proved: 'proved', examples: 'on examples', violated: 'violated', unknown: 'not checked' },
    induction: 'induction on ', cases: 'case ', base: 'base', step: 'step', rule: 'rule ', byTypes: 'from the declared argument types',
    byComputation: 'by computing a closed goal', hypothesis: 'by the induction hypothesis',
    claim: {
      proved: 'proved for all inputs', induction: function (c) { return 'proved by induction on «' + c.param + '» (type «' + c.type + '»)'; },
      conditional: 'proved under a condition that is not proved itself', grid: function (n) { return 'checked on ' + n + ' example values only'; },
      declared: 'not proved: no proof and no examples — add a theorem', refused: 'not proved: the kernel could not derive the goal', violated: 'refuted: there is an input where it is false'
    },
    law: function (kind, n) { return (kind === 'моноид' ? 'monoid laws' : kind === 'категория' ? 'category laws' : 'commuting squares') + ' checked on ' + n + ' example values'; },
    lawProved: 'laws proved for all values', assumed: 'accepted without checking: ',
    lawKinds: { 'категория': 'category', 'моноид': 'monoid', 'связь': 'functor', 'преобразование': 'natural transformation' }
  } : {
    example: 'Пример', check: 'Проверить', share: 'Поделиться', checking: 'проверяю… (первый прогон скачивает компилятор)',
    linkCopied: 'текст едет в адресе; на сервер не уходит ничего', ms: 'мс',
    tabs: { result: 'Итог', formula: 'Формулы', emit: 'flang → язык', foreign: 'язык → flang', input: 'Формула → flang', picture: 'Рисунки' },
    loading: function (mb) { return 'скачиваю компилятор: ' + mb + ' МБ'; }, ready: 'компилятор загружен',
    emitLead: 'Та же программа, напечатанная командой «flang emit» во все целевые языки. Печатает компилятор в этой вкладке, на сервер не уходит ничего.',
    emitting: 'печатаю…', emitFailed: 'Не напечатано', runtimeNote: 'Файлы рантайма копируются в вывод как есть и здесь не показаны: ',
    emitFrom: { 'формула': 'Формулу сначала перевели на flang; напечатана эта программа.', 'рассуждение': 'Рассуждение сначала превратили в программу на flang; напечатана она.' },
    buildHow: 'Вывод компилятора', emitStale: 'Текст в редакторе изменился. Нажмите «Напечатать», чтобы напечатать его заново.', print: 'Напечатать',
    foreignLead: 'Напишите функцию на другом языке. Переводчик сделает из неё программу на flang, и ядро сразу её проверит. Переводчику не доверяют: что бы он ни написал, судит ядро.',
    translateGo: 'Перевести и проверить', translating: 'перевожу…', soon: 'скоро', soonNote: 'Переводчика с Python в этой сборке ещё нет.',
    readFailed: 'Текст не прочитан', notTranslated: 'Не переведена', fnProved: 'Переведена и доказана', fnUnproved: 'Переведена, доказано не всё',
    fnFailed: 'Переведена, проверка не прошла', noFunctions: 'В тексте нет определений функций.', inFlang: 'На flang',
    cSubset: 'Подмножество C: int и struct из полей int, if/else, while, for, return, + − * / % и сравнения. Переполнение и деление на ноль становятся обязательствами, которые ядро должно доказать.',
    foreignLabel: 'исходник на другом языке', fallacy: 'Ошибка: ', card: 'карточка ошибки', hints: 'Возможные ошибки (проверьте сами): ', boundary: 'Чего форма не решает: ', unparsedSentence: 'Не прочитано предложение ',
    lineNo: 'номера строк',
    editor: 'исходник на flang или рассуждение', press: 'Нажмите «Проверить» или Ctrl+Enter.',
    proved: 'Доказано для всех значений', examples: 'Проверено только на примерах', counter: 'Не следует: вот контрпример',
    unproved: 'Не доказано', error: 'Ошибка', errorAt: 'Ошибка в строке ', clean: 'Ошибок нет', partial: 'Проверено не всё',
    follows: 'Следует', notRead: 'Текст не прочитан', formulaRefused: 'Формула не прочитана', failed: 'Проверка не запустилась',
    provedLead: 'Каждое утверждение верно на всех входах, а не только на написанных примерах.',
    examplesLead: 'На примерах нарушений нет, но для остальных значений это не доказательство.',
    unprovedLead: 'У части утверждений нет ни доказательства, ни примеров.',
    cleanLead: 'Разбор, типы и завершение в порядке. Доказывать в программе нечего.',
    partialLead: 'Часть объявлений принята, но их устройство компилятор не проверяет.',
    errorLead: 'Компилятор остановился здесь; строка отмечена в редакторе.',
    details: 'Подробности', terminal: 'Вывод компилятора, как в терминале', program: 'Программа, в которую превратилось рассуждение',
    independent: { ok: 'Независимая проверка: отдельная программа заново проиграла запись доказательства, и она сошлась.', bad: 'Независимая проверка не подтвердила запись доказательства.', imports: 'Независимая проверка программ с «использует» здесь недоступна.', none: '' },
    kinds: { 'утверждение': 'утверждение', 'постусловие': 'постусловие', 'закон': 'закон', 'statement': 'утверждение', 'postcondition': 'постусловие' },
    of: ' функции ', premises: 'посылок', from: ' выводится из ', notFrom: ' не выводится из ', counterexample: 'Контрпример: ',
    line: 'строка ', column: ', столбец ',
    noFormula: 'Показывать формулой пока нечего. Проверьте программу с «утверждение» или «обеспечивает».',
    outside: 'Вне записи формул: ', latexSource: 'Исходник LaTeX',
    inputLead: 'Напишите утверждение с ∀ / ∃ или в LaTeX. Оно переводится на flang и сразу проверяется ядром.',
    inputPlaceholder: '∀ x ∈ ℤ, ∀ y ∈ ℤ, x + y = y + x', translate: 'Перевести и проверить', toEditor: 'Открыть в редакторе',
    asFlang: 'На flang', rendered: 'Формула',
    noPicture: 'Рисунки строятся для категорий, функторов, моноидов, множеств и доказательств. В этом тексте их нет.',
    category: 'Категория ', functor: 'Функтор ', monoid: 'Моноид ', sets: 'Множества', proof: 'Доказательство: ',
    square: 'квадрат для ', triangle: 'композиция ', assoc: 'ассоциативность', units: 'единица',
    marks: { proved: 'доказано', examples: 'на примерах', violated: 'нарушено', unknown: 'не проверялось' },
    induction: 'индукция по ', cases: 'случай ', base: 'база', step: 'шаг', rule: 'правило ', byTypes: 'из объявленных типов аргументов',
    byComputation: 'вычислением замкнутой цели', hypothesis: 'по предположению индукции',
    claim: {
      proved: 'доказано для всех входов', induction: function (c) { return 'доказано индукцией по «' + c.param + '» (тип «' + c.type + '»)'; },
      conditional: 'доказано при условии, которое само не доказано', grid: function (n) { return 'проверено только на примерах: значений ' + n; },
      declared: 'не доказано: нет ни доказательства, ни примеров — добавьте теорему', refused: 'не доказано: ядро не смогло вывести цель', violated: 'опровергнуто: есть вход, на котором утверждение ложно'
    },
    law: function (kind, n) { return (kind === 'моноид' ? 'законы моноида' : kind === 'категория' ? 'законы категории' : 'коммутативность квадратов') + ' проверены на примерах: значений ' + n; },
    lawProved: 'законы доказаны для всех значений', assumed: 'принято без проверки: ',
    lawKinds: { 'категория': 'категория', 'моноид': 'моноид', 'связь': 'функтор', 'преобразование': 'преобразование' }
  };

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
  function fromAddress(hash) {
    var m = /(?:^#|&)text=([A-Za-z0-9_-]*)/.exec(hash || '');
    if (!m) return null;
    try {
      var s = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return null;
    }
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
  var LETTER = /[\p{L}\p{N}_]/u;

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

  function highlightHtml(src, badLines) { return linesHtml(segments(src), badLines); }

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
  function linesHtml(segs, badLines) {
    var lines = [[]];
    segs.forEach(function (s) {
      s[0].split('\n').forEach(function (part, j) {
        if (j > 0) lines.push([]);
        if (part) lines[lines.length - 1].push(s[1] ? '<span class="' + s[1] + '">' + esc(part) + '</span>' : esc(part));
      });
    });
    return lines.map(function (parts, j) {
      var bad = badLines && badLines.has(j + 1);
      return '<span class="pg-line' + (bad ? ' pg-line-bad' : '') + '">' + (parts.join('') || ' ') + '</span>';
    }).join('');
  }
  function codeHtml(src, lang, badLines) { return lang === 'flang' ? highlightHtml(src, badLines) : linesHtml(codeSegments(src, lang), badLines); }
  function codeBlock(src, lang) {
    var pre = el('pre', 'lang-' + lang), code = el('code');
    code.innerHTML = codeHtml(src, lang, null);
    pre.appendChild(code);
    return pre;
  }

  /* ── KaTeX с CDN, по требованию ─────────────────────────────────────────── */
  var katexLoading = null;
  function katex() {
    if (window.katex) return Promise.resolve(window.katex);
    if (!katexLoading) {
      katexLoading = new Promise(function (resolve, reject) {
        var css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = KATEX + 'katex.min.css';
        document.head.appendChild(css);
        var s = document.createElement('script');
        s.src = KATEX + 'katex.min.js';
        s.onload = function () { resolve(window.katex); };
        s.onerror = function () { katexLoading = null; reject(new Error('katex')); };
        document.head.appendChild(s);
      });
    }
    return katexLoading;
  }
  function texBlock(tex) {
    var box = el('div', 'pg-tex');
    var code = el('code', 'pg-tex-source', tex);
    box.appendChild(code);
    katex().then(function (k) {
      var shown = el('div', 'pg-tex-shown');
      try {
        k.render(tex, shown, { throwOnError: false, displayMode: true });
        box.insertBefore(shown, code);
        var d = el('details', 'pg-tex-raw');
        d.appendChild(el('summary', null, T.latexSource));
        box.removeChild(code);
        d.appendChild(code);
        box.appendChild(d);
      } catch (e) { /* остаётся исходник */ }
    }, function () { /* без сети остаётся исходник */ });
    return box;
  }

  /* ── разметка песочницы ─────────────────────────────────────────────────── */
  /* Языки, с которых песочница переводит во flang. Один язык — одна строка;
     готовым язык делает переводчик в сборке песочницы (`ПЕРЕВОДЧИКИ` в
     обвязке). Неготовый показан честно — кнопкой с подписью «скоро». */
  var FOREIGN = [
    { lang: 'c', name: 'C', ready: true, note: function () { return T.cSubset; } },
    { lang: 'python', name: 'Python', ready: false, note: function () { return T.soonNote; } }
  ];
  var examples = [];
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

  var bar = el('div', 'playground-bar');
  var select = el('select', 'playground-examples');
  select.setAttribute('aria-label', T.example);
  examples.forEach(function (ex, j) { var o = el('option', null, ex.name); o.value = String(j); select.appendChild(o); });
  var checkButton = el('button', 'playground-check', T.check); checkButton.type = 'button';
  var shareButton = el('button', 'playground-share', T.share); shareButton.type = 'button';
  var status = el('span', 'playground-status'); status.setAttribute('role', 'status');
  bar.appendChild(select); bar.appendChild(checkButton); bar.appendChild(shareButton); bar.appendChild(status);

  /* Редактор: прозрачное поле ввода над раскрашенной копией текста и столбец
     номеров строк слева. Строка с ошибкой отмечена и в тексте, и в номере. */
  function makeEditor(lang, label, onRun) {
    var box = el('div', 'pg-editor');
    var gutter = el('pre', 'pg-gutter'); gutter.setAttribute('aria-hidden', 'true');
    var paintLayer = el('pre', 'pg-paint'); paintLayer.setAttribute('aria-hidden', 'true');
    var area = el('textarea', 'playground-input');
    area.spellcheck = false; area.setAttribute('wrap', 'off'); area.setAttribute('aria-label', label);
    area.setAttribute('autocapitalize', 'off'); area.setAttribute('autocomplete', 'off');
    box.appendChild(gutter); box.appendChild(paintLayer); box.appendChild(area);
    var ed = { root: box, input: area, bad: new Set(), lang: lang };
    ed.repaint = function () {
      paintLayer.innerHTML = codeHtml(area.value, ed.lang, ed.bad) + '<span class="pg-line"> </span>';
      var count = area.value.split('\n').length, html = '';
      for (var j = 1; j <= count; j++) html += '<span class="pg-num' + (ed.bad.has(j) ? ' pg-num-bad' : '') + '">' + j + '</span>';
      gutter.innerHTML = html + '<span class="pg-num"> </span>';
      ed.sync();
    };
    ed.sync = function () {
      paintLayer.scrollTop = area.scrollTop; paintLayer.scrollLeft = area.scrollLeft;
      gutter.scrollTop = area.scrollTop;
    };
    ed.fit = function () {
      var lines = area.value.split('\n').length;
      area.style.height = Math.min(Math.max(lines + 1, 8), 30) * 1.45 + 1.6 + 'em';
    };
    ed.set = function (text) { area.value = text; ed.bad = new Set(); ed.fit(); ed.repaint(); };
    ed.mark = function (lines) { ed.bad = new Set(lines); ed.repaint(); };
    ed.goTo = function (line) {
      var all = area.value.split('\n'), pos = 0;
      for (var j = 0; j < line - 1 && j < all.length; j++) pos += all[j].length + 1;
      area.focus(); area.selectionStart = area.selectionEnd = pos;
      var lh = parseFloat(getComputedStyle(area).lineHeight) || 18;
      area.scrollTop = Math.max(0, (line - 3) * lh);
    };
    area.addEventListener('input', function () { ed.bad = new Set(); ed.fit(); ed.repaint(); if (ed.onEdit) ed.onEdit(); });
    area.addEventListener('scroll', ed.sync);
    area.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); onRun(); }
      else if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey) {
        ev.preventDefault();
        var s = area.selectionStart, e = area.selectionEnd;
        area.value = area.value.slice(0, s) + '  ' + area.value.slice(e);
        area.selectionStart = area.selectionEnd = s + 2; ed.repaint();
      }
    });
    return ed;
  }

  var main = makeEditor('flang', T.editor, function () { run(main.input.value); });
  var input = main.input;
  var editor = main.root;
  var marks = el('ul', 'pg-marks'); marks.hidden = true;

  var tabs = el('div', 'pg-tabs'); tabs.setAttribute('role', 'tablist');
  var panels = {};
  var tabButtons = {};
  ['result', 'formula', 'emit', 'foreign', 'input', 'picture'].forEach(function (key) {
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
    Object.keys(panels).forEach(function (k) {
      panels[k].hidden = k !== key;
      tabButtons[k].setAttribute('aria-selected', k === key ? 'true' : 'false');
      tabButtons[k].tabIndex = k === key ? 0 : -1;
    });
    root.setAttribute('data-tab', key);
    if (tabShown[key]) tabShown[key]();
  }
  tabs.addEventListener('keydown', function (ev) {
    var keys = Object.keys(panels), now = keys.indexOf(root.getAttribute('data-tab'));
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      var next = keys[(now + (ev.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
      showTab(next); tabButtons[next].focus(); ev.preventDefault();
    }
  });

  root.appendChild(bar); root.appendChild(editor); root.appendChild(marks); root.appendChild(tabs);
  Object.keys(panels).forEach(function (k) { root.appendChild(panels[k]); });
  panels.result.appendChild(el('p', 'pg-hint', T.press));
  panels.formula.appendChild(el('p', 'pg-hint', T.noFormula));
  panels.picture.appendChild(el('p', 'pg-hint', T.noPicture));

  /* ── редактор ───────────────────────────────────────────────────────────── */
  function repaint() { main.repaint(); }
  function setText(text) {
    main.set(text); marks.hidden = true; marks.textContent = '';
  }
  main.onEdit = function () { marks.hidden = true; emitStale(); };
  function goToLine(line) { main.goTo(line); }
  function markLines(list) {
    marks.textContent = '';
    list.forEach(function (m) {
      var li = el('li');
      if (m.line) {
        var a = el('button', 'pg-mark-line', T.line + m.line);
        a.type = 'button';
        a.addEventListener('click', function () { goToLine(m.line); });
        li.appendChild(a);
        li.appendChild(document.createTextNode(' '));
      }
      li.appendChild(el('span', null, m.text));
      marks.appendChild(li);
    });
    marks.hidden = list.length === 0;
    main.mark(list.filter(function (m) { return m.line; }).map(function (m) { return m.line; }));
  }

  /* ── поток с компилятором ───────────────────────────────────────────────── */
  var worker = null, counter = 0, waiting = {}, loadedOnce = false;
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(ROOT + 'playground/flang_host_browser.js', { type: 'module' });
    worker.addEventListener('message', function (ev) {
      if (ev.data && ev.data.прогресс) {
        var pr = ev.data.прогресс;
        if (pr.файл === 'flang.wasm' && !loadedOnce) {
          status.textContent = pr.готово ? T.ready : T.loading((pr.байт / 1048576).toFixed(1));
          if (pr.готово) loadedOnce = true;
        }
        return;
      }
      var cb = waiting[ev.data.номер];
      if (cb) { delete waiting[ev.data.номер]; cb(ev.data); }
    });
    worker.addEventListener('error', function (ev) {
      Object.keys(waiting).forEach(function (k) {
        waiting[k]({ код: 2, итог: 'сбой', вывод: 'FLANG_PLAYGROUND ' + (ev.message || ''), разбор: null });
        delete waiting[k];
      });
    });
    return worker;
  }
  function ask(text, extra) {
    return new Promise(function (resolve) {
      counter += 1;
      waiting[counter] = resolve;
      var msg = { номер: counter, текст: text, база: new URL(ROOT + 'playground/', location.href).href };
      Object.keys(extra || {}).forEach(function (k) { msg[k] = extra[k]; });
      ensureWorker().postMessage(msg);
    });
  }
  /* Компилятор весит десятки мегабайт, поэтому качается не при открытии
     страницы, а при первом касании песочницы: пока человек правит текст,
     модуль уже едет и собирается. */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    ask('', { действие: 'прогреть' });
  }
  ['pointerdown', 'focusin', 'keydown'].forEach(function (evName) { root.addEventListener(evName, warm, { once: true }); });

  /* ── раскладка ответа ───────────────────────────────────────────────────── */
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

  function exampleOf(tree, diag) {
    var fns = (tree && tree.functions) || [];
    for (var i = 0; i < fns.length; i++) {
      var f = fns[i];
      if (diag.text.indexOf('«' + f.name + '»') < 0) continue;
      var exs = f.examples || [];
      for (var j = 0; j < exs.length; j++) if (diag.text.indexOf('«' + exs[j].name + '»') >= 0) return { fn: f, ex: exs[j] };
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

  /* Итог: заголовок, одна фраза, список пунктов и метки строк. */
  function summarize(answer) {
    var r = answer.разбор || {};
    var s = { state: 'error', title: T.failed, lead: '', items: [], marks: [], counter: '' };
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
      diags.forEach(function (d) { s.marks.push({ line: d.строка, text: d.текст }); });
      if (violation) {
        s.state = 'violated'; s.title = T.counter;
        var hit = exampleOf(r.дерево, violation);
        if (hit) {
          var args = Object.keys(hit.ex.args || {}).map(function (k) { return k + ' = ' + valueText(hit.ex.args[k]); }).join(', ');
          s.counter = '«' + hit.fn.name + '»: ' + args;
          s.marks.unshift({ line: hit.ex.span && hit.ex.span.line, text: violation.текст });
          (hit.fn.postconditions || []).forEach(function (p) {
            if (violation.текст.indexOf('«' + p.name + '»') >= 0 && p.span) s.marks.push({ line: p.span.line, text: p.message || p.name });
          });
        } else s.counter = violation.текст;
        s.lead = violation.текст;
        return s;
      }
      var first = diags.filter(function (d) { return d.строка; })[0] || diags[0];
      s.title = first.строка ? T.errorAt + first.строка : T.error;
      s.lead = first.текст;
      s.items = diags.map(function (d) { return { state: 'error', text: (d.строка ? T.line + d.строка + ': ' : '') + d.текст }; });
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

  function independentWords(answer, text) {
    var r = answer.разбор || {};
    if (!r.сверка || r.сверка.код === null || r.сверка.код === undefined) return '';
    if (r.сверка.код === 0) return T.independent.ok;
    if (/использует/.test(text)) return T.independent.imports;
    var proved = ((r.ведомость && r.ведомость.claims) || []).some(function (c) { return claimState(c) === 'proved'; });
    return proved || r.рассуждение ? T.independent.bad : '';
  }

  function renderResult(panel, answer, text) {
    panel.textContent = '';
    var s = summarize(answer);
    var card = el('div', 'pg-verdict pg-' + s.state);
    card.appendChild(el('p', 'pg-verdict-title', s.title));
    if (s.lead) card.appendChild(el('p', 'pg-verdict-lead', s.lead));
    if (s.counter) {
      var ce = el('p', 'pg-counter');
      ce.appendChild(el('strong', null, T.counterexample));
      ce.appendChild(el('code', null, s.counter));
      card.appendChild(ce);
    }
    panel.appendChild(card);
    var r = answer.разбор || {};
    var rc = r.рассуждение && r.рассуждение.проверка;
    if (rc) reasoningCheck(card, panel, rc);
    if (r.формула && !r.формула.code) panel.appendChild(formulaCard({ name: '', plain: r.формула.plain, tex: r.формула.tex }));
    if (s.items.length) {
      var ul = el('ul', 'pg-items');
      s.items.forEach(function (it) { var li = el('li', 'pg-item pg-' + it.state, it.text); ul.appendChild(li); });
      panel.appendChild(ul);
    }
    var ind = independentWords(answer, text);
    var details = el('details', 'pg-details');
    details.appendChild(el('summary', null, T.details));
    if (ind) details.appendChild(el('p', null, ind));
    if (r.рассуждение && r.рассуждение.прочитано) {
      var ol = el('ol', 'pg-sentences');
      (r.рассуждение.предложения || []).forEach(function (x) { ol.appendChild(el('li', null, x.replace(/^\d+\.\s*/, ''))); });
      details.appendChild(ol);
      var pd = el('details', 'pg-nested');
      pd.appendChild(el('summary', null, T.program));
      var pre = el('pre', 'lang-flang'); var code = el('code'); code.innerHTML = highlightHtml(r.рассуждение.программа, null);
      pre.appendChild(code); pd.appendChild(pre); details.appendChild(pd);
    }
    var td = el('details', 'pg-nested');
    td.appendChild(el('summary', null, T.terminal));
    td.appendChild(el('pre', 'playground-output', (r.терминал || answer.вывод || '').trim()));
    details.appendChild(td);
    panel.appendChild(details);
    markLines(s.marks.filter(function (m) { return m.text; }));
    return s;
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
    if (f.plain) box.appendChild(el('p', 'pg-formula-plain', f.plain));
    if (f.tex) box.appendChild(texBlock(f.tex));
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

  /* ── ввод формулы ───────────────────────────────────────────────────────── */
  (function buildInput() {
    var p = panels.input;
    p.appendChild(el('p', 'pg-hint', T.inputLead));
    var area = el('textarea', 'pg-formula-input');
    area.rows = 3; area.spellcheck = false; area.placeholder = T.inputPlaceholder; area.setAttribute('aria-label', T.rendered);
    var preview = el('div', 'pg-formula-preview');
    var go = el('button', 'playground-check', T.translate); go.type = 'button';
    var out = el('div', 'pg-formula-out');
    p.appendChild(area); p.appendChild(preview); p.appendChild(go); p.appendChild(out);
    var timer = null;
    function showPreview() {
      preview.textContent = '';
      var v = area.value.trim();
      if (!v) return;
      if (/\\/.test(v)) preview.appendChild(texBlock(v));
      else preview.appendChild(el('p', 'pg-formula-plain', v));
    }
    area.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(showPreview, 250); });
    function translate() {
      var v = area.value.trim();
      if (!v) return;
      go.disabled = true; out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.checking));
      ask(v).then(function (answer) {
        go.disabled = false; out.textContent = '';
        var s = summarize(answer);
        var card = el('div', 'pg-verdict pg-' + s.state);
        card.appendChild(el('p', 'pg-verdict-title', s.title));
        if (s.lead) card.appendChild(el('p', 'pg-verdict-lead', s.lead));
        out.appendChild(card);
        var f = (answer.разбор || {}).формула;
        if (f && !f.code) {
          out.appendChild(formulaCard({ name: '', plain: f.plain, tex: f.tex }));
          out.appendChild(el('p', 'pg-formula-name', T.asFlang));
          var pre = el('pre', 'lang-flang'); var code = el('code'); code.innerHTML = highlightHtml(f.unit, null);
          pre.appendChild(code); out.appendChild(pre);
          var open = el('button', 'playground-share', T.toEditor); open.type = 'button';
          open.addEventListener('click', function () { setText(f.unit); showTab('result'); input.focus(); });
          out.appendChild(open);
        }
        root.setAttribute('data-formula-verdict', s.state);
      });
    }
    go.addEventListener('click', translate);
    area.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); translate(); } });
  })();

  /* ── flang → язык ───────────────────────────────────────────────────────── */
  var TARGETS = [
    { target: 'c', name: 'C' }, { target: 'cpp', name: 'C++' }, { target: 'go', name: 'Go' }, { target: 'rust', name: 'Rust' },
    { target: 'java', name: 'Java' }, { target: 'js', name: 'JavaScript' }, { target: 'ts', name: 'TypeScript' },
    { target: 'elixir', name: 'Elixir' }, { target: 'python', name: 'Python' }, { target: 'csharp', name: 'C#' }
  ];
  var emitState = { target: 'go', text: null, cache: {}, file: {} };
  var emitStale = function () {};
  (function buildEmit() {
    var p = panels.emit;
    p.appendChild(el('p', 'pg-hint', T.emitLead));
    var picker = el('div', 'pg-langs'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', T.tabs.emit);
    var buttons = {};
    TARGETS.forEach(function (t) {
      var bt = el('button', 'pg-lang', t.name); bt.type = 'button'; bt.setAttribute('data-target', t.target);
      bt.addEventListener('click', function () { emitState.target = t.target; refresh(); });
      picker.appendChild(bt); buttons[t.target] = bt;
    });
    var again = el('button', 'playground-share', T.print); again.type = 'button';
    var note = el('p', 'pg-hint pg-stale'); note.hidden = true; note.textContent = T.emitStale;
    var out = el('div', 'pg-emit-out');
    p.appendChild(picker); p.appendChild(note); p.appendChild(out);
    again.addEventListener('click', function () { emitState.cache = {}; emitState.text = input.value; refresh(); });
    emitStale = function () { if (emitState.text !== null && emitState.text !== input.value) { note.hidden = false; note.appendChild(again); } };
    function show(answer) {
      out.textContent = '';
      root.setAttribute('data-emit-target', answer.цель || emitState.target);
      root.setAttribute('data-emit-code', String(answer.код));
      if (answer.код !== 0 || !(answer.файлы || []).length) {
        var card = el('div', 'pg-verdict pg-error');
        card.appendChild(el('p', 'pg-verdict-title', T.emitFailed));
        var first = (answer.замечания || [])[0];
        if (first) card.appendChild(el('p', 'pg-verdict-lead', (first.строка ? T.line + first.строка + ': ' : '') + first.текст));
        out.appendChild(card);
        if (first && first.строка) markLines((answer.замечания || []).map(function (d) { return { line: d.строка, text: d.текст }; }));
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
      var d = el('details', 'pg-details');
      d.appendChild(el('summary', null, T.buildHow));
      d.appendChild(el('pre', 'playground-output', (answer.вывод || '').trim()));
      out.appendChild(d);
    }
    function refresh() {
      Object.keys(buttons).forEach(function (k) { buttons[k].setAttribute('aria-pressed', k === emitState.target ? 'true' : 'false'); });
      if (emitState.text === null) emitState.text = input.value;
      note.hidden = emitState.text === input.value;
      var key = emitState.target, text = emitState.text, cached = emitState.cache[key];
      if (cached) { show(cached); return Promise.resolve(cached); }
      out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.emitting));
      root.removeAttribute('data-emit-code');
      return ask(text, { действие: 'напечатать', цель: key }).then(function (answer) {
        if (emitState.text !== text) return answer;
        emitState.cache[key] = answer;
        if (emitState.target === key) show(answer);
        return answer;
      });
    }
    emitState.refresh = refresh;
    emitState.reset = function () { emitState.cache = {}; emitState.text = null; note.hidden = true; };
    tabShown.emit = function () { if (emitState.text !== input.value) { emitState.cache = {}; emitState.text = input.value; } refresh(); };
  })();

  /* ── язык → flang ───────────────────────────────────────────────────────── */
  var foreignState = { lang: 'c', editor: null };
  (function buildForeign() {
    var p = panels.foreign;
    p.appendChild(el('p', 'pg-hint', T.foreignLead));
    var picker = el('div', 'pg-langs'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', T.tabs.foreign);
    var buttons = {};
    var ed = makeEditor('c', T.foreignLabel, function () { translate(); });
    foreignState.editor = ed;
    var note = el('p', 'pg-hint');
    var go = el('button', 'playground-check', T.translateGo); go.type = 'button';
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
    }
    p.appendChild(picker); p.appendChild(note); p.appendChild(ed.root); p.appendChild(go); p.appendChild(out);
    FOREIGN.filter(function (f) { return !f.ready; }).forEach(function (f) { p.insertBefore(el('p', 'pg-hint pg-soon', f.name + ': ' + f.note()), ed.root); });
    choose('c');
    var firstC = examples.filter(function (x) { return x.lang === 'c'; })[0];
    ed.set(firstC ? firstC.text : '');
    function translate() {
      var text = ed.input.value;
      if (!text.trim()) return Promise.resolve(null);
      go.disabled = true; out.textContent = ''; out.appendChild(el('p', 'pg-hint', T.translating));
      root.removeAttribute('data-foreign-verdict');
      ed.mark([]);
      return ask(text, { действие: 'перевести', язык: foreignState.lang }).then(function (answer) {
        go.disabled = false; out.textContent = '';
        var verdict = 'proved';
        if (answer.отказ) {
          verdict = 'error';
          var card = el('div', 'pg-verdict pg-error');
          card.appendChild(el('p', 'pg-verdict-title', answer.отказ.строка ? T.errorAt + answer.отказ.строка : T.readFailed));
          card.appendChild(el('p', 'pg-verdict-lead', answer.отказ.причина));
          out.appendChild(card);
          if (answer.отказ.строка) ed.mark([answer.отказ.строка]);
        } else if (!(answer.функции || []).length) {
          verdict = answer.код === 2 ? 'error' : 'unproved';
          out.appendChild(el('p', 'pg-hint', answer.код === 2 ? answer.вывод : T.noFunctions));
        }
        var badLines = [];
        (answer.функции || []).forEach(function (f) {
          var box = el('section', 'pg-fn');
          var head = el('h4', 'pg-fn-name', f.имя + ' · ' + T.line + f.строка);
          box.appendChild(head);
          if (f.отказы.length) {
            verdict = verdict === 'error' ? 'error' : 'unproved';
            badLines.push(f.строка);
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
          var st = f.код === 0 ? 'proved' : f.код === 3 ? 'unproved' : 'error';
          if (st === 'error') verdict = 'error';
          else if (st === 'unproved' && verdict === 'proved') verdict = 'unproved';
          var c2 = el('div', 'pg-verdict pg-' + st);
          c2.appendChild(el('p', 'pg-verdict-title', st === 'proved' ? T.fnProved : st === 'unproved' ? T.fnUnproved : T.fnFailed));
          if (st !== 'proved' && s.lead) c2.appendChild(el('p', 'pg-verdict-lead', s.lead));
          box.appendChild(c2);
          if (s.items.length) {
            var items = el('ul', 'pg-items');
            s.items.forEach(function (it) { items.appendChild(el('li', 'pg-item pg-' + it.state, it.text)); });
            box.appendChild(items);
          }
          box.appendChild(el('p', 'pg-formula-name', T.inFlang));
          box.appendChild(codeBlock(f.исходник, 'flang'));
          var open = el('button', 'playground-share', T.toEditor); open.type = 'button';
          open.addEventListener('click', function () { setText(f.исходник); showTab('result'); input.focus(); });
          box.appendChild(open);
          out.appendChild(box);
        });
        if (badLines.length) ed.mark(badLines);
        root.setAttribute('data-foreign-verdict', verdict);
        root.setAttribute('data-foreign-functions', String((answer.функции || []).length));
        var td = el('details', 'pg-details');
        td.appendChild(el('summary', null, T.terminal));
        td.appendChild(el('pre', 'playground-output', (answer.вывод || '').trim()));
        out.appendChild(td);
        return answer;
      });
    }
    go.addEventListener('click', translate);
    foreignState.translate = translate;
    foreignState.choose = choose;
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

  /* ── прогон ─────────────────────────────────────────────────────────────── */
  var started = 0;
  function run(text) {
    started = Date.now();
    checkButton.disabled = true;
    root.removeAttribute('data-playground-verdict');
    status.textContent = T.checking;
    return ask(text).then(function (answer) {
      checkButton.disabled = false;
      var s = renderResult(panels.result, answer, text);
      renderFormulas(panels.formula, answer);
      var pics = renderPictures(panels.picture, answer);
      root.setAttribute('data-playground-verdict', s.state);
      root.setAttribute('data-playground-pictures', String(pics));
      status.textContent = s.title + ' · ' + (Date.now() - started) + ' ' + T.ms;
      showTab('result');
      return answer;
    });
  }
  checkButton.addEventListener('click', function () { run(input.value); });
  function chooseExample(j) {
    var ex = examples[j];
    if (!ex) return;
    select.value = String(j);
    if (ex.lang !== 'flang') {
      foreignState.choose(ex.lang); foreignState.editor.set(ex.text); showTab('foreign');
      return;
    }
    setText(ex.text);
    if (root.getAttribute('data-tab') === 'emit') showTab('emit');
  }
  select.addEventListener('change', function () { chooseExample(Number(select.value)); });
  shareButton.addEventListener('click', function () {
    var address = location.href.replace(/#.*$/, '') + '#text=' + toAddress(input.value);
    history.replaceState(null, '', address);
    if (navigator.clipboard) navigator.clipboard.writeText(address).catch(function () {});
    status.textContent = T.linkCopied;
  });
  function fromHash() {
    var t = fromAddress(location.hash);
    if (t !== null) setText(t);
    return t !== null;
  }
  window.addEventListener('hashchange', fromHash);
  showTab('result');
  var firstFlang = examples.filter(function (x) { return x.lang === 'flang'; })[0];
  if (!fromHash() && firstFlang) setText(firstFlang.text);
  if (/(?:^#|&)run(?:&|$)/.test(location.hash)) run(input.value);

  /* Для проб из браузера без рук. */
  window.флангПесочница = {
    run: run, setText: setText, showTab: showTab, examples: examples, highlight: highlightHtml, code: codeHtml,
    choose: chooseExample,
    print: function (target) { emitState.target = target; showTab('emit'); return emitState.refresh(); },
    translate: function (text, lang) { if (lang) foreignState.choose(lang); if (text !== undefined) foreignState.editor.set(text); showTab('foreign'); return foreignState.translate(); }
  };
})();
