// 主题 Store——亮/暗模式切换，应用 CSS 变量 data-theme 属性，跟随系统偏好。
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'dark' | 'light'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(
    (localStorage.getItem('quillforge-theme') as Theme) || 'dark',
  )

  function apply() {
    document.documentElement.setAttribute('data-theme', theme.value)
    localStorage.setItem('quillforge-theme', theme.value)
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply()
  }

  function setTheme(t: Theme) {
    theme.value = t
    apply()
  }

  // Apply on init
  apply()

  return { theme, apply, toggle, setTheme }
})
