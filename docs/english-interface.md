# OS-05: English public typography interface

The public typography flow is English-first. Public text is kept in `src/content/en.ts`, without introducing a multilingual runtime. The English scope for the first trial is recorded in [english-trial-scope.md](english-trial-scope.md).

## Implemented

- Home, navigation, upload, queue, processing stages, completion, zero coverage, failure, cancellation, recovery, quota messages and the 404 page use English.
- The HTML entry declares `lang="en"` and an English description. Public route titles, accessible labels and progress descriptions are English.
- File selection still uploads only; Start formatting remains explicit. Uncertain submissions reuse the existing idempotency key only after confirmation. Known task recovery remains read-only.
- Stable server error codes map to locally reviewed English explanations. Unknown codes receive a generic English fallback; raw server messages and details are not displayed. Network, timeout and invalid-response errors explain recovery.
- Summary labels and report/download actions are English. Machine report fields remain stable; newly produced backend report explanations are handled by the companion backend task. Existing historical reports are not rewritten.
- The original filename and book title are displayed verbatim, including non-English text. Book content is never translated. Long text can wrap, and workflow controls can flow onto another row on narrow screens.
- The Kindle scene remains an original design illustration, explicitly labelled as such. It is not a real exported EPUB or a Kindle hardware test.
- Production routing still excludes the illustration experiment. English copy does not enable AI, image generation, telemetry, public indexing or external publishing.

## Validation

The required `npm run check` covers protocol, UI and production build checks. Tests include the real state transitions through mocked API boundaries, failure/recovery without resubmission, preservation of a long original filename and non-English title, safe handling of a Chinese upstream error, English public metadata, public accessibility labels and production exclusion of the illustration route.

A passing automated check does not establish human usability, device appearance or overseas demand. Actual browser-flow evidence is recorded separately by the task owner. The PR does not deploy the new interface or change the existing online release.

## Remaining scope

OS-04 Kindle acceptance, OS-06 a real public comparison, OS-07 a working stranger feedback channel, and the other overseas checklist items require their own evidence. The English interface alone does not complete those tasks.
