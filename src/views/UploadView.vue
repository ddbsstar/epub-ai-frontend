<script setup lang="ts">
import { computed, ref } from 'vue'
import UploadBookCover from '@/components/UploadBookCover.vue'
import { ApiError, publicErrorMessage } from '@/api/errors'
import { isTerminalRun } from '@/api/epub'
import { useTypographyProcessing } from '@/composables/useTypographyProcessing'
import { publicEnv } from '@/config/env'

const processing = useTypographyProcessing()
const {
  selectedFile,
  receipt,
  runId,
  run,
  runQuery,
  uploadMutation,
  createMutation,
  cancelMutation,
  canStart,
  fileLocked,
  selectionError,
  error,
  submissionUnknown,
} = processing
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const completed = computed(() => run.value?.status === 'SUCCEEDED')
const active = computed(() => !!run.value && !isTerminalRun(run.value))
const summary = computed(() => (completed.value ? run.value?.summary : null))
const typography = computed(() => summary.value?.typography)
const unchanged = computed(() => !!summary.value && summary.value.styledChapters === 0)
const originalName = computed(
  () => selectedFile.value?.name || receipt.value?.originalName || run.value?.originalName,
)
const bookTitle = computed(() => run.value?.title || originalName.value?.replace(/\.epub$/iu, ''))
const phase = computed(() =>
  run.value && isTerminalRun(run.value) ? 'done' : fileLocked.value ? 'processing' : 'waiting',
)
const safeError = computed(() => {
  if (selectionError.value) return selectionError.value
  if (error.value instanceof ApiError) return publicErrorMessage(error.value.code)
  if (error.value) return '请求失败，请恢复查询。'
  if (run.value?.status === 'FAILED')
    return publicErrorMessage(run.value.error?.code ?? 'VALIDATION_FAILED')
  return null
})
const requestId = computed(() =>
  error.value instanceof ApiError ? error.value.requestId : undefined,
)
const statusTitle = computed(() => {
  if (uploadMutation.isPending.value) return '正在上传这本书。'
  if (createMutation.isPending.value) return '正在提交排版任务。'
  if (submissionUnknown.value) return '上次排版提交结果尚未确认。'
  if (runId.value && !run.value)
    return runQuery.isError.value ? '排版进度暂时无法读取。' : '正在恢复排版进度。'
  if (run.value?.status === 'SUCCEEDED')
    return unchanged.value ? '这本书未应用新的排版。' : '排版文件，已经准备好。'
  if (run.value?.status === 'FAILED') return '这次排版未能完成。'
  if (run.value?.status === 'CANCELLED') return '这次排版已停止。'
  if (run.value?.status === 'QUEUED') return '已提交，等待开始排版。'
  if (run.value?.status === 'RUNNING') {
    if (run.value.stage === 'validate') return '正在检查格式与正文完整性。'
    if (run.value.stage === 'publish') return '正在保存排版结果。'
    return '正在整理章节与段落。'
  }
  if (receipt.value) return '原书已上传，点击开始排版。'
  return '下一本好看的书，等待开始。'
})
const progressDetail = computed(() => {
  if (uploadMutation.isPending.value) return '仅上传原书，上传完成后由你点击“开始排版”。'
  if (createMutation.isPending.value) return '正在确认本次提交，请等待；不会自动重复提交。'
  if (submissionUnknown.value)
    return '保留原书与提交编号。点击“确认上次提交结果”时会重用同一编号，不会创建另一份相同请求。'
  if (runId.value && !run.value) return '只读取已有排版任务，不重新上传或开始另一轮处理。'
  if (cancelMutation.isSuccess.value && active.value) return '已请求停止，等待后台确认。'
  if (summary.value)
    return `检查 ${summary.value.chapters} 个正文文档 · 应用排版 ${summary.value.styledChapters} 个 · 保留原样 ${summary.value.preservedChapters} 个。阅读器上的实际效果仍需查看。`
  if (run.value?.status === 'FAILED') return '没有发布排版 EPUB。请查看错误原因，修复后可重新上传。'
  if (run.value?.status === 'CANCELLED') return '原书已保留，可选择另一本 EPUB。'
  if (active.value) return '依次整理排版、校验文件并发布结果；不调用模型或生成插画。'
  if (receipt.value)
    return '统一标题、章首与适用段落的排版；受保护的复杂内容保留原样。不重写正文，不生成插画。'
  return `放入 ${publicEnv.uploadMaxMiB} MiB 以内的 EPUB。先上传，再由你开始排版。`
})
const ratio = computed(() =>
  run.value?.totalUnits ? (run.value.completedUnits / run.value.totalUnits) * 100 : 0,
)
const canReadAgain = computed(() => !!runId.value && runQuery.isError.value)
const canClearUnavailable = computed(
  () => !run.value && error.value instanceof ApiError && error.value.code === 'RUN_NOT_FOUND',
)
const roleLabels = {
  body: '正文',
  opening: '开篇段落',
  quote: '引文',
  poem: '诗行',
  caption: '图注',
  note: '注释',
  separator: '分隔元素',
}
function onFileChange(event: Event) {
  const field = event.target as HTMLInputElement
  if (field.files?.length === 1 && field.files[0]) processing.selectFile(field.files[0])
  field.value = ''
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
        <p class="upload-intro">上传 EPUB，统一章节与段落的排版，再带走完整的一本书。</p>
        <p v-if="publicEnv.publicBeta" class="upload-beta-note">公开试用 · 当前提供统一排版</p>
      </div>
      <div class="upload-preview-control">
        <span class="upload-preview-label">上传原书 · 整理排版 · 整书导出</span>
        <div class="upload-preview-states" aria-label="书籍处理状态">
          <span :class="{ 'is-selected': phase === 'waiting' }">上传原书</span>
          <span :class="{ 'is-selected': phase === 'processing' }">排版中</span>
          <span :class="{ 'is-selected': phase === 'done' }">查看结果</span>
        </div>
      </div>
    </div>
    <section class="upload-workspace" aria-label="书籍排版工作区">
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
            <span class="upload-zone-corner zone-corner-one" aria-hidden="true"></span
            ><span class="upload-zone-corner zone-corner-two" aria-hidden="true"></span>
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
            ><span>最大 {{ publicEnv.uploadMaxMiB }} MiB · 选择文件仅上传，不自动开始</span>
          </div>
          <p v-if="publicEnv.publicBeta" class="upload-retention-note">
            原书与处理结果仅供当前浏览器会话访问，上传 24 小时后自动删除，请及时下载。
          </p>
          <div class="upload-source-note">
            <span aria-hidden="true">“</span>
            <p>文字还是原来的文字，<br />让章节与留白，有一致的节奏。</p>
          </div>
        </section>
        <section class="upload-result" aria-labelledby="upload-result-title">
          <div class="upload-section-heading">
            <h2 id="upload-result-title"><span>02</span>整理阅读的细节</h2>
            <span class="upload-section-caption">A QUIETER READ</span>
          </div>
          <UploadBookCover
            :title="bookTitle"
            :cover-url="run?.artifacts.cover"
            :caption="
              run?.artifacts.cover
                ? '原书封面 · 未替换'
                : completed
                  ? '书名占位封面 · 未取得可显示的原封面'
                  : bookTitle
                    ? '书名占位封面 · 处理后尝试显示原封面'
                    : '上传后显示书名'
            "
          />
          <a
            v-if="completed && run?.artifacts.epub"
            class="upload-download"
            :href="run.artifacts.epub"
            download
            aria-describedby="upload-progress-detail"
            ><span
              ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg
              >下载排版 EPUB</span
            ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" /></svg
          ></a>
          <button
            v-else
            class="upload-download"
            type="button"
            :disabled="!canStart"
            aria-describedby="upload-processing-note upload-progress-detail"
            @click="processing.start()"
          >
            <span
              ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m8 4 12 8-12 8V4Z" /></svg
              >{{
                createMutation.isPending.value ? '正在提交…' : active ? '正在排版…' : '开始排版'
              }}</span
            ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
          </button>
          <p id="upload-processing-note" class="upload-download-caption">
            保留正文与原封面 · 不调用模型 · 不生成插画
          </p>
          <p class="conversion-cost-note">
            整理适用的标题层级、章首、段落和特殊内容；复杂结构保留原样。没有新增字体，阅读器仍可调整正文显示。
          </p>
        </section>
      </div>
      <section v-if="summary" class="typography-summary" aria-label="排版覆盖统计">
        <div class="typography-summary-heading">
          <div>
            <p>WHAT CHANGED</p>
            <h2>这次，实际整理了哪些内容。</h2>
          </div>
          <span>{{
            summary.bodyBytesPreserved ? '正文内容保留校验通过' : '正文保留状态未确认'
          }}</span>
        </div>
        <div class="typography-summary-counts">
          <p>
            <strong>{{ summary.styledChapters }}</strong
            ><span>正文文档应用排版</span>
          </p>
          <p>
            <strong>{{ summary.preservedChapters }}</strong
            ><span>正文文档保留原样</span>
          </p>
          <p>
            <strong>{{ summary.formatErrors }}</strong
            ><span>格式错误</span>
          </p>
          <p>
            <strong>{{ summary.formatWarnings }}</strong
            ><span>格式提示</span>
          </p>
        </div>
        <p v-if="unchanged" class="typography-summary-notice">
          本书没有适用的排版内容，0 个正文文档应用了新样式。导出成功不代表视觉发生变化。
        </p>
        <template v-if="typography"
          ><p class="typography-summary-detail">
            共 {{ typography.totalParagraphs }} 段 · 应用排版 {{ typography.styledParagraphs }} 段 ·
            保留原样 {{ typography.preservedParagraphs }} 段 · 整理标题
            {{ typography.styledHeadings }} 个
          </p>
          <dl class="typography-role-counts">
            <div v-for="(label, role) in roleLabels" :key="role">
              <dt>{{ label }}</dt>
              <dd>{{ typography.roleCounts[role] }}</dd>
            </div>
          </dl></template
        >
        <p class="typography-summary-detail">
          这些数字表示规则实际覆盖的范围；美观与阅读舒适度仍需在你的阅读器中确认。
        </p>
      </section>
      <section class="upload-progress" aria-labelledby="upload-progress-title" aria-live="polite">
        <div class="upload-progress-heading">
          <div>
            <span class="upload-status-mark" aria-hidden="true">{{
              completed ? '✓' : safeError ? '!' : '·'
            }}</span>
            <h2 id="upload-progress-title">{{ statusTitle }}</h2>
          </div>
          <p v-if="run" class="upload-units">
            <span>{{ run.completedUnits }}</span
            ><small>/ {{ run.totalUnits }}</small>
          </p>
          <p v-else class="upload-units">{{ fileLocked ? '进行中' : '待开始' }}</p>
        </div>
        <div
          class="upload-progress-track"
          role="progressbar"
          aria-label="排版进度"
          :aria-valuemin="0"
          :aria-valuemax="run?.totalUnits || undefined"
          :aria-valuenow="run ? run.completedUnits : undefined"
          :aria-valuetext="progressDetail"
        >
          <span :style="{ width: `${ratio}%` }"></span>
        </div>
        <div class="upload-progress-details">
          <p id="upload-progress-detail">{{ progressDetail }}</p>
          <span class="upload-demo-tag">保留正文 · 统一排版</span>
        </div>
        <div v-if="safeError" class="upload-error" role="alert">
          <p>
            {{ safeError }}<span v-if="requestId"> 请求编号：{{ requestId }}</span>
          </p>
          <p v-if="uploadMutation.isError.value">
            上传结果尚未确认，请重新选择文件；不会自动重复上传。
          </p>
          <p v-if="publicEnv.publicBeta && requestId">
            遇到问题请保留请求编号，向邀请你试用的人反馈。
          </p>
        </div>
        <div class="upload-run-actions">
          <button
            v-if="submissionUnknown"
            type="button"
            :disabled="createMutation.isPending.value"
            @click="processing.retry()"
          >
            确认上次提交结果
          </button>
          <button
            v-if="canReadAgain"
            type="button"
            :disabled="runQuery.isFetching.value"
            @click="processing.retryRun()"
          >
            恢复排版进度查询
          </button>
          <button
            v-if="canClearUnavailable"
            type="button"
            @click="processing.clearUnavailableRun()"
          >
            选择另一本书
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
                  : '停止本次排版'
            }}
          </button>
          <a v-if="run?.artifacts.report" :href="run.artifacts.report" download>下载排版报告</a>
          <p v-if="run?.status === 'FAILED'">
            请修复文件后重新上传，或选择另一本书。已有失败记录会保留。
          </p>
          <p v-if="completed && run?.warnings.length">
            报告记录了 {{ run.warnings.length }} 项提示，可下载查看。
          </p>
        </div>
      </section>
    </section>
    <p class="upload-closing-note">
      <span aria-hidden="true">✳</span>让版式服务文字，让阅读回到书里。
    </p>
  </main>
