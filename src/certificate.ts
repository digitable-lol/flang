/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { createHash } from "node:crypto"
import { diagnosticError } from "./diagnostics.js"
import { resolvePath } from "./interpreter.js"
import type {
  ApplyProofStep,
  CertificateVerification,
  FtsDocument,
  FtsFunctor,
  FtsProofCertificate,
  FtsProposition,
  FtsValue,
  ProofCertificateStep,
  WitnessProofStep,
} from "./model.js"
import { builtinFunctors } from "./stdlib.js"
import { assertValid } from "./validate.js"

interface Derivation {
  type: string
  term: string
  verified: boolean
  assumptions: string[]
  steps: ProofCertificateStep[]
}

type CertificatePayload = Omit<FtsProofCertificate, "certificate_digest">

export function certify(input: FtsDocument, context?: unknown): FtsProofCertificate {
  const document = assertValid(input)
  const derivation =
    document.proposition === null
      ? { type: "⊤", term: "tt", verified: true, assumptions: [], steps: [] }
      : derive(document, document.proposition, context)

  const payload: CertificatePayload = {
    version: "fts-proof/1",
    category: document.category,
    status: derivation.verified ? "verified" : "symbolic",
    document_digest: digest(document),
    assumptions: [...new Set(derivation.assumptions)].sort(),
    steps: derivation.steps,
    conclusion: { type: derivation.type, term: derivation.term },
  }
  if (context !== undefined) payload.context_digest = digest(context)

  return { ...payload, certificate_digest: digest(payload) }
}

export function verifyCertificate(
  input: FtsDocument,
  certificate: FtsProofCertificate,
  context?: unknown,
): CertificateVerification {
  if (!certificate || certificate.version !== "fts-proof/1") {
    throw diagnosticError("FTS_CERTIFICATE_VERSION", "unsupported proof certificate version")
  }
  const expected = certify(input, context)
  const { certificate_digest: claimedDigest, ...submittedPayload } = certificate
  const actualDigest = digest(submittedPayload)
  return {
    valid: expected.certificate_digest === claimedDigest && actualDigest === claimedDigest,
    status: expected.status,
    expected_digest: expected.certificate_digest,
    actual_digest: actualDigest,
  }
}

export function assertVerified(
  input: FtsDocument,
  certificate: FtsProofCertificate,
  context?: unknown,
): CertificateVerification {
  const result = verifyCertificate(input, certificate, context)
  if (!result.valid) {
    throw diagnosticError("FTS_CERTIFICATE_MISMATCH", "proof certificate does not match the document and context")
  }
  if (result.status !== "verified") {
    throw diagnosticError("FTS_CERTIFICATE_SYMBOLIC", "proof is symbolic; provide complete witness context for strict verification")
  }
  return result
}

export function canonicalJson(value: unknown): string {
  return serializeCanonical(value)
}

export function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`
}

function derive(document: FtsDocument, proposition: FtsProposition, context: unknown): Derivation {
  switch (proposition.kind) {
    case "witness": {
      const structure = document.structures.find((item) => item.name === proposition.structure)!
      const field = structure.fields.find((item) => item.name === proposition.field)!
      const path = proposition.path ?? []
      let actual: unknown
      let verified = false
      if (context !== undefined && proposition.value !== undefined && path.length > 0) {
        const resolved = resolvePath(context, path)
        if (!resolved.found || !deepEqual(resolved.value, proposition.value)) {
          throw diagnosticError(
            "FTS_WITNESS_MISMATCH",
            `witness does not match context: expected ${JSON.stringify(proposition.value)}, got ${resolved.found ? JSON.stringify(resolved.value) : "<missing>"}`,
            { path: "$.proposition" },
          )
        }
        actual = resolved.value
        verified = true
      }

      const step: WitnessProofStep = {
        rule: "witness",
        structure: proposition.structure,
        field: proposition.field,
        type: field.type,
        path,
        verified,
      }
      if (proposition.value !== undefined) step.expected = proposition.value
      if (actual !== undefined) {
        step.actual = actual as FtsValue
        step.evidence_digest = digest({ path, expected: proposition.value, actual })
      }

      return {
        type: field.type,
        term: `witness(${proposition.structure}.${proposition.field})`,
        verified,
        assumptions: verified ? [] : [`symbolic witness ${proposition.structure}.${proposition.field} : ${field.type}`],
        steps: [step],
      }
    }
    case "apply": {
      const inner = derive(document, proposition.arg, context)
      return applyFunctor(document, proposition.functor, inner)
    }
    case "compose": {
      return proposition.functors.reduce(
        (current, functor) => applyFunctor(document, functor, current),
        derive(document, proposition.arg, context),
      )
    }
  }
}

function applyFunctor(document: FtsDocument, name: string, inner: Derivation): Derivation {
  const functor = findFunctor(document, name)
  if (inner.type !== functor.domain) {
    throw diagnosticError(
      "FTS_PROOF_TYPE_MISMATCH",
      `cannot apply '${name}': expected ${functor.domain}, received ${inner.type}`,
      { path: "$.proposition" },
    )
  }
  const law = functor.law ?? "declared"
  const step: ApplyProofStep = {
    rule: "apply",
    functor: functor.name,
    domain: functor.domain,
    codomain: functor.codomain,
    law,
  }
  return {
    type: functor.codomain,
    term: `${functor.name}(${inner.term})`,
    verified: inner.verified,
    assumptions: [...inner.assumptions, `${functor.name} : ${functor.domain} → ${functor.codomain} [${law}]`],
    steps: [...inner.steps, step],
  }
}

function findFunctor(document: FtsDocument, name: string): FtsFunctor {
  const functor = [...document.functors, ...builtinFunctors].find((item) => item.name === name)
  if (functor === undefined) throw diagnosticError("FTS_UNKNOWN_FUNCTOR", `unknown functor '${name}'`)
  return functor
}

function serializeCanonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw diagnosticError("FTS_CANONICAL_NUMBER", "canonical JSON requires finite numbers and rejects negative zero")
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(serializeCanonical).join(",")}]`
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort(compareUtf16)
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serializeCanonical(record[key])}`).join(",")}}`
  }
  throw diagnosticError("FTS_CANONICAL_VALUE", `unsupported canonical JSON value: ${typeof value}`)
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function deepEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}
