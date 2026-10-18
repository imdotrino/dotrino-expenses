// El dinero son ENTEROS (centavos). Nunca float: 0.1 + 0.2 no da 0.3 y un resumen del mes
// que no cuadra por un centavo no se puede explicar. Se parsea al entrar y se formatea al pintar.
import { codeError } from './errors.js'

/**
 * '4.50' · '4,50' · '1.200,50' · '1,200.50' · '$ 12' → centavos (entero, positivo).
 * Un texto sin número, o con un número que no es un importe, lanza `bad-amount`.
 */
export function parseAmount (text) {
  const raw = String(text ?? '').trim().replace(/[^\d.,-]/g, '')
  if (!raw || raw === '-' ) throw codeError('bad-amount', `not an amount: ${JSON.stringify(text)}`)
  const negative = raw.startsWith('-')
  const digits = raw.replace(/^-/, '')
  // Qué separador es el decimal: el ÚLTIMO de los dos, si va seguido de 1 o 2 dígitos.
  // Con los dos presentes, el que aparece después es el decimal y el otro agrupa miles.
  let intPart = digits
  let fracPart = ''
  const m = digits.match(/^([\d.,]*?)([.,])(\d{1,2})$/)
  if (m) {
    intPart = m[1]
    fracPart = m[3]
  }
  intPart = intPart.replace(/[.,]/g, '')
  if (!/^\d*$/.test(intPart) || (intPart === '' && fracPart === '')) {
    throw codeError('bad-amount', `not an amount: ${JSON.stringify(text)}`)
  }
  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw codeError('bad-amount', `amount out of range: ${JSON.stringify(text)}`)
  return negative ? -cents : cents
}

/** Centavos → '4.50' (texto neutro, para inputs y CSV). */
export function toDecimal (cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Centavos → '$4.50' en el idioma activo. `currency` es un código ISO ('USD'). */
export function formatMoney (cents, { lang = 'es', currency = 'USD', signed = false } = {}) {
  const locale = lang === 'es' ? 'es-EC' : 'en-US'
  const text = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Math.abs(cents) / 100)
  if (!signed) return cents < 0 ? `-${text}` : text
  return cents < 0 ? `-${text}` : `+${text}`
}
