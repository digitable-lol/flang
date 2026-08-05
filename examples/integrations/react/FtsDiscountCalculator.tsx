import { useMemo, useState } from "react"
import { assertValid, compile, executeUtility, testUtilities } from "@digitable-lol/fts/browser"

type Props = { source: string }

export function FtsDiscountCalculator({ source }: Props) {
  const document = useMemo(() => {
    const compiled = assertValid(compile(source))
    const tests = testUtilities(compiled)
    if (!tests.valid) throw new Error("FTS business examples failed")
    return compiled
  }, [source])
  const [amount, setAmount] = useState(20_000)
  const [loyal, setLoyal] = useState(true)
  const discount = executeUtility(document, "Рассчитать скидку", {
    сумма: amount,
    "постоянный клиент": loyal,
  })

  return (
    <section>
      <label>
        Сумма
        <input type="number" value={amount} onChange={(event) => setAmount(event.currentTarget.valueAsNumber)} />
      </label>
      <label>
        <input type="checkbox" checked={loyal} onChange={(event) => setLoyal(event.currentTarget.checked)} />
        Постоянный клиент
      </label>
      <output>Скидка: {String(discount)}</output>
    </section>
  )
}
