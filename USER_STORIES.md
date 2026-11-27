# PocketPick OOTD — Living User Stories & Feature Specifications

> **Living Document Notice:** This document reflects the active, current state of user requests and features for the OOTD evolution of PocketPick. Whenever new feedback or requests replace previous behavior, specifications are directly edited to maintain a single source of truth without accumulating obsolete historical states.

---

## 1. Architecture Overview (Clean-Slate OOTD Engine on Proven Native Kernel)

PocketPick OOTD is an encrypted, iOS-sandboxed **Outfit of the Day (OOTD)** companion app centered around configurable **AI Designer Personalities ("Persons")** and a decoupled **Outfit Picking Engine** built atop the app's native JSI C++ cryptography, SQLCipher database, Keychain storage, and OpenRouter gateway.

1. **Private Media Store (`Wardrobe` vs. `Past OOTD`):** App-only encrypted photos optimized to crisp `1600px` full / `320px` thumb, automatically sorted by AI human-body detection with one-tap Undo and zero writes to iOS Photos.
2. **Decoupled Outfit Picking Engine (`src/engine/`):** Standalone pure engine governing the strict 5 wardrobe categories (`top`, `bottom`, `underwear`, `hosiery`, `others`), natural-language constraints (`"/ootd with no top and no pants"`), `bra` + `panties` sub-type pairing, hardware CSPRNG, `/style` AI curation, slot locking/swapping, anti-repeat cooldown, and 100% offline `/ootd` resilience.
3. **Designer Persona, Plain-Text Memory & Chat Layer:** AI Persons with encrypted portraits, personality prompts, Tone/Sensuality dials, extensible plain-text per-person Memory viewable/editable in `Settings`, and WhatsApp-style encrypted chat with single-pass multimodal vision + auto-learning memory (1 OpenRouter request per turn).
4. **Zero-Leak Security & Portability:** Unified App Master Passphrase + opt-in Face ID / Touch ID quick unlock, inactivity-based non-destructive lock overlay, `PrivacyShield`, and chunked OOM-safe encrypted `.ootdbackup` iPhone-to-iPhone export & import.

---

## 2. Core User Stories (`US-101` – `US-111`)

### US-101: OpenRouter Unified Gateway with Grok Default & Single-Pass Efficiency

- **User Story:**
  - _As a_ user chatting and tagging photos daily,
  - _I want_ OpenRouter to use **Grok** (`x-ai/grok-4.7`) by default, support multi-turn multimodal conversations, and avoid wasteful extra API calls when learning memories or classifying chat photos,
  - _So that_ responses are fast, expressive, and economical with my monthly quota.
- **Acceptance Criteria:**
  - OpenRouter API key remains stored in hardware-backed iOS Keychain (`POCKETPICK_OPENROUTER_API_KEY`) targeting `https://openrouter.ai/api/v1/chat/completions`.
  - `DEFAULT_OPENROUTER_MODEL = 'x-ai/grok-4.7'`; `google/gemini-3.8-flash` remains selectable as a preset in `Settings`.
  - `llmClient.ts` supports multi-turn `messages` (`system`, `user`, `assistant`) + crisp `1024px` multimodal `image_url` payloads.
  - Chat replies piggyback hidden `<memory_add>` and `<photo_meta>` tags parsed & stripped before display so **1 chat turn = 1 OpenRouter call**.
  - Monthly quota barrier is configurable in `Settings` (default **500 requests/month**).

### US-102: AI Person (Persona) Creation, Encrypted Portrait & Personality Prompt

- **User Story:**
  - _As a_ user creating my personal styling circle,
  - _I want_ each AI stylist to be a dedicated **Person** with a unique name, encrypted portrait photo, bio tagline, and configurable personality prompt (plus starter presets),
  - _So that_ every conversation and outfit pick feels distinct and tailored to my taste.
- **Acceptance Criteria:**
  - Create/edit Person with unique name (case-insensitive), portrait avatar photo (private camera or library, encrypted in app sandbox only), tagline, Tone/Sensuality chips, curated Designer Personality presets, and free-text Personality Prompt.
  - Authoritative Personality Prompt is injected at highest system-role priority on every chat, photo critique, and `/ootd`.
  - Swipe-left deletion requires two-step confirmation and permanently shreds avatar, chat logs, and memories.

### US-103: Four-Tab Navigation (`Chats`, `Wardrobe`, `Past OOTD`, `Settings`) & Day-1 Onboarding

