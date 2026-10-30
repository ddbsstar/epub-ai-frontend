export const supportCopy = {
  pageTitle: 'About this beta & feedback · EPUB AI',
  link: 'About & feedback',
  errorLink: 'Report a problem',
  eyebrow: 'A SMALL BETA, WITH CLEAR BOUNDARIES',
  title: 'Your book. A little more clarity.',
  introduction:
    'What this service does, what happens to your files, and how to tell us what needs work.',
  scopeTitle: 'What the typography beta does',
  scope:
    'This beta applies deterministic typography rules to supported chapter headings, openings and paragraphs in reflowable EPUBs. It preserves the words, original images, reading order and navigation. Unknown or complex layouts stay unchanged and are reported.',
  controls:
    'Your reader keeps control of body font, text size, line spacing, colours, background and page margins. No new fonts are embedded. A successful export or format check does not establish a visual improvement.',
  models:
    'The public typography beta makes no paid model calls and does not generate illustrations. It does not rewrite or translate your book.',
  readerTitle: 'Download, then check in your own reader',
  reader:
    'The result is an EPUB download. This website does not automatically send books to Kindle or convert them to AZW3. This beta has not yet been verified on a physical Kindle, through Send to Kindle, or through USB. Test each route separately.',
  demo: 'The Kindle scene on the home page is an original design illustration, not a screenshot of an exported book or a device test.',
  filesTitle: 'Your files and this browser session',
  session:
    'A private browser cookie controls access to your uploads and results. Keep using this browser and its cookies until you have downloaded your files. Another browser, private browsing window, cleared cookies or an expired session can lose access; there is no account or recovery service in this beta.',
  expiry:
    'At file expiry, access is revoked and a background cleanup removes the original and results. Cleanup runs periodically, so physical deletion is not promised at the exact expiry second. Download your files before expiry.',
  capabilityLoading: 'Checking this service’s available limits and feedback support…',
  capabilityUnavailable:
    'The current service settings could not be confirmed. Feedback cannot be submitted until this check succeeds.',
  retryCapabilities: 'Check service settings again',
  limits: (max: number, hours: number) =>
    `This service currently accepts EPUBs up to ${max} MiB. Files expire ${hours} hours after upload.`,
  limitsUnknown:
    'Current upload and expiry limits are not available from this service. The public typography beta normally uses a 20 MiB limit and 24-hour file expiry; check the upload notice before sending a book.',
  feedbackTitle: 'Tell us what happened',
  feedbackIntroduction:
    'Feedback is optional. Only the fields you choose below go into its content: no book, filename, title, task, screenshot, current page URL or cookie value is copied into the feedback record. Your browser session still secures the request and applies submission limits. There are no attachments or third-party analytics on this form.',
  feedbackPrivacy:
    'Do not paste private book text, filenames, contact details, passwords or private links. No email address or account is requested, and a personal reply is not promised.',
  feedbackRetention: (hours: number) =>
    `Submitted feedback expires after ${hours} hours and is removed by periodic cleanup. Physical deletion may follow expiry. The receipt gives the expiry time.`,
  feedbackRetentionUnknown:
    'Feedback retention could not be confirmed. The form remains unavailable until the service provides this information.',
  feedbackUnavailable: 'Feedback is not enabled on this service. Nothing has been submitted.',
  category: 'What is this about?',
  fieldsLegend: 'Feedback details',
  readerField: 'Which reader did you use?',
  route: 'How did you open the book?',
  rating: 'How did the result compare? (optional)',
  requestId: 'Request ID (optional)',
  requestIdHint:
    'Only enter an ID you choose to share. It is not filled in from your current task.',
  description: 'Short description (optional)',
  descriptionHint:
    'Up to 1,000 characters. Describe the problem without pasting book content or personal information.',
  choose: 'Choose an option',
  noRating: 'No comparison to share',
  categoryOptions: {
    typography: 'Typography or appearance',
    processing: 'Upload or processing',
    download: 'Download',
    other: 'Something else',
  },
  readerOptions: {
    kindle: 'Kindle',
    'apple-books': 'Apple Books',
    kobo: 'Kobo',
    calibre: 'Calibre',
    other: 'Another reader',
    'not-tested': 'I have not tested in a reader yet',
  },
  routeOptions: {
    'send-to-kindle': 'Send to Kindle',
    usb: 'USB transfer',
    'reader-import': 'Import into a reader app',
    'not-tested': 'I have not opened it yet',
    other: 'Another route',
  },
  ratingOptions: { better: 'Better', same: 'About the same', worse: 'Worse' },
  requiredFields:
    'Choose a category, reader and opening route. Check the optional fields and keep the description within 1,000 characters.',
  invalidRequestId: 'Use a request ID of up to 128 letters, digits, dots, hyphens or underscores.',
  submit: 'Send feedback',
  submitting: 'Sending feedback…',
  confirm: 'Check this feedback submission',
  uncertain:
    'The submission result is not confirmed. Keep this tab open and use the button below to retry the same feedback with the same submission ID. It will not send automatically.',
  noLocalSave:
    'The draft and confirmation are kept only in this open page, not in browser storage. Refreshing or closing the page loses this local confirmation.',
  success: 'Your feedback was recorded.',
  receipt: (id: string) => `Receipt ID: ${id}`,
  receiptExpiry: (iso: string) => `Feedback expiry: ${iso}`,
  thankYou:
    'Thank you for sharing a real result. This receipt confirms storage, not a promise of an individual reply.',
} as const
