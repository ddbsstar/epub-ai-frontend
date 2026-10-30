<script setup lang="ts">
import { copy } from '@/content/en'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isUploadPage = computed(() => ['upload', 'illustrate'].includes(String(route.name)))
</script>

<template>
  <div class="epub-page" :class="{ 'epub-page--upload': isUploadPage }">
    <header class="epub-header">
      <RouterLink class="epub-brand" :to="{ name: 'home' }" :aria-label="copy.homeLabel">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M4 6h7a6 6 0 0 1 6 6v15a9 9 0 0 0-6-3H4V6ZM28 6h-5a6 6 0 0 0-6 6v15a9 9 0 0 1 6-3h5V6Z"
          />
          <path d="M8 11h4M8 15h4" />
        </svg>
        <span>EPUB <span class="epub-brand-ai">AI</span></span>
      </RouterLink>
      <nav v-if="isUploadPage" class="epub-nav epub-breadcrumb" :aria-label="copy.breadcrumbLabel">
        <RouterLink :to="{ name: 'home' }">{{ copy.home }}</RouterLink>
        <span class="epub-nav-divider" aria-hidden="true">/</span>
        <span aria-current="page">{{
          route.name === 'illustrate' ? copy.illustrationLab : copy.start
        }}</span>
      </nav>
      <nav v-else class="epub-nav" :aria-label="copy.navLabel">
        <button type="button" disabled>{{ copy.examples }}</button>
        <span class="epub-nav-divider" aria-hidden="true">/</span>
        <button type="button" disabled>{{ copy.features }}</button>
      </nav>
    </header>
    <RouterView />
    <footer class="epub-footer">
      <span>EPUB AI<span class="epub-footer-dot">·</span>MADE FOR THE LOVE OF READING</span>
      <span>{{ copy.footer }}</span>
    </footer>
  </div>
</template>

<style scoped>
.epub-page {
  --epub-paper: #f7f4ec;
  --epub-ink: #242720;
  --epub-copper: #a45f3b;
  --epub-muted: #77796b;
  --epub-line: #deddd1;
  --epub-serif: 'EPUB Serif', 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  --epub-sans: 'EPUB Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  isolation: isolate;
  width: 100%;
  min-width: 0;
  min-height: 1120px;
  padding: 0 72px;
  display: flex;
  flex-direction: column;
  overflow-x: clip;
  background: var(--epub-paper);
  color: var(--epub-ink);
  font-family: var(--epub-sans);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
.epub-header {
  width: 100%;
  max-width: 1296px;
  height: 104px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--epub-line);
}
.epub-brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  font-size: 23px;
  letter-spacing: -0.7px;
  font-weight: 500;
  color: inherit;
  text-decoration: none;
}
.epub-brand > svg {
  width: 29px;
  height: 29px;
  stroke: currentColor;
  stroke-width: 1.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.epub-brand-ai {
  color: var(--epub-copper);
  font-family: var(--epub-serif);
  font-style: italic;
  font-weight: 400;
}
.epub-nav {
  display: flex;
  align-items: center;
  gap: 25px;
  font-size: 12px;
  letter-spacing: 0.8px;
  color: #5e6256;
}
.epub-nav > .epub-nav-divider {
  font-family: var(--epub-serif);
  font-size: 17px;
  color: #b5b6a7;
}
.epub-breadcrumb {
  color: #929285;
}
.epub-breadcrumb a {
  text-decoration: none;
  text-underline-offset: 4px;
}
.epub-breadcrumb a:hover {
  color: var(--epub-copper);
  text-decoration: underline;
}
.epub-breadcrumb [aria-current] {
  color: #5e6256;
}
.epub-footer {
  width: 100%;
  max-width: 1296px;
  min-height: 79px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  color: #949b86;
  font-size: 8px;
  letter-spacing: 0.9px;
}
.epub-footer > span:first-child {
  font-size: 7px;
  letter-spacing: 1px;
}
.epub-footer-dot {
  display: inline-block;
  padding: 0 9px;
  color: var(--epub-copper);
}
@media (max-width: 800px) {
  .epub-header {
    height: 87px;
  }
  .epub-brand {
    font-size: 21px;
    gap: 9px;
  }
  .epub-brand > svg {
    width: 26px;
    height: 26px;
  }
  .epub-nav {
    gap: 15px;
    font-size: 10px;
  }
  .epub-footer {
    min-height: 103px;
    gap: 24px;
    align-items: flex-start;
    padding: 28px 0;
    font-size: 7px;
    line-height: 1.8;
  }
  .epub-footer > span:first-child {
    font-size: 6px;
    max-width: 160px;
  }
  .epub-footer > span:last-child {
    text-align: right;
    max-width: 130px;
  }
}
@media (max-width: 400px) {
  .epub-header {
    height: 76px;
  }
  .epub-brand {
    font-size: 19px;
    gap: 7px;
  }
  .epub-nav {
    gap: 9px;
    font-size: 9px;
    letter-spacing: 0.1px;
  }
}
.epub-nav button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  padding: 8px 0;
  cursor: default;
}

@media (min-width: 1600px) {
  .epub-page {
    min-height: 100vh;
  }
}
@media (max-width: 1190px) and (min-width: 801px) {
  .epub-page {
    padding: 0 42px;
  }
}
@media (max-width: 800px) {
  .epub-page {
    padding: 0 27px;
    min-height: 100vh;
  }
}
@media (max-width: 400px) {
  .epub-page {
    padding: 0 20px;
  }
}

.epub-page--upload .epub-footer {
  min-height: 72px;
  border-top: 1px solid var(--epub-line);
}
.epub-page--upload .epub-footer > span:first-child {
  letter-spacing: 1.5px;
}
.epub-page--upload .epub-footer > span:last-child {
  font-family: var(--epub-serif);
  font-size: 10px;
  letter-spacing: 1px;
}
@media (min-width: 801px) {
  .epub-page--upload {
    min-height: max(1080px, 100vh);
  }
}
@media (max-width: 800px) {
  .epub-page--upload {
    padding: 0 27px;
  }
  .epub-page--upload .epub-header {
    height: 87px;
  }
  .epub-page--upload .epub-brand {
    font-size: 22px;
    gap: 8px;
  }
  .epub-page--upload .epub-brand > svg {
    width: 29px;
    height: 29px;
  }
  .epub-page--upload .epub-breadcrumb {
    font-size: 10px;
    gap: 12px;
  }
  .epub-page--upload .epub-footer {
    min-height: 100px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 18px 0;
  }
  .epub-page--upload .epub-footer > span:first-child {
    max-width: none;
    font-size: 6px;
    letter-spacing: 1px;
    text-align: center;
  }
  .epub-page--upload .epub-footer > span:last-child {
    max-width: none;
    font-size: 9px;
    letter-spacing: 0.6px;
    text-align: center;
  }
}
@media (max-width: 370px) {
  .epub-page--upload {
    padding: 0 20px;
  }
  .epub-page--upload .epub-header {
    height: 76px;
  }
  .epub-page--upload .epub-brand {
    font-size: 20px;
  }
  .epub-page--upload .epub-brand > svg {
    width: 25px;
    height: 25px;
  }
  .epub-page--upload .epub-breadcrumb {
    font-size: 9px;
    gap: 9px;
  }
}
</style>
