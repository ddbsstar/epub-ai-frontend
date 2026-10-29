import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { mount, type VueWrapper } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import IllustrationView from './IllustrationView.vue'

const mock = new MockAdapter(apiClient)
const firstId = '1'.repeat(64)
const secondId = '2'.repeat(64)
const unsupportedId = '3'.repeat(64)
const receipt = {
  id: 'upload-123',
  bookId: 'book-123',
  originalName: '示例.epub',
  byteSize: 6,
  sha256: 'a'.repeat(64),
}
const catalog = {
  catalogId: 'c'.repeat(64),
  sourceSha256: receipt.sha256,
  parserVersion: 'v1',
  title: '山间来信',
  chapters: [
    { id: firstId, index: 0, title: '第一章 雨后', level: 0, selectable: true, reasonCode: null },
    { id: secondId, index: 1, title: '第二章 来信', level: 0, selectable: true, reasonCode: null },
    {
      id: unsupportedId,
      index: -1,
      title: '附录',
      level: 1,
      selectable: false,
      reasonCode: 'UNSUPPORTED_CHAPTER_STRUCTURE',
    },
  ],
  pricing: {
    currency: 'CNY',
    perChapterUpperMicros: 150000,
    maxBudgetMicros: 1000000,
    enabled: true,
  },
}
const input = {
  catalogId: catalog.catalogId,
  chapterIds: [firstId, secondId],
  maxCostMicros: 300000,
}
const run = {
  id: 'run-123',
  bookId: receipt.bookId,
  catalogId: catalog.catalogId,
  status: 'RUNNING',
  stage: 'generate',
  originalName: receipt.originalName,
  title: '山间来信',
  chapters: [
    {
      id: firstId,
      index: 0,
      title: '第一章 雨后',
      status: 'GENERATING',
      error: null,
      imageUrl: null,
    },
    {
      id: secondId,
      index: 1,
      title: '第二章 来信',
      status: 'WAITING',
      error: null,
      imageUrl: null,
    },
  ],
  counts: { total: 2, completed: 0, succeeded: 0, failed: 0, skipped: 0, unknown: 0 },
  budget: { currency: 'CNY', maxCostMicros: 300000, upperBoundMicros: 300000 },
  artifacts: { epub: null, report: null, cover: null },
  partial: false,
  error: null,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
}
const completed = {
  ...run,
  status: 'SUCCEEDED',
  stage: 'publish',
  chapters: [
    {
      ...run.chapters[0],
      status: 'SUCCEEDED',
      imageUrl: `/api/v1/illustration-conversions/run-123/chapters/${firstId}/image`,
    },
    {
      ...run.chapters[1],
      status: 'FAILED',
      error: { code: 'AI_UPSTREAM_REJECTED', message: 'private /path/key' },
    },
  ],
  counts: { total: 2, completed: 2, succeeded: 1, failed: 1, skipped: 0, unknown: 0 },
  artifacts: {
    epub: '/api/v1/artifacts/export-123/download',
    report: '/api/v1/artifacts/report-123/download',
    cover: null,
  },
  partial: true,
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'test-123' } })
const createUrl = '/v1/books/book-123/illustration-conversions'
const lookupUrl = `${createUrl}/lookup`
const catalogUrl = '/v1/books/book-123/chapters'
const savedKey = 'epub-book-conversion-v1'
let wrapper: VueWrapper | undefined
let queryClient: QueryClient | undefined
function mountPage() {
  queryClient = createQueryClient()
  wrapper = mount(IllustrationView, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return wrapper
}
function save(runId: string | null) {
  sessionStorage.setItem(
    savedKey,
    JSON.stringify({
      receipt,
      submission: { input, key: '31bc61a8-fc9d-47af-a740-d2594c4a6742' },
      runId,
    }),
  )
}
async function chooseFile(view: VueWrapper, file = new File(['sample'], '示例.epub')) {
  const field = view.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(field.element, 'files', { configurable: true, value: [file] })
  await field.trigger('change')
}
function button(view: VueWrapper, label: string) {
  const result = view.findAll('button').find((entry) => entry.text() === label)
  if (!result) throw new Error(`Missing button ${label}`)
  return result
}
async function uploadAndChoose(view: VueWrapper) {
  mock.onPost('/v1/uploads').reply(201, envelope(receipt))
  mock.onGet(catalogUrl).reply(200, envelope(catalog))
  await chooseFile(view)
  await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
  await button(view, '全选可用章节').trigger('click')
}
afterEach(() => {
  wrapper?.unmount()
  queryClient?.clear()
  mock.reset()
  sessionStorage.clear()
})

describe('upload → select chapters → illustrated whole-book conversion', () => {
  it('keeps an uploaded book visible and explains an empty catalog without allowing paid submission', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(200, envelope({ ...catalog, title: '沉默的大多数', chapters: [] }))
    const view = mountPage()
    await chooseFile(view, new File(['sample'], '王小波：沉默的大多数.epub'))
    await vi.waitFor(() => expect(view.text()).toContain('没有识别到可配图的正文目录。'))
    expect(view.text()).toContain('王小波：沉默的大多数.epub')
    expect(view.text()).toContain('沉默的大多数')
    expect(view.get('.chapter-selection-empty').text()).toContain(
      '当前解析方式没有识别到正文章节或文章',
    )
    expect(view.text()).toContain('原书已保留，尚未开始转换')
    expect(view.text()).not.toContain('目录已准备好')
    expect(view.text()).not.toContain('目录读取失败')
    expect(view.text()).not.toContain('本次最多选 0')
    expect(view.find('.chapter-list').exists()).toBe(false)
    expect(button(view, '全选可用章节').attributes('disabled')).toBeDefined()
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '全选可用章节').trigger('click')
    await button(view, '开始转换').trigger('click')
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('keeps all unsupported directory entries and their reasons while disabling empty selection', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        chapters: catalog.chapters.map((chapter) => ({
          ...chapter,
          selectable: false,
          reasonCode: 'UNSUPPORTED_CHAPTER_STRUCTURE',
        })),
      }),
    )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('这本书暂时没有可配图的内容。'))
    expect(view.get('.chapter-selection-empty').text()).toContain('已识别目录，但没有可配图的内容')
    expect(view.findAll('.chapter-list input')).toHaveLength(3)
    expect(view.findAll('.chapter-reason')).toHaveLength(3)
    expect(
      view
        .findAll('.chapter-list input')
        .every((field) => field.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(view.text()).toContain('这一章结构较复杂，暂不支持安全配图')
    expect(view.text()).toContain('第一章 雨后')
    expect(view.text()).toContain('第二章 来信')
    expect(view.text()).not.toContain('目录已准备好')
    expect(view.text()).not.toContain('没有识别到可配图的正文目录')
    expect(button(view, '全选可用章节').attributes('disabled')).toBeDefined()
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('distinguishes a failed catalog read and retries only the read without uploading or converting again', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).replyOnce(503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: 'private upstream response' },
      meta: { requestId: 'catalog-failure-1' },
    })
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('目录读取失败，请重试。'))
    expect(view.text()).toContain('原书已上传，目录未能读取')
    expect(view.text()).toContain(receipt.originalName)
    expect(view.text()).not.toContain('没有识别到可配图的正文目录')
    expect(view.text()).not.toContain('private upstream response')
    expect(view.find('.chapter-selection').exists()).toBe(false)
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '重新读取目录').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('目录已准备好，选几章试试。'))
    expect(view.findAll('.chapter-list input')).toHaveLength(3)
    expect(mock.history.get.map((request) => request.url)).toEqual([catalogUrl, catalogUrl])
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('distinguishes an unknown text-planning result from disabled image review without resubmitting it', async () => {
    save(run.id)
    const imageReview = {
      enabled: false,
      description: '本次转换不做生成后的 AI 视觉复核。',
    }
    mock.onGet(catalogUrl).reply(200, envelope({ ...catalog, visualReview: imageReview }))
    mock.onGet('/v1/illustration-conversions/run-123').reply(
      200,
      envelope({
        ...run,
        imageReview,
        chapters: [
          {
            ...run.chapters[0],
            status: 'UNKNOWN',
            error: { code: 'ILLUSTRATION_PLANNING_FAILED', message: 'private upstream response' },
          },
          { ...run.chapters[1], status: 'GENERATING' },
        ],
        counts: { ...run.counts, completed: 1, unknown: 1 },
      }),
    )
    const view = mountPage()
    await vi.waitFor(() =>
      expect(view.text()).toContain('文字规划阶段未完成或返回异常，尚未提交生图。'),
    )
    expect(view.text()).toContain('结果待确认')
    expect(view.text()).toContain('未做 AI 视觉复核')
    expect(view.text()).not.toContain('这一章的插画方案未通过检查')
    expect(view.text()).not.toContain('质检未通过')
    expect(view.text()).not.toContain('private upstream response')
    expect(view.find('.chapter-visual-review').exists()).toBe(false)
    expect(view.find('.chapter-gallery').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
  })
  it('uploads, selects and creates a direct-insertion run without review costs or approval claims', async () => {
    const imageReview = {
      enabled: false,
      description: '本次转换不做生成后的 AI 视觉复核；保留文件完整性、插入位置及 EPUB 格式检查。',
    }
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(200, envelope({ ...catalog, visualReview: imageReview }))
    mock.onPost(createUrl).reply(202, envelope({ ...run, imageReview }))
    mock
      .onGet('/v1/illustration-conversions/run-123')
      .reply(200, envelope({ ...completed, imageReview }))
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('生成成功后直接插入，不做 AI 二次校验'))
    expect(view.get('.conversion-cost-note').text()).toContain('包含文字分析与一张图')
    expect(view.get('.conversion-cost-note').text()).not.toContain('质检')
    await button(view, '全选可用章节').trigger('click')
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.find('a.upload-download').exists()).toBe(true))
    expect(view.text()).toContain('已插入 1 幅')
    expect(view.text()).toContain('未做 AI 视觉复核')
    expect(view.text()).toContain('本章分析，尚未提交生图')
    expect(view.findAll('.chapter-gallery img')).toHaveLength(1)
    expect(view.get('.chapter-gallery').text()).toContain('已插入书中 · 未做 AI 视觉复核')
    expect(view.find('.chapter-visual-review').exists()).toBe(false)
    expect(view.text()).not.toContain('质检未通过 0')
    expect(view.text()).not.toContain('图片质检 · 通过')
    expect(view.text()).not.toContain('正在检查生成的图片')
    expect(mock.history.post).toHaveLength(2)
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual(input)
  })
  it('keeps historical review active even when new catalog conversions skip review', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        visualReview: {
          enabled: false,
          description: '新的转换不做 AI 二次校验。',
        },
        pricing: { ...catalog.pricing, perChapterReviewUpperMicros: 10000 },
      }),
    )
    mock.onGet('/v1/illustration-conversions/run-123').reply(
      200,
      envelope({
        ...run,
        imageReview: {
          enabled: true,
          description: '此历史转换先检查图片，再将通过的图片插入书中。',
        },
        chapters: [{ ...run.chapters[0], status: 'REVIEWING' }, run.chapters[1]],
      }),
    )
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('正在检查生成的图片'))
    expect(view.text()).toContain('正在检查图片')
    expect(view.text()).not.toContain('生成成功后直接插入，不做 AI 二次校验')
    expect(view.text()).toContain('本次预算上限 ¥0.30')
    expect(view.get('[aria-label="图片质检规则"]').text()).toContain(
      '不代表用户批准，也不保证审美效果',
    )
    expect(view.find('.chapter-gallery').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
  })
  it.each(['SUCCEEDED', 'FAILED'])(
    'keeps rejected images out of the gallery and EPUB while a %s report remains downloadable',
    async (status) => {
      save(run.id)
      const review = (uncertain: boolean) => ({
        status: uncertain ? 'UNCERTAIN' : 'REJECTED',
        summary: uncertain ? '无法确认人物是否有原文依据。' : '画面增加了原文没有的人物。',
        checks: ['source', 'people', 'style', 'composition', 'artifacts'].map((aspect) => ({
          aspect,
          result: aspect === 'people' ? (uncertain ? 'UNCERTAIN' : 'FAIL') : 'PASS',
          reason: aspect === 'people' ? '人物与当前场景不一致。' : '未发现明显偏差。',
        })),
      })
      mock.onGet(catalogUrl).reply(200, envelope(catalog))
      mock.onGet('/v1/illustration-conversions/run-123').reply(
        200,
        envelope({
          ...run,
          status,
          stage: 'publish',
          chapters: run.chapters.map((chapter, index) => ({
            ...chapter,
            status: 'REJECTED',
            visualReview: review(index === 1),
            error: {
              code: index === 1 ? 'VISUAL_REVIEW_UNCERTAIN' : 'VISUAL_REVIEW_REJECTED',
              message: 'private prompt must not appear',
            },
          })),
          counts: { ...run.counts, completed: 2, rejected: 2 },
          partial: true,
          error:
            status === 'FAILED'
              ? { code: 'VISUAL_REVIEW_REJECTED', message: 'private prompt must not appear' }
              : null,
          artifacts: { ...run.artifacts, report: '/api/v1/artifacts/review-report/download' },
        }),
      )
      const view = mountPage()
      await vi.waitFor(() => expect(view.findAll('.chapter-visual-review')).toHaveLength(2))
      expect(view.text()).toContain('质检未通过，不插入书中')
      expect(view.text()).toContain('图片质检 · 未通过')
      expect(view.text()).toContain('图片质检 · 不确定')
      expect(view.get('.chapter-visual-review').attributes('open')).toBeUndefined()
      expect(view.findAll('.chapter-visual-review li')).toHaveLength(10)
      expect(view.text()).toContain('原文依据 · 通过')
      expect(view.text()).toContain('人物一致 · 未通过')
      expect(view.text()).toContain('人物与当前场景不一致')
      expect(view.text()).toContain('质检未通过 2 章')
      expect(view.text()).not.toContain('private prompt')
      expect(view.text()).not.toContain('插画，已经装进书里')
      expect(view.text()).not.toContain('插画版已就绪')
      expect(view.text()).not.toContain('成功图片已插入同一本书')
      expect(view.find('.chapter-gallery').exists()).toBe(false)
      expect(view.find('a.upload-download').exists()).toBe(false)
      expect(
        view
          .findAll('a')
          .find((entry) => entry.text() === '下载转换报告')
          ?.attributes('href'),
      ).toBe('/api/v1/artifacts/review-report/download')
      if (status === 'SUCCEEDED') {
        expect(view.text()).toContain('本次没有可插入的图片')
        expect(view.text()).toContain('未导出插画 EPUB')
      }
      expect(mock.history.post).toHaveLength(0)
    },
  )
  it('adds the one-time book art cost to the selection and reserves its budget before chapter conversion', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        artPlanning: {
          mode: 'content-directed',
          description: '根据书籍代表性样本理解内容并制定艺术方案。',
        },
        pricing: {
          ...catalog.pricing,
          bookArtUpperMicros: 100000,
          perChapterReviewUpperMicros: 10000,
          maxBudgetMicros: 350000,
        },
      }),
    )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('按这本书的内容，制定艺术方案'))
    expect(view.find('[aria-label="本次艺术方向"]').exists()).toBe(false)
    expect(view.text()).toContain('艺术规划为一次固定费用估计上界 ¥0.10')
    await button(view, '全选可用章节').trigger('click')
    expect(view.text()).toContain('已选 2 章 · 预算上限 ¥0.40')
    expect(view.text()).toContain('本次最多选 1 章')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '保留已选的前 1 章').trigger('click')
    expect(view.text()).toContain('已选 1 章 · 预算上限 ¥0.25')
    expect(mock.history.post).toHaveLength(1)
    const next = {
      ...run,
      stage: 'art-plan',
      chapters: [run.chapters[0]],
      counts: { ...run.counts, total: 1 },
      budget: { ...run.budget, maxCostMicros: 250000, upperBoundMicros: 250000 },
    }
    mock.onPost(createUrl).reply(202, envelope(next))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(next))
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('正在制定本书艺术方案'))
    expect(view.text()).toContain('此阶段还未开始生图')
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({
      catalogId: catalog.catalogId,
      chapterIds: [firstId],
      maxCostMicros: 250000,
    })
    expect(mock.history.post).toHaveLength(2)
  })
  it('blocks conversion when the fixed art cost alone exceeds the budget, even with a zero chapter price', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        pricing: {
          ...catalog.pricing,
          perChapterUpperMicros: 0,
          bookArtUpperMicros: 50000,
          maxBudgetMicros: 30000,
        },
      }),
    )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
    await button(view, '全选可用章节').trigger('click')
    expect(view.text()).toContain('本次最多选 0 章')
    expect(view.text()).toContain('当前单次预算不足')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(mock.history.post).toHaveLength(1)
  })
  it('restores the actual content-directed art plan and visual alternatives with GET requests only', async () => {
    save(run.id)
    const artDirection = {
      id: 'book-art',
      version: 1,
      hash: 'd'.repeat(64),
      label: '山间的淡墨',
      description: '从代表性样本生成',
      status: 'provisional',
      visualReview: 'unreviewed',
    }
    const bookArtPlan = {
      reading: '故事缓慢而含蓄。',
      rationale: '墨线和留白适合书中反复出现的空山意象。',
      coverage: {
        mode: 'representative-samples',
        totalSupportedSections: 20,
        sampledSections: 5,
        sampledParagraphs: 18,
      },
      medium: 'monochrome-ink',
      palette: [
        { colorName: '山石灰', hex: '#484A42' },
        { colorName: '纸白', hex: '#F6F3EA' },
      ],
      lineLanguage: '轻线条',
      shapeLanguage: '开放形状',
      negativeSpace: 'generous',
      characterTreatment: '人物以背影表达',
    }
    const visualPlan = {
      concepts: [
        { id: 'one', idea: '雨后空山', composition: '留白远景', emotionalIntent: '静谧' },
        { id: 'two', idea: '山间来信', composition: '手与信的局部', emotionalIntent: '期待' },
      ],
      selectedConceptId: 'one',
      selectionReason: '空山保留了这一节的情绪停顿。',
    }
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(
      200,
      envelope({
        ...completed,
        artDirection,
        bookArtPlan,
        chapters: [{ ...completed.chapters[0], visualPlan }, completed.chapters[1]],
      }),
    )
    const view = mountPage()
    await vi.waitFor(() => expect(view.find('[aria-label="本书艺术方案"]').exists()).toBe(true))
    expect(view.text()).toContain('山间的淡墨')
    expect(view.text()).toContain('可处理 20 节中，抽样 5 节、18 段')
    expect(view.text()).toContain('不代表全文逐段精读')
    expect(view.text()).toContain('为什么适合这本书')
    expect(view.text()).toContain('单色墨线')
    expect(view.findAll('.book-art-palette i')).toHaveLength(2)
    expect(view.get('.book-art-palette i').attributes('style')).toContain(
      'background-color: rgb(72, 74, 66)',
    )
    expect(view.get('.chapter-visual-plan').attributes('open')).toBeUndefined()
    expect(view.text()).toContain('画面方案 · 2 个候选')
    expect(view.get('.chapter-concept.is-selected').text()).toContain('雨后空山')
    expect(view.text()).toContain('空山保留了这一节的情绪停顿')
    expect(mock.history.post).toHaveLength(0)
  })
  it('shows the frozen task style rather than applying the new catalog style to old images', async () => {
    save(run.id)
    const artDirection = {
      id: 'literary-editorial',
      version: 2,
      hash: 'd'.repeat(64),
      label: '文学编辑插画',
      description: '近白留白、炭灰线条、有限色板',
      status: 'provisional',
      visualReview: 'unreviewed',
    }
    mock.onGet(catalogUrl).reply(200, envelope({ ...catalog, artDirection }))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('本次结果来自旧版，未锁定艺术风格'))
    expect(view.find('[aria-label="本次艺术方向"]').exists()).toBe(false)
    mock
      .onGet('/v1/illustration-conversions/run-123')
      .reply(200, envelope({ ...completed, artDirection }))
    await queryClient!.refetchQueries({ queryKey: ['book-conversion'] })
    await vi.waitFor(() => expect(view.find('[aria-label="本次艺术方向"]').exists()).toBe(true))
    expect(view.text()).toContain('生成图片仍需目视验收')
    expect(mock.history.post).toHaveLength(0)
  })
  it('keeps an old chapter export downloadable while reselecting the upgraded subsection catalog', async () => {
    save(run.id)
    const sectionId = '4'.repeat(64)
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        parserVersion: 'illustration-sections-2',
        chapters: [
          {
            ...catalog.chapters[0],
            selectable: false,
            scope: 'chapter',
            reasonCode: 'SECTION_SELECTION_REQUIRED',
          },
          {
            ...catalog.chapters[1],
            id: sectionId,
            index: 0,
            scope: 'section',
            sectionId,
            title: '雨后的山路',
            level: 1,
          },
        ],
        pricing: { ...catalog.pricing, budgetEnforced: false },
      }),
    )
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('部分章节未完成'))
    await button(view, '重新选择章节').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('已选 0 节'))
    expect(view.text()).toContain('下载上次插画 EPUB')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '全选可用小节').trigger('click')
    expect(view.text()).toContain('已选 1 节')
    expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
    expect(mock.history.post).toHaveLength(0)
  })
  it.each(['illustration-sections-2', 'illustration-sections-3'])(
    'selects %s subsections with a parent heading and no monetary selection cap, submitting only on click',
    async (parserVersion) => {
      const sections = {
        ...catalog,
        parserVersion,
        chapters: [
          {
            ...catalog.chapters[2],
            title: '第一章 雨后',
            level: 0,
            scope: 'chapter',
            reasonCode: 'SECTION_PARENT',
          },
          ...catalog.chapters.slice(0, 2).map((entry, index) => ({
            ...entry,
            index: 0,
            title: index === 0 ? '1. 雨停以后' : '2. 山间来信',
            level: 1,
            scope: 'section',
            sectionId: entry.id,
            parentChapterTitle: '第一章 雨后',
            boundaryKind: 'heading',
          })),
        ],
        pricing: { ...catalog.pricing, budgetEnforced: false, maxBudgetMicros: 1 },
      }
      mock.onPost('/v1/uploads').reply(201, envelope(receipt))
      mock.onGet(catalogUrl).reply(200, envelope(sections))
      const view = mountPage()
      await chooseFile(view)
      await vi.waitFor(() => expect(view.text()).toContain('全选可用小节'))
      await button(view, '全选可用小节').trigger('click')
      expect(
        view
          .findAll<HTMLInputElement>('input[type="checkbox"]')
          .map((field) => field.element.checked),
      ).toEqual([false, true, true])
      expect(view.text()).toContain('已选 2 节')
      expect(view.text()).toContain('金额预算限制已关闭')
      expect(view.text()).toContain('相关场景出现后的段落之间插图')
      expect(view.text()).not.toContain('章末插画')
      expect(view.find('#conversion-budget-limit').exists()).toBe(false)
      expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
      expect(mock.history.post).toHaveLength(1)
      const next = {
        ...run,
        chapters: run.chapters.map((entry, index) => ({
          ...entry,
          index: 0,
          scope: 'section',
          sectionId: entry.id,
          title: sections.chapters[index + 1]!.title,
        })),
        budget: { ...run.budget, enforced: false },
      }
      mock.onPost(createUrl).reply(202, envelope(next))
      mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(next))
      await button(view, '开始转换').trigger('click')
      await vi.waitFor(() => expect(view.text()).toContain('正在为选中的小节配图'))
      expect(JSON.parse(mock.history.post[1]!.data)).toEqual(input)
      expect(mock.history.post).toHaveLength(2)
    },
  )
  it('shows each generated subsection picture placement and registered size after refresh without POST', async () => {
    save(run.id)
    mock
      .onGet(catalogUrl)
      .reply(200, envelope({ ...catalog, parserVersion: 'illustration-sections-2' }))
    mock.onGet('/v1/illustration-conversions/run-123').reply(
      200,
      envelope({
        ...completed,
        chapters: [
          {
            ...completed.chapters[0],
            scope: 'section',
            sectionId: firstId,
            placement: { kind: 'after-paragraph', size: 'compact', alignment: 'center' },
          },
          { ...completed.chapters[1], scope: 'section', sectionId: secondId },
        ],
        budget: { ...completed.budget, enforced: false },
      }),
    )
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('对应段落之后 · 小幅居中'))
    expect(view.text()).toContain('部分小节未完成')
    expect(view.text()).toContain('金额预算限制已关闭')
    expect(view.text()).toContain('随文配图')
    expect(mock.history.post).toHaveLength(0)
  })
  it('starts empty without requests, pictures or invented progress', () => {
    const view = mountPage()
    expect(view.text()).toContain('等待开始')
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
    expect(view.find('.upload-download[href]').exists()).toBe(false)
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(mock.history.get).toHaveLength(0)
    expect(mock.history.post).toHaveLength(0)
  })
  it('rejects an invalid file without uploading', async () => {
    const view = mountPage()
    await chooseFile(view, new File(['text'], 'notes.txt'))
    expect(view.text()).toContain('请选择 EPUB 格式')
    expect(mock.history.post).toHaveLength(0)
  })
  it('uploads once and reads the free catalog with no automatic export or paid submission', async () => {
    const view = mountPage()
    await uploadAndChoose(view)
    await button(view, '取消全选').trigger('click')
    expect(view.text()).toContain('已选 0 章')
    expect(view.text()).toContain('目录读取不调用付费模型')
    const fields = view.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(fields.every((field) => !field.element.checked)).toBe(true)
    expect(fields[2]!.attributes('disabled')).toBeDefined()
    expect(view.text()).toContain('这一章结构较复杂')
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
    expect(mock.history.get.map((request) => request.url)).toEqual([catalogUrl])
    expect(view.text()).not.toContain('规划插画')
  })
  it('selects only supported chapters and shows the cost before the one explicit conversion', async () => {
    const view = mountPage()
    await uploadAndChoose(view)
    expect(view.text()).toContain('已选 2 章 · 预算上限 ¥0.30')
    mock.onPost(createUrl).reply(202, envelope(run))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(run))
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('正在为选中的章节配图'))
    const request = mock.history.post.find((entry) => entry.url === createUrl)!
    expect(JSON.parse(request.data)).toEqual(input)
    expect(request.headers?.['Idempotency-Key']).toMatch(/^[a-f0-9-]{36}$/u)
    expect(mock.history.post).toHaveLength(2)
    expect(
      view
        .findAll('input[type="checkbox"]')
        .every((field) => field.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(view.find('img').exists()).toBe(false)
  })
  it('shows the chapter budget and trims an excess selection without submitting a conversion', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock
      .onGet(catalogUrl)
      .reply(
        200,
        envelope({ ...catalog, pricing: { ...catalog.pricing, maxBudgetMicros: 200000 } }),
      )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
    expect(view.text()).toContain('本次最多选 1 章 · 单次预算上限 ¥0.20')
    await button(view, '全选可用章节').trigger('click')
    expect(view.text()).toContain('已选 2 章，超过单次 ¥0.20 上限；本次最多选 1 章。')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '保留已选的前 1 章').trigger('click')
    const fields = view.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(fields.map((field) => field.element.checked)).toEqual([true, false, false])
    expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
    expect(view.text()).not.toContain('超过单次')
    expect(view.findAll('button').some((entry) => entry.text().startsWith('保留已选的前'))).toBe(
      false,
    )
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('keeps only the selected chapters in catalog order when reducing to the budget', async () => {
    const fourthId = '4'.repeat(64)
    const fifthId = '5'.repeat(64)
    const expandedCatalog = {
      ...catalog,
      chapters: [
        catalog.chapters[0],
        catalog.chapters[1],
        {
          id: fourthId,
          index: 2,
          title: '第三章 山路',
          level: 0,
          selectable: true,
          reasonCode: null,
        },
        {
          id: fifthId,
          index: 3,
          title: '第四章 归途',
          level: 0,
          selectable: true,
          reasonCode: null,
        },
        catalog.chapters[2],
      ],
      pricing: { ...catalog.pricing, maxBudgetMicros: 300000 },
    }
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(200, envelope(expandedCatalog))
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(5))
    const fields = view.findAll<HTMLInputElement>('input[type="checkbox"]')
    await fields[1]!.setValue(true)
    await fields[3]!.setValue(true)
    await fields[2]!.setValue(true)
    expect(view.text()).toContain('本次最多选 2 章 · 单次预算上限 ¥0.30')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    await button(view, '保留已选的前 2 章').trigger('click')
    expect(fields.map((field) => field.element.checked)).toEqual([false, true, true, false, false])
    expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
    expect(view.text()).toContain('已选 2 章 · 预算上限 ¥0.30')
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('does not offer an ineffective trim when the budget cannot cover one chapter', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock
      .onGet(catalogUrl)
      .reply(
        200,
        envelope({ ...catalog, pricing: { ...catalog.pricing, maxBudgetMicros: 100000 } }),
      )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
    expect(view.text()).toContain('本次最多选 0 章 · 单次预算上限 ¥0.10')
    await view.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect(view.text()).toContain('当前单次预算不足以转换 1 章，请联系管理员调整预算。')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(view.findAll('button').some((entry) => entry.text().startsWith('保留已选的前'))).toBe(
      false,
    )
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('supports zero-price chapters without division by zero or selecting unavailable entries', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onGet(catalogUrl).reply(
      200,
      envelope({
        ...catalog,
        pricing: { ...catalog.pricing, perChapterUpperMicros: 0, maxBudgetMicros: 0 },
      }),
    )
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
    expect(view.text()).toContain('本次最多选 2 章 · 单次预算上限 ¥0.00')
    await button(view, '全选可用章节').trigger('click')
    const fields = view.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(fields.map((field) => field.element.checked)).toEqual([true, true, false])
    expect(view.text()).toContain('已选 2 章 · 预算上限 ¥0.00')
    expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
    expect(view.text()).not.toContain('超过单次')
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('allows a free chapter list when conversion is disabled', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock
      .onGet(catalogUrl)
      .reply(200, envelope({ ...catalog, pricing: { ...catalog.pricing, enabled: false } }))
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('转换服务尚未启用'))
    await button(view, '全选可用章节').trigger('click')
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(mock.history.post).toHaveLength(1)
  })
  it('restores selected chapters and real images by GET only, clearly marking partial success', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('部分章节未完成'))
    expect(view.text()).toContain('失败 1 章')
    expect(view.text()).not.toContain('private /path/key')
    expect(view.text()).toContain('模型服务未接受本章分析')
    expect(view.get('.chapter-gallery img').attributes('src')).toBe(completed.chapters[0]!.imageUrl)
    expect(view.get('.upload-download[href]').attributes('href')).toBe(completed.artifacts.epub)
    expect(mock.history.post).toHaveLength(0)
  })
  it('reselects after partial completion without uploading or retrying unknown chapters, preserving the previous download binding', async () => {
    const thirdId = '4'.repeat(64)
    const expandedCatalog = {
      ...catalog,
      chapters: [
        ...catalog.chapters,
        {
          id: thirdId,
          index: 2,
          title: '第三章 山路',
          level: 0,
          selectable: true,
          reasonCode: null,
        },
      ],
    }
    const partial = {
      ...completed,
      chapters: [completed.chapters[0], { ...completed.chapters[1], status: 'UNKNOWN' }],
      counts: { ...completed.counts, failed: 0, unknown: 1 },
    }
    save(run.id)
    const originalSubmission = JSON.parse(sessionStorage.getItem(savedKey)!).submission
    mock.onGet(catalogUrl).reply(200, envelope(expandedCatalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(partial))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('部分章节未完成'))
    await button(view, '重新选择章节').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('下载上次插画 EPUB'))
    const fields = view.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(fields.map((field) => field.element.checked)).toEqual([true, false, false, false])
    expect(fields[0]!.attributes('disabled')).toBeUndefined()
    expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
    expect(view.find('.chapter-state[data-status="UNKNOWN"]').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
    const oldDownload = view.findAll('a').find((link) => link.text() === '下载上次插画 EPUB')!
    const oldReport = view.findAll('a').find((link) => link.text() === '下载上次转换报告')!
    expect(oldDownload.attributes('href')).toBe(completed.artifacts.epub)
    expect(oldReport.attributes('href')).toBe(completed.artifacts.report)
    const saved = JSON.parse(sessionStorage.getItem(savedKey)!)
    expect(saved).toEqual({
      receipt,
      submission: null,
      runId: null,
      previous: { runId: run.id, submission: originalSubmission },
    })
    await fields[3]!.setValue(true)
    const nextInput = { ...input, chapterIds: [firstId, thirdId] }
    const nextRun = {
      ...run,
      id: 'run-456',
      chapters: [
        run.chapters[0],
        { ...run.chapters[1], id: thirdId, index: 2, title: '第三章 山路' },
      ],
    }
    mock.onPost(createUrl).reply(202, envelope(nextRun))
    mock.onGet('/v1/illustration-conversions/run-456').reply(200, envelope(nextRun))
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('正在为选中的章节配图'))
    expect(mock.history.post.map((request) => request.url)).toEqual([createUrl])
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual(nextInput)
    expect(mock.history.post[0]!.headers?.['Idempotency-Key']).not.toBe(originalSubmission.key)
    expect(JSON.parse(sessionStorage.getItem(savedKey)!).previous).toEqual(saved.previous)
    view.unmount()
    queryClient!.clear()
    mock.resetHistory()
    const reopened = mountPage()
    await vi.waitFor(() => expect(reopened.text()).toContain('正在为选中的章节配图'))
    await vi.waitFor(() => expect(reopened.text()).toContain('下载上次插画 EPUB'))
    expect(mock.history.post).toHaveLength(0)
    expect(mock.history.get.map((request) => request.url).sort()).toEqual(
      [
        catalogUrl,
        '/v1/illustration-conversions/run-123',
        '/v1/illustration-conversions/run-456',
      ].sort(),
    )
    expect(
      reopened
        .findAll('a')
        .find((link) => link.text() === '下载上次插画 EPUB')!
        .attributes('href'),
    ).toBe(completed.artifacts.epub)
    expect(reopened.text()).not.toContain('转换任务与当前书籍或章节选择不匹配')
  })
  it('restores the previous result and successful selection with GET only before a new submission, and clears it when choosing another book', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('部分章节未完成'))
    await button(view, '重新选择章节').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('下载上次插画 EPUB'))
    view.unmount()
    queryClient!.clear()
    mock.resetHistory()
    const reopened = mountPage()
    await vi.waitFor(() => expect(reopened.text()).toContain('下载上次插画 EPUB'))
    expect(
      reopened
        .findAll<HTMLInputElement>('input[type="checkbox"]')
        .map((field) => field.element.checked),
    ).toEqual([true, false, false])
    expect(mock.history.post).toHaveLength(0)
    expect(mock.history.get.map((request) => request.url).sort()).toEqual(
      [catalogUrl, '/v1/illustration-conversions/run-123'].sort(),
    )
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    await chooseFile(reopened)
    await vi.waitFor(() => expect(mock.history.post).toHaveLength(1))
    expect(reopened.text()).not.toContain('下载上次插画 EPUB')
    await vi.waitFor(() => {
      const saved = JSON.parse(sessionStorage.getItem(savedKey)!)
      expect(saved?.receipt).toEqual(receipt)
      expect(saved).not.toHaveProperty('previous')
    })
  })
  it.each(['FAILED', 'CANCELLED'])(
    'permits an explicit new selection only after terminal %s',
    async (status) => {
      save(run.id)
      mock.onGet(catalogUrl).reply(200, envelope(catalog))
      mock.onGet('/v1/illustration-conversions/run-123').reply(
        200,
        envelope({
          ...completed,
          status,
          artifacts: { ...completed.artifacts, epub: null },
        }),
      )
      const view = mountPage()
      await vi.waitFor(() => expect(view.text()).toContain('重新选择章节'))
      await button(view, '重新选择章节').trigger('click')
      expect(button(view, '开始转换').attributes('disabled')).toBeUndefined()
      expect(
        view
          .findAll<HTMLInputElement>('input[type="checkbox"]')
          .map((field) => field.element.checked),
      ).toEqual([true, false, false])
      expect(mock.history.post).toHaveLength(0)
    },
  )
  it('does not overwrite a manual chapter selection when the previous result arrives later', async () => {
    save(run.id)
    const originalSubmission = JSON.parse(sessionStorage.getItem(savedKey)!).submission
    sessionStorage.setItem(
      savedKey,
      JSON.stringify({
        receipt,
        submission: null,
        runId: null,
        previous: { runId: run.id, submission: originalSubmission },
      }),
    )
    let finishPrevious!: (response: [number, ReturnType<typeof envelope>]) => void
    const response = new Promise<[number, ReturnType<typeof envelope>]>((resolve) => {
      finishPrevious = resolve
    })
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(() => response)
    const view = mountPage()
    await vi.waitFor(() => expect(view.findAll('input[type="checkbox"]')).toHaveLength(3))
    await view.findAll('input[type="checkbox"]')[1]!.setValue(true)
    finishPrevious([200, envelope(completed)])
    await vi.waitFor(() => expect(view.text()).toContain('下载上次插画 EPUB'))
    expect(
      view
        .findAll<HTMLInputElement>('input[type="checkbox"]')
        .map((field) => field.element.checked),
    ).toEqual([false, true, false])
    expect(mock.history.post).toHaveLength(0)
  })
  it.each(['QUEUED', 'RUNNING'])(
    'keeps %s locked even when a chapter is UNKNOWN',
    async (status) => {
      save(run.id)
      mock.onGet(catalogUrl).reply(200, envelope(catalog))
      mock.onGet('/v1/illustration-conversions/run-123').reply(
        200,
        envelope({
          ...run,
          status,
          chapters: [{ ...run.chapters[0], status: 'UNKNOWN' }, run.chapters[1]],
          counts: { ...run.counts, completed: 1, unknown: 1 },
        }),
      )
      const view = mountPage()
      await vi.waitFor(() => expect(view.text()).toContain('结果待确认'))
      expect(view.findAll('button').some((entry) => entry.text() === '重新选择章节')).toBe(false)
      expect(
        view
          .findAll('input[type="checkbox"]')
          .every((field) => field.attributes('disabled') !== undefined),
      ).toBe(true)
      expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
      expect(mock.history.post).toHaveLength(0)
    },
  )
  it('recovers a lost submission response through lookup without another paid POST', async () => {
    const view = mountPage()
    await uploadAndChoose(view)
    mock.onPost(createUrl).timeoutOnce()
    mock.onGet(lookupUrl).reply(200, envelope(completed))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.find('.upload-download[href]').exists()).toBe(true))
    expect(mock.history.post.filter((entry) => entry.url === createUrl)).toHaveLength(1)
    const lookup = mock.history.get.find((entry) => entry.url === lookupUrl)!
    const saved = JSON.parse(sessionStorage.getItem(savedKey)!)
    expect(lookup.params).toEqual({ requestKey: saved.submission.key })
    expect(Object.keys(saved).sort()).toEqual(['receipt', 'runId', 'submission'])
    expect(Object.keys(saved.submission).sort()).toEqual(['input', 'key'])
    expect(view.text()).not.toContain('请求超时')
  })
  it('keeps an uncertain selection locked when lookup finds nothing, even after reopening', async () => {
    save(null)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet(lookupUrl).reply(200, envelope(null))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('暂未查到已创建的任务'))
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(view.findAll('button').some((entry) => entry.text() === '重新选择章节')).toBe(false)
    expect(
      view
        .findAll('input[type="checkbox"]')
        .every((field) => field.attributes('disabled') !== undefined),
    ).toBe(true)
    await button(view, '继续查询提交结果').trigger('click')
    await vi.waitFor(() =>
      expect(mock.history.get.filter((entry) => entry.url === lookupUrl)).toHaveLength(2),
    )
    expect(mock.history.post).toHaveLength(0)
  })
  it('releases selection after a definite rejected submission and permits correction', async () => {
    const view = mountPage()
    await uploadAndChoose(view)
    mock.onPost(createUrl).reply(400, {
      error: { code: 'VALIDATION_ERROR', message: 'private key' },
      meta: { requestId: 'rejected-123' },
    })
    await button(view, '开始转换').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('rejected-123'))
    expect(view.text()).not.toContain('private key')
    expect(view.findAll('input[type="checkbox"]')[0]!.attributes('disabled')).toBeUndefined()
    expect(JSON.parse(sessionStorage.getItem(savedKey)!).submission).toBeNull()
    expect(mock.history.get.some((request) => request.url === lookupUrl)).toBe(false)
  })
  it('stops polling after query errors and resumes only read requests', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(500, {
      error: { code: 'INTERNAL_ERROR', message: 'private /path' },
      meta: { requestId: 'query-123' },
    })
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('query-123'))
    expect(view.text()).not.toContain('private /path')
    expect(view.find('.upload-download[href]').exists()).toBe(false)
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(completed))
    await button(view, '恢复进度查询').trigger('click')
    await vi.waitFor(() => expect(view.find('.upload-download[href]').exists()).toBe(true))
    expect(mock.history.post).toHaveLength(0)
  })
  it('explains a format preflight rejection without suggesting a blind retry', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(
      200,
      envelope({
        ...run,
        status: 'FAILED',
        stage: 'assemble',
        error: { code: 'CONVERSION_NO_IMAGES', message: 'private /path' },
        chapters: run.chapters.map((chapter) => ({
          ...chapter,
          status: 'FAILED',
          error: { code: 'ILLUSTRATION_PREFLIGHT_INVALID', message: 'private /path' },
        })),
        counts: { ...run.counts, completed: 2, failed: 2 },
      }),
    )
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('原书未通过配图前的格式检查'))
    expect(view.text()).toContain('可点击上传区重新选择 EPUB')
    expect(view.text()).not.toContain('private /path')
    expect(view.text()).not.toContain('请求失败，请稍后重试')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeUndefined()
    expect(button(view, '开始转换').attributes('disabled')).toBeDefined()
    expect(mock.history.post).toHaveLength(0)
  })
  it('does not claim cancellation before a terminal server state', async () => {
    save(run.id)
    mock.onGet(catalogUrl).reply(200, envelope(catalog))
    mock.onGet('/v1/illustration-conversions/run-123').reply(200, envelope(run))
    mock.onPost('/v1/illustration-conversions/run-123/cancel').reply(200, envelope(run))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('停止本次转换'))
    await button(view, '停止本次转换').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('等待后台停止'))
    expect(view.text()).not.toContain('这次转换已停止')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(button(view, '等待后台停止').attributes('disabled')).toBeDefined()
  })
})
