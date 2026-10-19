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
  return new ApiError(
    code,
    publicMessages[code] ?? '请求失败，请稍后重试。',
    error.response.status,
    requestId,
  )
}
