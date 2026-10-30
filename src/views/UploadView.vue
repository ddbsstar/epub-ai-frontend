<script setup lang="ts">
import { copy } from '@/content/en'
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
  if (error.value) return copy.requestFailed
  if (run.value?.status === 'FAILED')
    return publicErrorMessage(run.value.error?.code ?? 'VALIDATION_FAILED')
  return null
})
const requestId = computed(() =>
  error.value instanceof ApiError ? error.value.requestId : undefined,
)
const statusTitle = computed(() => {
  if (uploadMutation.isPending.value) return copy.uploading
  if (createMutation.isPending.value) return copy.submitting
  if (submissionUnknown.value) return copy.submissionUnknown
  if (runId.value && !run.value)
    return runQuery.isError.value ? copy.progressUnavailable : copy.restoring
  if (run.value?.status === 'SUCCEEDED') return unchanged.value ? copy.unchanged : copy.completed
  if (run.value?.status === 'FAILED') return copy.failed
  if (run.value?.status === 'CANCELLED') return copy.cancelled
  if (run.value?.status === 'QUEUED') return copy.queued
  if (run.value?.status === 'RUNNING') {
    if (run.value.stage === 'validate') return copy.validating
    if (run.value.stage === 'publish') return copy.publishing
    return copy.formatting
  }
  if (receipt.value) return copy.uploaded
  return copy.waiting
})
const progressDetail = computed(() => {
  if (uploadMutation.isPending.value) return copy.uploadDetail
  if (createMutation.isPending.value) return copy.submitDetail
  if (submissionUnknown.value) return copy.unknownDetail
  if (runId.value && !run.value) return copy.restoreDetail
  if (cancelMutation.isSuccess.value && active.value) return copy.stopDetail
  if (summary.value)
    return copy.summaryDetail(
      summary.value.chapters,
      summary.value.styledChapters,
      summary.value.preservedChapters,
    )
  if (run.value?.status === 'FAILED') return copy.failedDetail
  if (run.value?.status === 'CANCELLED') return copy.cancelledDetail
  if (active.value) return copy.activeDetail
  if (receipt.value) return copy.uploadedDetail
  return copy.waitingDetail(publicEnv.uploadMaxMiB)
})
const ratio = computed(() =>
  run.value?.totalUnits ? (run.value.completedUnits / run.value.totalUnits) * 100 : 0,
)
const canReadAgain = computed(() => !!runId.value && runQuery.isError.value)
const canClearUnavailable = computed(
  () => !run.value && error.value instanceof ApiError && error.value.code === 'RUN_NOT_FOUND',
)
const roleLabels = {
  body: copy.body,
  opening: copy.opening,
  quote: copy.quote,
  poem: copy.poem,
  caption: copy.caption,
  note: copy.note,
  separator: copy.separator,
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
    selectionError.value = copy.singleDrop
    return
  }
  if (files[0]) processing.selectFile(files[0])
}
</script>

