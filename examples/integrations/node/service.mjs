import { assertVerified, certify, compile, validate } from "../../../dist/src/index.js"

export function execute(operation, payload) {
  if (!payload || typeof payload.source !== "string") throw new Error("source must contain FTS text")
  const document = compile(payload.source)

  switch (operation) {
    case "compile":
      return { document }
    case "check":
      return validate(document)
    case "certify":
      return { certificate: certify(document, payload.context) }
    case "verify": {
      if (!payload.certificate || typeof payload.certificate !== "object") {
        throw new Error("certificate must be an object")
      }
      return { verification: assertVerified(document, payload.certificate, payload.context) }
    }
    default:
      throw new Error(`unknown operation '${operation}'`)
  }
}
