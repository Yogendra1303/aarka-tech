#!/bin/zsh
# Runs every 15 minutes (launchd io.aarkatech.tick). Cheap check, no AI:
#  - a new scan finished (Career-ops Scheduled scans worker or its Run Now)  -> daily.sh post
#  - a "run everything now" request file exists (state/run-now)             -> daily.sh full
# Does nothing while automation/PAUSE exists.
set -u
AUTO_DIR="${0:A:h}"
if [[ -f "$AUTO_DIR/config.env" ]]; then source "$AUTO_DIR/config.env"; else source "$AUTO_DIR/config.env.example"; fi
STATE="$AUTO_DIR/state"; mkdir -p "$STATE"
[[ -f "$AUTO_DIR/PAUSE" ]] && exit 0

if [[ -f "$STATE/run-now" ]]; then
  rm -f "$STATE/run-now"
  "$AUTO_DIR/daily.sh" full
  tail -1 "$CO_DIR/data/scan-runs.tsv" | cut -f1 > "$STATE/last-processed-scan"
  exit 0
fi

latest="$(tail -1 "$CO_DIR/data/scan-runs.tsv" 2>/dev/null | cut -f1)"
[[ -z "$latest" || "$latest" == timestamp ]] && exit 0
seen="$(cat "$STATE/last-processed-scan" 2>/dev/null)"
if [[ "$latest" != "$seen" ]]; then
  "$AUTO_DIR/daily.sh" post && print -r -- "$latest" > "$STATE/last-processed-scan"
fi
