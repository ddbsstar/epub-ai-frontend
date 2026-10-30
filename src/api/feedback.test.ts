import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'
import { getCapabilities, submitFeedback, type FeedbackInput } from './feedback'

const mock = new MockAdapter(apiClient)
const key = '45b3b0a9-777f-4354-9bb0-cc2f24963714'
const input: FeedbackInput = { category: 'typography', reader: 'kindle', deliveryRoute: 'usb' }
const receipt = {
  receiptId: '061b66c8-a87d-4700-8092-3811f7d97f5b',
  expiresAt: '2026-10-31T00:00:00.000Z',
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'feedback-protocol' } })
afterEach(() => mock.reset())

describe('private feedback protocol', () => {
  it('treats a legacy capability without feedback as unavailable and rejects non-boolean availability', async () => {
    mock
      .onGet('/v1/capabilities')
      .replyOnce(200, envelope({ uploadMaxMiB: 20, retentionHours: 24 }))
    await expect(getCapabilities()).resolves.toMatchObject({ feedbackAvailable: false })
    mock.onGet('/v1/capabilities').replyOnce(200, envelope({ feedbackAvailable: 'true' }))
    await expect(getCapabilities()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(mock.history.post).toHaveLength(0)
  })

  it('sends only the explicitly supplied fields and an opaque idempotency header', async () => {
    mock.onPost('/v1/feedback').reply((config) => {
      expect(JSON.parse(config.data)).toEqual(input)
      expect(config.headers?.['Idempotency-Key']).toBe(key)
      expect(config.withCredentials).toBe(true)
      expect(config.params).toBeUndefined()
      return [201, envelope(receipt)]
    })
    await expect(submitFeedback(input, key)).resolves.toEqual(receipt)
    expect(mock.history.post).toHaveLength(1)
  })

  it('rejects extra private fields and oversized descriptions before sending a request', () => {
    expect(() =>
      submitFeedback({ ...input, filename: 'private.epub' } as FeedbackInput, key),
    ).toThrow()
    expect(() => submitFeedback({ ...input, description: 'x'.repeat(1001) }, key)).toThrow()
    expect(() =>
      submitFeedback({ ...input, requestId: 'https://private.example/book' }, key),
    ).toThrow()
    expect(() => submitFeedback(input, 'invalid-submission-id')).toThrow()
    expect(mock.history.post).toHaveLength(0)
  })

  it('rejects an invalid receipt and suppresses raw server feedback failures', async () => {
    mock
      .onPost('/v1/feedback')
      .replyOnce(201, envelope({ receiptId: receipt.receiptId, expiresAt: 'tomorrow' }))
    await expect(submitFeedback(input, key)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    mock.onPost('/v1/feedback').replyOnce(503, {
      error: { code: 'FEEDBACK_UNAVAILABLE', message: 'private record /private/feedback.json' },
      meta: { requestId: 'failed-feedback' },
    })
    await expect(submitFeedback(input, key)).rejects.toMatchObject({
      code: 'FEEDBACK_UNAVAILABLE',
      message:
        'Feedback storage is temporarily unavailable. Check this submission before trying again.',
    })
  })
})
