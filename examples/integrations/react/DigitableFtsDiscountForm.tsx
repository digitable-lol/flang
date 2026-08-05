import { useMemo, useState } from "react"
import { FtsForm, type FtsFormValue } from "@digitable-lol/ui-components"
import { assertValid, compile, executeUtility } from "@digitable-lol/fts/browser"

type Props = { source: string }

export function DigitableFtsDiscountForm({ source }: Props) {
  const document = useMemo(() => assertValid(compile(source)), [source])
  const [value, setValue] = useState<FtsFormValue>({ сумма: 20_000, "постоянный клиент": true })
  const [discount, setDiscount] = useState<number | null>(null)

  return (
    <section>
      <FtsForm
        document={document}
        objectName="Покупка"
        value={value}
        onChange={setValue}
        submitLabel="Рассчитать скидку"
        onSubmit={(input) => setDiscount(Number(executeUtility(document, "Рассчитать скидку", input)))}
      />
      {discount !== null && <output>Скидка: {discount}</output>}
    </section>
  )
}
