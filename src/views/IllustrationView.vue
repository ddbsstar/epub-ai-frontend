<script setup lang="ts">
import { computed, ref } from 'vue'
import UploadBookCover from '@/components/UploadBookCover.vue'
import ConversionChapters from '@/components/ConversionChapters.vue'
import { ApiError } from '@/api/errors'
import { conversionErrorMessage, formatCny, isTerminalConversion } from '@/api/conversions'
import { useBookConversion } from '@/composables/useBookConversion'

const processing = useBookConversion()
const {
  selectedFile,
  receipt,
  catalog,
  run,
  previousRun,
  canReselect,
  runId,
  submission,
  selectedChapterIds,
  selectionError,
  selectionLocked,
  fileLocked,
  selectedChapters,
  upperBoundMicros,
  overBudget,
  maxSelectableChapters,
  canConvert,
  uploadMutation,
  createMutation,
  cancelMutation,
  error,
} = processing
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const completed = computed(() => run.value?.status === 'SUCCEEDED')
const noQualifiedImages = computed(
  () => completed.value && run.value?.counts.succeeded === 0 && !run.value.artifacts.epub,
)
const sectionMode = computed(() =>
  run.value
    ? run.value.chapters.some((entry) => entry.scope === 'section')
    : catalog.value
      ? ['illustration-sections-2', 'illustration-sections-3'].includes(catalog.value.parserVersion)
      : true,
)
const unit = computed(() => (sectionMode.value ? '节' : '章'))
const contentName = computed(() => (sectionMode.value ? '小节' : '章节'))
const active = computed(() => !!run.value && !isTerminalConversion(run.value))
const skipsImageReview = computed(() => run.value?.imageReview?.enabled === false)
const hasSelectableContent = computed(
  () => catalog.value?.chapters.some((entry) => entry.selectable) ?? false,
)
const phase = computed(() =>
  run.value && isTerminalConversion(run.value)
    ? 'done'
    : fileLocked.value
      ? 'processing'
      : 'waiting',
)
const bookTitle = computed(
  () =>
    run.value?.title ||
    catalog.value?.title ||
    (selectedFile.value?.name || receipt.value?.originalName)?.replace(/\.epub$/iu, ''),
)
const originalName = computed(() => selectedFile.value?.name || receipt.value?.originalName)
const coverCaption = computed(() =>
  bookTitle.value ? '书籍占位封面 · 不替换原书封面' : '上传后显示书名',
)
const awaitingLookup = computed(
  () => !!submission.value && !runId.value && !createMutation.isPending.value,
)
const statusTitle = computed(() => {
  if (uploadMutation.isPending.value) return '正在上传这本书。'
  if (createMutation.isPending.value) return `正在提交${contentName.value}转换。`
  if (awaitingLookup.value) return '正在确认上次转换的提交结果。'
  if (runId.value && !run.value)
    return processing.runQuery.isError.value ? '转换进度暂时无法读取。' : '正在恢复上次转换的进度。'
  if (noQualifiedImages.value) return '本次没有可插入的图片。'
  if (run.value?.status === 'SUCCEEDED')
    return run.value.partial
      ? `插画版已就绪，部分${contentName.value}未完成。`
      : '插画，已经装进书里。'
  if (run.value?.status === 'FAILED') return '这次转换未能完成。'
  if (run.value?.status === 'CANCELLED') return '这次转换已停止。'
  if (run.value?.status === 'QUEUED') return `${contentName.value}已选好，等待转换。`
  if (run.value?.status === 'RUNNING')
    return run.value.stage === 'art-plan'
      ? '正在制定本书艺术方案。'
      : run.value.chapters.some((chapter) => chapter.status === 'REVIEWING')
        ? '正在检查生成的图片。'
        : ['validate', 'publish', 'export', 'assemble'].includes(run.value.stage)
          ? '正在校验并制作整本 EPUB。'
          : `正在为选中的${contentName.value}配图。`
  if (receipt.value && processing.catalogQuery.isFetching.value) return '正在免费读取章节目录。'
  if (receipt.value && processing.catalogQuery.isError.value) return '目录读取失败，请重试。'
  if (catalog.value && !catalog.value.chapters.length) return '没有识别到可配图的正文目录。'
  if (catalog.value && !hasSelectableContent.value) return '这本书暂时没有可配图的内容。'
  if (catalog.value) return `目录已准备好，选几${unit.value}试试。`
  return '下一本好看的书，等待开始。'
})
const progressDetail = computed(() => {
  if (uploadMutation.isPending.value) return '上传仅保存原书，不会自动调用模型或开始转换。'
  if (createMutation.isPending.value) return '提交内容已固定，请等待服务器确认。'
  if (awaitingLookup.value)
    return processing.lookupQuery.data.value === null
      ? '暂未查到已创建的任务。保留原章节选择，可继续查询；不会自动重复提交。'
      : '只读取原任务，不会重新上传或重复调用模型。'
  if (runId.value && !run.value) return '只读取已有任务，不会重新上传或重复转换。'
  if (cancelMutation.isSuccess.value && active.value)
    return '已请求停止，等待后台确认。当前调用可能仍在结束中。'
  if (run.value) {
    if (run.value.status === 'RUNNING' && run.value.stage === 'art-plan')
      return '先从代表性样本理解全书，再为选中的内容规划画面。此阶段还未开始生图。'
    const n = run.value.counts
    if (skipsImageReview.value) {
      const images =
        completed.value && run.value.artifacts.epub
          ? `已插入 ${n.succeeded} 幅`
          : `生成成功 ${n.succeeded} 幅`
      return `共 ${n.total} ${unit.value} · ${images} · 失败 ${n.failed} ${unit.value} · 跳过 ${n.skipped} ${unit.value} · 待确认 ${n.unknown} ${unit.value} · 未做 AI 视觉复核`
    }
    const review = n.rejected === undefined ? '' : ` · 质检未通过 ${n.rejected} ${unit.value}`
    return `共 ${n.total} ${unit.value} · 完成 ${n.succeeded} ${unit.value} · 失败 ${n.failed} ${unit.value}${review} · 跳过 ${n.skipped} ${unit.value} · 待确认 ${n.unknown} ${unit.value}`
  }
  if (receipt.value && processing.catalogQuery.isFetching.value)
    return '正在读取书籍目录，不会调用模型或开始转换。'
  if (receipt.value && processing.catalogQuery.isError.value)
    return '原书已上传，目录未能读取。可重新读取目录，或换一本 EPUB；尚未开始转换。'
  if (catalog.value && !catalog.value.chapters.length)
    return '原书已上传，但当前解析方式没有识别到正文章节或文章。可换一本 EPUB；尚未开始转换。'
  if (catalog.value && !hasSelectableContent.value)
    return '已识别目录，但没有可配图的内容。请查看各目录项的原因；尚未开始转换。'
  if (catalog.value)
    return `已选 ${selectedChapters.value.length} ${unit.value}，点击“开始转换”后才会生成插画。`
  return '放入 EPUB，读取目录后勾选小节。支持 100 MiB 以内的文件。'
})
const ratio = computed(() =>
  run.value?.counts.total ? (run.value.counts.completed / run.value.counts.total) * 100 : 0,
)
const safeError = computed(() => {
  if (selectionError.value) return selectionError.value
  if (catalog.value && receipt.value && catalog.value.sourceSha256 !== receipt.value.sha256)
    return '目录与上传文件不匹配，请重新上传。'
  if (error.value instanceof ApiError) return conversionErrorMessage(error.value.code)
  if (error.value) return '请求失败，请恢复查询。'
  if (run.value?.status === 'FAILED')
    return conversionErrorMessage(run.value.error?.code ?? 'VALIDATION_FAILED')
  return null
})
const requestId = computed(() =>
  error.value instanceof ApiError ? error.value.requestId : undefined,
)
const canResume = computed(() => !!receipt.value && (!!error.value || awaitingLookup.value))
const budgetDetail = computed(() => {
  const enforced = run.value ? run.value.budget.enforced : catalog.value?.pricing.budgetEnforced
  if (enforced === false)
    return `金额预算限制已关闭 · 费用估计上界 ${formatCny(submission.value?.input.maxCostMicros ?? upperBoundMicros.value)}`
  if (submission.value) return `本次预算上限 ${formatCny(submission.value.input.maxCostMicros)}`
  if (!catalog.value) return '选择内容后显示费用估计'
  if (!hasSelectableContent.value) return '当前没有可配图内容，尚未开始转换'
  return `已选 ${selectedChapters.value.length} ${unit.value} · 预算上限 ${formatCny(upperBoundMicros.value)}`
})
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length === 1 && input.files[0]) processing.selectFile(input.files[0])
  input.value = ''
}
function onDrop(event: DragEvent) {
  dragging.value = false
  if (fileLocked.value) return
  const files = event.dataTransfer?.files
  if (!files?.length) return
  if (files.length !== 1) {
    selectionError.value = '一次放入一本 EPUB 即可。'
    return
  }
  if (files[0]) processing.selectFile(files[0])
}
</script>

