import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { mount, type VueWrapper } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import UploadView from './UploadView.vue'

const mock = new MockAdapter(apiClient)
const receipt = {
  id: 'upload-123',
  bookId: 'book-123',
  originalName: '山间来信.epub',
  byteSize: 6,
  sha256: 'a'.repeat(64),
}
const run = {
  id: 'run-123',
  bookId: receipt.bookId,
  status: 'RUNNING',
  stage: 'process',
  completedUnits: 0,
  totalUnits: 3,
  originalName: receipt.originalName,
  title: '山间来信',
  artifacts: { epub: null, report: null, cover: null },
  summary: null,
  warnings: [],
  error: null,
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
}
const typography = {
  profile: 'editorial-1',
  totalParagraphs: 100,
  styledParagraphs: 90,
  preservedParagraphs: 10,
  styledHeadings: 7,
  roleCounts: { body: 70, opening: 5, quote: 5, poem: 5, caption: 3, note: 2, separator: 4 },
}
const finished = {
  ...run,
  status: 'SUCCEEDED',
  stage: 'publish',
  completedUnits: 3,
  artifacts: {
    epub: '/api/v1/artifacts/export-123/download',
    report: '/api/v1/artifacts/report-123/download',
    cover: '/api/v1/artifacts/cover-123/download',
  },
  summary: {
    chapters: 10,
    styledChapters: 8,
    preservedChapters: 2,
    bodyBytesPreserved: true,
    formatErrors: 0,
    formatWarnings: 0,
    typography,
  },
}
const key = '31bc61a8-fc9d-47af-a740-d2594c4a6742'
const storageKey = 'epub-typography-processing-v1'
const createUrl = '/v1/books/book-123/exports'
const getUrl = '/v1/runs/run-123'
const envelope = (data: unknown) => ({ data, meta: { requestId: 'test-typography' } })
let wrapper: VueWrapper | undefined
let queryClient: QueryClient | undefined
function mountPage() {
  queryClient = createQueryClient()
  wrapper = mount(UploadView, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return wrapper
}
function save(runId: string | null, submitted = true) {
  sessionStorage.setItem(storageKey, JSON.stringify({ receipt, key, runId, submitted }))
}
function button(view: VueWrapper, label: string) {
  const result = view.findAll('button').find((entry) => entry.text() === label)
  if (!result) throw new Error(`Missing button ${label}`)
  return result
}
async function chooseFile(view: VueWrapper, file = new File(['sample'], receipt.originalName)) {
  const field = view.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(field.element, 'files', { configurable: true, value: [file] })
  await field.trigger('change')
}
afterEach(() => {
  wrapper?.unmount()
  queryClient?.clear()
  mock.reset()
  sessionStorage.clear()
})

describe('explicit no-model typography workflow', () => {
  it('opens empty without requests and leaves all legacy task references untouched', () => {
    const oldConversion = JSON.stringify({ old: 'illustration-reference' })
    sessionStorage.setItem('epub-book-conversion-v1', oldConversion)
    sessionStorage.setItem('epub-active-run-v1', 'old-ai-run')
    const view = mountPage()
    expect(view.text()).toContain('Your next read is waiting')
    expect(view.text()).toContain('No model calls')
    expect(view.find('.chapter-selection').exists()).toBe(false)
    expect(view.find('.chapter-gallery').exists()).toBe(false)
    expect(button(view, 'Start formatting').attributes('disabled')).toBeDefined()
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
    expect(mock.history.get).toHaveLength(0)
    expect(mock.history.post).toHaveLength(0)
    expect(sessionStorage.getItem('epub-book-conversion-v1')).toBe(oldConversion)
    expect(sessionStorage.getItem('epub-active-run-v1')).toBe('old-ai-run')
  })
  it('uploads only, starts on an explicit click, polls real stages and exposes original cover and coverage downloads', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    mock.onPost(createUrl).reply(202, envelope(run))
    mock.onGet(getUrl).replyOnce(200, envelope({ ...run, stage: 'validate', completedUnits: 1 }))
    mock.onGet(getUrl).reply(200, envelope(finished))
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.text()).toContain('Book uploaded. Select Start formatting'))
    expect(view.text()).toContain(receipt.originalName)
    expect(button(view, 'Start formatting').attributes('disabled')).toBeUndefined()
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
    expect(mock.history.get).toHaveLength(0)
    await button(view, 'Start formatting').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('Checking format and original content'))
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    await vi.waitFor(() => expect(view.find('a.upload-download').exists()).toBe(true), {
      timeout: 3500,
    })
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({ theme: 'reader-editorial' })
    expect(mock.history.post).toHaveLength(2)
    expect(mock.history.get.every((request) => request.url === getUrl)).toBe(true)
    expect(view.get('a.upload-download').attributes('href')).toBe(finished.artifacts.epub)
    expect(view.get('.upload-cover-image').attributes('src')).toBe(finished.artifacts.cover)
    expect(view.get('[aria-label="Typography coverage"]').text()).toContain(
      '8body documents styled',
    )
    expect(view.text()).toContain('90 styled')
    expect(view.text()).toContain('10 unchanged')
    expect(view.text()).toContain('7 headings styled')
    expect(view.text()).toContain('Original cover · Unchanged')
    expect(
      view
        .findAll('a')
        .find((entry) => entry.text() === 'Download typography report')
        ?.attributes('href'),
    ).toBe(finished.artifacts.report)
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('3')
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).runId).toBe(run.id)
  })
  it('restores an uploaded file reference without starting a task automatically', async () => {
    save(null, false)
    const view = mountPage()
    expect(view.text()).toContain(receipt.originalName)
    expect(button(view, 'Start formatting').attributes('disabled')).toBeUndefined()
    expect(mock.history.get).toHaveLength(0)
    expect(mock.history.post).toHaveLength(0)
  })
  it('keeps a long original filename and non-English title intact within the English workflow', async () => {
    const originalName = `${'An extremely long original filename '.repeat(8)}原书.epub`
    mock.onPost('/v1/uploads').reply(201, envelope({ ...receipt, originalName }))
    const view = mountPage()
    await chooseFile(view, new File(['sample'], originalName))
    await vi.waitFor(() => expect(view.get('.upload-drop-title').text()).toBe(originalName))
    expect(view.get('.upload-cover-title').text()).toBe(originalName.replace(/\.epub$/u, ''))
    expect(view.get('figure').attributes('aria-label')).toBe(
      `Book cover: ${originalName.replace(/\.epub$/u, '')}`,
    )
    expect(view.get('input[type="file"]').attributes('aria-label')).toBe('Choose an EPUB file')
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
  })
  it('shows an English safe fallback and request ID for an unknown server error without its Chinese raw text', async () => {
    mock.onPost('/v1/uploads').reply(503, {
      error: {
        code: 'FUTURE_SERVER_FAILURE',
        message: '内部错误：数据库密码与原书路径不可公开',
        details: { privatePath: '/private/book.epub' },
      },
      meta: { requestId: 'english-fallback-123' },
    })
    const view = mountPage()
    await chooseFile(view)
    await vi.waitFor(() => expect(view.find('[role="alert"]').exists()).toBe(true))
    const alert = view.get('[role="alert"]').text()
    expect(alert).toContain('The request failed. Try again later.')
    expect(alert).toContain('Request ID: english-fallback-123')
    expect(alert).not.toMatch(/\p{Script=Han}/u)
    expect(alert).not.toContain('/private/book.epub')
    expect(mock.history.post).toHaveLength(1)
  })
  it('restores a known task through GET only and reports zero styling honestly', async () => {
    save(run.id)
    mock.onGet(getUrl).reply(
      200,
      envelope({
        ...finished,
        summary: {
          ...finished.summary,
          styledChapters: 0,
          preservedChapters: 10,
          typography: {
            ...typography,
            styledParagraphs: 0,
            preservedParagraphs: 100,
            styledHeadings: 0,
            roleCounts: {
              body: 0,
              opening: 0,
              quote: 0,
              poem: 0,
              caption: 0,
              note: 0,
              separator: 0,
            },
          },
        },
      }),
    )
    const view = mountPage()
    await vi.waitFor(() =>
      expect(view.text()).toContain('No new typography was applied to this book'),
    )
    expect(view.text()).toContain('0 body documents received new styles')
    expect(view.text()).toContain('A successful export does not mean the appearance changed')
    expect(view.find('a.upload-download').exists()).toBe(true)
    expect(mock.history.post).toHaveLength(0)
    expect(mock.history.get.map((request) => request.url)).toEqual([getUrl])
  })
  it('locks a timed-out creation and confirms only with the same explicit book and idempotency key', async () => {
    save(null, false)
    mock.onPost(createUrl).timeoutOnce()
    mock.onPost(createUrl).reply(202, envelope(finished))
    mock.onGet(getUrl).reply(200, envelope(finished))
    const view = mountPage()
    await button(view, 'Start formatting').trigger('click')
    await vi.waitFor(() =>
      expect(view.text()).toContain('Your previous submission is not confirmed yet'),
    )
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(button(view, 'Start formatting').attributes('disabled')).toBeDefined()
    expect(mock.history.post).toHaveLength(1)
    await chooseFile(view, new File(['other'], '另一册.epub'))
    expect(mock.history.post).toHaveLength(1)
    await button(view, 'Check previous submission').trigger('click')
    await vi.waitFor(() => expect(view.find('a.upload-download').exists()).toBe(true))
    expect(mock.history.post.map((request) => request.headers?.['Idempotency-Key'])).toEqual([
      key,
      key,
    ])
    expect(
      mock.history.post.every(
        (request) =>
          request.url === createUrl && JSON.parse(request.data).theme === 'reader-editorial',
      ),
    ).toBe(true)
  })
  it('keeps an unknown saved submission inert after refresh until explicit confirmation', async () => {
    save(null)
    mock.onPost(createUrl).reply(202, envelope(finished))
    mock.onGet(getUrl).reply(200, envelope(finished))
    const view = mountPage()
    expect(view.text()).toContain('Your previous submission is not confirmed yet')
    expect(mock.history.get).toHaveLength(0)
    expect(mock.history.post).toHaveLength(0)
    await button(view, 'Check previous submission').trigger('click')
    await vi.waitFor(() => expect(view.find('a.upload-download').exists()).toBe(true))
    expect(mock.history.post[0]!.headers?.['Idempotency-Key']).toBe(key)
  })
  it('recovers progress-query failure using GET without resubmission or reupload', async () => {
    save(run.id)
    mock.onGet(getUrl).replyOnce(500, {
      error: { code: 'INTERNAL_ERROR', message: 'private upstream detail' },
      meta: { requestId: 'query-failed' },
    })
    mock.onGet(getUrl).reply(200, envelope(finished))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('Progress is temporarily unavailable'))
    expect(view.text()).not.toContain('private upstream detail')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    await button(view, 'Resume progress check').trigger('click')
    await vi.waitFor(() => expect(view.find('a.upload-download').exists()).toBe(true))
    expect(mock.history.get).toHaveLength(2)
    expect(mock.history.post).toHaveLength(0)
  })
  it('preserves a known failed task and permits a fresh upload instead of silently retrying it', async () => {
    save(run.id)
    mock.onGet(getUrl).reply(
      200,
      envelope({
        ...run,
        status: 'FAILED',
        error: { code: 'MISSING_RESOURCE', message: 'private path and raw response' },
      }),
    )
    const view = mountPage()
    await vi.waitFor(() =>
      expect(view.text()).toContain('This formatting task could not be completed'),
    )
    expect(view.text()).toContain('A book resource reference is broken or missing')
    expect(view.text()).not.toContain('private path')
    expect(view.find('a.upload-download').exists()).toBe(false)
    expect(view.get('input[type="file"]').attributes('disabled')).toBeUndefined()
    expect(mock.history.post).toHaveLength(0)
  })
  it('waits for server cancellation and never reports a terminal state prematurely', async () => {
    save(run.id)
    mock.onGet(getUrl).reply(200, envelope(run))
    mock.onPost(`${getUrl}/cancel`).reply(200, envelope(run))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('Stop formatting'))
    await button(view, 'Stop formatting').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('Waiting for the server to stop'))
    expect(view.text()).not.toContain('This formatting task has stopped')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(mock.history.post.map((request) => request.url)).toEqual([`${getUrl}/cancel`])
  })
  it('clears only an explicitly unavailable task when the user chooses another book', async () => {
    save(run.id)
    mock.onGet(getUrl).reply(404, {
      error: { code: 'RUN_NOT_FOUND', message: 'missing' },
      meta: { requestId: 'missing-run' },
    })
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('Choose another book'))
    await button(view, 'Choose another book').trigger('click')
    expect(view.get('input[type="file"]').attributes('disabled')).toBeUndefined()
    expect(sessionStorage.getItem(storageKey)).toBeNull()
    expect(mock.history.post).toHaveLength(0)
  })
  it('rejects mismatched restored tasks instead of displaying another book or allowing a new upload', async () => {
    save(run.id)
    mock.onGet(getUrl).reply(200, envelope({ ...finished, bookId: 'different-book' }))
    const view = mountPage()
    await vi.waitFor(() => expect(view.text()).toContain('Progress is temporarily unavailable'))
    expect(view.find('a.upload-download').exists()).toBe(false)
    expect(view.get('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(view.findAll('button').some((entry) => entry.text() === 'Choose another book')).toBe(
      false,
    )
    expect(mock.history.post).toHaveLength(0)
  })
  it('accepts a single dropped EPUB without starting and rejects a wrong-format input before upload', async () => {
    mock.onPost('/v1/uploads').reply(201, envelope(receipt))
    const view = mountPage()
    await chooseFile(view, new File(['text'], 'notes.txt'))
    expect(view.text()).toContain('Choose a file in EPUB format')
    expect(mock.history.post).toHaveLength(0)
    await view
      .get('.upload-dropzone')
      .trigger('drop', { dataTransfer: { files: [new File(['sample'], receipt.originalName)] } })
    await vi.waitFor(() => expect(view.text()).toContain('Book uploaded. Select Start formatting'))
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/uploads'])
    expect(mock.history.get).toHaveLength(0)
  })
})
