# Phase 5: On-Device OCR, LLM Integration & Quota Guard

## 1. Overview & Objectives
Phase 5 introduces intelligent text extraction and optional cloud LLM analysis while strictly upholding PocketPick's zero-leak privacy principles and cost controls.

Key architectural priorities:
1. **Hardware-Backed API Key Security:** User-provided LLM API keys (OpenAI / Anthropic / Gemini) are stored strictly inside the iOS Keychain using `expo-secure-store` with device-only accessibility.
2. **Strict Monthly Quota Guard:** A transactional SQLite barrier limits cloud LLM queries to a maximum of 100 requests per calendar month, preventing unintended financial charges or API overuse.
3. **Secure Ephemeral OCR:** Encrypted photos are temporarily decrypted to an ephemeral cache path, processed on-device via Apple Vision / ML Kit, and cryptographically shredded in an ironclad `finally` block.
4. **Minimalist LLM Inspection Client:** A bottom-sheet interface allowing users to review extracted OCR text, append prompts, and submit requests to the LLM.

---

## 2. Prerequisites & Dependencies
- Completion of Phases 1 through 4.
- Packages:
  ```bash
  npx expo install expo-secure-store expo-file-system
  npm install @react-native-ml-kit/text-recognition @gorhom/bottom-sheet
  ```
- CocoaPods update: `cd ios && pod install` to link ML Kit Text Recognition / iOS Vision frameworks.

---

## 3. Architecture & File Layout
```
PocketPick/
├── src/
│   ├── services/
│   │   ├── ocr/
│   │   │   ├── ocrEngine.ts          # Apple Vision / ML Kit text extraction wrapper
│   │   │   └── ephemeralProcessor.ts # Decrypt -> OCR -> finally shred pipeline
│   │   ├── quota/
│   │   │   ├── quotaManager.ts       # Atomic monthly 100-request quota enforcer
│   │   │   └── types.ts
│   │   └── llm/
│   │       ├── llmClient.ts          # Multi-provider client (OpenAI, Gemini, Anthropic)
│   │       └── promptTemplates.ts    # Minimalist prompt presets (Summarize, Extract Tasks)
│   ├── components/
│   │   ├── settings/
│   │   │   ├── ApiKeySettings.tsx    # SecureStore key configuration UI
│   │   │   └── QuotaProgressCard.tsx # Monochromatic progress bar (e.g., 23 / 100 calls)
│   │   └── llm/
│   │       ├── LlmAnalysisSheet.tsx  # Bottom sheet for OCR preview + prompt input
│   │       └── LlmResponseView.tsx   # Markdown / plain text response card
│   └── app/
│       └── (tabs)/settings.tsx       # System settings screen
└── __tests__/
    ├── services/
    │   ├── ephemeralProcessor.test.ts
    │   ├── quotaManager.test.ts
    │   └── llmClient.test.ts
    └── components/
        └── QuotaProgressCard.test.tsx
```

---

## 4. Detailed Implementation Tasks

