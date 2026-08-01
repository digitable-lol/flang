# FTS на прикладных примерах

Этот раздел показывает механику FTS на формах, таблицах и бизнес-правилах DDD. Все примеры исполняются и входят в автоматические тесты репозитория.

## Ментальная модель

У сценария есть три артефакта:

1. `.fts` описывает форму данных, типизированное правило и проверяемое утверждение;
2. JSON-контекст содержит конкретный снимок прикладных данных;
3. proof certificate связывает модель, контекст, шаги вывода и заключение дайджестами.

FTS не рисует интерфейс и не выполняет доменную команду сам. Утилита читает канонический `FtsDocument` и решает, что построить: форму, таблицу, документацию, валидатор, граф или command guard.

## 1. Классическая форма регистрации клиента

Модель [`customer-onboarding.fts`](../examples/real-world/customer-onboarding.fts):

```fts
category РегистрацияКлиента {
  structure АнкетаКлиента {
    ид: string
    полноеИмя: string
    электроннаяПочта: Email
    телефон?: Телефон
    типКлиента: ТипКлиента
    согласиеНаОбработку: СогласиеПолучено
  }

  functor согласиеРазрешаетРегистрацию: СогласиеПолучено -> РегистрацияРазрешена

  proposition apply согласиеРазрешаетРегистрацию {
    witness АнкетаКлиента.согласиеНаОбработку {
      value true
      path ["анкеты", { ид: "КЛ-1042" }, "согласиеНаОбработку"]
    }
  }
}
```

Утилита [`form-schema.mjs`](../examples/utilities/form-schema.mjs) читает структуру и переводит доменные типы в элементы формы:

```bash
npm run build
node examples/utilities/form-schema.mjs \
  examples/real-world/customer-onboarding.fts \
  АнкетаКлиента
```

Фрагмент результата:

```json
{
  "kind": "form",
  "id": "РегистрацияКлиента.АнкетаКлиента",
  "fields": [
    {
      "name": "электроннаяПочта",
      "label": "Электронная Почта",
      "control": "email",
      "required": true,
      "domainType": "Email"
    },
    {
      "name": "телефон",
      "control": "tel",
      "required": false,
      "domainType": "Телефон"
    }
  ]
}
```

Механика простая: `structure` является стабильным входом генератора. В production-утилите поверх него можно добавить каталог локализации, layout, маски ввода и дизайн-систему. Эти UI-настройки не должны менять доказательное ядро.

## 2. Код таблицы счетов

Модель [`invoices-table.fts`](../examples/real-world/invoices-table.fts) описывает строку реестра и правило эскалации просроченного счёта. Утилита [`table-columns.mjs`](../examples/utilities/table-columns.mjs) превращает поля в конфигурацию таблицы:

```bash
node examples/utilities/table-columns.mjs \
  examples/real-world/invoices-table.fts \
  СтрокаСчёта
```

```json
{
  "kind": "table",
  "id": "ДебиторскаяЗадолженность.СтрокаСчёта",
  "columns": [
    { "key": "номер", "header": "Номер", "align": "start", "format": "text" },
    { "key": "сумма", "header": "Сумма", "align": "end", "format": "number" },
    { "key": "просрочен", "header": "Просрочен", "align": "center", "format": "badge" }
  ]
}
```

Один и тот же `FtsDocument` можно использовать для React/Vue-таблицы, CSV-экспорта, SQL-проекции, документации API или настройки агента. Конкретная утилита импортирует публичный API, а не внутренние токены парсера:

```js
import { assertValid, compile } from "@digitable/fts"

const document = assertValid(compile(source))
const row = document.structures.find((item) => item.name === "СтрокаСчёта")
const columns = row.fields.map((field) => ({
  key: field.name,
  domainType: field.type,
}))
```

## 3. DDD: защита команды агрегата

В [`order-shipment.fts`](../examples/real-world/order-shipment.fts) агрегат `Заказ` публикует факт `готовКОтгрузке`. Доменный сервис вычисляет этот факт из оплаты, резерва, блокировок и других инвариантов. FTS проверяет конкретный snapshot и типизированный переход к команде:

