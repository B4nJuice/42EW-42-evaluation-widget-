#!/usr/bin/env bash
# portable strict mode: always set -e and -u; enable pipefail only when running under bash
set -eu
if [ -n "${BASH_VERSION-}" ]; then
  set -o pipefail
else
  echo "Note: running under POSIX sh; 'pipefail' not available. For stricter behavior run with: bash $0"
fi

REPO_URL="https://github.com/B4nJuice/42EW-42-evaluation-widget-.git"
CLONE_DIR="$HOME/42EW@B4nJuice"
EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"

# clean & clone
rm -rf "$CLONE_DIR"
git clone "$REPO_URL" "$CLONE_DIR"
cd "$CLONE_DIR"

# try jq first, otherwise grep
UUID=""
if command -v jq >/dev/null 2>&1; then
  UUID="$(jq -r '.uuid // empty' metadata.json 2>/dev/null || true)"
fi
if [ -z "$UUID" ]; then
  UUID="$(grep -oP '"uuid"\s*:\s*"\K[^"]+' metadata.json 2>/dev/null || true)"
fi

if [ -z "$UUID" ]; then
  echo "Warning: uuid not found in metadata.json — falling back to directory name '42EW@B4nJuice'."
  UUID="42EW@B4nJuice"
fi

DEST="$EXTENSIONS_DIR/$UUID"
mkdir -p "$EXTENSIONS_DIR"
rm -rf "$DEST"
cp -r . "$DEST"
chown -R "$(id -u):$(id -g)" "$DEST"

# try to enable the extension
if command -v gnome-extensions >/dev/null 2>&1; then
  echo "Enabling extension: $UUID"
  if ! gnome-extensions enable "$UUID"; then
    echo "gnome-extensions returned an error; you may need to restart GNOME Shell or log out/in."
  fi
else
  echo "Note: 'gnome-extensions' command not found. Install the GNOME extensions tooling or enable via GNOME Tweaks."
fi

echo "Installed extension to: $DEST"
echo "If the extension does not appear, restart GNOME Shell (Alt+F2 then r on X11) or log out and log back in."