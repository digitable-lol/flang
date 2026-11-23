/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

const ПОЛНЫЕ_ПРАВА = Object.freeze({
  экран: true,
  сеть: true,
  время: true,
  случайность: true,
  файлы: true,
  процессы: true,
})

const ПРИЗНАК_МЕСТА = "данные-место"
const ПРИЗНАК_СОБЫТИЯ = "данные-событие"
const ПРИЗНАК_КЛАВИШ = "данные-клавиши"
const ПРИЗНАК_КАРЕТКИ = "данные-каретка"
const ПРИЗНАК_ФОКУСА = "данные-фокус"
const ПРИЗНАК_НАВЕДЕНИЯ = "данные-наведение"
const ПРИЗНАК_СТОПА = "данные-стоп"
const ПРИЗНАК_ПРОКРУТКИ = "данные-прокрутка-вместе"
const МЕСТО_АДРЕСА = "адрес вкладки"
const МЕСТО_БУФЕРА = "буфер обмена"
const ХРАНИМЫЙ_КАТАЛОГ = "/home/"
const КЛЮЧ_ХРАНИЛИЩА = "flang:"
const КЛЮЧ_УЗЛА = "ключ"
const ДЕЙСТВИЯ_УЗЛА = new Set(["фокус", "каретка", "показать"])
const СВОЙСТВА_ПОЛЯ = new Set(["value", "checked", "selected"])
const ЗАПРЕТНЫЕ_ЭЛЕМЕНТЫ = new Set(["script", "iframe", "frame", "object", "embed", "link", "meta", "base", "style"])
const ОБЛАСТИ_ИМЁН = Object.freeze({ svg: "http://www.w3.org/2000/svg", math: "http://www.w3.org/1998/Math/MathML" })

export function негодноеВДереве(узлы) {
  if (!Array.isArray(узлы)) return "узлы страницы — не список"
  for (const узел of узлы) {
    const поля = узел?.fields ?? {}
    if (узел?.variant === "Текст страницы") {
      if (typeof поля["текст"] !== "string") return "у текста страницы нет текста"
      continue
    }
    if (узел?.variant !== "Элемент страницы") return "в списке узлов стоит не узел страницы"
    const имя = String(поля["имя"] ?? "")
    if (!/^[A-Za-z][A-Za-z0-9-]*$/u.test(имя)) return `имя элемента «${имя}» — не имя`
    if (ЗАПРЕТНЫЕ_ЭЛЕМЕНТЫ.has(имя.toLowerCase())) return `элемент «${имя}» план на странице не строит`
    for (const свойство of поля["свойства"] ?? []) {
      const чьё = String(свойство?.fields?.["имя"] ?? "")
      if (чьё === "" || /^on/iu.test(чьё) || /^srcdoc$/iu.test(чьё)) return `свойство «${чьё}» у элемента «${имя}» не ставится`
      if (/^\s*javascript:/iu.test(String(свойство?.fields?.["значение"] ?? ""))) return `свойство «${чьё}» у элемента «${имя}» несёт код`
    }
    const глубже = негодноеВДереве(поля["дети"] ?? [])
    if (глубже !== null) return глубже
  }
  return null
}

function поставитьСвойства(узел, свойства, запись, занят, действия) {
  const новые = new Map(свойства.filter(([чьё]) => чьё !== КЛЮЧ_УЗЛА))
  for (const чьё of [...запись.свойства.keys()]) {
    if (новые.has(чьё)) continue
    запись.свойства.delete(чьё)
    if (СВОЙСТВА_ПОЛЯ.has(чьё)) узел[чьё] = чьё === "value" ? "" : false
    else if (!ДЕЙСТВИЯ_УЗЛА.has(чьё)) узел.removeAttribute(чьё)
  }
  for (const [чьё, значение] of новые) {
    const прежнее = запись.свойства.get(чьё)
    запись.свойства.set(чьё, значение)
    if (ДЕЙСТВИЯ_УЗЛА.has(чьё)) {
      if (прежнее !== значение && !(занят && чьё === "каретка")) действия.push([узел, чьё, значение])
    } else if (чьё === "value") {
      if (!занят && узел.value !== значение) узел.value = значение
    } else if (СВОЙСТВА_ПОЛЯ.has(чьё)) узел[чьё] = true
    else if (прежнее !== значение) узел.setAttribute(чьё, значение)
  }
}

function собратьУзлы(документ, родитель, узлы, область, память, занят, действия) {
  const поКлючу = new Map()
  for (const прежний of родитель.childNodes) {
    const ключ = память.get(прежний)?.ключ
    if (ключ !== undefined) поКлючу.set(ключ, прежний)
  }
  const оставлены = new Set()
  узлы.forEach((узел, номер) => {
    const текстовый = узел.variant === "Текст страницы"
    const имя = текстовый ? "" : узел.fields["имя"]
    const свойства = текстовый ? [] : (узел.fields["свойства"] ?? []).map((с) => [String(с.fields["имя"]), String(с.fields["значение"] ?? "")])
    const ключ = свойства.find(([чьё]) => чьё === КЛЮЧ_УЗЛА)?.[1]
    const наМесте = родитель.childNodes[номер] ?? null
    let годный = ключ === undefined ? наМесте : (поКлючу.get(ключ) ?? null)
    const запись = годный === null ? undefined : память.get(годный)
    if (запись === undefined || оставлены.has(годный) || запись.имя !== имя || запись.ключ !== ключ) {
      const своя = ОБЛАСТИ_ИМЁН[имя] ?? область
      годный = текстовый ? документ.createTextNode("") : своя === null ? документ.createElement(имя) : документ.createElementNS(своя, имя)
      память.set(годный, { имя, ключ, свойства: new Map() })
    }
    оставлены.add(годный)
    if (наМесте !== годный) родитель.insertBefore(годный, наМесте)
    if (текстовый) {
      if (годный.nodeValue !== узел.fields["текст"]) годный.nodeValue = узел.fields["текст"]
      return
    }
    собратьУзлы(документ, годный, узел.fields["дети"] ?? [], имя === "foreignObject" ? null : (ОБЛАСТИ_ИМЁН[имя] ?? область), память, занят, действия)
    поставитьСвойства(годный, свойства, память.get(годный), занят(годный), действия)
  })
  while (родитель.childNodes.length > узлы.length) родитель.removeChild(родитель.lastChild)
}

function завестиКаталог(узлы, путь) {
  for (let свой = путь; свой !== "/" && !узлы.has(свой); свой = родительWasi(свой)) узлы.set(свой, { тип: "каталог" })
}

function исполнитьДействие(узел, чьё, значение) {
  if (чьё === "фокус") узел.focus?.()
  else if (чьё === "показать") узел.scrollIntoView?.({ block: "nearest" })
  else {
    const [начало, конец] = значение.split(/\s+/u).map(Number)
    if (Number.isInteger(начало)) узел.setSelectionRange?.(начало, Number.isInteger(конец) ? конец : начало)
  }
}

