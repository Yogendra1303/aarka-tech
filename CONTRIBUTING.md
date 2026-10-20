# Contributing to Aarka Tech

Thanks for helping. Aarka Tech is a free, local-first tool; contributions should keep it that way
(no telemetry, no hosted services, no paid features).

## Ground rules

- **Never commit personal data.** Your `cv.md`, `config/profile.yml`, `portals.yml`, `data/`,
  `reports/`, `output/`, `documents/` and `automation/config.env` are git-ignored; keep them that
  way. Use the fictional data in `examples/` for tests, screenshots and bug reports.
- **Never commit keys or tokens.** Keys belong in the macOS Keychain via the app.
- **No silent spending.** Anything that can call a paid AI provider must be opt-in, show the
  provider, and respect the billing confirmation.
- **No automatic outreach.** Nothing may send an email, submit an application or contact a
  recruiter without an explicit user action.

## Setup

```bash
npm install && npm --prefix web ci
npm --prefix web run dev -- -p 3100   # live-reload dev server
```

## Tests

```bash
node --experimental-strip-types --test web/tests/lib/*.test.mjs web/tests/lib/core/*.test.mjs   # web unit tests
npm --prefix web run typecheck
node --test tests/automation/*.test.mjs
zsh automation/tests/run-tests.sh
node test-all.mjs                                                                                          # full upstream suite (slow)
```

Browser tests (`*.browser.test.mjs`) need Playwright's Chromium and are skipped otherwise.

## Pull requests

1. Open an issue first for anything larger than a small fix.
2. Keep each PR to one change, with tests for new behaviour.
3. Describe what a user sees before and after.
4. Make sure the `no-user-data` check passes.

Changes to the upstream career-ops core are best proposed upstream as well, so both projects
benefit.
