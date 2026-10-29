import { VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import UploadView from './UploadView.vue'

vi.mock('@/config/env', () => ({
  publicEnv: { apiBaseUrl: '/api', publicBeta: true, uploadMaxMiB: 20 },
}))

const mock = new MockAdapter(apiClient)
afterEach(() => {
  mock.reset()
  sessionStorage.clear()
})

describe('public typography beta', () => {
  it('discloses retention before selection and refuses a beta-oversized file without sending it', async () => {
    const queryClient = createQueryClient()
    const wrapper = mount(UploadView, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    try {
      expect(wrapper.text()).toContain('公开试用')
      expect(wrapper.text()).toContain('最大 20 MiB')
      expect(wrapper.text()).toContain('上传 24 小时后自动删除')
      const file = new File(['x'], 'large.epub')
      Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 })
      const field = wrapper.get<HTMLInputElement>('input[type="file"]')
      Object.defineProperty(field.element, 'files', { configurable: true, value: [file] })
      await field.trigger('change')
      expect(wrapper.get('[role="alert"]').text()).toContain('文件超过 20 MiB')
      expect(mock.history.post).toHaveLength(0)
      expect(mock.history.get).toHaveLength(0)
    } finally {
      wrapper.unmount()
      queryClient.clear()
    }
  })
})
