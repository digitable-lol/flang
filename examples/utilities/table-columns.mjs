import { fail, findStructure, label, loadDocument, write } from "./common.mjs"

try {
  const [modelFile, structureName] = process.argv.slice(2)
  const document = await loadDocument(modelFile)
  const structure = findStructure(document, structureName)

  write({
    kind: "table",
    id: `${document.category}.${structure.name}`,
    columns: structure.fields.map((field) => ({
      key: field.name,
      header: label(field.name),
      ...presentationFor(field.type, field.name),
    })),
  })
} catch (error) {
  fail(error)
}

function presentationFor(type, name) {
  if (/Money|Деньги|number/u.test(type)) return { align: "end", format: "number" }
  if (/Date|Дата/u.test(type)) return { align: "start", format: "date" }
  if (/статус|просрочен/iu.test(name) || /Статус|Просрочен/u.test(type)) {
    return { align: "center", format: "badge" }
  }
  return { align: "start", format: "text" }
}
