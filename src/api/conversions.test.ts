import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'
import {
  chapterCatalogSchema,
  conversionInputSchema,
  conversionSchema,
  getIllustrationConversion,
  lookupIllustrationConversion,
} from './conversions'

const mock = new MockAdapter(apiClient)
const id = 'a'.repeat(64)
const input = { catalogId: 'b'.repeat(64), chapterIds: [id], maxCostMicros: 150000 }
const run = {
  id: 'run-1',
  bookId: 'book-1',
  catalogId: input.catalogId,
  status: 'SUCCEEDED',
  stage: 'publish',
  originalName: 'sample.epub',
  title: null,
  chapters: [
    {
      id,
      index: 0,
      title: 'Chapter one',
      status: 'SUCCEEDED',
      error: null,
      imageUrl: `/api/v1/illustration-conversions/run-1/chapters/${id}/image`,
    },
  ],
  counts: { total: 1, completed: 1, succeeded: 1, failed: 0, skipped: 0, unknown: 0 },
  budget: { currency: 'CNY', maxCostMicros: 150000, upperBoundMicros: 150000 },
  artifacts: { epub: '/api/v1/artifacts/export-1/download', report: null, cover: null },
  partial: false,
  error: null,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'test-1' } })
afterEach(() => mock.reset())

describe('chapter conversion protocol', () => {
  it('binds disabled image review to its run without inventing approval or accepting review states', () => {
    const imageReview = {
      enabled: false,
      description: '本次转换不做生成后的 AI 视觉复核，生成成功后按方案插入。',
    }
    const direct = { ...run, imageReview }
    expect(conversionSchema.parse(direct).imageReview).toEqual(imageReview)
    expect(conversionSchema.parse(direct).chapters[0]!.visualReview).toBeUndefined()
    expect(conversionSchema.parse(run).imageReview).toBeUndefined()
    for (const status of ['REVIEWING', 'REJECTED'])
      expect(
        conversionSchema.safeParse({
          ...direct,
          chapters: [{ ...run.chapters[0], status, imageUrl: null }],
        }).success,
      ).toBe(false)
    const review = {
      status: 'PASSED',
      summary: '自动检查通过。',
      checks: ['source', 'people', 'style', 'composition', 'artifacts'].map((aspect) => ({
        aspect,
        result: 'PASS',
        reason: '自动检查结论。',
      })),
    }
    expect(
      conversionSchema.safeParse({
        ...direct,
        chapters: [{ ...run.chapters[0], visualReview: review }],
      }).success,
    ).toBe(false)
    expect(
      conversionSchema.safeParse({ ...direct, imageReview: { ...imageReview, approved: true } })
        .success,
    ).toBe(false)
    expect(
      conversionSchema.parse({
        ...run,
        imageReview: { ...imageReview, enabled: true },
        chapters: [{ ...run.chapters[0], visualReview: review }],
      }).chapters[0]!.visualReview,
    ).toEqual(review)
  })
  it('validates five distinct review checks and consistent decisions without upgrading legacy images', () => {
    const review = {
      status: 'PASSED',
      summary: '画面与方案一致。',
      checks: ['source', 'people', 'style', 'composition', 'artifacts'].map((aspect) => ({
        aspect,
        result: 'PASS',
        reason: '未发现明显偏差。',
      })),
    }
    const reviewed = { ...run, chapters: [{ ...run.chapters[0], visualReview: review }] }
    expect(conversionSchema.parse(reviewed).chapters[0]!.visualReview).toEqual(review)
    expect(conversionSchema.parse(run).chapters[0]!.visualReview).toBeUndefined()
    for (const invalidReview of [
      { ...review, status: 'REJECTED' },
      { ...review, status: 'UNCERTAIN' },
      { ...review, checks: review.checks.slice(1) },
      { ...review, checks: [...review.checks.slice(1), review.checks[1]] },
      { ...review, checks: [{ ...review.checks[0], result: 'FAIL' }, ...review.checks.slice(1)] },
      {
        ...review,
        checks: [{ ...review.checks[0], result: 'UNCERTAIN' }, ...review.checks.slice(1)],
      },
      { ...review, checks: [{ ...review.checks[0], aspect: 'beauty' }, ...review.checks.slice(1)] },
      { ...review, summary: 'a'.repeat(321) },
      {
        ...review,
        checks: [{ ...review.checks[0], reason: 'a'.repeat(201) }, ...review.checks.slice(1)],
      },
      { ...review, approved: true },
    ])
      expect(
        conversionSchema.safeParse({
          ...reviewed,
          chapters: [{ ...reviewed.chapters[0], visualReview: invalidReview }],
        }).success,
      ).toBe(false)
  })
  it('allows report-only completion but rejects any rejected or uncertain image as a successful result', () => {
    for (const result of ['FAIL', 'UNCERTAIN']) {
      const review = {
        status: result === 'FAIL' ? 'REJECTED' : 'UNCERTAIN',
        summary: '画面无法安全采用。',
        checks: ['source', 'people', 'style', 'composition', 'artifacts'].map((aspect) => ({
          aspect,
          result: aspect === 'source' ? result : 'PASS',
          reason: '自动检查结论。',
        })),
      }
      const reportOnly = {
        ...run,
        chapters: [
          { ...run.chapters[0], status: 'REJECTED', imageUrl: null, visualReview: review },
        ],
        counts: { ...run.counts, succeeded: 0, rejected: 1 },
        artifacts: { ...run.artifacts, epub: null, report: '/api/v1/artifacts/report-1/download' },
        partial: true,
      }
      expect(conversionSchema.safeParse(reportOnly).success).toBe(true)
      expect(
        conversionSchema.safeParse({
          ...reportOnly,
          chapters: [{ ...reportOnly.chapters[0], imageUrl: run.chapters[0]!.imageUrl }],
        }).success,
      ).toBe(false)
      expect(
        conversionSchema.safeParse({
          ...reportOnly,
          chapters: [{ ...reportOnly.chapters[0], status: 'SUCCEEDED' }],
          counts: { ...run.counts, rejected: 0 },
        }).success,
      ).toBe(false)
      expect(
        conversionSchema.safeParse({ ...reportOnly, counts: { ...reportOnly.counts, rejected: 0 } })
          .success,
      ).toBe(false)
    }
  })
  it('validates content-directed art planning, coverage, palette and the selected chapter concept', () => {
    const artDirection = {
      id: 'book-art',
      version: 1,
      hash: 'd'.repeat(64),
      label: '潮湿山林的墨线',
      description: '根据本书代表性样本规划',
      status: 'provisional',
      visualReview: 'unreviewed',
    }
    const bookArtPlan = {
      reading: '克制而缓慢的叙述。',
      rationale: '线条疏密承接叙述中的停顿。',
      coverage: {
        mode: 'representative-samples',
        totalSupportedSections: 12,
        sampledSections: 4,
        sampledParagraphs: 16,
      },
      medium: 'monochrome-ink',
      palette: [{ colorName: '石墨', hex: '#333333' }],
      lineLanguage: '疏密变化',
      shapeLanguage: '开放轮廓',
      negativeSpace: 'generous',
      characterTreatment: '人物弱化细节',
    }
    const visualPlan = {
      concepts: [
        { id: 'one', idea: '雨后的空山', composition: '远景留白', emotionalIntent: '寂静' },
        { id: 'two', idea: '枝头的残水', composition: '局部与远山', emotionalIntent: '余韵' },
      ],
      selectedConceptId: 'one',
      selectionReason: '空山更接近这一节的叙述重心。',
    }
    const view = {
      ...run,
      artDirection,
      bookArtPlan,
      chapters: [{ ...run.chapters[0], visualPlan }],
    }
    expect(conversionSchema.parse(view).bookArtPlan).toEqual(bookArtPlan)
    for (const invalid of [
      {
        ...view,
        bookArtPlan: { ...bookArtPlan, coverage: { ...bookArtPlan.coverage, sampledSections: 13 } },
      },
      {
        ...view,
        bookArtPlan: {
          ...bookArtPlan,
          palette: [{ colorName: 'unsafe', hex: 'url(https://example.com)' }],
        },
      },
      { ...view, artDirection: { ...artDirection, visualReview: 'approved' } },
      { ...view, artDirection: { ...artDirection, id: 'literary-editorial', version: 2 } },
      {
        ...view,
        chapters: [
          { ...run.chapters[0], visualPlan: { ...visualPlan, selectedConceptId: 'missing' } },
        ],
      },
      {
        ...view,
        chapters: [
          { ...run.chapters[0], visualPlan: { ...visualPlan, concepts: [visualPlan.concepts[0]] } },
        ],
      },
      {
        ...view,
        chapters: [
          {
            ...run.chapters[0],
            visualPlan: {
              ...visualPlan,
              concepts: [visualPlan.concepts[0], visualPlan.concepts[0]],
            },
          },
        ],
      },
    ])
      expect(conversionSchema.safeParse(invalid).success).toBe(false)
    const catalog = {
      catalogId: input.catalogId,
      sourceSha256: id,
      parserVersion: 'illustration-sections-2',
      title: null,
      chapters: [],
      artPlanning: { mode: 'content-directed', description: '转换后从书籍样本制定方案。' },
      pricing: {
        currency: 'CNY',
        perChapterUpperMicros: 150000,
        bookArtUpperMicros: 30000,
        maxBudgetMicros: 1000000,
        enabled: true,
      },
    }
    expect(chapterCatalogSchema.parse(catalog).pricing.bookArtUpperMicros).toBe(30000)
    expect(
      chapterCatalogSchema.safeParse({
        ...catalog,
        pricing: { ...catalog.pricing, bookArtUpperMicros: -1 },
      }).success,
    ).toBe(false)
  })
  it('keeps legacy results distinct and rejects an unverified style approval claim', () => {
    expect(conversionSchema.parse(run).artDirection).toBeUndefined()
    const artDirection = {
      id: 'literary-editorial',
      version: 2,
      hash: 'd'.repeat(64),
      label: '文学编辑插画',
      description: '近白留白、有限色板、手绘线条',
      status: 'provisional',
      visualReview: 'unreviewed',
    }
    expect(conversionSchema.parse({ ...run, artDirection }).artDirection).toEqual(artDirection)
    expect(
      conversionSchema.safeParse({
        ...run,
        artDirection: { ...artDirection, visualReview: 'approved' },
      }).success,
    ).toBe(false)
    expect(
      conversionSchema.safeParse({ ...run, artDirection: { ...artDirection, hash: 'changed' } })
        .success,
    ).toBe(false)
  })
  it('validates subsection placement presets and explicit unlimited monetary metadata', () => {
    const inline = {
      ...run,
      budget: { ...run.budget, maxCostMicros: 1, enforced: false },
      chapters: [
        {
          ...run.chapters[0],
          scope: 'section',
          sectionId: id,
          placement: { kind: 'after-paragraph', size: 'medium', alignment: 'center' },
        },
      ],
    }
    expect(conversionSchema.safeParse(inline).success).toBe(true)
    expect(
      conversionSchema.safeParse({ ...inline, budget: { ...inline.budget, enforced: true } })
        .success,
    ).toBe(false)
    for (const placement of [
      { kind: 'after-paragraph', size: 'giant', alignment: 'center' },
      { kind: 'after-paragraph', size: 'medium', alignment: 'left' },
      { kind: 'after-paragraph', size: 'medium', alignment: 'center', css: 'position:absolute' },
    ])
      expect(
        conversionSchema.safeParse({ ...inline, chapters: [{ ...inline.chapters[0], placement }] })
          .success,
      ).toBe(false)
  })
  it('allows disabled catalog entries with no logical index and rejects selectable index -1', () => {
    const catalog = {
      catalogId: input.catalogId,
      sourceSha256: id,
      parserVersion: 'v1',
      title: null,
      chapters: [
        {
          id,
          index: -1,
          title: 'Appendix',
          level: 1,
          selectable: false,
          reasonCode: 'UNSUPPORTED',
        },
      ],
      pricing: {
        currency: 'CNY',
        perChapterUpperMicros: 150000,
        maxBudgetMicros: 1000000,
        enabled: false,
      },
    }
    expect(chapterCatalogSchema.safeParse(catalog).success).toBe(true)
    expect(
      chapterCatalogSchema.safeParse({
        ...catalog,
        chapters: [{ ...catalog.chapters[0], selectable: true }],
      }).success,
    ).toBe(false)
  })
  it('rejects duplicate selection, untrusted image URLs and pictures from another task or chapter', () => {
    expect(conversionInputSchema.safeParse({ ...input, chapterIds: [id, id] }).success).toBe(false)
    expect(conversionSchema.safeParse(run).success).toBe(true)
    for (const imageUrl of [
      'https://example.com/private.png',
      `/api/v1/illustration-conversions/another-run/chapters/${id}/image`,
      `/api/v1/illustration-conversions/run-1/chapters/${'c'.repeat(64)}/image`,
    ])
      expect(
        conversionSchema.safeParse({ ...run, chapters: [{ ...run.chapters[0], imageUrl }] })
          .success,
      ).toBe(false)
    expect(conversionSchema.safeParse({ ...run, status: 'RUNNING' }).success).toBe(false)
  })
  it('rejects a valid DTO that belongs to another book, budget or chapter selection', async () => {
    mock.onGet('/v1/illustration-conversions/run-1').reply(200, envelope(run))
    for (const binding of [
      { bookId: 'other-book', input },
      { bookId: 'book-1', input: { ...input, maxCostMicros: 200000 } },
      { bookId: 'book-1', input: { ...input, chapterIds: ['c'.repeat(64)] } },
    ])
      await expect(getIllustrationConversion('run-1', binding)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
  })
  it('treats an empty lookup as read-only absence with credentialed query parameters', async () => {
    mock.onGet('/v1/books/book-1/illustration-conversions/lookup').reply(200, envelope(null))
    const requestKey = '31bc61a8-fc9d-47af-a740-d2594c4a6742'
    await expect(
      lookupIllustrationConversion({ bookId: 'book-1', input }, requestKey),
    ).resolves.toBeNull()
    expect(mock.history.get[0]!.params).toEqual({ requestKey })
    expect(mock.history.get[0]!.withCredentials).toBe(true)
    expect(mock.history.post).toHaveLength(0)
  })
})
