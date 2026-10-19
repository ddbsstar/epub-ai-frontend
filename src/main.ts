import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import { createAppRouter } from '@/router'
import { createAppPinia } from '@/stores'
import { createQueryClient } from '@/plugins/query'

const router = createAppRouter()
router.afterEach((to) => {
  document.title = typeof to.meta.title === 'string' ? to.meta.title : 'EPUB AI'
})

createApp(App)
  .use(createAppPinia())
  .use(router)
  .use(VueQueryPlugin, { queryClient: createQueryClient() })
  .mount('#app')