### 4.1 Secure API Key Management (Task 5.1)
- [ ] Implement `src/services/llm/llmKeyStore.ts`:
  - `getLlmApiKey(): Promise<string | null>` from SecureStore key `POCKETPICK_LLM_API_KEY`.
  - `setLlmApiKey(key: string): Promise<void>` with Keychain accessibility `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
  - `removeLlmApiKey(): Promise<void>`.
  - Validation: Mask API keys in UI (`sk-...••••1234`).
- [ ] Build `src/components/settings/ApiKeySettings.tsx`:
  - High-contrast input field with toggleable show/hide and provider selector (OpenAI / Gemini / Anthropic).
  - Test connection button to validate key with a 1-token test prompt before persisting.

### 4.2 Transactional Quota Guard (Task 5.2)
- [ ] Implement `src/services/quota/quotaManager.ts`:
  ```typescript
  export interface QuotaStatus {
    currentCount: number;
    maxLimit: number;
    remaining: number;
    isBlocked: boolean;
    periodMonth: string;
  }

  export class QuotaExceededError extends Error {
    constructor() {
      super('Monthly LLM quota exceeded (100 requests max). Operation blocked.');
      this.name = 'QuotaExceededError';
    }
  }

  export async function getQuotaStatus(db: DrizzleClient): Promise<QuotaStatus>;
  export async function incrementAndEnforceQuota(db: DrizzleClient): Promise<number>;
  ```
- [ ] Implement atomic increment logic using Drizzle / OP-SQLite:
  - Calculate current month string `YYYY-MM`.
  - Ensure row exists in `api_quotas` table for current month.
  - Execute atomic update:
    ```sql
    UPDATE api_quotas 
    SET request_count = request_count + 1, last_request_at = strftime('%s', 'now') 
    WHERE period_month = ? AND request_count < 100;
    ```
  - If changes count === 0, fetch current count and throw `QuotaExceededError`.
- [ ] Write unit tests in `__tests__/services/quotaManager.test.ts`:
  - Verify boundary condition at 99 -> 100 succeeds.
  - Verify 100th call blocks and throws `QuotaExceededError`.
  - Verify rollover when month changes from `2026-10` to `2026-11`.

### 4.3 Secure Ephemeral OCR Processing (Task 5.3)
- [ ] Implement `src/services/ocr/ephemeralProcessor.ts`:
  ```typescript
  import * as FileSystem from 'expo-file-system';
  import TextRecognition from '@react-native-ml-kit/text-recognition';
  import { decryptBuffer } from '../../crypto/cipher';
  import { shredFile } from '../media/fileShredder';

  export async function processEphemeralOcr(
    encryptedFilePath: string,
    key: Buffer,
    iv: string,
    tag: string
  ): Promise<string> {
    const tempFileName = `ephemeral_ocr_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`;
    const tempPath = `${FileSystem.cacheDirectory}${tempFileName}`;

    try {
      // 1. Read encrypted file
      const encryptedData = await FileSystem.readAsStringAsync(encryptedFilePath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Decrypt in memory
      const decryptedBuffer = decryptBuffer(
        { ciphertext: encryptedData, iv, tag },
        key
      );

      // 3. Write ephemeral file to sandbox cache
      await FileSystem.writeAsStringAsync(tempPath, decryptedBuffer.toString('base64'), {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. Run on-device text recognition
      const result = await TextRecognition.recognize(tempPath);
      return result.text;
    } finally {
      // 5. IRONCLAD INVARIANT: Always shred ephemeral decrypted file immediately
      await shredFile(tempPath).catch((err) => {
        console.error('Critical: Failed to shred ephemeral OCR file', err);
      });
    }
  }
  ```
- [ ] Write unit tests with mocked filesystem asserting that:
  - `shredFile` is called even when `TextRecognition.recognize` rejects with an error.
  - `shredFile` is called when decryption succeeds normally.
  - Zero decrypted files remain in `FileSystem.cacheDirectory`.

### 4.4 LLM Client & Inspection Sheet UI (Task 5.4)
- [ ] Implement `src/services/llm/llmClient.ts`:
  - Configurable endpoints for OpenAI (`v1/chat/completions`), Anthropic (`v1/messages`), or Google Gemini (`v1beta/models`).
  - Calls `incrementAndEnforceQuota()` immediately prior to dispatching HTTP request.
  - Strict timeout (15 seconds) and cancellation support via `AbortController`.
- [ ] Implement `src/components/llm/LlmAnalysisSheet.tsx`:
  - Modern bottom sheet presented over the active ticket or photo.
  - Step 1: Previews recognized OCR text with ability to edit or copy.
  - Step 2: Preset prompt pills ("Extract Action Items", "Summarize", "Translate", "Explain").
  - Step 3: Displays live quota balance ("Quota: 24 / 100").
  - Step 4: Dispatches request and displays streaming or formatted markdown response.
  - Option to "Save as New Ticket" directly into the current vault.

---

## 5. Verification & Acceptance Criteria
1. **Zero Lingering Ephemeral Files:** In automated and manual tests, even if an error is injected into OCR processing, the temporary `.tmp` image file is completely deleted.
2. **Quota Barrier:** Simulating 100 API calls strictly blocks the 101st request with a clear user-facing error modal and zero outgoing network calls.
3. **Keychain Protection:** The LLM API key cannot be read in plaintext from device backups or unauthenticated storage dumps.
4. **On-Device Performance:** Text extraction on standard iPhone camera captures completes on-device in under 800ms.
5. **UI Ergonomics:** The bottom sheet allows full inspection and redaction of text before the user commits to sending data to an external LLM.
