<script setup>
// El mes en números: totales, por categoría (barras de CSS, sin librería) y frente al mes
// anterior. Y la salida a CSV.
import { readOpenMonth, saveOpenMonth } from '../lib/open-month.js'
import { ref, computed, watch, onMounted } from 'vue'
import { t, lang, errorText, monthName } from '../i18n.js'
import { state, money, categoryName, categoryIcon, toast } from '../state.js'
import { listMovements } from '../lib/repo.js'
import { monthTotals, byCategory } from '../lib/summary.js'
import { movementsToCsv, downloadBlob } from '../lib/csv.js'
import { shiftMonth } from '../lib/dates.js'
import { toDecimal } from '../lib/money.js'
import { describeMonth } from '../lib/ai.js'

const month = ref(readOpenMonth())
const movements = ref([])
const previous = ref([])
const description = ref('')
const describing = ref(false)

const totals = computed(() => monthTotals(movements.value))
const prevTotals = computed(() => monthTotals(previous.value))
const expenses = computed(() => byCategory(movements.value, 'expense'))
const incomes = computed(() => byCategory(movements.value, 'income'))
const confirmed = computed(() => movements.value.filter((m) => !m.pending).length)

const vsPrev = computed(() => {
  if (!previous.value.some((m) => !m.pending)) return t('summary.noPrev')
  const diff = totals.value.expense - prevTotals.value.expense
  if (diff > 0) return t('summary.more', { amount: money(diff) })
  if (diff < 0) return t('summary.less', { amount: money(-diff) })
  return t('summary.same')
})

async function load () {
  description.value = ''
  try {
    const [cur, prev] = await Promise.all([listMovements(month.value), listMovements(shiftMonth(month.value, -1))])
    movements.value = cur
    previous.value = prev
  } catch (e) {
    console.error('[expenses] load summary:', e)
    toast(errorText(e), 'error')
  }
}

function go (delta) {
  month.value = shiftMonth(month.value, delta)
  saveOpenMonth(month.value)
}

// Al proveedor van solo los totales por categoría (con su nombre), de este mes y del anterior.
async function describe () {
  describing.value = true
  try {
    const rows = (list) => list.map((c) => ({ name: categoryName(c.category), total: toDecimal(c.total) }))
    const prevTotals = monthTotals(previous.value)
    description.value = await describeMonth({
      month: monthName(month.value),
      prevMonth: monthName(shiftMonth(month.value, -1)),
      current: { income: toDecimal(totals.value.income), expense: toDecimal(totals.value.expense), expenses: rows(expenses.value), incomes: rows(incomes.value) },
      previous: { income: toDecimal(prevTotals.income), expense: toDecimal(prevTotals.expense), expenses: rows(byCategory(previous.value, 'expense')) },
      currency: state.prefs.currency,
      lang: lang.value,
    })
  } catch (e) {
    console.error('[expenses] describe month:', e)
    toast(errorText(e), 'error')
  } finally {
    describing.value = false
  }
}

function exportCsv () {
  const csv = movementsToCsv(movements.value, { categoryName })
  downloadBlob(`expenses-${month.value}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  toast(t('summary.exported'))
}

watch(month, load)
watch(() => state.movementsVersion, load)
onMounted(load)
</script>

<template>
  <section class="stack" data-testid="summary-view">
    <div class="month-bar">
      <button type="button" class="btn icon ghost" :aria-label="t('month.prev')" data-testid="prev-month" @click="go(-1)">‹</button>
      <h2 class="month-title">{{ t('summary.title', { month: monthName(month) }) }}</h2>
      <button type="button" class="btn icon ghost" :aria-label="t('month.next')" data-testid="next-month" @click="go(1)">›</button>
    </div>

    <div class="totals">
      <div class="total income"><span>{{ t('month.income') }}</span><strong>{{ money(totals.income) }}</strong></div>
      <div class="total expense"><span>{{ t('month.expense') }}</span><strong>{{ money(totals.expense) }}</strong></div>
      <div class="total"><span>{{ t('month.balance') }}</span><strong>{{ money(totals.balance, { signed: true }) }}</strong></div>
    </div>

    <p v-if="!confirmed" class="muted" data-testid="summary-empty">{{ t('summary.empty') }}</p>

    <template v-else>
      <p class="muted small">{{ confirmed === 1 ? t('summary.count1') : t('summary.count', { count: confirmed }) }} · {{ t('summary.vsPrev', { month: monthName(shiftMonth(month, -1)) }) }}: {{ vsPrev }}</p>

      <section v-if="expenses.length" class="card">
        <h3>{{ t('summary.expenses') }}</h3>
        <ul class="bars" data-testid="expenses-by-category">
          <li v-for="c in expenses" :key="c.category" class="bar-row">
            <div class="bar-label">
              <span>{{ categoryIcon(c.category) }} {{ categoryName(c.category) }} <span class="muted small">({{ c.count }})</span></span>
              <strong>{{ money(c.total) }} · {{ Math.round(c.share * 100) }}%</strong>
            </div>
            <div class="bar"><i :style="{ width: `${Math.max(2, c.share * 100)}%` }"></i></div>
          </li>
        </ul>
      </section>

      <section v-if="incomes.length" class="card">
        <h3>{{ t('summary.incomes') }}</h3>
        <ul class="bars" data-testid="incomes-by-category">
          <li v-for="c in incomes" :key="c.category" class="bar-row">
            <div class="bar-label">
              <span>{{ categoryIcon(c.category) }} {{ categoryName(c.category) }} <span class="muted small">({{ c.count }})</span></span>
              <strong>{{ money(c.total) }} · {{ Math.round(c.share * 100) }}%</strong>
            </div>
            <div class="bar income"><i :style="{ width: `${Math.max(2, c.share * 100)}%` }"></i></div>
          </li>
        </ul>
      </section>
    </template>

    <section v-if="state.ai.configured && confirmed" class="card stack" data-testid="describe-card">
      <p v-if="description" data-testid="description">{{ description }}</p>
      <div class="row between">
        <span class="info-text">{{ t('ai.describeNote', { label: state.ai.label }) }}</span>
        <button type="button" class="btn small" :disabled="describing" data-testid="describe" @click="describe">{{ describing ? t('ai.describing') : t('ai.describe') }}</button>
      </div>
    </section>

    <div class="actions start">
      <button type="button" class="btn" :disabled="!movements.length" data-testid="export-csv" @click="exportCsv">{{ t('summary.export') }}</button>
    </div>
  </section>
</template>
