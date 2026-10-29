<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { ApiError } from '@/api/errors'
import { illustrationErrorMessage } from '@/api/illustrations'
import { useIllustrationProcessing } from '@/composables/useIllustrationProcessing'

const props = defineProps<{ bookId: string }>()
const illustration = useIllustrationProcessing(toRef(props, 'bookId'))
const {
  chapterOrdinal,
  plan,
  exported,
  busy,
  planId,
  exportId,
  planQuery,
  exportQuery,
  planMutation,
  generateMutation,
  planSubmissionUncertain,
  generationSubmissionUncertain,
} = illustration
const prompt = ref('')
const alt = ref('')
const loadedPlan = ref<string | null>(null)
const imageFailed = ref(false)
watch(
  () => [plan.value?.id, plan.value?.status] as const,
  ([id, status]) => {
    if (id && status === 'SUCCEEDED' && loadedPlan.value !== id) {
      prompt.value = plan.value?.prompt ?? ''
      alt.value = plan.value?.alt ?? ''
      loadedPlan.value = id
    }
  },
)
watch(
  () => exported.value?.artifacts.image,
  () => {
    imageFailed.value = false
  },
)
watch(
  () => props.bookId,
  () => {
    loadedPlan.value = null
    prompt.value = ''
    alt.value = ''
  },
)
const chapterValid = computed(
  () =>
    Number.isInteger(Number(chapterOrdinal.value)) &&
    Number(chapterOrdinal.value) >= 1 &&
    Number(chapterOrdinal.value) <= 501,
)
const promptLength = computed(() => Array.from(prompt.value).length)
const altLength = computed(() => Array.from(alt.value).length)
const inputValid = computed(
  () =>
    !!prompt.value.trim() &&
    promptLength.value <= 800 &&
    !!alt.value.trim() &&
    altLength.value <= 500,
)
const ready = computed(() => plan.value?.status === 'SUCCEEDED')
const complete = computed(() => exported.value?.status === 'SUCCEEDED')
const editsLocked = computed(
  () => busy.value || !!exportId.value || generationSubmissionUncertain.value,
)
const failure = computed(() => exported.value?.error ?? plan.value?.error)
const requestError = computed(
  () =>
    generateMutation.error.value ??
    planMutation.error.value ??
    exportQuery.error.value ??
    planQuery.error.value,
)
const errorText = computed(() => {
  if (failure.value) return illustrationErrorMessage(failure.value.code)
  const error = requestError.value
  if (error instanceof ApiError) {
    if (['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'].includes(error.code)) return error.message
    return illustrationErrorMessage(error.code)
  }
  return error ? '插画任务暂时无法读取，请保留任务并恢复查询。' : null
})
const stageText = computed(() => {
  if (planMutation.isPending.value) return '正在提交插画规划。'
  if (generateMutation.isPending.value) return '正在提交生图任务。'
  if (complete.value) return '插画已加入书中。'
  const current = exported.value ?? plan.value
  if (current?.status === 'FAILED') return '本次插画未能完成。'
  if (current?.status === 'CANCELLED') return '本次插画已停止。'
  if (current?.status === 'QUEUED')
    return current.kind === 'plan' ? '插画规划已排队。' : '生图任务已排队。'
  if (current?.status === 'RUNNING') {
    if (current.kind === 'plan') return '正在理解章节与规划画面。'
    if (current.stage === 'illustration-export') return '正在生成插画并制作插画版书籍。'
    if (/validat|check/u.test(current.stage)) return '正在校验插画版书籍。'
    if (/insert|process|publish|export/u.test(current.stage)) return '正在将插画加入书中。'
    return '正在生成插画。'
  }
  if (ready.value) return '方案已就绪，确认画面后再生成。'
  if (planId.value || exportId.value) return '正在恢复插画任务。'
  return '从一章开始，为文字留一幅画。'
})
const canResume = computed(
  () => planQuery.isError.value || exportQuery.isError.value || generationSubmissionUncertain.value,
)

function startPlan() {
  if (chapterValid.value) illustration.requestPlan()
}
function startGeneration() {
  if (inputValid.value) illustration.generate(prompt.value, alt.value)
}
</script>

