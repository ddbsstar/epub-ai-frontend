import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import entryHtml from '../../index.html?raw'
import { publicErrorMessage } from '@/api/errors'
import { createAppRouter } from '@/router'

describe('English public entry points', () => {
  it('declares English language and useful English metadata before JavaScript loads', () => {
    const source = entryHtml
    const document = new DOMParser().parseFromString(source, 'text/html')
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('EPUB AI · A calmer page, the same book')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'Preserve your original text',
    )
    expect(source).not.toMatch(/\p{Script=Han}/u)
  })

  it('keeps public route titles English, including unknown pages', () => {
    const router = createAppRouter(createMemoryHistory())
    expect(router.resolve('/').meta.title).toBe('EPUB AI · A calmer page, the same book')
    expect(router.resolve('/upload').meta.title).toBe('Format your EPUB · EPUB AI')
    expect(router.resolve('/missing').meta.title).toBe('Page not found · EPUB AI')
  })

  it('explains quotas, network recovery and unsupported books in English without trusting unknown codes', () => {
    expect(publicErrorMessage('OWNER_BOOK_LIMIT')).toContain('retained files expire')
    expect(publicErrorMessage('NETWORK_ERROR')).toContain('resume the progress check')
    expect(publicErrorMessage('FIXED_LAYOUT_EPUB')).toContain('reflowable text book')
    expect(publicErrorMessage('INTERNAL_ERROR')).toBe(
      'The service is temporarily unavailable. Try again later.',
    )
    expect(publicErrorMessage('未经审查的错误内容')).toBe('The request failed. Try again later.')
    expect(publicErrorMessage('__proto__')).toBe('The request failed. Try again later.')
    expect(publicErrorMessage('constructor')).toBe('The request failed. Try again later.')
  })
})
