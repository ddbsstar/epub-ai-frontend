import { createPinia } from 'pinia'

// Client-only state belongs in feature stores here; remote state belongs in Vue Query.
export function createAppPinia() {
  return createPinia()
}