- **User Story:**
  - _As a_ new or returning user,
  - _I want_ four clear bottom tabs (**`Chats`**, **`Wardrobe`**, **`Past OOTD`**, **`Settings`**) and a gentle Day-1 Quick Start guide,
  - _So that_ I never hit dead-end empty screens or missing-API-key errors on my first launch.
- **Acceptance Criteria:**
  - Bottom tabs: `Chats` (`index.tsx`), `Wardrobe` (`wardrobe.tsx`), `Past OOTD` (`past-ootd.tsx`), `Settings` (`settings.tsx`).
  - All legacy PocketPick tabs (`Tickets`, `Randomizer/Pick`, `Timeline/History`) and multi-vault routes are removed.
  - When unconfigured (missing API key, 0 Persons, or 0 Wardrobe items), `Chats` displays a dismissible **Quick Start Checklist** (1. Add OpenRouter Key → 2. Create First Stylist → 3. Add Wardrobe Photos).

### US-104: Frictionless Unified App Lock with Opt-In Face ID & Non-Destructive Inactivity Timeout

- **User Story:**
  - _As a_ daily user unlocking the app multiple times a day (including while getting dressed for a fit check),
  - _I want_ one App Master Passphrase backed by **opt-in Face ID / Touch ID quick unlock**, an **inactivity-based** auto-lock timer (default 15m, configurable), and a non-destructive lock overlay,
  - _So that_ my private wardrobe and chats stay cryptographically protected without ever kicking me out mid-sentence or forcing tedious passphrase re-entry while dressing.
- **Acceptance Criteria:**
  - First launch creates the Unified App Master Passphrase (`PBKDF2-HMAC-SHA512`, 100k rounds) deriving the 256-bit `appSessionKey`.
  - Opt-in **Face ID / Touch ID** toggle in `Settings` unlocks the app in one glance while keeping Master Passphrase as fallback.
  - `useAutoLock` tracks **user inactivity (`lastActiveTimestamp`)** rather than login time (`unlockedAt`) so active chatting never triggers a mid-typing lock.
  - `AppLockGate` renders as an overlay above the navigation tree so unlocking restores the exact active chat, scroll position, and unsent draft.

### US-105: Messenger / WhatsApp-Style Encrypted Chat with Optimistic Save & Retry

- **User Story:**
  - _As a_ user chatting with any AI Person,
  - _I want_ a WhatsApp/Messenger-style chat where I can send text and photos securely on-device, with zero lost messages if Wi-Fi drops,
  - _So that_ my intimate conversations feel responsive, private, and reliable anywhere.
- **Acceptance Criteria:**
  - `chat/[id].tsx` renders right-aligned user bubbles, left-aligned Person bubbles with mini avatar, timestamps, tappable encrypted photo thumbnails, typing indicator, and per-person unsent draft preservation across tab switches.
  - Composer supports multi-line text, `+` attachment menu (**Private Camera**, **Import from Device**, **Pick from `Wardrobe` / `Past OOTD`**), staged preview, and quick command bar (`✨ OOTD`, `/secret`, `/style`).
  - Messages persist locally in SQLCipher `chat_messages` with **AES-256-GCM** encryption (12-byte IV, 16-byte Tag, AAD = `personId`).
  - User messages and photos save locally before calling OpenRouter; on failure, an inline **`[ Retry ]`** prompt appears without losing the user's message.
  - Deleted garments referenced in older chats render a graceful **Tombstone Placeholder** (`[Removed from Wardrobe — "<item>"]`).

### US-106: App-Only Private Photos, Strict Categories, `item`, `descriptions` & Batch AI Auto-Tagging

- **User Story:**
  - _As a_ privacy-focused user organizing dozens of garments inside the app,
  - _I want_ photos stored **only inside the app sandbox** (never in iOS Photos, with zero raw Share Sheet leak traps), optimized for speed, tagged with a strict **category**, **`item`** label, and editable **`descriptions`**, plus fast batch AI auto-tagging,
  - _So that_ importing my closet takes seconds instead of tedious manual per-photo editing.
