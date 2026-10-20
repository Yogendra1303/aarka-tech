#!/bin/zsh
# Release-blocking tests for the scheduled pipeline. Uses a throwaway copy of
# the data files, so the real workspace is never touched. Exit 1 on any failure.
set -u
AUTO_DIR="${0:A:h:h}"
if [[ -f "$AUTO_DIR/config.env" ]]; then source "$AUTO_DIR/config.env"; else source "$AUTO_DIR/config.env.example"; fi
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
ok()   { print "PASS  $1"; (( pass++ )); }
bad()  { print "FAIL  $1"; (( fail++ )); }

mkdir -p "$T/data" "$T/reports" "$T/output/packs/001-acme-head-of-ops" "$T/batch"
cat > "$T/data/pipeline.md" <<'EOF'
# Pipeline
## Pending
- [ ] https://jobs.example.com/a | Acme | Head of Operations | Gurugram | posted: 2026-10-01 | rank: 4.6/5 — fits
- [ ] https://jobs.example.com/b | Beta | Ops Manager | Dubai, ARE | rank: 3.1/5 — weak
- [ ] https://jobs.example.com/c | Gamma | GM | Noida
EOF
cat > "$T/data/applications.md" <<'EOF'
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-10-20 | Acme | Head of Operations | 4.5/5 | Evaluated | ✅ | [001](../reports/001-acme-2026-10-20.md) | test |
EOF
printf '# Evaluation\n\n**URL:** https://jobs.example.com/a\n**PDF:** ✅ output/missing.pdf\n' > "$T/reports/001-acme-2026-10-20.md"
printf 'date\tjob_url\tcompany\trole\tcontact_name\tcontact_title\tpublic_source\tchannel\tmessage_draft\tstatus\n' > "$T/data/outreach-queue.tsv"
for i in 1 2; do printf '2026-10-20\thttps://jobs.example.com/a\tAcme\tHead of Operations\tPriya S\tTalent Lead\thttps://acme.example/team\tLinkedIn connection note\tHi Priya...\tdraft - awaiting candidate\n' >> "$T/data/outreach-queue.tsv"; done

# 1. a false PDF claim must fail the verifier and be corrected
if node "$AUTO_DIR/lib/verify-outputs.mjs" "$T" --fix >/dev/null; then bad "verifier accepts a missing PDF"; else ok "verifier rejects a missing PDF"; fi
grep -q '❌ not generated' "$T/reports/001-acme-2026-10-20.md" && ok "report header corrected" || bad "report header not corrected"
grep -q '| ❌ |' "$T/data/applications.md" && ok "tracker PDF column corrected" || bad "tracker PDF column not corrected"

# 2. a real PDF passes
cp "$AUTO_DIR/tests/fixtures/sample.pdf" "$T/output/packs/001-acme-head-of-ops/cv.pdf"
printf '{"cv_pdf":"output/packs/001-acme-head-of-ops/cv.pdf","cover_pdf":null}' > "$T/output/packs/001-acme-head-of-ops/pack.json"
sed -i '' 's#^\*\*PDF:\*\*.*#**PDF:** ✅ output/packs/001-acme-head-of-ops/cv.pdf#' "$T/reports/001-acme-2026-10-20.md"
node "$AUTO_DIR/lib/verify-outputs.mjs" "$T" >/dev/null && ok "verifier accepts a real PDF" || bad "verifier rejects a real PDF"

# 3. queue: unranked -> rank, ranked >= 4.0 and unevaluated -> evaluate, evaluated -> not queued
q="$(node "$AUTO_DIR/lib/build-queue.mjs" "$T" 4.0 4.0)"
[[ "$q" == "rank 1, evaluate 0, pack 1" ]] && ok "AI queue counts ($q)" || bad "AI queue counts ($q)"

# 4. hub: duplicate outreach rows collapsed, tracker status carried
print '{"stages":[{"name":"scan","status":"succeeded","detail":"test"}]}' > "$T/run.json"
node "$AUTO_DIR/lib/build-hub.mjs" "$T" "$T/run.json" /dev/null >/dev/null
grep -q '1 duplicate outreach rows ignored' "$T/data/daily-reports/"*.md && ok "duplicate outreach row detected" || bad "duplicate outreach row not detected"
grep -q '"Acme","Head of Operations","Gurugram".*"Evaluated"' "$T/data/hub/master-tracker.csv" && ok "tracker row carries evaluation status" || bad "tracker row status wrong"
[[ -s "$T/output/hub/index.html" ]] && ok "hub page written" || bad "hub page missing"

print "\n$pass passed, $fail failed"
(( fail == 0 ))
