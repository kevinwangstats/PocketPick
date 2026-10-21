# PocketPick — Living User Stories & Feature Specifications

> **Living Document Notice:** This document reflects the active, current state of user requests and features in PocketPick. Whenever new feedback or requests replace previous behavior, specifications are directly edited to maintain a single source of truth without accumulating obsolete historical states.

---

## 1. Vault Management & Security

### US-001: Unique Vault Naming

- **User Request:** _"Vaults should not share the same name"_
- **User Story:**
  - _As a_ user managing multiple secure vaults,
  - _I want_ the system to prevent creating vaults with duplicate names,
  - _So that_ I do not get confused between vaults or risk saving confidential data into the wrong context.
- **Acceptance Criteria:**
  - When creating a new vault in `CreateVaultModal`, the entered name is checked against existing vault names (case-insensitive, trimmed).
  - If a duplicate name is entered, creation is blocked and an inline warning indicates that a vault with that name already exists.
  - Vault creation proceeds only when the name is unique.

### US-002: Swipe-to-Reveal Vault Deletion with Two-Step Confirmation

- **User Request:** _"There is currently no way to delete a vault"_ and _"the delete button for vault should show via swipe, requiring a second confirmation"_
- **User Story:**
  - _As a_ security-conscious user,
  - _I want_ to delete a vault by swiping left on its card to reveal a delete action, followed by a mandatory two-step confirmation,
  - _So that_ I can permanently purge unneeded vaults without accidental triggering or static visual clutter.
- **Acceptance Criteria:**
  - In the Vaults list, each `VaultCard` supports a horizontal swipe-left gesture revealing a red `[ DELETE ]` action button.
  - Tapping outside or tapping the open card snaps it closed.
  - Vertical list scrolling is not interrupted while swiping horizontally.
  - Initiating deletion triggers a **Step 1** alert: _"Delete Vault: Are you sure you want to delete '[name]'?"_
  - Confirming triggers a mandatory **Step 2** alert: _"Confirm Permanent Deletion: FINAL WARNING: All encrypted notes, photos, and cryptographic keys will be permanently shredded from storage. This action cannot be undone. Proceed?"_
  - Upon final confirmation, all encrypted files on disk are shredded via `shredFile`, database cascade deletion removes records, session lock is triggered, and a success haptic is fired.

---

## 2. Media & Photo Pipeline

### US-003: Multi-Selection Photo Import

- **User Request:** _"photo selection should allow multiple selection"_
- **User Story:**
  - _As a_ user adding visual evidence or archives to my vault,
  - _I want_ to select multiple photos simultaneously from the system photo picker,
  - _So that_ I can import photos in bulk without having to reopen the picker individually for each picture.
- **Acceptance Criteria:**
  - The photo picker in `EncryptedGallery` configures `allowsMultipleSelection: true`.
  - The user can select multiple images in a single picker session.
  - All selected images are queued, processed through the encryption pipeline, and imported into the active vault.

### US-004: Blind-Index Photo Deduplication

- **User Request:** _"Repeated photos should not be imported from a user's perspective. Can this be done?"_
- **User Story:**
  - _As a_ user,
  - _I want_ PocketPick to prevent importing duplicate photos into the same vault,
  - _So that_ I do not waste vault storage or clutter my gallery with duplicate entries.
- **Acceptance Criteria:**
  - **Zero-Leak Deduplication:** In `imagePipeline.ts`, an `HMAC-SHA256` hash of raw image bytes is calculated using the vault session key (`computeImageHash`). Plaintext image hashes are never exposed in SQLite.
  - **Pre-Encryption Guard:** Before encrypting or storing thumbnails, SQLite checks for an existing record with matching `(vault_id, file_hash)`.
  - **Duplicate Handling:** If duplicate bytes are detected:
    - Re-encryption and file writing are skipped.
    - Temporary cache files are immediately shredded in `finally`.
    - Returns `{ isDuplicate: true }`.
  - **In-Batch Deduplication:** Multi-selection picker batches are deduplicated in-memory so identical selections within the same batch are imported only once.
  - **User Feedback:**
    - If 1 duplicate is picked: _"This photo is already stored in your vault."_
    - If a batch has duplicates: _"Imported X photos. Y duplicate photo(s) were skipped."_

