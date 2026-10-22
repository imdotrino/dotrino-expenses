// El lector genérico de avisos del banco. OJO: estos avisos están ESCRITOS A MANO con la forma
// típica de un aviso (importe con moneda, saldo al lado, comercio, fecha); no son copias de
// correos reales de ningún banco. Cuando llegue un aviso real que no se lea bien, se añade aquí
// tal cual (anonimizado) y se arregla el lector.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBankMail, mailText, mailFingerprint } from '../src/lib/mail.js'

const today = '2026-10-21'
const parse = (t) => parseBankMail(t, { today })

test('a card purchase: amount of the operation, not the balance', () => {
  const m = parse(`Banco Pichincha
Estimado cliente, se registró un consumo con tu Tarjeta de Débito terminada en 1234
por USD 25,40 en SUPERMAXI EL JARDIN el 20/10/2026 a las 13:45.
Saldo disponible: USD 1.250,00`)
  assert.equal(m.amount, 2540)
  assert.equal(m.type, 'expense')
  assert.equal(m.date, '2026-10-20')
  assert.equal(m.note, 'SUPERMAXI EL JARDIN')
  assert.equal(m.category, 'groceries')
  assert.equal(m.bank, 'Pichincha')
})

test('a transfer received is income, with who sent it', () => {
  const m = parse('Produbanco: Transferencia recibida por $150.00 de JUAN PEREZ el 2026-10-19. Saldo contable $900.00')
  assert.equal(m.amount, 15000)
  assert.equal(m.type, 'income')
  assert.equal(m.note, 'JUAN PEREZ')
  assert.equal(m.date, '2026-10-19')
  assert.equal(m.category, 'other-income')
})

test('labeled fields and a date in words', () => {
  const m = parse(`Notificación de pago
Comercio: NETFLIX.COM
Valor: US$ 8.99
Fecha: 15 de octubre de 2026`)
  assert.equal(m.amount, 899)
  assert.equal(m.note, 'NETFLIX.COM')
  assert.equal(m.category, 'subscriptions')
  assert.equal(m.date, '2026-10-15')
})

test('an ATM withdrawal without a date falls on today', () => {
  const m = parse('Retiro en cajero automático por USD 40.00. Tu saldo es USD 210.55')
  assert.equal(m.amount, 4000)
  assert.equal(m.type, 'expense')
  assert.equal(m.date, today)
})

test('a payroll deposit is salary', () => {
  const m = parse('Te informamos la acreditación de tu sueldo (nómina) por $1.200,00 en tu cuenta de ahorros.')
  assert.equal(m.amount, 120000)
  assert.equal(m.type, 'income')
  assert.equal(m.category, 'salary')
})

test('a card bill payment is debt', () => {
  const m = parse('Pago de tarjeta Diners Club por USD 300.00 realizado con éxito.')
  assert.equal(m.amount, 30000)
  assert.equal(m.category, 'debt')
  assert.equal(m.bank, 'Diners Club')
})

test('a balance notice or a promo is not a movement', () => {
  assert.equal(parse('Tu saldo disponible al día de hoy es USD 1.250,00'), null)
  assert.equal(parse('¡Aprovecha! 20% de descuento en tus compras este fin de semana'), null)
  assert.equal(parse(''), null)
})

test('HTML pasted from the mail client is read as text', () => {
  const html = '<html><style>p{color:red}</style><body><p>Consumo&nbsp;por <b>USD 12,50</b></p><p>en KFC AMAZONAS</p></body></html>'
  assert.equal(mailText(html).includes('<'), false)
  const m = parse(html)
  assert.equal(m.amount, 1250)
  assert.equal(m.note, 'KFC AMAZONAS')
})

test('the same mail gives the same fingerprint, spacing aside', async () => {
  const a = await mailFingerprint('Consumo por USD 12,50  en KFC')
  const b = await mailFingerprint('consumo por usd 12,50 en kfc\n')
  assert.equal(a, b)
  assert.notEqual(a, await mailFingerprint('Consumo por USD 12,51 en KFC'))
})
