# Phase 6: E2E Testing, Audit & iOS Distribution

## 1. Overview & Objectives
Phase 6 represents the final validation, hardening, and deployment phase for PocketPick. Having established the native foundation, cryptographic engine, encrypted storage, randomizer, and OCR/LLM capabilities, this phase ensures that:
1. End-to-end user journeys are automated and verified on the iOS Simulator using **Maestro**.
2. A formal zero-plaintext security and crypto audit is executed using the Antigravity IDE skill (`.agents/skills/crypto-audit`).
3. Release build scripts and Xcode configurations are set up to compile and install a signed, production-ready standalone build directly onto a physical iPhone via macOS and Xcode without requiring App Store submission or TestFlight.

---

## 2. Prerequisites & Native Tooling
- Completion of Phases 0 through 5.
- **Maestro CLI:** Installed via `curl -fsSL "https://get.maestro.mobile.dev" | bash`.
- **Physical Device Setup:** Apple ID connected in Xcode (Personal Team or Apple Developer Program), iPhone connected via USB/Wi-Fi with Developer Mode enabled.
- **Tools:** `ios-deploy` or Xcode 15+ Devices & Simulators window.

---

## 3. Architecture & File Layout
```
PocketPick/
├── .maestro/
│   ├── config.yaml
│   ├── flows/
│   │   ├── 01_vault_lifecycle.yaml     # Create vault -> Lock -> Unlock -> Change PIN
│   │   ├── 02_ticket_crud.yaml          # Create ticket -> View -> Edit -> Delete
│   │   ├── 03_image_gallery.yaml       # Pick image -> Encrypt -> Scroll FlashList -> View Full
│   │   ├── 04_random_picker.yaml       # Trigger pick -> Deceleration haptics -> Winner reveal -> History
│   │   └── 05_privacy_autolock.yaml    # Background app -> Verify PrivacyShield -> Auto-lock
├── scripts/
│   ├── audit-crypto.sh                 # Local verification script matching crypto-audit skill
│   ├── build-ios-release.sh            # Automated Xcode release compilation script
│   └── install-physical-device.sh      # Physical iPhone deployment script
├── .agents/skills/
│   └── crypto-audit/
│       └── SKILL.md                    # Antigravity skill definition
└── plans/
    └── README.md                       # Master roadmap summary
```

---

## 4. Detailed Implementation Tasks

### 4.1 Maestro E2E Automated Test Suite (Task 6.1)
- [ ] Configure `.maestro/config.yaml` targeting `com.pocketpick.app`.
- [ ] Implement `01_vault_lifecycle.yaml`:
  - Launch app.
  - Assert empty vault list.
  - Tap "CREATE VAULT".
  - Type vault name ("Personal Secure Vault") and passphrase ("CorrectHorseBatteryStaple99!").
  - Assert vault created and automatically unlocked.
  - Tap "LOCK VAULT".
  - Assert vault status shows "LOCKED".
  - Attempt unlock with wrong passphrase -> Assert error banner.
  - Enter correct passphrase -> Assert vault unlocks.
- [ ] Implement `02_ticket_crud.yaml`:
  - Open unlocked vault.
  - Tap "NEW TICKET", enter "Secret Passcode Backup", weight 5.
  - Save ticket -> Assert appears in ticket list.
  - Tap ticket -> Assert decrypted content matches.
- [ ] Implement `03_image_gallery.yaml`:
  - Tap "IMPORT PHOTO", select simulator photo from camera roll.
  - Assert thumbnail tile displays in gallery.
  - Tap thumbnail -> Assert full-screen decrypted image opens.
  - Dismiss modal.
- [ ] Implement `04_random_picker.yaml`:
  - Switch to "PICK" tab.
  - Tap "SHUFFLE & PICK".
  - Wait for deceleration and winner reveal.
  - Tap "KEEP".
  - Switch to "TIMELINE" tab -> Assert entry logged with timestamp.
- [ ] Implement `05_privacy_autolock.yaml`:
  - Put app into background (`pressHome`).
  - Bring app back into foreground.
  - Assert app requires passphrase re-entry and memory session key was cleared.
- [ ] Execute complete Maestro test suite on iOS Simulator:
  ```bash
  maestro test .maestro/flows/
  ```

### 4.2 Security & Crypto Leak Audit (Task 6.2)
- [ ] Execute Antigravity Skill `.agents/skills/crypto-audit`:
  1. **Static Analysis (Regex Search):**
     - Scan entire codebase for banned calls: `console.log` containing `key`, `passphrase`, `token`, `secret`, `Buffer`.
     - Scan for insecure random calls: `Math.random()` used in cryptographic contexts.
     - Scan for persistent plaintext writes: `AsyncStorage.setItem`, unencrypted file writes in `documentDirectory`.
  2. **Dynamic Sandbox Inspection (iOS Simulator Sandbox):**
     - Inspect `Library/Application Support/` -> Confirm `pocketpick.db` is encrypted with SQLCipher (cannot be read via standard `sqlite3`).
     - Inspect `Documents/vaults/` -> Confirm all photo files end in `.enc` and contain high-entropy binary ciphertext.
     - Inspect `Library/Caches/` -> Confirm zero orphaned `.tmp` or `.jpg` files exist after running OCR and gallery workflows.
  3. **Memory Zeroization Audit:**
     - Validate unit tests confirming `zeroizeBuffer()` overwrites memory buffers with zeroes upon vault lock.
- [ ] Document audit findings and sign-off report.

### 4.3 Standalone iOS Release Compilation & Direct Install (Task 6.3)
- [ ] Configure Xcode Release Scheme:
  - Enable Hermes bytecode optimization and dead code stripping.
  - Ensure `CFBundleIdentifier` matches `com.pocketpick.app`.
  - Configure Signing & Capabilities in `ios/PocketPick.xcodeproj` with your Apple ID / Personal Team.
- [ ] Create automated build script `scripts/build-ios-release.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail

  echo "=== Building PocketPick iOS Release ==="
  npx expo prebuild --platform ios

  # Build Release xcarchive using xcodebuild
  xcodebuild -workspace ios/PocketPick.xcworkspace \
    -scheme PocketPick \
    -configuration Release \
    -sdk iphoneos \
    -archivePath ios/build/PocketPick.xcarchive \
    archive \
    CODE_SIGN_STYLE="Automatic"

  echo "=== Build Archive Created at ios/build/PocketPick.xcarchive ==="
  ```
- [ ] Configure direct deployment via CLI (`npx expo run:ios --configuration Release --device`) or via Xcode:
  - Connect iPhone via USB-C/Lightning.
  - In Xcode, select physical device as run destination.
  - Click **Product > Run** to install directly to device.
  - On iPhone, trust the developer certificate under **Settings > General > VPN & Device Management**.
- [ ] Perform real-device physical sanity check:
  - Face ID / PIN prompt responsiveness.
  - Native haptic feedback motor behavior.
  - App switcher privacy shield occlusion.
  - Camera roll photo import and native C++ encryption speed.

---

## 5. Verification & Acceptance Criteria
1. **100% Maestro Pass Rate:** All 5 automated end-to-end test flows complete successfully without intermittent flakiness.
2. **Clean Crypto Audit:** Static and dynamic security audits return zero findings of plaintext leaks or lingering cache artifacts.
3. **Release Binary Health:** The standalone production build installs onto a physical iPhone, boots in under 1.5 seconds, and operates completely offline with zero crash reports.
4. **Autonomous Agent Compliance:** Repository complies with all `.agents/rules/` and `AGENTS.md` guidelines.
