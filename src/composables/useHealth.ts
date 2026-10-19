import { useQuery } from '@tanstack/vue-query'
import { getHealth } from '@/api/health'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 15_000,
    retry: false,
  })
}
