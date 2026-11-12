# Installing Aarka Tech (alpha)

## Requirements

- Node.js **22.6 or newer** and npm (`node -v`).
- Git.
- macOS 13+ recommended. Linux and Windows (WSL) can run the web app and job scanner; see
  [known limitations](KNOWN_LIMITATIONS.md) for what needs macOS.
- Optional, for PDF resumes: the Playwright Chromium browser (`npx playwright install chromium`).
- Optional, for AI features: one AI provider you already have (see [AI providers](#ai-providers)).

## Install

```bash
git clone https://github.com/Yogendra1303/aarka-tech.git
cd aarka-tech
npm install                     # scanner, PDF and CLI tools
npm --prefix web ci        # web app
cp .env.example .env       # optional; every setting has a safe default
npm run doctor             # prints anything missing
```

## Run the web app

```bash
npm --prefix web run build
npm --prefix web start     # serves http://127.0.0.1:3000
```

For development with live reload use `npm --prefix web run dev -- -p 3100` instead. Live
reload refreshes open pages whenever code changes, so use the production build for everyday use.

Open **http://127.0.0.1:3000** (prefer `127.0.0.1` over `localhost`; another local app on port
3000 can otherwise answer instead).

## First run

1. **My Career Hub** → upload your resume (PDF or text). Review the extracted text and confirm.
   Nothing is saved until you confirm.
2. Fill in **Details only you can give** (target salary, notice period, work authorization).
   Left blank, these are never guessed.
3. **Explore Jobs** → enter roles and places, then **Search jobs (free)**.
4. Save interesting jobs to your pipeline, then **Evaluate** one (needs an AI provider).

## Try it with sample data

The repository ships fictional example data (Alex Chen, a software engineer in Austin). To try
the app without your own resume:

```bash
cp examples/cv-example.md cv.md
cp config/profile.example.yml config/profile.yml
cp templates/portals.example.yml portals.yml
cp modes/_profile.template.md modes/_profile.md
```

These copies are git-ignored like real data. Delete them before adding your own.

## AI providers

Open **Integrations & Settings** and pick one provider:

| Kind | Examples | How it connects |
|---|---|---|
| CLI you are signed in to | Claude Code, Codex, Gemini CLI, Qwen Code | Uses your existing CLI login. Aarka Tech never installs or signs in a CLI for you. |
| API key | Gemini API, Groq, Mistral, OpenRouter, Cloudflare Workers AI | Paste the key; it is stored in the macOS Keychain. Cloudflare also needs your account ID. |

Each provider shows its status (available, needs sign-in, key invalid, quota exhausted, needs
account ID…). A provider that may charge you stays disabled until you tick the billing
confirmation. Usage, quotas and prices are set by the provider, not by Aarka Tech.

## Optional: background automation (macOS)

`automation/` contains a daily discovery pipeline and a 15-minute scheduler tick. It never sends
messages or applications, and its AI stage is off until you set `AI_ENABLED=1`.

```bash
cp automation/config.env.example automation/config.env
./automation/install-macos.sh            # installs the web app + scheduler agents
./automation/install-macos.sh uninstall  # removes them
```

See [automation/README.md](../automation/README.md).

## Optional: Gmail drafts

My Career Hub → Connected accounts → Gmail. You create your own Google OAuth "Desktop app"
client (free) and upload its JSON file. Aarka Tech requests the `gmail.compose` scope and only
creates drafts; there is no send function. Steps: [automation/gmail/SETUP.md](../automation/gmail/SETUP.md).

## Updating

```bash
git pull
npm install && npm --prefix web ci
npm --prefix web run build
```

Your data files are git-ignored, so updates don't touch them. Back them up anyway (see
[PRIVACY.md](PRIVACY.md#backups)).
