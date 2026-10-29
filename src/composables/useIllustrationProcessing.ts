import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import {
  createIllustrationPlan,
  generateIllustratedBook,
  getIllustration,
  isTerminalIllustration,
  type IllustrationView,
} from '@/api/illustrations'

const storageKey = 'epub-illustration-active-v1'
const savedSchema = z.object({
  bookId: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u),
  chapterIndex: z.number().int().min(0).max(500),
  planId: z
    .string()
    .regex(/^[a-zA-Z0-9-]{1,64}$/u)
    .nullable(),
  exportId: z
    .string()
    .regex(/^[a-zA-Z0-9-]{1,64}$/u)
    .nullable(),
})
function readSaved() {
  try {
    const saved = savedSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) || 'null'))
    return saved.success ? saved.data : null
  } catch {
    return null
  }
}

export function useIllustrationProcessing(bookId: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  const currentBook = computed(() => toValue(bookId))
  const chapterOrdinal = ref(1)
  const planId = ref<string | null>(null)
  const exportId = ref<string | null>(null)
  const planSubmissionUncertain = ref(false)
  const generationSubmissionUncertain = ref(false)
  const submittedInput = ref<{ prompt: string; alt: string } | null>(null)

  function save() {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          bookId: currentBook.value,
          chapterIndex: chapterOrdinal.value - 1,
          planId: planId.value,
          exportId: exportId.value,
        }),
      )
    } catch {
      /* Only opaque IDs are saved; a blocked session store does not stop the task. */
    }
  }

  const planQuery = useQuery({
    queryKey: computed(() => ['illustration-plan', currentBook.value, planId.value]),
    queryFn: ({ signal }) =>
      getIllustration(planId.value!, { bookId: currentBook.value, kind: 'plan' }, signal),
    enabled: computed(() => !!planId.value),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.error || (query.state.data && isTerminalIllustration(query.state.data))
        ? false
        : 1500,
  })
  const exportQuery = useQuery({
    queryKey: computed(() => ['illustration-export', currentBook.value, exportId.value]),
    queryFn: ({ signal }) =>
      getIllustration(
        exportId.value!,
        {
          bookId: currentBook.value,
          kind: 'export',
          planId: planId.value!,
        },
        signal,
      ),
    enabled: computed(() => !!exportId.value && !!planId.value),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.error || (query.state.data && isTerminalIllustration(query.state.data))
        ? false
        : 1500,
  })

  function acceptPlan(view: IllustrationView) {
    client.setQueryData(['illustration-plan', currentBook.value, view.id], view)
    planId.value = view.id
    chapterOrdinal.value = view.chapterIndex + 1
    planSubmissionUncertain.value = false
    if (view.exportId) exportId.value = view.exportId
    save()
  }
  function acceptExport(view: IllustrationView) {
    client.setQueryData(['illustration-export', currentBook.value, view.id], view)
    exportId.value = view.id
    generationSubmissionUncertain.value = false
    save()
  }
  const planMutation = useMutation({
    mutationFn: (input: { bookId: string; chapterIndex: number }) =>
      createIllustrationPlan(input.bookId, input.chapterIndex),
    retry: false,
    onSuccess: (view, input) => {
      if (input.bookId === currentBook.value) acceptPlan(view)
    },
    onError: (error) => {
      planSubmissionUncertain.value =
        error instanceof ApiError &&
        ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'].includes(error.code)
    },
  })
  const generateMutation = useMutation({
    mutationFn: (input: { bookId: string; planId: string; prompt: string; alt: string }) =>
      generateIllustratedBook(input.bookId, input.planId, { prompt: input.prompt, alt: input.alt }),
    retry: false,
    onSuccess: (view, input) => {
      if (input.bookId === currentBook.value && input.planId === planId.value) acceptExport(view)
    },
    onError: (error) => {
      generationSubmissionUncertain.value =
        !(error instanceof ApiError) ||
        [
          'NETWORK_ERROR',
          'TIMEOUT',
          'INVALID_RESPONSE',
          'IDEMPOTENCY_CONFLICT',
          'INTERNAL_ERROR',
        ].includes(error.code) ||
        (error.status !== undefined &&
          error.status >= 500 &&
          error.code !== 'ILLUSTRATION_DISABLED')
      if (!generationSubmissionUncertain.value) submittedInput.value = null
    },
  })

  watch(
    currentBook,
    () => {
      const saved = readSaved()
      const matching = saved?.bookId === currentBook.value ? saved : null
      chapterOrdinal.value = matching ? matching.chapterIndex + 1 : 1
      planId.value = matching?.planId ?? null
      exportId.value = matching?.exportId ?? null
      planSubmissionUncertain.value = !!matching && !matching.planId
      generationSubmissionUncertain.value = false
      submittedInput.value = null
      planMutation.reset()
      generateMutation.reset()
    },
    { immediate: true },
  )
  watch(
    () => planQuery.data.value?.exportId,
    (id) => {
      if (id && !exportId.value) {
        exportId.value = id
        generationSubmissionUncertain.value = false
        generateMutation.reset()
        save()
      }
    },
  )

  const plan = computed(() => planQuery.data.value)
  const exported = computed(() => exportQuery.data.value)
  const busy = computed(
    () =>
      planMutation.isPending.value ||
      generateMutation.isPending.value ||
      (!!planId.value && (!plan.value || !isTerminalIllustration(plan.value))) ||
      (!!exportId.value && (!exported.value || !isTerminalIllustration(exported.value))),
  )

  function requestPlan() {
    if (busy.value || exportId.value) return
    const index = Number(chapterOrdinal.value) - 1
    if (!Number.isInteger(index) || index < 0 || index > 500) return
    // Explicit click only. A retry has the same book/chapter and derived key.
    planId.value = null
    exportId.value = null
    submittedInput.value = null
    save()
    planMutation.mutate({ bookId: currentBook.value, chapterIndex: index })
  }
  function generate(prompt: string, alt: string) {
    if (busy.value || exportId.value || plan.value?.status !== 'SUCCEEDED' || !planId.value) return
    submittedInput.value ??= { prompt, alt }
    generateMutation.mutate({
      bookId: currentBook.value,
      planId: planId.value,
      ...submittedInput.value,
    })
  }
  function resumeQuery() {
    if (exportId.value) void exportQuery.refetch()
    else if (planId.value) void planQuery.refetch()
  }

  return {
    chapterOrdinal,
    plan,
    exported,
    planId,
    exportId,
    busy,
    planQuery,
    exportQuery,
    planMutation,
    generateMutation,
    planSubmissionUncertain,
    generationSubmissionUncertain,
    requestPlan,
    generate,
    resumeQuery,
  }
}
