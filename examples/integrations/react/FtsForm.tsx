import { useMemo } from "react"
import { assertValid, compile } from "@digitable/fts/browser"

type Props = {
  source: string
  structure: string
  value: Record<string, unknown>
  onChange(next: Record<string, unknown>): void
}

export function FtsForm({ source, structure: structureName, value, onChange }: Props) {
  const structure = useMemo(() => {
    const document = assertValid(compile(source))
    const found = document.structures.find((item) => item.name === structureName)
    if (!found) throw new Error(`Структура «${structureName}» не найдена`)
    return found
  }, [source, structureName])

  return (
    <form>
      {structure.fields.map((field) => (
        <label key={field.name}>
          <span>{field.name}</span>
          <input
            name={field.name}
            type={controlFor(field.type)}
            required={!field.type.includes("undefined")}
            value={String(value[field.name] ?? "")}
            onChange={(event) => onChange({ ...value, [field.name]: event.currentTarget.value })}
          />
        </label>
      ))}
    </form>
  )
}

function controlFor(type: string) {
  if (type === "Email") return "email"
  if (type === "Телефон") return "tel"
  if (type === "Дата") return "date"
  if (type === "Деньги") return "number"
  return "text"
}
