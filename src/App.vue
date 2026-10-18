<script setup>
import { ref, onMounted } from 'vue'
import '@dotrino/topbar'
import { lang, setLang, t, errorText } from './i18n.js'
import { state, boot } from './state.js'
import { getIdentity } from './services/identity.js'
import { getReputation } from './services/reputation.js'
import { getStore } from './services/store.js'
import MonthView from './components/MonthView.vue'
import SummaryView from './components/SummaryView.vue'
import RecurringView from './components/RecurringView.vue'
import SettingsView from './components/SettingsView.vue'

const TABS = ['month', 'summary', 'recurring', 'settings']
// La pestaña sobrevive a un refresco; abrir la app de cero vuelve al mes (§4).
const TAB_KEY = 'expenses.tab'

const tab = ref(readTab())
const topbar = ref(null)

function readTab () {
  try {
    const v = sessionStorage.getItem(TAB_KEY)
    return TABS.includes(v) ? v : 'month'
  } catch {
    return 'month'
  }
}

function setTab (name) {
  tab.value = name
  try { sessionStorage.setItem(TAB_KEY, name) } catch { /* modo privado */ }
}

function onLang (e) {
  setLang(e.detail.lang)
}

onMounted(() => {
  boot()
  // Identidad del topbar (§6.1), después del primer pintado.
  getIdentity().then(async (id) => {
    topbar.value.identity = id
    // Si la cuenta de este navegador se borra, lo que hay en pantalla ya no existe: se recarga.
    id.onVault?.((e) => { if (e?.phase === 'account-removed') location.reload() })
    topbar.value.reputation = await getReputation()
  }).catch((e) => console.error('[expenses] topbar identity:', e))
  // El estado del respaldo, a la vista en el botón de perfil.
  getStore().then((store) => { topbar.value.store = store })
    .catch((e) => console.error('[expenses] topbar store:', e))
})
</script>

<template>
  <dotrino-topbar
    ref="topbar"
    brand="Expenses"
    icon="./icon.svg"
    support-repo="imdotrino/dotrino-expenses"
    support-discord="https://discord.gg/D648uq7cth"
    profile theme
    @dotrino-lang="onLang"
  >
    <dotrino-install slot="end" class="cc-install sm" :lang="lang"></dotrino-install>
  </dotrino-topbar>

  <nav class="tabs" role="tablist">
    <button
      v-for="name in TABS" :key="name" role="tab" class="tab"
      :aria-selected="tab === name" :data-testid="`tab-${name}`"
      @click="setTab(name)"
    >{{ t(`tabs.${name}`) }}</button>
  </nav>

  <main class="main">
    <p v-if="state.booting" class="muted center">{{ t('boot.loading') }}</p>

    <div v-else-if="state.bootError" class="card error-card" role="alert">
      <p>{{ errorText(state.bootError) }}</p>
      <button class="btn" data-testid="boot-retry" @click="boot">{{ t('boot.retry') }}</button>
    </div>

    <template v-else>
      <MonthView v-if="tab === 'month'" />
      <SummaryView v-else-if="tab === 'summary'" />
      <RecurringView v-else-if="tab === 'recurring'" />
      <SettingsView v-else-if="tab === 'settings'" />
    </template>
  </main>

  <div v-if="state.toast" class="toast" :class="state.toast.kind" role="status" data-testid="toast">{{ state.toast.message }}</div>
</template>
