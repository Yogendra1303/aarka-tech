# Background automation

Optional. Runs job discovery on a schedule and keeps the tracker, reports and Dashboard current.
It never sends emails, submits applications or contacts anyone.

| File | Purpose |
|---|---|
| `tick.sh` | Runs every 15 minutes (launchd). If a new scan has finished, runs the post-scan stages; if you pressed Run Now, runs the full pipeline. |
| `daily.sh full\|post` | Stages: preflight → scan → expiry → queue → ai (off by default) → verify → report. Writes `logs/runs/<date>.json`. |
| `run-now.sh` | Run the full pipeline now in this terminal, or `run-now.sh queue` to hand it to the next tick. |
| `config.env.example` | Settings. Copy to `config.env` (git-ignored). |
| `ai-engine/` | Provider registry, status checks, caching and fallback order for AI tasks. Keys are read from the macOS Keychain. |
| `gmail/` | Gmail draft-only connector (`gmail.compose`). See `gmail/SETUP.md`. |
| `lib/` | Queue, verification and report builders used by `daily.sh`. |
| `install-macos.sh` | Installs or removes the launchd agents for the web app and the tick. |

Pause everything: `touch automation/PAUSE`. Resume: delete it. Schedules for discovery are set in
the web app under **Automation**.

## AI stage

`AI_ENABLED=0` by default. Setting it to `1` lets the pipeline rank, evaluate and prepare packs
with your configured provider within the daily limits in `config.env`. This uses your provider's
quota or billing. Leave it off until you've checked the limits and your provider's pricing.

## Tests

```bash
node --test tests/automation/*.test.mjs
zsh automation/tests/run-tests.sh
```