- **Acceptance Criteria:**
  - Camera captures and imports resize cleanly to `1600px` full-res + `320px` thumbnail, encrypt via AES-256-GCM into sandbox-relative `.enc` files, and unconditionally shred temp files in `finally`. Zero writes to Apple Photos; single-photo raw AirDrop/Share is removed so intimate photos cannot leak to iOS Photos.
  - **Strict 5-Category Enum (Wardrobe):** `top`, `bottom`, `underwear`, `hosiery`, `others`.
  - **`item` Field:** AES-256-GCM encrypted garment label (`"tshirt"`, `"pants"`, `"bra"`, `"panties"`, `"sheer thigh-highs"`). Quick chips for `underwear` surface canonical sub-types (`Bra`, `Bralette`, `Panties`, `Thong`, `Lingerie Set`, `Bodysuit`).
  - **`descriptions` Field:** AES-256-GCM encrypted notes editable manually or populated via **`AI Suggestion`** and freely customized before pressing `Save`.
  - Importing/capturing while a category filter pill is active automatically assigns that category to the batch; a cancellable **`✨ Auto-Analyze Unsorted (N)`** banner runs concurrent AI classification with quota preview.
  - Supports multi-select bulk move, bulk recategorize, bulk delete, and `HMAC-SHA256` blind-index deduplication.

### US-107: Multimodal Vision Replies to Attached Chat Photos + Text

- **User Story:**
  - _As a_ user attaching a photo in chat with a Person,
  - _I want_ her to visually read both the attached photo and my text message (plus recent conversation & her Personal Memory) in a single crisp response,
  - _So that_ she comments authentically on what she sees and answers what I wrote.
- **Acceptance Criteria:**
  - Attached photo is decrypted in memory (resized to max `1024px` JPEG) and sent via OpenRouter `image_url` + `text` alongside recent chat turns, the Person's authoritative prompt, and her Plain-Text Memory.
  - Plaintext buffers are immediately discarded after the request completes.

### US-108: Constraint-Aware `/ootd` Engine, Quick-Builder Sheet, Bra+Panties Pairing & Offline Support

- **User Story:**
  - _As a_ user requesting an outfit via `/ootd` (whether typing `"/ootd with no top and no pants"` or tapping quick visual toggles),
  - _I want_ any Person to pick strictly from **`Wardrobe`** items (never `Past OOTD` body shots), honor every exclusion/inclusion, pair **1 bra + 1 panties** when appropriate, adapt her reply to her personality prompt + recent chats + memory, and still pick offline via CSPRNG if I have no internet,
  - _So that_ getting an outfit is effortless on an iPhone keyboard and always matches exactly what I asked for.
- **Acceptance Criteria:**
  - Supports both natural-language `/ootd [constraints]` and a 1-tap **`✨ OOTD` Quick-Builder Sheet** (`Top`, `Bottom`, `Bra`, `Panties`, `Hosiery`, `Others` toggles + `Bra & Panties Only` preset + `Random` vs `AI Styled`).
  - Synonym exclusions (`no top`, `no shirt`, `no pants`, `no bottom`, `no hosiery`, `no underwear`, `no others`) and inclusions (`only bra and panties`) resolve cleanly.
  - When `bra` & `panties` are requested—or when `top` & `bottom` are excluded and `underwear` contains both bra-type and panty-type items—the engine selects **1 bra + 1 panties** as two distinct slots.
  - Excluded categories are strictly omitted from both the OOTD Look Card and AI commentary.
  - Works 100% offline locally via hardware CSPRNG (`csprng.ts`) with a `[ Generate Styling Note ]` retry button.

### US-109: AI Human-Body Subject Classification (`Wardrobe` vs. `Past OOTD`) with Undo Toast

- **User Story:**
  - _As a_ user adding both isolated garment photos and mirror try-on photos,
  - _I want_ AI vision to detect whether a **human body is the main subject**—routing isolated garments into **`Wardrobe`** and on-body try-on/mirror shots into **`Past OOTD`**, with a clear toast + one-tap **`Undo`** so photos never mysteriously vanish,
  - _So that_ my garment catalog and worn lookbook organize themselves accurately without surprises.
- **Acceptance Criteria:**
  - Every photo has `photoKind: 'wardrobe' | 'past_ootd'`.
  - AI classification evaluates `hasHumanBodyMainSubject: boolean`: `false` → `Wardrobe`, `true` → `Past OOTD`.
  - When auto-sorting moves photo(s) out of the currently viewed tab, a toast appears: `"Moved N photo(s) to Past OOTD (human body detected) [ View ] [ Undo ]"`.
  - Manual one-tap **`Move to Wardrobe`** / **`Move to Past OOTD`** is always available in `PhotoDetailModal` and bulk selection.

### US-110: Per-Personality Extensible Plain-Text Living Memory (Viewable & Editable in `Settings`)

