# Known limitations (0.1.0-alpha.1)

This is an alpha. These are known gaps, not hidden ones.

## Platform
- **macOS is the primary platform.** API-key storage and the personal-records vault use the macOS
  Keychain (`security`). On Linux/Windows the web app, scanner and tracker work, but API-key
  providers need `ARKA_SECRETS_FILE` (a plain JSON file with mode 600, less secure) and the vault
  is unavailable.
- Background automation (`automation/install-macos.sh`) uses launchd and is macOS-only. On other
  systems run `automation/tick.sh` from cron yourself.

## Job discovery
- Coverage depends on public career pages and job-board APIs (Greenhouse, Lever, Ashby, Workday
  and others). Sites behind logins (including LinkedIn) are not scraped, by design.
- Salary, visa sponsorship and time zone are rarely published by these sources, so they are shown
  as unknown and cannot be filtered.
- Location filters are text matches. A posting that lists many cities may need "Always keep jobs
  that mention" to be included. Country detection covers about 60 countries plus common Indian,
  US, Canadian and Australian states; anything else shows as "Other".
- Company stage and industry preferences are saved to your profile for evaluations; job boards
  don't publish them, so they don't hide results.
- The "Match to your profile" label in Explore is a free keyword estimate, not an evaluation.

## AI features
- Evaluations, tailored resumes and cover letters need an AI provider you configure; quality and
  cost depend on that provider and model.
- Usage and quota figures come from what each provider reports; many report nothing, so remaining
  quota may be unknown.
- The scheduled AI stage is off by default and has only been exercised with Claude Code.

## Integrations
- Gmail needs your own Google Cloud OAuth "Desktop app" client. While the Google app is in Testing
  mode, Google asks you to reconnect every 7 days. Only drafts are created.
- Favourite-company alerts appear on the Dashboard only (no email or system notifications).
- LinkedIn data can be imported only from the export file you download from LinkedIn.

## Updating
- Update with `git pull` (see INSTALL). **Do not run `npm run update`**: that is the upstream
  career-ops updater, which fetches career-ops system files and would overwrite Aarka Tech changes.

## Web app
- Single user, single computer. No sync between devices.
- The Explore "AI search" mode is experimental and its results are unverified until evaluated.
- Some upstream browser tests still expect labels from before the redesign; they are skipped in the
  default unit run.
