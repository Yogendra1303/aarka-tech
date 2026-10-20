# Troubleshooting

## The web app shows a different app, or won't load
Open **http://127.0.0.1:3000**, not `localhost:3000`; another program on port 3000 may answer on
`localhost`. Check what's listening: `lsof -iTCP:3000 -sTCP:LISTEN`. Run on another port with
`npm --prefix web start -- -p 3010`.

## Pages keep loading or reload by themselves
You're probably running the dev server (`npm --prefix web run dev`), which reloads open pages when
code changes. For everyday use run the production build: `npm --prefix web run build && npm --prefix web start`.
If Applications can't read your tracker it shows the error and a **Try again** button.

## "Next.js was not found" / module errors
Run `npm ci` in the repo root and `npm --prefix web ci`, then rebuild. Node must be 22.6+.

## Explore finds nothing
- Clear role and place filters, choose **Anywhere in the world** and **This month**, and search again.
- Check **More filters** for exclusions you didn't intend.
- Some career sites are slow or temporarily down; the results header says when sources didn't answer.

## An AI provider shows an error
| Status | What to do |
|---|---|
| Not installed / needs sign-in | Install and sign in to that CLI yourself, then press Refresh. |
| Key invalid or unauthorized | Create a new key at the provider and save it again. |
| Needs account ID | Cloudflare only: add your 32-character account ID. |
| Quota exhausted | Wait for the provider's reset or choose another provider. |
| Temporarily unavailable | The provider's API is down; try later. |

## PDF resume generation fails
Install Chromium for Playwright once: `npx playwright install chromium`. Then retry from the
application's page. The daily pipeline checks that every resume PDF it claims exists and opens, and corrects the
tracker when one is missing.

## Gmail "Ready to connect" never becomes "Connected"
Approve the Google consent page that opens, then press Refresh. Your Google account must be added
as a test user on the OAuth consent screen.

## The personal-records vault says it can't open
Allow Keychain access when macOS asks. The vault needs the Keychain item `arka-tech-vault`; if it
was deleted, existing vault files cannot be decrypted.

## Background automation didn't run
Check `automation/logs/tick.log` and `automation/logs/runs/latest.json`. A file named
`automation/PAUSE` pauses everything. Reinstall the agents with `./automation/install-macos.sh`.

## I committed a key or personal file
1. Revoke the key at the provider now.
2. Remove the file from history (for example with `git filter-repo --path <file> --invert-paths`)
   before pushing, or before anyone else clones.
3. If it was already pushed to a public repository, treat it as public: revoke, rotate, and ask
   GitHub support to purge cached views if needed.