<template>
  <section class="chapter-illustration" aria-labelledby="chapter-illustration-title">
    <div class="illustration-heading">
      <div>
        <p class="illustration-eyebrow">A PICTURE BETWEEN THE WORDS</p>
        <h2 id="chapter-illustration-title">章节插画</h2>
      </div>
      <span class="illustration-badge">一章 · 一幅 · 原文保留</span>
    </div>
    <p class="illustration-intro">先读懂章节，规划画面；你确认后，再生成并放入章末。</p>
    <form class="illustration-plan-controls" @submit.prevent="startPlan">
      <label for="illustration-chapter">章节序号</label>
      <div class="illustration-chapter-number">
        <span>第</span
        ><input
          id="illustration-chapter"
          v-model.number="chapterOrdinal"
          type="number"
          min="1"
          max="501"
          step="1"
          :disabled="busy || !!exportId || planSubmissionUncertain"
        /><span>章</span>
      </div>
      <button
        class="illustration-button illustration-button-secondary"
        type="submit"
        :disabled="busy || !!exportId || !chapterValid"
      >
        {{ planSubmissionUncertain ? '继续获取规划结果' : plan ? '读取本章方案' : '规划插画' }}
      </button>
    </form>
    <p class="illustration-cost-note">
      规划与生图会分别调用模型。打开页面与刷新只查询已有任务，不会自动生图。
    </p>
    <div class="illustration-status" role="status" aria-live="polite">
      <span :class="{ 'is-busy': busy }" aria-hidden="true"></span>{{ stageText }}
    </div>
    <div v-if="errorText" class="illustration-error" role="alert">
      <p>{{ errorText }}</p>
      <button v-if="canResume" type="button" @click="illustration.resumeQuery()">
        恢复插画查询
      </button>
      <p v-if="generationSubmissionUncertain">
        生图提交结果尚未确认，画面描述已锁定。请先恢复查询，避免重复操作。
      </p>
    </div>
    <div v-if="ready && !complete" class="illustration-plan">
      <div class="illustration-concept">
        <span>{{ plan?.chapterTitle || `第 ${chapterOrdinal} 章` }}</span>
        <h3>这一幅，想表达什么</h3>
        <p>{{ plan?.concept }}</p>
      </div>
      <form class="illustration-review" @submit.prevent="startGeneration">
        <label for="illustration-prompt"
          >画面描述 <span>{{ promptLength }} / 800</span></label
        >
        <textarea
          id="illustration-prompt"
          v-model="prompt"
          rows="6"
          :disabled="editsLocked"
          aria-describedby="illustration-prompt-note"
        ></textarea>
        <p id="illustration-prompt-note">可以调整构图与细节，请以书中已有内容为依据。</p>
        <label for="illustration-alt"
          >图片说明 <span>{{ altLength }} / 500</span></label
        >
        <input id="illustration-alt" v-model="alt" type="text" :disabled="editsLocked" />
        <button
          v-if="!exportId"
          class="illustration-button illustration-button-primary"
          type="submit"
          :disabled="busy || !inputValid || generationSubmissionUncertain"
        >
          生成插画并加入书中<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12h15m-6-6 6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
    <div v-if="complete" class="illustration-result">
      <figure v-if="exported?.artifacts.image" class="illustration-picture">
        <img
          v-if="!imageFailed"
          :src="exported.artifacts.image"
          :alt="exported.alt || alt || '生成的章节插画'"
          @error="imageFailed = true"
        />
        <p v-else class="illustration-image-error">图片暂时未能显示，可打开原图查看。</p>
        <figcaption>
          <span>{{ exported.chapterTitle || `第 ${chapterOrdinal} 章` }} · 章末插画</span
          ><a :href="exported.artifacts.image" target="_blank" rel="noopener">查看原图</a>
        </figcaption>
      </figure>
      <div class="illustration-downloads">
        <a
          v-if="exported?.artifacts.epub"
          class="illustration-button illustration-button-primary"
          :href="exported.artifacts.epub"
          download
          >下载插画版 EPUB<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg></a
        ><a
          v-if="exported?.artifacts.report"
          class="illustration-report"
          :href="exported.artifacts.report"
          download
          >下载插画报告</a
        >
      </div>
      <p class="illustration-result-note">
        原书继续保留。插画版下载为新的 EPUB，可在阅读器中查看实际效果。
      </p>
    </div>
  </section>
</template>

