// Un aviso del banco (correo) → un movimiento PROPUESTO, SIN IA (docs/DISENO.md §4, F4).
//
// Es el lector genérico: busca el importe de la operación (no el saldo), si entró o salió
// dinero, el comercio y la fecha. Lo que propone va a la bandeja «Por confirmar»; nunca al
// registro sin que el usuario lo vea. Con la llave de IA del usuario, el modelo lee el correo
// y esto sigue siendo lo que se usa sin llave o cuando el proveedor no contesta.
//
// Un aviso real que no se lee bien es un caso de prueba nuevo en test/mail.test.js, no un
// parche suelto.

import { parseAmount } from './money.js'
import { localDay, isValidDay } from './dates.js'
import { guessCategory } from './parse.js'
import { FALLBACK } from './categories.js'

// Un importe con su moneda delante o detrás: «USD 25,40», «$1.250,00», «US$ 8.5», «12.00 USD».
const AMOUNT = /(?:(?:US\s?\$|USD|\$)\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:USD|dólares|dolares))/gi

// Lo que hay justo antes del importe dice si es la operación o un saldo.
const NEAR_OPERATION = /\b(por|monto|valor|importe|total|de|consumo|compra|pago|retiro|transferencia|d[eé]bito|cr[eé]dito|acreditaci[oó]n|dep[oó]sito)\b[^\d]{0,25}$/i
const NEAR_BALANCE = /\b(saldo|cupo|disponible|l[ií]mite|contable|pendiente de pago|m[ií]nimo)\b[^\d]{0,30}$/i

const INCOME = /\b(recib(?:ido|ida|iste)|acreditad[oa]|acreditaci[oó]n|abono|dep[oó]sito|te transfiri[oó]|transferencia recibida|reembolso|devoluci[oó]n|n[oó]mina|sueldo|received|deposit|refund)\b/i
const EXPENSE = /\b(consumo|compra|pago|d[eé]bito|debitad[oa]|retiro|cargo|transferencia (?:enviada|realizada|exitosa)|avance|purchase|payment|withdrawal|charge)\b/i

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }

// Los bancos que se nombran solos en sus avisos. Solo para enseñarlo; no cambia cómo se lee.
const BANKS = [
  ['Pichincha', /pichincha/i],
  ['Produbanco', /produbanco/i],
  ['Banco Guayaquil', /banco\s*guayaquil|bancoguayaquil/i],
  ['Pacífico', /banco\s*del\s*pac[ií]fico|bancodelpacifico/i],
  ['Diners Club', /diners/i],
  ['Banco Internacional', /banco\s*internacional|bancointernacional/i],
  ['Bolivariano', /bolivariano/i],
  ['JEP', /\bjep\b/i],
]

/** Quita el HTML si el correo se pegó con él, y junta los espacios. */
export function mailText (raw) {
  return String(raw || '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function pickAmount (text) {
  let best = null
  for (const m of text.matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    let score = 0
    if (NEAR_OPERATION.test(before)) score += 2
    if (NEAR_BALANCE.test(before)) score -= 5
    let cents
    try { cents = parseAmount(m[1] || m[2]) } catch { continue }
    if (cents <= 0) continue
    if (!best || score > best.score) best = { cents, score, index: m.index, text: m[0] }
  }
  return best && best.score >= 0 ? best : null
}

function pickDate (text, today) {
  const year = Number(today.slice(0, 4))
  const ymd = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text)
  if (ymd) {
    const d = `${ymd[1]}-${ymd[2]}-${ymd[3]}`
    if (isValidDay(d)) return d
  }
  const dmy = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(text)
  if (dmy) {
    const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])
    const d = `${y}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`
    if (isValidDay(d)) return d
  }
  const words = /\b(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(?:de|del)\s+(\d{4}))?/i.exec(text)
  if (words && MONTHS[words[2].toLowerCase()]) {
    const d = `${words[3] || year}-${String(MONTHS[words[2].toLowerCase()]).padStart(2, '0')}-${String(words[1]).padStart(2, '0')}`
    if (isValidDay(d)) return d
  }
  return null
}

