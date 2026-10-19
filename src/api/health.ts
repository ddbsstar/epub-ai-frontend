import { z } from 'zod'
import { apiRequest } from './client'

export const dependencyStateSchema = z.enum([
  'disabled',
  'not_configured',
  'configured_not_checked',
  'connected',
  'unavailable',
])
export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('epub-ai-backend'),
  dependencies: z.object({
    database: dependencyStateSchema,
    qwen: dependencyStateSchema,
    queue: dependencyStateSchema.optional(),
  }),
})
export type Health = z.infer<typeof healthSchema>
export type DependencyState = z.infer<typeof dependencyStateSchema>

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return apiRequest(
    { url: '/health', method: 'GET', signal, headers: { 'Cache-Control': 'no-cache' } },
    healthSchema,
  )
}
