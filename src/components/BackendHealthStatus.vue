<script setup lang="ts">
import { computed } from 'vue'
import { ApiError } from '@/api/errors'
import type { DependencyState } from '@/api/health'
import { useHealth } from '@/composables/useHealth'

const { data, error, isFetching, isError, isPending, isPaused, dataUpdatedAt, refetch } =
  useHealth()
const connectionState = computed(() =>
  isPaused.value || isError.value
    ? 'disconnected'
    : isFetching.value || isPending.value
      ? 'checking'
      : 'connected',
)
const connectionLabel = computed(
  () =>
    ({ checking: '正在连接后端', connected: '后端已连接', disconnected: '后端暂未连接' })[
      connectionState.value
    ],
)
const lastChecked = computed(() =>
  dataUpdatedAt.value
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(dataUpdatedAt.value)
    : null,
)
const errorMessage = computed(() =>
  error.value instanceof ApiError ? error.value.message : '暂时无法连接服务，请稍后重试。',
)
const requestId = computed(() =>
  error.value instanceof ApiError ? error.value.requestId : undefined,
)
const dependencyLabels: Record<DependencyState, string> = {
  disabled: '未启用',
  not_configured: '待配置',
  configured_not_checked: '已配置 · 未检测',
  connected: '已连接',
  unavailable: '暂不可用',
}
const dependencies = computed(() => {
  if (!data.value) return []
  const states = data.value.dependencies
  return [
    { name: '数据库', state: states.database },
    { name: '千问', state: states.qwen },
    ...(states.queue ? [{ name: '任务队列', state: states.queue }] : []),
  ]
})
</script>

<template>
  <section class="workspace-status" aria-labelledby="status-heading">
    <div class="status-summary">
      <div class="status-symbol" :class="connectionState" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 7h14v4H5V7Zm0 6h14v4H5v-4Z" stroke="currentColor" stroke-width="1.5" />
          <path
            d="M8 9h.01M8 15h.01"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div>
        <h2 id="status-heading">开发环境</h2>
        <p v-if="isFetching">正在检查本地 API 服务，请稍候。</p>
        <template v-else-if="isError || isPaused">
          <p>{{ errorMessage }}</p>
          <p v-if="requestId" class="request-id">请求编号：{{ requestId }}</p>
        </template>
        <template v-else>
          <p>基础 API 在线；此检查不代表书籍处理或 AI 功能已可用。</p>
          <ul class="dependency-list" aria-label="后端依赖状态">
            <li v-for="dependency in dependencies" :key="dependency.name">
              {{ dependency.name }}：{{ dependencyLabels[dependency.state] }}
            </li>
          </ul>
        </template>
      </div>
    </div>
    <div class="status-controls">
      <div class="connection-detail" role="status" aria-live="polite" aria-atomic="true">
        <span class="connection-label" :class="connectionState"><i></i>{{ connectionLabel }}</span>
        <span v-if="lastChecked && !isError && !isPaused" class="last-checked"
          >检查于 {{ lastChecked }}</span
        >
      </div>
      <button type="button" class="refresh-button" :disabled="isFetching" @click="refetch()">
        <svg :class="{ spinning: isFetching }" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15.8 8a6 6 0 1 0-.7 5.5M16 3.8V8h-4.2"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ isFetching ? '检查中' : '刷新状态' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.workspace-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: #fcfcf7;
  border: 1px solid #e1e4d7;
  border-radius: 5px;
  padding: 24px 28px;
}
.status-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}
.status-symbol {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  background: #ecefe5;
  color: #6a8064;
  border-radius: 7px;
  flex-shrink: 0;
}
.status-symbol.disconnected {
  color: #a97b50;
  background: #f4eee1;
}
.status-symbol svg {
  width: 24px;
  height: 24px;
}
.status-summary h2 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 3px;
}
.status-summary p {
  color: #87907e;
  margin: 0;
  font-size: 12px;
}
.status-controls {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-shrink: 0;
}
.connection-detail {
  display: grid;
  gap: 3px;
  justify-items: end;
}
.connection-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5e7b54;
}
.connection-label i {
  background: currentColor;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.connection-label.checking {
  color: #7b836d;
}
.connection-label.disconnected {
  color: #a5794b;
}
.last-checked {
  font-size: 10px;
  color: #9b9f91;
  font-variant-numeric: tabular-nums;
}
.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: #52634c;
  font-size: 12px;
  border: 1px solid #d7ddcc;
  border-radius: 4px;
  padding: 9px 13px;
  transition:
    border-color 0.15s,
    background 0.15s;
  white-space: nowrap;
}
.refresh-button:not(:disabled):hover {
  border-color: #9eac91;
  background: #f1f3e9;
}
.refresh-button svg {
  width: 17px;
  height: 17px;
}
.spinning {
  animation: spin 1s linear infinite;
}
@media (max-width: 1000px) {
  .workspace-status {
    padding: 22px;
  }
  .status-summary p {
    max-width: 240px;
  }
  .status-controls {
    gap: 18px;
  }
}
@media (max-width: 720px) {
  .workspace-status {
    flex-direction: column;
    align-items: stretch;
    gap: 21px;
  }
  .status-summary p {
    max-width: none;
  }
  .status-controls {
    justify-content: space-between;
    border-top: 1px solid #e8ebdf;
    padding-top: 17px;
  }
  .connection-detail {
    justify-items: start;
  }
}
.dependency-list {
  display: flex;
  gap: 6px 15px;
  flex-wrap: wrap;
  margin: 7px 0 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  color: #6f7c64;
}
.status-summary .request-id {
  margin-top: 5px;
  font-size: 10px;
  overflow-wrap: anywhere;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
