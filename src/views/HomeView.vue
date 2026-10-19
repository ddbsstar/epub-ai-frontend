<script setup lang="ts">
import BackendHealthStatus from '@/components/BackendHealthStatus.vue'
</script>

<template>
  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">让好内容，拥有好版式</p>
        <h1 id="hero-title">
          每一本书，<br />都值得<span class="title-accent">被好好排版。</span>
        </h1>
        <p class="hero-description">
          用 AI 理解一本书的结构与气质，<br />让章节、正文与细节，自然地统一起来。
        </p>
        <div class="project-note">
          <span class="note-line"></span>
          <p>项目已起步。<span>从一页漂亮的书，开始。</span></p>
        </div>
        <div class="principles" aria-label="产品设计目标">
          <span>保留原文</span><span>统一风格</span><span>专注阅读</span>
        </div>
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
          <p>
            有些旅程并不为了抵达。走过长长的路，我们才学会，在平常的日子里，看见微小而确定的美。
          </p>
          <div class="page-footer"><span></span><span>07</span><span></span></div>
        </article>
        <div class="sample-caption"><span class="caption-rule"></span>版式示意 · 原创样章</div>
      </div>
    </section>

    <BackendHealthStatus />

    <section class="next-step" aria-labelledby="next-heading">
      <div>
        <span class="section-number">01 / NEXT</span>
        <h2 id="next-heading">下一步，让一本真实的书跑通流程。</h2>
      </div>
      <p>
        上传 EPUB、AI 设计、排版预览与导出将在后续接入。<br />当前页面用于验证前后端连接，书页为静态设计示意。
      </p>
    </section>
  </main>
</template>
