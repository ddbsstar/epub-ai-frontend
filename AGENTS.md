# Frontend development

- Use Node.js >=24.15 and `npm ci` with the committed lockfile.
- Keep views in `src/views`, reusable UI in `src/components`, and routing in `src/router`.
- Use TanStack Vue Query for remote state and Pinia for client state. Do not duplicate API cache state in a store.
- Route API calls through `src/api/client.ts`; validate external payloads with Zod. API responses use `{ data, meta: { requestId } }` and `{ error, meta: { requestId } }`.
- Vite variables are public. Never add API keys, database passwords or credentials to browser configuration or storage.
- Preserve the existing visual direction. Clearly distinguish static layout samples from implemented EPUB processing.
- Run `npm run check` before submitting changes. Keep protocol, error, router and query-state tests meaningful.
- Deployment and the same-origin `/api` proxy are documented in `docs/deployment.md`; API routes must never fall back to the SPA's HTML.

## Public typography beta

2026-10-29: Public trial is https://epub.199.30.89.47.sslip.io/ on the shared server with Caddy serving dist and same-origin API. Production build uses VITE_PUBLIC_BETA=true,20MiB uploads,24h retention; no model/illustration trial routes/chunks. Preserve local experiments in development. Include public/licenses OFL files with font distribution. Backend actual operations are documented in its docs/public-beta-deployment.md. No formal login, cross-browser recovery or device fidelity is promised. Current checked build deployed without Git commit/push.
