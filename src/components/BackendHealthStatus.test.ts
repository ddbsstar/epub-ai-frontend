import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { createQueryClient } from '@/plugins/query'
import BackendHealthStatus from './BackendHealthStatus.vue'

const mock = new MockAdapter(apiClient)
let wrapper: VueWrapper | undefined
let queryClient: QueryClient | undefined
const healthyResponse = {
  data: {
    status: 'ok',
    service: 'epub-ai-backend',
    dependencies: { database: 'disabled', qwen: 'configured_not_checked', queue: 'unavailable' },
  },
  meta: { requestId: 'health-123' },
}

function mountStatus() {
  queryClient = createQueryClient()
  wrapper = mount(BackendHealthStatus, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  queryClient?.clear()
  mock.reset()
})

describe('backend health status', () => {
  it('shows loading and then exact dependency states without claiming AI is available', async () => {
    mock.onGet('/health').reply(200, healthyResponse)
    const view = mountStatus()
    expect(view.get('button').attributes('disabled')).toBeDefined()
    expect(view.text()).toContain('正在连接后端')
    await vi.waitFor(() => expect(view.text()).toContain('后端已连接'))
    expect(view.text()).toContain('数据库：未启用')
    expect(view.text()).toContain('千问：已配置 · 未检测')
    expect(view.text()).toContain('任务队列：暂不可用')
    expect(view.text()).toContain('不代表书籍处理或 AI 功能已可用')
  })

  it('refreshes the query and replaces cached success with a safe error', async () => {
    mock.onGet('/health').replyOnce(200, healthyResponse)
    const view = mountStatus()
    await vi.waitFor(() => expect(view.text()).toContain('后端已连接'))
    mock.onGet('/health').reply(500, {
      error: { code: 'INTERNAL_ERROR', message: 'secret stack' },
      meta: { requestId: 'failed-123' },
    })
    await view.get('button').trigger('click')
    await vi.waitFor(() => expect(view.text()).toContain('后端暂未连接'))
    expect(view.text()).toContain('请求编号：failed-123')
    expect(view.text()).not.toContain('secret stack')
    expect(view.find('[aria-label="后端依赖状态"]').exists()).toBe(false)
    expect(mock.history.get).toHaveLength(2)
  })

  it('does not treat a malformed health payload as a successful connection', async () => {
    mock.onGet('/health').reply(200, {
      ...healthyResponse,
      data: { ...healthyResponse.data, dependencies: { database: 'imaginary-state' } },
    })
    const view = mountStatus()
    await flushPromises()
    await vi.waitFor(() => expect(view.text()).toContain('后端暂未连接'))
    expect(view.text()).toContain('服务返回的数据格式异常')
  })
})
