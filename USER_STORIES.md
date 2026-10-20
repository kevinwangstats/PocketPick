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

### US-008: System LLM Provider Configuration (Gemini & DeepSeek Only)

- **User Request:** _"In the bottom menu, "System", LLM configuration should only support gemini and deepseek for now. The model is defaulted to gemini 3.8 flash and deepseek v4 flash (agent might have outdated knowledge about if these models are available)"_
- **User Story:**
  - _As a_ user configuring AI assistance in the System settings tab,
  - _I want_ the app to support only Gemini and DeepSeek providers, defaulting to `gemini 3.8 flash` and `deepseek v4 flash`,
  - _So that_ I can use high-speed, cost-effective models without extraneous provider options.
- **Acceptance Criteria:**
  - Under the **System** tab (`ApiKeySettings`), provider selection options are restricted to:
    1. **`GEMINI`** — Default model: `gemini-3.8-flash`.
    2. **`DEEPSEEK`** — Default model: `deepseek-v4-flash`.
  - Stored securely in iOS Keychain via `expo-secure-store`.
  - Outgoing LLM requests in `llmClient.ts` use the corresponding provider endpoints:
    - Gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`
    - DeepSeek: `https://api.deepseek.com/chat/completions` (OpenAI-compatible protocol with model `deepseek-v4-flash`).
