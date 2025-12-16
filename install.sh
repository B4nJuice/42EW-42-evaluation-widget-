#!/bin/bash
set 

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo  "${GREEN}========================================${NC}"
echo  "${GREEN}   42EW Installer                       ${NC}"
echo  "${GREEN}========================================${NC}"
echo ""

EXTENSION_UUID="42EW@B4nJuice"
REPO_URL="https://github.com/B4nJuice/42EW-42-evaluation-widget.git"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

TMP_DIR="$(mktemp -d -t 42ew-install-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo  "${YELLOW}Cloning repository...${NC}"
git clone --depth=1 "$REPO_URL" "$TMP_DIR" || { echo  "${RED}Git clone failed${NC}"; exit 1; }

echo  "${YELLOW}Checking Python dependencies (optional)...${NC}"
pip3 install --user selenium psutil webdriver-manager || echo  "${YELLOW}Warning: python deps installation failed (continue)${NC}"

echo  "${YELLOW}Checking Node.js/npm and installing JS dependencies (optional)...${NC}"
if command -v npm >/dev/null 2>&1; then
  (cd "$TMP_DIR" && npm install --no-audit --no-fund) || echo  "${YELLOW}Warning: npm install failed (continue)${NC}"
else
  echo  "${YELLOW}Note: 'npm' not found. Skipping Node.js dependency installation.${NC}"
fi

echo  "${YELLOW}Cleaning old $INSTALL_DIR...${NC}"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo  "${YELLOW}Copying files to $INSTALL_DIR...${NC}"
cp -r "$TMP_DIR/"* "$INSTALL_DIR/" || { echo  "${RED}Copy failed${NC}"; exit 1; }

# Copy .git folder (REQUIRED for updater) if present
if [ -d "$TMP_DIR/.git" ]; then
    cp -r "$TMP_DIR/.git" "$INSTALL_DIR/"
fi

# Make capture script executable if present
if [ -f "$INSTALL_DIR/connect/capture_cookies.py" ]; then
    chmod +x "$INSTALL_DIR/connect/capture_cookies.py"
fi

echo  "${YELLOW}Enabling extension: $EXTENSION_UUID${NC}"
# try enable, do not fail the script if gnomextensions is missing
if command -v gnomextensions >/dev/null 2>&1; then
  gnomextensions enable "$EXTENSION_UUID" 2>/dev/null || echo  "${YELLOW}gnomextensions returned an error; you may need to restart GNOME Shell or log out/in.${NC}"
else
  echo  "${YELLOW}Note: 'gnomextensions' command not found. Enable manually via GNOME Tweaks or install gnomextensions tooling.${NC}"
fi

echo ""
echo  "${GREEN}========================================${NC}"
echo  "${GREEN}       Installation Complete!           ${NC}"
echo  "${GREEN}========================================${NC}"

# Restart GNOME Shell to pick up the extension (works on X11)
echo  "${YELLOW}Restarting GNOME Shell (X11) and enabling extension again...${NC}"
killall -3 gnome-shell 2>/dev/null || true
sleep 1

if command -v gnomextensions >/dev/null 2>&1; then
  gnomextensions enable "$EXTENSION_UUID" 2>/dev/null || true
fi

echo  "${GREEN}Done. If the extension still doesn't appear, log out and log back in.${NC}"