### US-005: Photo Text Association with User Typing & AI Suggestions

- **User Request:** _"And each photo should be associated with some text, that either the user can type in, or have the LLM function add in suggestions and allow user to customize the returned response."_
- **User Story:**
  - _As a_ user storing photos in a vault,
  - _I want_ each photo to have associated text notes that I can either type manually or generate via AI suggestions, and freely customize before saving,
  - _So that_ my photos carry meaningful context, searchable keywords, and transcribed details.
- **Acceptance Criteria:**
  - **Authenticated Encryption:** Photo text is encrypted with AES-256-GCM using the vault key and stored in `encrypted_payload`, `payload_iv`, and `payload_tag` on the photo resource row.
  - **Manual Input:** When inspecting a photo in `FullImageModal`, an editable text input allows typing custom notes and saving via `[ SAVE NOTE ]`.
  - **AI Suggestions:** Tapping `+ AI SUGGEST` runs ephemeral OCR on the decrypted photo bytes, retrieves the vault's master prompt, queries the LLM, and populates the text field with the suggestion.
  - **Customization Before Save:** The user can inspect, tweak, rewrite, or append to the AI-generated text before pressing `[ SAVE NOTE ]`.
  - **Visual Badges:** Photos with saved notes display a `NOTE` tag on their gallery thumbnail.
  - **Randomizer Display:** When a photo with associated text is picked, the decrypted text is displayed on the winning card.

---

## 3. Random Selection & Decision Engine

### US-006: In-Vault & Tab Random Selection (Strictly Uniform & Fast)

- **User Request:** _"The pick functinoality is good, but it should be done within each vault."_, _"picker should always use uniform selection, remove weighted functionality"_, and _"the picker should work a little fater."_
- **User Story:**
  - _As a_ user selecting an item from my vault,
  - _I want_ the picker to operate directly inside the vault, execute quickly, and always select items with strictly uniform equal probability (1/N),
  - _So that_ selection is fast, unbiased, and free of unnecessary weighting complexity.
- **Acceptance Criteria:**
  - **In-Vault Availability:** Inside `VaultDetailScreen` (`src/app/vault/[id].tsx`), a dedicated **`[ PICK ]`** segmented tab is available alongside **`[ TICKETS ]`** and **`[ PHOTOS ]`**.
  - **Strictly Uniform Selection:** The selection algorithm always uses `pickUniform` via unbiased hardware CSPRNG rejection sampling. Weighted selection functionality is completely removed from the picker engine and UI.
  - **Snappy Animation Speed:** The shuffle animation duration is reduced to a fast, tactile ~450ms (initial 25ms delay, 8 ticks, smooth deceleration), delivering quick results while maintaining haptic feedback.
  - **Pool Filtering:** Users can filter the eligible pool by item type (**`ALL`**, **`TICKETS`**, or **`PHOTOS`**).
  - **Decrypted Winner Display:** Shows the winning ticket text or photo thumbnail with its decrypted notes on `WinnerCard` labeled `MODE: UNIFORM (1/N)`.

---

## 4. LLM Configuration & Vault Intelligence

### US-007: Vault-Level LLM Master Prompt

- **User Request:** _"Each vault should have a vault-level LLM master prompt which is appended whenever a prompt is made."_
- **User Story:**
  - _As a_ user configuring a vault for a specific domain (e.g., receipts, medical records, task lists),
  - _I want_ to set a vault-level LLM master prompt that automatically appends to every query made in that vault,
  - _So that_ all OCR analyses, summaries, and text suggestions adhere to the vault's specific context and formatting guidelines.
