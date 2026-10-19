<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type ConnectionState = 'checking' | 'connected' | 'disconnected'
const connectionState = ref<ConnectionState>('checking')
const lastChecked = ref<string | null>(null)
let activeRequest: AbortController | null = null

const connectionLabel = computed(() => ({
  checking: '正在连接后端', connected: '后端已连接', disconnected: '后端暂未连接',
})[connectionState.value])
const connectionDescription = computed(() => ({
  checking: '正在检查本地 API 服务，请稍候。',
  connected: '基础 API 通信正常，数据库与 AI 能力尚待接入。',
  disconnected: '请确认后端已启动，然后重新检查连接。',
})[connectionState.value])

async function checkConnection() {
  if (activeRequest) return
  connectionState.value = 'checking'
  const controller = new AbortController()
  activeRequest = controller
  const timeout = window.setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch('/api/health', {
      signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Health check failed')
    const health: unknown = await response.json()
    if (
      typeof health !== 'object' || health === null ||
      !('status' in health) || health.status !== 'ok' ||
      !('service' in health) || health.service !== 'epub-ai-backend'
    ) throw new Error('Unexpected health response')
    connectionState.value = 'connected'
  } catch {
    connectionState.value = 'disconnected'
  } finally {
    window.clearTimeout(timeout)
    activeRequest = null
    lastChecked.value = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date())
  }
}

onMounted(checkConnection)
onUnmounted(() => activeRequest?.abort())
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="EPUB AI 首页">
        <svg class="brand-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M5 6h8a5 5 0 0 1 5 5v16a8 8 0 0 0-6-3H5V6Z" stroke="currentColor" stroke-width="1.7" />
          <path d="M27 6h-4a5 5 0 0 0-5 5v16a8 8 0 0 1 6-3h3V6Z" stroke="currentColor" stroke-width="1.7" />
          <path d="M9 11h4M9 15h4" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span>EPUB <span class="wordmark-ai">AI</span></span>
      </a>
      <span class="development-tag"><span></span>本地开发版</span>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">让好内容，拥有好版式</p>
          <h1 id="hero-title">每一本书，<br />都值得<span class="title-accent">被好好排版。</span></h1>
          <p class="hero-description">用 AI 理解一本书的结构与气质，<br />让章节、正文与细节，自然地统一起来。</p>
          <div class="project-note"><span class="note-line"></span><p>项目已起步。<span>从一页漂亮的书，开始。</span></p></div>
          <div class="principles" aria-label="产品设计目标"><span>保留原文</span><span>统一风格</span><span>专注阅读</span></div>
        </div>

        <div class="book-scene" aria-label="书籍版式静态示意，尚未接入 EPUB 处理">
          <div class="book-backdrop"></div>
          <article class="sample-page">
            <div class="running-header"><span>雨后的远行</span><span>THE QUIET JOURNEY</span></div>
            <div class="chapter-mark">第 七 章</div>
            <h2>归途</h2>
            <div class="chapter-divider" aria-hidden="true"><span></span><i>✦</i><span></span></div>
            <p class="sample-lead">雨停的时候，山间重新有了光。</p>
            <p>他把书合上，望向窗外。屋檐上的水滴沿着旧日的节奏落下，远处的小路，慢慢从雾里显现。</p>
            <p>有些旅程并不为了抵达。走过长长的路，我们才学会，在平常的日子里，看见微小而确定的美。</p>
            <div class="page-footer"><span></span><span>07</span><span></span></div>
          </article>
          <div class="sample-caption"><span class="caption-rule"></span>版式示意 · 原创样章</div>
        </div>
      </section>

      <section class="workspace-status" aria-labelledby="status-heading">
        <div class="status-summary">
          <div class="status-symbol" :class="connectionState" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14v4H5V7Zm0 6h14v4H5v-4Z" stroke="currentColor" stroke-width="1.5" /><path d="M8 9h.01M8 15h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </div>
          <div><h2 id="status-heading">开发环境</h2><p>{{ connectionDescription }}</p></div>
        </div>
        <div class="status-controls">
          <div class="connection-detail" role="status" aria-live="polite" aria-atomic="true">
            <span class="connection-label" :class="connectionState"><i></i>{{ connectionLabel }}</span>
            <span v-if="lastChecked" class="last-checked">检查于 {{ lastChecked }}</span>
          </div>
          <button type="button" class="refresh-button" :disabled="connectionState === 'checking'" @click="checkConnection">
            <svg :class="{ spinning: connectionState === 'checking' }" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.8 8a6 6 0 1 0-.7 5.5M16 3.8V8h-4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            {{ connectionState === 'checking' ? '检查中' : '刷新状态' }}
          </button>
        </div>
      </section>

      <section class="next-step" aria-labelledby="next-heading">
        <div><span class="section-number">01 / NEXT</span><h2 id="next-heading">下一步，让一本真实的书跑通流程。</h2></div>
        <p>上传 EPUB、AI 设计、排版预览与导出将在后续接入。<br />当前页面用于验证前后端连接，书页为静态设计示意。</p>
      </section>
    </main>

    <footer class="site-footer"><span>EPUB AI</span><span>文字有自己的节奏，排版让它被看见。</span></footer>
  </div>
</template>
