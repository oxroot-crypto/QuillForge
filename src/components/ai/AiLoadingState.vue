<template>
  <div class="ai-loading">
    <div class="loading-header">
      <span class="loading-spinner" />
      <span class="loading-label">{{ $t('ai.generating') }}</span>
    </div>
    <div class="shimmer-lines">
      <div class="shimmer-line" :style="{ width: '92%', animationDelay: '0s' }" />
      <div class="shimmer-line" :style="{ width: '100%', animationDelay: '0.15s' }" />
      <div class="shimmer-line" :style="{ width: '67%', animationDelay: '0.3s' }" />
      <div class="shimmer-line" :style="{ width: '88%', animationDelay: '0.45s' }" />
      <div class="shimmer-line" :style="{ width: '54%', animationDelay: '0.6s' }" />
    </div>
  </div>
</template>

<style scoped>
.ai-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
}

.loading-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
  animation: pulse-text 1.8s ease-in-out infinite;
}

.shimmer-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shimmer-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    var(--color-hover) 50%,
    var(--color-border) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
