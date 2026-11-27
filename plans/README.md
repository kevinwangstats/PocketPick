# PocketPick OOTD: Architecture & Implementation Roadmap

> **PocketPick OOTD** is an encrypted, iOS-sandboxed Outfit of the Day (OOTD) companion app built with React Native, Expo Custom Dev Client, SQLCipher (`op-sqlite`), Drizzle ORM, native JSI C++ cryptography (`react-native-quick-crypto`), and OpenRouter (`x-ai/grok-4.7` default).

---

## 1. Four-Layer Architecture

1. **Private Media Store (`Wardrobe` vs. `Past OOTD`):** App-only encrypted photos (`1600px` full / `320px` thumb / `1024px` vision) stored via AES-256-GCM with `HMAC-SHA256` blind-index deduplication and zero writes to iOS Photos. AI vision detects human-body subjects to auto-sort isolated garments (`Wardrobe`) from worn outfit photos (`Past OOTD`).
2. **Decoupled Outfit Picking Engine (`src/engine/`):** Standalone pure engine governing the strict 5 wardrobe categories (`top`, `bottom`, `underwear`, `hosiery`, `others`), natural-language constraints (`"/ootd with no top and no pants"`), `bra` + `panties` pairing, hardware CSPRNG (`src/services/randomizer/csprng.ts`), `/style` AI curation, slot locking/swapping, anti-repeat cooldown, and 100% offline `/ootd` resilience.
3. **Designer Persona, Living Memory & Chat Layer (`src/services/persons/`, `src/services/chat/`):** AI Persons with encrypted portraits, authoritative personality prompts, Tone/Sensuality dials, extensible plain-text per-person Memory viewable/editable in `Settings`, and Messenger-style encrypted chat with single-pass multimodal vision + auto-learning memory.
4. **Zero-Leak Security & Portability (`src/services/auth/`, `src/services/backup/`):** Unified App Master Passphrase + opt-in Face ID quick unlock, inactivity-based non-destructive `AppLockGate` overlay, `PrivacyShield`, and chunked AES-256-GCM `.ootdbackup` iPhone-to-iPhone export/import.

---

## 2. Completed Implementation Phases

| Phase       | Milestone                                                                                                                                                                                              | Status           |
| :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **Phase 1** | Living Specs (`USER_STORIES.md`), OpenRouter Grok 4.7 Default, Single-Pass Trailer Parser, OOTD SQLCipher Schema, Unified Master Lock, Face ID & Inactivity Fix                                        | ✅ **Completed** |
| **Phase 2** | `1600px` Private Photo Pipeline, AI Human-Body Classifier, Batch Auto-Tag Queue, Decoupled Outfit Picking Engine (`src/engine/`), Person & Plain-Text Memory Services, Full Legacy Purge & 4-Tab Shell | ✅ **Completed** |
| **Phase 3** | Luxury Themes (`Velvet Noir`, `Champagne Silk`), Settings Memory Editor, `Wardrobe` Tab with Undo Toast, `Chats` Directory & Day-1 Quick Start                                                         | ✅ **Completed** |
| **Phase 4** | Encrypted Messenger Chat Service (Optimistic Retry & Single-Pass Vision/Memory), Messenger UI, OOTD Quick-Builder Sheet, Unveil Cards, Keep-Swap & Fit Check Loop                                      | ✅ **Completed** |
| **Phase 5** | `Past OOTD` Tab & Saved Lookbook, Chunked OOM-Safe `.ootdbackup` Export/Import, E2E Tests, Maestro Flows & Crypto Audit                                                                                | ✅ **Completed** |
