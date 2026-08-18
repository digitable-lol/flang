/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Сторож обещания «нужны только cc и make»: PATH, на котором Node недостижим.
 *
 * ── Зачем ───────────────────────────────────────────────────────────────────
 * scripts/build-release-c.mjs собирает напечатанный C, чтобы проверить: релиз
 * ставится без Node. До 18 августа 2026 он печатал «PATH без Node», а собирал с
 * `PATH: "/usr/bin:/bin:/usr/local/bin"` — и node лежит ровно в /usr/local/bin.
 * Проверено: на том PATH `command -v node` находит /usr/local/bin/node. Сторож
 * не поймал бы прокравшуюся зависимость никогда: начни напечатанный Makefile
 * звать node, сборка осталась бы зелёной.
 *
 * Само обещание при этом верное — архив v0.5.0 собран с `env -i PATH=/usr/bin:/bin`,
 * где Node нет. Врала охрана обещания, а не обещание. Поэтому чинится охрана.
 *
 * Прогоны здесь идут на подставных каталогах с пустышками вместо настоящих
 * `node`, `cc` и `make`: проверять отбор надо на том, чем управляешь, а не на
 * том, как сегодня устроена машина.
 *
 * Запуск:  node --test flang/test/node-free-path.test.mjs
 */
import assert from "node:assert/strict"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { nodeДостижим, путьБезNode } from "../../scripts/node-free-path.mjs"

/** Каталог с пустышками: имена те же, содержимое неважно — важен бит запуска. */
function каталогС(корень, имя, инструменты) {
  const место = join(корень, имя)
  mkdirSync(место, { recursive: true })
  for (const инструмент of инструменты) {
    const файл = join(место, инструмент)
    writeFileSync(файл, "#!/bin/sh\nexit 0\n")
    chmodSync(файл, 0o755)
  }
  return место
}

const наПробу = (дело) => {
  const корень = mkdtempSync(join(tmpdir(), "flang-node-free-"))
  try {
    return дело(корень)
  } finally {
    rmSync(корень, { recursive: true, force: true })
  }
}

test("каталог с node выбрасывается, соседний остаётся", () => {
  наПробу((корень) => {
    const сNode = каталогС(корень, "with-node", ["node"])
    const сИнструментами = каталогС(корень, "tools", ["cc", "make"])
    const итог = путьБезNode({ path: `${сNode}:${сИнструментами}`, запасные: [], нужны: ["cc", "make"] })

    assert.deepEqual(итог.выброшены, [сNode], `выброшены: ${итог.выброшены.join(", ")}`)
    assert.deepEqual(итог.оставлены, [сИнструментами], `оставлены: ${итог.оставлены.join(", ")}`)
    assert.equal(итог.годен, true, `не годен, причина: ${итог.почему}`)
    assert.equal(nodeДостижим(итог.путь), false, `node достижим на «${итог.путь}»`)
  })
})

test("«nodejs» считается за Node наравне с «node»", () => {
  наПробу((корень) => {
    const сNodejs = каталогС(корень, "debian", ["nodejs"])
    const чистый = каталогС(корень, "tools", ["cc", "make"])
    const итог = путьБезNode({ path: `${сNodejs}:${чистый}`, запасные: [], нужны: ["make"] })
    assert.deepEqual(итог.выброшены, [сNodejs], `выброшены: ${итог.выброшены.join(", ")}`)
  })
})

test("инструмент, лежащий в одном каталоге с node, даёт отказ с причиной", () => {
  наПробу((корень) => {
    /* Ровно случай macOS с Homebrew: node, make и компилятор в одном /opt/homebrew/bin.
       Выкинуть каталог нельзя — уйдёт make; оставить нельзя — останется node.
       Значит честного PATH без Node здесь не собрать, и это надо СКАЗАТЬ. */
    const всёВместе = каталогС(корень, "brew", ["node", "make", "cc"])
    const итог = путьБезNode({ path: всёВместе, запасные: [], нужны: ["make"] })

    assert.equal(итог.годен, false, "отбор счёл окружение годным, хотя make лежит рядом с node")
    assert.deepEqual(итог.пропали, ["make"], `пропали: ${итог.пропали.join(", ")}`)
    assert.match(
      итог.почему ?? "",
      /make.*node/su,
      `причина обязана назвать и инструмент, и node, а сказано: ${итог.почему}`,
    )
    assert.ok(
      итог.почему?.includes(всёВместе),
      `причина обязана назвать каталог ${всёВместе}, а сказано: ${итог.почему}`,
    )
  })
})

test("без Node нигде не выбрасывается ничего", () => {
  наПробу((корень) => {
    const первый = каталогС(корень, "a", ["cc"])
    const второй = каталогС(корень, "b", ["make"])
    const итог = путьБезNode({ path: `${первый}:${второй}`, запасные: [], нужны: ["cc", "make"] })

    assert.deepEqual(итог.выброшены, [], `зря выброшены: ${итог.выброшены.join(", ")}`)
    assert.deepEqual(итог.оставлены, [первый, второй], `оставлены: ${итог.оставлены.join(", ")}`)
    assert.equal(итог.годен, true, `не годен, причина: ${итог.почему}`)
  })
})

test("на собранном PATH node недостижим даже когда он рядом в исходном", () => {
  наПробу((корень) => {
    const сNode = каталогС(корень, "with-node", ["node", "curl"])
    const чистый = каталогС(корень, "tools", ["cc", "make"])
    const итог = путьБезNode({ path: `${чистый}:${сNode}`, запасные: [], нужны: ["make"] })
    assert.equal(
      nodeДостижим(итог.путь),
      false,
      `node остался достижим на «${итог.путь}» — отбор не сработал`,
    )
  })
})
