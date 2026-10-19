import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './public-env'

describe('public configuration', () => {
  it('defaults to the same-origin API and accepts an explicit HTTPS endpoint', () => {
    expect(parsePublicEnv({}).apiBaseUrl).toBe('/api')
    expect(parsePublicEnv({ VITE_API_BASE_URL: 'https://api.example.com/v1/' }).apiBaseUrl).toBe(
      'https://api.example.com/v1',
    )
  })

  it.each([
    '//untrusted.example.com',
    'https://user:pass@example.com/api',
    'javascript:alert(1)',
    'http://public.example.com/api',
    '/api?token=secret',
    '/api\\other',
  ])('rejects unsafe or ambiguous API base %s', (value) => {
    expect(() => parsePublicEnv({ VITE_API_BASE_URL: value })).toThrow()
  })
})
