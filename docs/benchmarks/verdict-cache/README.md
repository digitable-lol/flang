# flang · proof cache

**[Documentation](https://digitable-lol.github.io/flang/en/verdict-cache.html)** ·
**[Документация](https://digitable-lol.github.io/flang/verdict-cache.html)**

The proof cache (`FLANG_PROOF_CACHE`, [ADR-0080](../../adr/0080-a-proof-cache-remembers-pure-calls-across-runs.md))
is probed by `bootstrap/flang run-script proof-cache:forgery`
(`scripts/guards/proof-cache-forgeries.fscript`). `cache-probe.flang` is a
program with a call whose callee body decides the caller's promise.

Кеш доказательств (`FLANG_PROOF_CACHE`) проверяется подлогами
`bootstrap/flang run-script proof-cache:forgery`. `cache-probe.flang` — программа
с вызовом, где тело вызванной функции решает обещание вызывающей.
