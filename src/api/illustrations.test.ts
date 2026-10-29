import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'
import {
  createIllustrationPlan,
  generateIllustratedBook,
  getIllustration,
  illustrationViewSchema,
} from './illustrations'

const mock = new MockAdapter(apiClient)
const plan = {
  id: 'plan-123',
  bookId: 'book-123',
  kind: 'plan',
  planId: null,
  exportId: null,
  status: 'QUEUED',
  stage: 'queued',
  chapterIndex: 0,
  chapterTitle: null,
  concept: null,
  prompt: null,
  alt: null,
  artifacts: { image: null, epub: null, report: null },
  error: null,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'illustration-test' } })
afterEach(() => mock.reset())

describe('private chapter illustration protocol', () => {
  it('uses stable plan/generation keys, cookie credentials and only requested payload fields', async () => {
    mock.onPost('/v1/books/book-123/illustrations/plan').reply(202, envelope(plan))
    const exported = {
      ...plan,
      id: 'export-123',
      kind: 'export',
      planId: 'plan-123',
      exportId: 'export-123',
    }
    mock.onPost('/v1/illustrations/plan-123/generate').reply(202, envelope(exported))
    await createIllustrationPlan('book-123', 0)
    await createIllustrationPlan('book-123', 0)
    await generateIllustratedBook('book-123', 'plan-123', { prompt: '雪山与鸟', alt: '雪山' })
    expect(mock.history.post[0]!.data).toBe(JSON.stringify({ chapterIndex: 0 }))
    expect(mock.history.post[0]!.headers?.['Idempotency-Key']).toBe(
      mock.history.post[1]!.headers?.['Idempotency-Key'],
    )
    expect(mock.history.post[2]!.headers?.['Idempotency-Key']).toBe(
      'illustration-export-v1-plan-123',
    )
    expect(JSON.parse(mock.history.post[2]!.data as string)).toEqual({
      prompt: '雪山与鸟',
      alt: '雪山',
    })
    expect(mock.history.post.every((request) => request.withCredentials === true)).toBe(true)
  })

  it('rejects external image URLs, missing successful artifacts and mismatched lineage', async () => {
    const exported = {
      ...plan,
      id: 'export-123',
      kind: 'export',
      planId: 'plan-123',
      exportId: 'export-123',
      status: 'SUCCEEDED',
      artifacts: {
        image: '/api/v1/artifacts/image-1/download',
        epub: '/api/v1/artifacts/epub-1/download',
        report: '/api/v1/artifacts/report-1/download',
      },
    }
    expect(illustrationViewSchema.safeParse(exported).success).toBe(true)
    expect(
      illustrationViewSchema.safeParse({
        ...exported,
        artifacts: { ...exported.artifacts, image: 'https://example.com/image.png' },
      }).success,
    ).toBe(false)
    expect(
      illustrationViewSchema.safeParse({
        ...exported,
        artifacts: { ...exported.artifacts, epub: null },
      }).success,
    ).toBe(false)
    expect(illustrationViewSchema.safeParse({ ...exported, planId: null }).success).toBe(false)
    mock.onGet('/v1/illustrations/plan-123').reply(200, envelope({ ...plan, bookId: 'other-book' }))
    await expect(
      getIllustration('plan-123', { bookId: 'book-123', kind: 'plan' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
