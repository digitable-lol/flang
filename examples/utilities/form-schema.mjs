import { fail, findStructure, label, loadDocument, write } from "./common.mjs"

try {
  const [modelFile, structureName] = process.argv.slice(2)
  const document = await loadDocument(modelFile)
  const structure = findStructure(document, structureName)

  write({
    kind: "form",
    id: `${document.category}.${structure.name}`,
    title: label(structure.name),
    fields: structure.fields.map((field) => ({
      name: field.name,
      label: label(field.name),
      control: controlFor(field.type),
      required: !field.type.includes("undefined"),
      domainType: field.type.replace(/\s*\|\s*undefined/g, ""),
    })),
  })
} catch (error) {
  fail(error)
}

function controlFor(type) {
  if (/Email/u.test(type)) return "email"
  if (/Телефон/u.test(type)) return "tel"
  if (/Date/u.test(type)) return "date"
  if (/Money|number/u.test(type)) return "number"
  if (/Согласие|boolean/u.test(type)) return "checkbox"
  if (/Тип|Статус|Валюта/u.test(type)) return "select"
  return "text"
}
