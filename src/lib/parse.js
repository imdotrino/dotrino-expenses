// Texto libre → movimiento, SIN IA. «almuerzo 4.50», «cobré 1200 del sueldo», «-20 taxi ayer».
// Es el camino que funciona siempre; con la llave de IA del usuario (F2) el modelo propone y
// este parser sigue siendo lo que se usa cuando no hay llave o el proveedor no contesta.
//
// Devuelve lo que entendió y en qué se apoyó, para que la UI lo enseñe a confirmar: nunca se
// guarda nada sin que el usuario lo vea.

import { parseAmount } from './money.js'
import { localDay } from './dates.js'
import { FALLBACK } from './categories.js'

const INCOME_WORDS = /\b(ingreso|ingres[oé]|cobr[eéo]|cobr[ao]|me pagaron|pago recibido|recib[ií]|sueldo|salario|quincena|venta|vend[ií]|income|salary|received|paid me|earned|sold|deposit)\b/i

// Palabras → categoría. Lo primero que empareja, gana: el orden importa poco porque las
// listas no se pisan. Es/en mezclados a propósito: la gente escribe como habla.
const CATEGORY_WORDS = [
  ['transport', /\b(taxi|uber|cabify|indriver|bus|buseta|metro|tren|gasolina|gas|combustible|parqueo|parking|peaje|pasaje|fuel|ride)\b/i],
  ['groceries', /\b(mercado|supermercado|supermaxi|tía|tia|aki|megamaxi|víveres|viveres|despensa|groceries|supermarket)\b/i],
  ['food', /\b(almuerzo|desayuno|cena|comida|restaurante|café|cafe|cafetería|pizza|hamburguesa|lunch|dinner|breakfast|food|restaurant|coffee|snack|helado|panadería|panaderia)\b/i],
  ['home', /\b(arriendo|renta|alquiler|rent|hipoteca|mortgage|alícuota|alicuota|condominio)\b/i],
  ['utilities', /\b(luz|agua|internet|teléfono|telefono|celular|plan|electricidad|electricity|water|phone|wifi|cnt|claro|movistar)\b/i],
  ['health', /\b(médico|medico|doctor|farmacia|medicina|medicinas|pastillas|dentista|hospital|clínica|clinica|seguro|pharmacy|health|medicine|gym|gimnasio)\b/i],
  ['education', /\b(colegio|escuela|universidad|curso|matrícula|matricula|libros|pensión|pension|school|tuition|course|books)\b/i],
  ['leisure', /\b(cine|concierto|fiesta|salida|bar|cerveza|cervezas|vino|juego|juegos|viaje|hotel|movie|party|beer|trip|travel|vacaciones)\b/i],
  ['subscriptions', /\b(netflix|spotify|disney|hbo|prime|youtube|icloud|google one|suscripción|suscripcion|subscription|membresía|membresia)\b/i],
  ['shopping', /\b(ropa|zapatos|compra|compras|amazon|mercado libre|tienda|regalo para|clothes|shoes|shopping|store)\b/i],
  ['debt', /\b(tarjeta|cuota|préstamo|prestamo|deuda|interés|interes|credit card|loan|debt|installment)\b/i],
  ['salary', /\b(sueldo|salario|quincena|nómina|nomina|salary|payroll|paycheck)\b/i],
  ['freelance', /\b(freelance|proyecto|trabajo|cliente|consultoría|consultoria|honorarios|invoice|factura)\b/i],
  ['sales', /\b(venta|vendí|vendi|vend[ií]|sold|sale)\b/i],
  ['gifts', /\b(regalo|regalaron|gift|bono|bonus|propina|tip)\b/i],
]

const DATE_WORDS = [
  [/\b(hoy|today)\b/i, 0],
  [/\b(ayer|yesterday)\b/i, -1],
  [/\b(anteayer|antier|day before yesterday)\b/i, -2],
]

