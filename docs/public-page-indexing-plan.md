# Public-page indexing and domain transition

Prepared 2026-10-30 for OS-09. This is an operator plan and measured baseline, not a deployed configuration or a promise of search traffic. The user approved the temporary HTTPS domain for the first trial; no domain purchase is part of this change.

## Actual baseline

External HTTPS checks on `https://epub.199.30.89.47.sslip.io` found:

| Path                                              | Response | Current indexing/cache result                    |
| ------------------------------------------------- | -------- | ------------------------------------------------ |
| `/`                                               | 200 HTML | `X-Robots-Tag: noindex, nofollow`                |
| `/upload`                                         | 200 HTML | Same noindex header                              |
| `/robots.txt`                                     | 200 HTML | SPA fallback, not a valid robots text file       |
| `/sitemap.xml`                                    | 200 HTML | SPA fallback, not a sitemap                      |
| A nonexistent `/api/v1/artifacts/<UUID>/download` | 404 JSON | `private, no-store` and noindex; no SPA fallback |

No production response was changed. English UI and the new `/about` page are pending feature PRs; the currently deployed site is still the previous trial release.

## Proposed route policy

| Route                               | After public-launch acceptance                                                  | Sitemap                      | Access                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `/`                                 | Eligible to index with accurate English metadata and one canonical origin       | Yes                          | Public                                                     |
| `/about`                            | Eligible once the statements match the deployed capabilities                    | Yes                          | Public; feedback form submits separately                   |
| `/upload`                           | Keep noindex                                                                    | No                           | Public shell; private operations require the owner session |
| `/about#feedback`                   | Same document as `/about`; no separate canonical or sitemap entry               | No additional entry          | Public form; receipt contains no public feedback listing   |
| Future real sample page             | Eligible only after rights and actual-reader acceptance                         | Only when actually published | Separate public sample assets                              |
| `/api/*`, private results/downloads | Keep authentication, no-store and noindex                                       | Never                        | Owner or operator only                                     |
| Unknown routes                      | Real 404 for non-SPA assets/manifests; honest client 404 for unknown app routes | Never                        | No private content fallback                                |

Do not remove the current site-wide noindex header until the English release, scope, genuine example and feedback route are ready for public acquisition. When that release is approved, scope response headers explicitly to the selected public pages; do not weaken API/download headers.

`robots.txt` manages crawler access, not confidentiality. A page blocked from crawling may prevent a crawler from seeing its noindex rule. Keep owner authentication as the protection for private files, and let crawlers read the noindex response on public utility pages where needed. [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Generate sitemap entries from an explicit list of approved public routes. Never enumerate uploads, Run IDs, artifact URLs, feedback receipts, capability links, local paths or arbitrary request query strings. Unknown `robots.txt`/`sitemap.xml` must not return the application's HTML as a successful manifest.

## Origin and cookie transition

The current beta accepts one exact public origin and uses a host-bound Secure/HttpOnly session cookie. A new domain does not inherit that cookie. Do not copy cookies across domains, allow wildcard origins, or redirect private download paths to a new host and assume ownership survives.

For the existing one-API deployment, a conservative future cutover is:

1. Confirm the domain and any purchase separately. Prepare TLS, redirects, public canonical URLs and response checks before changing live access.
2. Close new uploads on the old origin with an explicit maintenance response, while keeping existing reads/tasks/downloads available on that same origin. Wait for retained books to expire and active work to finish. The present retention is 24 hours from upload; use actual metadata to check the remaining window.
3. Change the exact allowed origin and public-site configuration in a reviewed release. Validate owner isolation, Secure cookie attributes, same-origin writes and private headers again.
4. Explain that the new host starts a new browser session. Redirect only approved public pages, without forwarding private identifiers or arbitrary query strings; old private paths get an expiry/migration response rather than an ownership-breaking redirect.
5. Preserve rollback configuration. Do not run a second API against shared data just to serve both origins without separately validating that deployment model.

## Completion still required

Brand/domain confirmation, accepted real sample, actual manifest generation, scoped production indexing changes, canonical tags and external response checks remain open. Allowing indexing is not evidence of impressions, visitors, activation or demand.
