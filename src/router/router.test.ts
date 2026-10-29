import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, RouterView } from 'vue-router'
import App from '@/App.vue'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import { createAppRouter } from './index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('page routing', () => {
  it('excludes the illustration experiment from production routes and keeps it available in development', () => {
    vi.stubEnv('DEV', false)
    expect(createAppRouter(createMemoryHistory()).resolve('/illustrate').name).toBe('not-found')
    vi.stubEnv('DEV', true)
    expect(createAppRouter(createMemoryHistory()).resolve('/illustrate').name).toBe('illustrate')
  })

  it('renders an unknown path and provides a working way back home', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const mock = new MockAdapter(apiClient)
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
      expect(wrapper.text()).toContain('更漂亮，更统一。')
      expect(wrapper.text()).toContain('当前提供一套统一排版')
      expect(wrapper.text()).not.toContain('AI 识别')
      expect(wrapper.text()).not.toContain('选一种风格')
      expect(mock.history.get).toHaveLength(0)
    } finally {
      wrapper.unmount()
      queryClient.clear()
      mock.restore()
    }
  })

  it('opens the empty upload page from home and returns through its breadcrumb without API calls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const mock = new MockAdapter(apiClient)
    const router = createAppRouter(createMemoryHistory())
    const queryClient = createQueryClient()
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    })
    try {
      await wrapper.get('a.epub-primary').trigger('click')
      await flushPromises()
      await vi.waitFor(() => {
        expect(router.currentRoute.value.name).toBe('upload')
        expect(wrapper.text()).toContain('下一本好看的书，')
      })
      expect(wrapper.findAll('main')).toHaveLength(1)
      expect(wrapper.get('.epub-breadcrumb [aria-current="page"]').text()).toBe('开始美化')
      expect(wrapper.find('input[type="file"]').exists()).toBe(true)
      expect(wrapper.get('.upload-download').attributes('disabled')).toBeDefined()

      await wrapper.get('.epub-breadcrumb a').trigger('click')
      await flushPromises()
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
      expect(wrapper.text()).toContain('更漂亮，更统一。')
      expect(mock.history.get).toHaveLength(0)
      expect(mock.history.post).toHaveLength(0)
    } finally {
      wrapper.unmount()
      queryClient.clear()
      mock.restore()
    }
  })
})
