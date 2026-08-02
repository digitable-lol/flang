# Зачем нужен FTS и как его интегрировать

## Короткий ответ

FTS полезен, когда одна и та же предметная модель должна быть понятна человеку и одновременно использоваться несколькими программами: UI-генератором, backend-проверкой, документацией, CI, аудитом и ИИ-агентом.

Без FTS правило обычно размазано по TypeScript-интерфейсу, React-форме, backend-validator, документации и prompt агента. Эти копии постепенно расходятся. FTS даёт один версионируемый источник и канонический JSON-контракт.

Самый прямой сценарий версии 0.2 не требует писать отдельный генератор. Разработчик описывает чистую утилиту, правила и ожидаемые примеры, после чего FTS сам выполняет спецификацию и создаёт TypeScript с обычными тестами:

```bash
fts check discount.fts
fts test discount.fts
fts generate discount.fts --out generated
```

Полный рабочий цикл показан в [исполняемых утилитах](executable-utilities.ru.md).

## Что именно даёт FTS

### 1. Общая предметная модель

```fts
объект «Строка счёта»
  номер является строкой
  сумма является деньгами
  «срок оплаты» является датой
  просрочен является состоянием Просрочен
```

Из неё разные утилиты могут получить:

- поля формы или колонки таблицы;
- API-описание;
- документацию;
- Mermaid-граф;
- поисковый индекс;
- инструкции и tool input для агента.

FTS не навязывает конкретный UI framework или базу данных. Он стабилизирует семантический вход для генераторов.

### 2. Проверяемая граница бизнес-действия

Обычный boolean `canShip: true` не объясняет, к какой модели и какому снимку он относился. Сертификат FTS содержит digest модели и контекста, фактический witness, типовую цепочку, заключение и явные assumptions.

Это позволяет перед выполнением команды проверить:

- модель не изменилась;
- snapshot не подменён;
- нужное значение реально присутствует по однозначному пути;
- переходы применены в допустимом порядке;
- результат имеет ожидаемый доменный тип.

### 3. Единая граница для любых языков

Текст `.fts` всегда компилируется в обычный JSON `FtsDocument`. Поэтому реализовывать русский parser в каждом языке не нужно. Другие процессы используют один из трёх контрактов:

1. JSON CLI через stdin/stdout;
2. HTTP sidecar;
3. канонический JSON и опубликованные JSON Schema.

### 4. Безопаснее для ИИ-агентов

Агент может предложить модель или команду, но решение о выполнении принимает детерминированный verifier. Текстовое объяснение агента не считается доказательством.

## Чего FTS не даёт

FTS не заменяет React, Node.js, DDD-агрегат, СУБД или универсальный proof assistant. Версия `fts-proof/1` строго проверяет свидетельство и типовую композицию, но законы морфизмов пока остаются явно перечисленными предпосылками.

Если проекту нужна только одна статичная форма без генераторов, аудита и межъязыковой границы, FTS может быть лишним слоем.

## Архитектура интеграции

```text
                 model.fts
                     |
          compile -> FtsDocument JSON
             /            |             \
        React UI       Node.js API      Python/Go/Java
        generators     certify/verify   CLI или HTTP
             \            |             /
                  proof certificate
                         |
                  command / audit log
```

Компиляцию для отображения можно выполнять в браузере. Строгую сертификацию и принятие решения следует держать на доверенной серверной границе.

## React

Для браузера есть отдельный entrypoint без `node:crypto`:

```ts
import { assertValid, compile, objects } from "@digitable/fts/browser"

const document = assertValid(compile(source))
const form = objects(document).find(
  (item) => item.name === "Анкета клиента",
)
```

Далее React превращает `form.fields` в компоненты:

```tsx
{form.fields.map((field) => (
  <Field
    key={field.name}
    name={field.name}
    domainType={field.type}
    required={!field.type.includes("undefined")}
  />
))}
```

Полные примеры:

- [`FtsDiscountCalculator.tsx`](../examples/integrations/react/FtsDiscountCalculator.tsx) — самостоятельный React;
- [`DigitableFtsDiscountForm.tsx`](../examples/integrations/react/DigitableFtsDiscountForm.tsx) — общий `FtsForm` из `@digitable-lol/ui-components`.

Общий компонент принимает уже скомпилированный документ. Поэтому пакет компонентов не зависит от
парсера FTS, а приложение может получить документ как в браузере, так и от Node.js API.

В браузере доступны compile, validate, symbolic proof и visualization. `certify` и `assertVerified` намеренно отсутствуют в browser-entry: клиент нельзя считать доверенной границей принятия бизнес-решения.

## Node.js

Node.js может использовать полный API:

```ts
import { assertVerified, certify, compile } from "@digitable/fts"

const document = compile(source)
const certificate = certify(document, context)
const verification = assertVerified(document, certificate, context)

if (verification.status === "verified") {
  await commandBus.execute(command)
}
```

Для приложения на Express, Fastify, NestJS или чистом `node:http` это обычный service layer. Рабочий пример без зависимостей:

```bash
node examples/integrations/node/http-server.mjs
```

Эндпоинты:

- `POST /v1/compile`;
- `POST /v1/check`;
- `POST /v1/certify`;
- `POST /v1/verify`.

Тело запроса:

```json
{
  "source": "категория «Пример»\n\n  объект Данные\n    имя является строкой",
  "context": {}
}
```

Реализация общей FTS-границы находится в [`service.mjs`](../examples/integrations/node/service.mjs)
и [`http-server.mjs`](../examples/integrations/node/http-server.mjs). Конкретный расчёт скидки показан
в [`discount-cli.mjs`](../examples/integrations/node/discount-cli.mjs) и
[`discount-http-server.mjs`](../examples/integrations/node/discount-http-server.mjs).

