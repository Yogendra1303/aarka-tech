#!/bin/zsh
# Career-ops pipeline. Usage: daily.sh [full|post]
#   full (default): scan + all post-scan stages (manual "run everything now")
#   post: post-scan stages only; tick.sh runs this after each scheduled or Run Now scan
# Stages are independent: one failing stage is recorded and the rest still run.
# Pause everything:   touch automation/PAUSE
set -u
AUTO_DIR="${0:A:h}"
if [[ -f "$AUTO_DIR/config.env" ]]; then source "$AUTO_DIR/config.env"; else source "$AUTO_DIR/config.env.example"; fi
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN   # never fall back to pay-per-use API billing

STAMP="$(date +%Y-%m-%d_%H%M)"
RUN_DIR="$AUTO_DIR/logs/runs"; mkdir -p "$RUN_DIR"
LOG="$RUN_DIR/$STAMP.log"
STATUS="$RUN_DIR/$STAMP.json"
STAGES=()
started="$(date -Iseconds)"

log() { print -r -- "[$(date +%H:%M:%S)] $*" >> "$LOG"; }
stage() { # name status detail
  STAGES+=("$(node -e 'console.log(JSON.stringify({name:process.argv[1],status:process.argv[2],detail:process.argv[3]}))' "$1" "$2" "$3")")
  log "STAGE $1: $2 $3"
}
write_status() {
  print -r -- "{\"started\":\"$started\",\"finished\":\"$(date -Iseconds)\",\"log\":\"$LOG\",\"stages\":[${(j:,:)STAGES}]}" > "$STATUS"
  cp "$STATUS" "$RUN_DIR/latest.json"
}
notify() { osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1 || true; }

# ---- single instance + pause control
LOCK="$AUTO_DIR/.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [[ -f "$LOCK/pid" ]] && kill -0 "$(cat "$LOCK/pid")" 2>/dev/null; then log "another run is active; exiting"; exit 0; fi
  rm -rf "$LOCK"; mkdir "$LOCK"
fi
print $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
if [[ -f "$AUTO_DIR/PAUSE" ]]; then stage pause skipped "PAUSE file present"; write_status; exit 0; fi

cd "$CO_DIR" || { stage preflight failed "workspace missing: $CO_DIR"; write_status; exit 1; }

# ---- 1. preflight
auth="$(claude auth status 2>/dev/null)"
if print -r -- "$auth" | grep -q '"loggedIn": true' && print -r -- "$auth" | grep -q '"authMethod": "claude.ai"'; then
  AUTH_OK=1; stage preflight succeeded "node $(node -v); Claude Code signed in with subscription"
else
  AUTH_OK=0; stage preflight needs_auth "Claude Code is not signed in with a subscription; AI stage will be skipped"
fi

# ---- 2. scan (zero tokens); skipped in post mode because the Scheduled scans worker already ran it
MODE="${1:-full}"
if [[ "$MODE" == post ]]; then
  stage scan skipped "scan was run by the Career-ops Scheduled scans worker ($(tail -1 data/scan-runs.tsv | cut -f1,2,14 | tr '\t' ' '))"
else
ok=0; partial=0
for i in $(seq 1 $SCAN_RETRIES); do
  out="$(node scan.mjs --quiet --json 2>>"$LOG")"; rc=$?
  if (( rc == 0 )); then ok=1; break; fi
  # scan.mjs exits non-zero when some sources error, but still writes a receipt:
  # a readable receipt means the other sources succeeded, so do not rerun everything.
  if print -r -- "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s);process.exit(0)}catch{process.exit(1)}})'; then ok=1; partial=1; break; fi
  log "scan attempt $i failed (exit $rc)"; sleep 60
done
if (( ok )); then
  detail="$(print -r -- "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(`${j.scanned} sources, ${j.found} postings, ${j.added} new, ${j.duplicates} duplicates, ${(j.errors||[]).length} source errors`)}catch{console.log("receipt unreadable")}})')"
  if (( partial )); then stage scan partial "$detail (some sources errored; others saved)"; else stage scan succeeded "$detail"; fi
else
  stage scan failed "scan failed $SCAN_RETRIES times; see log"
fi
fi

# ---- 3. expiry check of evaluated roles (zero tokens, read-only)
if exp="$(node check-liveness.mjs --tracker --no-record 2>&1 | tail -3 | tr '\n' ' ')"; then
  stage expiry succeeded "$exp"
else
  stage expiry failed "$exp"
fi

# ---- 4. AI queue (zero tokens)
q="$(node "$AUTO_DIR/lib/build-queue.mjs" . "$AI_MIN_RANK" "$AI_MIN_SCORE" 2>&1)" && stage queue succeeded "$q" || stage queue failed "$q"

# ---- 5. AI stage (bounded; off until authorized)
if [[ "$AI_ENABLED" != 1 ]]; then
  stage ai skipped "AI stage not authorized yet (AI_ENABLED=0)"
elif (( ! AUTH_OK )); then
  stage ai needs_auth "Claude Code sign-in required"
elif [[ -x "$AUTO_DIR/lib/ai-stage.sh" ]]; then
  if ai="$("$AUTO_DIR/lib/ai-stage.sh" 2>>"$LOG")"; then stage ai succeeded "$ai"; else stage ai failed "$ai"; fi
else
  stage ai skipped "ai-stage.sh not installed"
fi

# ---- 6. release-blocking output check
if v="$(node "$AUTO_DIR/lib/verify-outputs.mjs" . --fix 2>&1)"; then
  stage verify succeeded "$(print -r -- "$v" | tail -1)"
else
  stage verify failed "$(print -r -- "$v" | tail -1)"
fi

# ---- 7. follow-ups + 8. tracker, report, hub
node followup-cadence.mjs --json > "$CO_DIR/data/hub/followups.json" 2>>"$LOG" || log "followup-cadence failed"
write_status
if hub="$(node "$AUTO_DIR/lib/build-hub.mjs" . "$STATUS" "$CO_DIR/data/hub/followups.json" 2>&1)"; then
  stage report succeeded "$hub"
else
  stage report failed "$hub"
fi
write_status

failed="$(print -r -- "${(j:,:)STAGES}" | grep -o '"status":"failed"' | wc -l | tr -d ' ')"
if (( failed > 0 )); then notify "Job search: $failed stage(s) failed" "Open the Job Search Hub for details."
else notify "Job search run finished" "$(print -r -- "$hub" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(`${j.new_today} new roles; ${j.jobs} tracked`)}catch{console.log("Report ready")}})')"
fi
exit 0
