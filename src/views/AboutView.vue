<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { ApiError, publicErrorMessage } from '@/api/errors'
import {
  feedbackInputSchema,
  getCapabilities,
  submitFeedback,
  type FeedbackInput,
} from '@/api/feedback'
import { supportCopy as copy } from '@/content/support-en'

const capabilities = useQuery({
  queryKey: ['public-capabilities'],
  queryFn: ({ signal }) => getCapabilities(signal),
  retry: false,
  staleTime: Infinity,
})
const settings = computed(() => capabilities.data.value)
const feedbackAvailable = computed(
  () =>
    !capabilities.isError.value &&
    settings.value?.feedbackAvailable === true &&
    typeof settings.value.feedbackRetentionHours === 'number',
)
const form = reactive({
  category: '',
  reader: '',
  deliveryRoute: '',
  rating: '',
  requestId: '',
  description: '',
})
const validationError = ref<string | null>(null)
const pending = ref<{ key: string; input: FeedbackInput } | null>(null)
const unconfirmed = ref(false)
function isUncertain(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    ['TIMEOUT', 'NETWORK_ERROR', 'INVALID_RESPONSE', 'IDEMPOTENCY_CONFLICT'].includes(error.code)
  )
}
const submission = useMutation({
  mutationFn: () => submitFeedback(pending.value!.input, pending.value!.key),
  retry: false,
  onSuccess: () => {
    unconfirmed.value = false
  },
  onError: (error) => {
    unconfirmed.value = isUncertain(error)
    if (!unconfirmed.value) pending.value = null
  },
})
const locked = computed(
  () => submission.isPending.value || unconfirmed.value || submission.isSuccess.value,
)
const safeError = computed(() =>
  submission.error.value instanceof ApiError
    ? publicErrorMessage(submission.error.value.code)
    : submission.error.value
      ? publicErrorMessage('UNKNOWN_ERROR')
      : null,
)
function send() {
  if (!feedbackAvailable.value || locked.value) return
  validationError.value = null
  const parsed = feedbackInputSchema.safeParse({
    category: form.category,
    reader: form.reader,
    deliveryRoute: form.deliveryRoute,
    ...(form.rating ? { rating: form.rating } : {}),
    ...(form.requestId.trim() ? { requestId: form.requestId.trim() } : {}),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
  })
  if (!parsed.success) {
    validationError.value = parsed.error.issues.some((issue) => issue.path[0] === 'requestId')
      ? copy.invalidRequestId
      : copy.requiredFields
    return
  }
  pending.value = { key: crypto.randomUUID(), input: parsed.data }
  submission.mutate()
}
function confirm() {
  if (feedbackAvailable.value && unconfirmed.value && pending.value && !submission.isPending.value)
    submission.mutate()
}
</script>

