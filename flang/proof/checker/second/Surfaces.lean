import «RecordReader»

open «Разбор»

namespace «Второй»

def «словаПоверхностей» : List (String × String × String × String) := [
  ("module", "en", "module", "модуль"), ("模块", "zh", "module", "модуль"),
  ("exports", "en", "exports", "экспортирует"), ("eksportas", "eo", "exports", "экспортирует"),
  ("导出", "zh", "exports", "экспортирует"), ("uses", "en", "uses", "использует"),
  ("uzas", "eo", "uses", "использует"), ("使用", "zh", "uses", "использует"),
  ("category", "en", "category", "категория"), ("kategorio", "eo", "category", "категория"),
  ("类别", "zh", "category", "категория"), ("object", "en", "object", "объект"),
  ("structure", "en", "object", "объект"), ("objekto", "eo", "object", "объект"),
  ("strukturo", "eo", "object", "объект"), ("对象", "zh", "object", "объект"),
  ("结构", "zh", "object", "объект"), ("record", "en", "record", "запись"),
  ("rikordo", "eo", "record", "запись"), ("记录", "zh", "record", "запись"), ("type", "en", "type", "тип"),
  ("tipo", "eo", "type", "тип"), ("类型", "zh", "type", "тип"), ("variant", "en", "variant", "вариант"),
  ("varianto", "eo", "variant", "вариант"), ("变体", "zh", "variant", "вариант"),
  ("nested object", "en", "nested", "вложен объект"), ("nested structure", "en", "nested", "вложен объект"),
  ("嵌套对象", "zh", "nested", "вложен объект"), ("嵌套结构", "zh", "nested", "вложен объект"),
  ("character code", "en", "charCode", "код символа"), ("kodo de signo", "eo", "charCode", "код символа"),
  ("字符码", "zh", "charCode", "код символа"), ("character by code", "en", "charFromCode", "символ по коду"),
  ("signo per kodo", "eo", "charFromCode", "символ по коду"),
  ("按码字符", "zh", "charFromCode", "символ по коду"), ("decreases", "en", "decreases", "убывает"),
  ("total", "en", "total", "тотальная"), ("totala", "eo", "total", "тотальная"),
  ("完全", "zh", "total", "тотальная"), ("function", "en", "function", "функция"),
  ("funkcio", "eo", "function", "функция"), ("函数", "zh", "function", "функция"),
  ("accepts", "en", "accepts", "принимает"), ("akceptas", "eo", "accepts", "принимает"),
  ("接受", "zh", "accepts", "принимает"), ("returns", "en", "returns", "возвращает"),
  ("redonas", "eo", "returns", "возвращает"), ("返回", "zh", "returns", "возвращает"),
  ("example", "en", "example", "пример"), ("ekzemplo", "eo", "example", "пример"),
  ("示例", "zh", "example", "пример"), ("given", "en", "given", "дано"), ("donite", "eo", "given", "дано"),
  ("给定", "zh", "given", "дано"), ("expected", "en", "expected", "ожидается"),
  ("atendata", "eo", "expected", "ожидается"), ("期望", "zh", "expected", "ожидается"),
  ("let", "en", "let", "пусть"), ("estu", "eo", "let", "пусть"), ("令", "zh", "let", "пусть"),
  ("if", "en", "if", "если"), ("se", "eo", "if", "если"), ("如果", "zh", "if", "если"),
  ("then", "en", "then", "то"), ("tiam", "eo", "then", "то"), ("那么", "zh", "then", "то"),
  ("else", "en", "else", "иначе"), ("alie", "eo", "else", "иначе"), ("否则", "zh", "else", "иначе"),
  ("match", "en", "match", "разбор"), ("kongruo", "eo", "match", "разбор"), ("匹配", "zh", "match", "разбор"),
  ("case", "en", "case", "случай"), ("kazo", "eo", "case", "случай"), ("情况", "zh", "case", "случай"),
  ("of", "en", "of", "от"), ("de", "eo", "of", "от"), ("的", "zh", "of", "от"), ("and", "en", "and", "и"),
  ("kaj", "eo", "and", "и"), ("和", "zh", "and", "и"), ("and also", "en", "andAlso", "и притом"),
  ("kaj ankaŭ", "eo", "andAlso", "и притом"), ("并且", "zh", "andAlso", "и притом"), ("or", "en", "or", "или"),
  ("aŭ", "eo", "or", "или"), ("或者", "zh", "or", "или"), ("not", "en", "not", "не"), ("非", "zh", "not", "не"),
  ("with", "en", "with", "с"), ("kun", "eo", "with", "с"), ("带有", "zh", "with", "с"),
  ("from", "en", "from", "из"), ("el", "eo", "from", "из"), ("从", "zh", "from", "из"),
  ("only", "en", "only", "только"), ("nur", "eo", "only", "только"), ("仅", "zh", "only", "только"),
  ("to", "en", "to", "в"), ("into", "en", "to", "в"), ("in", "en", "to", "в"), ("onto", "en", "to", "в"),
  ("al", "eo", "to", "в"), ("到", "zh", "to", "в"), ("by", "en", "by", "по"), ("per", "eo", "by", "по"),
  ("按", "zh", "by", "по"), ("at", "en", "at", "у"), ("ĉe", "eo", "at", "у"), ("在", "zh", "at", "у"),
  ("as", "en", "as", "как"), ("kiel", "eo", "as", "как"), ("作为", "zh", "as", "как"),
  ("where", "en", "where", "где"), ("kie", "eo", "where", "где"), ("其中", "zh", "where", "где"),
  ("starting with", "en", "startingWith", "начиная с"),
  ("komencante per", "eo", "startingWith", "начиная с"), ("起始于", "zh", "startingWith", "начиная с"),
  ("map", "en", "map", "отобразить"), ("mapi", "eo", "map", "отобразить"), ("映射", "zh", "map", "отобразить"),
  ("filter", "en", "filter", "отфильтровать"), ("filtri", "eo", "filter", "отфильтровать"),
  ("过滤", "zh", "filter", "отфильтровать"), ("fold", "en", "fold", "свёртка"),
  ("faldo", "eo", "fold", "свёртка"), ("折叠", "zh", "fold", "свёртка"), ("length", "en", "length", "длина"),
  ("longo", "eo", "length", "длина"), ("长度", "zh", "length", "длина"), ("char", "en", "char", "символ"),
  ("signo", "eo", "char", "символ"), ("字符", "zh", "char", "символ"),
  ("decompose", "en", "decompose", "разложить"), ("malkomponi", "eo", "decompose", "разложить"),
  ("分解", "zh", "decompose", "разложить"), ("into characters", "en", "intoCharacters", "на символы"),
  ("en signojn", "eo", "intoCharacters", "на символы"), ("为字符", "zh", "intoCharacters", "на символы"),
  ("substring", "en", "substring", "подстрока"), ("subĉeno", "eo", "substring", "подстрока"),
  ("子串", "zh", "substring", "подстрока"), ("join", "en", "join", "соединить"),
  ("kunigi", "eo", "join", "соединить"), ("连接", "zh", "join", "соединить"),
  ("split", "en", "split", "разделить"), ("dividi", "eo", "split", "разделить"),
  ("分割", "zh", "split", "разделить"), ("contains", "en", "contains", "содержит"),
  ("enhavas", "eo", "contains", "содержит"), ("包含", "zh", "contains", "содержит"),
  ("begins with", "en", "beginsWith", "начинается с"),
  ("komenciĝas per", "eo", "beginsWith", "начинается с"), ("开始于", "zh", "beginsWith", "начинается с"),
  ("to number or failure", "en", "toNumberOrFail", "к числу или беда"),
  ("al nombro aŭ fiasko", "eo", "toNumberOrFail", "к числу или беда"),
  ("转数字或失败", "zh", "toNumberOrFail", "к числу или беда"), ("to number", "en", "toNumber", "к числу"),
  ("al nombro", "eo", "toNumber", "к числу"), ("转数字", "zh", "toNumber", "к числу"),
  ("to text", "en", "toText", "к строке"), ("al teksto", "eo", "toText", "к строке"),
  ("转文本", "zh", "toText", "к строке"), ("hash256", "en", "hash256", "хеш256"),
  ("哈希256", "zh", "hash256", "хеш256"), ("head", "en", "head", "голова"), ("kapo", "eo", "head", "голова"),
  ("头", "zh", "head", "голова"), ("tail", "en", "tail", "хвост"), ("vosto", "eo", "tail", "хвост"),
  ("尾", "zh", "tail", "хвост"), ("item", "en", "item", "элемент"), ("ero", "eo", "item", "элемент"),
  ("元素", "zh", "item", "элемент"), ("head and tail", "en", "headTail", "голова и хвост"),
  ("kapo kaj vosto", "eo", "headTail", "голова и хвост"), ("头和尾", "zh", "headTail", "голова и хвост"),
  ("empty", "en", "empty", "пусто"), ("malplena", "eo", "empty", "пусто"), ("空", "zh", "empty", "пусто"),
  ("empty list", "en", "emptyList", "пустой список"), ("malplena listo", "eo", "emptyList", "пустой список"),
  ("空列表", "zh", "emptyList", "пустой список"), ("list of", "en", "listOf", "список из"),
  ("listo de", "eo", "listOf", "список из"), ("列表由", "zh", "listOf", "список из"),
  ("list", "en", "list", "список"), ("listo", "eo", "list", "список"), ("列表", "zh", "list", "список"),
  ("add", "en", "add", "добавить"), ("aldoni", "eo", "add", "добавить"), ("添加", "zh", "add", "добавить"),
  ("prepend", "en", "prepend", "приписать"), ("antaŭmeti", "eo", "prepend", "приписать"),
  ("前置", "zh", "prepend", "приписать"), ("any", "en", "any", "любое"), ("ajna", "eo", "any", "любое"),
  ("任意", "zh", "any", "любое"), ("plus", "en", "opAdd", "плюс"), ("加", "zh", "opAdd", "плюс"),
  ("minus", "en", "opSub", "минус"), ("减", "zh", "opSub", "минус"), ("times", "en", "opMul", "умножить на"),
  ("multiplied by", "en", "opMul", "умножить на"), ("fojoj", "eo", "opMul", "умножить на"),
  ("乘以", "zh", "opMul", "умножить на"), ("divided by", "en", "opDiv", "делить на"),
  ("dividite per", "eo", "opDiv", "делить на"), ("除以", "zh", "opDiv", "делить на"),
  ("modulo", "en", "opMod", "остаток от"), ("resto de", "eo", "opMod", "остаток от"),
  ("取余", "zh", "opMod", "остаток от"), ("percent", "en", "opPercent", "процентов"),
  ("percents", "en", "opPercent", "процентов"), ("procentoj", "eo", "opPercent", "процентов"),
  ("procento", "eo", "opPercent", "процентов"), ("equals", "en", "cmpEq", "равен"),
  ("equal to", "en", "cmpEq", "равен"), ("egalas", "eo", "cmpEq", "равен"), ("等于", "zh", "cmpEq", "равен"),
  ("is not equal to", "en", "cmpNeq", "не равен"), ("not equals", "en", "cmpNeq", "не равен"),
  ("ne egalas", "eo", "cmpNeq", "не равен"), ("不等于", "zh", "cmpNeq", "не равен"),
  ("is greater than", "en", "cmpGt", "больше"), ("greater than", "en", "cmpGt", "больше"),
  ("pli granda ol", "eo", "cmpGt", "больше"), ("大于", "zh", "cmpGt", "больше"),
  ("is less than", "en", "cmpLt", "меньше"), ("less than", "en", "cmpLt", "меньше"),
  ("pli malgranda ol", "eo", "cmpLt", "меньше"), ("小于", "zh", "cmpLt", "меньше"),
  ("is at most", "en", "cmpLte", "не больше"), ("at most", "en", "cmpLte", "не больше"),
  ("ne pli granda ol", "eo", "cmpLte", "не больше"), ("不大于", "zh", "cmpLte", "не больше"),
  ("is at least", "en", "cmpGte", "не меньше"), ("at least", "en", "cmpGte", "не меньше"),
  ("ne pli malgranda ol", "eo", "cmpGte", "не меньше"), ("不小于", "zh", "cmpGte", "не меньше"),
  ("true", "en", "litTrue", "да"), ("yes", "en", "litTrue", "да"), ("vera", "eo", "litTrue", "да"),
  ("jes", "eo", "litTrue", "да"), ("真", "zh", "litTrue", "да"), ("false", "en", "litFalse", "нет"),
  ("no", "en", "litFalse", "нет"), ("malvera", "eo", "litFalse", "нет"), ("ne", "eo", "litFalse", "нет"),
  ("假", "zh", "litFalse", "нет"), ("null", "en", "litNull", "ничто"), ("nenio", "eo", "litNull", "ничто"),
  ("无", "zh", "litNull", "ничто"), ("number", "en", "tNumber", "число"),
  ("nombro", "eo", "tNumber", "число"), ("数字", "zh", "tNumber", "число"),
  ("string", "en", "tString", "строка"), ("teksto", "eo", "tString", "строка"),
  ("字符串", "zh", "tString", "строка"), ("boolean", "en", "tFlag", "признак"),
  ("flag", "en", "tFlag", "признак"), ("bulea", "eo", "tFlag", "признак"), ("布尔", "zh", "tFlag", "признак"),
  ("money", "en", "tMoney", "деньги"), ("mono", "eo", "tMoney", "деньги"), ("金额", "zh", "tMoney", "деньги"),
  ("date", "en", "tDate", "дата"), ("dato", "eo", "tDate", "дата"), ("日期", "zh", "tDate", "дата"),
  ("state", "en", "state", "состояние"), ("stato", "eo", "state", "состояние"),
  ("状态", "zh", "state", "состояние"), ("is", "en", "is", "является"), ("estas", "eo", "is", "является"),
  ("是", "zh", "is", "является"), ("may be", "en", "maybeIs", "иногда является"),
  ("povas esti", "eo", "maybeIs", "иногда является"), ("可能是", "zh", "maybeIs", "иногда является"),
  ("utility", "en", "utility", "утилита"), ("utilaĵo", "eo", "utility", "утилита"),
  ("工具", "zh", "utility", "утилита"), ("rule", "en", "rule", "правило"), ("regulo", "eo", "rule", "правило"),
  ("规则", "zh", "rule", "правило"), ("property", "en", "property", "свойство"),
  ("propraĵo", "eo", "property", "свойство"), ("属性", "zh", "property", "свойство"),
  ("result", "en", "result", "результат"), ("rezulto", "eo", "result", "результат"),
  ("结果", "zh", "result", "результат"), ("starts with", "en", "startsWith", "начинает с"),
  ("komencas per", "eo", "startsWith", "начинает с"), ("始于", "zh", "startsWith", "начинает с"),
  ("field", "en", "field", "поле"), ("kampo", "eo", "field", "поле"), ("字段", "zh", "field", "поле"),
  ("morphism", "en", "morphism", "морфизм"), ("morfismo", "eo", "morphism", "морфизм"),
  ("态射", "zh", "morphism", "морфизм"), ("after", "en", "after", "после"), ("post", "eo", "after", "после"),
  ("之后", "zh", "after", "после"), ("chain", "en", "chain", "цепочка"), ("ĉeno", "eo", "chain", "цепочка"),
  ("链", "zh", "chain", "цепочка"), ("first", "en", "firstStep", "сначала"),
  ("unue", "eo", "firstStep", "сначала"), ("首先", "zh", "firstStep", "сначала"),
  ("next", "en", "nextStep", "затем"), ("poste", "eo", "nextStep", "затем"),
  ("然后", "zh", "nextStep", "затем"), ("identity", "en", "identity", "единица"),
  ("identeco", "eo", "identity", "единица"), ("恒等", "zh", "identity", "единица"),
  ("gives", "en", "gives", "даёт"), ("donas", "eo", "gives", "даёт"), ("给出", "zh", "gives", "даёт"),
  ("law", "en", "lawBlock", "закон"), ("leĝo", "eo", "lawBlock", "закон"), ("定律", "zh", "lawBlock", "закон"),
  ("isomorphism", "en", "isomorphism", "изоморфизм"), ("izomorfio", "eo", "isomorphism", "изоморфизм"),
  ("同构", "zh", "isomorphism", "изоморфизм"), ("forward morphism", "en", "forwardMorphism", "прямой морфизм"),
  ("rekta morfismo", "eo", "forwardMorphism", "прямой морфизм"),
  ("正向态射", "zh", "forwardMorphism", "прямой морфизм"),
  ("inverse morphism", "en", "inverseMorphism", "обратный морфизм"),
  ("inversa morfismo", "eo", "inverseMorphism", "обратный морфизм"),
  ("逆态射", "zh", "inverseMorphism", "обратный морфизм"), ("embedding", "en", "embedding", "вложение"),
  ("嵌入", "zh", "embedding", "вложение"), ("intersection", "en", "intersection", "пересечение"),
  ("komunaĵo", "eo", "intersection", "пересечение"), ("交集", "zh", "intersection", "пересечение"),
  ("monoid", "en", "monoid", "моноид"), ("monoido", "eo", "monoid", "моноид"),
  ("幺半群", "zh", "monoid", "моноид"), ("carrier", "en", "carrier", "носитель"),
  ("portanto", "eo", "carrier", "носитель"), ("载体", "zh", "carrier", "носитель"),
  ("operation", "en", "operation", "операция"), ("operacio", "eo", "operation", "операция"),
  ("运算", "zh", "operation", "операция"), ("inverse element", "en", "inverseElement", "обратный элемент"),
  ("inversa elemento", "eo", "inverseElement", "обратный элемент"),
  ("逆元", "zh", "inverseElement", "обратный элемент"), ("monad", "en", "monad", "монада"),
  ("monado", "eo", "monad", "монада"), ("单子", "zh", "monad", "монада"),
  ("return", "en", "monadUnit", "возврат"), ("redono", "eo", "monadUnit", "возврат"),
  ("单位", "zh", "monadUnit", "возврат"), ("flatten", "en", "monadJoin", "соединение"),
  ("platigo", "eo", "monadJoin", "соединение"), ("压平", "zh", "monadJoin", "соединение"),
  ("in monad", "en", "inMonad", "в монаде"), ("en monado", "eo", "inMonad", "в монаде"),
  ("在单子中", "zh", "inMonad", "в монаде"), ("theorem", "en", "theorem", "теорема"),
  ("teoremo", "eo", "theorem", "теорема"), ("定理", "zh", "theorem", "теорема"),
  ("follows", "en", "follows", "следует"), ("functor", "en", "functor", "функтор"),
  ("funktoro", "eo", "functor", "функтор"), ("函子", "zh", "functor", "функтор"),
  ("bifunctor", "en", "bifunctor", "бифунктор"), ("bifunktoro", "eo", "bifunctor", "бифунктор"),
  ("双函子", "zh", "bifunctor", "бифунктор"), ("objects", "en", "objectPair", "объекты"),
  ("objektoj", "eo", "objectPair", "объекты"), ("对象对", "zh", "objectPair", "объекты"),
  ("morphisms", "en", "morphismPair", "морфизмы"), ("morfismoj", "eo", "morphismPair", "морфизмы"),
  ("态射对", "zh", "morphismPair", "морфизмы"), ("proposition", "en", "proposition", "утверждение"),
  ("propozicio", "eo", "proposition", "утверждение"), ("命题", "zh", "proposition", "утверждение"),
  ("has", "en", "has", "имеет"), ("havas", "eo", "has", "имеет"), ("具有", "zh", "has", "имеет"),
  ("in data", "en", "inData", "в данных"), ("en datumoj", "eo", "inData", "в данных"),
  ("在数据中", "zh", "inData", "в данных"), ("find where", "en", "findWhere", "найти где"),
  ("trovi kie", "eo", "findWhere", "найти где"), ("查找其中", "zh", "findWhere", "найти где"),
  ("by morphism", "en", "byMorphism", "по морфизму"),
  ("then by morphism", "en", "byMorphism", "по морфизму"),
  ("apply morphism", "en", "byMorphism", "по морфизму"),
  ("then apply morphism", "en", "byMorphism", "по морфизму"),
  ("per morfismo", "eo", "byMorphism", "по морфизму"),
  ("poste per morfismo", "eo", "byMorphism", "по морфизму"), ("按态射", "zh", "byMorphism", "по морфизму"),
  ("然后按态射", "zh", "byMorphism", "по морфизму"), ("therefore", "en", "therefore", "следовательно"),
  ("sekve", "eo", "therefore", "следовательно"), ("因此", "zh", "therefore", "следовательно"),
  ("under law", "en", "law", "по закону"), ("laŭ leĝo", "eo", "law", "по закону"),
  ("依定律", "zh", "law", "по закону"), ("maps to", "en", "mapsTo", "отображается в"),
  ("map to", "en", "mapsTo", "отображается в"), ("mapiĝas al", "eo", "mapsTo", "отображается в"),
  ("映射到", "zh", "mapsTo", "отображается в"), ("maps to field", "en", "mapsToField", "отображается в поле"),
  ("mapiĝas al kampo", "eo", "mapsToField", "отображается в поле"),
  ("映射到字段", "zh", "mapsToField", "отображается в поле"),
  ("maps to morphism", "en", "mapsToMorphism", "отображается в морфизм"),
  ("map to morphism", "en", "mapsToMorphism", "отображается в морфизм"),
  ("mapiĝas al morfismo", "eo", "mapsToMorphism", "отображается в морфизм"),
  ("映射到态射", "zh", "mapsToMorphism", "отображается в морфизм"), ("requires", "en", "requires", "требует"),
  ("ensures", "en", "ensures", "обеспечивает"), ("for all", "en", "forall", "для всех"),
  ("such that", "en", "suchThat", "таких что"), ("there is", "en", "exists", "есть такой"),
  ("namely", "en", "namely", "а именно"), ("statement", "en", "proposition", "утверждение"),
  ("claim", "en", "claim", "утверждаем"), ("induction on", "en", "induction", "индукция по"),
  ("by property", "en", "byProperty", "по свойству"), ("by example", "en", "byExample", "по примеру"),
  ("by hypothesis", "en", "byHypothesis", "по предположению"),
  ("therefore proved", "en", "qed", "следовательно доказано"), ("process", "en", "process", "процесс"),
  ("procezo", "eo", "process", "процесс"), ("进程", "zh", "process", "процесс"),
  ("handles", "en", "handles", "обрабатывает"), ("traktas", "eo", "handles", "обрабатывает"),
  ("处理", "zh", "handles", "обрабатывает"), ("with budget", "en", "budget", "с запасом"),
  ("exact integer", "en", "tExact", "точное целое"), ("preciza entjero", "eo", "tExact", "точное целое"),
  ("精确整数", "zh", "tExact", "точное целое"), ("integer part", "en", "integerPart", "целая часть"),
  ("entjera parto", "eo", "integerPart", "целая часть"), ("整数部分", "zh", "integerPart", "целая часть"),
  ("kun buĝeto", "eo", "budget", "с запасом"), ("带预算", "zh", "budget", "с запасом"),
  ("with mailbox", "en", "mailbox", "с ящиком"), ("kun leterkesto", "eo", "mailbox", "с ящиком"),
  ("带信箱", "zh", "mailbox", "с ящиком"), ("supervision", "en", "supervision", "надзор"),
  ("监督", "zh", "supervision", "надзор"), ("strategy", "en", "strategy", "стратегия"),
  ("strategio", "eo", "strategy", "стратегия"), ("策略", "zh", "strategy", "стратегия"),
  ("failure threshold", "en", "failureThreshold", "порог отказов"),
  ("sojlo de fiaskoj", "eo", "failureThreshold", "порог отказов"),
  ("失败阈值", "zh", "failureThreshold", "порог отказов"), ("run", "en", "run", "прогон"),
  ("rulo", "eo", "run", "прогон"), ("运行", "zh", "run", "прогон"), ("seed", "en", "seed", "семя"),
  ("semo", "eo", "seed", "семя"), ("种子", "zh", "seed", "семя"), ("plan", "en", "plan", "план"),
  ("plano", "eo", "plan", "план"), ("计划", "zh", "plan", "план"), ("note", "en", "note", "примечание"),
  ("noto", "eo", "note", "примечание"), ("注", "zh", "note", "примечание")
  ]

