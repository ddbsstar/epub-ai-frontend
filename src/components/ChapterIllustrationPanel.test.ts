import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { mount, type VueWrapper } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import ChapterIllustrationPanel from './ChapterIllustrationPanel.vue'

const mock = new MockAdapter(apiClient)
const plan = {
  id: 'plan-123',
  bookId: 'book-123',
  kind: 'plan',
  planId: null,
  exportId: null,
  status: 'RUNNING',
  stage: 'plan',
  chapterIndex: 0,
  chapterTitle: '第一章',
  concept: null,
  prompt: null,
  alt: null,
  artifacts: { image: null, epub: null, report: null },
  error: null,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
}
const ready = {
  ...plan,
  status: 'SUCCEEDED',
  concept: '用留白表现清晨的安静。',
  prompt: '雪山远处有鸟，画面保持克制。',
  alt: '雪山与鸟',
}
const queuedExport = {
  ...plan,
  id: 'export-123',
  kind: 'export',
  planId: 'plan-123',
  exportId: 'export-123',
  stage: 'generate',
  prompt: '编辑后的画面',
  alt: '编辑后的说明',
}
const doneExport = {
  ...queuedExport,
  status: 'SUCCEEDED',
  stage: 'publish',
  artifacts: {
    image: '/api/v1/artifacts/image-123/download',
    epub: '/api/v1/artifacts/book-123/download',
    report: '/api/v1/artifacts/report-123/download',
  },
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'illustration-test' } })
let wrapper: VueWrapper | undefined
let queryClient: QueryClient | undefined
function mountPanel() {
  queryClient = createQueryClient()
  wrapper = mount(ChapterIllustrationPanel, {
    props: { bookId: 'book-123' },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}
function button(view: VueWrapper, label: string) {
  const found = view.findAll('button').find((candidate) => candidate.text().includes(label))
  if (!found) throw new Error(`Button not found: ${label}`)
  return found
}
function save(planId = 'plan-123', exportId: string | null = null) {
  sessionStorage.setItem(
    'epub-illustration-active-v1',
    JSON.stringify({ bookId: 'book-123', chapterIndex: 0, planId, exportId }),
  )
}
afterEach(() => {
  wrapper?.unmount()
  queryClient?.clear()
  mock.reset()
  sessionStorage.clear()
})

describe('explicit chapter illustration workflow', () => {
  it('does not plan or generate on opening an empty panel and shows no pretend image', () => {
    const view = mountPanel()
    expect(view.text()).toContain('章节插画')
    expect(view.get<HTMLInputElement>('#illustration-chapter').element.value).toBe('1')
    expect(view.find('img').exists()).toBe(false)
    expect(mock.history.get).toHaveLength(0)
    expect(mock.history.post).toHaveLength(0)
  })

  it('plans only on click, allows review, then displays the real private image and both downloads', async () => {
    mock
      .onPost('/v1/books/book-123/illustrations/plan')
      .reply(202, envelope({ ...plan, status: 'QUEUED' }))
    mock.onGet('/v1/illustrations/plan-123').reply(200, envelope(plan))
    const view = mountPanel()
    await button(view, '规划插画').trigger('submit')
    await vi.waitFor(() => expect(view.text()).toContain('正在理解章节与规划画面'))
    expect(button(view, '读取本章方案').attributes('disabled')).toBeDefined()
    expect(mock.history.post).toHaveLength(1)
    mock.onGet('/v1/illustrations/plan-123').reply(200, envelope(ready))
    await queryClient!.refetchQueries({ queryKey: ['illustration-plan'] })
    await vi.waitFor(() =>
      expect(view.get<HTMLTextAreaElement>('#illustration-prompt').element.value).toBe(
        ready.prompt,
      ),
    )
    expect(view.text()).toContain(ready.concept)
    await view.get('#illustration-prompt').setValue('编辑后的画面')
    await view.get('#illustration-alt').setValue('编辑后的说明')
    mock.onPost('/v1/illustrations/plan-123/generate').reply(202, envelope(queuedExport))
    mock.onGet('/v1/illustrations/export-123').reply(200, envelope(queuedExport))
    await view.get('form.illustration-review').trigger('submit')
    await vi.waitFor(() => expect(view.text()).toContain('正在生成插画'))
    expect(JSON.parse(mock.history.post[1]!.data as string)).toEqual({
      prompt: '编辑后的画面',
      alt: '编辑后的说明',
    })
    expect(view.find('img').exists()).toBe(false)
    mock.onGet('/v1/illustrations/export-123').reply(200, envelope(doneExport))
    await queryClient!.refetchQueries({ queryKey: ['illustration-export'] })
    await vi.waitFor(() =>
      expect(view.get('img').attributes('src')).toBe(doneExport.artifacts.image),
    )
    expect(view.get('img').attributes('alt')).toBe('编辑后的说明')
    expect(view.find('.illustration-review').exists()).toBe(false)
    expect(view.findAll('a').map((link) => link.attributes('href'))).toEqual(
      expect.arrayContaining([doneExport.artifacts.epub, doneExport.artifacts.report]),
    )
    const saved = JSON.parse(sessionStorage.getItem('epub-illustration-active-v1')!) as Record<
      string,
      unknown
    >
    expect(Object.keys(saved).sort()).toEqual(['bookId', 'chapterIndex', 'exportId', 'planId'])
    expect(JSON.stringify(saved)).not.toContain('编辑后的')
  })

  it('restores a completed illustration after refresh using GET only', async () => {
    save('plan-123', 'export-123')
    mock
      .onGet('/v1/illustrations/plan-123')
      .reply(200, envelope({ ...ready, exportId: 'export-123' }))
    mock.onGet('/v1/illustrations/export-123').reply(200, envelope(doneExport))
    const view = mountPanel()
    await vi.waitFor(() => expect(view.find('img').exists()).toBe(true))
    expect(view.text()).toContain('插画已加入书中')
    expect(mock.history.post).toHaveLength(0)
  })

  it('recovers a lost generation response through the plan canonical child without another paid POST', async () => {
    save()
    mock.onGet('/v1/illustrations/plan-123').reply(200, envelope(ready))
    const view = mountPanel()
    await vi.waitFor(() => expect(view.find('.illustration-review').exists()).toBe(true))
    mock.onPost('/v1/illustrations/plan-123/generate').timeoutOnce()
    await view.get('form.illustration-review').trigger('submit')
    await vi.waitFor(() => expect(view.text()).toContain('生图提交结果尚未确认'))
    expect(view.get('#illustration-prompt').attributes('disabled')).toBeDefined()
    mock
      .onGet('/v1/illustrations/plan-123')
      .reply(200, envelope({ ...ready, exportId: 'export-123' }))
    mock.onGet('/v1/illustrations/export-123').reply(200, envelope(doneExport))
    await button(view, '恢复插画查询').trigger('click')
    await vi.waitFor(() => expect(view.find('img').exists()).toBe(true))
    expect(view.find('[role="alert"]').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(1)
  })

  it('replaces a lost submission error with the recovered failed job error', async () => {
    save()
    mock.onGet('/v1/illustrations/plan-123').reply(200, envelope(ready))
    const view = mountPanel()
    await vi.waitFor(() => expect(view.find('.illustration-review').exists()).toBe(true))
    mock.onPost('/v1/illustrations/plan-123/generate').timeoutOnce()
    await view.get('form.illustration-review').trigger('submit')
    await vi.waitFor(() => expect(view.text()).toContain('生图提交结果尚未确认'))
    mock
      .onGet('/v1/illustrations/plan-123')
      .reply(200, envelope({ ...ready, exportId: 'export-123' }))
    mock.onGet('/v1/illustrations/export-123').reply(
      200,
      envelope({
        ...queuedExport,
        status: 'FAILED',
        error: { code: 'IMAGE_UNKNOWN_OUTCOME', message: 'private upstream error' },
      }),
    )
    await button(view, '恢复插画查询').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('图片结果尚未确认'))
    expect(view.get('[role="alert"]').text()).not.toContain('生图提交结果尚未确认')
    expect(view.text()).not.toContain('private upstream error')
    expect(view.find('img').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(1)
  })

  it('keeps failed model messages private and never enables image or download controls', async () => {
    save()
    mock.onGet('/v1/illustrations/plan-123').reply(
      200,
      envelope({
        ...plan,
        status: 'FAILED',
        error: { code: 'ILLUSTRATION_DECLINED', message: 'secret prompt /private/path' },
      }),
    )
    const view = mountPanel()
    await vi.waitFor(() => expect(view.text()).toContain('暂未找到有充分依据'))
    expect(view.text()).not.toContain('secret prompt')
    expect(view.find('textarea').exists()).toBe(false)
    expect(view.find('img').exists()).toBe(false)
    expect(view.find('a[download]').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
  })

  it('resumes the canonical generated child after a refresh even when no export ID was saved', async () => {
    save()
    mock
      .onGet('/v1/illustrations/plan-123')
      .reply(200, envelope({ ...ready, exportId: 'export-123' }))
    mock.onGet('/v1/illustrations/export-123').reply(200, envelope(doneExport))
    const view = mountPanel()
    await vi.waitFor(() => expect(view.find('img').exists()).toBe(true))
    expect(mock.history.post).toHaveLength(0)
    expect(sessionStorage.getItem('epub-illustration-active-v1')).toContain('export-123')
  })
})
