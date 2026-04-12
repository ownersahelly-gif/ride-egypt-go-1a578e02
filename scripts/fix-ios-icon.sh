#!/bin/bash
# Restores iOS AppIcon assets after Capacitor sync/build.
# Source of truth: resources/ios/AppIcon.appiconset/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$PROJECT_DIR/resources/ios/AppIcon.appiconset"
DEST="$PROJECT_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset"
ASSETS_ROOT="$PROJECT_DIR/ios/App/App/Assets.xcassets"

if [ ! -d "$SRC" ]; then
  echo "⚠️  Source icons not found at $SRC — skipping."
  exit 0
fi

mkdir -p "$DEST"

# Ensure root Contents.json exists (Xcode requires it)
if [ ! -f "$ASSETS_ROOT/Contents.json" ]; then
  echo '{"info":{"author":"xcode","version":1}}' > "$ASSETS_ROOT/Contents.json"
fi

cp -f "$SRC"/* "$DEST"/
echo "✅ iOS AppIcon restored from resources/ios/AppIcon.appiconset"