// Dónde fue: «en SUPERMAXI», «Comercio: KFC», «Establecimiento: …», «Beneficiario: …», «de JUAN».
function pickMerchant (text, type) {
  const labeled = /\b(?:comercio|establecimiento|lugar|beneficiario|destinatario|ordenante|remitente|merchant)\s*:\s*([^\n]{2,60})/i.exec(text)
  if (labeled) return clean(labeled[1])
  const re = type === 'income'
    ? /\b(?:de|desde)\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&*'-]{2,40})(?=[\s,.]|$)/g
    : /\b(?:en|at)\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&*'-]{2,40})(?=[\s,.]|$)/g
  for (const m of text.matchAll(re)) {
    const name = clean(m[1])
    // «terminada en 1234» es la tarjeta, no el comercio.
    if (!/[A-ZÁÉÍÓÚÑ]{2}/.test(name)) continue
    if (/\b(terminad[ao]|terminaci[oó]n|ending)\s*$/i.test(text.slice(Math.max(0, m.index - 15), m.index))) continue
    return name
  }
  return ''
}

function clean (s) {
  // Se corta en la palabra en minúsculas que sigue al nombre («… el 20/10»): el comercio suele ir
  // en mayúsculas y puede llevar «EL» dentro.
  return s.replace(/\s+(el|on|a las|por|con)\b.*$/, '').replace(/[\s.,;:-]+$/, '').trim().slice(0, 60)
}

/**
 * @param {string} raw  el correo pegado (texto o HTML)
 * @param {{ today?: string }} [opts]
 * @returns {null | { amount:number, type:'expense'|'income', category:string, note:string, date:string, bank:string, hints:string[] }}
 *   null si no hay un importe de operación (un aviso de saldo, una promoción).
 */
export function parseBankMail (raw, { today = localDay() } = {}) {
  const text = mailText(raw)
  if (!text) return null
  const amount = pickAmount(text)
  if (!amount) return null
  const hints = []

  // Lo que dice la frase del importe manda sobre el resto del correo (que trae pie, publicidad…).
  const around = text.slice(Math.max(0, amount.index - 160), amount.index + 60)
  let type = 'expense'
  if (INCOME.test(around) && !EXPENSE.test(around.slice(-120))) { type = 'income'; hints.push('income-word') }
  else if (EXPENSE.test(around)) hints.push('expense-word')
  else if (INCOME.test(text)) { type = 'income'; hints.push('income-word') }

  const date = pickDate(text, today) || today
  if (date !== today) hints.push('date')
  const merchant = pickMerchant(text, type)
  if (merchant) hints.push('merchant')

  let category = guessCategory(`${merchant} ${around}`)
  const incomeCats = new Set(['salary', 'freelance', 'sales', 'gifts', 'other-income'])
  if (category && incomeCats.has(category) !== (type === 'income')) category = null
  // «tarjeta» sale en casi todo aviso: solo dice «deudas» si es un pago A la tarjeta.
  if (category === 'debt' && !/\bpago\s+(?:de|a)\s+(?:tu\s+)?tarjeta\b/i.test(around)) category = null
  if (category) hints.push('category-word')

  const bank = (BANKS.find(([, re]) => re.test(text)) || [''])[0]
  return { amount: amount.cents, type, category: category || FALLBACK[type], note: merchant, date, bank, hints }
}

/** Una huella del correo pegado (por su texto) para no meter dos veces el mismo en la bandeja. */
export async function mailFingerprint (raw) {
  return digest(mailText(raw).replace(/\s+/g, ' ').toLowerCase())
}

/**
 * La huella de un correo traído del buzón, por su Message-ID. TAL CUAL: el id va entre `<…>`,
 * y pasarlo por `mailText` (que quita etiquetas) lo dejaba vacío, así que todos los correos
 * tenían la misma huella y solo entraba el primero.
 */
export async function messageIdFingerprint (id) {
  const clean = String(id || '').trim()
  if (!clean) throw new Error('messageIdFingerprint: empty message id')
  return digest(`message-id ${clean}`)
}

async function digest (text) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(hash.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}