</template>
<style scoped src="../styles/upload-workspace.css"></style>
<style scoped>
.upload-beta-note {
  margin-top: 10px;
  color: #65794f;
  font-size: 11px;
  letter-spacing: 0.3px;
}
.upload-retention-note {
  margin: 12px 0 0;
  color: #77796b;
  font-size: 11px;
  line-height: 1.8;
}
.typography-summary {
  border-top: 1px solid #deded1;
  margin-top: 32px;
  padding: 28px 0 8px;
  color: #747861;
}
.typography-summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.typography-summary-heading p {
  margin: 0 0 8px;
  font-size: 8px;
  letter-spacing: 2px;
}
.typography-summary-heading h2 {
  margin: 0;
  color: #4f5746;
  font-family: var(--epub-serif);
  font-weight: 400;
  font-size: 22px;
}
.typography-summary-heading > span {
  font-size: 11px;
}
.typography-summary-counts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 20px 0;
}
.typography-summary-counts p {
  margin: 0;
  padding: 18px;
  border: 1px solid #deded1;
  background: #f6f4ed;
}
.typography-summary-counts strong {
  display: block;
  font-family: var(--epub-serif);
  font-size: 29px;
  font-weight: 400;
  color: #65794f;
}
.typography-summary-counts span {
  font-size: 10px;
}
.typography-summary-detail,
.typography-summary-notice {
  font-size: 12px;
  line-height: 1.9;
}
.typography-summary-notice {
  color: #9c714e;
  padding: 12px 16px;
  border: 1px solid #d7c4a7;
}
.typography-role-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0;
  font-size: 11px;
}
.typography-role-counts > div {
  display: flex;
  gap: 10px;
  padding: 8px 11px;
  border: 1px solid #deded1;
}
.typography-role-counts dd {
  margin: 0;
  color: #4f5746;
}
@media (max-width: 600px) {
  .typography-summary-heading {
    display: block;
  }
  .typography-summary-heading > span {
    display: block;
    margin-top: 12px;
  }
  .typography-summary-heading h2 {
    font-size: 20px;
  }
  .typography-summary-counts {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}
</style>
