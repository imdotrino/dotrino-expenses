import { createApp } from 'vue'
import App from './App.vue'
import '@dotrino/theme/theme.css'
import './style.css'
// Botón «Instalar» PWA unificado (§3). La barra superior se importa en App.vue.
import '@dotrino/install'
import { createBackNav } from '@dotrino/nav'
import { registerSW } from 'virtual:pwa-register'

// SW con auto-actualización real: recarga al tomar control el SW nuevo y re-chequea
// cada 30 min (si no, la PWA instalada se queda en la versión vieja).
registerSW({
  immediate: true,
  onRegisteredSW (_url, reg) {
    if (!reg) return
    setInterval(() => { reg.update().catch((e) => console.error('[expenses] sw update:', e)) }, 30 * 60_000)
  },
})

createBackNav()

createApp(App).mount('#app')
