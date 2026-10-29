<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  title?: string | null
  coverUrl?: string | null
  caption?: string
}>()
const imageFailed = ref(false)
watch(
  () => props.coverUrl,
  () => {
    imageFailed.value = false
  },
)
</script>

<template>
  <figure class="upload-cover-stage" :aria-label="title ? `《${title}》书籍封面` : '等待上传书籍'">
    <span class="upload-cover-kicker" aria-hidden="true">A SMALL CHANGE. A QUIETER READ.</span>
    <div class="upload-book-object" aria-hidden="true">
      <div class="upload-book-pages"></div>
      <div class="upload-book-cover" :class="{ 'has-image': coverUrl && !imageFailed }">
        <img
          v-if="coverUrl && !imageFailed"
          class="upload-cover-image"
          :src="coverUrl"
          alt=""
          @error="imageFailed = true"
        />
        <template v-else>
          <span class="upload-cover-edition">{{
            title ? 'YOUR ORIGINAL BOOK' : 'A NEW CHAPTER'
          }}</span>
          <div class="upload-cover-title" :class="{ 'has-book-title': title }">
            {{ title || '等待你的书' }}
          </div>
          <div class="upload-cover-rule"><i></i><span>✧</span><i></i></div>
          <svg class="upload-botanical" viewBox="0 0 170 210" fill="none">
            <path
              d="M57 188C64 158 83 137 95 110c10-22 13-45 12-75M78 145C66 126 53 105 35 90m56 33c23-11 36-29 45-48M96 104c-5-25-14-44-30-63m39 30c12-8 21-17 28-29M67 168c24-1 43-9 58-24"
            />
            <path
              d="M107 46c-11-13-10-24-5-32 11 9 15 21 5 32ZM106 64c-15-5-22-13-23-24 15 0 25 9 23 24ZM110 74c15 1 26-5 31-16-15-4-26 2-31 16ZM99 94c-15-7-22-18-20-28 17 3 24 15 20 28ZM103 103c17 4 31-2 38-11-17-6-30-3-38 11ZM88 128c-16-7-22-17-20-29 15 4 22 14 20 29ZM80 145c16 7 30 4 38-5-15-8-29-7-38 5ZM73 155c-15-3-25-12-28-23 17 0 26 8 28 23ZM58 184c14 0 25-5 31-16-16-3-27 4-31 16ZM57 119c-15-3-22-13-22-25 15 1 25 11 22 25ZM50 111c-14 7-28 4-36-5 17-8 29-7 36 5ZM74 67c-1-18-10-29-22-34-1 16 7 29 22 34ZM126 54c15 3 25-1 32-10-14-5-25-2-32 10ZM114 151c1-13 7-22 17-25 2 13-4 22-17 25Z"
            />
            <path d="M52 189c12 4 22 4 30 1" />
          </svg>
          <p class="upload-cover-bottom">
            {{ title ? '保留文字，整理阅读的细节。' : '下一段阅读，从这里开始。' }}
          </p>
          <span class="upload-cover-imprint"
            >EPUB AI <i>/</i> {{ title ? '书籍占位封面' : '等待上传' }}</span
          >
        </template>
      </div>
    </div>
    <div class="upload-book-shadow" aria-hidden="true"></div>
    <figcaption class="upload-cover-caption">
      {{ imageFailed ? '封面暂时无法显示 · 使用占位封面' : caption || '上传后显示书名与原书封面' }}
    </figcaption>
  </figure>
</template>

