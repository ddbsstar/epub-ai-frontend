# English EPUB trial: product scope

Updated: 2026-10-30. This records the first trial scope, not a validated market or device compatibility claim.

## Confirmed by the user

- Overseas direction; first trial for personal reading users, with Kindle as the primary reader (reply on 2026-10-30).
- Core aim: make existing EPUB typography more consistent and pleasant to read.
- Previous delivery preference includes both Send to Kindle and USB. These require separate acceptance records.
- New requirements use a feature branch and PR; no direct main push, automatic merge or deployment in this task.

## Working scope for implementation

Target input: legitimately obtained, DRM-free, reflowable English prose EPUBs, especially novels and essays. This is an initial supported-shape proposal; the actual sample matrix determines which documents can be processed.

Task: upload an existing EPUB, apply consistent chapter headings, opening paragraphs and supported special paragraph styles, then download the actual result and a coverage report. Preserve the words, original image resources, reading order and navigation. The beta uses deterministic rules and makes no paid model calls.

English value statement: **Give your EPUBs consistent chapter styling, without changing the words.**

The user benefit to test is whether a personal reader can improve an inconsistent book without editing CSS. We have not established willingness to pay or superiority over Calibre, Sigil, a publisher's original design or the reader's own preferences.

## Boundaries

- Keep reader control over body font, text size, line spacing, text colour, background and page margins.
- Unknown or complex layouts stay unchanged and are reported. Partial or zero coverage is not described as whole-book beautification.
- Poetry, technical books, fixed layouts, manga, complex tables and mathematical layouts are not initial improvement promises; preserving them is a valid result.
- Downloading a valid EPUB does not prove its appearance after Amazon conversion or on Kindle hardware.
- The current web beta does not provide an AZW3 converter or automatic Send to Kindle delivery. A separately prepared AZW3 test artifact must be labelled as a Calibre conversion.
- English UI does not translate a user's book title or contents.

## Acceptance still needed

- Run real English EPUBs through the engine, format checker and independent content/resource audit.
- Complete the real English web flow and a failure/recovery case.
- On the user's Kindle, compare original and processed copies using matching reader settings. Record model, firmware, route, locations and observed improvements or regressions.
- Only then choose a public before/after sample and publish a supported-reader claim.

Product scope is partly confirmed (audience and primary reader); support breadth, visual acceptance, brand and commercial terms remain open.
