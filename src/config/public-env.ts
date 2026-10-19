import { z } from 'zod'

function isApiBaseUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return !/[?#\\\s]/u.test(value)
  }
  try {
    const url = new URL(value)
    const localHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    return (
      (url.protocol === 'https:' || localHttp) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

const publicEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(isApiBaseUrl, '应为同源路径或不含凭据的 HTTPS API 地址')
    .default('/api'),
})

export function parsePublicEnv(env: Record<string, unknown>) {
  const parsed = publicEnvSchema.parse(env)
  return { apiBaseUrl: parsed.VITE_API_BASE_URL.replace(/\/$/u, '') || '/' }
}