<style scoped>
.upload-cover-stage {
  height: 375px;
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.upload-cover-kicker {
  font-size: 6.5px;
  letter-spacing: 1.7px;
  color: #a5a28e;
  margin-top: 4px;
}
.upload-book-object {
  position: relative;
  z-index: 1;
  width: 205px;
  height: 282px;
  margin-top: 22px;
  transform: perspective(1200px) rotateY(-11deg) rotateZ(3deg);
  transform-style: preserve-3d;
  transition: transform 0.4s;
}
.upload-book-cover {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: #e3e6d7;
  border: 1px solid #bac0aa;
  border-left-color: #87967c;
  border-radius: 1px 3px 3px 1px;
  padding: 23px 23px 13px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    inset 5px 0 7px #697b4f25,
    inset 7px 0 0 #71865815,
    3px 4px 3px #59684a14;
}
.upload-book-cover::before {
  content: '';
  position: absolute;
  inset: 13px 12px 12px 15px;
  border: 1px solid #9ba98a60;
  pointer-events: none;
}
.upload-book-cover::after {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #8495744d;
}
.upload-book-cover.has-image {
  padding: 0;
  overflow: hidden;
}
.upload-book-cover.has-image::before,
.upload-book-cover.has-image::after {
  display: none;
}
.upload-cover-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #e3e6d7;
}
.upload-book-pages {
  position: absolute;
  inset: 4px -7px -5px 6px;
  border-radius: 1px 4px 4px 1px;
  border: 1px solid #bfc3b1;
  background: repeating-linear-gradient(180deg, #f4f1e7 0, #f4f1e7 2px, #dedfd1 2px, #dedfd1 3px);
  box-shadow: 7px 12px 12px #43503015;
}
.upload-cover-edition {
  font-size: 6px;
  font-family: var(--epub-sans);
  color: #7e8b70;
  letter-spacing: 1.5px;
}
.upload-cover-title {
  margin-top: 19px;
  text-align: center;
  font-family: var(--epub-serif);
  font-size: 17px;
  color: #475c3d;
  font-weight: 500;
  letter-spacing: 3px;
  line-height: 1.5;
  padding-left: 3px;
}
.upload-cover-title > span {
  display: block;
  margin-top: 1px;
  font-size: 29px;
  letter-spacing: 8px;
  padding-left: 5px;
}
.upload-cover-title.has-book-title {
  max-width: 100%;
  font-size: 19px;
  line-height: 1.7;
  letter-spacing: 1px;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.upload-cover-rule {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 7px;
  color: #899977;
  font-size: 7px;
}
.upload-cover-rule i {
  display: block;
  width: 20px;
  height: 1px;
  background: #9baa89;
}
.upload-botanical {
  position: absolute;
  left: 63px;
  bottom: 51px;
  width: 92px;
  height: 115px;
  stroke: #6c7f58;
  stroke-width: 0.85;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.upload-cover-bottom {
  margin-top: auto;
  padding-bottom: 17px;
  text-align: center;
  font-family: var(--epub-serif);
  font-size: 5.7px;
  letter-spacing: 0.7px;
  color: #839074;
  line-height: 1.8;
}
.upload-cover-imprint {
  position: absolute;
  bottom: 19px;
  left: 10px;
  right: 0;
  text-align: center;
  font-size: 5px;
  letter-spacing: 0.8px;
  color: #8e9b7f;
}
.upload-cover-imprint i {
  margin: 0 3px;
  font-style: normal;
}
.upload-book-shadow {
  position: absolute;
  left: 50%;
  top: 312px;
  width: 222px;
  height: 18px;
  transform: translateX(-47%) rotate(4deg);
  filter: blur(12px);
  border-radius: 50%;
  background: #46523a26;
}
.upload-cover-caption {
  margin-top: 22px;
  font-size: 8px;
  letter-spacing: 0.8px;
  color: #9f9f8b;
}
@media (hover: hover) and (pointer: fine) {
  .upload-book-object:hover {
    transform: perspective(1200px) rotateY(-6deg) rotateZ(1deg) translateY(-3px);
  }
}
@media (max-width: 800px) {
  .upload-cover-stage {
    height: 385px;
  }
  .upload-book-object {
    margin-top: 22px;
    width: 212px;
    height: 292px;
  }
  .upload-book-shadow {
    top: 320px;
  }
  .upload-botanical {
    left: 66px;
    bottom: 52px;
    width: 94px;
    height: 121px;
  }
  .upload-cover-title {
    margin-top: 21px;
  }
  .upload-cover-caption {
    margin-top: 21px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .upload-book-object {
    transition: none;
  }
  .upload-book-object:hover {
    transform: perspective(1200px) rotateY(-11deg) rotateZ(3deg);
  }
}
</style>
