#!/bin/sh
# Copy the app (not dev/) into <main worktree>/preview/ with its own service-worker cache name.
# Usage: dev/publish-preview.sh /path/to/main-worktree
set -e; M="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"
keep="$M/preview/README.md"; [ -f "$keep" ] && cp "$keep" /tmp/preview-README.md
rm -rf "$M/preview"; mkdir -p "$M/preview"
cd "$R"; git ls-files | grep -v '^dev/\|^README.md$\|^\.' | while read -r f; do mkdir -p "$M/preview/$(dirname "$f")"; cp "$f" "$M/preview/$f"; done
sed -i "s/'memphis-phone-'/'memphis-preview-'/g; s/startsWith('memphis-phone-')/startsWith('memphis-preview-')/" "$M/preview/sw.js"
[ -f /tmp/preview-README.md ] && cp /tmp/preview-README.md "$M/preview/README.md"
echo "preview/ refreshed from $(git rev-parse --short HEAD)"
