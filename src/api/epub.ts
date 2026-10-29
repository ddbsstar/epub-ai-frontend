import { z } from 'zod'
import { apiRequest } from './client'
import { ApiError } from './errors'

export const MAX_EPUB_BYTES = 100 * 1024 * 1024
const artifactPath = z.string().regex(/^\/api\/v1\/artifacts\/[a-zA-Z0-9-]+\/download$/u)
const units = z.number().int().nonnegative()
const typographySchema = z
  .object({
    profile: z.literal('editorial-1'),
    totalParagraphs: units,
    styledParagraphs: units,
    preservedParagraphs: units,
    styledHeadings: units,
    roleCounts: z.object({
      body: units,
      opening: units,
      quote: units,
      poem: units,
      caption: units,
      note: units,
      separator: units,
    }),
  })
  .refine(
    (summary) =>
      summary.styledParagraphs + summary.preservedParagraphs === summary.totalParagraphs &&
      summary.roleCounts.body +
        summary.roleCounts.opening +
        summary.roleCounts.quote +
        summary.roleCounts.poem +
        summary.roleCounts.caption +
        summary.roleCounts.note ===
        summary.styledParagraphs,
    'Invalid typography paragraph counts',
  )
export const epubAiSchema = z
  .object({
    status: z.enum(['DISABLED', 'PENDING', 'RUNNING', 'APPLIED', 'FALLBACK', 'SKIPPED']),
    model: z.string().min(1).nullable(),
    reasonCode: z.string().nullable(),
    sampledBlocks: units,
    appliedBlocks: units,
    usage: z.object({ inputTokens: units, outputTokens: units, totalTokens: units }).nullable(),
    estimatedCostMicros: z.number().int().nonnegative().nullable(),
    currency: z.literal('CNY'),
  })
  .refine((ai) => ai.appliedBlocks <= ai.sampledBlocks, 'Invalid AI block counts')
export const uploadReceiptSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  originalName: z.string(),
  byteSize: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/iu),
})
export const epubRunSchema = z
  .object({
    id: z.string().min(1),
    bookId: z.string().min(1),
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
    stage: z.string(),
    completedUnits: units,
    totalUnits: units,
    originalName: z.string(),
    title: z.string().nullable(),
    artifacts: z.object({
      epub: artifactPath.nullable(),
      report: artifactPath.nullable(),
      cover: artifactPath.nullable(),
    }),
    summary: z
      .object({
        chapters: units,
        styledChapters: units,
        preservedChapters: units,
        bodyBytesPreserved: z.boolean(),
        formatErrors: units,
        formatWarnings: units,
        typography: typographySchema.optional(),
      })
      .nullable(),
    ai: epubAiSchema.optional(),
    warnings: z.array(z.string()),
    error: z.object({ code: z.string(), message: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((run) => run.completedUnits <= run.totalUnits, 'Invalid processing units')

export type UploadReceipt = z.infer<typeof uploadReceiptSchema>
export type EpubRun = z.infer<typeof epubRunSchema>

export function isTerminalRun(run: EpubRun): boolean {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)
}

export function validateEpubFile(file: File, maxBytes = MAX_EPUB_BYTES): string | null {
  if (!file.name.toLowerCase().endsWith('.epub')) return '请选择 EPUB 格式的文件。'
  if (file.size === 0) return '这份文件是空的，请重新选择。'
  if (file.size > maxBytes) return `文件超过 ${maxBytes / (1024 * 1024)} MiB，请选择较小的 EPUB。`
  return null
}

export function uploadEpub(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest(
    {
      method: 'POST',
      url: '/v1/uploads',
      data: form,
      timeout: 120_000,
      withCredentials: true,
    },
    uploadReceiptSchema,
  )
}

export async function createEpubExport(
  bookId: string,
  idempotencyKey: string,
  theme: 'reader-first' | 'reader-editorial' = 'reader-first',
) {
  const run = await apiRequest(
    {
      method: 'POST',
      url: `/v1/books/${encodeURIComponent(bookId)}/exports`,
      data: { theme },
      headers: { 'Idempotency-Key': idempotencyKey },
      withCredentials: true,
    },
    epubRunSchema,
  )
  if (run.bookId !== bookId) throw new ApiError('INVALID_RESPONSE', '排版任务与当前书籍不匹配。')
  return run
}

export async function getEpubRun(runId: string, signal?: AbortSignal) {
  const run = await apiRequest(
    { url: `/v1/runs/${encodeURIComponent(runId)}`, signal, withCredentials: true },
    epubRunSchema,
  )
  if (run.id !== runId) throw new ApiError('INVALID_RESPONSE', '返回的排版任务不匹配。')
  return run
}

export async function cancelEpubRun(runId: string) {
  const run = await apiRequest(
    { method: 'POST', url: `/v1/runs/${encodeURIComponent(runId)}/cancel`, withCredentials: true },
    epubRunSchema,
  )
  if (run.id !== runId) throw new ApiError('INVALID_RESPONSE', '返回的排版任务不匹配。')
  return run
}