- **Acceptance Criteria:**
  - Each vault row stores an optional `llm_master_prompt` in SQLite.
  - The vault detail header includes a **`[ MASTER PROMPT ]`** button opening `VaultMasterPromptModal`.
  - Users can choose from presets (_Concise Bullets_, _Finance & Receipts_, _Document Archive_, _Technical/Dev_) or type custom instructions.
  - When any LLM query is executed within the vault (in `FullImageModal` or `LlmAnalysisModal`), the vault's master prompt is appended to the prompt payload:
    ```text
    [User Prompt / Analysis Request]

    [Vault Master Prompt]:
    <Vault-specific instructions>
    ```

### US-008: Multi-Provider LLM Configuration (Gemini, DeepSeek, & Kimi)

- **User Request:** _"The app should be able to hold multiple api keys, one for each of the LLM providers. I also want to add another one for kimi, with the default to kimi-k2.6 model."_
- **User Story:**
  - _As a_ user configuring AI intelligence providers in the System settings tab,
  - _I want_ the app to store separate API keys for each supported LLM provider (Gemini, DeepSeek, and Kimi) and allow instant switching between them,
  - _So that_ I can seamlessly switch providers without re-entering my API keys, and leverage Kimi with its default `kimi-k2.6` model.
- **Acceptance Criteria:**
  - **Multi-Key Isolation:** Stored in hardware-backed iOS Keychain (`SecureStore`) using independent, isolated keys per provider (`POCKETPICK_LLM_API_KEY_gemini`, `POCKETPICK_LLM_API_KEY_deepseek`, `POCKETPICK_LLM_API_KEY_kimi`).
  - **Supported Providers & Default Models:**
    1. **`GEMINI`** — Default model: `gemini-3.8-flash`.
    2. **`DEEPSEEK`** — Default model: `deepseek-v4-flash`.
    3. **`KIMI`** — Default model: `kimi-k2.6`.
  - **Provider Indicator:** The System tab (`ApiKeySettings`) displays indicators showing which providers currently have keys saved, allowing individual key updates or deletion per provider.
  - **Network Endpoints:** Outgoing LLM requests in `llmClient.ts` route to the corresponding provider endpoints:
    - Gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`
    - DeepSeek: `https://api.deepseek.com/chat/completions` (OpenAI-compatible protocol with model `deepseek-v4-flash`).
    - Kimi: `https://api.moonshot.cn/v1/chat/completions` (OpenAI-compatible protocol with model `kimi-k2.6`).

---

## 5. System UI & Privacy Invariants

### US-009: Clean App Launch & Dev Overlay Suppression

- **User Request:** _"The Top Status Bar: 'Download 100%' should be removed, it will make users scared that we moved their secret data"_, and _"Both the status bars should be remove"_
- **User Story:**
  - _As a_ user launching PocketPick,
  - _I want_ the app to open with a completely clean interface free of "Download 100%" or bottom popup status bars,
  - _So that_ I am confident my secret, offline vault data is completely secure and not being transmitted or downloaded.
- **Acceptance Criteria:**
  - **Top Download Bar Disabled:** React Native's `RCTDevLoadingView` is disabled at native application launch in `AppDelegate.swift` via `RCTDevLoadingViewSetEnabled(false)`. The top "Downloading JavaScript bundle 100%" bar is completely prevented from displaying.
  - **Bottom Status / LogBox Popup Disabled:** In `src/app/_layout.tsx`, `LogBox.ignoreAllLogs(true)` is activated, preventing blank or dev notification overlays from mounting at the bottom of the screen.
  - **Production Invariant:** In production/release builds, dev banners and loading views remain completely stripped and absent.

### US-010: Adaptive Theme Engine & Appearance Customization

