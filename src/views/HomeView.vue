<script setup lang="ts">
import { copy } from '@/content/en'
import KindlePreview from '@/components/KindlePreview.vue'
import { publicEnv } from '@/config/env'

const features = [
  {
    number: '01',
    title: copy.structureTitle,
    description: copy.structureDescription,
    note: 'A SENSE OF STRUCTURE',
  },
  {
    number: '02',
    title: copy.readerTitle,
    description: copy.readerDescription,
    note: 'READ YOUR OWN WAY',
  },
  {
    number: '03',
    title: copy.preservationTitle,
    description: copy.preservationDescription,
    note: 'SAME WORDS, NEW FEELING',
  },
]
</script>

<template>
  <main class="epub-main">
    <section class="epub-hero" aria-labelledby="epub-title">
      <div class="epub-hero-copy">
        <div class="epub-eyebrow">
          <span aria-hidden="true"></span>{{ copy.homeEyebrow }}
          <span v-if="publicEnv.publicBeta" class="epub-beta-badge">{{ copy.publicBeta }}</span>
        </div>
        <h1 id="epub-title">
          {{ copy.heroFirst }}<br /><span>{{ copy.heroSecond }}</span>
        </h1>
        <p class="epub-description">
          {{ copy.heroDescriptionFirst }}<br />
          {{ copy.heroDescriptionSecond }}
        </p>
        <div class="epub-actions" :aria-label="copy.actionsLabel">
          <RouterLink class="epub-action epub-primary" :to="{ name: 'upload' }">
            {{ copy.start }}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
          </RouterLink>
          <button class="epub-action epub-secondary" type="button" disabled>
            {{ copy.viewExample }}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 18 18 6M6 6h12v12" />
            </svg>
          </button>
        </div>
        <div class="epub-hero-footnote">
          <span class="epub-fine-star" aria-hidden="true">✳</span>
          <span>{{ copy.oneStyle }}</span>
        </div>
      </div>
      <KindlePreview />
    </section>
    <section class="epub-features" aria-labelledby="epub-features-title">
      <div class="epub-features-heading">
        <h2 id="epub-features-title">{{ copy.detailsTitle }}</h2>
        <span>SMALL DETAILS. A BETTER READ.</span>
      </div>
      <div class="epub-feature-row">
        <article v-for="feature in features" :key="feature.number" class="epub-feature">
          <span class="epub-feature-number">{{ feature.number }}<i aria-hidden="true"></i></span>
          <div class="epub-feature-content">
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
            <span>{{ feature.note }}</span>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.epub-main {
  width: 100%;
  max-width: 1296px;
  margin: 0 auto;
  flex: 1;
}
.epub-hero {
  min-height: 670px;
  display: grid;
  grid-template-columns: 1.08fr 1fr;
  align-items: center;
  gap: 28px;
}
.epub-hero-copy {
  position: relative;
  padding-bottom: 11px;
}
.epub-eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  color: #787566;
  font-size: 11px;
  letter-spacing: 1.2px;
  margin-bottom: 34px;
}
.epub-eyebrow > span {
  display: block;
  width: 25px;
  height: 1px;
  background: var(--epub-copper);
}
.epub-eyebrow > .epub-beta-badge {
  width: auto;
  height: auto;
  padding: 3px 6px;
  border: 1px solid #c6c9b9;
  border-radius: 2px;
  background: transparent;
  white-space: nowrap;
  font-size: 10px;
  letter-spacing: 0;
}
.epub-hero h1 {
  font-family: var(--epub-serif);
  font-size: clamp(42px, 4.5vw, 65px);
  font-weight: 500;
  line-height: 1.38;
  letter-spacing: -2px;
}
.epub-hero h1 > span {
  color: var(--epub-copper);
}
.epub-description {
  font-size: 15px;
  line-height: 2.1;
  color: #74776a;
  margin-top: 29px;
  letter-spacing: 0.15px;
}
.epub-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 13px;
  margin-top: 35px;
}
.epub-actions > .epub-action {
  text-decoration: none;
  height: 50px;
  padding: 0 23px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 26px;
  font-size: 13px;
  letter-spacing: 0.5px;
  border-radius: 2px;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.2s;
}
.epub-actions > .epub-action > svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.epub-primary {
  color: #f9f7ef;
  background: var(--epub-ink);
  border: 1px solid var(--epub-ink);
}
.epub-primary:hover {
  background: #414536;
  border-color: #414536;
  transform: translateY(-2px);
}
.epub-secondary {
  color: var(--epub-ink);
  background: transparent;
  border: 1px solid #c8c9b9;
}
.epub-secondary:hover {
  background: #edece1;
  border-color: #a6aa97;
  transform: translateY(-2px);
}
.epub-hero-footnote {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 33px;
  color: #8e9181;
  font-size: 10px;
  letter-spacing: 0.6px;
}
.epub-fine-star {
  color: #a4a58e;
  font-size: 16px;
  line-height: 1;
}
.epub-features {
  border-top: 1px solid #c5c8b6;
  border-bottom: 1px solid var(--epub-line);
  padding: 27px 0 33px;
  scroll-margin-top: 24px;
}
.epub-features-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 29px;
}
.epub-features-heading > h2 {
  font-family: var(--epub-serif);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.4px;
}
.epub-features-heading > span {
  font-size: 7px;
  letter-spacing: 1.8px;
  color: #999f8a;
}
.epub-feature-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.epub-feature {
  min-width: 0;
  display: flex;
  gap: 23px;
  padding-right: 35px;
}
.epub-feature + .epub-feature {
  padding-left: 39px;
  border-left: 1px solid var(--epub-line);
}
.epub-feature-number {
  flex-shrink: 0;
  color: var(--epub-copper);
  font-family: var(--epub-serif);
  font-style: italic;
  font-size: 14px;
  line-height: 1.5;
  padding-top: 1px;
}
.epub-feature-number > i {
  display: block;
  width: 13px;
  height: 1px;
  background: #c3b498;
  margin-top: 9px;
}
.epub-feature-content h3 {
  font-family: var(--epub-serif);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.3px;
  line-height: 1.5;
}
.epub-feature-content p {
  white-space: pre-line;
  font-size: 11px;
  line-height: 1.95;
  color: #858a78;
  margin-top: 9px;
}
.epub-feature-content > span {
  display: block;
  font-size: 6.5px;
  letter-spacing: 1.4px;
  color: #a3a891;
  margin-top: 14px;
}
@media (max-width: 1190px) and (min-width: 801px) {
  .epub-hero {
    grid-template-columns: 1.12fr 1fr;
    gap: 8px;
    min-height: 640px;
  }
  .epub-hero h1 {
    font-size: clamp(37px, 4.4vw, 52px);
    letter-spacing: -1.6px;
  }
  .epub-eyebrow {
    font-size: 9px;
    gap: 8px;
    letter-spacing: 0.3px;
  }
  .epub-description {
    font-size: 12px;
  }
  .epub-actions {
    gap: 9px;
  }
  .epub-actions > .epub-action {
    padding: 0 14px;
    gap: 13px;
    font-size: 11px;
  }
  .epub-feature {
    gap: 14px;
    padding-right: 18px;
  }
  .epub-feature + .epub-feature {
    padding-left: 21px;
  }
  .epub-feature-content h3 {
    font-size: 14px;
  }
  .epub-feature-content p {
    font-size: 10px;
  }
}
@media (max-width: 800px) {
  .epub-hero {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-height: 0;
  }
  .epub-hero-copy {
    padding: 63px 0 14px;
  }
  .epub-eyebrow {
    margin-bottom: 24px;
    font-size: 10px;
    letter-spacing: 0.4px;
  }
  .epub-hero h1 {
    font-size: clamp(37px, 6.8vw, 56px);
    line-height: 1.4;
    letter-spacing: -1.5px;
  }
  .epub-description {
    font-size: 13px;
    margin-top: 24px;
  }
  .epub-actions {
    margin-top: 29px;
    gap: 12px;
  }
  .epub-actions > .epub-action {
    height: 48px;
    padding: 0 21px;
    gap: 25px;
    font-size: 12px;
  }
  .epub-hero-footnote {
    margin-top: 26px;
    font-size: 9px;
  }
  .epub-features {
    padding: 29px 0 0;
    margin-top: 25px;
  }
  .epub-features-heading {
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 22px;
  }
  .epub-features-heading > h2 {
    font-size: 14px;
  }
  .epub-features-heading > span {
    max-width: 100px;
    font-size: 6px;
    line-height: 1.8;
    text-align: right;
    letter-spacing: 1.2px;
  }
  .epub-feature-row {
    display: block;
  }
  .epub-feature,
  .epub-feature + .epub-feature {
    border-left: 0;
    padding: 25px 0;
    gap: 22px;
  }
  .epub-feature + .epub-feature {
    border-top: 1px solid var(--epub-line);
  }
  .epub-feature-number {
    padding-top: 1px;
    min-width: 23px;
  }
  .epub-feature-content h3 {
    font-size: 18px;
  }
  .epub-feature-content p {
    white-space: normal;
    font-size: 12px;
    margin-top: 8px;
  }
  .epub-feature-content > span {
    margin-top: 11px;
  }
}
@media (max-width: 400px) {
  .epub-hero-copy {
    padding-top: 47px;
  }
  .epub-eyebrow {
    font-size: 8.7px;
    gap: 8px;
    letter-spacing: 0;
  }
  .epub-eyebrow > span {
    width: 17px;
  }
  .epub-hero h1 {
    font-size: 35px;
    letter-spacing: -1.8px;
  }
  .epub-description {
    font-size: 11px;
    line-height: 2.05;
  }
  .epub-actions {
    gap: 8px;
  }
  .epub-actions > .epub-action {
    padding: 0 13px;
    gap: 14px;
    font-size: 10px;
    height: 45px;
  }
  .epub-actions > .epub-action > svg {
    width: 15px;
    height: 15px;
  }
  .epub-hero-footnote {
    font-size: 8px;
    gap: 6px;
  }
  .epub-features-heading > h2 {
    font-size: 12px;
  }
  .epub-features-heading > span {
    font-size: 5px;
    max-width: 82px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .epub-primary:hover,
  .epub-secondary:hover {
    transform: none;
  }
}
.epub-actions > .epub-action:disabled {
  cursor: default;
}
</style>
