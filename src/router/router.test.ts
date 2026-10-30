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
  it('provides a public feedback route with a reachable form anchor without accepting arbitrary selectors', () => {
    const router = createAppRouter(createMemoryHistory())
    expect(router.resolve('/about').name).toBe('about')
    expect(router.resolve('/about').meta.title).toBe('About this beta & feedback · EPUB AI')
    const scroll = router.options.scrollBehavior!
    const namedRoute = (url: string) => {
      const route = router.resolve(url)
      if (!route.name) throw new Error('Expected a named route')
      return { ...route, name: route.name }
    }
    expect(scroll(namedRoute('/about#feedback'), namedRoute('/'), null)).toEqual({
      el: '#feedback',
      top: 24,
    })
    expect(scroll(namedRoute('/about#[invalid'), namedRoute('/'), null)).toEqual({ top: 0 })
  })
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
      expect(wrapper.text()).toContain('This page has not been written.')
      await wrapper.get('a').trigger('click')
      await flushPromises()
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
      expect(wrapper.text()).toContain('The same book.')
      expect(wrapper.text()).toContain('One consistent layout')
      expect(wrapper.text()).not.toMatch(/\p{Script=Han}/u)
      expect(wrapper.get('.epub-device-disclaimer').text()).toContain('Design illustration')
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
        expect(wrapper.text()).toContain('Your next read,')
      })
      expect(wrapper.findAll('main')).toHaveLength(1)
      expect(wrapper.get('.epub-breadcrumb [aria-current="page"]').text()).toBe('Format your EPUB')
      expect(wrapper.find('input[type="file"]').exists()).toBe(true)
      expect(wrapper.get('.upload-download').attributes('disabled')).toBeDefined()
      expect(wrapper.text()).not.toMatch(/\p{Script=Han}/u)
      for (const element of wrapper.findAll('[aria-label]'))
        expect(element.attributes('aria-label')).not.toMatch(/\p{Script=Han}/u)

      await wrapper.get('.epub-breadcrumb a').trigger('click')
      await flushPromises()
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
      expect(wrapper.text()).toContain('The same book.')
      expect(mock.history.get).toHaveLength(0)
      expect(mock.history.post).toHaveLength(0)
    } finally {
      wrapper.unmount()
      queryClient.clear()
      mock.restore()
    }
  })
})