## Python

Python может использовать JSON CLI без повторной реализации языка:

```python
import json
import subprocess

result = subprocess.run(
    ["fts", "certify", "model.fts", "--context", "context.json"],
    check=True,
    text=True,
    capture_output=True,
)
certificate = json.loads(result.stdout)
```

Рабочий цикл `certify -> verify`: [`verify_order.py`](../examples/integrations/python/verify_order.py).

Исполнение одной утилиты не требует Python SDK:

```bash
fts run discount.fts --utility "Рассчитать скидку" --input purchase.json
```

Полный пример: [`calculate_discount.py`](../examples/integrations/python/calculate_discount.py).

## Производительность

`npm run benchmark` отдельно измеряет компиляцию, валидацию, исполнение правил, генерацию TypeScript
и запуск предметных примеров. Базовый замер Apple M1 Max находится в
[`benchmarks/README.md`](../benchmarks/README.md). На модели с 1000 полями и 1000 правилами средняя
компиляция заняла 4,36 мс, валидация — 1,02 мс, а изолированная транспиляция сгенерированного
TypeScript — около 23 мс. Полную сборку React/Node.js и `tsc` всё равно нужно измерять отдельно в
конкретном приложении: там результат зависит от общего графа типов, bundler и кэша.

## Go, Java, C#, Elixir и другие языки

Есть два практичных варианта.

### CLI subprocess

Запустить `fts compile/check/certify/verify`, передать source или файл и прочитать JSON stdout. Неуспех имеет ненулевой exit code, диагностика также является JSON.

### HTTP sidecar

Запустить небольшой Node.js FTS-service рядом с приложением. Любой язык отправляет JSON по HTTP и получает canonical document или certificate. Это предпочтительно, когда вызовов много или приложение не должно управлять subprocess для каждого запроса.

Канонические схемы:

- [`document.schema.json`](../schema/document.schema.json);
- [`proof-certificate.schema.json`](../schema/proof-certificate.schema.json).

## Рекомендуемое разделение ответственности

| Слой | Ответственность |
|---|---|
| FTS source | Человекочитаемая предметная модель |
| Compiler | Канонический `FtsDocument` |
| UI generator | React/Vue-компоненты, layout, локализация |
| Domain service | Вычисление инвариантов агрегата |
| Certifier | Построение typed certificate по snapshot |
| Independent verifier | Повторная проверка перед действием |
| Audit log | Хранение source revision, context digest и certificate |

## Как использовать FTS на разных уровнях

### Junior-разработчик

Junior добавляет и уточняет конкретные предметные примеры:

- задаёт вход через `дано`;
- задаёт ожидаемый результат через `ожидается`;
- запускает `fts check` и `fts test`;
- видит расхождение как конкретный упавший бизнес-пример.

Практическая выгода: не нужно вручную повторять тот же сценарий в `.fts` и test framework.

### Middle-разработчик

Middle описывает исполняемые правила:

- определяет входной объект, выход и начальное значение;
- записывает последовательность `если` / `то`;
- запускает `fts generate --out generated`;
- подключает `ftsUtilities["Предметное имя"]` к приложению.

Практическая выгода: реализация и тесты получаются из одного предметного текста и не расходятся при изменении правил.

### Senior-разработчик

Senior определяет законы и границы генерации:

- формулирует свойства, которые должны выполняться для любого результата;
- отделяет чистое вычисление от сетевых вызовов, транзакций и репозиториев;
- решает, какие части можно генерировать детерминированно, а какие реализует человек или агент;
- использует сертификаты для команд, пересекающих доверенную границу.

Практическая выгода: предметные свойства проверяются одинаково в interpreter FTS, сгенерированном коде и CI.

### Lead или архитектор

Lead использует FTS как контракт платформы:

- задаёт версионирование canonical JSON и сертификатов;
- определяет trusted boundary между browser, certifier и verifier;
- организует аудит model revision + context digest + certificate;
- даёт другим командам и агентам SDK/CLI/MCP вместо доступа к внутреннему коду продукта;
- решает, где FTS оправдан, а где достаточно обычного `if` и JSON Schema.

Практическая выгода: frontend, backend, аналитические сервисы и агенты работают с одной семантической моделью.

## Разбор категории «Исполнение заказа»

- `категория «Исполнение заказа»` - только контекст от момента готовности заказа до команды отгрузки. Оплата или бухгалтерия могут быть другими категориями.
- `объект Заказ` - наблюдаемая форма данных в этом контексте.
- состояние `«Готов к отгрузке»` - типизированный факт, рассчитанный агрегатом.
- морфизм `«Готовый заказ можно отгрузить»` - бизнес-правило перехода от факта готовности к разрешению команды.
- теорема `«Заказ ЗК-7781 можно отгрузить»` - применение этого правила к конкретному snapshot.

Если всё это живёт в одном небольшом Node.js сервисе и никем больше не потребляется, код `if (order.ready) ship()` проще. FTS начинает окупаться, когда правило разделяют несколько систем, его использует агент, требуется аудит или нужно доказуемо связать решение с конкретным snapshot.

## Когда интеграция оправдана

FTS даёт наибольшую пользу, если выполняются хотя бы два-три условия:

- одну модель потребляют несколько утилит;
- frontend и backend написаны на разных языках;
- правила меняются и должны быть версионируемыми;
- действия агента требуют детерминированного допуска;
- нужно воспроизводимое объяснение решения;
- важен аудит конкретного snapshot;
- сторонние команды должны писать генераторы без доступа к внутреннему parser.

Если эти условия отсутствуют, обычного TypeScript-типа и JSON Schema часто достаточно.
