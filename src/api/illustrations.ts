import { z } from 'zod'
import { apiRequest } from './client'
import { ApiError } from './errors'

const identifier = z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u)
const artifactPath = z.string().regex(/^\/api\/v1\/artifacts\/[a-zA-Z0-9-]+\/download$/u)
const boundedText = (maximum: number) =>
  z.string().refine((value) => Array.from(value).length <= maximum)

export const illustrationViewSchema = z
  .object({
    id: identifier,
    bookId: identifier,
    kind: z.enum(['plan', 'export']),
    planId: identifier.nullable(),
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
    stage: z.string().max(100),
    chapterIndex: z.number().int().min(0).max(500),
    chapterTitle: boundedText(1000).nullable(),
    concept: boundedText(4000).nullable(),
    prompt: boundedText(800).nullable(),
    alt: boundedText(500).nullable(),
    artifacts: z.object({
      image: artifactPath.nullable(),
      epub: artifactPath.nullable(),
      report: artifactPath.nullable(),
    }),
    error: z.object({ code: z.string().max(100), message: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    // A plan may expose its canonical child for recovery after a lost POST response.
    exportId: identifier.nullable(),
  })
  .superRefine((view, context) => {
    if (
      (view.kind === 'plan' && view.planId !== null) ||
      (view.kind === 'export' && (!view.planId || view.exportId !== view.id))
    )
      context.addIssue({ code: 'custom', message: 'Invalid illustration lineage' })
    if (
      view.status === 'SUCCEEDED' &&
      view.kind === 'plan' &&
      (!view.concept?.trim() || !view.prompt?.trim() || !view.alt?.trim())
    )
      context.addIssue({ code: 'custom', message: 'Missing completed plan' })
    if (
      view.status === 'SUCCEEDED' &&
      view.kind === 'export' &&
      (!view.artifacts.image || !view.artifacts.epub || !view.artifacts.report)
    )
      context.addIssue({ code: 'custom', message: 'Missing completed illustration artifacts' })
  })

export type IllustrationView = z.infer<typeof illustrationViewSchema>

export function isTerminalIllustration(view: IllustrationView): boolean {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(view.status)
}

function assertBinding(
  view: IllustrationView,
  expected: { bookId: string; kind: 'plan' | 'export'; planId?: string },
): IllustrationView {
  if (
    view.bookId !== expected.bookId ||
    view.kind !== expected.kind ||
    (expected.planId !== undefined && view.planId !== expected.planId)
  )
    throw new ApiError('INVALID_RESPONSE', '插画任务与当前书籍不匹配，请恢复查询。')
  return view
}

export async function createIllustrationPlan(bookId: string, chapterIndex: number) {
  const view = await apiRequest(
    {
      method: 'POST',
      url: `/v1/books/${encodeURIComponent(bookId)}/illustrations/plan`,
      data: { chapterIndex },
      headers: { 'Idempotency-Key': `illustration-plan-v1-${bookId}-${chapterIndex}` },
      withCredentials: true,
    },
    illustrationViewSchema,
  )
  if (view.chapterIndex !== chapterIndex)
    throw new ApiError('INVALID_RESPONSE', '插画章节与提交内容不匹配，请恢复查询。')
  return assertBinding(view, { bookId, kind: 'plan' })
}

export async function getIllustration(
  id: string,
  expected: { bookId: string; kind: 'plan' | 'export'; planId?: string },
  signal?: AbortSignal,
) {
  const view = await apiRequest(
    { url: `/v1/illustrations/${encodeURIComponent(id)}`, signal, withCredentials: true },
    illustrationViewSchema,
  )
  if (view.id !== id) throw new ApiError('INVALID_RESPONSE', '插画任务编号不匹配，请恢复查询。')
  return assertBinding(view, expected)
}

export async function generateIllustratedBook(
  bookId: string,
  planId: string,
  input: { prompt: string; alt: string },
) {
  const view = await apiRequest(
    {
      method: 'POST',
      url: `/v1/illustrations/${encodeURIComponent(planId)}/generate`,
      data: input,
      headers: { 'Idempotency-Key': `illustration-export-v1-${planId}` },
      withCredentials: true,
    },
    illustrationViewSchema,
  )
  return assertBinding(view, { bookId, kind: 'export', planId })
}

export function illustrationErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    ILLUSTRATION_DISABLED: '章节插画尚未启用，请稍后再试。',
    ILLUSTRATION_PLAN_NOT_READY: '插画方案尚未完成，请等待规划结束。',
    ILLUSTRATION_REVIEW_CONFLICT: '画面描述与原方案不匹配，暂未提交生图。',
    ILLUSTRATION_DECLINED: '这一章暂未找到有充分依据的安全画面，可选择其他章节。',
    ILLUSTRATION_PLANNING_FAILED: '插画规划未能完成，暂未提交生图。',
    INVALID_CHAPTER_INDEX: '没有找到这一章，请检查章节序号。',
    UNSUPPORTED_CHAPTER_STRUCTURE: '这一章的结构暂不支持安全配图。',
    AMBIGUOUS_CHAPTER_NAVIGATION: '这本书的章界暂时无法可靠确认。',
    NO_SAFE_ILLUSTRATION_ANCHOR: '这一章没有可安全放入插画的章末位置。',
    AI_UNKNOWN_OUTCOME: '模型结果尚未确认，已停止继续调用，请保留当前任务。',
    AI_UPSTREAM_REJECTED: '模型服务未接受本章分析，已停止处理，尚未提交生图。',
    IMAGE_UNKNOWN_OUTCOME: '图片结果尚未确认，已停止继续调用，请保留当前任务。',
    AI_RUN_BUDGET_EXCEEDED: '本次插画规划达到调用预算，已停止处理。',
    AI_DAILY_BUDGET_EXCEEDED: '今日文字调用达到预算，已停止处理。',
    IMAGE_OPERATION_BUDGET_EXCEEDED: '本次图片调用达到预算，已停止处理。',
    IMAGE_DAILY_BUDGET_EXCEEDED: '今日图片调用达到预算，已停止处理。',
    IDEMPOTENCY_CONFLICT: '同一任务已有不同的提交内容，请恢复原任务查询。',
  }
  return messages[code] ?? '插画任务暂未完成，请保留任务并稍后恢复查询。'
}
