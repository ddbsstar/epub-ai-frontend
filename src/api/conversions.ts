import { z } from 'zod'
import { apiRequest } from './client'
import { ApiError, publicErrorMessage } from './errors'

const identifier = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/u)
const digest = z.string().regex(/^[a-f0-9]{64}$/u)
const units = z.number().int().nonnegative().safe()
const artifact = z.string().regex(/^\/api\/v1\/artifacts\/[a-zA-Z0-9-]+\/download$/u)
const image = z
  .string()
  .regex(/^\/api\/v1\/illustration-conversions\/[a-zA-Z0-9-]+\/chapters\/[a-f0-9]{64}\/image$/u)
const directionFields = {
  hash: digest,
  label: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  status: z.literal('provisional'),
  visualReview: z.literal('unreviewed'),
}
const artDirection = z.discriminatedUnion('id', [
  z
    .object({ id: z.literal('literary-editorial'), version: z.literal(2), ...directionFields })
    .strict(),
  z.object({ id: z.literal('book-art'), version: z.literal(1), ...directionFields }).strict(),
])
const bookArtPlan = z
  .object({
    reading: z.string().min(1).max(4000),
    rationale: z.string().min(1).max(4000),
    coverage: z
      .object({
        mode: z.literal('representative-samples'),
        totalSupportedSections: units,
        sampledSections: units,
        sampledParagraphs: units,
      })
      .refine((coverage) => coverage.sampledSections <= coverage.totalSupportedSections),
    medium: z.string().min(1).max(100),
    palette: z
      .array(
        z
          .object({
            colorName: z.string().min(1).max(100),
            hex: z.string().regex(/^#[a-f0-9]{6}$/iu),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    lineLanguage: z.string().min(1).max(1000),
    shapeLanguage: z.string().min(1).max(1000),
    negativeSpace: z.string().min(1).max(100),
    characterTreatment: z.string().min(1).max(1000),
  })
  .strict()
const visualPlan = z
  .object({
    concepts: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            idea: z.string().min(1).max(4000),
            composition: z.string().min(1).max(4000),
            emotionalIntent: z.string().min(1).max(2000),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    selectedConceptId: z.string().min(1).max(100),
    selectionReason: z.string().min(1).max(4000),
  })
  .strict()
  .superRefine((plan, context) => {
    if (
      new Set(plan.concepts.map((concept) => concept.id)).size !== plan.concepts.length ||
      !plan.concepts.some((concept) => concept.id === plan.selectedConceptId)
    )
      context.addIssue({ code: 'custom', message: 'Invalid visual concept selection' })
  })
const visualReview = z
  .object({
    status: z.enum(['PASSED', 'REJECTED', 'UNCERTAIN']),
    summary: z.string().min(1).max(320),
    checks: z
      .array(
        z
          .object({
            aspect: z.enum(['source', 'people', 'style', 'composition', 'artifacts']),
            result: z.enum(['PASS', 'FAIL', 'UNCERTAIN']),
            reason: z.string().min(1).max(200),
          })
          .strict(),
      )
      .length(5),
  })
  .strict()
  .superRefine((review, context) => {
    const failed = review.checks.some((check) => check.result === 'FAIL')
    const uncertain = review.checks.some((check) => check.result === 'UNCERTAIN')
    if (
      new Set(review.checks.map((check) => check.aspect)).size !== 5 ||
      (review.status === 'PASSED' && (failed || uncertain)) ||
      (review.status === 'REJECTED' && !failed) ||
      (review.status === 'UNCERTAIN' && (failed || !uncertain))
    )
      context.addIssue({ code: 'custom', message: 'Invalid visual review result' })
  })
const chapter = z.object({
  id: digest,
  index: z.number().int().min(-1),
  title: z.string().max(2000),
  level: units,
  selectable: z.boolean(),
  reasonCode: z.string().nullable(),
  scope: z.enum(['chapter', 'section']).optional(),
  sectionId: digest.optional(),
  parentChapterTitle: z.string().max(2000).optional(),
  boundaryKind: z.enum(['heading', 'document']).optional(),
})
export const chapterCatalogSchema = z
  .object({
    catalogId: digest,
    sourceSha256: digest,
    parserVersion: z.string().min(1).max(100),
    title: z.string().max(2000).nullable(),
    artDirection: artDirection.optional(),
    artPlanning: z
      .object({ mode: z.literal('content-directed'), description: z.string().min(1).max(2000) })
      .strict()
      .optional(),
    visualReview: z
      .object({ enabled: z.boolean(), description: z.string().min(1).max(2000) })
      .strict()
      .optional(),
    chapters: z.array(chapter).max(10000),
    pricing: z.object({
      currency: z.literal('CNY'),
      perChapterUpperMicros: units,
      bookArtUpperMicros: units.optional(),
      perChapterReviewUpperMicros: units.optional(),
      maxBudgetMicros: units,
      enabled: z.boolean(),
      budgetEnforced: z.boolean().optional(),
    }),
  })
  .superRefine((catalog, context) => {
    if (
      new Set(catalog.chapters.map((entry) => entry.id)).size !== catalog.chapters.length ||
      catalog.chapters.some((entry) => entry.selectable && entry.index < 0)
    )
      context.addIssue({ code: 'custom', message: 'Invalid chapter catalog' })
  })
export const conversionInputSchema = z
  .object({
    catalogId: digest,
    chapterIds: z.array(digest).min(1).max(501),
    maxCostMicros: units,
  })
  .strict()
  .refine((input) => new Set(input.chapterIds).size === input.chapterIds.length)
export const conversionSchema = z
  .object({
    id: identifier,
    bookId: identifier,
    catalogId: digest,
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
    stage: z.string().max(100),
    originalName: z.string().max(2000),
    title: z.string().max(2000).nullable(),
    artDirection: artDirection.optional(),
    bookArtPlan: bookArtPlan.optional(),
    imageReview: z
      .object({ enabled: z.boolean(), description: z.string().min(1).max(2000) })
      .strict()
      .optional(),
    chapters: z
      .array(
        z.object({
          id: digest,
          index: units,
          title: z.string().max(2000),
          status: z.enum([
            'WAITING',
            'PLANNING',
            'GENERATING',
            'REVIEWING',
            'SUCCEEDED',
            'REJECTED',
            'SKIPPED',
            'FAILED',
            'UNKNOWN',
          ]),
          error: z.object({ code: z.string().max(100), message: z.string() }).nullable(),
          imageUrl: image.nullable(),
          scope: z.enum(['chapter', 'section']).optional(),
          sectionId: digest.optional(),
          parentChapterTitle: z.string().max(2000).optional(),
          visualPlan: visualPlan.optional(),
          visualReview: visualReview.optional(),
          placement: z
            .object({
              kind: z.literal('after-paragraph'),
              size: z.enum(['compact', 'medium', 'wide']),
              alignment: z.literal('center'),
            })
            .strict()
            .optional(),
        }),
      )
      .min(1)
      .max(501),
    counts: z.object({
      total: units,
      completed: units,
      succeeded: units,
      failed: units,
      skipped: units,
      unknown: units,
      rejected: units.optional(),
    }),
    budget: z.object({
      currency: z.literal('CNY'),
      maxCostMicros: units,
      upperBoundMicros: units,
      enforced: z.boolean().optional(),
    }),
    artifacts: z.object({
      epub: artifact.nullable(),
      report: artifact.nullable(),
      cover: z.null(),
    }),
    partial: z.boolean(),
    error: z.object({ code: z.string().max(100), message: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((batch, context) => {
    if (batch.bookArtPlan && batch.artDirection?.id !== 'book-art')
      context.addIssue({ code: 'custom', message: 'Invalid book art direction binding' })
    if (
      batch.imageReview?.enabled === false &&
      batch.chapters.some(
        (entry) =>
          entry.status === 'REVIEWING' ||
          entry.status === 'REJECTED' ||
          entry.visualReview !== undefined,
      )
    )
      context.addIssue({ code: 'custom', message: 'Review result conflicts with disabled review' })
    if (
      batch.counts.total !== batch.chapters.length ||
      batch.counts.completed > batch.counts.total ||
      new Set(batch.chapters.map((entry) => entry.id)).size !== batch.chapters.length ||
      Object.values(batch.counts).some((value) => (value ?? 0) > batch.counts.total) ||
      (batch.counts.rejected !== undefined &&
        batch.counts.rejected !==
          batch.chapters.filter((entry) => entry.status === 'REJECTED').length) ||
      (batch.budget.enforced !== false &&
        batch.budget.upperBoundMicros > batch.budget.maxCostMicros) ||
      batch.chapters.some(
        (entry) =>
          (entry.imageUrl !== null &&
            (entry.status !== 'SUCCEEDED' ||
              (entry.visualReview && entry.visualReview.status !== 'PASSED') ||
              entry.imageUrl !==
                `/api/v1/illustration-conversions/${batch.id}/chapters/${entry.id}/image`)) ||
          (entry.status === 'SUCCEEDED' &&
            entry.visualReview &&
            entry.visualReview.status !== 'PASSED') ||
          (entry.status === 'REJECTED' &&
            (!entry.visualReview || entry.visualReview.status === 'PASSED')),
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid conversion progress or artifact binding',
      })
    if (batch.status !== 'SUCCEEDED' && batch.artifacts.epub)
      context.addIssue({ code: 'custom', message: 'Unpublished conversion artifact' })
  })

export type ChapterCatalog = z.infer<typeof chapterCatalogSchema>
export type ConversionInput = z.infer<typeof conversionInputSchema>
export type IllustrationConversion = z.infer<typeof conversionSchema>
export type ConversionBinding = { bookId: string; input: ConversionInput }

function assertBinding(batch: IllustrationConversion, binding: ConversionBinding, id?: string) {
  if (
    (id !== undefined && batch.id !== id) ||
    batch.bookId !== binding.bookId ||
    batch.catalogId !== binding.input.catalogId ||
    batch.budget.maxCostMicros !== binding.input.maxCostMicros ||
    batch.chapters.length !== binding.input.chapterIds.length ||
    batch.chapters.some((entry) => !binding.input.chapterIds.includes(entry.id))
  )
    throw new ApiError('INVALID_RESPONSE', '转换任务与当前书籍或章节选择不匹配，请恢复查询。')
  return batch
}

export function getChapterCatalog(bookId: string, signal?: AbortSignal) {
  return apiRequest(
    { url: `/v1/books/${encodeURIComponent(bookId)}/chapters`, signal, withCredentials: true },
    chapterCatalogSchema,
  )
}
export async function createIllustrationConversion(
  binding: ConversionBinding,
  idempotencyKey: string,
) {
  const batch = await apiRequest(
    {
      method: 'POST',
      url: `/v1/books/${encodeURIComponent(binding.bookId)}/illustration-conversions`,
      data: conversionInputSchema.parse(binding.input),
      headers: { 'Idempotency-Key': idempotencyKey },
      withCredentials: true,
    },
    conversionSchema,
  )
  return assertBinding(batch, binding)
}
export async function getIllustrationConversion(
  id: string,
  binding: ConversionBinding,
  signal?: AbortSignal,
) {
  const batch = await apiRequest(
    {
      url: `/v1/illustration-conversions/${encodeURIComponent(id)}`,
      signal,
      withCredentials: true,
    },
    conversionSchema,
  )
  return assertBinding(batch, binding, id)
}
export async function lookupIllustrationConversion(
  binding: ConversionBinding,
  requestKey: string,
  signal?: AbortSignal,
) {
  const batch = await apiRequest(
    {
      url: `/v1/books/${encodeURIComponent(binding.bookId)}/illustration-conversions/lookup`,
      params: { requestKey },
      signal,
      withCredentials: true,
    },
    conversionSchema.nullable(),
  )
  return batch === null ? null : assertBinding(batch, binding)
}
export async function cancelIllustrationConversion(id: string, binding: ConversionBinding) {
  const batch = await apiRequest(
    {
      method: 'POST',
      url: `/v1/illustration-conversions/${encodeURIComponent(id)}/cancel`,
      withCredentials: true,
    },
    conversionSchema,
  )
  return assertBinding(batch, binding, id)
}
export function isTerminalConversion(batch: IllustrationConversion) {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(batch.status)
}
export function conversionErrorMessage(code: string) {
  const messages: Record<string, string> = {
    ILLUSTRATION_DISABLED: '插画转换服务尚未启用，仍可查看免费目录。',
    ILLUSTRATION_CONVERSION_DISABLED: '插画转换服务尚未启用，仍可查看免费目录。',
    CATALOG_STALE: '书籍目录已更新，请重新读取目录后选择章节。',
    ILLUSTRATION_CATALOG_CHANGED: '书籍目录已更新，请重新读取目录后选择章节。',
    ILLUSTRATION_BATCH_BUDGET_EXCEEDED: '所选章节超过本次预算，请减少章节。',
    INVALID_CHAPTER_SELECTION: '章节选择不可用，请重新选择目录中的可用章节。',
    INVALID_ILLUSTRATION_INPUT: '章节选择或预算不符合要求，请重新选择。',
    CONVERSION_SELECTION_INVALID: '章节选择与原书不一致，已停止转换。',
    CONVERSION_PRICING_CHANGED: '调用价格配置已变更，已停止转换，请保留当前任务。',
    ART_DIRECTION_INVALID: '艺术配置或最终提示未通过校验，已停止，尚未提交生图。',
    ART_DIRECTION_CONFLICT: '画面提示与统一艺术方向冲突，已停止，尚未提交生图。',
    CONVERSION_NO_IMAGES: '本次未生成可用插画，暂未发布整书下载，请查看逐章结果。',
    VISUAL_REVIEW_REJECTED: '图片质检未通过，未插入书中；请查看具体检查结果。',
    VISUAL_REVIEW_UNCERTAIN: '图片是否符合要求尚不确定，未插入书中；请查看具体检查结果。',
    VISUAL_REVIEW_INVALID: '图片质检结果未通过校验，已停止，未插入书中。',
    VISUAL_REVIEW_DISABLED: '图片质检服务尚未启用，已停止，未插入书中。',
    VISUAL_REVIEW_NOT_CONFIGURED: '图片质检服务尚未配置，已停止，未插入书中。',
    VISUAL_REVIEW_UNKNOWN_OUTCOME: '图片质检调用结果尚未确认，已停止重发，未插入书中。',
    VISUAL_REVIEW_TIMEOUT: '图片质检超时，结果尚未确认；图片未插入书中，不会自动重发。',
    VISUAL_REVIEW_UPSTREAM_ERROR: '图片质检连接异常，结果尚未确认；图片未插入书中，不会自动重发。',
    VISUAL_REVIEW_UPSTREAM_REJECTED:
      '图片质检服务返回错误响应，未取得有效结论；图片未插入书中，不会自动重发。',
    VISUAL_REVIEW_INVALID_RESPONSE: '图片质检返回内容未通过校验；图片未插入书中，不会自动重发。',
    VISUAL_REVIEW_TRUNCATED: '图片质检回复被截断，无法确认结论；图片未插入书中，不会自动重发。',
    NOT_LOGICAL_CHAPTER: '这是目录或附属内容，不是可独立配图的正文章节。',
    CHAPTER_TEXT_LIMIT: '这一章超过当前分析长度上限，暂时无法配图。',
    UNSUPPORTED_SPINE: '此目录项不属于可处理的正文阅读顺序。',
    UNSUPPORTED_CHAPTER_STRUCTURE: '这一章结构较复杂，暂不支持安全配图。',
    NO_SAFE_ILLUSTRATION_ANCHOR: '这部分没有可安全放入插画的段落边界。',
    SECTION_PARENT: '展开下方小节，选择需要配图的内容。',
    SECTION_SELECTION_REQUIRED: '请在下方选择需要配图的小节。',
    NOT_ILLUSTRATABLE_SECTION: '此目录项没有可单独配图的正文小节。',
    AMBIGUOUS_CHAPTER_NAVIGATION: '暂时无法可靠确认这一章的边界。',
    ILLUSTRATION_DECLINED: '这一章未找到有充分依据的画面，已跳过。',
    ILLUSTRATION_PLANNING_FAILED: '文字规划阶段未完成或返回异常，尚未提交生图。',
    ILLUSTRATION_PROMPT_LIMIT: '画面提示超出长度上限，已停止，尚未提交生图。',
    ILLUSTRATION_PEOPLE_CONFLICT: '画面人物要求相互矛盾，已停止，尚未提交生图。',
    ILLUSTRATION_INVALID_EVIDENCE: '分析返回的原文依据编号不匹配，已停止，尚未提交生图。',
    ILLUSTRATION_INVALID_ANCHOR: '分析选择的位置不属于当前小节，已停止，尚未提交生图。',
    ILLUSTRATION_PLACEMENT_MISMATCH: '插图位置与内容依据不一致，已停止，尚未提交生图。',
    ILLUSTRATION_PREFLIGHT_INVALID: '原书未通过配图前的格式检查，请修复 EPUB 后重新上传。',
    AI_UPSTREAM_REJECTED: '模型服务未接受本章分析，尚未提交生图。',
    AI_UNKNOWN_OUTCOME: '文字调用结果尚未确认，已停止重发。',
    IMAGE_UNKNOWN_OUTCOME: '生图结果尚未确认，已停止重发。',
    IMAGE_UPSTREAM_REJECTED: '生图服务返回错误响应，未取得可用图片；调用状态已保留，不会自动重发。',
    AI_RUN_BUDGET_EXCEEDED: '本章分析达到调用预算，已停止。',
    AI_DAILY_BUDGET_EXCEEDED: '今日文字调用达到预算，已停止。',
    IMAGE_OPERATION_BUDGET_EXCEEDED: '本章生图达到调用预算，已停止。',
    IMAGE_DAILY_BUDGET_EXCEEDED: '今日生图达到预算，已停止。',
    CONVERSION_BUDGET_EXCEEDED: '所选章节超过本次预算，请减少章节。',
    IDEMPOTENCY_CONFLICT: '已有转换提交，请恢复原任务查询。',
  }
  return messages[code] ?? publicErrorMessage(code)
}
export function formatCny(micros: number) {
  return `¥${(micros / 1_000_000).toFixed(2)}`
}
