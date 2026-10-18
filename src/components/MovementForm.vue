<script setup>
// Un movimiento, nuevo o existente, en un modal. Lo que vino de una frase llega con `review`
// y el título lo dice: se revisa, no se guarda a ciegas.
import { ref, computed, watch } from 'vue'
import { t, errorText } from '../i18n.js'
import { state, categories, toast } from '../state.js'
import { saveMovement, removeMovement, validateMovement } from '../lib/repo.js'
import { parseAmount, toDecimal } from '../lib/money.js'
import { categoryLabel, FALLBACK } from '../lib/categories.js'
import { lang } from '../i18n.js'
import CategorySelect from './CategorySelect.vue'

const props = defineProps({ movement: { type: Object, required: true } })
const emit = defineEmits(['saved', 'removed', 'close'])

const form = ref({ ...props.movement, amountText: props.movement.amount ? toDecimal(props.movement.amount) : '' })
const problems = ref([])
const busy = ref(false)
const removing = ref(false)
const amountInput = ref(null)

const isNew = computed(() => !props.movement.id)
const title = computed(() => props.movement.review ? t('form.review') : isNew.value ? t('form.new') : t('form.edit'))

// Al cambiar de tipo, una categoría del otro tipo no sirve: se pasa a la genérica del nuevo.
watch(() => form.value.type, (type) => {
  const cat = categories().find((c) => c.key === form.value.category)
  if (!cat || (cat.kind !== 'both' && cat.kind !== type)) form.value.category = form.value.category ? FALLBACK[type] : ''
})

function build () {
  let amount
  try {
    amount = Math.abs(parseAmount(form.value.amountText))
  } catch {
    amount = 0
  }
  const { amountText, review, hints, ...rest } = form.value
  return { ...rest, amount, note: String(rest.note || '').trim(), pending: false, source: rest.source || 'manual' }
}

async function save () {
  const m = build()
  problems.value = validateMovement(m)
  if (problems.value.length) return
  busy.value = true
  try {
    await saveMovement(m, { previousDate: props.movement.id ? props.movement.date : undefined })
    toast(t('form.saved'))
    emit('saved')
  } catch (e) {
    console.error('[expenses] save movement:', e)
    toast(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}

async function remove () {
  busy.value = true
  try {
    await removeMovement(props.movement)
    toast(t('form.removed'))
    emit('removed')
  } catch (e) {
    console.error('[expenses] remove movement:', e)
    toast(errorText(e), 'error')
  } finally {
    busy.value = false
    removing.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="card modal stack" data-testid="movement-form" @submit.prevent="save">
      <h2>{{ title }}</h2>

      <div class="segment" role="group">
        <button type="button" class="expense" :aria-pressed="form.type === 'expense'" data-testid="type-expense" @click="form.type = 'expense'">{{ t('form.expense') }}</button>
        <button type="button" class="income" :aria-pressed="form.type === 'income'" data-testid="type-income" @click="form.type = 'income'">{{ t('form.income') }}</button>
      </div>

      <div class="grid">
        <label class="field">
          <span>{{ t('form.amount') }} ({{ state.prefs.currency }})</span>
          <input ref="amountInput" v-model="form.amountText" class="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" data-testid="amount" />
          <span v-if="problems.includes('amount')" class="problem">{{ t('form.problems.amount') }}</span>
        </label>
        <label class="field">
          <span>{{ t('form.date') }}</span>
          <input v-model="form.date" type="date" data-testid="date" />
          <span v-if="problems.includes('date')" class="problem">{{ t('form.problems.date') }}</span>
        </label>
        <label class="field wide">
          <span>{{ t('form.category') }}</span>
          <CategorySelect v-model="form.category" :type="form.type" data-testid="category" />
          <span v-if="problems.includes('category')" class="problem">{{ t('form.problems.category') }}</span>
        </label>
        <label class="field wide">
          <span>{{ t('form.note') }}</span>
          <input v-model="form.note" :placeholder="t('form.notePlaceholder')" data-testid="note" />
        </label>
      </div>

      <div v-if="removing" class="banner error" data-testid="remove-confirm">
        <p>{{ t('form.removeBody') }}</p>
        <div class="actions">
          <button type="button" class="btn small ghost" @click="removing = false">{{ t('form.cancel') }}</button>
          <button type="button" class="btn small danger" :disabled="busy" data-testid="remove-yes" @click="remove">{{ t('form.removeConfirm') }}</button>
        </div>
      </div>

      <div class="actions">
        <button v-if="!isNew && !removing" type="button" class="btn ghost danger" :disabled="busy" data-testid="remove" @click="removing = true">{{ t('form.remove') }}</button>
        <span class="grow"></span>
        <button type="button" class="btn ghost" data-testid="cancel" @click="emit('close')">{{ t('form.cancel') }}</button>
        <button type="submit" class="btn primary" :disabled="busy" data-testid="save">{{ t('form.save') }}</button>
      </div>
    </form>
  </div>
</template>
