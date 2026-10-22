<script setup>
// Recordatorios: dentro de la app salen siempre (el aviso del mes). Aquí se enciende, EN ESTE
// APARATO, el timbre del día del pago con la app cerrada. El aviso no dice qué ni cuánto.
import { ref, computed } from 'vue'
import { t, errorText } from '../i18n.js'
import { state, setReminderPush, refreshReminders, toast } from '../state.js'

const info = ref(false)
const busy = ref(false)

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const denied = computed(() => supported && Notification.permission === 'denied')

const status = computed(() => {
  const s = state.remindersSync
  if (state.reminderPush !== 'on') return ''
  if (!s || s.state === 'syncing') return t('reminders.syncing')
  if (s.state === 'error') return errorText(s.error)
  return s.scheduled ? t('reminders.scheduled', { count: s.scheduled }) : t('reminders.nothing')
})

async function toggle () {
  if (busy.value) return
  busy.value = true
  const on = state.reminderPush !== 'on'
  try {
    if (on) {
      // El permiso se pide aquí, al pulsar: el navegador no lo deja pedir sin un gesto.
      const p = await Notification.requestPermission()
      if (p !== 'granted') {
        toast(t('reminders.noPermission'), 'error')
        return
      }
    }
    setReminderPush(on)
    await refreshReminders({ force: true })
    if (state.remindersSync?.state === 'error') {
      // Encender a medias no sirve: se vuelve a como estaba y se dice por qué.
      if (on) setReminderPush(false)
      toast(errorText(state.remindersSync.error), 'error')
      return
    }
    toast(on ? t('reminders.on') : t('reminders.off'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card stack" data-testid="reminders-card">
    <h2 class="label-row">
      <span>{{ t('reminders.settingsTitle') }}</span>
      <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
    </h2>
    <p v-if="info" class="info-text">{{ t('reminders.info') }}</p>

    <label class="row between">
      <span>{{ t('reminders.pushLabel') }}</span>
      <input
        type="checkbox" role="switch"
        :checked="state.reminderPush === 'on'"
        :disabled="busy || !supported || denied"
        data-testid="reminders-push"
        @change.prevent="toggle"
      />
    </label>
    <p v-if="!supported" class="info-text" data-testid="reminders-unsupported">{{ t('reminders.unsupported') }}</p>
    <p v-else-if="denied" class="info-text" data-testid="reminders-denied">{{ t('reminders.denied') }}</p>
    <p v-else class="info-text">{{ t('reminders.privacy') }}</p>
    <p v-if="status" :class="state.remindersSync?.state === 'error' ? 'problem' : 'info-text'" data-testid="reminders-status">{{ status }}</p>
  </section>
</template>