export function хозяинВкладки(options = {}) {
  const документ = options.документ ?? globalThis.document
  const вариант = options.вариант
  if (typeof вариант !== "function") {
    throw new Error("хозяину вкладки нужна фабрика варианта: настройка «вариант»")
  }
  const сбой = (код, сообщение) => вариант("Сбой", { код: String(код), сообщение: String(сообщение) })
  const можно = { ...ПОЛНЫЕ_ПРАВА, ...(options.разрешено ?? {}) }
  const таймаут = options.таймаут ?? 30_000
  const сходить = options.fetch ?? globalThis.fetch
  const часы = options.часы ?? (() => Date.now())
  const отложить = options.отложить ?? ((что, через) => setTimeout(что, через))
  const снять = options.снять ?? ((метка) => clearTimeout(метка))
  const бросить = typeof options.бросить === "function" ? options.бросить : () => {
    const октеты = crypto.getRandomValues(new Uint32Array(2))
    return ((октеты[0] >>> 5) * 67108864 + (октеты[1] >>> 6)) / 9007199254740992
  }
  const вместимость = options.очередь ?? 64

  const копилка = []
  let ожидающий = null
  let подписаны = false

  const случилось = (место, значение, узел = null) => {
    if (ожидающий !== null) {
      const кому = ожидающий
      ожидающий = null
      кому(вариант("Случилось", { откуда: String(место), значение: String(значение) }))
      return
    }
    копилка.push({ место: String(место), значение: String(значение), узел })
    if (копилка.length > вместимость) копилка.shift()
  }

  const окно = options.окно ?? globalThis
  const основа = options.основа ?? документ?.baseURI ?? окно.location?.href
  const программы = options.программы ?? "./"
  const архивы = options.архивы ?? []
  const среда = { LANG: документ?.documentElement?.lang ?? "", ...(options.среда ?? {}) }
  const доводы = options.доводы ?? []
  const хранилище = options.хранилище ?? (() => {
    try {
      return окно.localStorage ?? null
    } catch {
      return null
    }
  })()
  const завестиРабочего = options.поток ?? (() => new Worker(import.meta.url, { type: "module" }))
  const память = new WeakMap()
  const каретки = new WeakMap()
  const склад = файлыWasi()
  const кодер = new TextEncoder()
  const декодер = new TextDecoder()
  const грязные = new Set()
  let всёГрязно = true
  let поток = null
  let идущий = null
  let смонтировано = null
  let адресСлышен = false

  const фрагмент = () => String(окно.location?.hash ?? "").replace(/^#/u, "")
  const слушатьАдрес = () => {
    if (адресСлышен) return
    адресСлышен = true
    окно.addEventListener?.("hashchange", () => случилось(МЕСТО_АДРЕСА, фрагмент()))
  }
  const хранимый = (путь) => путь.startsWith(ХРАНИМЫЙ_КАТАЛОГ) && хранилище !== null
  const положить = (путь, байты, отПлана) => {
    if (байты === null) завестиКаталог(склад.узлы, путь)
    else склад.положить(путь, байты)
    if (отПлана) грязные.add(путь)
    if (байты !== null && хранимый(путь)) хранилище.setItem(`${КЛЮЧ_ХРАНИЛИЩА}${путь}`, декодер.decode(байты))
  }
  const убрать = (путь, отПлана) => {
    for (const свой of [...склад.узлы.keys()]) {
      if (свой !== путь && !свой.startsWith(`${путь}/`)) continue
      склад.узлы.delete(свой)
      if (отПлана) грязные.add(свой)
      if (хранимый(свой)) хранилище.removeItem(`${КЛЮЧ_ХРАНИЛИЩА}${свой}`)
    }
  }
  const смонтировать = () => (смонтировано ??= (async () => {
    for (const адрес of архивы) {
      const ответ = await сходить(new URL(адрес, основа).href)
      if (!ответ.ok) throw new Error(`архив «${адрес}» не скачан: ответ ${ответ.status}`)
      for (const [путь, байты] of Object.entries(разобратьTar(new Uint8Array(await ответ.arrayBuffer())))) склад.положить(путь, байты)
    }
    for (let номер = 0; хранилище !== null && номер < хранилище.length; номер += 1) {
      const ключ = хранилище.key(номер)
      if (ключ.startsWith(`${КЛЮЧ_ХРАНИЛИЩА}${ХРАНИМЫЙ_КАТАЛОГ}`)) склад.положить(ключ.slice(КЛЮЧ_ХРАНИЛИЩА.length), хранилище.getItem(ключ))
    }
  })().catch((ошибка) => ((смонтировано = null), Promise.reject(ошибка))))
  const остановить = (сигнал) => {
    if (идущий === null) return
    const кому = идущий
    идущий = null
    поток?.terminate?.()
    поток = null
    всёГрязно = true
    кому({ сигнал })
  }
  const прогнать = async (программа, слова, вход, срок) => {
    if (!можно.процессы) return сбой("FLANG_IO_DENIED", "хозяину запрещено запускать процессы")
    if (!/^[A-Za-z0-9_-]+$/u.test(программа)) return сбой("FLANG_IO_SPAWN", `программы «${программа}» у вкладки нет`)
    try {
      await смонтировать()
    } catch (ошибка) {
      return сбой("FLANG_IO_MOUNT", текст(ошибка))
    }
    const пути = всёГрязно ? [...склад.узлы.keys()] : [...грязные]
    const файлы = пути.filter((путь) => склад.узлы.has(путь)).map((путь) => [путь, склад.узлы.get(путь).байты ?? null])
    const убранные = пути.filter((путь) => !склад.узлы.has(путь))
    const заказ = { адрес: new URL(`${программа}.wasm`, new URL(программы, основа)).href, доводы: [программа, ...слова], окружение: среда, вход, целиком: всёГрязно, файлы, убрать: убранные }
    всёГрязно = false
    грязные.clear()
    поток ??= завестиРабочего()
    const ответ = await new Promise((готово) => {
      const метка = срок > 0 ? отложить(() => остановить("срок"), срок) : null
      идущий = (итог) => {
        if (метка !== null) снять(метка)
        готово(итог)
      }
      const принять = (итог) => {
        if (идущий === null) return
        const кому = идущий
        идущий = null
        кому(итог)
      }
      поток.onmessage = (событие) => (событие.data?.прогон === true ? принять(событие.data) : undefined)
      поток.onerror = (событие) => {
        поток = null
        всёГрязно = true
        принять({ отказ: String(событие?.message ?? "поток не завёлся") })
      }
      поток.postMessage({ прогон: заказ })
    })
    if (ответ.сигнал === "срок") return вариант("Процесс оборван", { предел: срок, вывод: "", ошибки: "" })
    if (ответ.сигнал !== undefined) return вариант("Процесс убит", { сигнал: ответ.сигнал, вывод: "", ошибки: "" })
    if (ответ.отказ !== undefined) return сбой("FLANG_IO_SPAWN", ответ.отказ)
    for (const путь of ответ.убрано) убрать(путь, false)
    for (const [путь, байты] of ответ.файлы) положить(путь, байты, false)
    if (ответ.сбой !== null) return вариант("Процесс убит", { сигнал: "ловушка", вывод: ответ.стандартный, ошибки: `${ответ.ошибки}${ответ.сбой}` })
    return вариант("Процесс завершён", { код: ответ.код, вывод: ответ.стандартный, ошибки: ответ.ошибки })
  }
  const файловое = async (путь, что) => {
    if (!можно.файлы) return сбой("FLANG_IO_DENIED", "хозяину запрещено трогать файлы вкладки")
    try {
      await смонтировать()
    } catch (ошибка) {
      return сбой("FLANG_IO_MOUNT", текст(ошибка))
    }
    try {
      return что(путьWasi("/", String(путь ?? "")))
    } catch (ошибка) {
      return сбой("FLANG_IO_WRITE", текст(ошибка))
    }
  }
  const файл = (путь) => {
    const узел = склад.узлы.get(путь)
    return узел?.тип === "файл" ? узел.байты : null
  }

  const источник = (цель) => цель?.closest?.(`[${ПРИЗНАК_СОБЫТИЯ}]`) ?? null
  const полеЛи = (узел) => /^(INPUT|TEXTAREA|SELECT)$/u.test(узел.tagName ?? "") && !/^(button|submit|reset)$/u.test(узел.type ?? "")
  const отУзла = (узел, хвост, значение) => {
    if (узел.hasAttribute(ПРИЗНАК_СТОПА)) остановить("стоп")
    случилось(`${узел.getAttribute(ПРИЗНАК_СОБЫТИЯ)}${хвост}`, значение, узел)
  }
  const каретка = (узел) => {
    if (!узел.hasAttribute(ПРИЗНАК_КАРЕТКИ) || typeof узел.selectionStart !== "number") return
    const где = `${узел.selectionStart} ${узел.selectionEnd}`
    if (каретки.get(узел) === где) return
    каретки.set(узел, где)
    отУзла(узел, "/каретка", где)
  }
  const сочетание = (с) => `${с.ctrlKey ? "Ctrl+" : ""}${с.metaKey ? "Meta+" : ""}${с.altKey ? "Alt+" : ""}${с.shiftKey ? "Shift+" : ""}${с.key}`
  const подписаться = () => {
    if (подписаны || документ === undefined || документ === null) return
    подписаны = true
    const слушать = (вид, что) => документ.addEventListener(вид, (с) => {
      const узел = источник(с.target)
      if (узел !== null) что(узел, с)
    })
    слушать("click", (узел) => (полеЛи(узел) ? каретка(узел) : отУзла(узел, "", значениеУзла(узел))))
    слушать("input", (узел) => {
      отУзла(узел, "", значениеУзла(узел))
      каретка(узел)
    })
    слушать("keydown", (узел, с) => {
      const нажато = сочетание(с)
      if (!(узел.getAttribute(ПРИЗНАК_КЛАВИШ) ?? "").split(/\s+/u).includes(нажато)) return
      с.preventDefault()
      отУзла(узел, "/клавиша", нажато)
    })
    слушать("keyup", каретка)
    слушать("focusin", (узел) => (узел.hasAttribute(ПРИЗНАК_ФОКУСА) ? отУзла(узел, "/фокус", значениеУзла(узел)) : undefined))
    слушать("focusout", (узел) => (узел.hasAttribute(ПРИЗНАК_ФОКУСА) ? отУзла(узел, "/уход", значениеУзла(узел)) : undefined))
    let наведение = null
    документ.addEventListener("pointerover", (с) => {
      if (наведение !== null) снять(наведение)
      наведение = null
      const узел = с.target?.closest?.(`[${ПРИЗНАК_НАВЕДЕНИЯ}]`) ?? null
      if (узел === null) return
      наведение = отложить(() => {
        наведение = null
        случилось(`${узел.getAttribute(ПРИЗНАК_НАВЕДЕНИЯ)}/наведение`, значениеУзла(узел), узел)
      }, 400)
    })
    документ.addEventListener("scroll", (с) => {
      const ключ = с.target?.getAttribute?.(ПРИЗНАК_ПРОКРУТКИ)
      if (ключ === null || ключ === undefined) return
      for (const сосед of с.target.parentNode?.childNodes ?? []) {
        if (память.get(сосед)?.ключ !== ключ) continue
        сосед.scrollTop = с.target.scrollTop
        сосед.scrollLeft = с.target.scrollLeft
      }
    }, true)
  }
  const место = (имя) => документ?.querySelector?.(`[${ПРИЗНАК_МЕСТА}="${имя}"]`) ?? null

  return async function исполнить(поручение) {
    const поля = поручение.fields ?? {}
    switch (поручение.variant) {
      case "Показать": {
        if (!можно.экран) return сбой("FLANG_IO_DENIED", "хозяину запрещено писать на экран")
        const имя = поля["место"]
        if (typeof имя !== "string" || имя === "") {
          return сбой("FLANG_IO_PLACE", "поручению «Показать» нужно непустое имя места")
        }
        подписаться()
        if (имя === МЕСТО_АДРЕСА) {
          слушатьАдрес()
          окно.history?.replaceState?.(null, "", `#${String(поля["текст"] ?? "")}`)
          return вариант("Показано", {})
        }
        if (имя === МЕСТО_БУФЕРА) {
          try {
            await окно.navigator.clipboard.writeText(String(поля["текст"] ?? ""))
            return вариант("Показано", {})
          } catch (ошибка) {
            return сбой("FLANG_IO_DENIED", `буфер обмена не дался: ${текст(ошибка)}`)
          }
        }
        const узел = место(имя)
        if (узел === null) return сбой("FLANG_IO_PLACE", `на странице нет места «${имя}»`)
        узел.textContent = String(поля["текст"] ?? "")
        return вариант("Показано", {})
      }

      case "Ждать событие": {
        if (!можно.экран) return сбой("FLANG_IO_DENIED", "хозяину запрещено слушать экран")
        подписаться()
        const накопленное = копилка.shift()
        if (накопленное !== undefined) {
          return вариант("Случилось", { откуда: накопленное.место, значение: накопленное.значение })
        }
        const срок = Number(поля["срок"] ?? 0)
        return await new Promise((готово) => {
          let метка = null
          ожидающий = (отклик) => {
            if (метка !== null) снять(метка)
            готово(отклик)
          }
          if (Number.isFinite(срок) && срок > 0) {
            метка = отложить(() => {
              ожидающий = null
              готово(вариант("Срок вышел", {}))
            }, срок)
          }
        })
      }

      case "Запросить": {
        if (!можно.сеть) return сбой("FLANG_IO_DENIED", "хозяину запрещено ходить в сеть")
        if (typeof сходить !== "function") {
          return сбой("FLANG_IO_NET", "у хозяина нет способа сходить в сеть")
        }
        const способ = String(поля["способ"] ?? "GET").toUpperCase()
        const адрес = String(поля["адрес"] ?? "")
        const тело = String(поля["тело"] ?? "")
        try {
          const запрос = { method: способ, signal: AbortSignal.timeout(таймаут) }
          if (тело !== "" && способ !== "GET" && способ !== "HEAD") запрос.body = тело
          const ответ = await сходить(адрес, запрос)
          return вариант("Ответ сети", { код: ответ.status, тело: await ответ.text() })
        } catch (ошибка) {
          return сбой("FLANG_IO_NET", текст(ошибка))
        }
      }

      case "Текущее время": {
        if (!можно.время) return сбой("FLANG_IO_DENIED", "хозяину запрещено смотреть на часы")
        return вариант("Отметка времени", { миллисекунды: часы() })
      }

      case "Случайное число": {
        if (!можно.случайность) return сбой("FLANG_IO_DENIED", "хозяину запрещено бросать кости")
        return вариант("Выпало", { значение: бросить() })
      }

      case "Случайные октеты": {
        if (!можно.случайность) return сбой("FLANG_IO_DENIED", "хозяину запрещено бросать кости")
        const сколько = поля["сколько"]
        if (!Number.isInteger(сколько) || сколько < 0 || сколько > 65536) {
          return сбой("FLANG_IO_ENTROPY", "«сколько» — целое от 0 до 65536")
        }
        const октеты = new Uint8Array(сколько)
        for (let начало = 0; начало < сколько; начало += 65536) {
          crypto.getRandomValues(октеты.subarray(начало, Math.min(сколько, начало + 65536)))
        }
        return вариант("Октеты", { октеты: Array.from(октеты) })
      }

      case "Показать страницу": {
        if (!можно.экран) return сбой("FLANG_IO_DENIED", "хозяину запрещено писать на экран")
        подписаться()
        const узел = место(String(поля["место"] ?? ""))
        if (узел === null) return сбой("FLANG_IO_PLACE", `на странице нет места «${поля["место"]}»`)
        const негодное = негодноеВДереве(поля["узлы"])
        if (негодное !== null) return сбой("FLANG_IO_PAGE", негодное)
        const действия = []
        собратьУзлы(документ, узел, поля["узлы"], null, память, (чей) => копилка.some((событие) => событие.узел === чей), действия)
        for (const [чей, чьё, значение] of действия) исполнитьДействие(чей, чьё, значение)
        return вариант("Показано", {})
      }

      case "Прочитать файл":
        return файловое(поля["путь"], (путь) => (файл(путь) === null ? сбой("FLANG_IO_READ", `файла «${путь}» во вкладке нет`) : вариант("Прочитано", { содержимое: декодер.decode(файл(путь)) })))

      case "Прочитать октеты из файла":
        return файловое(поля["путь"], (путь) => (файл(путь) === null ? сбой("FLANG_IO_READ", `файла «${путь}» во вкладке нет`) : вариант("Октеты", { октеты: Array.from(файл(путь)) })))

      case "Записать файл":
      case "Записать октеты в файл":
        return файловое(поля["путь"], (путь) => {
          if (склад.узлы.get(путь)?.тип === "каталог") return сбой("FLANG_IO_WRITE", `«${путь}» — каталог`)
          const байты = поручение.variant === "Записать файл" ? кодер.encode(String(поля["содержимое"] ?? "")) : Uint8Array.from(поля["октеты"] ?? [])
          положить(путь, байты, true)
          return вариант("Записано", { сколько: байты.length })
        })

      case "Удалить файл":
        return файловое(поля["путь"], (путь) => {
          if (путь === "/" || !склад.узлы.has(путь)) return сбой("FLANG_IO_REMOVE", `пути «${путь}» во вкладке нет`)
          убрать(путь, true)
          return вариант("Убрано", {})
        })

      case "Перечислить каталог":
        return файловое(поля["путь"], (путь) => {
          if (склад.узлы.get(путь)?.тип !== "каталог") return сбой("FLANG_IO_LIST", `каталога «${путь}» во вкладке нет`)
          const имена = [...склад.узлы.keys()].filter((свой) => свой !== "/" && родительWasi(свой) === путь).map((свой) => свой.slice(свой.lastIndexOf("/") + 1))
          return вариант("Перечислено", { имена: имена.sort() })
        })

      case "Завести временный каталог":
        return файловое(`${поля["образец"] ?? ""}${Math.floor(бросить() * 2176782336).toString(36).padStart(6, "0")}`, (путь) => {
          положить(путь, null, true)
          return вариант("Заведено", { путь })
        })

      case "Запустить процесс":
        return прогнать(String(поля["программа"] ?? ""), (поля["аргументы"] ?? []).map(String), "", 0)

      case "Запустить процесс с вводом":
        return прогнать(String(поля["программа"] ?? ""), (поля["аргументы"] ?? []).map(String), String(поля["ввод"] ?? ""), 0)

      case "Запустить процесс с пределом":
        return прогнать(String(поля["программа"] ?? ""), (поля["аргументы"] ?? []).map(String), "", Number(поля["срок"] ?? 0))

      case "Прочитать переменную среды": {
        const имя = String(поля["имя"] ?? "")
        if (имя === МЕСТО_АДРЕСА) {
          слушатьАдрес()
          return вариант("Значение среды", { значение: фрагмент() })
        }
        return Object.hasOwn(среда, имя) ? вариант("Значение среды", { значение: String(среда[имя]) }) : вариант("Переменной среды нет", {})
      }

      case "Прочитать доводы":
        return вариант("Доводы", { доводы: доводы.map(String) })

      case "Размер экрана":
        return сбой("FLANG_IO_NO_SCREEN", "у вкладки нет экрана в знаках: поручение «Размер экрана» исполнить нечем")

      case "Открыть соединение":
      case "Принять соединение":
      case "Прочитать из соединения":
      case "Ответить в соединение":
      case "Прочитать октеты из соединения":
      case "Ответить октетами в соединение":
      case "Отправить датаграмму":
      case "Принять датаграмму":
        return сбой(
          "FLANG_IO_NO_SOCKETS",
          `у хозяина браузера нет сырых сокетов: поручение «${поручение.variant}» исполнить нечем`,
        )

      default:
        return сбой("FLANG_IO_UNKNOWN", `хозяин не знает поручения «${поручение.variant}»`)
    }
  }
}

function значениеУзла(узел) {
  const объявлено = узел?.getAttribute?.("данные-значение")
  if (typeof объявлено === "string" && объявлено !== "") return объявлено
  const введённое = узел?.value
  if (typeof введённое === "string") return введённое
  return String(узел?.textContent ?? "")
}

function текст(ошибка) {
  return ошибка instanceof Error ? ошибка.message : String(ошибка)
}

async function завестиИзРазметки() {
  const тег = document.querySelector("script[данные-модуль]")
  if (тег === null) return
  const адрес = тег.getAttribute("данные-модуль")
  const местоОтказа = тег.getAttribute("данные-место-отказа") ?? "итог"
  try {
    const модуль = await import(new URL(адрес, document.baseURI).href)
    const слова = (признак) => (тег.getAttribute(признак) ?? "").split(/\s+/u).filter((слово) => слово !== "")
    const среда = Object.fromEntries(слова("данные-среда").map((пара) => [пара.slice(0, пара.indexOf("=")), пара.slice(пара.indexOf("=") + 1)]))
    const хозяин = хозяинВкладки({ документ: document, вариант: модуль.ioPlan().вариант, программы: тег.getAttribute("данные-программы") ?? "./", архивы: слова("данные-архивы"), среда, доводы: слова("данные-доводы") })
    const итог = await модуль.ioRun("", хозяин, { поручений: 0 })
    console.info(`итог плана: ${JSON.stringify(итог?.значение ?? null)}`)
  } catch (беда) {
    const узел = документМеста(местоОтказа)
    const текстБеды = `${беда?.code ?? "FLANG"}: ${беда?.message ?? String(беда)}`
    if (узел !== null) узел.textContent = текстБеды
    else console.error(текстБеды)
  }
}

function документМеста(место) {
  return document.querySelector(`[${ПРИЗНАК_МЕСТА}="${место}"]`)
}

const WASI_ОШИБКА = Object.freeze({ BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54, NOTEMPTY: 55, SPIPE: 70 })
const WASI_ТИП = Object.freeze({ символьный: 2, каталог: 3, файл: 4 })
const WASI_ПРАВА = 0x1fffffffn

class ВыходWasi {
  constructor(код) {
    this.код = код
  }
}

function путьWasi(основа, хвост) {
  const части = (хвост.startsWith("/") ? хвост : `${основа}/${хвост}`).split("/")
  const итог = []
  for (const часть of части) {
    if (часть === "" || часть === ".") continue
    if (часть === "..") итог.pop()
    else итог.push(часть)
  }
  return `/${итог.join("/")}`
}

function родительWasi(путь) {
  const место = путь.lastIndexOf("/")
  return место <= 0 ? "/" : путь.slice(0, место)
}

export function файлыWasi(начальные = {}) {
  const узлы = new Map([["/", { тип: "каталог" }]])
  const кодер = new TextEncoder()
  const положить = (путь, содержимое) => {
    const полный = путьWasi("/", путь)
    let каталог = родительWasi(полный)
    const цепочка = []
    while (!узлы.has(каталог)) {
      цепочка.push(каталог)
      каталог = родительWasi(каталог)
    }
    for (const звено of цепочка) узлы.set(звено, { тип: "каталог" })
    узлы.set(полный, { тип: "файл", байты: typeof содержимое === "string" ? кодер.encode(содержимое) : содержимое })
  }
  for (const [путь, содержимое] of Object.entries(начальные)) положить(путь, содержимое)
  return { узлы, положить, прочитать: (путь) => узлы.get(путьWasi("/", путь))?.байты ?? null }
}

export function запуститьWasi(модуль, { доводы = [], окружение = {}, файлы = файлыWasi(), вход = "" } = {}) {
  const кодер = new TextEncoder()
  const декодер = new TextDecoder()
  const вывод = []
  const входБайты = кодер.encode(вход)
  let входПозиция = 0
  let память = null
  const вид = () => new DataView(память.buffer)
  const байты = () => new Uint8Array(память.buffer)
  const строкаИз = (адрес, длина) => декодер.decode(байты().slice(адрес, адрес + длина))
  const дескрипторы = new Map([
    [0, { тип: WASI_ТИП.символьный, поток: 0 }],
    [1, { тип: WASI_ТИП.символьный, поток: 1 }],
    [2, { тип: WASI_ТИП.символьный, поток: 2 }],
    [3, { тип: WASI_ТИП.каталог, путь: "/", предоткрыт: true }],
  ])
  let следующий = 4
  const узлы = файлы.узлы
  const найти = (дескриптор, адрес, длина) => {
    const основа = дескрипторы.get(дескриптор)
    if (основа === undefined || основа.тип !== WASI_ТИП.каталог) return null
    return путьWasi(основа.путь, строкаИз(адрес, длина))
  }
  const сведения = (адрес, узел, размер) => {
    const в = вид()
    for (let сдвиг = 0; сдвиг < 64; сдвиг += 8) в.setBigUint64(адрес + сдвиг, 0n, true)
    в.setBigUint64(адрес + 8, BigInt(узел.номер ?? 1), true)
    в.setUint8(адрес + 16, узел.тип === "каталог" ? WASI_ТИП.каталог : узел.тип === WASI_ТИП.символьный ? WASI_ТИП.символьный : WASI_ТИП.файл)
    в.setBigUint64(адрес + 24, 1n, true)
    в.setBigUint64(адрес + 32, BigInt(размер), true)
  }
  const векторы = (адрес, число, делать) => {
    const в = вид()
    let всего = 0
    for (let н = 0; н < число; н += 1) {
      const начало = в.getUint32(адрес + н * 8, true)
      const длина = в.getUint32(адрес + н * 8 + 4, true)
      const сделано = делать(начало, длина)
      всего += сделано
      if (сделано < длина) break
    }
    return всего
  }
  const список = (строки) => строки.map((с) => кодер.encode(`${с}\0`))
  const доводыБайты = список(доводы)
  const средаБайты = список(Object.entries(окружение).map(([к, з]) => `${к}=${з}`))
  const отдатьСписок = (элементы, адресУказателей, адресБуфера) => {
    let место = адресБуфера
    элементы.forEach((элемент, н) => {
      вид().setUint32(адресУказателей + н * 4, место, true)
      байты().set(элемент, место)
      место += элемент.length
    })
    return 0
  }
  const размерыСписка = (элементы, адресЧисла, адресРазмера) => {
    вид().setUint32(адресЧисла, элементы.length, true)
    вид().setUint32(адресРазмера, элементы.reduce((с, э) => с + э.length, 0), true)
    return 0
  }
  const wasi = {
    args_sizes_get: (а, б) => размерыСписка(доводыБайты, а, б),
    args_get: (а, б) => отдатьСписок(доводыБайты, а, б),
    environ_sizes_get: (а, б) => размерыСписка(средаБайты, а, б),
    environ_get: (а, б) => отдатьСписок(средаБайты, а, б),
    clock_res_get: (часы, адрес) => {
      вид().setBigUint64(адрес, 1000n, true)
      return 0
    },
    clock_time_get: (часы, точность, адрес) => {
      const сейчас = часы === 0 ? Date.now() * 1e6 : (globalThis.performance?.now() ?? Date.now()) * 1e6
      вид().setBigUint64(адрес, BigInt(Math.round(сейчас)), true)
      return 0
    },
    random_get: (адрес, длина) => {
      globalThis.crypto.getRandomValues(байты().subarray(адрес, адрес + длина))
      return 0
    },
    proc_exit: (код) => {
      throw new ВыходWasi(код)
    },
    proc_raise: () => WASI_ОШИБКА.NOSYS,
    sched_yield: () => 0,
    poll_oneoff: () => WASI_ОШИБКА.NOSYS,
    fd_advise: () => 0,
    fd_allocate: () => 0,
    fd_datasync: () => 0,
    fd_sync: () => 0,
    fd_fdstat_set_flags: () => 0,
    fd_fdstat_set_rights: () => 0,
    fd_filestat_set_times: () => 0,
    path_filestat_set_times: () => 0,
    path_link: () => WASI_ОШИБКА.NOSYS,
    path_symlink: () => WASI_ОШИБКА.NOSYS,
    path_readlink: () => WASI_ОШИБКА.INVAL,
    fd_renumber: (от, к) => {
      const запись = дескрипторы.get(от)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      дескрипторы.set(к, запись)
      дескрипторы.delete(от)
      return 0
    },
    sock_accept: () => WASI_ОШИБКА.NOSYS,
    sock_recv: () => WASI_ОШИБКА.NOSYS,
    sock_send: () => WASI_ОШИБКА.NOSYS,
    sock_shutdown: () => WASI_ОШИБКА.NOSYS,
    fd_write: (дескриптор, адрес, число, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      const всего = векторы(адрес, число, (начало, длина) => {
        const кусок = байты().slice(начало, начало + длина)
        if (запись.поток !== undefined) {
          вывод.push({ поток: запись.поток, кусок })
          return длина
        }
        const узел = узлы.get(запись.путь)
        if (узел === undefined || узел.тип !== "файл") return 0
        const позиция = запись.добавлять ? узел.байты.length : запись.позиция
        const нужно = позиция + длина
        if (нужно > узел.байты.length) {
          const больше = new Uint8Array(нужно)
          больше.set(узел.байты)
          узел.байты = больше
        }
        узел.байты.set(кусок, позиция)
        запись.позиция = позиция + длина
        return длина
      })
      вид().setUint32(адресИтога, всего, true)
      return 0
    },
    fd_read: (дескриптор, адрес, число, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      if (запись.тип === WASI_ТИП.каталог) return WASI_ОШИБКА.ISDIR
      const источник = запись.поток === 0 ? входБайты : запись.поток !== undefined ? new Uint8Array(0) : узлы.get(запись.путь)?.байты ?? new Uint8Array(0)
      const всего = векторы(адрес, число, (начало, длина) => {
        const позиция = запись.поток === 0 ? входПозиция : запись.позиция ?? 0
        const кусок = источник.subarray(позиция, Math.min(источник.length, позиция + длина))
        байты().set(кусок, начало)
        if (запись.поток === 0) входПозиция += кусок.length
        else запись.позиция = позиция + кусок.length
        return кусок.length
      })
      вид().setUint32(адресИтога, всего, true)
      return 0
    },
    fd_pread: (дескриптор, адрес, число, сдвиг, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      const узел = запись && узлы.get(запись.путь)
      if (узел === undefined || узел.тип !== "файл") return WASI_ОШИБКА.BADF
      let позиция = Number(сдвиг)
      const всего = векторы(адрес, число, (начало, длина) => {
        const кусок = узел.байты.subarray(позиция, Math.min(узел.байты.length, позиция + длина))
        байты().set(кусок, начало)
        позиция += кусок.length
        return кусок.length
      })
      вид().setUint32(адресИтога, всего, true)
      return 0
    },
    fd_pwrite: () => WASI_ОШИБКА.NOSYS,
    fd_seek: (дескриптор, сдвиг, откуда, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      if (запись.поток !== undefined) return WASI_ОШИБКА.SPIPE
      const длина = узлы.get(запись.путь)?.байты?.length ?? 0
      const основа = откуда === 0 ? 0 : откуда === 1 ? запись.позиция : длина
      const новая = основа + Number(сдвиг)
      if (новая < 0) return WASI_ОШИБКА.INVAL
      запись.позиция = новая
      вид().setBigUint64(адресИтога, BigInt(новая), true)
      return 0
    },
    fd_tell: (дескриптор, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      вид().setBigUint64(адресИтога, BigInt(запись.позиция ?? 0), true)
      return 0
    },
    fd_close: (дескриптор) => {
      if (!дескрипторы.has(дескриптор)) return WASI_ОШИБКА.BADF
      дескрипторы.delete(дескриптор)
      return 0
    },
    fd_fdstat_get: (дескриптор, адрес) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      const в = вид()
      в.setUint8(адрес, запись.тип)
      в.setUint16(адрес + 2, запись.добавлять ? 1 : 0, true)
      в.setBigUint64(адрес + 8, WASI_ПРАВА, true)
      в.setBigUint64(адрес + 16, WASI_ПРАВА, true)
      return 0
    },
    fd_filestat_get: (дескриптор, адрес) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined) return WASI_ОШИБКА.BADF
      if (запись.поток !== undefined) {
        сведения(адрес, { тип: WASI_ТИП.символьный }, 0)
        return 0
      }
      const узел = узлы.get(запись.путь)
      if (узел === undefined) return WASI_ОШИБКА.BADF
      сведения(адрес, узел, узел.байты?.length ?? 0)
      return 0
    },
    fd_filestat_set_size: (дескриптор, размер) => {
      const запись = дескрипторы.get(дескриптор)
      const узел = запись && узлы.get(запись.путь)
      if (узел === undefined || узел.тип !== "файл") return WASI_ОШИБКА.BADF
      const новый = new Uint8Array(Number(размер))
      новый.set(узел.байты.subarray(0, новый.length))
      узел.байты = новый
      return 0
    },
    fd_prestat_get: (дескриптор, адрес) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined || !запись.предоткрыт) return WASI_ОШИБКА.BADF
      вид().setUint8(адрес, 0)
      вид().setUint32(адрес + 4, кодер.encode(запись.путь).length, true)
      return 0
    },
    fd_prestat_dir_name: (дескриптор, адрес, длина) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined || !запись.предоткрыт) return WASI_ОШИБКА.BADF
      байты().set(кодер.encode(запись.путь).subarray(0, длина), адрес)
      return 0
    },
    fd_readdir: (дескриптор, адрес, длина, печенье, адресИтога) => {
      const запись = дескрипторы.get(дескриптор)
      if (запись === undefined || запись.тип !== WASI_ТИП.каталог) return WASI_ОШИБКА.BADF
      const префикс = запись.путь === "/" ? "/" : `${запись.путь}/`
      const имена = [".", ".."]
      for (const путь of узлы.keys()) {
        if (путь !== "/" && путь.startsWith(префикс) && !путь.slice(префикс.length).includes("/")) имена.push(путь.slice(префикс.length))
      }
      const куча = []
      имена.slice(Number(печенье)).forEach((имя, н) => {
        const имяБайты = кодер.encode(имя)
        const шапка = new DataView(new ArrayBuffer(24))
        const узел = имя === "." || имя === ".." ? { тип: "каталог" } : узлы.get(префикс + имя)
        шапка.setBigUint64(0, BigInt(Number(печенье) + н + 1), true)
        шапка.setBigUint64(8, 1n, true)
        шапка.setUint32(16, имяБайты.length, true)
        шапка.setUint8(20, узел.тип === "каталог" ? WASI_ТИП.каталог : WASI_ТИП.файл)
        куча.push(new Uint8Array(шапка.buffer), имяБайты)
      })
      let занято = 0
      for (const кусок of куча) {
        const влезет = Math.min(кусок.length, длина - занято)
        байты().set(кусок.subarray(0, влезет), адрес + занято)
        занято += влезет
        if (занято >= длина) break
      }
      вид().setUint32(адресИтога, занято, true)
      return 0
    },
    path_open: (каталог, флагиПути, адрес, длина, флагиОткрытия, праваОсновные, праваНаследуемые, флагиДескриптора, адресИтога) => {
      const путь = найти(каталог, адрес, длина)
      if (путь === null) return WASI_ОШИБКА.BADF
      let узел = узлы.get(путь)
      const создать = (флагиОткрытия & 1) !== 0
      const толькоКаталог = (флагиОткрытия & 2) !== 0
      const исключить = (флагиОткрытия & 4) !== 0
      const обрезать = (флагиОткрытия & 8) !== 0
      if (узел !== undefined && исключить && создать) return WASI_ОШИБКА.EXIST
      if (узел === undefined) {
        if (!создать) return WASI_ОШИБКА.NOENT
        const родитель = узлы.get(родительWasi(путь))
        if (родитель === undefined) return WASI_ОШИБКА.NOENT
        if (родитель.тип !== "каталог") return WASI_ОШИБКА.NOTDIR
        узел = { тип: "файл", байты: new Uint8Array(0) }
        узлы.set(путь, узел)
      }
      if (толькоКаталог && узел.тип !== "каталог") return WASI_ОШИБКА.NOTDIR
      if (обрезать && узел.тип === "файл") узел.байты = new Uint8Array(0)
      const номер = следующий
      следующий += 1
      дескрипторы.set(номер, {
        тип: узел.тип === "каталог" ? WASI_ТИП.каталог : WASI_ТИП.файл,
        путь,
        позиция: 0,
        добавлять: (флагиДескриптора & 1) !== 0,
      })
      вид().setUint32(адресИтога, номер, true)
      return 0
    },
    path_filestat_get: (каталог, флаги, адрес, длина, адресИтога) => {
      const путь = найти(каталог, адрес, длина)
      if (путь === null) return WASI_ОШИБКА.BADF
      const узел = узлы.get(путь)
      if (узел === undefined) return WASI_ОШИБКА.NOENT
      сведения(адресИтога, узел, узел.байты?.length ?? 0)
      return 0
    },
    path_create_directory: (каталог, адрес, длина) => {
      const путь = найти(каталог, адрес, длина)
      if (путь === null) return WASI_ОШИБКА.BADF
      if (узлы.has(путь)) return WASI_ОШИБКА.EXIST
      if (узлы.get(родительWasi(путь))?.тип !== "каталог") return WASI_ОШИБКА.NOENT
      узлы.set(путь, { тип: "каталог" })
      return 0
    },
    path_remove_directory: (каталог, адрес, длина) => {
      const путь = найти(каталог, адрес, длина)
      if (путь === null) return WASI_ОШИБКА.BADF
      const узел = узлы.get(путь)
      if (узел === undefined) return WASI_ОШИБКА.NOENT
      if (узел.тип !== "каталог") return WASI_ОШИБКА.NOTDIR
      for (const другой of узлы.keys()) if (другой.startsWith(`${путь}/`)) return WASI_ОШИБКА.NOTEMPTY
      узлы.delete(путь)
      return 0
    },
    path_unlink_file: (каталог, адрес, длина) => {
      const путь = найти(каталог, адрес, длина)
      if (путь === null) return WASI_ОШИБКА.BADF
      const узел = узлы.get(путь)
      if (узел === undefined) return WASI_ОШИБКА.NOENT
      if (узел.тип === "каталог") return WASI_ОШИБКА.ISDIR
      узлы.delete(путь)
      return 0
    },
    path_rename: (каталог, адрес, длина, новыйКаталог, новыйАдрес, новаяДлина) => {
      const откуда = найти(каталог, адрес, длина)
      const куда = найти(новыйКаталог, новыйАдрес, новаяДлина)
      if (откуда === null || куда === null) return WASI_ОШИБКА.BADF
      const узел = узлы.get(откуда)
      if (узел === undefined) return WASI_ОШИБКА.NOENT
      узлы.delete(откуда)
      узлы.set(куда, узел)
      return 0
    },
  }
  const образец = new WebAssembly.Instance(модуль, { wasi_snapshot_preview1: wasi })
  память = образец.exports.memory
  let код = 0
  let сбой = null
  try {
    образец.exports._start()
  } catch (беда) {
    if (беда instanceof ВыходWasi) код = беда.код
    else {
      код = -1
      сбой = беда
    }
  }
  const склеить = (отбор) => {
    const куски = вывод.filter(отбор).map((з) => з.кусок)
    const всё = new Uint8Array(куски.reduce((с, к) => с + к.length, 0))
    let место = 0
    for (const кусок of куски) {
      всё.set(кусок, место)
      место += кусок.length
    }
    return декодер.decode(всё)
  }
  return {
    код,
    сбой,
    вывод: склеить(() => true),
    стандартный: склеить((з) => з.поток === 1),
    ошибки: склеить((з) => з.поток === 2),
    файлы,
  }
}

