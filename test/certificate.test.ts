import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { canonicalJson, certify, verifyCertificate } from "../src/certificate.js"
import { compile } from "../src/parser.js"

describe("proof certificates", () => {
  it("strictly verifies evidence and a typed functor derivation", async () => {
    const source = await readFile(new URL("../../examples/socrates.fts", import.meta.url), "utf8")
    const context = JSON.parse(await readFile(new URL("../../examples/socrates.context.json", import.meta.url), "utf8"))
    const document = compile(source)
    const certificate = certify(document, context)

    assert.equal(certificate.status, "verified")
    assert.equal(certificate.conclusion.type, "Mortal")
    assert.deepEqual(certificate.steps.map((step) => step.rule), ["witness", "apply"])
    assert.equal(verifyCertificate(document, certificate, context).valid, true)
  })

  it("reproduces the published certificate fixture byte-for-byte as JSON data", async () => {
    const source = await readFile(new URL("../../examples/socrates.fts", import.meta.url), "utf8")
    const context = JSON.parse(await readFile(new URL("../../examples/socrates.context.json", import.meta.url), "utf8"))
    const fixture = JSON.parse(await readFile(new URL("../../examples/socrates.certificate.json", import.meta.url), "utf8"))
    assert.deepEqual(certify(compile(source), context), fixture)
  })

  it("marks evidence-free derivations as symbolic", async () => {
    const source = await readFile(new URL("../../examples/socrates.fts", import.meta.url), "utf8")
    const certificate = certify(compile(source))
    assert.equal(certificate.status, "symbolic")
    assert.match(certificate.assumptions.join("\n"), /symbolic witness/)
  })

  it("detects certificate tampering", async () => {
    const source = await readFile(new URL("../../examples/task-status.fts", import.meta.url), "utf8")
    const context = JSON.parse(await readFile(new URL("../../examples/task-status.context.json", import.meta.url), "utf8"))
    const document = compile(source)
    const certificate = certify(document, context)
    const tampered = { ...certificate, conclusion: { ...certificate.conclusion, type: "Other" } }
    assert.equal(verifyCertificate(document, tampered, context).valid, false)
  })

  it("rejects ill-typed functor application", () => {
    const document = compile(`
      category C {
        structure A { value: A }
        functor f: B -> C
        proposition apply f {
          witness A.value { value true }
        }
      }
    `)
    assert.throws(() => certify(document), /expected B, received A/)
  })

  it("canonicalizes object keys deterministically", () => {
    assert.equal(canonicalJson({ z: 1, a: { y: true, b: null } }), '{"a":{"b":null,"y":true},"z":1}')
  })
})
