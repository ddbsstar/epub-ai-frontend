import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  cancelEpubRun,
  createEpubExport,
  getEpubRun,
  isTerminalRun,
  uploadEpub,
  validateEpubFile,
  type UploadReceipt,
} from '@/api/epub'

const activeRunKey = 'epub-active-run-v1'
function readActiveRun(): string | null {
  try {
    const id = sessionStorage.getItem(activeRunKey)
    return id && /^[\w-]{1,128}$/u.test(id) ? id : null
  } catch {
    return null
  }
}
function saveActiveRun(id: string | null) {
  try {
    if (id) sessionStorage.setItem(activeRunKey, id)
    else sessionStorage.removeItem(activeRunKey)
  } catch {
    /* Private browsing may disable storage; processing still works. */
  }
}

export function useEpubProcessing() {
  const client = useQueryClient()
  const selectedFile = ref<File | null>(null)
  const uploadReceipt = ref<UploadReceipt | null>(null)
  // This is an opaque reference, never an access token; ownership remains in the HttpOnly cookie.
  const runId = ref<string | null>(readActiveRun())
  const idempotencyKey = ref<string | null>(null)
  const selectionError = ref<string | null>(null)
  const runQuery = useQuery({
    queryKey: computed(() => ['epub-run', runId.value]),
    queryFn: ({ signal }) => getEpubRun(runId.value!, signal),
    enabled: computed(() => !!runId.value),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.error || (query.state.data && isTerminalRun(query.state.data)) ? false : 1_500,
  })
  const createMutation = useMutation({
    mutationFn: () => createEpubExport(uploadReceipt.value!.bookId, idempotencyKey.value!),
    onSuccess: (run) => {
      client.setQueryData(['epub-run', run.id], run)
      runId.value = run.id
      saveActiveRun(run.id)
    },
  })
  const uploadMutation = useMutation({
    mutationFn: uploadEpub,
    onSuccess: (receipt) => {
      uploadReceipt.value = receipt
      createMutation.mutate()
    },
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelEpubRun(runId.value!),
    onSuccess: (run) => client.setQueryData(['epub-run', run.id], run),
  })
  const run = computed(() => runQuery.data.value)
  const busy = computed(
    () =>
      uploadMutation.isPending.value ||
      createMutation.isPending.value ||
      (!!runId.value && !run.value) ||
      (!!run.value && !isTerminalRun(run.value)),
  )
  const error = computed(
    () =>
      uploadMutation.error.value ??
      createMutation.error.value ??
      runQuery.error.value ??
      cancelMutation.error.value,
  )

  function selectFile(file: File) {
    if (busy.value) return
    selectionError.value = validateEpubFile(file)
    if (selectionError.value) return
    selectedFile.value = file
    uploadReceipt.value = null
    runId.value = null
    saveActiveRun(null)
    idempotencyKey.value = crypto.randomUUID()
    uploadMutation.reset()
    createMutation.reset()
    cancelMutation.reset()
    uploadMutation.mutate(file)
  }
  function retry() {
    if (createMutation.isError.value && uploadReceipt.value) createMutation.mutate()
    else if (runQuery.isError.value && runId.value) void runQuery.refetch()
  }

  function clearUnavailableRun() {
    if (run.value || !runQuery.isError.value) return
    runId.value = null
    saveActiveRun(null)
  }

  return {
    selectedFile,
    run,
    runQuery,
    uploadMutation,
    createMutation,
    cancelMutation,
    busy,
    error,
    selectionError,
    selectFile,
    retry,
    clearUnavailableRun,
  }
}
