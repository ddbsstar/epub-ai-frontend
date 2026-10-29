import axios from 'axios'
import { z } from 'zod'

export const requestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\w.-]+$/u)

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({ requestId: requestIdSchema }),
})

const publicMessages: Record<string, string> = {
  VALIDATION_ERROR: '提交的内容不符合要求，请检查后重试。',
  BAD_REQUEST: '请求未能处理，请检查后重试。',
  NOT_FOUND: '请求的资源不存在。',
  RATE_LIMITED: '请求较频繁，请稍后重试。',
  PAYLOAD_TOO_LARGE: '提交的文件或内容过大。',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重试。',
  AI_NOT_CONFIGURED: 'AI 服务尚未配置。',
  AI_UPSTREAM_ERROR: 'AI 服务暂时异常，请稍后重试。',
  AI_TIMEOUT: 'AI 处理超时，请稍后重试。',
  INTERNAL_ERROR: '服务暂时异常，请稍后重试。',
  PROCESSING_DISABLED: '书籍处理服务尚未启用。',
  LOCAL_ACCESS_ONLY: '当前书籍处理仅支持本机访问。',
  INVALID_ORIGIN: '当前页面地址未获准使用书籍处理，请检查访问地址。',
  INVALID_UPLOAD: '请选择一本有效的 EPUB 文件。',
  INVALID_EPUB: '这份文件不是有效的 EPUB，请重新选择。',
  UPLOAD_TOO_LARGE: '文件超过服务器允许的大小，请选择较小的 EPUB。',
  OWNER_ACTIVE_LIMIT: '已有书籍正在整理，请稍后重试。',
  OWNER_BOOK_LIMIT: '试用期间最多保留五本书，请在文件到期清理后再试。',
  STORAGE_CAPACITY_EXCEEDED: '试用服务的存储空间暂时不足，请稍后再试。',
  PROCESSING_CAPACITY_EXCEEDED: '当前处理任务较多，请稍后重试。',
  BOOK_NOT_FOUND: '这本书已不可用，请重新上传。',
  RUN_NOT_FOUND: '这次整理任务已不可用，可放入另一本书。',
  ARTIFACT_NOT_FOUND: '这份下载文件已不可用，请重新处理。',
  IDEMPOTENCY_CONFLICT: '任务提交信息发生冲突，请重新选择书籍。',
  ENCRYPTED_EPUB: '暂不支持加密、DRM 或字体混淆的 EPUB。',
  FIXED_LAYOUT_EPUB: '暂不支持固定版式 EPUB，请选择可重排文字书籍。',
  ACTIVE_CONTENT: '暂不支持含脚本或交互内容的 EPUB。',
  REMOTE_RESOURCE: '这本书引用了外部资源，暂时只能处理资源完整保存在书内的 EPUB。',
  UNSUPPORTED_ENCODING: '暂时只能处理 UTF-8 编码的 EPUB。',
  UNSUPPORTED_EPUB_VERSION: '暂时只能处理 EPUB 2 或 EPUB 3。',
  ARCHIVE_LIMIT: '书籍展开后的内容超过处理上限，请选择较小的 EPUB。',
  DOCUMENT_SIZE_LIMIT: '书籍中有章节超过处理上限，暂时无法整理。',
  INVALID_ARCHIVE: '无法读取这份 EPUB，请检查文件是否完整。',
  INVALID_EPUB_STRUCTURE: '这本书的结构不完整或存在歧义，暂时无法整理。',
  INVALID_XML: '这本书含无法读取的章节结构，暂时无法整理。',
  INVALID_CSS: '这本书含无法读取的样式，暂时无法整理。',
  BROKEN_REFERENCE: '这本书存在失效的书内目录或链接，暂未生成下载文件。',
  MISSING_RESOURCE: '书内资源引用失效，可能缺少文件或残留无效模板引用。请重新上传有效的 EPUB。',
  VALIDATION_FAILED: '处理结果没有通过完整性或格式检查，暂未生成下载文件。',
  INTEGRITY_FAILURE: '处理结果没有通过内容完整性检查，暂未生成下载文件。',
  EPUBCHECK_TIMEOUT: '文件格式检查超时，暂未生成下载文件。',
  EPUBCHECK_UNAVAILABLE: '文件格式检查服务暂不可用，请稍后重试。',
}

export function publicErrorMessage(code: string): string {
  return publicMessages[code] ?? '请求失败，请稍后重试。'
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number | undefined
  readonly requestId: string | undefined

  constructor(code: string, message: string, status?: number, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('CANCELLED', '请求已取消。')
  if (!axios.isAxiosError<unknown>(error))
    return new ApiError('UNKNOWN_ERROR', '请求失败，请稍后重试。')
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    return new ApiError('TIMEOUT', '请求超时，请稍后重试。')
  if (!error.response)
    return new ApiError('NETWORK_ERROR', '暂时无法连接服务，请检查网络或服务状态。')

  const parsed = errorEnvelopeSchema.safeParse(error.response.data)
  const headerId = requestIdSchema.safeParse(error.response.headers['x-request-id'])
  const requestId = parsed.success
    ? parsed.data.meta.requestId
    : headerId.success
      ? headerId.data
      : undefined
  const code = parsed.success ? parsed.data.error.code : `HTTP_${error.response.status}`
  // Only local, reviewed messages reach the UI; upstream messages may contain internal details.
  return new ApiError(code, publicErrorMessage(code), error.response.status, requestId)
}
