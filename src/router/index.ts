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
        meta: { title: 'EPUB AI · 让喜欢的书更漂亮、更统一' },
      },
      {
        path: '/upload',
        name: 'upload',
        component: () => import('@/views/UploadView.vue'),
        meta: { title: '开始美化 · EPUB AI' },
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: '/illustrate',
              name: 'illustrate',
              component: () => import('@/views/IllustrationView.vue'),
              meta: { title: '插画实验 · EPUB AI' },
            },
          ]
        : []),
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
