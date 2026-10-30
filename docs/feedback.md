# OS-07: beta information and voluntary feedback

The public `/about` page explains deterministic typography, preserved content, protected layouts, reader-controlled settings, file expiry and browser-session access. Kindle hardware, Send to Kindle and USB appearance remain unverified for this beta. The information page is available from home, the footer and upload errors; `/about#feedback` targets the form.

## Availability and submission

The page reads `/api/v1/capabilities`. The form is enabled only when `feedbackAvailable` is explicitly `true` and `feedbackRetentionHours` is a validated positive integer. Missing fields from an older backend, a disabled capability, malformed responses and capability-request failures do not enable submission. There is no simulated success or fallback to an external service.

Users choose a category, reader and delivery route. Optional fields are a better/same/worse rating, a request ID and a short description of at most 1,000 UTF-16 code units. The client validates a strict payload and posts it to `/api/v1/feedback` with a fresh UUID `Idempotency-Key`.

Success requires a validated server receipt containing `receiptId` and `expiresAt`. HTTP errors do not display a success state. An uncertain result locks the captured payload and key; only an explicit confirmation button resends that same submission. Automatic mutation retries are disabled. Drafts and confirmation state are kept in page memory, not local or session storage; closing or refreshing loses that local state.

## Data boundaries

- Request ID is manually entered, never copied from the current task or URL.
- The feedback body contains only selected form fields. It does not read or copy book text, titles, filenames, task metadata, private links, screenshots or cookie values.
- The browser session cookie still secures the HTTP request and applies server limits. This is distinct from copying its value into feedback content.
- There are no attachments, email fields, third-party analytics or GitHub-account requirements in this form. Users are reminded not to paste private text, credentials or contact information.
- The receipt confirms private server storage, not an individual reply. Feedback expiry is shown from the server; physical deletion follows periodic cleanup and is not promised at the exact expiry second.

Users can voluntarily type sensitive information into any free-text form. The UI does not claim this is impossible, or describe optional self-reported feedback as verified device evidence.

## Validation and dependencies

The frontend's full required check passes 117 tests across 14 files, typechecking, lint, formatting and production build. Feedback checks cover capability absence/failure, strict payload boundaries, input limits, associated labels, success receipt, safe errors, no automatic private-state attachment, no browser-storage writes and explicit same-key confirmation after a timeout.

This branch is based on frontend [PR #10](https://github.com/ddbsstar/epub-ai-frontend/pull/10) and depends on its English-flow and summary-contract changes. It also needs the companion backend feedback implementation and opt-in capability before the form can submit. The PR is targeted at `main` for review, without automatically merging dependencies, enabling the server flag or deploying. No new browser-operating or Kindle-device acceptance is claimed here.
