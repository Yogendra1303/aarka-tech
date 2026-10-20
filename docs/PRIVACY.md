# Privacy

Aarka Tech is local-first. It has no server, no account and no telemetry of its own.

## What stays on your computer

| Data | Where | In git? |
|---|---|---|
| Resume (`cv.md`), profile (`config/profile.yml`), job sources (`portals.yml`) | your checkout | No (git-ignored) |
| Tracker, new postings, scan history, follow-ups (`data/`) | your checkout | No |
| Evaluation reports (`reports/`), generated resumes and packs (`output/`) | your checkout | No |
| Uploaded originals and career assets (`documents/`) | your checkout | No |
| Personal records vault (ID, salary slips, offer letters) | `~/Library/Application Support/careerops/vault`, AES-256-GCM encrypted, key in macOS Keychain | Never (outside the checkout) |
| AI provider API keys | macOS Keychain (service `arka-tech-ai`) | Never |
| Gmail OAuth client and token | `~/Library/Application Support/careerops` (mode 600) | Never |

The repository's CI includes a `no-user-data` check that rejects pull requests containing
personal data files.

## What leaves your computer, and only when you choose

- **Job discovery** reads public career pages and job-board APIs (Greenhouse, Lever, Ashby,
  Workday and others). These requests contain your search terms, not your resume.
- **AI provider** (only if you configure one): when you evaluate a job or generate a document,
  the job description and the relevant parts of your profile and resume are sent to the provider
  you chose. Its privacy policy and data-retention terms apply. The personal-records vault is
  never sent to any provider and never added to an application pack.
- **Gmail** (only if you connect it): drafts you ask for are created in your Gmail Drafts with
  the attachments you chose. Aarka Tech has no send function.

## The web app

The web server binds to `127.0.0.1` and rejects requests from other origins and hosts. Opening
it to your network requires setting `CAREER_OPS_WEB_ALLOWED_HOSTS` yourself; do this only on a
trusted network.

## AI providers

- Aarka Tech never installs a CLI, signs in for you, buys credits or changes billing.
- A provider that may charge you stays disabled until you confirm its billing terms.
- There is no silent fallback: if your chosen provider fails, the task stops and says why.
- The scheduled AI stage is off by default (`AI_ENABLED=0` in `automation/config.env`).

## Backups

Your data is ordinary files. Back up your checkout's git-ignored folders (`cv.md`, `config/`,
`data/`, `reports/`, `output/`, `documents/`) and, if you use it, the vault folder together with
its Keychain item (`arka-tech-vault`); the vault cannot be decrypted without that key.

## Deleting your data

Delete the files above. To remove stored keys: `security delete-generic-password -s arka-tech-ai -a <provider>`
and `security delete-generic-password -s arka-tech-vault -a vault-key`. To revoke Gmail access,
use Disconnect in My Career Hub, or remove the app at https://myaccount.google.com/permissions.
