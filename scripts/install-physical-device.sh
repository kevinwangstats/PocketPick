#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "    POCKETPICK DIRECT PHYSICAL iPHONE INSTALLATION        "
echo "=========================================================="

echo "Instructions for deploying to physical iPhone via Xcode:"
echo "1. Connect your physical iPhone to this Mac via USB."
echo "2. Ensure 'Developer Mode' is enabled on your iPhone:"
echo "   Settings > Privacy & Security > Developer Mode > On."
echo "3. Open the iOS project in Xcode:"
echo "   open ios/PocketPick.xcworkspace"
echo "4. Under 'Signing & Capabilities', select your Personal Team / Apple ID."
echo "5. Select your connected iPhone from the device target dropdown."
echo "6. Press Command + R to compile and install directly onto your device."
echo "7. On your iPhone, trust the developer profile:"
echo "   Settings > General > VPN & Device Management > Trust."
echo "=========================================================="
