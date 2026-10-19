// Lo que propone el modelo para una frase, comprobado campo por campo. Aparte de ai.js para
// probarlo sin navegador (ai.js abre la identidad).
import { parseAmount } from './money.js'
import { isValidDay } from './dates.js'
import { FALLBACK } from './categories.js'
import { codeError } from './errors.js'

/**
 * Un importe que no se lee o es cero → `ai-no-amount`; un tipo desconocido → `ai-bad-answer`.
 * Una categoría que no existe o es del otro tipo pasa a la genérica de ese tipo, y una fecha
 * inválida a hoy: el usuario lo revisa en el formulario antes de guardar.
 */
export function checkMovement (answer, { today, categories }) {
  if (!answer || typeof answer !== 'object') throw codeError('ai-bad-answer', 'the model did not answer an object')
  let amount
  try {
    amount = Math.abs(parseAmount(answer.amount))
  } catch {
    throw codeError('ai-no-amount', `the model found no amount: ${JSON.stringify(answer.amount)}`)
  }
  if (!amount) throw codeError('ai-no-amount', 'the model found no amount')
  const type = answer.type === 'income' ? 'income' : answer.type === 'expense' ? 'expense' : null
  if (!type) throw codeError('ai-bad-answer', `the model answered an unknown type: ${JSON.stringify(answer.type)}`)
  const cat = categories.find((c) => c.key === answer.category)
  const category = cat && (cat.kind === type || cat.kind === 'both') ? cat.key : FALLBACK[type]
  const date = isValidDay(answer.date) ? answer.date : today
  const note = String(answer.note || '').trim().slice(0, 140)
  return { amount, type, category, note, date }
}
