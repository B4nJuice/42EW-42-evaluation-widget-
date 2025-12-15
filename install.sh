#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   42EW Installer (Dev Mode)            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

EXTENSION_UUID="42EW@B4nJuice"
REPO_URL="https://github.com/B4nJuice/42EW-42-evaluation-widget-.git"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

TMP_DIR="$(mktemp -d -t 42ew-install-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo -e "${YELLOW}Cloning repository...${NC}"
git clone --depth=1 "$REPO_URL" "$TMP_DIR" || { echo -e "${RED}Git clone failed${NC}"; exit 1; }

echo -e "${YELLOW}Checking Python dependencies (optional)...${NC}"
pip3 install --user selenium psutil webdriver-manager || echo -e "${YELLOW}Warning: python deps installation failed (continue)${NC}"

echo -e "${YELLOW}Cleaning old $INSTALL_DIR...${NC}"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo -e "${YELLOW}Copying files to $INSTALL_DIR...${NC}"
cp -r "$TMP_DIR/"* "$INSTALL_DIR/" || { echo -e "${RED}Copy failed${NC}"; exit 1; }

# Copy .git folder (REQUIRED for updater) if present
if [ -d "$TMP_DIR/.git" ]; then
    cp -r "$TMP_DIR/.git" "$INSTALL_DIR/"
fi

# Make capture script executable if present
if [ -f "$INSTALL_DIR/connect/capture_cookies.py" ]; then
    chmod +x "$INSTALL_DIR/connect/capture_cookies.py"
fi

echo -e "${YELLOW}Enabling extension: $EXTENSION_UUID${NC}"
# try enable, do not fail the script if gnome-extensions is missing
if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || echo -e "${YELLOW}gnome-extensions returned an error; you may need to restart GNOME Shell or log out/in.${NC}"
else
  echo -e "${YELLOW}Note: 'gnome-extensions' command not found. Enable manually via GNOME Tweaks or install gnome-extensions tooling.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       Installation Complete!           ${NC}"
echo -e "${GREEN}========================================${NC}"

# Restart GNOME Shell to pick up the extension (works on X11)
echo -e "${YELLOW}Restarting GNOME Shell (X11) and enabling extension again...${NC}"
killall -3 gnome-shell 2>/dev/null || true
sleep 1

if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || true
fi

echo -e "${GREEN}Done. If the extension still doesn't appear, log out and log back in.${NC}"