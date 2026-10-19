# Frontend development

- Use Node.js >=24.15 and `npm ci` with the committed lockfile.
- Keep views in `src/views`, reusable UI in `src/components`, and routing in `src/router`.
- Use TanStack Vue Query for remote state and Pinia for client state. Do not duplicate API cache state in a store.
- Route API calls through `src/api/client.ts`; validate external payloads with Zod. API responses use `{ data, meta: { requestId } }` and `{ error, meta: { requestId } }`.
- Vite variables are public. Never add API keys, database passwords or credentials to browser configuration or storage.
- Preserve the existing visual direction. Clearly distinguish static layout samples from implemented EPUB processing.
- Run `npm run check` before submitting changes. Keep protocol, error, router and query-state tests meaningful.
- Deployment and the same-origin `/api` proxy are documented in `docs/deployment.md`; API routes must never fall back to the SPA's HTML.
