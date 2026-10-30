import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { mount, type VueWrapper } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import AboutView from './AboutView.vue'

const mock = new MockAdapter(apiClient)
const capabilities = {
  typographyOnly: true,
  uploadMaxMiB: 20,
  retentionHours: 24,
  feedbackAvailable: true,
  feedbackRetentionHours: 24,
}
const receipt = {
  receiptId: '061b66c8-a87d-4700-8092-3811f7d97f5b',
  expiresAt: '2026-10-31T00:00:00.000Z',
}
const envelope = (data: unknown) => ({ data, meta: { requestId: 'feedback-view' } })
let view: VueWrapper | undefined
let client: QueryClient | undefined
function mountPage() {
  client = createQueryClient()
  view = mount(AboutView, { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  return view
}
async function fillRequired(wrapper: VueWrapper) {
  await vi.waitFor(() => expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined())
  await wrapper.get('#feedback-category').setValue('typography')
  await wrapper.get('#feedback-reader').setValue('kindle')
  await wrapper.get('#feedback-route').setValue('usb')
}
afterEach(() => {
  view?.unmount()
  client?.clear()
  mock.reset()
  sessionStorage.clear()
  localStorage.clear()
})

describe('trust page and voluntary private feedback', () => {
  it('explains the actual limits and labels all fields, without pre-filling or attaching private book state', async () => {
    sessionStorage.setItem(
      'epub-typography-processing-v1',
      JSON.stringify({ originalName: 'private-title.epub', runId: 'private-run' }),
    )
    localStorage.setItem('private-book', 'private words and metadata')
    mock.onGet('/v1/capabilities').reply(200, envelope(capabilities))
    mock.onPost('/v1/feedback').reply(201, envelope(receipt))
    const wrapper = mountPage()
    await fillRequired(wrapper)
    expect(wrapper.text()).toContain('up to 20 MiB')
    expect(wrapper.text()).toContain('24 hours after upload')
    expect(wrapper.text()).toContain('physical deletion is not promised at the exact expiry second')
    expect(wrapper.text()).toContain('No email address or account is requested')
    expect(wrapper.text()).toContain('has not yet been verified on a physical Kindle')
    for (const field of wrapper.findAll('input, select, textarea'))
      expect(wrapper.find(`label[for="${field.attributes('id')}"]`).exists()).toBe(true)
    expect(wrapper.get('#feedback-request-id').element).toHaveProperty('value', '')
    expect(wrapper.get('#feedback-description').element).toHaveProperty('value', '')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Your feedback was recorded.'))
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({
      category: 'typography',
      reader: 'kindle',
      deliveryRoute: 'usb',
    })
    expect(wrapper.text()).toContain(receipt.receiptId)
    expect(wrapper.text()).toContain(receipt.expiresAt)
    expect(wrapper.text()).not.toContain('private-title.epub')
    expect(wrapper.text()).not.toContain('private-run')
    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(1)
    expect(mock.history.get.map((request) => request.url)).toEqual(['/v1/capabilities'])
    expect(mock.history.post.map((request) => request.url)).toEqual(['/v1/feedback'])
  })

  it.each([
    { uploadMaxMiB: 20, retentionHours: 24 },
    { ...capabilities, feedbackAvailable: false },
    { ...capabilities, feedbackRetentionHours: undefined },
  ])('does not submit when availability or retention is absent: %j', async (settings) => {
    mock.onGet('/v1/capabilities').reply(200, envelope(settings))
    const wrapper = mountPage()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nothing has been submitted.'))
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(mock.history.post).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Your feedback was recorded.')
  })

  it('keeps capability failure visible and rechecks only on a deliberate click', async () => {
    mock.onGet('/v1/capabilities').replyOnce(503, {
      error: { code: 'INTERNAL_ERROR', message: 'private stack' },
      meta: { requestId: 'caps-failed' },
    })
    mock.onGet('/v1/capabilities').reply(200, envelope(capabilities))
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Feedback cannot be submitted until this check succeeds.'),
    )
    expect(wrapper.text()).not.toContain('private stack')
    expect(mock.history.get).toHaveLength(1)
    await wrapper.get('form').trigger('submit')
    expect(mock.history.post).toHaveLength(0)
    await wrapper.get('button.text-action').trigger('click')
    await fillRequired(wrapper)
    expect(mock.history.get).toHaveLength(2)
  })

  it('validates voluntary fields before submission and never reports an HTTP failure as recorded', async () => {
    mock.onGet('/v1/capabilities').reply(200, envelope(capabilities))
    mock.onPost('/v1/feedback').reply(429, {
      error: { code: 'FEEDBACK_OWNER_LIMIT', message: 'internal feedback data' },
      meta: { requestId: 'feedback-limit' },
    })
    const wrapper = mountPage()
    await fillRequired(wrapper)
    await wrapper.get('#feedback-description').setValue('x'.repeat(1001))
    await wrapper.get('form').trigger('submit')
    expect(mock.history.post).toHaveLength(0)
    expect(wrapper.get('[role="alert"]').text()).toContain('1,000 characters')
    await wrapper
      .get('#feedback-description')
      .setValue('The chapter heading looks too large on my Kindle.')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('has reached the feedback limit'))
    expect(wrapper.text()).not.toContain('internal feedback data')
    expect(wrapper.text()).not.toContain('Your feedback was recorded.')
    expect(mock.history.post).toHaveLength(1)
  })

  it('freezes an unconfirmed submission and explicitly retries the same fields and idempotency key', async () => {
    mock.onGet('/v1/capabilities').reply(200, envelope(capabilities))
    mock.onPost('/v1/feedback').timeoutOnce()
    mock.onPost('/v1/feedback').reply(201, envelope(receipt))
    const wrapper = mountPage()
    await fillRequired(wrapper)
    await wrapper.get('#feedback-description').setValue('A chapter opening feels too large.')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('The submission result is not confirmed.'),
    )
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('Your feedback was recorded.')
    expect(mock.history.post).toHaveLength(1)
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
    await wrapper
      .get('#feedback-description')
      .setValue('A changed draft must not alter the pending payload.')
    await wrapper.get('.feedback-confirmation button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Your feedback was recorded.'))
    expect(mock.history.post).toHaveLength(2)
    expect(mock.history.post[0]!.data).toBe(mock.history.post[1]!.data)
    expect(mock.history.post[0]!.headers?.['Idempotency-Key']).toBe(
      mock.history.post[1]!.headers?.['Idempotency-Key'],
    )
    expect(JSON.parse(mock.history.post[1]!.data).description).toBe(
      'A chapter opening feels too large.',
    )
  })
})
