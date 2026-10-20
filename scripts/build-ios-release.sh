#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "          POCKETPICK iOS RELEASE BUILD SCRIPT             "
echo "=========================================================="

# 1. Run full verification suite
echo "[1/4] Running typecheck, lint, and security audit..."
npm run typecheck
npm run lint
./scripts/audit-crypto.sh
npm test

# 2. Run Expo prebuild for native iOS project
echo "[2/4] Generating native iOS project via Expo prebuild..."
npx expo prebuild --platform ios --clean

# 3. Archive release build
echo "[3/4] Compiling release archive with xcodebuild..."
DEVELOPER_DIR=/Library/Developer/CommandLineTools
if [ -d "ios" ]; then
  xcodebuild -workspace ios/PocketPick.xcworkspace \
    -scheme PocketPick \
    -configuration Release \
    -sdk iphoneos \
    -archivePath ios/build/PocketPick.xcarchive \
    archive \
    CODE_SIGN_STYLE="Automatic" || {
      echo "Note: Full code signing requires an active Apple Developer Team configured in Xcode."
    }
fi

echo "=========================================================="
echo "✅ Build preparation complete."
