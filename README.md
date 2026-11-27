# PocketPick OOTD

> **Private, Encrypted AI-Stylist & Outfit of the Day (OOTD) Companion for iOS**

PocketPick OOTD is an iOS-first React Native + Expo Custom Dev Client application powered by SQLCipher, Drizzle ORM, native JSI C++ cryptography (`react-native-quick-crypto`), and OpenRouter (**Grok 4.7** default). It lets you create custom AI Designer Personalities ("Persons"), keep all garment and try-on photos strictly inside the encrypted app sandbox (never in iOS Photos), converse in a WhatsApp/Messenger-style encrypted chat, and curate daily outfits across five strict wardrobe categories (`top`, `bottom`, `underwear`, `hosiery`, `others`).

---

## 1. Core Capabilities

- **Four-Tab Workspace:**
  1. **`Chats`**: Messenger-style directory of AI Designer Personalities with encrypted portrait avatars, swipe-to-delete, and a Day-1 Quick Start checklist.
  2. **`Wardrobe`**: App-only encrypted garment photos with strict 5-category filtering (`Top`, `Bottom`, `Underwear`, `Hosiery`, `Others`), encrypted `item` & `descriptions` (manual or AI-suggested), and batch **`Auto-Sort`** with Undo toast.
  3. **`Past OOTD`**: AI-classified human-body outfit selfies / Fit Checks plus your encrypted **Saved Looks** Lookbook.
  4. **`Settings`**: Luxury themes (**Velvet Noir**, **Champagne Silk**, **Sakura Pink**, **Classic iOS**, **Cyber Terminal**), **Per-Personality Plain-Text Memory Editor**, OOTD preferences (Unveil Mode, Anti-Repeat Cooldown, Monthly Quota), Face ID & inactivity auto-lock, OpenRouter gateway (`x-ai/grok-4.7` default), and `.ootdbackup` iPhone-to-iPhone encrypted export/import.
- **Constraint-Aware Outfit Picking Engine (`src/engine/`):**
  - Supports `/ootd`, `/secret`, `/style [mood]`, natural-language exclusions (`"/ootd with no top and no pants"` → automatic `bra` + `panties` pairing), and a 1-tap **OOTD Quick-Builder Sheet**.
  - Interactive **Unveil Mode** reveal cards with soft haptics, **Lock & Swap** slot negotiation, **Worn Today**, and one-tap **Send Fit Check**.
  - 100% offline CSPRNG picking resilience (`src/services/randomizer/csprng.ts`).
- **Per-Personality Extensible Living Memory:** Each Person records styles, colors, and fabrics/textures that make you feel special in transparent plain-text Markdown viewable and editable inside `Settings`.

---

## 2. Security & Zero-Leak Invariants

1. **App-Only Photo Isolation:** Camera captures and imports optimize to `1600px` full / `320px` thumbnail, encrypt via AES-256-GCM (12-byte IV, 16-byte tag), deduplicate via `HMAC-SHA256` blind index, and shred temporary cache files inside `finally` blocks. Zero writes to Apple Photos or raw Share Sheets.
2. **Unified App Master Passphrase & Face ID:** PBKDF2-HMAC-SHA512 (100,000 iterations) derives an ephemeral in-memory `appSessionKey` (`useSessionStore`) with `zeroizeBuffer()` on inactivity lock or backgrounding (`PrivacyShield`). Opt-in Face ID quick unlock is protected by iOS Keychain.
3. **Encrypted SQLCipher Relational Storage:** All Persons, Chats, Photos, and OOTD Looks reside in `op-sqlite` with 256-bit AES SQLCipher plus application-layer AES-256-GCM encryption.
4. **Portable Encrypted Backups (`.ootdbackup`):** Chunked sequential AES-256-GCM frames (`PBKDF2-HMAC-SHA512`) safely transfer Personas, Memories, Photos, Looks, and Chats to a new iPhone without OOM crashes and without exporting OpenRouter API keys.

---

## 3. Verification & Commands

```bash
# TypeScript strict check
npx tsc --noEmit

# Run unit, service, engine & component test suite
npm test

# Lint & format
npm run lint
npm run format

# Cryptographic & zero-leak audit
bash scripts/audit-crypto.sh

# Launch iOS Dev Client
npx expo run:ios

# Run Maestro E2E flows
maestro test .maestro/flows/
```
