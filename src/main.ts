import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from '@/i18n'
import App from '@/App.vue'
import '@/style.css'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')

// Init theme
const themeStore = useThemeStore()
themeStore.apply()
