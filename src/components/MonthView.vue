<script setup>
// El mes: la barra con los totales, el calendario, y los movimientos del día elegido (o de
// todo el mes). El botón + abre el formulario; la frase libre pasa por el parser y SIEMPRE
// se revisa antes de guardar.
import { ref, computed, watch, onMounted } from 'vue'
import { useBackLayer } from '@dotrino/nav/vue'
import { t, tl, lang, errorText, formatDate, monthName } from '../i18n.js'
import { state, money, categories, categoryName, categoryIcon, toast, refreshReminders } from '../state.js'
import { ensureRecurring, saveMovement, removeMovement } from '../lib/repo.js'
import { monthTotals, dayTotals } from '../lib/summary.js'
import { localMonth, localDay, shiftMonth, daysInMonth, firstWeekdayMonday, dayToDate } from '../lib/dates.js'
import { parseMovement } from '../lib/parse.js'
import { dueItems } from '../lib/reminders.js'
import { parseWithAi, transcribeWithAi } from '../lib/ai.js'
import '@dotrino/dictation'
import MovementForm from './MovementForm.vue'

const MONTH_KEY = 'expenses.month'

const month = ref(readMonth())
const selectedDay = ref(null)      // 'aaaa-mm-dd' o null = todo el mes
const movements = ref([])
const loading = ref(false)
const editing = ref(null)          // movimiento en el formulario (nuevo o existente)
const formOpen = ref(false)
const quick = ref('')
const quickProblem = ref('')
const quickBusy = ref(false)
const mic = ref(null)
const micStatus = ref({ text: '', error: null })   // lo que dice el micrófono, bajo el cuadro

// El dictado, según Ajustes. «Con tu IA» solo si la IA guardada sabe transcribir; si no, no hay
// micrófono (Ajustes dice por qué).
const dictation = computed(() => {
  const mode = state.prefs.dictation
  if (mode === 'local') return 'local'
  if (mode === 'provider' && state.ai.configured && state.ai.canTranscribe) return 'provider'
  return ''
})
watch([mic, dictation], () => { if (mic.value) mic.value.transcriber = transcribeWithAi })

// Lo dictado cae en el cuadro y se entiende igual que lo escrito: el usuario lo revisa siempre.
function fromDictation (e) {
  quick.value = e.detail.text
  fromQuick()
}

useBackLayer(formOpen)

const today = computed(() => localDay())
const totals = computed(() => monthTotals(movements.value))
const perDay = computed(() => dayTotals(movements.value))
const weekdays = computed(() => tl('month.weekdays'))

const cells = computed(() => {
  const blanks = firstWeekdayMonday(month.value)
  const n = daysInMonth(month.value)
  const list = []
  for (let i = 0; i < blanks; i++) list.push({ key: `b${i}`, blank: true })
  for (let d = 1; d <= n; d++) {
    const day = `${month.value}-${String(d).padStart(2, '0')}`
    list.push({ key: day, day, n: d, totals: perDay.value[day] || null })
  }
  return list
})

const visible = computed(() => {
  const list = selectedDay.value ? movements.value.filter((m) => m.date === selectedDay.value) : movements.value
  // Pendientes primero: son lo que pide una decisión. Después por fecha descendente.
  return [...list].sort((a, b) => (Number(!!b.pending) - Number(!!a.pending)) || b.date.localeCompare(a.date) || b.ts - a.ts)
})

// Lo que vence: solo en el mes en curso (en otro mes «hoy» no dice nada).
const due = computed(() => {
  if (month.value !== today.value.slice(0, 7)) return null
  const d = dueItems(movements.value, today.value)
  return d.overdue.length || d.today.length || d.soon.length ? d : null
})

function dueWhen (m) {
  if (m.date === today.value) return t('reminders.today')
  if (m.date < today.value) return t('reminders.overdue')
  return formatDate(dayToDate(m.date), { weekday: 'long', day: 'numeric', timeZone: 'UTC' })
}

