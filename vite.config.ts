import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { z } from 'zod'
import { parsePublicEnv } from './src/config/public-env.ts'

export default defineConfig(({ mode }) => {
  parsePublicEnv(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          // DEV_ variables are evaluated in Node and never exposed via import.meta.env.
          target: z
            .url()
            .refine(
              (value) => ['http:', 'https:'].includes(new URL(value).protocol),
              '开发代理必须使用 HTTP 或 HTTPS',
            )
            .parse(
              loadEnv(mode, process.cwd(), 'DEV_').DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
            ),
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      restoreMocks: true,
      clearMocks: true,
    },
  }
})
