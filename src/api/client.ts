import { copy } from '@/content/en'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { z } from 'zod'
import { publicEnv } from '@/config/env'
import { ApiError, normalizeApiError, requestIdSchema } from './errors'

export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10_000,
    withCredentials: false,
    headers: { Accept: 'application/json' },
  })
  client.interceptors.request.use((config) => {
    config.headers.set('X-Request-Id', crypto.randomUUID())
    return config
  })
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(normalizeApiError(error)),
  )
  return client
}

export const apiClient = createApiClient(publicEnv.apiBaseUrl)

export async function apiRequest<T>(
  config: AxiosRequestConfig,
  schema: z.ZodType<T>,
  client = apiClient,
): Promise<T> {
  const response = await client.request<unknown>(config)
  const envelope = z
    .object({ data: schema, meta: z.object({ requestId: requestIdSchema }) })
    .safeParse(response.data)
  if (!envelope.success) {
    const requestId = requestIdSchema.safeParse(response.headers['x-request-id'])
    throw new ApiError(
      'INVALID_RESPONSE',
      copy.invalidResponse,
      response.status,
      requestId.success ? requestId.data : undefined,
    )
  }
  return envelope.data.data
}
