<script setup lang="ts">
import { copy } from '@/content/en'
</script>

<template>
  <section class="epub-device-stage" id="epub-design" :aria-label="copy.demoLabel">
    <div class="epub-device-note"><span>THE ART OF A QUIET PAGE</span><i></i></div>
    <div class="epub-device-floor" aria-hidden="true"></div>
    <div class="epub-kindle-perspective">
      <div class="epub-kindle-body">
        <div class="epub-kindle-back" aria-hidden="true"></div>
        <div class="epub-kindle-side" aria-hidden="true"></div>
        <div class="epub-kindle-front">
          <div class="epub-kindle-screen">
            <article class="epub-reader-page epub-reader-after" :aria-label="copy.demoArticleLabel">
              <div class="epub-reader-running">
                {{ copy.demoBook }}<span>AN ORIGINAL SAMPLE</span>
              </div>
              <svg class="epub-botanical" viewBox="0 0 100 64" fill="none" aria-hidden="true">
                <path
                  d="M49 57c1-17 1-32 8-49M50 44C37 36 27 30 17 20M51 35c14-7 24-12 33-22M48 54C37 50 28 45 23 38"
                />
                <path
                  d="M55 15c-7-7-6-12-4-14 6 5 9 9 4 14ZM53 27c-7-3-11-8-10-13 8 1 14 6 10 13ZM59 21c8-1 13-5 13-11-8 1-12 5-13 11ZM64 29c7 4 14 2 18-2-8-4-13-4-18 2ZM33 32c-2-9-7-15-13-16-1 8 4 15 13 16ZM26 26c-8 2-16 0-20-5 8-3 15-1 20 5ZM40 39c0-7-3-12-8-15-3 7 0 12 8 15ZM36 48c-2-8-5-12-10-13-1 7 2 12 10 13ZM30 45c-6 2-12 0-16-4 7-2 12-1 16 4Z"
                />
                <path
                  d="M50 58c9-7 15-10 23-11M61 52c2-6 5-10 10-10 0 6-3 9-10 10ZM67 49c5 4 10 4 14 1-5-4-9-5-14-1Z"
                />
              </svg>
              <p class="epub-reader-chapter">{{ copy.demoChapter }}</p>
              <h2>{{ copy.demoHeading }}</h2>
              <div class="epub-reader-rule" aria-hidden="true">
                <span></span><i>✧</i><span></span>
              </div>
              <p class="epub-reader-lead">{{ copy.demoLead }}</p>
              <p class="epub-reader-prose">
                {{ copy.demoProseFirst }}
              </p>
              <blockquote>{{ copy.demoQuote }}</blockquote>
              <p class="epub-reader-prose">
                {{ copy.demoProseSecond }}
              </p>
              <div class="epub-reader-folio">— &nbsp; 07 &nbsp; —</div>
            </article>
          </div>
          <span class="epub-kindle-logo" aria-hidden="true">kindle<span></span></span>
        </div>
      </div>
    </div>
    <div class="epub-comparison">
      <div class="epub-comparison-copy">
        <span class="epub-comparison-index">01</span>
        <p>
          {{ copy.demoSame }}<br /><strong>{{ copy.demoFeeling }}</strong>
        </p>
      </div>
      <div class="epub-switch">
        <span class="epub-switch-label">{{ copy.demoOriginal }}</span>
        <span class="epub-switch-label is-active"
          >{{ copy.demoAfter }}<span aria-hidden="true">✦</span></span
        >
      </div>
    </div>
    <p class="epub-device-disclaimer">{{ copy.demoDisclaimer }}</p>
  </section>
</template>