<template>
  <main class="about-main">
    <header class="about-heading">
      <p class="about-eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.introduction }}</p>
    </header>
    <div class="about-columns">
      <div class="about-facts">
        <section aria-labelledby="scope-title">
          <h2 id="scope-title">{{ copy.scopeTitle }}</h2>
          <p>{{ copy.scope }}</p>
          <p>{{ copy.controls }}</p>
          <p>{{ copy.models }}</p>
        </section>
        <section aria-labelledby="reader-title">
          <h2 id="reader-title">{{ copy.readerTitle }}</h2>
          <p>{{ copy.reader }}</p>
          <p>{{ copy.demo }}</p>
        </section>
        <section aria-labelledby="files-title">
          <h2 id="files-title">{{ copy.filesTitle }}</h2>
          <p v-if="settings?.uploadMaxMiB && settings?.retentionHours">
            {{ copy.limits(settings.uploadMaxMiB, settings.retentionHours) }}
          </p>
          <p v-else>{{ copy.limitsUnknown }}</p>
          <p>{{ copy.session }}</p>
          <p>{{ copy.expiry }}</p>
        </section>
      </div>
      <section id="feedback" class="feedback-panel" aria-labelledby="feedback-title">
        <p class="about-eyebrow">YOUR READING EXPERIENCE</p>
        <h2 id="feedback-title">{{ copy.feedbackTitle }}</h2>
        <p id="feedback-privacy">{{ copy.feedbackIntroduction }}</p>
        <p id="feedback-private-reminder">{{ copy.feedbackPrivacy }}</p>
        <p v-if="settings?.feedbackRetentionHours">
          {{ copy.feedbackRetention(settings.feedbackRetentionHours) }}
        </p>
        <p v-else-if="settings?.feedbackAvailable">{{ copy.feedbackRetentionUnknown }}</p>
        <p v-if="capabilities.isPending.value" role="status">{{ copy.capabilityLoading }}</p>
        <div v-else-if="capabilities.isError.value" role="alert">
          <p>{{ copy.capabilityUnavailable }}</p>
          <button
            class="text-action"
            type="button"
            :disabled="capabilities.isFetching.value"
            @click="capabilities.refetch()"
          >
            {{ copy.retryCapabilities }}
          </button>
        </div>
        <p v-else-if="!feedbackAvailable" role="status">{{ copy.feedbackUnavailable }}</p>

        <div v-if="submission.data.value" class="feedback-receipt" role="status" aria-live="polite">
          <h3>{{ copy.success }}</h3>
          <p>{{ copy.receipt(submission.data.value.receiptId) }}</p>
          <p>{{ copy.receiptExpiry(submission.data.value.expiresAt) }}</p>
          <p>{{ copy.thankYou }}</p>
        </div>
        <form
          v-else
          aria-labelledby="feedback-title"
          aria-describedby="feedback-privacy feedback-private-reminder"
          novalidate
          @submit.prevent="send"
        >
          <fieldset :disabled="!feedbackAvailable || locked">
            <legend class="feedback-legend">{{ copy.fieldsLegend }}</legend>
            <div class="feedback-field">
              <label for="feedback-category">{{ copy.category }}</label>
              <select id="feedback-category" v-model="form.category" required>
                <option value="" disabled>{{ copy.choose }}</option>
                <option v-for="(label, value) in copy.categoryOptions" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
            <div class="feedback-field">
              <label for="feedback-reader">{{ copy.readerField }}</label>
              <select id="feedback-reader" v-model="form.reader" required>
                <option value="" disabled>{{ copy.choose }}</option>
                <option v-for="(label, value) in copy.readerOptions" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
            <div class="feedback-field">
              <label for="feedback-route">{{ copy.route }}</label>
              <select id="feedback-route" v-model="form.deliveryRoute" required>
                <option value="" disabled>{{ copy.choose }}</option>
                <option v-for="(label, value) in copy.routeOptions" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
            <div class="feedback-field">
              <label for="feedback-rating">{{ copy.rating }}</label>
              <select id="feedback-rating" v-model="form.rating">
                <option value="">{{ copy.noRating }}</option>
                <option v-for="(label, value) in copy.ratingOptions" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
            <div class="feedback-field">
              <label for="feedback-request-id">{{ copy.requestId }}</label>
              <input
                id="feedback-request-id"
                v-model="form.requestId"
                maxlength="128"
                autocomplete="off"
                spellcheck="false"
                aria-describedby="feedback-request-hint"
              />
              <small id="feedback-request-hint">{{ copy.requestIdHint }}</small>
            </div>
            <div class="feedback-field">
              <label for="feedback-description">{{ copy.description }}</label>
              <textarea
                id="feedback-description"
                v-model="form.description"
                maxlength="1000"
                rows="5"
                autocomplete="off"
                aria-describedby="feedback-description-hint"
              ></textarea>
              <small id="feedback-description-hint">{{ copy.descriptionHint }}</small>
            </div>
            <button class="feedback-submit" type="submit">
              {{ submission.isPending.value ? copy.submitting : copy.submit }}
            </button>
          </fieldset>
        </form>
        <p v-if="validationError" role="alert">{{ validationError }}</p>
        <div v-if="safeError" class="feedback-error" role="alert">
          <p>{{ safeError }}</p>
        </div>
        <div v-if="unconfirmed" class="feedback-confirmation">
          <p>{{ copy.uncertain }}</p>
          <button
            class="feedback-submit"
            type="button"
            :disabled="!feedbackAvailable || submission.isPending.value"
            @click="confirm"
          >
            {{ copy.confirm }}
          </button>
        </div>
        <p class="feedback-draft-note">{{ copy.noLocalSave }}</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.about-main {
  width: 100%;
  max-width: 1160px;
  margin: 0 auto;
  padding: 52px 0 64px;
  flex: 1;
}
.about-heading {
  max-width: 760px;
  margin-bottom: 40px;
}
.about-eyebrow {
  color: var(--epub-copper);
  font-size: 9px;
  letter-spacing: 1.5px;
}
h1,
h2,
h3 {
  font-family: var(--epub-serif);
  font-weight: 400;
  color: var(--epub-ink);
}
h1 {
  font-size: clamp(30px, 4vw, 48px);
  line-height: 1.25;
  margin: 20px 0;
}
h2 {
  font-size: 23px;
  line-height: 1.4;
  margin-bottom: 16px;
}
h3 {
  font-size: 20px;
  margin-bottom: 12px;
}
p {
  color: #727769;
  font-size: 13px;
  line-height: 1.9;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.about-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 64px;
  align-items: start;
}
.about-facts section {
  margin-bottom: 36px;
}
.feedback-panel {
  min-width: 0;
  border-left: 1px solid var(--epub-line);
  padding-left: 38px;
  scroll-margin-top: 28px;
}
.feedback-panel > .about-eyebrow {
  margin-top: 0;
}
.feedback-panel > h2 {
  font-size: 28px;
}
fieldset {
  padding: 0;
  margin: 20px 0 0;
  border: 0;
  min-width: 0;
}
.feedback-legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.feedback-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  min-width: 0;
}
label {
  color: #525a48;
  font-size: 12px;
  line-height: 1.5;
}
input,
select,
textarea {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #c7cbbb;
  border-radius: 2px;
  padding: 11px 12px;
  background: #fbf9f3;
  color: var(--epub-ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
}
textarea {
  resize: vertical;
}
small {
  color: #7b806f;
  font-size: 11px;
  line-height: 1.7;
}
.feedback-submit {
  border: 1px solid var(--epub-ink);
  border-radius: 2px;
  background: var(--epub-ink);
  color: #faf8f0;
  font: inherit;
  font-size: 12px;
  padding: 13px 18px;
  cursor: pointer;
  max-width: 100%;
  line-height: 1.5;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
fieldset:disabled input,
fieldset:disabled select,
fieldset:disabled textarea {
  opacity: 0.6;
}
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 2px solid var(--epub-copper);
  outline-offset: 3px;
}
.text-action {
  background: transparent;
  border: 0;
  padding: 4px 0;
  color: var(--epub-copper);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}
.feedback-receipt,
.feedback-error,
.feedback-confirmation {
  border: 1px solid #c9cfbc;
  padding: 16px;
  margin: 20px 0;
}
.feedback-error {
  border-color: #d5b99f;
}
.feedback-draft-note {
  font-size: 11px;
}
@media (max-width: 800px) {
  .about-main {
    padding: 36px 0;
  }
  .about-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .feedback-panel {
    padding: 30px 0 0;
    border-left: 0;
    border-top: 1px solid var(--epub-line);
  }
  .about-heading {
    margin-bottom: 30px;
  }
}
</style>