- **User Request:** _"I want to edit the app UI. Right now the whole app is quite in your face hardcore. It is dark themed, and it is all caps. This can feel too much and strong for a female user, who may expect light theme, more cute and classic blue and white ios design, or white and pink designs. Can you design a few themes that we can swap out in the system tab"_
- **User Story:**
  - _As a_ user personalizing the application aesthetic,
  - _I want_ to select between multiple visual themes (Classic iOS Blue & White, Sakura Pink, and Cyber Terminal Dark) with adaptive casing and typography,
  - _So that_ the interface feels elegant, cute, and accessible according to personal taste rather than exclusively hardcore dark monochrome.
- **Acceptance Criteria:**
  - **Theme Switcher in System Tab:** An appearance selector in the **System** tab (`ThemeSwitcher`) allows immediate theme switching with visual palette swatches and haptic feedback.
  - **Included Themes:**
    1. **`Classic iOS` (Light • Apple Blue & White):** Crisp light background (`#F2F2F7`), white card surfaces, Apple system blue accents (`#007AFF`), 14px rounded corners, standard iOS San Francisco typography, and natural title/sentence casing.
    2. **`Sakura Pink` (Cute • Rose & Cream):** Warm soft blush background (`#FFF5F7`), white surfaces with delicate rose borders (`#FCE7F3`), sweet vibrant pink accents (`#EC4899`), 16px soft rounded corners, gentle typography, and natural casing.
    3. **`Cyber Terminal` (Dark • High-Contrast Mono):** The original tactical dark theme with pure black (`#000000`), sharp 0px corners, monospace Courier font, and uppercase styling.
  - **Adaptive Typography & Casing:** Monospace and forced ALL-CAPS styling are restricted to the Cyber theme; light and cute themes employ natural title/sentence casing and system typography.
  - **Cross-App Propagation & Consistency:** Tab navigation bar, stack headers, buttons, cards, inputs, segmented controls, modal backgrounds, and the iOS status bar (`StatusBar`) dynamically adjust to the active theme.
  - **Complete Screen & Modal Coverage:** All screens (Vaults, Vault Detail, Randomizer, Audit History, Settings) and all interactive modals (Unlock Vault, Create Vault, Ticket Editor, Master Prompt, Full Media Viewer, OCR & LLM Analysis, Pool Filter) adhere consistently to the active theme palette and typography without retaining hardcoded pitch-black styling.
  - **Persistence:** Selected theme choice is preserved across restarts via `expo-secure-store`.

### US-011: Configurable Vault Auto-Lock Timeout

- **User Request:** _"Can we implement a mechnism so that when I open a vault with password, it will stay open for x minutes, with x configurable in the system tab as an integer."_
- **User Story:**
  - _As a_ user unlocking and managing my encrypted vaults,
  - _I want_ the vault to stay open for `x` minutes after entering my passphrase, with `x` configurable as an integer in the System tab,
  - _So that_ I do not have to repeatedly re-enter my passphrase during my active session while ensuring memory keys are automatically zeroized once the duration expires.
- **Acceptance Criteria:**
  - **System Tab Setting:** Under the **System** tab (`VaultTimeoutSettings`), users can configure the auto-lock timeout duration `x` in minutes as a non-negative integer.
  - **Quick Presets & Custom Input:** Features preset selections (`1m`, `5m`, `15m`, `30m`, `60m`) alongside a direct numeric input for any integer value.
  - **Persistence:** Stored securely in `expo-secure-store` with a default of 5 minutes (`POCKETPICK_VAULT_TIMEOUT_MINUTES`).
  - **Foreground Expiration:** When a vault is opened, `unlockedAt` timestamp is recorded in `useSessionStore`. A periodic timer automatically locks the vault and zeroizes the key buffer when `x` minutes have elapsed.
  - **Background & Inactive Transition:**
    - `PrivacyShield` immediately conceals the application interface in the iOS app switcher.
    - If `x === 0`, memory keys are immediately zeroized.
    - If `x > 0`, keys remain protected in memory while within the `x`-minute window; if `x` minutes elapse while backgrounded, keys are zeroized upon return to the active state.
