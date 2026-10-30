import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'
import {
  cancelEpubRun,
  createEpubExport,
  epubRunSchema,
  getEpubRun,
  MAX_EPUB_BYTES,
  uploadEpub,
  validateEpubFile,
} from './epub'

const mock = new MockAdapter(apiClient)
export const runFixture = {
  id: 'run-123',
  bookId: 'book-123',
  status: 'RUNNING',
  stage: 'process',
  completedUnits: 2,
  totalUnits: 10,
  originalName: '示例.epub',
  title: '示例',
  artifacts: { epub: null, report: null, cover: null },
  summary: null,
  warnings: [],
  error: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}
afterEach(() => mock.reset())

describe('EPUB protocol', () => {
  it('validates legacy editorial coverage without counting headings or hr separators as paragraphs', () => {
    const typography = {
      profile: 'editorial-1',
      totalParagraphs: 12,
      styledParagraphs: 9,
      preservedParagraphs: 3,
      styledHeadings: 4,
      roleCounts: { body: 4, opening: 1, quote: 1, poem: 1, caption: 1, note: 1, separator: 5 },
    }
    const summary = {
      chapters: 4,
      styledChapters: 3,
      preservedChapters: 1,
      bodyBytesPreserved: true,
      formatErrors: 0,
      formatWarnings: 0,
      typography,
    }
    expect(epubRunSchema.parse({ ...runFixture, summary }).summary?.typography).toEqual(typography)
    for (const invalid of [
      { ...typography, profile: 'unknown' },
      { ...typography, totalParagraphs: 11 },
      { ...typography, preservedParagraphs: -1 },
      { ...typography, roleCounts: { ...typography.roleCounts, body: 3 } },
      { ...typography, roleCounts: { ...typography.roleCounts, separator: -1 } },
    ])
      expect(
        epubRunSchema.safeParse({ ...runFixture, summary: { ...summary, typography: invalid } })
          .success,
      ).toBe(false)
    const legacySummary = Object.fromEntries(
      Object.entries(summary).filter(([key]) => key !== 'typography'),
    )
    expect(epubRunSchema.safeParse({ ...runFixture, summary: legacySummary }).success).toBe(true)
  })

  it('accepts paragraph separators in exact coverage while excluding hr separators from paragraph counts', async () => {
    const typography = {
      profile: 'editorial-1',
      totalParagraphs: 640,
      styledParagraphs: 635,
      preservedParagraphs: 5,
      styledHeadings: 12,
      styledSeparatorParagraphs: 3,
      roleCounts: { body: 608, opening: 11, quote: 0, poem: 13, caption: 0, note: 0, separator: 5 },
    }
    const summary = {
      chapters: 4,
      styledChapters: 3,
      preservedChapters: 1,
      bodyBytesPreserved: true,
      formatErrors: 0,
      formatWarnings: 0,
      typography,
    }
    mock
      .onGet('/v1/runs/run-123')
      .reply(200, { data: { ...runFixture, summary }, meta: { requestId: 'separator-counts' } })
    await expect(getEpubRun('run-123')).resolves.toMatchObject({ summary: { typography } })
    for (const invalid of [
      { ...typography, styledSeparatorParagraphs: 2 },
      { ...typography, styledSeparatorParagraphs: 6 },
      { ...typography, styledSeparatorParagraphs: -1 },
      { ...typography, styledSeparatorParagraphs: 1.5 },
      { ...typography, styledSeparatorParagraphs: undefined },
      { ...typography, styledParagraphs: 637, preservedParagraphs: 3 },
      { ...typography, roleCounts: { ...typography.roleCounts, separator: 2 } },
    ])
      expect(
        epubRunSchema.safeParse({ ...runFixture, summary: { ...summary, typography: invalid } })
          .success,
      ).toBe(false)

    const noParagraphSeparators = {
      ...typography,
      styledParagraphs: 632,
      preservedParagraphs: 8,
      styledSeparatorParagraphs: 0,
    }
    expect(
      epubRunSchema.safeParse({
        ...runFixture,
        summary: { ...summary, typography: noParagraphSeparators },
      }).success,
    ).toBe(true)
    const legacyHrOnly = Object.fromEntries(
      Object.entries(noParagraphSeparators).filter(([key]) => key !== 'styledSeparatorParagraphs'),
    )
    expect(
      epubRunSchema.safeParse({ ...runFixture, summary: { ...summary, typography: legacyHrOnly } })
        .success,
    ).toBe(true)
  })

  it('uses an explicit editorial theme while retaining the legacy default and idempotency binding', async () => {
    mock
      .onPost('/v1/books/book-123/exports')
      .reply(202, { data: runFixture, meta: { requestId: 'export-1' } })
    await createEpubExport('book-123', 'first-key', 'reader-editorial')
    await createEpubExport('book-123', 'legacy-key')
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({ theme: 'reader-editorial' })
    expect(mock.history.post[0]!.headers?.['Idempotency-Key']).toBe('first-key')
    expect(mock.history.post[0]!.withCredentials).toBe(true)
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({ theme: 'reader-first' })
  })

  it('rejects responses bound to another book or run without accepting their artifacts', async () => {
    mock
      .onPost('/v1/books/another-book/exports')
      .reply(202, { data: runFixture, meta: { requestId: 'export-wrong' } })
    await expect(
      createEpubExport('another-book', 'same-key', 'reader-editorial'),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    mock
      .onGet('/v1/runs/another-run')
      .reply(200, { data: runFixture, meta: { requestId: 'get-wrong' } })
    await expect(getEpubRun('another-run')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    mock
      .onPost('/v1/runs/another-run/cancel')
      .reply(200, { data: runFixture, meta: { requestId: 'cancel-wrong' } })
    await expect(cancelEpubRun('another-run')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('accepts explicit AI state and keeps old task payloads compatible', () => {
    expect(epubRunSchema.safeParse(runFixture).success).toBe(true)
    const ai = {
      status: 'APPLIED',
      model: 'qwen-flash',
      reasonCode: null,
      sampledBlocks: 12,
      appliedBlocks: 8,
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      estimatedCostMicros: 55,
      currency: 'CNY',
    }
    expect(epubRunSchema.parse({ ...runFixture, ai }).ai).toEqual(ai)
    expect(
      epubRunSchema.safeParse({ ...runFixture, ai: { ...ai, status: 'MAYBE_USED' } }).success,
    ).toBe(false)
    expect(
      epubRunSchema.safeParse({ ...runFixture, ai: { ...ai, appliedBlocks: 13 } }).success,
    ).toBe(false)
    expect(
      epubRunSchema.safeParse({ ...runFixture, ai: { ...ai, estimatedCostMicros: -1 } }).success,
    ).toBe(false)
    expect(
      epubRunSchema.safeParse({
        ...runFixture,
        ai: { ...ai, usage: { inputTokens: -1, outputTokens: 40, totalTokens: 39 } },
      }).success,
    ).toBe(false)
  })

  it('posts the file as multipart with the upload timeout and cookie credentials', async () => {
    const file = new File(['sample'], '示例.epub', { type: 'application/epub+zip' })
    mock.onPost('/v1/uploads').reply((config) => {
      expect(config.timeout).toBe(120_000)
      expect(config.withCredentials).toBe(true)
      expect((config.data as FormData).get('file')).toBe(file)
      return [
        201,
        {
          data: {
            id: 'upload-1',
            bookId: 'book-1',
            originalName: file.name,
            byteSize: file.size,
            sha256: 'a'.repeat(64),
          },
          meta: { requestId: 'upload-1' },
        },
      ]
    })
    await expect(uploadEpub(file)).resolves.toMatchObject({ bookId: 'book-1', byteSize: 6 })
  })

  it('rejects untrusted artifact URLs and inconsistent stage counts', async () => {
    expect(
      epubRunSchema.safeParse({
        ...runFixture,
        artifacts: { ...runFixture.artifacts, cover: 'https://example.com/book.jpg' },
      }).success,
    ).toBe(false)
    expect(epubRunSchema.safeParse({ ...runFixture, completedUnits: 11 }).success).toBe(false)
    mock
      .onGet('/v1/runs/run-123')
      .reply(200, { data: { ...runFixture, status: 'COMPLETE' }, meta: { requestId: 'run-check' } })
    await expect(getEpubRun('run-123')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('rejects empty, wrong-format and oversized files before uploading', () => {
    expect(validateEpubFile(new File([], 'empty.epub'))).toContain('empty')
    expect(validateEpubFile(new File(['x'], 'book.zip'))).toContain('EPUB')
    const large = new File(['x'], 'large.epub')
    Object.defineProperty(large, 'size', { value: MAX_EPUB_BYTES + 1 })
    expect(validateEpubFile(large)).toContain('100 MiB')
    expect(validateEpubFile(new File(['x'], 'BOOK.EPUB'))).toBeNull()
  })

  it('rejects a beta-oversized book before upload without reducing the legacy limit', () => {
    const file = new File(['x'], 'book.epub')
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 })
    expect(validateEpubFile(file, 20 * 1024 * 1024)).toContain('20 MiB')
    expect(validateEpubFile(file)).toBeNull()
    expect(mock.history.post).toHaveLength(0)
  })
})