// Un importe: dígitos con decimales opcionales, con o sin $ delante, y que no sea una fecha
// (12/10) ni parte de una palabra (mp3). Admite un signo delante.
const AMOUNT = /(?<![\w/.,])([+-])?\$?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\w/]|[.,]\d)/

// Un importe dicho en voz alta, como lo deja el dictado: «4 dólares con 50», «4 con 50
// centavos», «12 dollars and 30 cents». Solo con la moneda o los centavos dichos: «4 con 2
// amigos» no es un importe.
const SPOKEN_AMOUNT = /(\d+)\s*(?:(?:d[oó]lares?|dollars?|usd)\s*(?:con|y|and)\s*(\d{1,2})(?:\s*(?:centavos?|cents?))?|(?:con|y|and)\s*(\d{1,2})\s*(?:centavos?|cents?))\b/i
const CURRENCY_WORDS = /\b(d[oó]lares?|dollars?|usd)\b/gi

function normalizeSpoken (text) {
  return text.replace(SPOKEN_AMOUNT, (_, units, c1, c2) => `${units}.${String(c1 ?? c2).padStart(2, '0')}`)
}

/**
 * @param {string} text
 * @param {{ today?: string }} [opts]  'aaaa-mm-dd' que cuenta como hoy (para probar)
 * @returns {null | { amount:number, type:'expense'|'income', category:string, note:string, date:string, hints:string[] }}
 */
export function parseMovement (text, { today = localDay() } = {}) {
  const src = normalizeSpoken(String(text || '').trim())
  if (!src) return null
  const m = AMOUNT.exec(src)
  if (!m) return null
  const hints = []
  let amount
  try {
    amount = parseAmount(m[2])
  } catch {
    return null
  }
  if (amount === 0) return null

  let type = 'expense'
  if (m[1] === '+') { type = 'income'; hints.push('sign') }
  else if (m[1] === '-') { type = 'expense'; hints.push('sign') }
  else if (INCOME_WORDS.test(src)) { type = 'income'; hints.push('income-word') }

  let date = today
  for (const [re, delta] of DATE_WORDS) {
    if (re.test(src)) {
      date = shiftDay(today, delta)
      hints.push('date-word')
      break
    }
  }
  // «el 12», «12/10», «12-10»: día (y mes) explícitos. Un año fuera del mes actual no se adivina.
  let rest = src.replace(m[0], ' ')
  if (!hints.includes('date-word')) {
    const dm = /\b(?:el\s+)?(\d{1,2})(?:[/-](\d{1,2}))?\b(?!\s*[.,]?\d)/.exec(rest)
    if (dm) {
      const d = Number(dm[1])
      const mo = dm[2] ? Number(dm[2]) : Number(today.slice(5, 7))
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        const candidate = `${today.slice(0, 4)}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (!Number.isNaN(new Date(`${candidate}T12:00:00Z`).getTime())) {
          date = candidate
          hints.push('date-number')
          rest = rest.replace(dm[0], ' ')
        }
      }
    }
  }

  let category = null
  for (const [key, re] of CATEGORY_WORDS) {
    if (re.test(src)) { category = key; hints.push('category-word'); break }
  }
  // Una categoría de ingreso en un gasto (o al revés) dice que el tipo estaba mal leído, salvo
  // que el signo lo haya fijado el usuario.
  const incomeCats = new Set(['salary', 'freelance', 'sales', 'gifts'])
  if (category && !hints.includes('sign')) {
    if (incomeCats.has(category) && type === 'expense') type = 'income'
    if (!incomeCats.has(category) && type === 'income' && !INCOME_WORDS.test(src)) type = 'expense'
  }
  if (!category) category = FALLBACK[type]

  const note = rest
    .replace(/\b(hoy|today|ayer|yesterday|anteayer|antier)\b/gi, ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim()

  return { amount, type, category, note, date, hints }
}

function shiftDay (day, delta) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
