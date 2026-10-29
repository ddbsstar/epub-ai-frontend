import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import { uploadEpub, uploadReceiptSchema, validateEpubFile } from '@/api/epub'
import {
  cancelIllustrationConversion,
  conversionInputSchema,
  createIllustrationConversion,
  getChapterCatalog,
  getIllustrationConversion,
  isTerminalConversion,
  lookupIllustrationConversion,
  type IllustrationConversion,
} from '@/api/conversions'

const storageKey = 'epub-book-conversion-v1'
const submissionSchema = z.object({ input: conversionInputSchema, key: z.string().uuid() }).strict()
const runIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/u)
const previousSchema = z.object({ runId: runIdSchema, submission: submissionSchema }).strict()
const savedSchema = z
  .object({
    receipt: uploadReceiptSchema,
    submission: submissionSchema.nullable(),
    runId: runIdSchema.nullable(),
    previous: previousSchema.optional(),
  })
  .strict()
  .refine((saved) => !saved.runId || !!saved.submission)
function readSaved() {
  try {
    const value = savedSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) || 'null'))
    return value.success ? value.data : null
  } catch {
    return null
  }
}
function uncertainSubmission(error: unknown) {
  if (!(error instanceof ApiError)) return true
  if (['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE', 'IDEMPOTENCY_CONFLICT'].includes(error.code))
    return true
  return (
    error.status !== undefined &&
    error.status >= 500 &&
    !['ILLUSTRATION_DISABLED', 'ILLUSTRATION_CONVERSION_DISABLED', 'PROCESSING_DISABLED'].includes(
      error.code,
    )
  )
}

