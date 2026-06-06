<!-- 三点加载动画——CSS 脉动效果，展示"思考中…"文本，用于各种加载状态的通用占位组件 -->
<template>
  <span class="loading-dots">
    <span>{{ $t('ai.thinking') }}</span>
    <span class="dot">.</span>
    <span class="dot">.</span>
    <span class="dot">.</span>
  </span>
</template>

<style scoped>
.loading-dots {
  display: inline-flex;
  align-items: center;
}

.dot {
  animation: blink 1.4s infinite both;
}

.dot:nth-child(2) { animation-delay: 0s; }
.dot:nth-child(3) { animation-delay: 0.2s; }
.dot:nth-child(4) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}
</style>
