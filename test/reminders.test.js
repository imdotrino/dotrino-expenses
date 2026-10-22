import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dueItems, reminderDays, localTime, syncPushReminders } from '../src/lib/reminders.js'

const rule = (id, day, extra = {}) => ({ id, name: id, day, amount: 100, type: 'expense', category: 'home', startMonth: '2026-01', ...extra })

test('in the app: overdue, today and the next days, only what is pending', () => {
  const ms = [
    { id: 'a', date: '2026-10-05', pending: true },
    { id: 'b', date: '2026-10-21', pending: true },
    { id: 'c', date: '2026-10-23', pending: true },
    { id: 'd', date: '2026-10-28', pending: true },
    { id: 'e', date: '2026-10-21', pending: false },
  ]
  const r = dueItems(ms, '2026-10-21')
  assert.deepEqual(r.overdue.map((m) => m.id), ['a'])
  assert.deepEqual(r.today.map((m) => m.id), ['b'])
  assert.deepEqual(r.soon.map((m) => m.id), ['c'])
})

test('push days: one per day, across months, short months, skipped and already paid', () => {
  const rules = [
    rule('rent', 5),
    rule('netflix', 31),
    rule('gym', 5),
    rule('old', 10, { endMonth: '2026-09' }),
    rule('skip', 15, { skipped: ['2026-11'] }),
  ]
  const days = reminderDays(rules, '2026-10-21', 45)
  assert.deepEqual(days, ['2026-10-31', '2026-11-05', '2026-11-30', '2026-12-05'])
  // El arriendo de noviembre ya se confirmó (se pagó antes): noviembre 5 queda por el gym.
  const paid = [{ recurringId: 'rent', date: '2026-11-02', pending: false }, { recurringId: 'gym', date: '2026-11-03', pending: false }]
  assert.deepEqual(reminderDays(rules, '2026-10-21', 45, paid), ['2026-10-31', '2026-11-30', '2026-12-05'])
})

test('a reminder rings at 9:00 local time of that day', () => {
  const t = new Date(localTime('2026-11-05'))
  assert.deepEqual([t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes()], [2026, 11, 5, 9, 0])
})

function fakeProxy (existing = []) {
  const calls = []
  const client = {
    async identifyAs (o) { calls.push(['identify', o.publickey]) },
    async enablePush () { calls.push(['enablePush']) },
    async disablePush () { calls.push(['disablePush']) },
    async listScheduledPushes () { calls.push(['list']); return existing },
    async cancelScheduledPush ({ jobId }) { calls.push(['cancel', jobId]) },
    async schedulePush ({ when, payload }) { calls.push(['schedule', when, payload]) },
    close () { calls.push(['close']) },
  }
  return { calls, connect: async () => client }
}
const id = { me: { publickey: 'PUB' }, signData: async () => 'sig' }

test('push: replaces only this app\'s jobs, skips the past, never sends names or amounts', async () => {
  const p = fakeProxy([{ jobId: 1, app: 'expenses' }, { jobId: 2, app: 'messenger' }, { jobId: 3, app: null, payload: { tag: 'expenses-due' } }])
  const now = localTime('2026-10-21', 10)    // las 10:00: el aviso de hoy a las 9:00 ya pasó
  const r = await syncPushReminders({
    enabled: true, days: ['2026-10-21', '2026-10-31'], now,
    text: { title: 'Expenses', body: 'Tienes un pago o un cobro para hoy.' }, url: 'https://expenses.dotrino.com/',
    getIdentity: async () => id, connect: p.connect,
  })
  assert.equal(r.scheduled, 1)
  assert.deepEqual(p.calls.filter((c) => c[0] === 'cancel').map((c) => c[1]), [1, 3], 'the messenger job stays')
  const [, when, payload] = p.calls.find((c) => c[0] === 'schedule')
  assert.equal(when, localTime('2026-10-31'))
  assert.deepEqual(Object.keys(payload).sort(), ['body', 'tag', 'title', 'url'])
  assert.equal(p.calls[0][0], 'identify')
  assert.equal(p.calls.at(-1)[0], 'close')
})

test('push off: cancels this app\'s jobs and drops the subscription', async () => {
  const p = fakeProxy([{ jobId: 7, app: 'expenses' }])
  const r = await syncPushReminders({ enabled: false, days: ['2026-12-01'], text: { title: 't', body: 'b' }, url: 'u', getIdentity: async () => id, connect: p.connect })
  assert.equal(r.scheduled, 0)
  assert.deepEqual(p.calls.map((c) => c[0]), ['identify', 'list', 'cancel', 'disablePush', 'close'])
})
