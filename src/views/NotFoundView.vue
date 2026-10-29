<template>
  <main class="not-found">
    <p class="eyebrow">404 / PAGE NOT FOUND</p>
    <h1>这一页，还没有写下。</h1>
    <p class="hero-description">你访问的页面不存在，可以回首页继续。</p>
    <RouterLink class="home-link" :to="{ name: 'home' }"
      >返回首页 <span aria-hidden="true">↗</span></RouterLink
    >
  </main>
</template>

<style scoped>
.not-found {
  width: 100%;
  max-width: 1296px;
  margin: 0 auto;
  min-height: 65vh;
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  gap: 24px;
  padding: 60px 0;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  color: #787566;
}
h1 {
  font-family: var(--epub-serif);
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 500;
  line-height: 1.5;
}
.hero-description {
  color: #74776a;
  font-size: 14px;
}
.home-link {
  display: inline-flex;
  gap: 30px;
  color: var(--epub-copper);
  text-underline-offset: 5px;
  font-size: 14px;
}
</style>
