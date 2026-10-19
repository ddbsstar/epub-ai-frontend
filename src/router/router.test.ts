import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, RouterView } from 'vue-router'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import { createAppRouter } from './index'

afterEach(() => vi.restoreAllMocks())

describe('404 route', () => {
  it('renders an unknown path and provides a working way back home', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const mock = new MockAdapter(apiClient)
    mock.onGet('/health').reply(200, {
      data: {
        status: 'ok',
        service: 'epub-ai-backend',
        dependencies: { database: 'disabled', qwen: 'disabled' },
      },
      meta: { requestId: 'route-123' },
    })
    const router = createAppRouter(createMemoryHistory())
    const queryClient = createQueryClient()
    await router.push('/a-page-that-does-not-exist')
    await router.isReady()
    const wrapper = mount(RouterView, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    })
    try {
      expect(wrapper.text()).toContain('这一页，还没有写下。')
      await wrapper.get('a').trigger('click')
      await flushPromises()
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
      expect(wrapper.text()).toContain('被好好排版。')
    } finally {
      wrapper.unmount()
      queryClient.clear()
      mock.restore()
    }
  })
})