export function useBookConversion() {
  const client = useQueryClient()
  const saved = readSaved()
  const selectedFile = ref<File | null>(null)
  const receipt = ref(saved?.receipt ?? null)
  const submission = ref(saved?.submission ?? null)
  const runId = ref<string | null>(saved?.runId ?? null)
  const previous = ref(saved?.previous ?? null)
  const selectedChapterIds = ref<string[]>(saved?.submission?.input.chapterIds ?? [])
  let restorePreviousSelection = !!saved?.previous && !saved.submission
  watch(
    selectedChapterIds,
    () => {
      restorePreviousSelection = false
    },
    { flush: 'sync' },
  )
  const selectionError = ref<string | null>(null)
  const submitting = ref(false)
  const binding = computed(() => ({
    bookId: receipt.value!.bookId,
    input: submission.value!.input,
  }))

  function save() {
    try {
      if (receipt.value)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            receipt: receipt.value,
            submission: submission.value,
            runId: runId.value,
            ...(previous.value ? { previous: previous.value } : {}),
          }),
        )
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* Only upload references and the frozen selection are saved; cookies retain ownership. */
    }
  }
  const catalogQuery = useQuery({
    queryKey: computed(() => ['book-chapters', receipt.value?.bookId]),
    queryFn: ({ signal }) => getChapterCatalog(receipt.value!.bookId, signal),
    enabled: computed(() => !!receipt.value),
    retry: false,
    staleTime: 0,
  })
  const runQuery = useQuery({
    queryKey: computed(() => ['book-conversion', receipt.value?.bookId, runId.value]),
    queryFn: ({ signal }) => getIllustrationConversion(runId.value!, binding.value, signal),
    enabled: computed(() => !!runId.value && !!submission.value && !!receipt.value),
    retry: false,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.error || (query.state.data && isTerminalConversion(query.state.data))
        ? false
        : 1500,
  })
  const previousQuery = useQuery({
    queryKey: computed(() => ['book-conversion', receipt.value?.bookId, previous.value?.runId]),
    queryFn: ({ signal }) =>
      getIllustrationConversion(
        previous.value!.runId,
        { bookId: receipt.value!.bookId, input: previous.value!.submission.input },
        signal,
      ),
    enabled: computed(() => !!receipt.value && !!previous.value),
    retry: false,
    staleTime: 0,
  })
  // After an interrupted POST only a read is allowed. A missing result never triggers a new POST.
  const lookupQuery = useQuery({
    queryKey: computed(() => [
      'book-conversion-lookup',
      receipt.value?.bookId,
      submission.value?.key,
    ]),
    queryFn: ({ signal }) =>
      lookupIllustrationConversion(binding.value, submission.value!.key, signal),
    enabled: computed(
      () => !!receipt.value && !!submission.value && !runId.value && !submitting.value,
    ),
    retry: false,
    staleTime: 0,
  })
  function accept(batch: IllustrationConversion) {
    client.setQueryData(['book-conversion', batch.bookId, batch.id], batch)
    runId.value = batch.id
    createMutation.reset()
    save()
  }
  const createMutation = useMutation({
    mutationFn: () => createIllustrationConversion(binding.value, submission.value!.key),
    retry: false,
    onSuccess: accept,
    onError: (error) => {
      if (!uncertainSubmission(error)) {
        submission.value = null
        save()
      }
    },
    onSettled: () => {
      submitting.value = false
    },
  })
  const uploadMutation = useMutation({
    mutationFn: uploadEpub,
    retry: false,
    onSuccess: (uploaded) => {
      receipt.value = uploaded
      save()
    },
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelIllustrationConversion(runId.value!, binding.value),
    retry: false,
    onSuccess: (batch) => client.setQueryData(['book-conversion', batch.bookId, batch.id], batch),
  })
  watch(
    () => lookupQuery.data.value,
    (batch) => {
      if (batch && !runId.value) accept(batch)
    },
  )
  const catalog = computed(() => catalogQuery.data.value)
  function successfulSelection(batch: IllustrationConversion) {
    const available = catalog.value
      ? new Set(catalog.value.chapters.filter((entry) => entry.selectable).map((entry) => entry.id))
      : null
    return batch.chapters
      .filter((entry) => entry.status === 'SUCCEEDED' && (!available || available.has(entry.id)))
      .map((entry) => entry.id)
  }
  watch(catalog, (next) => {
    if (!next || submission.value) return
    const available = new Set(
      next.chapters.filter((entry) => entry.selectable).map((entry) => entry.id),
    )
    if (selectedChapterIds.value.some((id) => !available.has(id)))
      selectedChapterIds.value = selectedChapterIds.value.filter((id) => available.has(id))
  })
  const run = computed(() => runQuery.data.value)
  const previousRun = computed(() => previousQuery.data.value)
  watch(
    previousRun,
    (batch) => {
      if (!restorePreviousSelection || !batch || !isTerminalConversion(batch)) return
      restorePreviousSelection = false
      if (!submission.value) selectedChapterIds.value = successfulSelection(batch)
    },
    { immediate: true },
  )
  const canReselect = computed(
    () =>
      !!receipt.value &&
      !!submission.value &&
      !!runId.value &&
      !!run.value &&
      isTerminalConversion(run.value) &&
      !submitting.value &&
      !createMutation.isPending.value &&
      !cancelMutation.isPending.value,
  )
  const selectionLocked = computed(() => !!submission.value)
  const fileLocked = computed(
    () =>
      uploadMutation.isPending.value ||
      (!!submission.value && (!run.value || !isTerminalConversion(run.value))),
  )
  const selectedChapters = computed(
    () =>
      catalog.value?.chapters.filter(
        (chapter) => chapter.selectable && selectedChapterIds.value.includes(chapter.id),
      ) ?? [],
  )
  const upperBoundMicros = computed(() =>
    selectedChapters.value.length > 0
      ? selectedChapters.value.length * (catalog.value?.pricing.perChapterUpperMicros ?? 0) +
        (catalog.value?.pricing.bookArtUpperMicros ?? 0)
      : 0,
  )
  const overBudget = computed(
    () =>
      !!catalog.value &&
      catalog.value.pricing.budgetEnforced !== false &&
      upperBoundMicros.value > catalog.value.pricing.maxBudgetMicros,
  )
  const maxSelectableChapters = computed(() => {
    if (!catalog.value) return 0
    const {
      perChapterUpperMicros,
      maxBudgetMicros,
      budgetEnforced,
      bookArtUpperMicros = 0,
    } = catalog.value.pricing
    const remaining = Math.max(0, maxBudgetMicros - bookArtUpperMicros)
    return Math.min(
      501,
      catalog.value.chapters.filter((chapter) => chapter.selectable).length,
      budgetEnforced === false
        ? 501
        : bookArtUpperMicros > maxBudgetMicros
          ? 0
          : perChapterUpperMicros === 0
            ? 501
            : Math.floor(remaining / perChapterUpperMicros),
    )
  })
  const canConvert = computed(
    () =>
      !!receipt.value &&
      !!catalog.value &&
      catalog.value.sourceSha256 === receipt.value.sha256 &&
      catalog.value.pricing.enabled &&
      !catalogQuery.isError.value &&
      selectedChapters.value.length > 0 &&
      selectedChapters.value.length <= 501 &&
      Number.isSafeInteger(upperBoundMicros.value) &&
      !overBudget.value &&
      !selectionLocked.value &&
      !uploadMutation.isPending.value,
  )
  const error = computed(
    () =>
      uploadMutation.error.value ??
      createMutation.error.value ??
      runQuery.error.value ??
      lookupQuery.error.value ??
      catalogQuery.error.value ??
      cancelMutation.error.value,
  )
  function selectFile(file: File) {
    if (fileLocked.value) return
    selectionError.value = validateEpubFile(file)
    if (selectionError.value) return
    selectedFile.value = file
    receipt.value = null
    runId.value = null
    submission.value = null
    previous.value = null
    restorePreviousSelection = false
    selectedChapterIds.value = []
    save()
    uploadMutation.reset()
    createMutation.reset()
    cancelMutation.reset()
    submitting.value = false
    uploadMutation.mutate(file)
  }
  function selectAll() {
    if (selectionLocked.value) return
    selectedChapterIds.value =
      catalog.value?.chapters.filter((entry) => entry.selectable).map((entry) => entry.id) ?? []
  }
  function selectNone() {
    if (!selectionLocked.value) selectedChapterIds.value = []
  }
  function fitSelectionToBudget() {
    if (selectionLocked.value || !overBudget.value || maxSelectableChapters.value < 1) return
    selectedChapterIds.value = selectedChapters.value
      .slice(0, maxSelectableChapters.value)
      .map((chapter) => chapter.id)
  }
  function convert() {
    if (!canConvert.value || !catalog.value) return
    createMutation.reset()
    cancelMutation.reset()
    submitting.value = true
    submission.value = {
      key: crypto.randomUUID(),
      input: {
        catalogId: catalog.value.catalogId,
        chapterIds: selectedChapters.value.map((entry) => entry.id),
        maxCostMicros: upperBoundMicros.value,
      },
    }
    save()
    createMutation.mutate()
  }
  function reselectChapters() {
    if (!canReselect.value || !run.value || !submission.value || !runId.value) return
    previous.value = { runId: runId.value, submission: submission.value }
    restorePreviousSelection = false
    selectedChapterIds.value = successfulSelection(run.value)
    submission.value = null
    runId.value = null
    selectionError.value = null
    submitting.value = false
    uploadMutation.reset()
    createMutation.reset()
    cancelMutation.reset()
    save()
  }
  function resume() {
    cancelMutation.reset()
    if (runId.value) void runQuery.refetch()
    else if (submission.value) void lookupQuery.refetch()
    else if (receipt.value) void catalogQuery.refetch()
  }
  return {
    selectedFile,
    receipt,
    catalog,
    run,
    previousRun,
    canReselect,
    runId,
    submission,
    selectedChapterIds,
    selectedChapters,
    selectionError,
    selectionLocked,
    fileLocked,
    upperBoundMicros,
    overBudget,
    maxSelectableChapters,
    canConvert,
    error,
    catalogQuery,
    runQuery,
    previousQuery,
    lookupQuery,
    uploadMutation,
    createMutation,
    cancelMutation,
    selectFile,
    selectAll,
    selectNone,
    fitSelectionToBudget,
    convert,
    reselectChapters,
    resume,
  }
}
