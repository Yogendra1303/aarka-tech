# Releasing Aarka Tech

## Release checklist (0.1.0-alpha.1)

Repository content
- [ ] Working tree clean: `git status` shows nothing.
- [ ] No personal data: `git ls-files | grep -E '^(cv\.md|portals\.yml|config/profile\.yml|data/|reports/|output/|documents/|automation/(config\.env|logs|state))'` prints nothing.
- [ ] No secrets: run a secret scanner on the full history, e.g. `gitleaks detect --source . --log-opts=--all` (install it yourself) and the grep in "Secret scan" below.
- [ ] `NOTICE.md`, `LICENSE` (both copyright lines) and `docs/upstream/` present.
- [ ] `web/src/lib/arka/repo.ts` names the public repository (enables "Report a bug").
- [ ] `.github/CODEOWNERS`: replace `@OWNER` with your GitHub username.
- [ ] `.github/ISSUE_TEMPLATE/config.yml` has the real owner/repo in the security link.
- [ ] `docs/THIRD_PARTY_LICENSES.md` regenerated after the last dependency change.

Verification
- [ ] Fresh clone → `npm install`, `npm --prefix web ci`, `npm --prefix web run build`, `npm --prefix web start` works.
- [ ] Sample data flow (docs/INSTALL.md#try-it-with-sample-data): scan finds jobs, Explore filters work,
      a resume PDF builds, a tracker row can be added and moved to Applied.
- [ ] Tests: web unit, `npm --prefix web run typecheck`, automation tests, `node test-all.mjs`.

Publishing (maintainer only)
- [ ] Create the GitHub repository as **private** first; push; check the rendered README and that CI passes.
- [ ] Enable Settings → Code security → Private vulnerability reporting, secret scanning and push protection.
- [ ] Tag and release (below). Only then switch visibility to public.

## Secret scan (quick local check)

```bash
git grep -nE 'gsk_[A-Za-z0-9]{20,}|sk-(ant-|proj-)?[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|github_pat_|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}' $(git rev-list --all)
```

It should print only the fake test value in `tests/automation/ai-engine.test.mjs`.

## Tag and release

```bash
git tag -a v0.1.0-alpha.1 -m "Aarka Tech 0.1.0-alpha.1"
git push origin main --tags
gh release create v0.1.0-alpha.1 --prerelease --title "Aarka Tech 0.1.0-alpha.1" --notes-file docs/releases/0.1.0-alpha.1.md
```

Mark every alpha as a **pre-release**. Version numbers follow `MAJOR.MINOR.PATCH-alpha.N`; the
upstream career-ops version this build is based on is recorded in the release notes.
