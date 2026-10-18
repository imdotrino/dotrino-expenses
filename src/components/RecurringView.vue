<script setup>
// Las reglas de lo que se repite cada mes. Una edición abierta a la vez.
import { ref, computed } from 'vue'
import { t, errorText, monthName } from '../i18n.js'
import { state, money, categoryName, categoryIcon, refreshSettings, toast } from '../state.js'
import { saveRecurring, removeRecurring } from '../lib/repo.js'
import { validateRule } from '../lib/recurring.js'
import { parseAmount, toDecimal } from '../lib/money.js'
import { localMonth } from '../lib/dates.js'
import { FALLBACK } from '../lib/categories.js'
import CategorySelect from './CategorySelect.vue'

const editing = ref(null)      // id de la regla, 'new', o null
const form = ref(null)
const problems = ref([])
const busy = ref(false)
const toRemove = ref(null)
const info = ref(false)

const sorted = computed(() => [...state.recurring].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name)))

function blank () {
  return { name: '', amountText: '', type: 'expense', category: FALLBACK.expense, day: 1, startMonth: localMonth(), endMonth: '' }
}

function add () {
  form.value = blank()
  problems.value = []
  editing.value = 'new'
}

function edit (rule) {
  form.value = { ...rule, amountText: toDecimal(rule.amount), endMonth: rule.endMonth || '' }
  problems.value = []
  editing.value = rule.id
}

function close () {
  editing.value = null
  form.value = null
}

function build () {
  const { amountText, ...rest } = form.value
  let amount = 0
  try { amount = Math.abs(parseAmount(amountText)) } catch { amount = 0 }
  const rule = { ...rest, name: String(rest.name || '').trim(), amount, day: Number(rest.day) }
  if (!rule.endMonth) delete rule.endMonth
  return rule
}

async function save () {
  const rule = build()
  problems.value = validateRule(rule)
  if (problems.value.length) return
  busy.value = true
  try {
    await saveRecurring(rule)
    await refreshSettings()
    toast(t('recurring.saved'))
    close()
  } catch (e) {
    console.error('[expenses] save rule:', e)
    toast(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}

async function confirmRemove () {
  const rule = toRemove.value
  toRemove.value = null
  try {
    await removeRecurring(rule.id)
    await refreshSettings()
    toast(t('recurring.removed'))
  } catch (e) {
    console.error('[expenses] remove rule:', e)
    toast(errorText(e), 'error')
  }
}

function describe (rule) {
  let text = t('recurring.every', { day: rule.day })
  if (rule.startMonth) text += ` · ${t('recurring.from', { month: monthName(rule.startMonth) })}`
  if (rule.endMonth) text += ` · ${t('recurring.until', { month: monthName(rule.endMonth) })}`
  return text
}
</script>

<template>
  <section class="stack" data-testid="recurring-view">
    <div class="card stack">
      <h2 class="label-row">
        <span>{{ t('recurring.title') }}</span>
        <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
      </h2>
      <p v-if="info" class="info-text">{{ t('recurring.info') }}</p>

      <p v-if="!sorted.length" class="muted" data-testid="recurring-empty">{{ t('recurring.empty') }}</p>

      <ul v-else class="plain-list" data-testid="recurring-list">
        <li v-for="rule in sorted" :key="rule.id" class="sub-card" :data-rule-id="rule.id" data-testid="rule">
          <div class="row between">
            <strong>{{ categoryIcon(rule.category) }} {{ rule.name }}</strong>
            <span class="amount" :class="rule.type">{{ money(rule.type === 'income' ? rule.amount : -rule.amount, { signed: true }) }}</span>
          </div>
          <p class="muted small">{{ describe(rule) }} · {{ categoryName(rule.category) }}</p>
          <div v-if="toRemove?.id === rule.id" class="banner error" data-testid="rule-remove-confirm">
            <p>{{ t('recurring.removeBody') }}</p>
            <div class="actions">
              <button type="button" class="btn small ghost" @click="toRemove = null">{{ t('form.cancel') }}</button>
              <button type="button" class="btn small danger" data-testid="rule-remove-yes" @click="confirmRemove">{{ t('recurring.removeConfirm') }}</button>
            </div>
          </div>
          <div v-else class="actions start">
            <button type="button" class="btn small" data-testid="rule-edit" @click="edit(rule)">{{ t('recurring.edit') }}</button>
            <button type="button" class="btn small ghost danger" data-testid="rule-remove" @click="toRemove = rule">{{ t('recurring.remove') }}</button>
          </div>
        </li>
      </ul>

      <div class="actions start">
        <button type="button" class="btn primary" data-testid="rule-add" @click="add">{{ t('recurring.add') }}</button>
      </div>
    </div>

    <div v-if="editing" class="modal-backdrop" @click.self="close">
      <form class="card modal stack" data-testid="rule-form" @submit.prevent="save">
        <h2>{{ editing === 'new' ? t('recurring.new') : t('recurring.edit') }}</h2>

        <div class="segment" role="group">
          <button type="button" class="expense" :aria-pressed="form.type === 'expense'" data-testid="rule-type-expense" @click="form.type = 'expense'; form.category = FALLBACK.expense">{{ t('form.expense') }}</button>
          <button type="button" class="income" :aria-pressed="form.type === 'income'" data-testid="rule-type-income" @click="form.type = 'income'; form.category = FALLBACK.income">{{ t('form.income') }}</button>
        </div>

        <div class="grid">
          <label class="field wide">
            <span>{{ t('recurring.name') }}</span>
            <input v-model="form.name" :placeholder="t('recurring.namePlaceholder')" data-testid="rule-name" />
            <span v-if="problems.includes('name')" class="problem">{{ t('recurring.problems.name') }}</span>
          </label>
          <label class="field">
            <span>{{ t('form.amount') }} ({{ state.prefs.currency }})</span>
            <input v-model="form.amountText" class="amount" inputmode="decimal" placeholder="0.00" data-testid="rule-amount" />
            <span v-if="problems.includes('amount')" class="problem">{{ t('recurring.problems.amount') }}</span>
          </label>
          <label class="field">
            <span>{{ t('recurring.day') }}</span>
            <input v-model.number="form.day" type="number" min="1" max="31" data-testid="rule-day" />
            <span v-if="problems.includes('day')" class="problem">{{ t('recurring.problems.day') }}</span>
            <span v-else class="info-text">{{ t('recurring.dayHelp') }}</span>
          </label>
          <label class="field wide">
            <span>{{ t('form.category') }}</span>
            <CategorySelect v-model="form.category" :type="form.type" data-testid="rule-category" />
            <span v-if="problems.includes('category')" class="problem">{{ t('recurring.problems.category') }}</span>
          </label>
          <label class="field">
            <span>{{ t('recurring.startMonth') }}</span>
            <input v-model="form.startMonth" type="month" data-testid="rule-start" />
            <span v-if="problems.includes('startMonth')" class="problem">{{ t('recurring.problems.startMonth') }}</span>
          </label>
          <label class="field">
            <span>{{ t('recurring.endMonth') }}</span>
            <input v-model="form.endMonth" type="month" data-testid="rule-end" />
            <span v-if="problems.includes('endMonth')" class="problem">{{ t('recurring.problems.endMonth') }}</span>
          </label>
        </div>

        <div class="actions">
          <button type="button" class="btn ghost" @click="close">{{ t('form.cancel') }}</button>
          <button type="submit" class="btn primary" :disabled="busy" data-testid="rule-save">{{ t('form.save') }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