<style scoped>
.chapter-illustration {
  margin-top: 34px;
  padding: 29px 0 0;
  border-top: 1px solid #cdcfc0;
  color: var(--epub-ink);
}
.illustration-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.illustration-eyebrow {
  color: #a19378;
  font-size: 8px;
  letter-spacing: 1.4px;
  margin-bottom: 9px;
}
.illustration-heading h2 {
  font-family: var(--epub-serif);
  font-size: 25px;
  font-weight: 500;
  letter-spacing: 0.5px;
}
.illustration-badge {
  padding: 6px 9px;
  border: 1px solid #dedbcd;
  font-size: 9px;
  color: #8c826e;
  white-space: nowrap;
}
.illustration-intro {
  font-size: 12px;
  line-height: 1.9;
  color: #7f8172;
  margin-top: 14px;
}
.illustration-plan-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 23px;
  flex-wrap: wrap;
}
.illustration-plan-controls label {
  font-size: 12px;
  color: #757962;
}
.illustration-chapter-number {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8c8d7b;
}
.illustration-chapter-number input {
  width: 67px;
}
.chapter-illustration input,
.chapter-illustration textarea {
  background: #f6f5ec;
  border: 1px solid #cdd0be;
  color: var(--epub-ink);
  border-radius: 2px;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
}
.chapter-illustration input:disabled,
.chapter-illustration textarea:disabled {
  opacity: 0.7;
}
.chapter-illustration :is(input, textarea, button, a):focus-visible {
  outline: 2px solid var(--epub-copper);
  outline-offset: 4px;
}
.illustration-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  min-height: 42px;
  padding: 11px 19px;
  border-radius: 2px;
  font: inherit;
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
}
.illustration-button:disabled {
  opacity: 0.5;
  cursor: default;
}
.illustration-button-secondary {
  border: 1px solid #a7ad96;
  color: #57614a;
  background: transparent;
}
.illustration-button-primary {
  border: 1px solid #464d3c;
  color: #f2f2e6;
  background: #444d3b;
}
.illustration-button svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.illustration-cost-note {
  color: #9b9786;
  font-size: 10px;
  line-height: 1.8;
  margin-top: 12px;
}
.illustration-status {
  margin-top: 22px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  line-height: 1.8;
  color: #687457;
}
.illustration-status > span {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #87916e;
}
.illustration-status > .is-busy {
  outline: 3px solid #dce0cf;
}
.illustration-error {
  margin-top: 15px;
  padding: 13px 16px;
  background: #f1e8dc;
  border: 1px solid #bd9076;
  color: #83523c;
  font-size: 12px;
  line-height: 1.9;
}
.illustration-error button,
.illustration-report,
.illustration-picture a {
  background: transparent;
  border: 0;
  padding: 0;
  color: #77583f;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
.illustration-error button {
  margin: 6px 0;
}
.illustration-plan {
  margin-top: 20px;
  display: grid;
  grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
  gap: 35px;
  padding: 24px;
  border: 1px solid #dedfd1;
  background: #f0f0e57d;
}
.illustration-concept > span {
  color: #a19378;
  font-size: 11px;
}
.illustration-concept h3 {
  font-family: var(--epub-serif);
  font-size: 18px;
  font-weight: 500;
  margin-top: 14px;
  line-height: 1.7;
}
.illustration-concept p {
  font-size: 13px;
  line-height: 2;
  color: #7b7f6b;
  margin-top: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.illustration-review {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 9px;
  min-width: 0;
}
.illustration-review label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #73775f;
}
.illustration-review label > span {
  color: #a3a18d;
  font-size: 10px;
}
.illustration-review textarea {
  width: 100%;
  resize: vertical;
  min-height: 150px;
  line-height: 1.9;
}
.illustration-review > p {
  font-size: 10px;
  line-height: 1.8;
  color: #9b9786;
  margin-bottom: 8px;
}
.illustration-review .illustration-button {
  margin-top: 8px;
}
.illustration-result {
  margin-top: 25px;
}
.illustration-picture {
  margin: 0;
  padding: 18px;
  border: 1px solid #d7d9c9;
  background: #f8f7ef;
}
.illustration-picture img {
  display: block;
  width: 100%;
  max-width: 760px;
  max-height: 760px;
  object-fit: contain;
  height: auto;
  margin: 0 auto;
}
.illustration-picture figcaption {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  padding-top: 13px;
  color: #96917d;
  font-size: 11px;
  line-height: 1.8;
}
.illustration-image-error {
  padding: 60px 15px;
  text-align: center;
  color: #8a806f;
  font-size: 13px;
}
.illustration-downloads {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  margin-top: 20px;
}
.illustration-report {
  font-size: 12px;
}
.illustration-result-note {
  margin-top: 12px;
  color: #979682;
  font-size: 10px;
  line-height: 1.8;
}
@media (max-width: 800px) {
  .chapter-illustration {
    margin-top: 28px;
    padding-top: 24px;
  }
  .illustration-heading {
    align-items: flex-start;
    gap: 13px;
  }
  .illustration-heading h2 {
    font-size: 23px;
  }
  .illustration-badge {
    font-size: 8px;
    padding: 5px 7px;
  }
  .illustration-eyebrow {
    max-width: 155px;
    font-size: 7px;
    line-height: 1.8;
  }
  .illustration-intro {
    font-size: 11px;
  }
  .illustration-plan-controls {
    gap: 10px;
  }
  .illustration-plan {
    display: block;
    padding: 17px;
  }
  .illustration-review {
    margin-top: 23px;
  }
  .illustration-picture {
    padding: 10px;
  }
  .illustration-downloads {
    align-items: stretch;
    flex-direction: column;
    gap: 15px;
  }
  .illustration-downloads .illustration-report {
    align-self: center;
  }
}
</style>
