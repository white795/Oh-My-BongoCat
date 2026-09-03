import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { createPlugin } from '@tauri-store/pinia'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { WINDOW_LABEL } from './constants'
import { i18n } from './locales'
import router from './router'

import 'virtual:uno.css'
import 'antdv-next/dist/reset.css'

import './assets/css/global.scss'

const appWindow = getCurrentWebviewWindow()

if (appWindow.label === WINDOW_LABEL.AMBIENT) {
  void import('./pages/ambient/index.vue').then(({ default: Ambient }) => {
    createApp(Ambient).mount('#app')
  })
} else {
  const pinia = createPinia()
  pinia.use(createPlugin({ saveOnChange: true }))

  createApp(App).use(router).use(pinia).use(i18n).mount('#app')
}
