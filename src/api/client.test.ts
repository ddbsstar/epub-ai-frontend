import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { apiRequest, createApiClient } from './client'

const client = createApiClient('/api')
const mock = new MockAdapter(client)
const payloadSchema = z.object({ name: z.string() })
const request = (signal?: AbortSignal) =>
  apiRequest({ url: '/example', signal }, payloadSchema, client)

afterEach(() => mock.reset())

describe('API protocol boundary', () => {
  it('extracts a validated success payload and attaches a request identifier', async () => {
    mock.onGet('/example').reply((config) => {
      expect(config.headers?.['X-Request-Id']).toMatch(/^[\w-]+$/u)
      return [200, { data: { name: '一本书' }, meta: { requestId: 'server-123' } }]
    })
    await expect(request()).resolves.toEqual({ name: '一本书' })
  })

  it('rejects HTTP 200 responses with an invalid envelope or payload', async () => {
    mock.onGet('/example').reply(200, { data: { name: 42 }, meta: { requestId: 'server-123' } })
    await expect(request()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 })
  })

  it('normalizes server errors without exposing the upstream message or details', async () => {
    mock.onGet('/example').reply(500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'secret database stack at /internal/server.ts',
        details: { password: 'do-not-render' },
      },
      meta: { requestId: 'trace-456' },
    })
    await expect(request()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId: 'trace-456',
      message: 'The service is temporarily unavailable. Try again later.',
    })
  })

  it('handles non-JSON gateway errors and keeps a valid response request identifier', async () => {
    mock
      .onGet('/example')
      .reply(502, '<html>internal proxy details</html>', { 'x-request-id': 'gateway-789' })
    await expect(request()).rejects.toMatchObject({
      code: 'HTTP_502',
      requestId: 'gateway-789',
      message: 'The request failed. Try again later.',
    })
  })

  it('distinguishes network failures from timeouts', async () => {
    mock.onGet('/example').networkErrorOnce()
    await expect(request()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    mock.onGet('/example').timeoutOnce()
    await expect(request()).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('supports AbortSignal cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(request(controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(mock.history.get).toHaveLength(0)
  })
})