<template>
  <main class="upload-main">
    <div class="upload-page-heading">
      <div class="upload-heading-copy">
        <p class="upload-eyebrow"><span aria-hidden="true"></span>{{ copy.uploadEyebrow }}</p>
        <h1>
          {{ copy.uploadTitleFirst }}<span>{{ copy.uploadTitleSecond }}</span>
        </h1>
        <p class="upload-intro">{{ copy.uploadIntro }}</p>
        <p v-if="publicEnv.publicBeta" class="upload-beta-note">{{ copy.uploadBeta }}</p>
      </div>
      <div class="upload-preview-control">
        <span class="upload-preview-label">{{ copy.workflow }}</span>
        <div class="upload-preview-states" :aria-label="copy.processingStateLabel">
          <span :class="{ 'is-selected': phase === 'waiting' }">{{ copy.uploadStep }}</span>
          <span :class="{ 'is-selected': phase === 'processing' }">{{ copy.formattingStep }}</span>
          <span :class="{ 'is-selected': phase === 'done' }">{{ copy.resultsStep }}</span>
        </div>
      </div>
    </div>
    <section class="upload-workspace" :aria-label="copy.workspaceLabel">
      <div class="upload-columns">
        <section class="upload-source" aria-labelledby="upload-source-title">
          <div class="upload-section-heading">
            <h2 id="upload-source-title"><span>01</span>{{ copy.chooseBook }}</h2>
            <span class="upload-section-caption">YOUR ORIGINAL</span>
          </div>
          <input
            ref="fileInput"
            class="upload-file-input"
            type="file"
            tabindex="-1"
            accept=".epub,application/epub+zip"
            :disabled="fileLocked"
            :aria-label="copy.chooseFileLabel"
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
            <span class="upload-drop-title">{{ originalName || copy.dropTitle }}</span>
            <span class="upload-drop-description"
              >{{ fileLocked ? copy.fileLocked : originalName ? copy.changeBookOr : copy.dropOr }}
              <u v-if="!fileLocked">{{ copy.browse }}</u></span
            >
            <span class="upload-file-type"
              >EPUB <span aria-hidden="true">·</span> {{ copy.oneBook }}</span
            >
            <span class="upload-drop-ornament" aria-hidden="true">✦</span>
          </button>
          <div class="upload-source-footnote" id="upload-local-note">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M5 8V5a4 4 0 0 1 8 0v3M4 8h10v8H4V8Z" />
              <path d="M9 11v2" /></svg
            ><span>{{ copy.uploadLimit(publicEnv.uploadMaxMiB) }}</span>
          </div>
          <p v-if="publicEnv.publicBeta" class="upload-retention-note">
            {{ copy.retention }}
          </p>
          <div class="upload-source-note">
            <span aria-hidden="true">“</span>
            <p>{{ copy.sourceQuoteFirst }}<br />{{ copy.sourceQuoteSecond }}</p>
          </div>
        </section>
        <section class="upload-result" aria-labelledby="upload-result-title">
          <div class="upload-section-heading">
            <h2 id="upload-result-title"><span>02</span>{{ copy.resultTitle }}</h2>
            <span class="upload-section-caption">A QUIETER READ</span>
          </div>
          <UploadBookCover
            :title="bookTitle"
            :cover-url="run?.artifacts.cover"
            :caption="
              run?.artifacts.cover
                ? copy.originalCover
                : completed
                  ? copy.noCover
                  : bookTitle
                    ? copy.pendingCover
                    : copy.pendingTitle
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
              >{{ copy.download }}</span
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
                createMutation.isPending.value
                  ? copy.submittingShort
                  : active
                    ? copy.formattingShort
                    : copy.startFormatting
              }}</span
            ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
          </button>
          <p id="upload-processing-note" class="upload-download-caption">
            {{ copy.noModel }}
          </p>
          <p class="conversion-cost-note">
            {{ copy.scope }}
          </p>
        </section>
      </div>
      <section v-if="summary" class="typography-summary" :aria-label="copy.coverageLabel">
        <div class="typography-summary-heading">
          <div>
            <p>WHAT CHANGED</p>
            <h2>{{ copy.changesTitle }}</h2>
          </div>
          <span>{{ summary.bodyBytesPreserved ? copy.bodyPassed : copy.bodyUnconfirmed }}</span>
        </div>
        <div class="typography-summary-counts">
          <p>
            <strong>{{ summary.styledChapters }}</strong
            ><span>{{ copy.styledDocuments }}</span>
          </p>
          <p>
            <strong>{{ summary.preservedChapters }}</strong
            ><span>{{ copy.preservedDocuments }}</span>
          </p>
          <p>
            <strong>{{ summary.formatErrors }}</strong
            ><span>{{ copy.formatErrors }}</span>
          </p>
          <p>
            <strong>{{ summary.formatWarnings }}</strong
            ><span>{{ copy.formatWarnings }}</span>
          </p>
        </div>
        <p v-if="unchanged" class="typography-summary-notice">
          {{ copy.zeroCoverage }}
        </p>
        <template v-if="typography"
          ><p class="typography-summary-detail">
            {{
              copy.paragraphDetail(
                typography.totalParagraphs,
                typography.styledParagraphs,
                typography.preservedParagraphs,
                typography.styledHeadings,
              )
            }}
          </p>
          <dl class="typography-role-counts">
            <div v-for="(label, role) in roleLabels" :key="role">
              <dt>{{ label }}</dt>
              <dd>{{ typography.roleCounts[role] }}</dd>
            </div>
          </dl></template
        >
        <p class="typography-summary-detail">
          {{ copy.visualLimit }}
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
          <p v-else class="upload-units">{{ fileLocked ? copy.inProgress : copy.ready }}</p>
        </div>
        <div
          class="upload-progress-track"
          role="progressbar"
          :aria-label="copy.progressLabel"
          :aria-valuemin="0"
          :aria-valuemax="run?.totalUnits || undefined"
          :aria-valuenow="run ? run.completedUnits : undefined"
          :aria-valuetext="progressDetail"
        >
          <span :style="{ width: `${ratio}%` }"></span>
        </div>
        <div class="upload-progress-details">
          <p id="upload-progress-detail">{{ progressDetail }}</p>
          <span class="upload-demo-tag">{{ copy.progressTag }}</span>
        </div>
        <div v-if="safeError" class="upload-error" role="alert">
          <p>
            {{ safeError }}<span v-if="requestId"> {{ copy.requestId(requestId) }}</span>
          </p>
          <p v-if="uploadMutation.isError.value">
            {{ copy.uploadUnknown }}
          </p>
          <p v-if="publicEnv.publicBeta && requestId">
            {{ copy.feedbackHint }}
          </p>
        </div>
        <div class="upload-run-actions">
          <button
            v-if="submissionUnknown"
            type="button"
            :disabled="createMutation.isPending.value"
            @click="processing.retry()"
          >
            {{ copy.confirmSubmission }}
          </button>
          <button
            v-if="canReadAgain"
            type="button"
            :disabled="runQuery.isFetching.value"
            @click="processing.retryRun()"
          >
            {{ copy.restoreProgress }}
          </button>
          <button
            v-if="canClearUnavailable"
            type="button"
            @click="processing.clearUnavailableRun()"
          >
            {{ copy.chooseAnother }}
          </button>
          <button
            v-if="active"
            type="button"
            :disabled="cancelMutation.isPending.value || cancelMutation.isSuccess.value"
            @click="cancelMutation.mutate()"
          >
            {{
              cancelMutation.isPending.value
                ? copy.requestingStop
                : cancelMutation.isSuccess.value
                  ? copy.waitingStop
                  : copy.stop
            }}
          </button>
          <a v-if="run?.artifacts.report" :href="run.artifacts.report" download>{{
            copy.downloadReport
          }}</a>
          <p v-if="run?.status === 'FAILED'">
            {{ copy.failedHint }}
          </p>
          <p v-if="completed && run?.warnings.length">
            {{ copy.warningCount(run.warnings.length) }}
          </p>
        </div>
      </section>
    </section>
    <p class="upload-closing-note"><span aria-hidden="true">✳</span>{{ copy.closing }}</p>
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
