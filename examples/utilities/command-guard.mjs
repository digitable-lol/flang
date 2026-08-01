import { assertVerified, certify } from "../../dist/src/index.js"
import { loadDocument, loadJson, write } from "./common.mjs"

try {
  const [modelFile, contextFile] = process.argv.slice(2)
  const document = await loadDocument(modelFile)
  const context = await loadJson(contextFile)
  const certificate = certify(document, context)
  const verification = assertVerified(document, certificate, context)

  write({
    allowed: verification.valid && verification.status === "verified",
    command: certificate.conclusion.type,
    proofTerm: certificate.conclusion.term,
    assumptions: certificate.assumptions,
    certificateDigest: certificate.certificate_digest,
  })
} catch (error) {
  write({
    allowed: false,
    reason: error instanceof Error ? error.message : String(error),
  })
}