- **User Story:**
  - _As a_ user building chemistry with each AI Person,
  - _I want_ each Person to maintain her own **distinct, plain-text preference memory** (styles I like, favorite colors, fabrics that make me feel special and tingle, custom evolving sections) that auto-expands from chats with zero extra API calls and is viewable/editable in **`Settings`**,
  - _So that_ she remembers what excites me without bloating context, and I stay in full transparent control.
- **Acceptance Criteria:**
  - Stored per Person in SQLCipher as human-readable Markdown (`memory_text`) with extensible sections (`Preferred Styles & Silhouettes`, `Favorite Colors & Palettes`, `Fabrics & Textures That Make Me Tingle`, `Fit, Mood & Sensual Preferences`, `Custom Notes & Observations`, plus dynamic custom sections).
  - `Settings → Personality Memories` lists every Person; tapping opens her plain-text Markdown editor with `+ Add Trait`, raw text editing, and `Jump to Chat →`.
  - Piggybacked `<memory_add>` markers from chat replies cleanly deduplicate and append new durable preferences into that Person's memory without extra LLM calls.

### US-111: Chunked OOM-Safe Encrypted iPhone-to-iPhone Backup Export & Import

- **User Story:**
  - _As a_ user upgrading to a new iPhone with hundreds of private photos and customized personalities,
  - _I want_ a fast, crash-free encrypted **Export** & **Import** function (`.ootdbackup`) transferring all Personalities, Plain-Text Memories, Avatars, `Wardrobe` & `Past OOTD` photos, Chats, and Saved Looks,
  - _So that_ switching iPhones is effortless and completely secure even with a large photo library.
- **Acceptance Criteria:**
  - Uses sequential AES-256-GCM frames (`PBKDF2-HMAC-SHA512`, 100k rounds, 32-byte salt) keeping peak RAM under ~5 MB even for 500+ photos.
  - **Export (`Settings → Backup & Transfer`):** Prompts for Backup Passphrase, shares `.ootdbackup` via iOS Share Sheet (AirDrop / Save to Files), and unconditionally shreds temp cache file in `finally`. Excludes OpenRouter API key by default.
  - **Import (`Settings → Backup & Transfer`):** Verifies Backup Passphrase and every frame's GCM auth tag (rejecting wrong passphrase or 1-byte tamper cleanly), re-encrypts everything under the new iPhone's `appSessionKey`, deduplicates photos by `fileHash`, and shreds temp import file in `finally`.

---

## 3. Pleasure & Sensuality Enhancements (`US-201` – `US-208`)

- **US-201 — Layered "Unveil" Reveal Ritual (with Instant `Reveal All`):** Optional skin-outward veiled cards (_Underwear → Hosiery → Top → Bottom → Others_, restricted to active requested slots) revealed on tap with soft haptics—plus a prominent **`Reveal All`** pill for rushed mornings.
- **US-202 — Secret Layer Mode (`/secret`):** Picks hidden intimate foundation (`Bra` + `Panties` + `Hosiery` / `Underwear` + `Hosiery`) to wear secretly beneath an outer outfit.
- **US-203 — Interactive "Keep & Swap" Negotiation:** Lock favorite pieces on an OOTD card and swap individual unlocked slots with playful in-character reactions.
- **US-204 — Post-OOTD "Fit Check" Mirror Loop (`/fitcheck`):** One-tap `Send Fit Check` launches the isolated in-app camera, routes the mirror photo into **`Past OOTD`**, and sends it to the Person with full memory of the chosen outfit.
- **US-205 — AI-Curated Styling Mode (`/style [mood]`) & Tactile Auto-Tagging:** `AI Suggestion` captures fabric feel, texture, cut, color, and mood; `/style [mood]` intentionally harmonizes 1 piece per active slot (with CSPRNG fallback).
- **US-206 — Sensual Luxury Themes (`Velvet Noir` & `Champagne Silk`) & Haptics:** Adds obsidian-plum/champagne-gold and warm-ivory/rose-espresso editorial themes to `ThemeSwitcher`.
- **US-207 — Encrypted Lookbook & Anti-Repeat Cooldown:** Bookmark `♡ Save Look` / `Worn Today` into `Past OOTD → Saved Looks` (with deleted-item tombstone safety) and optionally avoid repeating recently worn garments.
- **US-208 — Persona Tone/Sensuality Dials & Contextual Greetings:** Quick Tone/Sensuality chips integrated cleanly into each Person's prompt.
