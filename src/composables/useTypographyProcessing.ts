import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import { publicEnv } from '@/config/env'
import {
  cancelEpubRun,
  createEpubExport,
  getEpubRun,
  isTerminalRun,
  uploadEpub,
  uploadReceiptSchema,
  validateEpubFile,
  type EpubRun,
} from '@/api/epub'

const storageKey = 'epub-typography-processing-v1'
const savedSchema = z
  .object({
    receipt: uploadReceiptSchema,
    key: z.string().uuid(),
    submitted: z.boolean(),
    runId: z
      .string()
      .regex(/^[\w-]{1,128}$/u)
      .nullable(),
  })
  .strict()
  .refine((value) => !value.runId || value.submitted)
function readSaved() {
  try {
    const value = savedSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) || 'null'))
    return value.success ? value.data : null
  } catch {
    return null
  }
}
function uncertainSubmission(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE', 'IDEMPOTENCY_CONFLICT'].includes(error.code) ||
    error.status === undefined ||
    error.status >= 500
  )
}

export function useTypographyProcessing() {
  const client = useQueryClient()
  const saved = readSaved()
  const selectedFile = ref<File | null>(null)
  const receipt = ref(saved?.receipt ?? null)
  const runId = ref<string | null>(saved?.runId ?? null)
  const key = ref<string | null>(saved?.key ?? null)
  const submitted = ref(saved?.submitted ?? false)
  const selectionError = ref<string | null>(null)
  function save() {
    try {
      if (receipt.value && key.value)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            receipt: receipt.value,
            key: key.value,
            submitted: submitted.value,
            runId: runId.value,
          }),
        )
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* Opaque references only; the HttpOnly session cookie retains ownership. */
    }
  }
  function assertBook(run: EpubRun) {
    if (!receipt.value || run.bookId !== receipt.value.bookId)
      throw new ApiError('INVALID_RESPONSE', '排版任务与当前书籍不匹配。')
    return run
  }
  const runQuery = useQuery({
    queryKey: computed(() => ['typography-run', receipt.value?.bookId, runId.value]),
    queryFn: async ({ signal }) => assertBook(await getEpubRun(runId.value!, signal)),
    enabled: computed(() => !!receipt.value && !!runId.value),
    retry: false,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.error || (query.state.data && isTerminalRun(query.state.data)) ? false : 1500,
  })
  const run = computed(() => runQuery.data.value)
  const createMutation = useMutation({
    mutationFn: async () =>
      assertBook(await createEpubExport(receipt.value!.bookId, key.value!, 'reader-editorial')),
    retry: false,
    onSuccess: (created) => {
      client.setQueryData(['typography-run', created.bookId, created.id], created)
      runId.value = created.id
      save()
    },
    onError: (error) => {
      if (!uncertainSubmission(error)) submitted.value = false
      save()
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
    mutationFn: async () => assertBook(await cancelEpubRun(runId.value!)),
    retry: false,
    onSuccess: (updated) =>
      client.setQueryData(['typography-run', updated.bookId, updated.id], updated),
  })
  const submissionUnknown = computed(
    () => submitted.value && !runId.value && !createMutation.isPending.value,
  )
  const busy = computed(
    () =>
      uploadMutation.isPending.value ||
      createMutation.isPending.value ||
      submissionUnknown.value ||
      (!!runId.value && (!run.value || !isTerminalRun(run.value))),
  )
  const fileLocked = computed(() => busy.value)
  const canStart = computed(
    () => !!receipt.value && !!key.value && !submitted.value && !runId.value && !busy.value,
  )
  const error = computed(
    () =>
      uploadMutation.error.value ??
      createMutation.error.value ??
      runQuery.error.value ??
      cancelMutation.error.value,
  )
  function selectFile(file: File) {
    if (fileLocked.value) return
    selectionError.value = validateEpubFile(file, publicEnv.uploadMaxMiB * 1024 * 1024)
    if (selectionError.value) return
    selectedFile.value = file
    receipt.value = null
    runId.value = null
    submitted.value = false
    key.value = crypto.randomUUID()
    uploadMutation.reset()
    createMutation.reset()
    cancelMutation.reset()
    save()
    uploadMutation.mutate(file)
  }
  function start() {
    if (!canStart.value) return
    submitted.value = true
    createMutation.reset()
    cancelMutation.reset()
    save()
    createMutation.mutate()
  }
  function retryRun() {
    if (runId.value && !runQuery.isFetching.value) {
      cancelMutation.reset()
      void runQuery.refetch()
    }
  }
  function retry() {
    if (runId.value) return retryRun()
    if (submissionUnknown.value && receipt.value && key.value) {
      createMutation.reset()
      createMutation.mutate()
    }
  }
  const canClearUnavailableRun = computed(
    () =>
      !run.value &&
      runQuery.error.value instanceof ApiError &&
      runQuery.error.value.code === 'RUN_NOT_FOUND',
  )
  function clearUnavailableRun() {
    if (!canClearUnavailableRun.value) return
    receipt.value = null
    runId.value = null
    key.value = null
    submitted.value = false
    selectedFile.value = null
    selectionError.value = null
    uploadMutation.reset()
    createMutation.reset()
    cancelMutation.reset()
    save()
  }
  return {
    selectedFile,
    receipt,
    runId,
    run,
    runQuery,
    uploadMutation,
    createMutation,
    cancelMutation,
    canStart,
    busy,
    fileLocked,
    selectionError,
    error,
    submissionUnknown,
    submitted,
    canClearUnavailableRun,
    selectFile,
    start,
    retry,
    retryRun,
    clearUnavailableRun,
  }
}
