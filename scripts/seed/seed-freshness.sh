#!/bin/sh
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec "$root/bootstrap/flang" io "$root/scripts/seed/seed-freshness.fscript" --plan Check --timeout 300000
