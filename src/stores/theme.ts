// 主题 Store——亮/暗模式切换，应用 CSS 变量 data-theme 属性，跟随系统偏好。
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Theme } from '@/types'

export const useThemeStore = defineStore('theme', () => {
  // ===== 核心状态 =====
  /** 当前主题——从 localStorage 读取，默认跟随暗色模式 */
  const theme = ref<Theme>(
    (localStorage.getItem('quillforge-theme') as Theme) || 'dark',
  )

  // ===== 主题操作 =====
  /** 将当前主题应用到 document 根元素并持久化到 localStorage */
  function apply() {
    document.documentElement.setAttribute('data-theme', theme.value)
    localStorage.setItem('quillforge-theme', theme.value)
  }

  /** 切换亮/暗主题 */
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply()
  }

  /** 直接设置指定主题 */
  function setTheme(t: Theme) {
    theme.value = t
    apply()
  }

  // 初始化时立即应用主题
  apply()

  // ===== 导出 =====
  return { theme, apply, toggle, setTheme }
})
