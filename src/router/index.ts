import { copy } from '@/content/en'
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
        meta: { title: copy.homePageTitle },
      },
      {
        path: '/upload',
        name: 'upload',
        component: () => import('@/views/UploadView.vue'),
        meta: { title: copy.uploadPageTitle },
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: '/illustrate',
              name: 'illustrate',
              component: () => import('@/views/IllustrationView.vue'),
              meta: { title: copy.labPageTitle },
            },
          ]
        : []),
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { title: copy.notFoundPageTitle },
      },
    ],
    scrollBehavior: () => ({ top: 0 }),
  })
}
