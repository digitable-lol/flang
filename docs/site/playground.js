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
    tabs: { result: 'Result', formula: 'Formulas', input: 'Formula → flang', picture: 'Pictures' },
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
    tabs: { result: 'Итог', formula: 'Формулы', input: 'Формула → flang', picture: 'Рисунки' },
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

  function highlightHtml(src, badLines) {
    var lines = [[]];
    segments(src).forEach(function (s) {
      var parts = s[0].split('\n');
      parts.forEach(function (part, j) {
        if (j > 0) lines.push([]);
        if (part) lines[lines.length - 1].push(s[1] ? '<span class="' + s[1] + '">' + esc(part) + '</span>' : esc(part));
      });
    });
    return lines.map(function (parts, j) {
      var bad = badLines && badLines.has(j + 1);
      return '<span class="pg-line' + (bad ? ' pg-line-bad' : '') + '">' + (parts.join('') || ' ') + '</span>';
    }).join('');
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
  var examples = [];
  var blocks = document.querySelectorAll('main pre');
  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    if (blk === holder) continue;
    var txt = blk.textContent;
    var ok = blk.classList.contains('lang-text') || (blk.classList.contains('lang-flang') && /^\s*(модуль|категория)\s/.test(txt));
    if (!ok) continue;
    var before = blk.previousElementSibling;
    var name = blk.getAttribute('data-playground-title') ||
      (before && before.tagName === 'P' ? before.textContent.split(/[:.]/)[0].trim() : '');
    examples.push({ name: name || (T.example + ' ' + (examples.length + 1)), text: txt });
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

  var editor = el('div', 'pg-editor');
  var paint = el('pre', 'pg-paint'); paint.setAttribute('aria-hidden', 'true');
  var input = el('textarea', 'playground-input');
  input.spellcheck = false; input.setAttribute('wrap', 'off'); input.setAttribute('aria-label', T.editor);
  input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocomplete', 'off');
  editor.appendChild(paint); editor.appendChild(input);
  var marks = el('ul', 'pg-marks'); marks.hidden = true;

  var tabs = el('div', 'pg-tabs'); tabs.setAttribute('role', 'tablist');
  var panels = {};
  var tabButtons = {};
  ['result', 'formula', 'input', 'picture'].forEach(function (key) {
    var t = el('button', 'pg-tab', T.tabs[key]);
    t.type = 'button'; t.setAttribute('role', 'tab'); t.id = 'pg-tab-' + key;
    t.setAttribute('aria-controls', 'pg-panel-' + key);
    var p = el('div', 'pg-panel'); p.setAttribute('role', 'tabpanel'); p.id = 'pg-panel-' + key;
    p.setAttribute('aria-labelledby', t.id); p.setAttribute('data-panel', key);
    t.addEventListener('click', function () { showTab(key); });
    tabs.appendChild(t); tabButtons[key] = t; panels[key] = p;
  });
  function showTab(key) {
    Object.keys(panels).forEach(function (k) {
      panels[k].hidden = k !== key;
      tabButtons[k].setAttribute('aria-selected', k === key ? 'true' : 'false');
      tabButtons[k].tabIndex = k === key ? 0 : -1;
    });
    root.setAttribute('data-tab', key);
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
  showTab('result');

  /* ── редактор ───────────────────────────────────────────────────────────── */
  var badLines = new Set();
  function repaint() {
    paint.innerHTML = highlightHtml(input.value, badLines) + '<span class="pg-line"> </span>';
    paint.scrollTop = input.scrollTop; paint.scrollLeft = input.scrollLeft;
  }
  function fitHeight() {
    var lines = input.value.split('\n').length;
    input.style.height = Math.min(Math.max(lines + 1, 8), 30) * 1.45 + 1.6 + 'em';
  }
  function setText(text) {
    input.value = text; badLines = new Set(); marks.hidden = true; marks.textContent = '';
    fitHeight(); repaint();
  }
  input.addEventListener('input', function () { badLines = new Set(); marks.hidden = true; fitHeight(); repaint(); });
  input.addEventListener('scroll', function () { paint.scrollTop = input.scrollTop; paint.scrollLeft = input.scrollLeft; });
  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); run(input.value, 'main'); }
    else if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey) {
      ev.preventDefault();
      var s = input.selectionStart, e = input.selectionEnd;
      input.value = input.value.slice(0, s) + '  ' + input.value.slice(e);
      input.selectionStart = input.selectionEnd = s + 2; repaint();
    }
  });
  function goToLine(line) {
    var lines = input.value.split('\n'), pos = 0;
    for (var j = 0; j < line - 1 && j < lines.length; j++) pos += lines[j].length + 1;
    input.focus(); input.selectionStart = input.selectionEnd = pos;
    var lh = parseFloat(getComputedStyle(input).lineHeight) || 18;
    input.scrollTop = Math.max(0, (line - 3) * lh);
  }
  function markLines(list) {
    badLines = new Set(list.filter(function (m) { return m.line; }).map(function (m) { return m.line; }));
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
    repaint();
  }

  /* ── поток с компилятором ───────────────────────────────────────────────── */
  var worker = null, counter = 0, waiting = {};
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(ROOT + 'playground/flang_host_browser.js', { type: 'module' });
    worker.addEventListener('message', function (ev) {
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
  function ask(text) {
    return new Promise(function (resolve) {
      counter += 1;
      waiting[counter] = resolve;
      ensureWorker().postMessage({ номер: counter, текст: text, база: new URL(ROOT + 'playground/', location.href).href });
    });
  }

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
  select.addEventListener('change', function () { setText(examples[Number(select.value)].text); });
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
  if (!fromHash() && examples.length) setText(examples[0].text);
  if (/(?:^#|&)run(?:&|$)/.test(location.hash)) run(input.value);

  /* Для проб из браузера без рук. */
  window.флангПесочница = { run: run, setText: setText, showTab: showTab, examples: examples, highlight: highlightHtml };
})();