def «обрезатьКрая» (s : String) : String :=
  let «пуст» := fun (c : Char) => c = ' ' || c = '\t' || c = '\r'
  String.ofList ((s.toList.dropWhile «пуст»).reverse.dropWhile «пуст»).reverse

def «голосаПоверхностей» : List (String × List String) :=
  [("", ["тотальная функция ", "функция ", "принимает ", "возвращает ", "пример ", "дано ", "ожидается "]),
   ("en", ["total function ", "function ", "accepts ", "returns ", "example ", "given ", "expected "]),
   ("eo", ["totala funkcio ", "funkcio ", "akceptas ", "redonas ", "ekzemplo ", "donite ", "atendata "]),
   ("zh", ["完全 ", "函数 ", "接受 ", "返回 ", "示例 ", "给定 ", "期望 "])]

def «языкИсходника» («строки» : List String) : Option String := Id.run do
  let ls := «строки».map (fun l => «обрезатьКрая» («безПримечания» l))
  let n : List Nat := «голосаПоверхностей».map (fun (_, ws) => (ls.filter (fun x => ws.any (x.startsWith ·))).length)
  let mut «лучший» : Nat := 0
  for j in [1:4] do
    if n.getD j 0 > n.getD «лучший» 0 then «лучший» := j
  return if «лучший» = 0 then none else some ((«голосаПоверхностей».getD «лучший» ("", [])).1)