<template>
  <main class="upload-main">
    <div class="upload-page-heading">
      <div class="upload-heading-copy">
        <p class="upload-eyebrow"><span aria-hidden="true"></span>给文字，一点新的呼吸</p>
        <h1>下一本好看的书，<span>从这里开始。</span></h1>
        <p class="upload-intro">上传，选小节。在故事发生的地方配图，再带走完整的一本书。</p>
      </div>
      <div class="upload-preview-control">
        <span class="upload-preview-label">选小节 · 随文配图 · 整书导出</span>
        <div class="upload-preview-states" aria-label="书籍处理状态">
          <span :class="{ 'is-selected': phase === 'waiting' }">选小节</span>
          <span :class="{ 'is-selected': phase === 'processing' }">转换中</span>
          <span :class="{ 'is-selected': phase === 'done' }">查看结果</span>
        </div>
      </div>
    </div>
    <section class="upload-workspace" aria-label="书籍插画工作区">
      <div class="upload-columns">
        <section class="upload-source" aria-labelledby="upload-source-title">
          <div class="upload-section-heading">
            <h2 id="upload-source-title"><span>01</span>放入你的书</h2>
            <span class="upload-section-caption">YOUR ORIGINAL</span>
          </div>
          <input
            ref="fileInput"
            class="upload-file-input"
            type="file"
            tabindex="-1"
            accept=".epub,application/epub+zip"
            :disabled="fileLocked"
            aria-label="选择 EPUB 文件"
            @change="onFileChange"
          />
          <button
            class="upload-dropzone"
            :class="{ 'is-dragging': dragging }"
            type="button"
            :disabled="fileLocked"
            aria-describedby="upload-local-note"
            @click="fileInput?.click()"
            @dragover.prevent="dragging = !fileLocked"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <span class="upload-zone-corner zone-corner-one" aria-hidden="true"></span>
            <span class="upload-zone-corner zone-corner-two" aria-hidden="true"></span>
            <span class="upload-plus" aria-hidden="true"><span></span><span></span></span>
            <span class="upload-drop-title">{{ originalName || '把喜欢的书，放进来。' }}</span>
            <span class="upload-drop-description"
              >{{
                fileLocked
                  ? '保留当前书籍，等待任务确认'
                  : originalName
                    ? '换一本书，或'
                    : '拖入文件，或'
              }}
              <u v-if="!fileLocked">点击选择</u></span
            >
            <span class="upload-file-type">EPUB <span aria-hidden="true">·</span> 一次一本</span>
            <span class="upload-drop-ornament" aria-hidden="true">✦</span>
          </button>
          <div class="upload-source-footnote" id="upload-local-note">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M5 8V5a4 4 0 0 1 8 0v3M4 8h10v8H4V8Z" />
              <path d="M9 11v2" /></svg
            ><span>最大 100 MiB · 上传和读取目录免费</span>
          </div>
          <div class="upload-source-note">
            <span aria-hidden="true">“</span>
            <p>文字还是原来的文字，<br />画面，留给故事慢慢展开。</p>
          </div>
        </section>
        <section class="upload-result" aria-labelledby="upload-result-title">
          <div class="upload-section-heading">
            <h2 id="upload-result-title"><span>02</span>把画面装进书里</h2>
            <span class="upload-section-caption">A NEW EXPRESSION</span>
          </div>
          <UploadBookCover :title="bookTitle" :caption="coverCaption" />
          <a
            v-if="completed && run?.artifacts.epub"
            class="upload-download"
            :href="run.artifacts.epub"
            download
            aria-describedby="upload-progress-detail"
            ><span
              ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg
              >下载整本插画 EPUB</span
            ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" /></svg
          ></a>
          <button
            v-else
            class="upload-download"
            type="button"
            :disabled="!canConvert"
            :aria-describedby="
              overBudget && !submission
                ? 'conversion-budget conversion-budget-limit upload-progress-detail'
                : 'conversion-budget upload-progress-detail'
            "
            @click="processing.convert()"
          >
            <span
              ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m8 4 12 8-12 8V4Z" /></svg
              >{{
                noQualifiedImages
                  ? '本次未导出 EPUB'
                  : createMutation.isPending.value
                    ? '正在提交…'
                    : active
                      ? '正在转换…'
                      : '开始转换'
              }}</span
            ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
          </button>
          <p id="conversion-budget" class="upload-download-caption">{{ budgetDetail }}</p>
          <p v-if="catalog && !submission" class="conversion-cost-note">
            每{{ unit }}费用估计上界
            {{ formatCny(catalog.pricing.perChapterUpperMicros) }}，包含文字分析与一张图<span
              v-if="
                catalog.visualReview?.enabled &&
                catalog.pricing.perChapterReviewUpperMicros !== undefined
              "
              >及图片质检（已计入单{{ unit }}上界）</span
            >；失败<span v-if="catalog.visualReview?.enabled">、质检未通过</span
            >或结果待确认也可能产生费用。
            <span v-if="catalog.pricing.bookArtUpperMicros"
              >本书艺术规划为一次固定费用估计上界
              {{ formatCny(catalog.pricing.bookArtUpperMicros) }}，已计入所选内容的总上界。</span
            >
          </p>
          <div
            v-if="overBudget && !submission"
            id="conversion-budget-limit"
            class="conversion-budget-warning"
            role="alert"
          >
            <p v-if="maxSelectableChapters > 0">
              已选 {{ selectedChapters.length }} 章，超过单次
              {{ formatCny(catalog!.pricing.maxBudgetMicros) }} 上限；本次最多选
              {{ maxSelectableChapters }} 章。
            </p>
            <p v-else>当前单次预算不足以转换 1 章，请联系管理员调整预算。</p>
            <button
              v-if="maxSelectableChapters > 0"
              class="conversion-budget-adjust"
              type="button"
              @click="processing.fitSelectionToBudget()"
            >
              保留已选的前 {{ maxSelectableChapters }} 章
            </button>
          </div>
          <p v-if="catalog && !catalog.pricing.enabled" class="conversion-cost-note">
            转换服务尚未启用，仍可查看和选择章节。
          </p>
          <p v-if="noQualifiedImages" class="conversion-budget-warning">
            本次没有图片插入书中，未导出插画 EPUB。可查看逐项原因和转换报告。
          </p>
          <p v-else-if="completed && run?.partial" class="conversion-budget-warning">
            本书仅插入成功{{ contentName }}的图片，未完成内容保留原文；详见各项结果。
          </p>
        </section>
      </div>
      <ConversionChapters
        v-if="catalog"
        v-model:selected-ids="selectedChapterIds"
        :catalog="catalog"
        :locked="selectionLocked"
        :selection-limit="maxSelectableChapters"
        :run="run"
        @select-all="processing.selectAll()"
        @select-none="processing.selectNone()"
      />
      <section class="upload-progress" aria-labelledby="upload-progress-title" aria-live="polite">
        <div class="upload-progress-heading">
          <div>
            <span class="upload-status-mark" aria-hidden="true">{{
              completed && !noQualifiedImages ? '✓' : safeError || noQualifiedImages ? '!' : '·'
            }}</span>
            <h2 id="upload-progress-title">{{ statusTitle }}</h2>
          </div>
          <p v-if="run" class="upload-units">
            <span>{{ run.counts.completed }}</span
            ><small>/ {{ run.counts.total }} {{ unit }}</small>
          </p>
          <p v-else class="upload-units">{{ fileLocked ? '进行中' : '待开始' }}</p>
        </div>
        <div
          class="upload-progress-track"
          role="progressbar"
          :aria-label="`${contentName}转换进度`"
          :aria-valuemin="0"
          :aria-valuemax="run?.counts.total || undefined"
          :aria-valuenow="run ? run.counts.completed : undefined"
          :aria-valuetext="progressDetail"
        >
          <span :style="{ width: `${ratio}%` }"></span>
        </div>
        <div class="upload-progress-details">
          <p id="upload-progress-detail">{{ progressDetail }}</p>
          <span class="upload-demo-tag"
            >保留正文 · {{ sectionMode ? '随文配图' : '章末配图' }}</span
          >
        </div>
        <div v-if="safeError" class="upload-error" role="alert">
          <p>
            {{ safeError }}<span v-if="requestId"> 请求编号：{{ requestId }}</span>
          </p>
          <p v-if="uploadMutation.isError.value">
            上传结果尚未确认，请重新选择文件；不会自动重复上传。
          </p>
        </div>
        <div class="upload-run-actions">
          <button v-if="canReselect" type="button" @click="processing.reselectChapters()">
            {{ sectionMode ? '重新选择小节' : '重新选择章节' }}
          </button>
          <button
            v-if="canResume"
            type="button"
            :disabled="
              processing.lookupQuery.isFetching.value ||
              processing.runQuery.isFetching.value ||
              processing.catalogQuery.isFetching.value
            "
            @click="processing.resume()"
          >
            {{
              submission && !runId ? '继续查询提交结果' : runId ? '恢复进度查询' : '重新读取目录'
            }}
          </button>
          <button
            v-if="active"
            type="button"
            :disabled="cancelMutation.isPending.value || cancelMutation.isSuccess.value"
            @click="cancelMutation.mutate()"
          >
            {{
              cancelMutation.isPending.value
                ? '正在请求停止…'
                : cancelMutation.isSuccess.value
                  ? '等待后台停止'
                  : '停止本次转换'
            }}
          </button>
          <a v-if="run?.artifacts.report" :href="run.artifacts.report" download>下载转换报告</a>
          <p v-if="run?.status === 'FAILED'">
            请查看逐章原因；需要重新处理时，可点击上传区重新选择 EPUB。
          </p>
          <p v-if="completed && !noQualifiedImages">
            成功图片已插入同一本书。阅读器的实际排版仍以设备显示为准。
          </p>
        </div>
        <div
          v-if="previousRun && isTerminalConversion(previousRun)"
          class="upload-run-actions"
          aria-label="上次转换结果"
        >
          <span>上次转换结果</span>
          <a v-if="previousRun.artifacts.epub" :href="previousRun.artifacts.epub" download
            >下载上次插画 EPUB</a
          >
          <a v-if="previousRun.artifacts.report" :href="previousRun.artifacts.report" download
            >下载上次转换报告</a
          >
          <p v-if="!submission">
            可调整本次章节，点击“开始转换”后提交。上次任务记录已保留；已有导出仍可下载。
          </p>
        </div>
      </section>
    </section>
    <p class="upload-closing-note">
      <span aria-hidden="true">✳</span>让画面服务文字，让阅读回到书里。
    </p>
  </main>
</template>
<style scoped src="../styles/upload-workspace.css"></style>
