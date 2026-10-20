#!/bin/zsh
# Optional: run Aarka Tech in the background on macOS (web app at login + a 15-minute
# scheduler tick). Nothing here sends email, applies to jobs or turns on AI usage.
#   ./automation/install-macos.sh            install / update both agents
#   ./automation/install-macos.sh uninstall  remove them
set -eu
REPO="${0:A:h:h}"; LA="$HOME/Library/LaunchAgents"; NODE="$(command -v node)"
PATHS="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$LA" "$REPO/automation/logs"
for name in tick web; do
  label="io.aarkatech.$name"; dest="$LA/$label.plist"
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  if [[ "${1:-}" == "uninstall" ]]; then rm -f "$dest"; echo "removed $label"; continue; fi
  sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" -e "s#__PATH__#$PATHS#g" -e "s#__NODE__#$NODE#g" \
    "$REPO/automation/launchd/$label.plist.template" > "$dest"
  plutil -lint "$dest" >/dev/null
  launchctl bootstrap "gui/$(id -u)" "$dest"
  echo "installed $label"
done
[[ "${1:-}" == "uninstall" ]] || echo "Web app: http://127.0.0.1:3000 (build it first with: npm --prefix web run build)"
