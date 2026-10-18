// El mes en CSV, para abrirlo en una hoja de cálculo. Fechas ISO e importes con punto decimal:
// lo que cualquier hoja entiende sin preguntar por el idioma.
import { toDecimal } from './money.js'

const HEADER = ['date', 'type', 'category', 'amount', 'note', 'source', 'pending']

export function movementsToCsv (movements, { categoryName = (k) => k } = {}) {
  const rows = [HEADER.join(',')]
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts)
  for (const m of sorted) {
    rows.push([m.date, m.type, categoryName(m.category), toDecimal(m.amount), m.note || '', m.source || 'manual', m.pending ? 'yes' : '']
      .map(cell).join(','))
  }
  return rows.join('\r\n') + '\r\n'
}

function cell (value) {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadBlob (name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
