#!/bin/zsh
# Run Now from the terminal. Usage:
#   run-now.sh            full pipeline (scan + checks + report), right now, in this terminal
#   run-now.sh queue      ask the background worker to do it at its next 15-minute tick
# Discovery-only Run Now is the "Run now" button on the Scheduled scans page (http://127.0.0.1:3000/scheduled-scans).
AUTO_DIR="${0:A:h}"
if [[ "${1:-}" == queue ]]; then
  mkdir -p "$AUTO_DIR/state" && date -Iseconds > "$AUTO_DIR/state/run-now" && echo "Queued for the next tick."
else
  "$AUTO_DIR/daily.sh" full && cat "$AUTO_DIR/logs/runs/latest.json"
fi
