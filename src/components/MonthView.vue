<script setup>
// El mes: la barra con los totales, el calendario, y los movimientos del día elegido (o de
// todo el mes). El botón + abre el formulario; la frase libre pasa por el parser y SIEMPRE
// se revisa antes de guardar.
import { ref, computed, watch, onMounted } from 'vue'
import { useBackLayer } from '@dotrino/nav/vue'
import { t, tl, errorText, formatDate, monthName } from '../i18n.js'
import { state, money, categoryName, categoryIcon, toast } from '../state.js'
import { ensureRecurring, saveMovement, removeMovement } from '../lib/repo.js'
import { monthTotals, dayTotals } from '../lib/summary.js'
import { localMonth, localDay, shiftMonth, daysInMonth, firstWeekdayMonday, dayToDate } from '../lib/dates.js'
import { parseMovement } from '../lib/parse.js'
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

function fromQuick () {
  quickProblem.value = ''
  const parsed = parseMovement(quick.value)
  if (!parsed) {
    quickProblem.value = t('month.quickNoAmount')
    return
  }
  const { hints, ...rest } = parsed
  editing.value = { ...rest, source: 'text', review: true }
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
          <button type="button" class="btn primary" :disabled="!quick.trim()" data-testid="quick-go" @click="fromQuick">→</button>
        </div>
      </label>
      <p v-if="quickProblem" class="problem" data-testid="quick-problem">{{ quickProblem }}</p>
      <p v-else class="info-text">{{ t('month.quickHelp') }}</p>
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
