# Зачем нужен FTS и как его интегрировать

## Короткий ответ

FTS полезен, когда одна и та же предметная модель должна быть понятна человеку и одновременно использоваться несколькими программами: UI-генератором, backend-проверкой, документацией, CI, аудитом и ИИ-агентом.

Без FTS правило обычно размазано по TypeScript-интерфейсу, React-форме, backend-validator, документации и prompt агента. Эти копии постепенно расходятся. FTS даёт один версионируемый источник и канонический JSON-контракт.

## Что именно даёт FTS

### 1. Общая предметная модель

```fts
структура «Строка счёта» {
  номер: Строка
  сумма: Деньги
  «срок оплаты»: Дата
  просрочен: Просрочен
}
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

FTS не заменяет React, Node.js, DDD-агрегат, СУБД или универсальный proof assistant. Версия `fts-proof/1` строго проверяет witness и типовую композицию, но законы функторов пока остаются явно перечисленными предпосылками.

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
import { assertValid, compile } from "@digitable/fts/browser"

const document = assertValid(compile(source))
const form = document.structures.find(
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

Полный пример: [`FtsForm.tsx`](../examples/integrations/react/FtsForm.tsx).

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
  "source": "категория «Пример» { ... }",
  "context": {}
}
```

Реализация находится в [`service.mjs`](../examples/integrations/node/service.mjs) и [`http-server.mjs`](../examples/integrations/node/http-server.mjs).

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