```fts
functor готовностьРазрешаетКоманду: ГотовКОтгрузке -> ОтгрузитьЗаказРазрешено

proposition apply готовностьРазрешаетКоманду {
  witness Заказ.готовКОтгрузке {
    value true
    path ["заказы", { номер: "ЗК-7781" }, "готовКОтгрузке"]
  }
}
```

Запуск command guard:

```bash
node examples/utilities/command-guard.mjs \
  examples/real-world/order-shipment.fts \
  examples/real-world/order-shipment.context.json
```

```json
{
  "allowed": true,
  "command": "ОтгрузитьЗаказРазрешено",
  "proofTerm": "готовностьРазрешаетКоманду(witness(Заказ.готовКОтгрузке))",
  "assumptions": [
    "готовностьРазрешаетКоманду : ГотовКОтгрузке → ОтгрузитьЗаказРазрешено [functor.arrow]"
  ]
}
```

Критическая граница: FTS строго доказывает соответствие witness снимку данных, целостность цепочки типов и неизменность сертификата. Закон `готовностьРазрешаетКоманду` пока является явно записанной предпосылкой. Если нужно доказать сам расчёт `готовКОтгрузке`, его следует выразить отдельным проверяемым правилом или приложить сертификат нижнего уровня.

Для [`order-shipment.blocked.context.json`](../examples/real-world/order-shipment.blocked.context.json), где склад не подтвердил резерв, та же утилита возвращает `{"allowed": false, ...}` и команда не вызывается.

## 4. DDD: композиция политики

[`credit-limit.fts`](../examples/real-world/credit-limit.fts) демонстрирует цепочку:

```text
СкорингПройден
  -> РискПроверкаРазрешена
  -> ЛимитМожетБытьУстановлен
```

```fts
proposition compose {
  functors: ["скорингОткрываетРискПроверку", "рискПроверкаРазрешаетЛимит"]
  witness ЗаявкаНаЛимит.скорингПройден {
    value true
    path ["заявки", { номер: "ЛМ-205" }, "скорингПройден"]
  }
}
```

Если поменять порядок функторов или их доменные типы, `fts certify` отклонит цепочку. Если изменить snapshot после сертификации, `fts verify` отклонит digest.

## 5. Использование из TypeScript

```ts
import { assertVerified, certify, compile } from "@digitable/fts"

const document = compile(source)
const certificate = certify(document, context)
const verification = assertVerified(document, certificate, context)

if (verification.valid && verification.status === "verified") {
  await commandBus.execute(new ОтгрузитьЗаказ(context.номер))
}
```

Для независимой границы доверия producer и verifier лучше запускать в разных процессах или сервисах. CLI и MCP используют тот же канонический формат.

## 6. Русский язык

Поддерживается:

- русские имена категорий, структур, полей, функторов и типов;
- русские строки, комментарии, object keys, selectors и JSON paths;
- смешанные имена наподобие `клиентVIP`;
- NFC-нормализация идентификаторов;
- воспроизводимые SHA-256 digest для UTF-8 данных.

Ключевые слова FTS пока фиксированы на английском. Это сохраняет одну грамматику и позволяет русским и международным командам обмениваться моделями без трансляции синтаксиса. Диагностические коды стабильны, сообщения v0.1 пока английские; UI может локализовать их по `code`.

## 7. Что уже удобно, а чего пока не хватает

Уже подходит для генераторов форм и таблиц, схем API, документации, графов, DDD command guards, CI-проверок и агентных инструментов.

Для полноценного промышленного form/table DSL ещё нужны декларативные аннотации (`label`, `format`, `widget`, `enum`, `permissions`), импорты и версии моделей. Для более сильной бизнес-логики нужны конъюнкция нескольких witness, кванторы, арифметические предикаты и сертификаты законов функторов. Эти возможности лучше добавлять как расширения канонической модели, сохраняя малое проверяемое ядро.