<style scoped>
.epub-device-stage {
  font-family: var(--epub-sans);
}
.epub-device-stage *,
.epub-device-stage *::before,
.epub-device-stage *::after {
  box-sizing: border-box;
}
.epub-device-stage p {
  margin: 0;
}
.epub-device-stage h2 {
  margin: 0;
}
.epub-device-stage:focus-visible {
  outline: 2px solid var(--epub-copper);
  outline-offset: 5px;
}
.epub-device-stage {
  position: relative;
  height: 620px;
  min-width: 0;
  align-self: center;
  scroll-margin-top: 24px;
  outline-offset: 0;
  border-radius: 3px;
}
.epub-device-note {
  position: absolute;
  top: 30px;
  right: 21px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #9b9c8c;
  font-size: 8px;
  letter-spacing: 1.8px;
}
.epub-device-note > i {
  display: block;
  width: 27px;
  height: 1px;
  background: #c5c7b7;
}
.epub-device-floor {
  position: absolute;
  width: 310px;
  height: 54px;
  border-radius: 50%;
  background: #333b261d;
  filter: blur(21px);
  left: 51%;
  top: 483px;
  transform: translateX(-48%) rotate(-4deg);
}
.epub-kindle-perspective {
  position: absolute;
  top: 67px;
  left: 52%;
  width: 330px;
  height: 466px;
  perspective: 1500px;
  transform: translateX(-50%);
}
.epub-kindle-body {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateY(-19deg) rotateX(6deg) rotateZ(8deg);
  transition: transform 0.65s cubic-bezier(0.22, 0.7, 0.28, 1);
}
.epub-kindle-perspective:hover .epub-kindle-body {
  transform: rotateY(-14deg) rotateX(4deg) rotateZ(6deg) translateY(-5px);
}
.epub-kindle-back {
  position: absolute;
  inset: 1px -6px -5px 4px;
  border-radius: 23px;
  background: #161a17;
  transform: translateZ(-13px);
  box-shadow:
    10px 12px 8px -5px #1e251b33,
    22px 29px 35px -17px #27302040;
}
.epub-kindle-side {
  position: absolute;
  top: 9px;
  right: -9px;
  bottom: 5px;
  width: 18px;
  border-radius: 2px 14px 13px 2px;
  background: linear-gradient(90deg, #343b32, #121612 75%, #42483d);
  transform: translateZ(-5px) skewY(15deg);
}
.epub-kindle-front {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 22px;
  padding: 16px 16px 51px;
  background: linear-gradient(115deg, #3b4038 0%, #252b25 18%, #222821 79%, #171d17 100%);
  border: 1px solid #474f40;
  box-shadow:
    inset 1px 1px 1px #ffffff3d,
    inset -1px -2px 2px #00000070,
    0 0 0 1px #11150f;
  backface-visibility: hidden;
}
.epub-kindle-screen {
  width: 100%;
  height: 100%;
  background: #eeeee2;
  overflow: hidden;
  border-radius: 3px;
  border: 1px solid #10150d;
  box-shadow:
    inset 0 0 8px #313a2330,
    0 1px 0 #616753;
}
.epub-kindle-logo {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  color: #7f8779;
  font-family: var(--epub-sans);
  font-size: 18px;
  letter-spacing: -0.9px;
  font-weight: 400;
}
.epub-kindle-logo > span {
  position: absolute;
  bottom: -3px;
  left: 17px;
  width: 27px;
  height: 5px;
  border-bottom: 1px solid #7f8779;
  border-radius: 0 0 70% 60%;
  transform: rotate(-9deg);
}
.epub-reader-page {
  width: 100%;
  min-height: 100%;
  padding: 18px 23px 14px;
  color: #333a2c;
  font-family: var(--epub-serif);
  font-size: 10.6px;
  line-height: 1.9;
  background-image: repeating-linear-gradient(
    0deg,
    #b4b6a005 0,
    #b4b6a005 1px,
    transparent 1px,
    transparent 3px
  );
}
.epub-reader-after {
  font-family: var(--epub-serif);
}
.epub-reader-running {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #737c66;
  padding-bottom: 9px;
  border-bottom: 1px solid #b9c0ab;
  font-size: 7px;
  letter-spacing: 0.7px;
}
.epub-reader-running > span {
  font-family: var(--epub-sans);
  font-size: 5px;
  letter-spacing: 0.9px;
}
.epub-botanical {
  display: block;
  width: 72px;
  height: 36px;
  margin: 12px auto 5px;
  stroke: #545f44;
  stroke-width: 0.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.epub-reader-page .epub-reader-chapter {
  text-align: center;
  font-size: 8px;
  letter-spacing: 3px;
  color: #7b846b;
}
.epub-reader-page h2 {
  text-align: center;
  font-family: var(--epub-serif);
  font-size: 27px;
  font-weight: 500;
  letter-spacing: 7px;
  padding-left: 7px;
  margin: 2px 0 0;
  line-height: 1.4;
}
.epub-reader-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 6px 0 11px;
}
.epub-reader-rule > span {
  height: 1px;
  width: 20px;
  background: #b1b99f;
}
.epub-reader-rule > i {
  font-style: normal;
  font-size: 7px;
  color: #74825f;
  line-height: 1;
}
.epub-reader-page .epub-reader-lead {
  margin-bottom: 9px;
  text-align: justify;
}
.epub-reader-lead::first-letter {
  font-size: 19px;
  line-height: 1;
  padding-right: 1px;
}
.epub-reader-page .epub-reader-prose {
  text-align: justify;
  text-indent: 2em;
  margin-bottom: 8px;
}
.epub-reader-page blockquote {
  margin: 8px 0 8px 5px;
  border-left: 1px solid #8c9879;
  padding-left: 10px;
  color: #59664a;
  font-size: 10px;
  letter-spacing: 0.35px;
}
.epub-reader-folio {
  text-align: center;
  font-size: 7px;
  letter-spacing: 1px;
  color: #7a8669;
  margin-top: 9px;
}
.epub-comparison {
  position: absolute;
  bottom: 34px;
  left: 23px;
  right: 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}
.epub-comparison-copy {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.epub-comparison-index {
  padding-top: 3px;
  color: var(--epub-copper);
  font-size: 9px;
  font-family: var(--epub-serif);
  font-style: italic;
}
.epub-comparison-copy p {
  font-size: 10px;
  color: #8a8f7c;
  line-height: 1.8;
  letter-spacing: 0.4px;
}
.epub-comparison-copy strong {
  font-weight: 400;
  color: #5e6754;
}
.epub-switch {
  display: flex;
  align-items: center;
  gap: 3px;
  border: 1px solid #d5d8c7;
  padding: 4px;
  border-radius: 3px;
}
.epub-switch > .epub-switch-label {
  position: relative;
  min-width: 68px;
  padding: 9px 11px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: #7e8673;
  font-size: 10px;
  border-radius: 1px;
  transition:
    color 0.2s,
    background 0.2s,
    box-shadow 0.2s;
  white-space: nowrap;
}
.epub-switch > .epub-switch-label > span {
  font-size: 9px;
  color: #b3815e;
}
.epub-switch > .epub-switch-label.is-active {
  background: #fbfaf4;
  color: #343e2c;
  box-shadow: 0 1px 4px #333b2420;
}
.epub-device-disclaimer {
  position: absolute;
  bottom: 12px;
  right: 10px;
  font-size: 7px;
  color: #999f8c;
  letter-spacing: 0.9px;
}
@media (max-width: 1190px) and (min-width: 801px) {
  .epub-device-stage {
    height: 590px;
  }
  .epub-kindle-perspective {
    width: 292px;
    height: 423px;
    top: 83px;
  }
  .epub-kindle-front {
    padding: 14px 14px 46px;
  }
  .epub-reader-page {
    padding: 16px 18px 13px;
    font-size: 9px;
  }
  .epub-reader-page blockquote {
    font-size: 8.8px;
  }
  .epub-reader-page h2 {
    font-size: 24px;
  }
  .epub-botanical {
    height: 39px;
    margin-top: 12px;
  }
  .epub-reader-rule {
    margin-bottom: 12px;
  }
  .epub-device-floor {
    width: 260px;
    top: 459px;
  }
  .epub-comparison {
    left: 10px;
    right: 0;
  }
  .epub-comparison-copy {
    gap: 5px;
  }
  .epub-comparison-copy p {
    font-size: 9px;
  }
  .epub-switch > .epub-switch-label {
    min-width: 54px;
    padding: 8px;
    font-size: 9px;
  }
}
@media (max-width: 800px) {
  .epub-device-stage {
    width: min(480px, 100%);
    height: 635px;
    align-self: center;
    margin-top: 13px;
  }
  .epub-kindle-perspective {
    top: 72px;
    left: 50%;
    width: clamp(283px, 76vw, 324px);
    height: clamp(410px, 110.5vw, 463px);
  }
  .epub-device-note {
    top: 31px;
    right: 0;
    font-size: 7px;
  }
  .epub-device-floor {
    top: 495px;
    width: 280px;
  }
  .epub-comparison {
    left: 0;
    right: 0;
    bottom: 36px;
  }
  .epub-device-disclaimer {
    right: 0;
    bottom: 13px;
  }
}
@media (max-width: 400px) {
  .epub-device-stage {
    height: 577px;
    margin-top: 7px;
  }
  .epub-kindle-perspective {
    top: 72px;
    width: clamp(252px, 76vw, 283px);
    height: clamp(365px, 110.5vw, 410px);
  }
  .epub-kindle-front {
    padding: 13px 13px 43px;
    border-radius: 19px;
  }
  .epub-kindle-back {
    border-radius: 20px;
  }
  .epub-kindle-logo {
    font-size: 16px;
    bottom: 14px;
  }
  .epub-reader-page {
    padding: 15px 18px 12px;
    font-size: 8.8px;
  }
  .epub-reader-running {
    font-size: 6px;
  }
  .epub-reader-running > span {
    font-size: 4px;
  }
  .epub-botanical {
    height: 37px;
    margin-top: 10px;
  }
  .epub-reader-page h2 {
    font-size: 23px;
  }
  .epub-reader-rule {
    margin: 6px 0 11px;
  }
  .epub-reader-page blockquote {
    font-size: 8.6px;
    margin: 7px 0 8px 4px;
  }
  .epub-reader-page .epub-reader-prose {
    margin-bottom: 7px;
  }
  .epub-reader-folio {
    margin-top: 9px;
  }
  .epub-device-floor {
    top: 444px;
    width: 235px;
  }
  .epub-comparison {
    gap: 8px;
    bottom: 33px;
  }
  .epub-comparison-copy {
    gap: 6px;
  }
  .epub-comparison-copy p {
    font-size: 9px;
  }
  .epub-switch {
    padding: 3px;
  }
  .epub-switch > .epub-switch-label {
    min-width: 52px;
    padding: 8px 7px;
    font-size: 9px;
    gap: 4px;
  }
  .epub-device-note {
    font-size: 6px;
    letter-spacing: 1px;
  }
}
@media (min-width: 401px) and (max-width: 430px) {
  .epub-reader-page {
    padding-bottom: 10px;
  }
}

@media (max-width: 350px) {
  .epub-reader-page {
    font-size: 8.2px;
    line-height: 1.85;
  }
  .epub-reader-running {
    padding-bottom: 6px;
  }
  .epub-botanical {
    height: 26px;
    margin: 8px auto 4px;
  }
  .epub-reader-page h2 {
    font-size: 21px;
    line-height: 1.25;
  }
  .epub-reader-page blockquote {
    margin-top: 5px;
    margin-bottom: 5px;
  }
  .epub-reader-folio {
    margin-top: 5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .epub-kindle-perspective:hover .epub-kindle-body {
    transform: rotateY(-19deg) rotateX(6deg) rotateZ(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .epub-device-stage *,
  .epub-device-stage *::before,
  .epub-device-stage *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
