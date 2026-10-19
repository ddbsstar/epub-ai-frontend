import { QueryClient } from '@tanstack/vue-query'
import { ApiError } from '@/api/errors'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          error instanceof ApiError &&
          ['NETWORK_ERROR', 'TIMEOUT'].includes(error.code) &&
          failureCount < 1,
      },
      mutations: { retry: false },
    },
  })
}
