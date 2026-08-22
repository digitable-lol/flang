# Отзыв сертификата не проверяет ни один из двух рабочих путей, и включить проверку нельзя: OCSP-скрепку не отдаёт почти никто

Из пяти подделок с `badssl.com` четыре отвергаются, пятая проходит. Замер 22
августа 2026, обоими путями сразу.

| подделка | поручение наружу (curl) | свой клиент на OpenSSL (91 строка) |
|---|---|---|
| `expired.badssl.com` | отвергнут, «certificate has expired» | отвергнут, «certificate has expired» |
| `wrong.host.badssl.com` | отвергнут, «no alternative certificate subject name matches target hostname» | отвергнут, «hostname mismatch» |
| `self-signed.badssl.com` | отвергнут, «self-signed certificate» | отвергнут, «self-signed certificate» |
| `untrusted-root.badssl.com` | отвергнут, «self-signed certificate in certificate chain» | отвергнут, «self-signed certificate in certificate chain» |
| **`revoked.badssl.com`** | **ПРИНЯТ, код 200** | **ПРИНЯТ, код 0** |

**Это не свойство выбранного пути, а общая дыра обоих.** OpenSSL по умолчанию не
спрашивает ни OCSP, ни CRL, и curl поверх него — тоже.

## Почему нельзя просто включить

Ключ `--cert-status` требует **OCSP-скрепки** — ответа удостоверяющего центра,
который узел обязан приложить сам, к рукопожатию. Замер, три адреса:

```
curl --cert-status https://revoked.badssl.com/   → 91  No OCSP response received
curl --cert-status https://rosettacode.org/…     → 91  No OCSP response received
curl --cert-status https://api.github.com/       → 91  No OCSP response received
```

Скрепку не отдаёт **никто из трёх**, включая те два узла, куда ходить надо. То
есть ключ закрывает не дыру, а весь выход в сеть: с ним язык снова не умеет
`https`, только теперь молча похоже на «сеть сломалась».

## Что из этого следует

Проверка отзыва остаётся **названным долгом**, а не тихим упущением: она записана
в `--help` команды `flang io`, в шапке `io_https` и в ADR-0007. Тихо принять
отозванный сертификат — плохо; тихо принять его и не сказать об этом — хуже, и
вот этого не происходит.

Закрывать долг, когда он станет дорог, придётся не ключом, а списком отозванных
(CRLSet-подобным), который надо где-то держать и обновлять, — то есть новой
работой с новым источником правды, а не строкой в argv.

Связано: [[tls-na-flang-zakryt-ne-cenoy-a-otsutstviem-klyucha]],
[[cikl-porucheniy-prinadlezhit-hozyainu-a-ne-yazyku]]
