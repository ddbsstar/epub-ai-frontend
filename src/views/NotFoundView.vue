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