def «границаСлова» (c : Char) : Bool := c = ' ' || c = '\t' || "()[],:".toList.contains c

def «совпалоС» (a : Array Char) (i : Nat) (p : List Char) : Bool :=
  (List.range p.length).all (fun k => a.getD (i + k) ' ' = p.getD k ' ') && i + p.length ≤ a.size

def «поРусски» (l : String) («язык» : String) : String := Id.run do
  let a := l.toList.toArray
  let n := a.size
  let «кит» := «язык» = "zh"
  let «свои» := «словаПоверхностей».filter (fun (_, y, _, _) => y = «язык»)
  let mut r : Array Char := #[]
  let mut i := 0
  let mut «первый» : Option String := none
  let mut «тПред» := ""
  let mut «тПосл» := ""
  let mut «в1» := 0
  let mut «понятие» := ""
  let mut «лексем» := 0
  let mut «равенств» := 0
  let mut «конструкция» := false
  let mut «добавление» := false
  for _ in [0:n + 1] do
    if i ≥ n then break
    let ch := a.getD i ' '
    if ch = '"' then
      let mut j := i + 1
      for _ in [0:n] do
        if j ≥ n || a.getD j ' ' = '"' then break
        if a.getD j ' ' = '\\' && j + 1 < n then j := j + 1
        j := j + 1
      if j < n then j := j + 1
      r := r ++ (a.extract i j)
      i := j
      «тПред» := «тПосл»; «тПосл» := ""; «в1» := 3; «понятие» := ""; «лексем» := «лексем» + 1
      continue
    if ch = '«' then
      let j := match ((List.range' i (n - i)).find? (fun k => a.getD k ' ' = '»')) with
        | some k => k + 1
        | none => n
      r := r ++ (a.extract i j)
      i := j
      «тПред» := «тПосл»; «тПосл» := ""; «в1» := 2; «понятие» := ""; «лексем» := «лексем» + 1
      continue
    let mut «лучшее» : Option (String × String × Nat) := none
    let mut «длина» := 0
    if i = 0 || «границаСлова» (a.getD (i - 1) ' ') || «кит» then
      for (f, _, c, w) in «свои» do
        let d := f.utf8ByteSize
        let fl := f.toList
        if d > «длина» && «совпалоС» a i fl && («кит» || i + fl.length ≥ n || «границаСлова» (a.getD (i + fl.length) ' ')) then
          «лучшее» := some (c, w, fl.length)
          «длина» := d
    match «лучшее» with
    | some (c, w0, k) =>
      let mut w := w0
      if c = "cmpEq" then
        let «дано» := («первый» = some "дано" || «первый» = some "пусть") && «равенств» = 0
        let «поле» := «в1» = 2 && («тПред» = "с" || «тПред» = "и") && «конструкция»
        w := if «дано» then "равно" else if «поле» then "равным" else w
        «равенств» := «равенств» + 1
      if c = "listOf" then w := "список"
      if c = "to" && «добавление» then w := "к"
      if «понятие» = "listOf" then
        if c = "tNumber" then w := "числа"
        if c = "tString" then w := "строки"
        if c = "tFlag" then w := "признака"
      if c = "record" || c = "variant" then «конструкция» := true
      if c = "add" || c = "prepend" then «добавление» := true
      if «лексем» = 0 then «первый» := some w
      r := r ++ w.toList.toArray
      i := i + k
      «тПред» := «тПосл»; «тПосл» := w; «в1» := 1; «понятие» := c; «лексем» := «лексем» + 1
    | none =>
      let mut j := i
      for _ in [0:n] do
        if j ≥ n then break
        let cj := a.getD j ' '
        if «границаСлова» cj || cj = '"' || cj = '«' then break
        j := j + 1
      if j = i then j := i + 1
      let seg := a.extract i j
      r := r ++ seg
      if seg.toList.any (fun c => c ≠ ' ' && c ≠ '\t') then
        «тПред» := «тПосл»; «тПосл» := ""; «в1» := 2; «понятие» := ""; «лексем» := «лексем» + 1
      i := j
  return String.ofList r.toList

def «строкиПоРусски» («строки» : List String) : List String :=
  match «языкИсходника» «строки» with
  | some y => «историиФункциями» («строки».map (fun l => «поРусски» l y))
  | none => «историиФункциями» «строки»

end «Второй»
