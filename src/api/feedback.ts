import { z } from 'zod'
import { apiRequest } from './client'
import { requestIdSchema } from './errors'

const positiveHours = z.number().int().positive()
export const capabilitiesSchema = z.object({
  typographyOnly: z.boolean().optional(),
  uploadMaxMiB: z.number().int().positive().optional(),
  retentionHours: positiveHours.nullable().optional(),
  feedbackAvailable: z.boolean().optional().default(false),
  feedbackRetentionHours: positiveHours.nullable().optional(),
})
export const feedbackInputSchema = z
  .object({
    category: z.enum(['typography', 'processing', 'download', 'other']),
    reader: z.enum(['kindle', 'apple-books', 'kobo', 'calibre', 'other', 'not-tested']),
    deliveryRoute: z.enum(['send-to-kindle', 'usb', 'reader-import', 'not-tested', 'other']),
    rating: z.enum(['better', 'same', 'worse']).optional(),
    requestId: requestIdSchema.optional(),
    description: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
export const feedbackReceiptSchema = z.object({
  receiptId: z.uuid(),
  expiresAt: z.iso.datetime(),
})
export type FeedbackInput = z.infer<typeof feedbackInputSchema>
export type FeedbackReceipt = z.infer<typeof feedbackReceiptSchema>

export function getCapabilities(signal?: AbortSignal) {
  return apiRequest({ url: '/v1/capabilities', signal, withCredentials: true }, capabilitiesSchema)
}

export function submitFeedback(input: FeedbackInput, idempotencyKey: string) {
  return apiRequest(
    {
      url: '/v1/feedback',
      method: 'POST',
      data: feedbackInputSchema.parse(input),
      headers: { 'Idempotency-Key': z.uuid().parse(idempotencyKey) },
      withCredentials: true,
    },
    feedbackReceiptSchema,
  )
}
