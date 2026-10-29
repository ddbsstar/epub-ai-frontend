<script setup lang="ts">
import { computed } from 'vue'
import {
  conversionErrorMessage,
  formatCny,
  type ChapterCatalog,
  type IllustrationConversion,
} from '@/api/conversions'

const props = defineProps<{
  catalog: ChapterCatalog
  selectedIds: string[]
  locked: boolean
  selectionLimit: number
  run?: IllustrationConversion
}>()
const emit = defineEmits<{
  'update:selectedIds': [value: string[]]
  selectAll: []
  selectNone: []
}>()
const states = computed(() => new Map(props.run?.chapters.map((chapter) => [chapter.id, chapter])))
const sectionMode = computed(() =>
  ['illustration-sections-2', 'illustration-sections-3'].includes(props.catalog.parserVersion),
)
const unit = computed(() => (sectionMode.value ? '节' : '章'))
const sizes = { compact: '小幅', medium: '中幅', wide: '通栏' }
const labels = computed(() => ({
  WAITING: '等待处理',
  PLANNING: sectionMode.value ? '理解小节' : '理解章节',
  GENERATING: '正在生图',
  REVIEWING: '正在检查图片',
  SUCCEEDED: '插画已完成',
  REJECTED: '质检未通过，不插入书中',
  SKIPPED: '已跳过',
  FAILED: sectionMode.value ? '本节失败' : '本章失败',
  UNKNOWN: '结果待确认',
}))
const illustrations = computed(
  () =>
    props.run?.chapters.filter(
      (chapter) =>
        chapter.status === 'SUCCEEDED' &&
        chapter.imageUrl &&
        (!chapter.visualReview || chapter.visualReview.status === 'PASSED'),
    ) ?? [],
)
const reviewAspects = {
  source: '原文依据',
  people: '人物一致',
  style: '艺术风格',
  composition: '构图关系',
  artifacts: '画面瑕疵',
}
const reviewResults = { PASS: '通过', FAIL: '未通过', UNCERTAIN: '不确定' }
const artDirection = computed(() =>
  props.run ? props.run.artDirection : props.catalog.artDirection,
)
const artPlan = computed(() => props.run?.bookArtPlan)
const imageReview = computed(() => (props.run ? props.run.imageReview : props.catalog.visualReview))
const skipsImageReview = computed(() => imageReview.value?.enabled === false)
const mediums: Record<string, string> = {
  'graphite-contour': '石墨轮廓',
  'monochrome-ink': '单色墨线',
  'restrained-woodcut': '克制木刻',
  'flat-gouache': '平涂水粉',
  'paper-cut': '剪纸拼贴',
  'watercolor-line': '水彩与线条',
}
const spaces: Record<string, string> = {
  generous: '充足留白',
  balanced: '适度留白',
  compact: '紧凑留白',
}
const selectionUpper = computed(() =>
  props.selectedIds.length > 0
    ? props.selectedIds.length * props.catalog.pricing.perChapterUpperMicros +
      (props.catalog.pricing.bookArtUpperMicros ?? 0)
    : 0,
)
const hasSelectableContent = computed(() =>
  props.catalog.chapters.some((entry) => entry.selectable),
)
function toggle(id: string, checked: boolean) {
  if (props.locked) return
  const next = new Set(props.selectedIds)
  if (checked) next.add(id)
  else next.delete(id)
  emit('update:selectedIds', [...next])
}
</script>

