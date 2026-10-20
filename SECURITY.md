# Security policy

Aarka Tech handles resumes, API keys, OAuth tokens and identity documents on your own computer,
so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue** for a vulnerability.

Report it privately through GitHub: **Security → Report a vulnerability** on this repository
(GitHub private vulnerability reporting). Include the affected version or commit, steps to
reproduce, and the impact you observed. Please don't include real personal data in the report;
use the fictional example data in `examples/` to reproduce.

You should get an acknowledgement within 7 days. Fixes for confirmed issues are released as soon
as practical and credited in the release notes unless you ask otherwise.

## Supported versions

Only the latest alpha release receives fixes.

## Scope

In scope: the web app (`web/`), the automation and AI engine (`automation/`), the scanner and
CLI scripts, and anything that could expose local data, keys, tokens or vault contents, allow
another origin to reach the local server, or send messages or applications without the user's
action.

Out of scope: vulnerabilities in third-party AI providers, job boards or Google services, and
issues that need an attacker who already controls your logged-in computer account.

## If you committed a secret

Revoke it at the provider immediately (removing it from git does not make it safe), then
remove it from history before pushing. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#i-committed-a-key-or-personal-file).