export function разобратьTar(байты) {
  const декодер = new TextDecoder()
  const файлы = {}
  let место = 0
  while (место + 512 <= байты.length && байты[место] !== 0) {
    const поле = (сдвиг, длина) => декодер.decode(байты.subarray(место + сдвиг, место + сдвиг + длина)).replace(/\0[\s\S]*$/u, "")
    const размер = parseInt(поле(124, 12).trim() || "0", 8)
    const приставка = поле(345, 155)
    const путь = (приставка ? `${приставка}/${поле(0, 100)}` : поле(0, 100)).replace(/^\.\//u, "")
    if (байты[место + 156] === 0 || байты[место + 156] === 48) файлы[`/${путь}`] = байты.slice(место + 512, место + 512 + размер)
    место += 512 + Math.ceil(размер / 512) * 512
  }
  return файлы
}

export const ПЕСОЧНИЦА_ФАЙЛЫ = Object.freeze({
  компилятор: "flang.wasm",
  сверщик: "checker.wasm",
  библиотека: "library.tar",
  рассуждения: "reasoning.js",
  формулы: "formula.js",
  переводC: "c.js",
  статья: "argue-page.js",
  словарьСлов: "dictionary-words.js",
})

/* Свой текст: черновик разметки пишет грамматика (flang/experimental/argue/page.flang),
   признаки слов даёт словарь OpenCorpora, собранный сборкой сайта в каталог
   `dictionary/` рядом с песочницей, а каждый шаг рассуждения судит ядро — тот же
   flang.wasm. Пределы держат ответ на абзац в пределах секунд, а вкладку живой. */
export const КАТАЛОГ_СЛОВАРЯ = "dictionary/"
export const ПРЕДЕЛЫ_ТЕКСТА = Object.freeze({ знаков: 6000, предложений: 40, заданий: 200, мс: 90000 })

/* План «Words» (flang/ct/russian/dictionary/words.fscript) исполняется как есть:
   он просит файлы словаря по одному, а здесь они скачиваются. Файла нет —
   план получает «Сбой» и отвечает своими словами и догадкой по окончанию. */
export async function строкиСловаря(модульСлов, текстСтатьи, прочитатьФайл) {
  const вариант = модульСлов.ioPlan().вариант
  const файлы = { "/text.txt": текстСтатьи }
  const счёт = { прочитано: 0, нет: 0 }
  const исполнить = async (поручение) => {
    const поля = поручение.fields ?? {}
    if (поручение.variant === "Прочитать доводы") return вариант("Доводы", { доводы: ["/dictionary", "/text.txt", "/table", "/short"] })
    if (поручение.variant === "Записать файл") {
      файлы[поля.путь] = поля.содержимое
      return вариант("Записано", { сколько: String(поля.содержимое ?? "").length })
    }
    if (поручение.variant !== "Прочитать файл") return вариант("Сбой", { код: "FLANG_PLAYGROUND", сообщение: `поручение «${поручение.variant}» здесь не исполняется` })
    if (поля.путь in файлы) return вариант("Прочитано", { содержимое: файлы[поля.путь] })
    const имя = /^\/dictionary\/([a-z0-9./-]+)$/u.exec(поля.путь)
    const содержимое = имя === null ? null : await прочитатьФайл(имя[1])
    if (содержимое === null) {
      счёт.нет += 1
      return вариант("Сбой", { код: "ENOENT", сообщение: `нет файла ${поля.путь}` })
    }
    счёт.прочитано += 1
    return вариант("Прочитано", { содержимое })
  }
  const итог = await модульСлов.ioRun("Words", исполнить, {})
  return { строки: String(файлы["/short"] ?? "").split("\n").filter((с) => с !== ""), итог: String(итог.значение ?? ""), ...счёт }
}

/* Грамматика может упасть на предложении (например, на строке словаря, которой
   она не ждёт). Тогда такие предложения ищутся по одному, остальные читаются
   вместе, а упавшие помечаются «внутренняя ошибка разбора». */
export function прочитатьБезПадений(модуль, текстСтатьи, предложения, строки) {
  const поля = (чтение) => ({ разметка: String(чтение.claims), предложения: [...чтение.sentences].map((п) => ({ текст: п.text, состояние: п.status, формы: [...п.forms], причины: [...п.reasons], виды: [...п.kinds] })) })
  try {
    return поля(модуль.readingForPage(текстСтатьи, строки))
  } catch {
    /* дальше — по одному */
  }
  const упало = (предложение) => {
    try {
      модуль.readingForPage(`${предложение}.`, строки)
      return false
    } catch {
      return true
    }
  }
  const плохие = new Set(предложения.filter(упало))
  const годные = предложения.filter((п) => !плохие.has(п))
  let чтение = { разметка: "", предложения: [] }
  if (годные.length > 0) {
    try {
      чтение = поля(модуль.readingForPage(`${годные.join(". ")}.`, строки))
    } catch {
      /* и вместе не читается: тогда все предложения — внутренняя ошибка */
      годные.forEach((п) => плохие.add(п))
    }
  }
  const прочитанные = new Map(чтение.предложения.map((п) => [п.текст, п]))
  const ошибка = "внутренняя ошибка разбора"
  return {
    разметка: чтение.разметка,
    предложения: предложения.map((п) => (!плохие.has(п) && прочитанные.has(п) ? прочитанные.get(п) : { текст: п, состояние: "error", формы: [], причины: [ошибка], виды: [ошибка] })),
  }
}

/* Вид текста — одно правило на песочницу и «flang repl» (команда «.text»):
   flang/proof/probes/syllogism/sentences/text-kind.flang, напечатанное в
   reasoning.js как kindOfText. Первая значащая строка (пустые и «//» не в счёт)
   с «∀», «∃», «\forall», «\exists» — формула; с «модуль», «module»,
   «категория», «category» — программа («категория», если на верхнем уровне
   объявлена категория; судится она как программа); остальное — рассуждение.
   Формулу читает переводчик формул (flang/foreign/formula), а судит ядро —
   так же, как программу. */
export async function видТекста(текст, модульРассуждений) {
  const р = await модульРассуждений()
  return р.kindOfText(String(текст))
}
const какПрограмма = (вид) => вид === "flang" || вид === "категория"

/* Замечание компилятора — строка «КОД …строка N, столбец M: текст». Здесь
   берутся только код и числа места: текст отдаётся читателю как есть. */
export function замечанияИз(текст) {
  const найдено = []
  for (const строка of String(текст).split("\n")) {
    const м = /^(FLANG_[A-Z0-9_]+)\b(.*)$/u.exec(строка)
    if (!м) continue
    const место = /^([^:]*?(\d+)\D+?(\d+))?:\s*(.*)$/u.exec(м[2])
    if (!место) continue
    найдено.push({
      код: м[1],
      строка: место[2] ? Number(место[2]) : null,
      столбец: место[3] ? Number(место[3]) : null,
      текст: место[4],
    })
  }
  return найдено
}

/* Машинная ведомость — последняя строка стандартного вывода, начатая «{».
   Строки до неё — отчёты о законах, которые компилятор печатает по ходу. */
export function ведомостьИз(стандартный) {
  const строки = String(стандартный).split("\n").filter((с) => с.startsWith("{"))
  for (let н = строки.length - 1; н >= 0; н--) {
    try {
      const значение = JSON.parse(строки[н])
      if (значение && typeof значение === "object" && "ledger" in значение) return значение
    } catch {
      /* не та строка */
    }
  }
  return null
}

function разобратьJson(текст) {
  try {
    return JSON.parse(текст)
  } catch {
    return null
  }
}

/* Что утверждено и в какой форме: имя, вид, связанные имена и цель — для
   перевода в запись с кванторами. Утверждение берётся из дерева разбора
   (там же условия «таких что»), остальное — из обязательств ведомости. */
function высказанное(ведомость, дерево) {
  const из = []
  const утверждения = new Map((дерево?.statements ?? []).map((у) => [у.name, у]))
  for (const о of ведомость?.obligations ?? []) {
    if (о.kind === "totality" || !о.goal) continue
    const своё = о.kind === "statement" ? утверждения.get(о.name) : undefined
    из.push({
      имя: о.name,
      вид: о.kind,
      чья: о.of || "",
      узел: своё ? { vars: своё.vars, such: своё.such, expr: своё.expr } : { vars: о.vars ?? [], such: [], expr: о.goal },
    })
  }
  return из
}

/* ── Печать во все цели ──────────────────────────────────────────────────────
   Та же команда, что в терминале: `flang emit --target <цель>`. Исходники
   рантайма каждая цель кладёт в вывод ДОСЛОВНО, поэтому во вкладку они не
   едут (вместе — 3,3 МБ): на их месте лежат заглушки с меткой, а файлы вывода
   с меткой страница называет «файлами рантайма» и не показывает. Напечатанная
   программа от содержимого рантайма не зависит — проба песочницы сверяет её с
   печатью двоичного компилятора байт в байт. Список файлов — тот же, что
   `EMIT_TARGET_TABLE` в bootstrap/flang_repl.c; разойдётся — печать ответит
   «не хватает …», и проба покраснеет на этой цели. */
export const ЗАГЛУШКА_РАНТАЙМА = "flang playground: the runtime file is copied as is and is not shipped to the browser\n"

export const ЦЕЛИ_ПЕЧАТИ = Object.freeze([
  { цель: "c", название: "C", каталог: "c", рантайм: ["flang_runtime.h", "flang_runtime.c", "flang_cli.c", "flang_repl.c", "flang_conc.h", "flang_conc.c"] },
  { цель: "cpp", название: "C++", каталог: "", рантайм: ["cpp/flang_cpp.hpp", "c/flang_runtime.h", "c/flang_runtime.c", "c/flang_cli.c"] },
  { цель: "go", название: "Go", каталог: "go", рантайм: ["flang_runtime.go", "flang_cli.go"] },
  { цель: "rust", название: "Rust", каталог: "rust", рантайм: ["flang_runtime.rs", "flang_cli.rs"] },
  { цель: "java", название: "Java", каталог: "java", рантайм: ["Value.java", "Field.java", "FlangError.java", "Ctx.java", "Flang.java", "FlangCli.java"] },
  { цель: "js", название: "JavaScript", каталог: "js", рантайм: ["flang_conc.js", "flang_cli.js", "flang_io.js", "flang_host_node.js"] },
  { цель: "ts", название: "TypeScript", каталог: "", рантайм: ["js/flang_conc.js", "js/flang_cli.js", "js/flang_io.js", "ts/tsconfig.json", "js/flang_host_node.js"] },
  { цель: "elixir", название: "Elixir", каталог: "elixir", рантайм: ["flang_runtime.ex", "flang_cli.ex", "flang_conc.ex"] },
  { цель: "python", название: "Python", каталог: "python", рантайм: ["flang_runtime.py", "flang_cli.py", "flang_io.py"] },
  { цель: "csharp", название: "C#", каталог: "csharp", рантайм: ["Value.cs", "Field.cs", "FlangError.cs", "Ctx.cs", "Flang.cs", "FlangCli.cs"] },
])

/* Разбор C для песочницы: подмножество, которое понимает переводчик
   flang/foreign/c (int, struct из int, if/else, циклы, return), печатается
   деревом в записи `clang -Xclang -ast-dump`, уже отрезанной так, как режет
   её план Demo. Переводчик читает именно эту запись; судит перевод ядро. */
export function дампC(исходник) {
  const text = String(исходник)
  const fail = (line, why) => {
    const e = new Error(why)
    e.строка = line
    throw e
  }
  /* ── лексер ── */
  const toks = []
  {
    let i = 0, line = 1, col = 1
    const adv = (n) => {
      for (let k = 0; k < n; k++) {
        const code = text.codePointAt(i)
        if (code === 10) { line += 1; col = 1 } else col += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
        i += code > 0xffff ? 2 : 1
      }
    }
    const ops = ["<<=", ">>=", "...", "->", "++", "--", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||", "+=", "-=", "*=", "/=", "%=", "&=", "^=", "|="]
    while (i < text.length) {
      const c = text[i]
      if (c === "\n" || c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") { adv(1); continue }
      if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") adv(1); continue }
      if (c === "/" && text[i + 1] === "*") {
        const end = text.indexOf("*/", i + 2)
        if (end < 0) fail(line, "комментарий /* не закрыт")
        adv(end + 2 - i); continue
      }
      if (c === "#" && toks.every((t) => t.line !== line)) {
        const rest = text.slice(i, text.indexOf("\n", i) < 0 ? text.length : text.indexOf("\n", i))
        if (!/^#\s*include\s*[<"][^>"]+[>"]\s*$/u.test(rest)) fail(line, "директивы препроцессора, кроме #include, здесь не читаются")
        while (i < text.length && text[i] !== "\n") adv(1)
        continue
      }
      const at = { line, col }
      let m
      if ((m = /^[A-Za-z_][A-Za-z_0-9]*/u.exec(text.slice(i, i + 64)))) { toks.push({ k: "id", v: m[0], ...at }); adv(m[0].length); continue }
      if ((m = /^[0-9][A-Za-z0-9_.]*/u.exec(text.slice(i, i + 64)))) {
        if (!/^(0|[1-9][0-9]*)$/u.test(m[0])) fail(line, `число «${m[0]}» не разобрать: читаются только десятичные целые без суффиксов`)
        if (Number(m[0]) > 2147483647) fail(line, `число ${m[0]} больше INT_MAX`)
        toks.push({ k: "num", v: m[0], ...at }); adv(m[0].length); continue
      }
      const op = ops.find((o) => text.startsWith(o, i)) ?? (/[-+*/%<>=!~&|^?:;,.(){}\[\]]/u.test(c) ? c : null)
      if (op === null) fail(line, `знак «${c}» не разобрать`)
      toks.push({ k: "op", v: op, ...at }); adv(op.length)
    }
    toks.push({ k: "end", v: "", line, col })
  }
  /* ── разбор ── */
  let p = 0
  const peek = (n = 0) => toks[p + n]
  const is = (v, n = 0) => toks[p + n].k !== "end" && toks[p + n].v === v && toks[p + n].k !== "num"
  const next = () => toks[p++]
  const expect = (v) => {
    const t = next()
    if (t.v !== v || t.k === "num") fail(t.line, t.k === "end" ? `текст кончился, а ждали «${v}»` : `ждали «${v}», а стоит «${t.v}»`)
    return t
  }
  const UNSUPPORTED = new Set(["char", "short", "long", "unsigned", "signed", "float", "double", "void", "_Bool", "bool", "const", "static", "extern", "volatile", "typedef", "enum", "union", "goto", "switch", "case", "default", "sizeof", "inline", "register", "auto"])
  const ident = () => {
    const t = next()
    if (t.k !== "id") fail(t.line, t.k === "end" ? "текст кончился, а ждали имя" : `ждали имя, а стоит «${t.v}»`)
    return t
  }
  let address = 0x1000
  const addr = () => `0x${(address += 0x18).toString(16)}`
  const records = new Map()
  const functions = new Map()
  const tops = []
  /* тип: «int» или «struct имя» */
  const typeAt = () => {
    const t = peek()
    if (t.k === "id" && t.v === "int") { next(); return { name: "int", begin: t } }
    if (t.k === "id" && t.v === "struct") {
      next()
      const n = ident()
      return { name: `struct ${n.v}`, begin: t, tag: n }
    }
    if (t.k === "id" && UNSUPPORTED.has(t.v)) fail(t.line, `«${t.v}» здесь не читается: переводчик знает только int и struct из полей int`)
    return null
  }
  const node = (kind, begin, end, rest, kids = [], extra = {}) => ({ kind, begin, end, rest, kids, addr: addr(), ...extra })
  const rvalue = (e) => (e.lvalue ? node("ImplicitCastExpr", e.begin, e.end, `'${e.type}' <LValueToRValue>`, [e], { type: e.type, lvalue: false }) : e)
  const intOnly = (e, t) => {
    if (e.type !== "int") fail(t.line, `значение типа «${e.type}» здесь не годится: ждали int`)
    return e
  }
  /* ── выражения ── */
  let scope = null
  const primary = () => {
    const t = peek()
    if (t.k === "num") { next(); return node("IntegerLiteral", t, t, `'int' ${t.v}`, [], { type: "int" }) }
    if (is("(")) {
      next()
      const inner = expression()
      const close = expect(")")
      return node("ParenExpr", t, close, `'${inner.type}'${inner.lvalue ? " lvalue" : ""}`, [inner], { type: inner.type, lvalue: inner.lvalue })
    }
    if (t.k === "id") {
      if (UNSUPPORTED.has(t.v) || t.v === "int" || t.v === "struct") fail(t.line, `«${t.v}» здесь не читается`)
      next()
      const local = scope?.find(t.v)
      if (local) return node("DeclRefExpr", t, t, `'${local.type}' lvalue ${local.param ? "ParmVar" : "Var"} ${local.addr} '${t.v}' '${local.type}'`, [], { type: local.type, lvalue: true })
      const fn = functions.get(t.v)
      if (fn) return node("DeclRefExpr", t, t, `'${fn.type}' Function ${fn.addr} '${t.v}' '${fn.type}'`, [], { type: fn.type, fn })
      fail(t.line, `имя «${t.v}» не объявлено выше`)
    }
    fail(t.line, t.k === "end" ? "текст кончился посреди выражения" : `«${t.v}» здесь не ждали`)
  }
  const postfix = () => {
    let e = primary()
    for (;;) {
      const t = peek()
      if (is("(")) {
        if (!e.fn) fail(t.line, "вызывать можно только функцию, объявленную выше")
        next()
        const args = []
        if (!is(")")) {
          for (;;) {
            args.push(rvalue(assignment()))
            if (!is(",")) break
            next()
          }
        }
        const close = expect(")")
        if (args.length !== e.fn.params.length) fail(t.line, `функция «${e.fn.name}» ждёт доводов ${e.fn.params.length}, а дано ${args.length}`)
        args.forEach((a, n) => { if (a.type !== e.fn.params[n]) fail(t.line, `довод ${n + 1} функции «${e.fn.name}» — ${a.type}, а ждали ${e.fn.params[n]}`) })
        const callee = node("ImplicitCastExpr", e.begin, e.end, `'${e.fn.type.replace(" (", " (*)(")}' <FunctionToPointerDecay>`, [e], { type: "" })
        e = node("CallExpr", e.begin, close, "'int'", [callee, ...args], { type: "int" })
        continue
      }
      if (is(".")) {
        next()
        const member = ident()
        const record = records.get(e.type)
        if (!record) fail(member.line, "поле берётся только у struct")
        const field = record.fields.find((f) => f.name === member.v)
        if (!field) fail(member.line, `у «${e.type}» нет поля «${member.v}»`)
        e = node("MemberExpr", e.begin, member, `'int'${e.lvalue ? " lvalue" : ""} .${member.v} ${field.addr}`, [e], { type: "int", lvalue: e.lvalue })
        continue
      }
      if (is("->") || is("[")) fail(t.line, `«${t.v}» здесь не читается: указателей и массивов в подмножестве нет`)
      if (is("++") || is("--")) {
        if (!e.lvalue) fail(t.line, `«${t.v}» применим только к переменной`)
        next()
        e = node("UnaryOperator", e.begin, t, `'int' postfix '${t.v}'`, [intOnly(e, t)], { type: "int" })
        continue
      }
      return e
    }
  }
  const unary = () => {
    const t = peek()
    if (t.k === "op" && ["-", "+", "!", "~"].includes(t.v)) {
      next()
      const e = intOnly(rvalue(unary()), t)
      return node("UnaryOperator", t, e.end, `'int' prefix '${t.v}'${t.v === "-" ? "" : " cannot overflow"}`, [e], { type: "int" })
    }
    if (t.k === "op" && (t.v === "++" || t.v === "--")) {
      next()
      const e = unary()
      if (!e.lvalue) fail(t.line, `«${t.v}» применим только к переменной`)
      return node("UnaryOperator", t, e.end, `'int' prefix '${t.v}'`, [intOnly(e, t)], { type: "int" })
    }
    if (t.k === "op" && (t.v === "&" || t.v === "*")) fail(t.line, `«${t.v}» здесь не читается: указателей в подмножестве нет`)
    return postfix()
  }
  const LEVELS = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]]
  const binary = (level) => {
    if (level === LEVELS.length) return unary()
    let left = binary(level + 1)
    while (peek().k === "op" && LEVELS[level].includes(peek().v)) {
      const t = next()
      const right = binary(level + 1)
      left = node("BinaryOperator", left.begin, right.end, `'int' '${t.v}'`, [intOnly(rvalue(left), t), intOnly(rvalue(right), t)], { type: "int" })
    }
    return left
  }
  const conditional = () => {
    const c = binary(0)
    if (!is("?")) return c
    const t = next()
    const a = rvalue(expression())
    expect(":")
    const b = rvalue(conditional())
    return node("ConditionalOperator", c.begin, b.end, "'int'", [intOnly(rvalue(c), t), intOnly(a, t), intOnly(b, t)], { type: "int" })
  }
  const ASSIGN = ["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "&=", "^=", "|="]
  const assignment = () => {
    const left = conditional()
    const t = peek()
    if (t.k === "op" && ASSIGN.includes(t.v)) {
      if (!left.lvalue) fail(t.line, "присвоить можно только переменной")
      next()
      const right = intOnly(rvalue(assignment()), t)
      intOnly(left, t)
      return t.v === "="
        ? node("BinaryOperator", left.begin, right.end, "'int' '='", [left, right], { type: "int" })
        : node("CompoundAssignOperator", left.begin, right.end, `'int' '${t.v}' ComputeLHSTy='int' ComputeResultTy='int'`, [left, right], { type: "int" })
    }
    return left
  }
  const expression = () => {
    const e = assignment()
    if (is(",")) fail(peek().line, "оператор «,» здесь не читается")
    return e
  }
  /* ── операторы ── */
  const Scope = (up) => {
    const names = new Map()
    return { up, names, find: (n) => names.get(n) ?? up?.find(n) ?? null, add: (n, d) => names.set(n, d) }
  }
  const declaration = (spec) => {
    /* «int a = 1, b;» — спецификатор уже прочитан */
    if (spec.name !== "int") fail(spec.begin.line, "локальные переменные читаются только типа int")
    const decls = []
    for (;;) {
      const name = ident()
      let init = null
      if (is("=")) {
        next()
        init = intOnly(rvalue(assignment()), name)
      }
      const d = { type: "int", addr: addr() }
      decls.push(node("VarDecl", spec.begin, init ? init.end : name, null, init ? [init] : [], { addr: d.addr, nameTok: name, after: `${name.v} 'int'${init ? " cinit" : ""}` }))
      scope.add(name.v, d)
      if (!is(",")) break
      next()
    }
    const semi = expect(";")
    return node("DeclStmt", spec.begin, semi, "", decls)
  }
  const statement = () => {
    const t = peek()
    if (is("{")) return block()
    if (is(";")) { next(); return node("NullStmt", t, t, "") }
    if (t.k === "id") {
      switch (t.v) {
        case "return": {
          next()
          if (is(";")) fail(t.line, "return без значения: функция обязана вернуть int")
          const e = intOnly(rvalue(expression()), t)
          expect(";")
          return node("ReturnStmt", t, e.end, "", [e])
        }
        case "if": {
          next(); expect("(")
          const c = intOnly(rvalue(expression()), t)
          expect(")")
          const then = statement()
          if (is("else")) {
            next()
            const other = statement()
            return node("IfStmt", t, other.end, "has_else", [c, then, other])
          }
          return node("IfStmt", t, then.end, "", [c, then])
        }
        case "while": {
          next(); expect("(")
          const c = intOnly(rvalue(expression()), t)
          expect(")")
          const body = statement()
          return node("WhileStmt", t, body.end, "", [c, body])
        }
        case "do": {
          next()
          const body = statement()
          expect("while"); expect("(")
          const c = intOnly(rvalue(expression()), t)
          const close = expect(")")
          expect(";")
          return node("DoStmt", t, close, "", [body, c])
        }
        case "for": {
          next(); expect("(")
          const outer = scope
          scope = Scope(outer)
          let init = null
          if (is(";")) next()
          else {
            const spec = typeAt()
            if (spec) init = declaration(spec)
            else { init = expression(); expect(";") }
          }
          const c = is(";") ? null : intOnly(rvalue(expression()), t)
          expect(";")
          const step = is(")") ? null : expression()
          expect(")")
          const body = statement()
          scope = outer
          return node("ForStmt", t, body.end, "", [init, null, c, step, body])
        }
        case "break":
        case "continue": {
          next(); expect(";")
          return node(t.v === "break" ? "BreakStmt" : "ContinueStmt", t, t, "")
        }
        default: {
          const spec = typeAt()
          if (spec) return declaration(spec)
          if (UNSUPPORTED.has(t.v)) fail(t.line, `«${t.v}» здесь не читается`)
        }
      }
    }
    const e = expression()
    expect(";")
    return e
  }
  const block = () => {
    const open = expect("{")
    const outer = scope
    scope = Scope(outer)
    const kids = []
    while (!is("}")) {
      if (peek().k === "end") fail(open.line, "блок { не закрыт")
      kids.push(statement())
    }
    const close = expect("}")
    scope = outer
    return node("CompoundStmt", open, close, "", kids)
  }
  /* ── объявления верхнего уровня ── */
  while (peek().k !== "end") {
    const t = peek()
    if (is("struct") && peek(1).k === "id" && toks[p + 2].v === "{") {
      next()
      const tag = ident()
      expect("{")
      const fields = []
      while (!is("}")) {
        const ft = typeAt()
        if (!ft || ft.name !== "int") fail(peek().line, "поля struct читаются только типа int")
        for (;;) {
          const name = ident()
          fields.push({ name: name.v, addr: addr(), begin: ft.begin, nameTok: name })
          if (!is(",")) break
          next()
        }
        expect(";")
      }
      const close = expect("}")
      expect(";")
      const kids = fields.map((f) => ({ kind: "FieldDecl", begin: f.begin, end: f.nameTok, rest: null, kids: [], addr: f.addr, nameTok: f.nameTok, after: `${f.name} 'int'` }))
      records.set(`struct ${tag.v}`, { fields })
      tops.push({ kind: "RecordDecl", begin: t, end: close, rest: null, kids, addr: addr(), nameTok: tag, after: `struct ${tag.v} definition` })
      continue
    }
    const ret = typeAt()
    if (!ret) fail(t.line, t.k === "id" ? `«${t.v}» здесь не ждали: на верхнем уровне читаются struct и функции, возвращающие int` : `«${t.v}» здесь не ждали`)
    if (ret.name !== "int") fail(t.line, "функции читаются только с результатом int")
    const name = ident()
    expect("(")
    const params = []
    let voidOnly = false
    if (is("void") && toks[p + 1].v === ")") { next(); voidOnly = true }
    else if (!is(")")) {
      for (;;) {
        const pt = typeAt()
        if (!pt) fail(peek().line, `тип параметра «${peek().v}» не читается: только int и struct`)
        if (pt.name !== "int" && !records.has(pt.name)) fail(pt.begin.line, `«${pt.name}» не объявлен выше`)
        const pn = ident()
        params.push({ type: pt.name, begin: pt.begin, nameTok: pn, addr: addr() })
        if (!is(",")) break
        next()
      }
    }
    const closeParen = expect(")")
    const type = `int (${params.length ? params.map((x) => x.type).join(", ") : voidOnly ? "void" : ""})`
    const known = functions.get(name.v)
    const fn = known ?? { name: name.v, type, params: params.map((x) => x.type), addr: addr() }
    if (known && known.type !== type) fail(name.line, `«${name.v}» объявлена выше с другими параметрами`)
    functions.set(name.v, fn)
    const kids = params.map((x) => ({ kind: "ParmVarDecl", begin: x.begin, end: x.nameTok, rest: null, kids: [], addr: x.addr, nameTok: x.nameTok, after: `${x.nameTok.v} '${x.type}'` }))
    let end = closeParen
    if (is(";")) next()
    else {
      scope = Scope(null)
      params.forEach((x) => scope.add(x.nameTok.v, { type: x.type, addr: x.addr, param: true }))
      const body = block()
      scope = null
      kids.push(body)
      end = body.end
    }
    tops.push({ kind: "FunctionDecl", begin: ret.begin, end, rest: null, kids, addr: known ? addr() : fn.addr, prev: known ? known.addr : null, nameTok: name, after: `${name.v} '${type}'`, type })
  }
  /* ── печать в записи clang ── */
  let lastLine = 0
  let first = true
  const loc = (t) => {
    let s
    if (first) { s = `input.c:${t.line}:${t.col}`; first = false }
    else if (t.line !== lastLine) s = `line:${t.line}:${t.col}`
    else s = `col:${t.col}`
    lastLine = t.line
    return s
  }
  const range = (n) => {
    const b = loc(n.begin)
    if (n.end === n.begin) return `<${b}>`
    return `<${b}, ${loc(n.end)}>`
  }
  const out = []
  const WHOLE = /'int \((int|struct [A-Za-z_0-9]+)(, (int|struct [A-Za-z_0-9]+))*\)'/u
  const print = (n, prefix, last, depth, whole) => {
    const lead = prefix + (last ? "`-" : "|-")
    if (n === null) {
      if (whole || depth <= 1) out.push(`${lead}<<<NULL>>>`)
      return
    }
    let line = `${n.kind} ${n.addr}${n.prev ? ` prev ${n.prev}` : ""} ${range(n)}`
    if (n.nameTok) line += ` ${loc(n.nameTok)} ${n.after}`
    else if (n.rest) line += ` ${n.rest}`
    if (whole || depth <= 1) out.push(lead + line)
    n.kids.forEach((k, j) => print(k, prefix + (last ? "  " : "| "), j === n.kids.length - 1, depth + 1, whole))
  }
  tops.forEach((n, j) => print(n, "", j === tops.length - 1, 0, n.kind === "RecordDecl" || WHOLE.test(n.after)))
  return out.join("\n") + (out.length ? "\n" : "")
}

/* Отказ разбора — строка и причина, для отметки в редакторе. */
export function прочитатьC(исходник) {
  try {
    return { вход: дампC(исходник), строка: null, причина: "" }
  } catch (беда) {
    return { вход: "", строка: беда.строка ?? null, причина: беда.message }
  }
}

/* Запись `clang -Xclang -ast-dump`, отрезанная так же, как режет её план Demo
   (flang/foreign/c/run.fscript, «Dump filter»): только объявления главного
   файла, у функций не из int — одна верхняя строка с детьми. Нужна сверке
   разбора песочницы с clang: `--сверить-c`. */
export function отрезатьДампClang(дамп, главный) {
  const строки = []
  let держать = false
  let целиком = false
  let файл = ""
  for (const строка of String(дамп).split("\n")) {
    if (/^[|`]-/u.test(строка)) { держать = false; целиком = false }
    const место = /<[^<>, ]+\.[ch]:[0-9]+/u.exec(строка)
    if (место) файл = место[0].slice(1).replace(/:[0-9]+$/u, "")
    if (/^[|`]-FunctionDecl/u.test(строка)) {
      держать = файл === главный && !/ implicit /u.test(строка)
      целиком = /'int \((int|struct [A-Za-z_0-9]+)(, (int|struct [A-Za-z_0-9]+))*\)'/u.test(строка)
    }
    if (/^[|`]-RecordDecl/u.test(строка)) { держать = файл === главный; целиком = true }
    if (держать && (целиком || /^[|`]-/u.test(строка) || /^[| ] [|`]-/u.test(строка))) строки.push(строка)
  }
  return строки.length ? `${строки.join("\n")}\n` : ""
}

/* Две записи дерева равны, если отличаются только адресами узлов, пометками
   «used»/«referenced» и именем файла. Ответ — первая несовпавшая строка. */
export function сверитьДампы(наш, clang) {
  const ровно = (т) => String(т).replace(/0x[0-9a-f]+/gu, "0x").replace(/ (used|referenced)(?= )/gu, "").replace(/<[^<>:, ]+\.[ch]:/u, "<file:").split("\n")
  const а = ровно(наш)
  const б = ровно(clang)
  for (let н = 0; н < Math.max(а.length, б.length); н += 1) {
    if (а[н] !== б[н]) return { совпало: false, строк: б.length - 1, строка: н + 1, наш: а[н] ?? "", clang: б[н] ?? "" }
  }
  return { совпало: true, строк: б.length - 1 }
}

/* ── Переводчики с чужих языков ─────────────────────────────────────────────
   Один язык — одна строка: файл переводчика рядом с песочницей и чтение
   исходника в то, что переводчик принимает. Договор переводчика один:
   `translateForPage(вход)` отдаёт список функций { name, line, unit,
   refusals }, где `unit` — модуль на flang, а `refusals` — почему функция
   не переведена. Переведённое судит ядро, как любую программу. */
export const ПЕРЕВОДЧИКИ = Object.freeze({
  c: { файл: ПЕСОЧНИЦА_ФАЙЛЫ.переводC, прочитать: прочитатьC },
})

export const ПРЕДЕЛ_ШАГОВ = 3000000
export const ПРЕДЕЛ_ВРЕМЕНИ_МС = 120000

export const ПРЕДЕЛ_ССЫЛОК = 16
const ИМПОРТ_ИЗ = /((?:из|from)\s+")([^"\s]+)(")/gu
const этоСсылка = (место) => /^https?:\/\//u.test(место)

export async function разложитьСсылки(исходник, положить, достатьСсылку) {
  const места = new Map()
  const заметки = []
  const очередь = []
  const путьСсылки = (адрес) => {
    if (!места.has(адрес)) {
      if (места.size >= ПРЕДЕЛ_ССЫЛОК) return null
      места.set(адрес, `/links/${места.size + 1}.flang`)
      очередь.push(адрес)
    }
    return места.get(адрес)
  }
  const переписать = (текстМодуля, основа) =>
    текстМодуля.replace(ИМПОРТ_ИЗ, (всё, до, место, после) => {
      let адрес = null
      if (этоСсылка(место)) адрес = место
      else if (основа !== null) адрес = new URL(место, основа).href
      if (адрес === null) return всё
      const путь = путьСсылки(адрес)
      if (путь === null) {
        заметки.push(`FLANG_PLAYGROUND ссылка ${адрес} не скачана: песочница берёт не больше ${ПРЕДЕЛ_ССЫЛОК} модулей по ссылкам`)
        return всё
      }
      return `${до}${путь}${после}`
    })
  const главный = переписать(исходник, null)
  while (очередь.length > 0) {
    const адрес = очередь.shift()
    try {
      const скачанное = await достатьСсылку(адрес)
      положить(места.get(адрес), переписать(скачанное, адрес))
      заметки.push(`скачано по ссылке: ${адрес} — ${new TextEncoder().encode(скачанное).length} байт, лежит как ${места.get(адрес)}`)
    } catch (беда) {
      заметки.push(`FLANG_PLAYGROUND ссылка ${адрес} не скачана: ${текст(беда)} — узел должен отвечать браузеру (CORS)`)
    }
  }
  return { исходник: главный, заметки }
}

async function скачатьТекст(адрес) {
  const ответ = await fetch(адрес)
  if (!ответ.ok) throw new Error(`${ответ.status} ${ответ.statusText}`)
  return await ответ.text()
}

export function песочница({ достать, модульРассуждений, модульФормул, модульПеревода, достатьСсылку = скачатьТекст }) {
  const модули = new Map()
  let библиотека = null
  const модуль = (имя) => {
    if (!модули.has(имя)) модули.set(имя, Promise.resolve(достать(имя)).then((байты) => WebAssembly.compile(байты)))
    return модули.get(имя)
  }
  const книги = async () => {
    if (библиотека === null) библиотека = разобратьTar(new Uint8Array(await достать(ПЕСОЧНИЦА_ФАЙЛЫ.библиотека)))
    return библиотека
  }
  const прогнать = async (имя, доводы, файлы) =>
    запуститьWasi(await модуль(имя), { доводы, файлы, окружение: { LC_ALL: "C.UTF-8", FLANG_TMP: "/tmp", HOME: "/tmp", FLANG_MODULE_DIR: "/flang/stdlib:/flang/core" } })
  const файлыПрогона = async (путь, исходник) => {
    const файлы = файлыWasi({ ...(/использует|uses/u.test(исходник) ? await книги() : {}), "/tmp/.keep": "" })
    const ссылки = await разложитьСсылки(исходник, файлы.положить, достатьСсылку)
    файлы.положить(путь, ссылки.исходник)
    файлы.заметки = ссылки.заметки
    return файлы
  }
  const строкаКоманды = (доводы) => `$ ${доводы.join(" ")}`
  const хвостКода = (код) => (код === 0 ? [] : [`[код возврата ${код}]`])
  const формулы = async () => {
    try {
      return модульФормул ? await модульФормул() : null
    } catch {
      return null
    }
  }
  const сверить = async (файлы, путь, запись) => {
    const байтыЗаписи = файлы.прочитать(запись)
    if (байтыЗаписи === null || байтыЗаписи.length === 0) return { код: null, строки: ["запись доказательства не положена — сверщику сверять нечего"] }
    const доводы = ["сверщик", "--по-утверждениям", путь, запись]
    try {
      const сверка = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.сверщик, доводы, файлы)
      return { код: сверка.код, строки: [строкаКоманды(доводы), сверка.вывод.replace(/\n$/u, ""), ...хвостКода(сверка.код)] }
    } catch (беда) {
      return { код: null, строки: [строкаКоманды(доводы), `FLANG_PLAYGROUND сверщик не загружен: ${текст(беда)} — доказанное стоит на слове ядра`] }
    }
  }
  const напечататьФормулы = async (сказанное) => {
    const ф = await формулы()
    if (ф === null) return []
    return сказанное.map((с) => {
      let печать
      try {
        печать = ф.printForPage(JSON.stringify(с.узел))
      } catch (беда) {
        печать = { plain: "", tex: "", why: текст(беда) }
      }
      return { имя: с.имя, вид: с.вид, чья: с.чья, plain: печать.plain, tex: печать.tex, why: печать.why }
    })
  }
  const проверитьFlang = async (исходник) => {
    const путь = "/playground.flang"
    const запись = "/playground.record"
    const файлы = await файлыПрогона(путь, исходник)
    const доводы = ["flang", "check", путь, "--proof", "--json", "--записать", запись]
    const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, доводы, файлы)
    const строки = [...файлы.заметки, строкаКоманды(доводы), ответ.вывод.replace(/\n$/u, ""), ...хвостКода(ответ.код)]
    if (ответ.сбой !== null) строки.push(`ЛОВУШКА WebAssembly: ${текст(ответ.сбой)}`)
    const дерево = разобратьJson((await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, ["flang", "ast", путь], файлы)).стандартный)
    const ведомость = ведомостьИз(ответ.стандартный)
    const сверка = await сверить(файлы, путь, запись)
    return {
      код: ответ.код,
      сверщик: сверка.код,
      вывод: [...строки, ...сверка.строки].join("\n"),
      итог: ответ.код === 0 ? "проверено" : "не проверено",
      разбор: {
        ведомость,
        дерево,
        замечания: замечанияИз(ответ.ошибки),
        терминал: [...файлы.заметки, ответ.стандартный.split("\n").filter((с) => !с.startsWith("{")).join("\n"), ответ.ошибки].join("\n").trim(),
        сверка: { код: сверка.код, вывод: сверка.строки.slice(1).join("\n") },
        формулы: await напечататьФормулы(высказанное(ведомость, дерево)),
        ловушка: ответ.сбой === null ? null : текст(ответ.сбой),
      },
    }
  }
  /* Программа на flang за любым текстом песочницы: сам текст, перевод
     формулы или программа, в которую превратилось рассуждение. */
  const исходникFlang = async (текстПечати) => {
    const вид = await видТекста(текстПечати, модульРассуждений)
    if (какПрограмма(вид)) return { вид, текст: текстПечати }
    if (вид === "формула") {
      const ф = await формулы()
      if (ф === null) return { вид, отказ: "FLANG_PLAYGROUND переводчик формул не загружен" }
      const чтение = ф.readForPage(/\\/u.test(текстПечати) ? "latex" : "unicode", текстПечати.trim(), "формула")
      return чтение.code !== "" ? { вид, отказ: `${чтение.code} ${чтение.why}` } : { вид, текст: чтение.unit }
    }
    const р = await модульРассуждений()
    const чтение = (р.preparedReading ?? р.readText)(текстПечати)
    if (чтение.variant !== "Read") return { вид, отказ: ["FLANG_REASONING_TEXT текст не прочитан:", ...чтение.fields.faults].join("\n") }
    return { вид, текст: р.programOf(чтение.fields.words, чтение.fields.sentences) }
  }
  const напечататьFlang = async (исходник, слово, файл = "") => {
    const цель = ЦЕЛИ_ПЕЧАТИ.find((ц) => ц.цель === слово)
    if (цель === undefined) return { код: 2, цель: слово, итог: "сбой", вывод: `FLANG_PLAYGROUND цели «${слово}» нет: есть ${ЦЕЛИ_ПЕЧАТИ.map((ц) => ц.цель).join(", ")}`, файлы: [], рантайм: [], замечания: [] }
    const путь = файл === "" ? "/playground.flang" : файл
    const рантайм = цель.каталог ? `/runtime/${цель.каталог}` : "/runtime"
    const файлы = await файлыПрогона(путь.startsWith("/") ? путь : `/${путь}`, исходник)
    for (const имя of цель.рантайм) файлы.положить(`${рантайм}/${имя}`, ЗАГЛУШКА_РАНТАЙМА)
    const доводы = ["flang", "emit", путь, "--target", цель.цель, "--runtime", рантайм, "--out", "/out"]
    const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, доводы, файлы)
    const декодер = new TextDecoder()
    const напечатано = []
    const заглушки = []
    for (const [место, узел] of файлы.узлы) {
      if (!место.startsWith("/out/") || узел.тип !== "файл") continue
      const текстФайла = декодер.decode(узел.байты)
      if (текстФайла.includes(ЗАГЛУШКА_РАНТАЙМА.trim())) заглушки.push(место.slice(5))
      else напечатано.push({ путь: место.slice(5), текст: текстФайла })
    }
    напечатано.sort((а, б) => а.путь.localeCompare(б.путь))
    const строки = [...файлы.заметки, строкаКоманды(доводы), ответ.вывод.replace(/\n$/u, ""), ...хвостКода(ответ.код)]
    if (ответ.сбой !== null) строки.push(`ЛОВУШКА WebAssembly: ${текст(ответ.сбой)}`)
    return {
      код: ответ.код,
      цель: цель.цель,
      итог: ответ.код === 0 ? "напечатано" : "не напечатано",
      вывод: строки.join("\n"),
      файлы: напечатано,
      рантайм: заглушки.sort(),
      замечания: замечанияИз(ответ.ошибки),
    }
  }
  /* Контрпример ищет ядро: `flang check` пробует края типов и границы из
     «требует» (у перевода C это INT_MIN и INT_MAX каждого параметра) и
     отвечает кодом 1 со строкой «постусловие «…» функции «…» нарушено на входе
     … — посчитано вычислителем». Страница своих входов не перебирает, а берёт
     этот вход из ответа ядра. */
  const изОтветаЯдра = (вывод) => {
    const найдено = /постусловие «(.*?)» функции «[^»]*» нарушено на входе (.*?) — посчитано/u.exec(вывод)
    if (найдено === null) return []
    const входы = {}
    for (const пара of найдено[2].split(", ")) {
      const м = /^(.+?) = (.+)$/u.exec(пара)
      if (м !== null) входы[м[1]] = /^-?\d+(\.\d+)?$/u.test(м[2]) ? Number(м[2]) : м[2]
    }
    return [{ обещание: найдено[1], входы }]
  }
  const перевестиС = async (язык, исходник) => {
    const переводчик = ПЕРЕВОДЧИКИ[язык]
    if (переводчик === undefined) return { код: 2, итог: "сбой", вывод: `FLANG_PLAYGROUND переводчика с языка «${язык}» здесь нет`, функции: [] }
    const чтение = переводчик.прочитать(исходник)
    if (чтение.причина) return { код: 1, итог: "не прочитано", вывод: `FLANG_FOREIGN_READ строка ${чтение.строка}: ${чтение.причина}`, отказ: { строка: чтение.строка, причина: чтение.причина }, функции: [] }
    if (typeof модульПеревода !== "function") return { код: 2, итог: "сбой", вывод: "FLANG_PLAYGROUND переводчик не загружен", функции: [] }
    const м = await модульПеревода(переводчик.файл)
    const функции = []
    const строки = []
    for (const ф of м.translateForPage(чтение.вход)) {
      if (ф.refusals.length > 0) {
        функции.push({ имя: ф.name, строка: ф.line, отказы: [...ф.refusals], исходник: "", код: 1 })
        строки.push(`── ${ф.name}: не переведена ──`, ...ф.refusals)
        continue
      }
      const итог = await проверитьFlang(ф.unit)
      const контрпримеры = итог.код === 1 ? изОтветаЯдра(итог.вывод) : []
      функции.push({ имя: ф.name, строка: ф.line, отказы: [], исходник: ф.unit, код: контрпримеры.length ? 1 : итог.код, итог: контрпримеры.length ? "опровергнуто" : итог.итог, сверщик: итог.сверщик, разбор: итог.разбор, контрпримеры })
      строки.push(`── ${ф.name} ──`, ф.unit.replace(/\n$/u, ""), итог.вывод)
      for (const к of контрпримеры) {
        строки.push(`контрпример: ${Object.entries(к.входы).map(([имяВхода, значение]) => `«${имяВхода}» = ${значение}`).join(", ")} — нарушено «${к.обещание}»`)
      }
    }
    if (функции.length === 0) строки.push("в тексте нет определений функций")
    const коды = функции.map((ф) => ф.код)
    const код = функции.length === 0 ? 1 : коды.includes(1) ? 1 : коды.includes(3) ? 3 : коды.includes(2) ? 2 : 0
    const опровергнуто = функции.some((ф) => (ф.контрпримеры ?? []).length > 0)
    return { код, итог: { 0: "переведено и проверено", 1: опровергнуто ? "найден контрпример" : "переведено не всё", 2: "проверено не всё", 3: "переведено, не всё доказано" }[код], вывод: строки.join("\n"), функции }
  }
  const проверитьФормулу = async (запись) => {
    const ф = await формулы()
    const нотация = /\\/u.test(запись) ? "latex" : "unicode"
    if (ф === null) return { код: 2, вывод: "FLANG_PLAYGROUND переводчик формул не загружен", итог: "сбой", разбор: { формула: { нотация, запись, code: "FLANG_PLAYGROUND", why: "переводчик формул не загружен" } } }
    const чтение = ф.readForPage(нотация, запись.trim(), "формула")
    const формула = { нотация, запись: запись.trim(), code: чтение.code, why: чтение.why, plain: чтение.plain, tex: чтение.tex, unit: чтение.unit }
    if (чтение.code !== "") return { код: 1, вывод: `${чтение.code} ${чтение.why}`, итог: "формула не прочитана", разбор: { формула } }
    const итог = await проверитьFlang(чтение.unit)
    return { ...итог, вывод: [`перевод на flang:`, чтение.unit, итог.вывод].join("\n"), разбор: { ...итог.разбор, формула } }
  }
  const проверитьРассуждение = async (текстРассуждения) => {
    const р = await модульРассуждений()
    /* Свободный текст: словарь дополняет морфология, ошибку называет разбор формы,
       подсказки помечены как возможные (ADR-0167). Старый reasoning.js этих функций
       не знает — тогда текст читается как раньше. */
    const чтение = (р.preparedReading ?? р.readText)(текстРассуждения)
    const словами = (вывод) => (р.reasoningWords ? [р.reasoningWords("ru", текстРассуждения, вывод)] : [])
    const разбор = (вывод) => (р.reasoningJson ? JSON.parse(р.reasoningJson("ru", текстРассуждения, вывод)) : null)
    if (чтение.variant !== "Read") {
      const жалобы = ["текст не прочитан:", ...чтение.fields.faults, ...словами("")].join("\n")
      return { код: 1, вывод: `FLANG_REASONING_TEXT ${жалобы}`, итог: "текст не прочитан", разбор: { рассуждение: { прочитано: false, жалобы: [...чтение.fields.faults], проверка: разбор("") } } }
    }
    const { words, sentences } = чтение.fields
    const программа = р.programOf(words, sentences)
    const путь = "/reasoning.flang"
    const запись = "/reasoning.record"
    const файлы = файлыWasi({ "/tmp/.keep": "", [путь]: программа })
    const доводы = ["flang", "check", путь, "--proof", "--strict", "--записать", запись]
    const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, доводы, файлы)
    const приговор = р.verdictOf(words, sentences, ответ.вывод)
    const код = приговор.variant === "Follows" ? 0 : приговор.variant === "Does not follow" ? 1 : 3
    const слово = { 0: "", 1: "FLANG_REASONING_DOES_NOT_FOLLOW ", 3: "FLANG_REASONING_CANNOT_LOOK " }[код]
    const строки = [
      `${слово}${приговор.fields.report}`,
      ...словами(ответ.вывод),
      "",
      "── программа, которую судит ядро ──",
      программа.replace(/\n$/u, ""),
      "── ответ ядра ──",
      строкаКоманды(доводы),
      ответ.вывод.replace(/\n$/u, ""),
      ...хвостКода(ответ.код),
    ]
    if (ответ.сбой !== null) строки.push(`ЛОВУШКА WebAssembly: ${текст(ответ.сбой)}`)
    const сверка = await сверить(файлы, путь, запись)
    const вывод = р.conclusionSentence(sentences)
    return {
      код,
      сверщик: сверка.код,
      вывод: [...строки, ...сверка.строки].join("\n"),
      итог: { 0: "следует", 1: "не следует", 3: "не судимо" }[код],
      разбор: {
        рассуждение: {
          прочитано: true,
          приговор: приговор.variant,
          заключение: р.sentenceText(words, вывод),
          номер: вывод.number,
          номераПосылок: [...sentences].filter((с) => !с.concludes).map((с) => с.number),
          предложения: [...р.readBack(words, sentences)],
          контрпример: код === 1 ? р.counterexample(words, sentences) : "",
          программа,
          проверка: разбор(ответ.вывод),
        },
        терминал: ответ.вывод.trim(),
        замечания: код === 3 ? замечанияИз(ответ.вывод) : [],
        сверка: { код: сверка.код, вывод: сверка.строки.slice(1).join("\n") },
      },
    }
  }
  const КОМАНДЫ = ["check", "test", "run", "emit"]
  const имяФайла = (имя) => (/^[^/\\\s"']+\.flang$/u.test(String(имя ?? "")) ? String(имя) : "playground.flang")
  const доводыКоманды = (слово, файл, ключи) => {
    if (слово === "check") return ["flang", "check", файл, ...(ключи.доказательства ? ["--proof"] : [])]
    if (слово === "test") return ["flang", "test", файл, "--max-steps", String(ПРЕДЕЛ_ШАГОВ)]
    return [
      "flang", "run", файл, "--function", String(ключи.функция ?? ""),
      ...(ключи.доводы ? ["--args", String(ключи.доводы)] : []),
      ...(ключи.наВеру ? ["--trust"] : []),
      "--max-steps", String(ПРЕДЕЛ_ШАГОВ),
    ]
  }
  const оПределе = (вывод) =>
    вывод.includes(`исчерпала лимит шагов (${ПРЕДЕЛ_ШАГОВ})`)
      ? [`FLANG_PLAYGROUND песочница считает не больше ${ПРЕДЕЛ_ШАГОВ} шагов за прогон, чтобы вкладка не зависла; в терминале предел задаёт ключ --max-steps`]
      : []
  const исполнитьКоманду = async (исходник, слово, ключи) => {
    if (!КОМАНДЫ.includes(слово)) return { код: 2, итог: "сбой", вывод: `FLANG_PLAYGROUND команды «${слово}» в песочнице нет: есть ${КОМАНДЫ.join(", ")}`, замечания: [] }
    const файл = имяФайла(ключи.имя)
    if (слово === "emit") {
      const печать = await напечататьFlang(исходник, String(ключи.цель ?? ""), файл)
      return { ...печать, команда: `flang emit ${файл} --target ${ключи.цель ?? ""}` }
    }
    if (слово === "run" && !ключи.функция) return { код: 2, итог: "сбой", вывод: "FLANG_PLAYGROUND для run назовите функцию: поле «функция» над кнопками", замечания: [] }
    const файлы = await файлыПрогона(`/${файл}`, исходник)
    const доводы = доводыКоманды(слово, файл, ключи)
    const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, доводы, файлы)
    const строки = [...файлы.заметки, ответ.вывод.replace(/\n$/u, ""), ...оПределе(ответ.вывод)]
    if (ответ.сбой !== null) строки.push(`ЛОВУШКА WebAssembly: ${текст(ответ.сбой)} — прогону не хватило памяти или стека вкладки`)
    /* Таблице тестов страницы нужны имена, входы и ожидаемые значения — они в
       дереве разбора, а не в тексте ответа `flang test`. */
    const дерево = слово === "test" ? разобратьJson((await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, ["flang", "ast", `/${файл}`], файлы)).стандартный) : undefined
    return {
      код: ответ.код,
      итог: ответ.код === 0 ? "выполнено" : "не выполнено",
      команда: доводы.map((д) => (/[\s{"]/u.test(д) ? `'${д}'` : д)).join(" "),
      вывод: строки.join("\n"),
      стандартный: ответ.стандартный,
      замечания: замечанияИз(ответ.вывод),
      предел: оПределе(ответ.вывод).length > 0,
      ...(дерево === undefined ? {} : { дерево }),
    }
  }
  /* Файлы словаря скачиваются один раз на вкладку. */
  const файлыСловаря = new Map()
  const файлСловаря = (имя) => {
    if (!файлыСловаря.has(имя)) {
      файлыСловаря.set(имя, Promise.resolve()
        .then(() => достать(`${КАТАЛОГ_СЛОВАРЯ}${имя}`))
        .then((байты) => new TextDecoder().decode(байты))
        .catch(() => null))
    }
    return файлыСловаря.get(имя)
  }
  const отказСтатьи = (причина, начало) => ({ код: 2, итог: "не проверено", отказ: причина, вывод: `FLANG_PLAYGROUND ${причина}`, разбор: null, мс: Date.now() - начало })
  const проверитьСтатью = async (исходный, сообщить) => {
    const начало = Date.now()
    const статья = String(исходный).replace(/\r\n?/gu, "\n")
    const пределы = ПРЕДЕЛЫ_ТЕКСТА
    if (статья.trim() === "") return отказСтатьи("текст пуст: вставьте абзац или статью", начало)
    if (статья.length > пределы.знаков) return отказСтатьи(`текст длиннее ${пределы.знаков} знаков (в нём ${статья.length}): песочница проверяет абзац или короткую статью, длинную проверяет команда argue:article`, начало)
    const м = await модульПеревода(ПЕСОЧНИЦА_ФАЙЛЫ.статья)
    const предложения = [...м.sentencesForPage(статья)]
    if (предложения.length > пределы.предложений) return отказСтатьи(`в тексте ${предложения.length} предложений, а песочница берёт не больше ${пределы.предложений}: длинную статью проверяет команда argue:article`, начало)
    const мс = {}
    let метка = Date.now()
    const отметить = (имя) => {
      мс[имя] = Date.now() - метка
      метка = Date.now()
    }
    сообщить({ что: "словарь", сделано: 0, всего: 0 })
    let словарь
    try {
      словарь = await строкиСловаря(await модульПеревода(ПЕСОЧНИЦА_ФАЙЛЫ.словарьСлов), статья, файлСловаря)
    } catch (беда) {
      словарь = { строки: [], итог: `словарь не прочитан: ${текст(беда)}`, прочитано: 0, нет: 1 }
    }
    отметить("словарь")
    сообщить({ что: "разбор", сделано: 0, всего: предложения.length })
    const чтение = прочитатьБезПадений(м, статья, предложения, словарь.строки)
    отметить("разбор")
    let суд = { faults: [], jobs: [] }
    try {
      суд = м.judgmentForPage(статья, чтение.разметка)
    } catch (беда) {
      суд = { faults: [`черновик разметки не разобран: ${текст(беда)}`], jobs: [] }
    }
    const задания = [...суд.jobs]
    const взято = задания.slice(0, пределы.заданий)
    const доказано = []
    let решено = 0
    for (const задание of взято) {
      if (Date.now() - начало > пределы.мс) break
      сообщить({ что: "ядро", сделано: решено, всего: взято.length })
      const файлы = файлыWasi({ "/tmp/.keep": "", "/step.flang": задание.program })
      const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, ["flang", "check", "/step.flang", "--proof", "--strict"], файлы)
      if (м.provenByKernel(ответ.код, ответ.вывод)) доказано.push(`${задание.role}\t${задание.id}`)
      решено += 1
    }
    отметить("ядро")
    const отчёт = м.reportForPage(статья, чтение.разметка, доказано)
    отметить("отчёт")
    const виды = (с) => чтение.предложения.filter((п) => п.состояние === с).length
    const покрытие = { всего: предложения.length, прочитано: виды("read"), частично: виды("partly"), нет: виды("unread"), сбой: виды("error") }
    const находок = Number(отчёт.findings)
    const код = [...суд.faults].length > 0 ? 2 : находок > 0 ? 1 : 0
    return {
      код,
      вид: "статья",
      итог: код === 2 ? "не проверено" : находок > 0 ? "есть находки" : "находок нет",
      вывод: [`прочитано предложений: ${покрытие.прочитано} из ${покрытие.всего}`, словарь.итог.trim(), ...суд.faults, "── черновик разметки ──", чтение.разметка, "── отчёт ──", String(отчёт.text)].join("\n"),
      разбор: {
        статья: {
          предложения: чтение.предложения,
          покрытие,
          разметка: чтение.разметка,
          отчёт: String(отчёт.text),
          находок,
          шагов: Number(отчёт.steps),
          следует: Number(отчёт.follows),
          неСледует: Number(отчёт.fails),
          неРешено: Number(отчёт.undecided),
          заданий: задания.length,
          решено,
          ошибкиРазметки: [...суд.faults],
          словарь: { строк: словарь.строки.length, файлов: словарь.прочитано, нет: словарь.нет, итог: словарь.итог.trim() },
          мс,
        },
      },
      мс: Date.now() - начало,
    }
  }
  let версияКомпилятора = null
  const узнатьВерсию = async () => {
    if (версияКомпилятора === null) {
      const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, ["flang", "--version"], файлыWasi({ "/tmp/.keep": "" }))
      версияКомпилятора = (/^flang (\S+)/u.exec(ответ.вывод) ?? [null, ""])[1]
    }
    return версияКомпилятора
  }
  return {
    async версия() {
      return { код: 0, версия: await узнатьВерсию() }
    },
    async команда(текстКоманды, слово, ключи = {}) {
      const начало = Date.now()
      const вид = await видТекста(текстКоманды, модульРассуждений)
      if (!какПрограмма(вид)) return { код: 2, итог: "сбой", вид, вывод: `FLANG_PLAYGROUND команда «${слово}» работает с программой на flang (первая строка — «модуль …»), а в редакторе ${вид}`, замечания: [], мс: Date.now() - начало }
      return { ...(await исполнитьКоманду(текстКоманды, String(слово), ключи)), вид, мс: Date.now() - начало }
    },
    async проверить(текстПроверки) {
      const начало = Date.now()
      const вид = await видТекста(текстПроверки, модульРассуждений)
      const итог =
        какПрограмма(вид) ? await проверитьFlang(текстПроверки)
        : вид === "формула" ? await проверитьФормулу(текстПроверки)
        : await проверитьРассуждение(текстПроверки)
      return { ...итог, вид, мс: Date.now() - начало }
    },
    /* Дерево разбора программы без проверки: страница берёт из него первую
       функцию и аргументы её первого примера, когда поля запуска пусты. */
    async дерево(текстДерева) {
      const вид = await видТекста(текстДерева, модульРассуждений)
      if (!какПрограмма(вид)) return { код: 2, вид, дерево: null }
      const файлы = await файлыПрогона("/playground.flang", текстДерева)
      const ответ = await прогнать(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор, ["flang", "ast", "/playground.flang"], файлы)
      return { код: ответ.код, вид, дерево: разобратьJson(ответ.стандартный) }
    },
    /* Имена модулей библиотеки — для подсказки о модуле, названном не так. */
    async модули() {
      const имена = []
      for (const [, байты] of Object.entries(await книги())) {
        const шапка = /^\s*(?:модуль|module)\s+«([^»]+)»/mu.exec(typeof байты === "string" ? байты : new TextDecoder().decode(байты.subarray(0, 4096)))
        if (шапка !== null) имена.push(шапка[1])
      }
      return { код: 0, модули: имена.sort() }
    },
    /* Вид текста для подсветки редактора: тот же ответ, что выбирает проверку. */
    async вид(текстВида) {
      return { код: 0, вид: await видТекста(текстВида, модульРассуждений) }
    },
    /* Скачать и собрать оба модуля заранее, пока человек пишет текст. */
    async прогреть() {
      const начало = Date.now()
      await Promise.all([модуль(ПЕСОЧНИЦА_ФАЙЛЫ.компилятор), модуль(ПЕСОЧНИЦА_ФАЙЛЫ.сверщик)])
      return { код: 0, итог: "готово", версия: await узнатьВерсию(), мс: Date.now() - начало }
    },
    async напечатать(текстПечати, цель) {
      const начало = Date.now()
      const исходник = await исходникFlang(текстПечати)
      if (исходник.отказ) return { код: 1, цель, итог: "не прочитано", вывод: исходник.отказ, файлы: [], рантайм: [], замечания: [], мс: Date.now() - начало }
      return { ...(await напечататьFlang(исходник.текст, цель)), вид: исходник.вид, исходник: исходник.текст, мс: Date.now() - начало }
    },
    /* Свой текст на русском: что прочитала грамматика и что сказало ядро. */
    async статья(текстСтатьи, сообщить = () => {}) {
      return проверитьСтатью(String(текстСтатьи), сообщить)
    },
    async перевести(язык, текстПеревода) {
      const начало = Date.now()
      return { ...(await перевестиС(язык, String(текстПеревода))), язык, мс: Date.now() - начало }
    },
  }
}

/* Скачивание кусками: странице сообщается, сколько байт уже пришло, — первый
   прогон качает компилятор, и без этого вкладка молчала бы несколько секунд. */
async function скачать(адрес, имя, сообщить) {
  const ответ = await fetch(адрес)
  if (!ответ.ok) throw new Error(`${имя}: ${ответ.status} ${ответ.statusText}`)
  if (typeof сообщить !== "function" || ответ.body === null || typeof ответ.body.getReader !== "function") return new Uint8Array(await ответ.arrayBuffer())
  const сжато = ответ.headers.get("content-encoding")
  const длина = сжато ? 0 : Number(ответ.headers.get("content-length") ?? 0)
  const читатель = ответ.body.getReader()
  const куски = []
  let байт = 0
  let сказано = 0
  for (;;) {
    const { done, value } = await читатель.read()
    if (done) break
    куски.push(value)
    байт += value.length
    if (байт - сказано >= 1 << 20) {
      сказано = байт
      сообщить({ файл: имя, байт, всего: длина })
    }
  }
  const всё = new Uint8Array(байт)
  let место = 0
  for (const кусок of куски) {
    всё.set(кусок, место)
    место += кусок.length
  }
  сообщить({ файл: имя, байт, всего: длина || байт, готово: true })
  return всё
}

function песочницаПоАдресу(база, сообщить) {
  return песочница({
    достать: (имя) => скачать(new URL(имя, база), имя, сообщить),
    модульРассуждений: () => import(new URL(ПЕСОЧНИЦА_ФАЙЛЫ.рассуждения, база).href),
    модульФормул: () => import(new URL(ПЕСОЧНИЦА_ФАЙЛЫ.формулы, база).href),
    модульПеревода: (файл) => import(new URL(файл, база).href),
  })
}

export function рабочийПрогонов(достать = (адрес) => fetch(адрес).then((ответ) => (ответ.ok ? ответ.arrayBuffer() : Promise.reject(new Error(`программа «${адрес}» не скачана: ответ ${ответ.status}`))))) {
  const модули = new Map()
  let свои = файлыWasi()
  return async (заказ) => {
    try {
      if (заказ.целиком) свои = файлыWasi()
      for (const путь of заказ.убрать) свои.узлы.delete(путь)
      for (const [путь, байты] of заказ.файлы) {
        if (байты === null) завестиКаталог(свои.узлы, путь)
        else свои.положить(путь, байты)
      }
      const было = new Map([...свои.узлы].map(([путь, узел]) => [путь, узел.байты ?? null]))
      if (!модули.has(заказ.адрес)) модули.set(заказ.адрес, await WebAssembly.compile(await достать(заказ.адрес)))
      const ответ = запуститьWasi(модули.get(заказ.адрес), { доводы: заказ.доводы, окружение: заказ.окружение, файлы: свои, вход: заказ.вход })
      const файлы = [...свои.узлы].filter(([путь, узел]) => было.get(путь) !== (узел.байты ?? null)).map(([путь, узел]) => [путь, узел.байты ?? null])
      const убрано = [...было.keys()].filter((путь) => !свои.узлы.has(путь))
      return { прогон: true, код: ответ.код, сбой: ответ.сбой === null ? null : текст(ответ.сбой), стандартный: ответ.стандартный, ошибки: ответ.ошибки, файлы, убрано }
    } catch (беда) {
      return { прогон: true, отказ: текст(беда) }
    }
  }
}

function завестиПоток() {
  const песочницы = new Map()
  const прогоны = рабочийПрогонов()
  globalThis.addEventListener("message", async (событие) => {
    if (событие.data?.прогон !== undefined) return globalThis.postMessage(await прогоны(событие.data.прогон))
    const { номер, текст: текстПроверки, база, действие, цель, язык, команда, ключи } = событие.data ?? {}
    try {
      if (!песочницы.has(база)) песочницы.set(база, песочницаПоАдресу(база, (прогресс) => globalThis.postMessage({ прогресс })))
      const п = песочницы.get(база)
      const вход = String(текстПроверки ?? "")
      const итог =
        действие === "прогреть" ? await п.прогреть()
        : действие === "вид" ? await п.вид(вход)
        : действие === "дерево" ? await п.дерево(вход)
        : действие === "напечатать" ? await п.напечатать(вход, String(цель ?? ""))
        : действие === "перевести" ? await п.перевести(String(язык ?? ""), вход)
        : действие === "версия" ? await п.версия()
        : действие === "команда" ? await п.команда(вход, String(команда ?? ""), ключи ?? {})
        : действие === "статья" ? await п.статья(вход, (ход) => globalThis.postMessage({ номер, ход }))
        : await п.проверить(вход)
      globalThis.postMessage({ номер, ...итог })
    } catch (беда) {
      globalThis.postMessage({ номер, код: 2, итог: "сбой", вывод: `FLANG_PLAYGROUND ${текст(беда)}` })
    }
  })
}

/* ── Проверка страницы песочницы ──────────────────────────────────────────────
   `playground.js` делится на чистую часть (ответ компилятора → заголовок,
   сообщения, отметки строк, строки таблиц) и часть, которая рисует. Чистую
   исполняет и Node: здесь через неё идут настоящие ответы компилятора — те же,
   что получает вкладка. Проверка краснеет, когда чистая часть бросает
   исключение, отдаёт пустой заголовок или оставляет слово ожидания
   («проверяю…», «считаю…»): на странице это пустая панель справа.

   Что идёт через страницу: каждая стартовая программа × три кнопки; программа
   с несошедшимся тестом; ложное постусловие; опечатка в имени; пустой текст;
   программа с библиотекой; модуль библиотеки, названный по-русски; каждый
   сетап — по своей ссылке и через свою главную кнопку; прежние ссылки. */
const ПРОБЫ_СТРАНИЦЫ = Object.freeze({
  "несошедшийся тест": [
    "модуль «Проба волны»", "", "тотальная функция «Волна»", "  принимает л: список число", "  возвращает список число",
    "  пример «три подзадачи»", "    дано л равно [0, 1, 2]", "    ожидается [1, 0]", "  разбор л", "    случай пусто",
    "      то пустой список", "    случай голова и хвост",
    "      то (если голова не больше 0 то («Волна» от хвост) иначе приписать (голова минус 1) к («Волна» от хвост))", "",
  ].join("\n"),
  "ложное постусловие": [
    "модуль «Ложь»", "", "тотальная функция «Минус один»", "  принимает н: неотрицательное", "  возвращает число",
    "  обеспечивает «не меньше нуля» результат не меньше 0", "  н минус 1", "",
  ].join("\n"),
  "опечатка в имени": [
    "модуль «Привет»", "", "тотальная функция «Удвоить»", "  принимает н: неотрицательное", "  возвращает число", "  н плюс м", "",
  ].join("\n"),
  "пустой текст": "",
  "программа с библиотекой": [
    "модуль «Главный»", "использует «Lists»", "", "функция «Длина трёх»", "  возвращает число", "  пример «три»",
    "    ожидается 3", "  «Длина» от [1, 2, 3]", "",
  ].join("\n"),
  "модуль назван по-русски": [
    "модуль «Главный»", "использует «Списки»", "", "функция «Длина трёх»", "  возвращает число", "  «Длина» от [1, 2, 3]", "",
  ].join("\n"),
})

/* Свой текст: пример сетапа обязан прочитаться почти весь и дать две находки
   (вывод не следует, противоречие); у каждого непрочитанного предложения есть
   причина; пустой, слишком длинный текст и текст из многих предложений получают
   отказ, а не исключение; предложение, на котором грамматика падает, становится
   «не прочитано», а страница живёт. */
const ПРОБЫ_ТЕКСТА = Object.freeze([
  { имя: "абзац с непрочитанными", текст: "Курение вызывает рак лёгких. Мой дед курил всю жизнь. Следовательно, курение не вредно. Большинство врачей согласны с этим, поэтому спорить не о чем.", код: [0, 1] },
  { имя: "пустой текст", текст: "  \n", отказ: "текст пуст" },
  { имя: "длинный текст", текст: "Все киты дышат. ".repeat(400), отказ: "длиннее 6000 знаков" },
  { имя: "много предложений", текст: "Кит дышит. ".repeat(41), отказ: "не больше 40" },
])

async function проверитьСвойТекст(п, страница, имя, пример, ждать) {
  const заголовок = (ответ) => String(страница.argueView(ответ).title ?? "").trim()
  const начало = Date.now()
  const ответ = await п.статья(пример)
  const мс = Date.now() - начало
  const вид = страница.argueView(ответ)
  const ч = вид.numbers ?? {}
  const находки = вид.blocks.filter((б) => б.kind === "h3").map((б) => б.text)
  process.stdout.write(`${имя}, argue: код ${ответ.код} — ${заголовок(ответ)}; прочитано ${ч.read} из ${ч.sentences}, находок ${ч.findings}, ${мс} мс\n`)
  ждать(имя, ответ.код === 1, `пример: код ${ответ.код}, а в нём есть находки`)
  ждать(имя, ч.read >= ч.sentences - 1, `пример: прочитано ${ч.read} из ${ч.sentences}`)
  ждать(имя, находки.some((н) => н.includes("Вывод не следует")), `пример: нет находки «Вывод не следует»: ${JSON.stringify(находки)}`)
  ждать(имя, находки.some((н) => н.includes("Противоречие")), `пример: нет находки «Противоречие»: ${JSON.stringify(находки)}`)
  ждать(имя, вид.rows.every((р) => р.state === "read" || р.reasons.length > 0), "у непрочитанного предложения нет причины")
  ждать(имя, вид.rows.filter((р) => р.state === "read").every((р) => р.forms.length > 0), "у прочитанного предложения нет логической формы")
  for (const проба of ПРОБЫ_ТЕКСТА) {
    const свой = await п.статья(проба.текст).catch((беда) => ({ код: 9, вывод: текст(беда) }))
    const свойВид = страница.argueView(свой)
    process.stdout.write(`свой текст, ${проба.имя}: код ${свой.код} — ${заголовок(свой)}\n`)
    if (проба.отказ) {
      ждать(`свой текст, ${проба.имя}`, свой.код === 2 && String(свой.отказ ?? "").includes(проба.отказ), `ждали отказ «${проба.отказ}», а пришло: код ${свой.код}, ${свой.вывод}`)
      continue
    }
    ждать(`свой текст, ${проба.имя}`, проба.код.includes(свой.код), `код ${свой.код}: ${свой.вывод}`)
    ждать(`свой текст, ${проба.имя}`, свойВид.rows.every((р) => р.state === "read" || р.reasons.length > 0), "у непрочитанного предложения нет причины")
  }
}

async function проверитьСтраницу(п, файл, pathToFileURL) {
  await import(pathToFileURL(файл).href)
  const страница = globalThis.флангСтраница
  if (!страница) {
    process.stdout.write(`${файл}: чистая часть страницы не объявлена (нет globalThis.флангСтраница)\n`)
    return 1
  }
  const слова = страница.useWords("ru")
  const ожидание = [слова.checking, слова.running, слова.emitting, слова.translating]
  const беды = []
  let шагов = 0
  const спросить = {
    check: (текстПрограммы) => п.проверить(текстПрограммы),
    test: (текстПрограммы) => п.команда(текстПрограммы, "test", {}),
    run: async (текстПрограммы, вызов) => {
      const дерево = вызов ? null : (await п.дерево(текстПрограммы)).дерево
      const что = вызов ?? страница.callOf(дерево, текстПрограммы, "", "")
      return п.команда(текстПрограммы, "run", { функция: что.fn, доводы: что.args })
    },
    emit: (текстПрограммы) => п.напечатать(текстПрограммы, "c"),
  }
  /* Одна кнопка: ответ компилятора → вид страницы. Возвращает вид или null. */
  const нажать = async (имя, кнопка, текстПрограммы, вызов) => {
    шагов += 1
    try {
      const ответ = await спросить[кнопка](текстПрограммы, вызов)
      const вид = страница.present(кнопка, ответ, текстПрограммы)
      const заголовок = String(вид.title ?? "").trim()
      if (заголовок === "") беды.push(`${имя}, ${кнопка}: пустой заголовок — панель справа осталась бы пустой`)
      else if (ожидание.includes(заголовок)) беды.push(`${имя}, ${кнопка}: заголовок застыл на слове ожидания «${заголовок}»`)
      process.stdout.write(`${имя}, ${кнопка}: код ${ответ.код} — ${заголовок}\n`)
      return { ответ, вид }
    } catch (беда) {
      беды.push(`${имя}, ${кнопка}: исключение — ${текст(беда)}`)
      process.stdout.write(`${имя}, ${кнопка}: исключение — ${текст(беда)}\n`)
      return null
    }
  }
  const ждать = (имя, условие, чего) => {
    if (!условие) беды.push(`${имя}: ${чего}`)
  }
  for (const з of страница.starters) {
    const имя = `стартовая ${з.slug ?? з.key}`
    for (const кнопка of ["check", "test", "run"]) {
      const итог = await нажать(имя, кнопка, з.text, кнопка === "run" ? { fn: з.fn, args: з.args } : undefined)
      ждать(`${имя}, ${кнопка}`, итог === null || итог.ответ.код === 0, `код ${итог?.ответ.код}, а стартовая программа обязана проходить`)
    }
  }
  for (const [имя, текстПрограммы] of Object.entries(ПРОБЫ_СТРАНИЦЫ)) {
    for (const кнопка of ["check", "test", "run"]) await нажать(имя, кнопка, текстПрограммы)
  }
  /* Что именно обязана показать страница на известных ошибках. */
  const тест = await нажать("несошедшийся тест: строка теста", "check", ПРОБЫ_СТРАНИЦЫ["несошедшийся тест"])
  ждать("несошедшийся тест", тест?.вид.marks.some((м) => м.line === 6), "строка теста (6) не отмечена в редакторе")
  ждать("несошедшийся тест", тест?.вид.problems.length === 1, `сообщений ${тест?.вид.problems.length}, а должно быть одно`)
  const таблица = await нажать("несошедшийся тест: таблица", "test", ПРОБЫ_СТРАНИЦЫ["несошедшийся тест"])
  ждать("несошедшийся тест", таблица?.вид.tests.length === 1 && таблица.вид.tests[0].state === "failed" && таблица.вид.tests[0].got === "[0,1]", `в таблице тестов нет строки «не прошёл» с полученным [0,1]: ${JSON.stringify(таблица?.вид.tests)}`)
  const ложь = await нажать("ложное постусловие: панель", "check", ПРОБЫ_СТРАНИЦЫ["ложное постусловие"])
  ждать("ложное постусловие", ложь?.вид.rows.some((с) => с.state === "violated" && с.line === 6), "в панели доказательств нет опровергнутой строки со ссылкой на строку 6")
  const опечатка = await нажать("опечатка в имени: место", "check", ПРОБЫ_СТРАНИЦЫ["опечатка в имени"])
  const место = опечатка?.вид.problems[0]
  ждать("опечатка в имени", опечатка?.вид.problems.length === 1, `сообщений ${опечатка?.вид.problems.length}, а должно быть одно`)
  ждать("опечатка в имени", место?.code === "FLANG_UNKNOWN_NAME" && место.line === 6 && место.column === 10, `нет кода, строки и столбца ошибки: ${JSON.stringify(место)}`)
  ждать("опечатка в имени", JSON.stringify(страница.wordAt("  н плюс м", место?.column)) === "[9,10]", "подчёркнуто не слово «м»")
  const модули = (await п.модули()).модули
  const подсказка = страница.libraryHint(ПРОБЫ_СТРАНИЦЫ["модуль назван по-русски"], модули)
  ждать("модуль назван по-русски", подсказка?.similar.includes("Lists"), `подсказка не называет модуль «Lists»: ${JSON.stringify(подсказка)}`)
  ждать("программа с библиотекой", страница.libraryHint(ПРОБЫ_СТРАНИЦЫ["программа с библиотекой"], модули) === null, "подсказка о модуле показана для существующего модуля")
  const сБиблиотекой = await нажать("программа с библиотекой: проходит", "check", ПРОБЫ_СТРАНИЦЫ["программа с библиотекой"])
  ждать("программа с библиотекой", сБиблиотекой?.ответ.код === 0, `код ${сБиблиотекой?.ответ.код}`)
  /* Сетапы: открывается по своей ссылке, стартовая программа проходит главную кнопку. */
  for (const с of страница.setups) {
    const имя = `сетап ${с.key}`
    const план = страница.planOf(страница.addressFields(`#setup=${с.key}`), null)
    ждать(имя, план?.setup === с.key, `ссылка #setup=${с.key} открывает «${план?.setup}»`)
    const стартовая = страница.setupText(с)
    шагов += 1
    try {
      if (с.enter === "argue") {
        await проверитьСвойТекст(п, страница, имя, стартовая, ждать)
        continue
      }
      if (с.enter === "translate") {
        const перевод = await п.перевести("c", стартовая)
        ждать(имя, перевод.код === 0 && перевод.функции.length > 0, `перевод с C: код ${перевод.код}`)
        process.stdout.write(`${имя}, translate: код ${перевод.код} — ${перевод.итог}\n`)
        continue
      }
      шагов -= 1
      const итог = await нажать(имя, с.enter, стартовая)
      ждать(имя, итог?.ответ.код === 0, `главная кнопка «${с.enter}»: код ${итог?.ответ.код}`)
      if (с.enter === "test") ждать(имя, итог?.вид.tests.length > 0 && итог.вид.tests.every((т) => т.state === "passed"), "таблица тестов пуста или в ней есть несошедшийся тест")
      if (с.key === "proof") ждать(имя, итог?.вид.rows.length > 0 && итог.вид.rows.every((р) => р.line > 0), "в панели доказательств нет строк со ссылкой на исходник")
    } catch (беда) {
      беды.push(`${имя}: исключение — ${текст(беда)}`)
    }
  }
  /* Прежние ссылки открываются там же, где раньше. */
  const ссылки = [
    ["#example=proof&do=check", null, "proof"], ["#example=proof", null, "proof"], ["#example=hello", null, "first"],
    ["#example=emit-c", null, "emit"], ["#code=x&do=run&fn=%D0%A3&args=%7B%7D", "модуль «А»", "first"], ["#code=x&do=test", "модуль «А»", "tests"],
    ["#code=x&do=emit&target=go", "модуль «А»", "emit"], ["#text=x&run", "модуль «А»", "proof"], ["#text=x", "Все люди смертны.", "reasoning"],
    ["#code=x", "∀ x ∈ ℤ, x = x", "formula"], ["#code=x", "модуль «А»", "first"],
  ]
  for (const [адрес, текстПрограммы, сетап] of ссылки) {
    const план = страница.planOf(страница.addressFields(адрес), текстПрограммы)
    ждать(`ссылка ${адрес}`, план?.setup === сетап, `открывает сетап «${план?.setup}», а должен «${сетап}»`)
  }
  for (const беда of беды) process.stdout.write(`ОШИБКА ${беда}\n`)
  process.stdout.write(`страница песочницы: шагов ${шагов}, ссылок ${ссылки.length + страница.setups.length}, ошибок ${беды.length}\n`)
  return беды.length === 0 ? 0 : 1
}

async function запуститьИзКоманднойСтроки() {
  const { pathToFileURL } = await import(["node:", "url"].join(""))
  if (process.argv[1] === undefined || pathToFileURL(process.argv[1]).href !== import.meta.url) return
  const { readFile } = await import(["node:", "fs/promises"].join(""))
  const [каталог, ...доводы] = process.argv.slice(2)
  /* Ключи до текста: «--json», «--на <цель>» (печать), «--из <язык>»
     (перевод во flang), «--сверить-c <файл C>» (разбор C песочницы против
     записи clang, которая идёт текстом), «--сверить-с <каталог>» (вместе с
     «--на»: файлы программы против печати двоичного компилятора в каталоге). */
  const ключи = {}
  let слова = доводы
  const ОДИНОЧНЫЕ = ["--json", "--версия", "--доказательства", "--на-веру", "--статья"]
  const ПАРНЫЕ = ["--на", "--из", "--сверить-c", "--сверить-с", "--команда", "--имя", "--функция", "--доводы", "--файл", "--заготовки", "--страница"]
  while (ОДИНОЧНЫЕ.includes(слова[0]) || (ПАРНЫЕ.includes(слова[0]) && слова.length > 1)) {
    if (ОДИНОЧНЫЕ.includes(слова[0])) {
      ключи[слова[0].slice(2)] = true
      слова = слова.slice(1)
    } else {
      ключи[слова[0].slice(2)] = слова[1]
      слова = слова.slice(2)
    }
  }
  const машинно = ключи.json === true
  if (ключи["файл"] !== undefined) слова = [await readFile(ключи["файл"], "utf8")]
  if (каталог === undefined || (слова.length === 0 && ключи["версия"] !== true && ключи["заготовки"] === undefined && ключи["страница"] === undefined)) {
    process.stderr.write("звать: node flang_host_browser.js <каталог песочницы> [--json] [--версия | --статья | --заготовки <playground.js> | --страница <playground.js> | --на <цель> | --из <язык> | --сверить-c <файл.c> | --команда check|test|run|emit [--имя файл.flang] [--функция имя] [--доводы json] [--доказательства] [--на-веру]] [--файл путь | <текст>]\n")
    process.exitCode = 2
    return
  }
  if (ключи["сверить-c"] !== undefined) {
    const главный = ключи["сверить-c"]
    const чтение = прочитатьC(await readFile(главный, "utf8"))
    const ответ = чтение.причина ? { совпало: false, строка: чтение.строка, наш: чтение.причина, clang: "" } : сверитьДампы(чтение.вход, отрезатьДампClang(слова.join(" "), главный))
    process.stdout.write(ответ.совпало ? `${главный}: разбор совпал с clang, строк ${ответ.строк}\n` : `${главный}: разбор разошёлся с clang в строке ${ответ.строка}\n  песочница: ${ответ.наш}\n  clang:     ${ответ.clang}\n`)
    process.exitCode = ответ.совпало ? 0 : 1
    return
  }
  const п = песочница({
    достать: (имя) => readFile(`${каталог}/${имя}`),
    модульРассуждений: () => import(pathToFileURL(`${каталог}/${ПЕСОЧНИЦА_ФАЙЛЫ.рассуждения}`).href),
    модульФормул: () => import(pathToFileURL(`${каталог}/${ПЕСОЧНИЦА_ФАЙЛЫ.формулы}`).href),
    модульПеревода: (файл) => import(pathToFileURL(`${каталог}/${файл}`).href),
  })
  const вход = слова.join(" ")
  if (ключи["заготовки"] !== undefined) {
    /* Каждая стартовая программа через три кнопки страницы: «Проверить»,
       «Тесты» и «Запустить». Счёт — по кнопкам: шесть программ дают 18. */
    await import(pathToFileURL(ключи["заготовки"]).href)
    const заготовки = globalThis.флангЗаготовки ?? []
    let всего = 0
    let прошло = 0
    for (const з of заготовки) {
      const проверка = await п.команда(з.text, "check", { доказательства: true })
      const тесты = await п.команда(з.text, "test", {})
      const запуск = await п.команда(з.text, "run", { функция: з.fn ?? "", доводы: з.args ?? "" })
      const печать = з.emit ? await п.напечатать(з.text, з.emit) : { код: 0 }
      const коды = [проверка.код, тесты.код, запуск.код]
      всего += коды.length
      прошло += коды.filter((код) => код === 0).length - (печать.код === 0 ? 0 : 1)
      process.stdout.write(`заготовка ${з.slug ?? з.key}: check --proof ${проверка.код}, test ${тесты.код}, run ${запуск.код}, emit ${з.emit ? печать.код : "—"}\n`)
      for (const ответ of [проверка, тесты, запуск, печать]) if (ответ.код !== 0) process.stdout.write(`${ответ.вывод}\n`)
    }
    process.stdout.write(`заготовок ${заготовки.length}: кнопок прошло ${прошло} из ${всего}\n`)
    process.exitCode = заготовки.length > 0 && прошло === всего ? 0 : 1
    return
  }
  if (ключи["страница"] !== undefined) {
    process.exitCode = await проверитьСтраницу(п, ключи["страница"], pathToFileURL)
    return
  }
  if (ключи["версия"] === true) {
    const { версия } = await п.версия()
    process.stdout.write(`${версия}\n`)
    process.exitCode = версия === "" ? 1 : 0
    return
  }
  const ключиКоманды = { имя: ключи["имя"], функция: ключи["функция"], доводы: ключи["доводы"], цель: ключи["на"], доказательства: ключи["доказательства"] === true, наВеру: ключи["на-веру"] === true }
  const работа =
    ключи["команда"] !== undefined ? п.команда(вход, ключи["команда"], ключиКоманды)
    : ключи["на"] !== undefined ? п.напечатать(вход, ключи["на"]).then((ответ) => ({ ...ответ, вывод: [ответ.вывод, ...ответ.файлы.map((ф) => `── ${ф.путь} ──\n${ф.текст.replace(/\n$/u, "")}`), ...(ответ.рантайм.length ? [`── рантайм, копируется как есть: ${ответ.рантайм.join(", ")}`] : [])].join("\n") }))
    : ключи["статья"] === true ? п.статья(вход)
    : ключи["из"] !== undefined ? п.перевести(ключи["из"], вход)
    : п.проверить(вход)
  const итог = await работа.catch((беда) => ({ код: 2, вид: "?", итог: "сбой", мс: 0, вывод: `FLANG_PLAYGROUND ${текст(беда)}` }))
  if (ключи["сверить-с"] !== undefined && ключи["на"] !== undefined && итог.код === 0) {
    const разные = []
    for (const файл of итог.файлы) {
      const родной = await readFile(`${ключи["сверить-с"]}/${файл.путь}`, "utf8").catch(() => null)
      if (родной !== файл.текст) разные.push(родной === null ? `${файл.путь}: у двоичного такого файла нет` : `${файл.путь}: текст разный`)
    }
    итог.вывод += разные.length
      ? `\nпечать разошлась с двоичным компилятором:\n${разные.join("\n")}`
      : `\nпечать совпала с двоичным компилятором: файлов программы ${итог.файлы.length}`
    if (разные.length) итог.код = 1
  }
  process.stdout.write(машинно ? `${JSON.stringify(итог)}\n` : `${итог.вывод}\n`)
  process.stderr.write(`песочница: ${итог.вид ?? итог.цель ?? итог.язык}, ${итог.итог}, ${итог.мс} мс\n`)
  process.exitCode = итог.код
}

if (typeof document !== "undefined") завестиИзРазметки()
else if (typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope) завестиПоток()
else if (typeof process !== "undefined" && Array.isArray(process.argv)) запуститьИзКоманднойСтроки()