<template>
  <section class="chapter-selection" aria-labelledby="chapter-selection-title">
    <div class="chapter-selection-heading">
      <div>
        <p class="chapter-kicker">
          {{ sectionMode ? 'ILLUSTRATE THE MOMENT' : 'CHOOSE YOUR CHAPTERS' }}
        </p>
        <h2 id="chapter-selection-title">
          {{ sectionMode ? '在故事展开的地方，留一幅画。' : '给哪些章节，留一幅画？' }}
        </h2>
        <p>
          已列出 {{ catalog.chapters.length }} 个目录项 · 已选 {{ selectedIds.length }} {{ unit }}
        </p>
      </div>
      <div class="chapter-selection-actions">
        <button
          type="button"
          :disabled="locked || !hasSelectableContent"
          @click="emit('selectAll')"
        >
          {{ sectionMode ? '全选可用小节' : '全选可用章节' }}
        </button>
        <button type="button" :disabled="locked || !selectedIds.length" @click="emit('selectNone')">
          取消全选
        </button>
      </div>
    </div>
    <p v-if="!run && !catalog.chapters.length" class="chapter-selection-empty" role="status">
      当前解析方式没有识别到正文章节或文章，暂时无法选择配图。原书已保留，尚未开始转换。
    </p>
    <p v-else-if="!run && !hasSelectableContent" class="chapter-selection-empty" role="status">
      已识别目录，但没有可配图的内容。请查看下方各项原因；原书已保留，尚未开始转换。
    </p>
    <p class="chapter-selection-note">
      {{
        sectionMode
          ? '按小节理解内容，在相关场景出现后的段落之间插图；自动选择小幅、中幅或通栏，随阅读器宽度缩放。'
          : '目录读取不调用付费模型。选中的章节各生成一幅章末插画，再装进同一本 EPUB。'
      }}
    </p>
    <aside v-if="imageReview" class="chapter-art-direction" aria-label="图片质检规则">
      <strong>{{
        skipsImageReview ? '生成成功后直接插入，不做 AI 二次校验' : '图片生成后，先做视觉质检'
      }}</strong>
      <p>{{ imageReview.description }}</p>
      <small v-if="skipsImageReview"
        >保留文件完整性、插入位置及 EPUB 格式检查。未做 AI 视觉复核不代表质量已获认可。</small
      >
      <small v-else>自动审查是模型判断，不代表用户批准，也不保证审美效果。</small>
    </aside>
    <section
      v-if="artPlan && artDirection?.id === 'book-art'"
      class="book-art-plan"
      aria-label="本书艺术方案"
    >
      <div class="book-art-heading">
        <div>
          <span>本书艺术方案</span>
          <h3>{{ artDirection.label }}</h3>
        </div>
        <small>{{
          skipsImageReview ? '方案暂定 · 未做 AI 视觉复核' : '方案暂定 · 图片仍需目视验收'
        }}</small>
      </div>
      <p class="book-art-reading">{{ artPlan.reading }}</p>
      <p class="book-art-coverage">
        代表性采样 · 可处理 {{ artPlan.coverage.totalSupportedSections }} 节中，抽样
        {{ artPlan.coverage.sampledSections }} 节、{{ artPlan.coverage.sampledParagraphs }}
        段。方案基于这些样本，不代表全文逐段精读。
      </p>
      <div class="book-art-palette" aria-label="本书方案色板">
        <span v-for="color in artPlan.palette" :key="color.hex + color.colorName"
          ><i :style="{ backgroundColor: color.hex }" aria-hidden="true"></i>{{ color.colorName }}
          <small>{{ color.hex }}</small></span
        >
      </div>
      <p class="book-art-rationale"><strong>为什么适合这本书</strong>{{ artPlan.rationale }}</p>
      <details class="book-art-details">
        <summary>查看媒介与画面语言</summary>
        <dl>
          <div>
            <dt>媒介</dt>
            <dd>{{ mediums[artPlan.medium] || artPlan.medium }}</dd>
          </div>
          <div>
            <dt>线条</dt>
            <dd>{{ artPlan.lineLanguage }}</dd>
          </div>
          <div>
            <dt>形状</dt>
            <dd>{{ artPlan.shapeLanguage }}</dd>
          </div>
          <div>
            <dt>留白</dt>
            <dd>{{ spaces[artPlan.negativeSpace] || artPlan.negativeSpace }}</dd>
          </div>
          <div>
            <dt>人物</dt>
            <dd>{{ artPlan.characterTreatment }}</dd>
          </div>
        </dl>
      </details>
    </section>
    <aside v-else-if="artDirection" class="chapter-art-direction" aria-label="本次艺术方向">
      <strong>{{ artDirection.label }}</strong>
      <p>{{ artDirection.description }}</p>
      <small
        >{{
          artDirection.id === 'literary-editorial'
            ? '旧版固定艺术方向，不代表按书籍内容定制。'
            : '方案暂定。'
        }}生成图片仍需目视验收。</small
      >
    </aside>
    <p v-else-if="run && catalog.artDirection" class="chapter-art-direction-legacy">
      本次结果来自旧版，未锁定艺术风格；重新选择后开始的新转换将使用统一艺术方向。
    </p>
    <aside
      v-else-if="catalog.artPlanning && !run"
      class="chapter-art-direction"
      aria-label="艺术规划方式"
    >
      <strong>按这本书的内容，制定艺术方案</strong>
      <p>{{ catalog.artPlanning.description }}</p>
      <small>读取目录不调用模型；点击开始转换后才制定方案。</small>
    </aside>
    <p
      v-if="!locked && hasSelectableContent && catalog.pricing.budgetEnforced === false"
      class="chapter-selection-limit"
    >
      金额预算限制已关闭 · 已选内容费用估计上界
      {{ formatCny(selectionUpper) }}
    </p>
    <p v-else-if="!locked && hasSelectableContent" class="chapter-selection-limit">
      本次最多选 {{ selectionLimit }} {{ unit }} · 单次预算上限
      {{ formatCny(catalog.pricing.maxBudgetMicros) }}
    </p>
    <ul
      v-if="catalog.chapters.length"
      class="chapter-list"
      :aria-label="sectionMode ? '书籍小节' : '书籍章节'"
    >
      <li v-for="chapter in catalog.chapters" :key="chapter.id">
        <div
          class="chapter-row"
          :style="{ '--chapter-indent': `${Math.min(chapter.level, 3) * 8}px` }"
        >
          <label :class="{ 'chapter-unavailable': !chapter.selectable }">
            <input
              type="checkbox"
              :checked="selectedIds.includes(chapter.id)"
              :disabled="locked || !chapter.selectable"
              :aria-describedby="!chapter.selectable ? `reason-${chapter.id}` : undefined"
              @change="toggle(chapter.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ chapter.title || '未命名章节' }}</span>
          </label>
          <span
            v-if="states.get(chapter.id)"
            class="chapter-state"
            :data-status="states.get(chapter.id)!.status"
            >{{ labels[states.get(chapter.id)!.status] }}</span
          >
          <span v-else-if="!chapter.selectable" class="chapter-state">暂不可选</span>
        </div>
        <p v-if="!chapter.selectable" :id="`reason-${chapter.id}`" class="chapter-reason">
          {{
            chapter.reasonCode
              ? conversionErrorMessage(chapter.reasonCode)
              : '此目录项暂不支持安全配图。'
          }}
        </p>
        <p v-if="states.get(chapter.id)?.error" class="chapter-reason">
          {{ conversionErrorMessage(states.get(chapter.id)!.error!.code) }}
        </p>
        <details v-if="states.get(chapter.id)?.visualPlan" class="chapter-visual-plan">
          <summary>
            画面方案 · {{ states.get(chapter.id)!.visualPlan!.concepts.length }} 个候选
          </summary>
          <p class="chapter-concept-reason">
            <strong>选中理由</strong>{{ states.get(chapter.id)!.visualPlan!.selectionReason }}
          </p>
          <div
            v-for="(concept, index) in states.get(chapter.id)!.visualPlan!.concepts"
            :key="concept.id"
            class="chapter-concept"
            :class="{
              'is-selected': concept.id === states.get(chapter.id)!.visualPlan!.selectedConceptId,
            }"
          >
            <h4>
              方案 {{ index + 1
              }}<span v-if="concept.id === states.get(chapter.id)!.visualPlan!.selectedConceptId"
                >已选用</span
              >
            </h4>
            <p>{{ concept.idea }}</p>
            <p><strong>构图</strong>{{ concept.composition }}</p>
            <p><strong>情绪</strong>{{ concept.emotionalIntent }}</p>
          </div>
        </details>
        <details v-if="states.get(chapter.id)?.visualReview" class="chapter-visual-review">
          <summary>
            图片质检 ·
            {{
              states.get(chapter.id)!.visualReview!.status === 'PASSED'
                ? '通过'
                : states.get(chapter.id)!.visualReview!.status === 'REJECTED'
                  ? '未通过'
                  : '不确定'
            }}
          </summary>
          <p>{{ states.get(chapter.id)!.visualReview!.summary }}</p>
          <ul>
            <li v-for="check in states.get(chapter.id)!.visualReview!.checks" :key="check.aspect">
              <strong>{{ reviewAspects[check.aspect] }} · {{ reviewResults[check.result] }}</strong>
              <span>{{ check.reason }}</span>
            </li>
          </ul>
          <small>自动审查是模型判断，不代表用户批准，也不保证审美效果。</small>
        </details>
      </li>
    </ul>
    <div v-if="illustrations.length" class="chapter-gallery" aria-label="已生成的章节插画">
      <figure v-for="chapter in illustrations" :key="chapter.id">
        <a
          :href="chapter.imageUrl!"
          target="_blank"
          rel="noopener"
          :aria-label="`查看《${chapter.title}》原图`"
        >
          <img :src="chapter.imageUrl!" :alt="`《${chapter.title}》的章节插画`" loading="lazy" />
        </a>
        <figcaption>
          {{ chapter.title }}
          <span v-if="chapter.placement" class="chapter-placement">
            对应段落之后 · {{ sizes[chapter.placement.size] }}居中
          </span>
          <span v-if="skipsImageReview" class="chapter-placement">
            {{
              run?.status === 'SUCCEEDED' && run.artifacts.epub ? '已插入书中' : '导出时按方案插入'
            }}
            · 未做 AI 视觉复核
          </span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.chapter-selection-empty {
  margin: 20px 0;
  padding: 16px 18px;
  border: 1px solid #deded1;
  background: #f6f4ed;
  color: #85714e;
  font-size: 12px;
  line-height: 1.9;
}
.book-art-plan {
  padding: 20px;
  margin-top: 18px;
  border: 1px solid #d8dbcb;
  background: #f2f2e8;
  color: #66705a;
  font-size: 12px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.book-art-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 15px;
}
.book-art-heading span {
  font-size: 10px;
  color: #96947f;
}
.book-art-heading h3 {
  font-family: var(--epub-serif);
  font-size: 19px;
  color: #4f5942;
  font-weight: 500;
  margin-top: 4px;
}
.book-art-heading small,
.book-art-coverage {
  color: #8e917e;
  font-size: 10px;
}
.book-art-reading {
  margin-top: 14px;
}
.book-art-coverage {
  margin-top: 6px;
}
.book-art-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 15px;
}
.book-art-palette > span {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 11px;
}
.book-art-palette i {
  width: 18px;
  height: 18px;
  border: 1px solid #b9baa766;
  border-radius: 50%;
  flex-shrink: 0;
}
.book-art-palette small {
  color: #9a9b89;
  font-size: 9px;
}
.book-art-rationale {
  margin-top: 15px;
}
.book-art-rationale strong,
.chapter-concept-reason strong {
  display: block;
  font-weight: 500;
  color: #657053;
}
.book-art-details {
  margin-top: 14px;
  border-top: 1px solid #dedfd1;
  padding-top: 10px;
}
.book-art-details summary,
.chapter-visual-plan summary,
.chapter-visual-review summary {
  cursor: pointer;
  color: #85714e;
  font-size: 11px;
}
.book-art-details summary:focus-visible,
.chapter-visual-plan summary:focus-visible,
.chapter-visual-review summary:focus-visible {
  outline: 2px solid var(--epub-copper);
  outline-offset: 4px;
}
.book-art-details dl {
  margin: 12px 0 0;
}
.book-art-details dl > div {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  margin-top: 6px;
}
.book-art-details dt {
  color: #92937e;
}
.book-art-details dd {
  margin: 0;
}
.chapter-visual-plan,
.chapter-visual-review {
  margin: 0 14px 15px 36px;
  font-size: 11px;
  line-height: 1.9;
  color: #7a806c;
  overflow-wrap: anywhere;
}
.chapter-visual-review > p {
  margin-top: 10px;
}
.chapter-visual-review ul {
  padding: 0;
  margin: 8px 0;
  list-style: none;
}
.chapter-visual-review li {
  padding: 8px 10px;
  background: #f5f4ec;
}
.chapter-visual-review strong,
.chapter-visual-review span {
  display: block;
}
.chapter-visual-review strong {
  font-weight: 500;
  color: #85714e;
}
.chapter-visual-review small {
  color: #92937e;
}
.chapter-concept-reason {
  margin-top: 10px;
}
.chapter-concept {
  border-left: 2px solid #dddccf;
  padding: 10px 12px;
  margin-top: 10px;
  background: #f5f4ec;
}
.chapter-concept.is-selected {
  border-left-color: #879273;
  background: #ebeee1;
}
.chapter-concept h4 {
  font-size: 11px;
  font-weight: 500;
  color: #667254;
}
.chapter-concept h4 span {
  margin-left: 10px;
  font-size: 9px;
  color: #879273;
}
.chapter-concept p {
  margin-top: 4px;
}
.chapter-concept p strong {
  font-weight: 400;
  margin-right: 8px;
  color: #96947f;
}
.chapter-art-direction {
  padding: 14px 16px;
  margin-top: 16px;
  border-left: 2px solid #879273;
  background: #e9ecdf;
  color: #535d46;
  font-size: 12px;
  line-height: 1.8;
}
.chapter-art-direction p {
  margin: 4px 0;
}
.chapter-art-direction small,
.chapter-art-direction-legacy {
  color: #7a806c;
  font-size: 11px;
  line-height: 1.8;
}
.chapter-selection {
  margin-top: 32px;
  padding: 25px 0;
  border-top: 1px solid #cdcfc0;
}
.chapter-selection-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.chapter-kicker {
  color: #9b927e;
  font-size: 8px;
  letter-spacing: 1.7px;
}
.chapter-selection h2 {
  font-family: var(--epub-serif);
  font-size: 23px;
  font-weight: 500;
  margin-top: 10px;
}
.chapter-selection-heading p:last-child,
.chapter-selection-note,
.chapter-selection-limit,
.chapter-reason {
  color: #858675;
  font-size: 11px;
  line-height: 1.9;
  margin-top: 8px;
}
.chapter-selection-limit {
  color: #85714e;
}
.chapter-selection-actions {
  display: flex;
  gap: 15px;
}
.chapter-selection-actions button {
  border: 0;
  background: transparent;
  color: #85714e;
  font: inherit;
  font-size: 11px;
  padding: 8px 0;
  cursor: pointer;
}
.chapter-selection-actions button:disabled {
  opacity: 0.4;
  cursor: default;
}
.chapter-list {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
  max-height: 420px;
  overflow-y: auto;
  border-top: 1px solid #deded1;
  border-bottom: 1px solid #deded1;
}
.chapter-list li + li {
  border-top: 1px solid #e6e5d9;
}
.chapter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 10px 13px calc(10px + var(--chapter-indent));
}
.chapter-row label {
  display: flex;
  align-items: center;
  gap: 11px;
  font-family: var(--epub-serif);
  font-size: 14px;
  line-height: 1.6;
  min-width: 0;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.chapter-row input {
  accent-color: #788565;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.chapter-row .chapter-unavailable {
  color: #a1a18f;
  cursor: default;
}
.chapter-state {
  font-size: 10px;
  white-space: nowrap;
  color: #8a8c7a;
}
.chapter-state[data-status='SUCCEEDED'] {
  color: #65794f;
}
.chapter-state[data-status='FAILED'],
.chapter-state[data-status='UNKNOWN'],
.chapter-state[data-status='REJECTED'] {
  color: #a2754c;
}
.chapter-reason {
  margin: -4px 10px 12px 36px;
}
.chapter-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin-top: 28px;
}
.chapter-gallery figure {
  margin: 0;
  min-width: 0;
}
.chapter-gallery img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  border: 1px solid #deded1;
  background: #f6f4ed;
}
.chapter-gallery figcaption {
  text-align: center;
  font-family: var(--epub-serif);
  font-size: 13px;
  margin-top: 12px;
  color: #747861;
}
.chapter-placement {
  display: block;
  margin-top: 5px;
  font-family: var(--epub-sans);
  font-size: 11px;
}
@media (max-width: 600px) {
  .book-art-plan {
    padding: 15px;
  }
  .book-art-heading {
    display: block;
  }
  .book-art-heading > small {
    display: block;
    margin-top: 5px;
  }
  .chapter-selection-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .chapter-selection h2 {
    font-size: 21px;
  }
  .chapter-state {
    font-size: 9px;
  }
  .chapter-gallery {
    grid-template-columns: 1fr;
  }
}
</style>