const dayTitle = computed(() => {
  if (!selectedDay.value) return t('month.allMonth')
  return formatDate(dayToDate(selectedDay.value), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
})

function readMonth () {
  try {
    const v = sessionStorage.getItem(MONTH_KEY)
    if (/^\d{4}-\d{2}$/.test(v || '')) return v
  } catch { /* modo privado */ }
  return localMonth()
}

async function load () {
  loading.value = true
  try {
    movements.value = await ensureRecurring(month.value)
  } catch (e) {
    console.error('[expenses] load month:', e)
    toast(errorText(e), 'error')
  } finally {
    loading.value = false
  }
}

function go (delta) {
  month.value = shiftMonth(month.value, delta)
  selectedDay.value = null
  try { sessionStorage.setItem(MONTH_KEY, month.value) } catch { /* modo privado */ }
}

function pickDay (day) {
  selectedDay.value = selectedDay.value === day ? null : day
}

function openNew () {
  editing.value = { date: selectedDay.value || (month.value === localMonth() ? today.value : `${month.value}-01`), amount: 0, type: 'expense', category: '', note: '', source: 'manual' }
  formOpen.value = true
}

function openEdit (m) {
  editing.value = { ...m }
  formOpen.value = true
}

// Con la IA del usuario, la frase la entiende su modelo; si no contesta, se dice en pantalla y
// se usan las reglas (el usuario revisa siempre lo que se entendió). Sin IA, las reglas.
async function fromQuick () {
  quickProblem.value = ''
  const text = quick.value.trim()
  if (!text) return
  if (state.ai.configured) {
    quickBusy.value = true
    try {
      const m = await parseWithAi(text, { today: today.value, categories: categories(), lang: lang.value })
      return openReview({ ...m, source: 'text' })
    } catch (e) {
      console.error('[expenses] ai parse:', e)
      if (e?.code === 'ai-no-amount') {
        quickProblem.value = t('month.quickNoAmount')
        return
      }
      toast(t('ai.fellBack', { label: state.ai.label, reason: errorText(e) }), 'error')
    } finally {
      quickBusy.value = false
    }
  }
  const parsed = parseMovement(text)
  if (!parsed) {
    quickProblem.value = t('month.quickNoAmount')
    return
  }
  const { hints, ...rest } = parsed
  openReview({ ...rest, source: 'text' })
}

function openReview (m) {
  editing.value = { ...m, review: true }
  formOpen.value = true
}

async function onSaved () {
  formOpen.value = false
  quick.value = ''
  await load()
}

async function confirm (m) {
  try {
    await saveMovement({ ...m, pending: false })
    toast(t('form.confirmed'))
    await load()
    refreshReminders()
  } catch (e) {
    console.error('[expenses] confirm:', e)
    toast(errorText(e), 'error')
  }
}

async function discard (m) {
  try {
    await removeMovement(m)
    toast(t('form.removed'))
    await load()
    refreshReminders()
  } catch (e) {
    console.error('[expenses] discard:', e)
    toast(errorText(e), 'error')
  }
}

watch(month, load)
watch(() => state.movementsVersion, load)
onMounted(load)
</script>

<template>
  <section class="stack" data-testid="month-view">
    <div class="month-bar">
      <button type="button" class="btn icon ghost" :aria-label="t('month.prev')" data-testid="prev-month" @click="go(-1)">‹</button>
      <h2 class="month-title" data-testid="month-title">{{ monthName(month) }}</h2>
      <button type="button" class="btn icon ghost" :aria-label="t('month.next')" data-testid="next-month" @click="go(1)">›</button>
    </div>

    <div class="totals" data-testid="totals">
      <div class="total income"><span>{{ t('month.income') }}</span><strong data-testid="total-income">{{ money(totals.income) }}</strong></div>
      <div class="total expense"><span>{{ t('month.expense') }}</span><strong data-testid="total-expense">{{ money(totals.expense) }}</strong></div>
      <div class="total"><span>{{ t('month.balance') }}</span><strong data-testid="total-balance">{{ money(totals.balance, { signed: true }) }}</strong></div>
    </div>
    <p v-if="totals.pending" class="banner warn small" data-testid="pending-banner">{{ t('month.pending', { count: totals.pending }) }}</p>
    <div v-if="due" class="card due" role="status" data-testid="due-banner">
      <strong>{{ t('reminders.title') }}</strong>
      <ul>
        <li v-for="m in [...due.overdue, ...due.today, ...due.soon]" :key="m.id" :class="{ late: m.date < today }">
          <button type="button" class="linkish" :data-due-id="m.id" data-testid="due-item" @click="selectedDay = m.date">
            {{ categoryIcon(m.category) }} {{ m.note || categoryName(m.category) }} · {{ money(m.amount) }} · {{ dueWhen(m) }}
          </button>
        </li>
      </ul>
    </div>

    <div class="card">
      <div class="calendar" role="grid">
        <div v-for="(w, i) in weekdays" :key="i" class="weekday" role="columnheader">{{ w }}</div>
        <template v-for="c in cells" :key="c.key">
          <div v-if="c.blank" class="day blank" aria-hidden="true"></div>
          <button
            v-else type="button" class="day"
            :class="{ today: c.day === today, 'has-income': c.totals?.income, 'has-expense': c.totals?.expense }"
            :aria-pressed="selectedDay === c.day" :data-day="c.day" data-testid="day"
            @click="pickDay(c.day)"
          >
            <span class="n">{{ c.n }}</span>
            <span v-if="c.totals?.income" class="amt income">{{ money(c.totals.income) }}</span>
            <span v-if="c.totals?.expense" class="amt expense">{{ money(c.totals.expense) }}</span>
            <i v-if="c.totals?.pending" class="dot" :title="t('month.pendingTag')"></i>
          </button>
        </template>
      </div>
    </div>

    <div class="card stack">
      <label class="field">
        <span>{{ t('month.quick') }}</span>
        <div class="row">
          <input v-model="quick" class="grow" :placeholder="t('month.quickPlaceholder')" data-testid="quick-input" @keydown.enter.prevent="fromQuick" />
          <dotrino-dictation v-if="dictation" ref="mic" :engine="dictation" :lang="lang" data-testid="dictation" @dotrino-dictation-text="fromDictation" @dotrino-dictation-status="micStatus = $event.detail"></dotrino-dictation>
          <button type="button" class="btn primary" :disabled="!quick.trim() || quickBusy" data-testid="quick-go" @click="fromQuick">{{ quickBusy ? '…' : '→' }}</button>
        </div>
      </label>
      <p v-if="quickProblem" class="problem" data-testid="quick-problem">{{ quickProblem }}</p>
      <p v-else-if="dictation && micStatus.text" :class="micStatus.error ? 'problem' : 'info-text'" role="status" data-testid="mic-status">{{ micStatus.text }}</p>
      <p v-else class="info-text">
        {{ quickBusy ? t('ai.thinking') : t('month.quickHelp') }}
        <span class="chip" data-testid="quick-engine">{{ state.ai.configured ? t('ai.usingAi', { label: state.ai.label }) : t('ai.usingRules') }}</span>
      </p>
    </div>

    <div class="day-head">
      <h3 data-testid="day-title">{{ dayTitle }}</h3>
      <button v-if="selectedDay" type="button" class="btn small ghost" data-testid="all-month" @click="selectedDay = null">{{ t('month.allMonth') }}</button>
    </div>

    <p v-if="!loading && !visible.length" class="muted" data-testid="empty">{{ selectedDay ? t('month.dayEmpty') : t('month.monthEmpty') }}</p>

    <ul class="movements" data-testid="movement-list">
      <li v-for="m in visible" :key="m.id">
        <div class="movement" :class="{ pending: m.pending }" :data-movement-id="m.id" data-testid="movement" role="button" tabindex="0" @click="openEdit(m)" @keydown.enter="openEdit(m)">
          <span class="ico" aria-hidden="true">{{ categoryIcon(m.category) }}</span>
          <span class="body">
            <span class="note">{{ m.note || categoryName(m.category) }}</span>
            <span class="meta">
              <span>{{ formatDate(dayToDate(m.date), { day: 'numeric', month: 'short', timeZone: 'UTC' }) }}</span>
              <span>· {{ categoryName(m.category) }}</span>
              <span v-if="m.pending" class="chip pending">{{ t('month.pendingTag') }}</span>
              <span v-else-if="m.recurringId" class="chip">{{ t('month.recurringTag') }}</span>
            </span>
          </span>
          <span class="amount" :class="m.type" data-testid="movement-amount">{{ money(m.type === 'income' ? m.amount : -m.amount, { signed: true }) }}</span>
          <span v-if="m.pending" class="pending-actions">
            <button type="button" class="btn small primary" data-testid="confirm" @click.stop="confirm(m)">{{ t('month.confirm') }}</button>
            <button type="button" class="btn small ghost" data-testid="discard" @click.stop="discard(m)">✕</button>
          </span>
        </div>
      </li>
    </ul>

    <button type="button" class="fab" :aria-label="t('month.add')" data-testid="add" @click="openNew">+</button>

    <MovementForm v-if="formOpen" :movement="editing" @saved="onSaved" @removed="onSaved" @close="formOpen = false" />
  </section>
</template>

<style scoped>
.due { border-left: 4px solid var(--dt-gold, #c9a227); }
.due ul { list-style: none; margin: .4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: .2rem; }
.due .late .linkish { color: var(--dt-error, #b3261e); }
.linkish { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
.linkish:hover { text-decoration: underline; }
/* El estado del micrófono va bajo el cuadro (mic-status), no apretando la fila. */
dotrino-dictation::part(status) { display: none; }
</style>
