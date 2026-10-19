<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink class="wordmark" :to="{ name: 'home' }" aria-label="EPUB AI 首页">
        <svg class="brand-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M5 6h8a5 5 0 0 1 5 5v16a8 8 0 0 0-6-3H5V6Z"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <path
            d="M27 6h-4a5 5 0 0 0-5 5v16a8 8 0 0 1 6-3h3V6Z"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <path d="M9 11h4M9 15h4" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span>EPUB <span class="wordmark-ai">AI</span></span>
      </RouterLink>
      <span class="development-tag"><span></span>项目开发中</span>
    </header>
    <RouterView />
    <footer class="site-footer">
      <span>EPUB AI</span><span>文字有自己的节奏，排版让它被看见。</span>
    </footer>
  </div>
</template>
