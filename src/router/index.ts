import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'EPUB AI · 让每一本书被好好排版' },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { title: '页面未找到 · EPUB AI' },
      },
    ],
    scrollBehavior: () => ({ top: 0 }),
  })
}
