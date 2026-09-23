# flang · concurrency — модель процессов

Код — в `flang/concurrency/`; остальная проза о нём — в `docs/flang/conc/`.

| что описано | где |
|---|---|
| надзор, ящик, запас витков, горячая замена | [`docs/flang/conc/RESILIENCE.md`](../conc/RESILIENCE.md) |
| узлы, связь, размещение | [`docs/flang/conc/DISTRIBUTED.md`](../conc/DISTRIBUTED.md) |
| сам язык процессов: `процесс`, `надзор`, поручения | [`docs/flang/conc/SPEC.md`](../conc/SPEC.md) |

## Что в каталоге

- `scheduler.flang`, `supervisor.flang`, `wire.flang`, `link.flang`, `hotswap-node.flang` — сама модель;
- `examples/` — исполняемые примеры; файлы с `-forged` — подделки: они ОБЯЗАНЫ быть отвергнуты,
  и код отказа обязан назвать причину (`FLANG_TYPE`, `FLANG_PROCESS`);
- `services/` — службы поверх модели;
- `bin/` — хозяин узла на языках целей печати;
- `bench/` — стенды замера; разбор каждого файла и числа — в задаче 5821 и `docs/tree-inventory.md`.

## Чем проверяется

- `flang check <файл> --быстро` — типы, тотальность, примеры;
- комментариев в `.flang` здесь нет и быть не должно — `scripts/guards/no-comments-guard.fscript`;
- ссылки — `scripts/guards/link-guard.fscript`, числа в прозе — `scripts/guards/prose-numbers-guard.sh`.
