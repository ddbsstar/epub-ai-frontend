import { genericErrorMessage, publicErrorMessages } from '@/content/en'
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

export function publicErrorMessage(code: string): string {
  return Object.hasOwn(publicErrorMessages, code) ? publicErrorMessages[code]! : genericErrorMessage
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
  if (axios.isCancel(error)) return new ApiError('CANCELLED', publicErrorMessage('CANCELLED'))
  if (!axios.isAxiosError<unknown>(error))
    return new ApiError('UNKNOWN_ERROR', publicErrorMessage('UNKNOWN_ERROR'))
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    return new ApiError('TIMEOUT', publicErrorMessage('TIMEOUT'))
  if (!error.response) return new ApiError('NETWORK_ERROR', publicErrorMessage('NETWORK_ERROR'))

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
