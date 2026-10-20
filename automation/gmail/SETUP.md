# Connect Gmail (drafts only) — about 10 minutes, free

You do these steps yourself in Google's own pages; never paste passwords or tokens into chat.

1. Go to https://console.cloud.google.com/ and create a project (any name, e.g. "Job Hunter").
2. APIs & Services → Library → enable **Gmail API**.
3. APIs & Services → OAuth consent screen → User type **External** → add your Gmail address as a
   **Test user**. No verification or payment is needed for your own use.
4. APIs & Services → Credentials → Create credentials → OAuth client ID → Application type
   **Desktop app** → Download JSON.
5. Save that file as:
   `~/Library/Application Support/careerops/gmail-client.json`
6. Tell me in the thread. I run `node ~/career-ops-automation/gmail/gmail.mjs auth`; Google's consent
   page opens in your browser; you choose the Gmail account and approve.

**Permission requested:** `gmail.compose` only (create and read back drafts). Google bundles sending
into this permission, but this connector has no send code; it never sends. No inbox reading.

**Token:** stored only at `~/Library/Application Support/careerops/gmail-token.json` (owner-only
file permissions), never in logs, the repo or project memory. `gmail.mjs disconnect` revokes it.

**Known limit:** while the Google app stays in "Testing" mode, Google expires the refresh token after
7 days, so you would re-approve weekly. Publishing the app for your own use removes that but Google
may ask for verification of the compose scope.

**Test after connecting:** I create one draft to your own address with the master resume attached,
read it back from Gmail, and record the draft id in `~/career-ops/data/hub/gmail-drafts.tsv`.
