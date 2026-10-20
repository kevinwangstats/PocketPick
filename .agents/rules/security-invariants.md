# Security Invariants

These security rules are non-negotiable and strictly enforced across all development and agentic tasks. Any violation constitutes a critical blocker.

---

### Invariant 1: Zero Sensitive Data Logging

- **Rule:** NEVER log cryptographic keys, raw passphrases, master keys, initialization vectors (IVs), authentication tags, or decrypted user payloads (ticket text, decrypted image bytes) to `console.log`, `console.warn`, `console.error`, or external telemetry.
- **Enforcement:** Automated static checks in pre-commit hooks and `.agents/skills/crypto-audit`.

---

### Invariant 2: Hardware-Backed Master Keys & Envelope Encryption

- **Rule:**
  1. The SQLCipher database encryption key (`POCKETPICK_DB_MASTER_KEY`) and LLM API keys must be stored strictly in the iOS Keychain via `expo-secure-store` with accessibility set to `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
  2. Individual vaults must use envelope encryption derived from user passphrases via PBKDF2-HMAC-SHA512 (100,000 iterations).
  3. Master keys must never be hardcoded, written to configuration files, or committed to git.

---

### Invariant 3: Ephemeral In-Memory Session Keys & Scrubbing

- **Rule:**
  1. Derived vault keys must ONLY exist in transient memory inside `useSessionStore` (Zustand).
  2. NEVER persist vault keys to `AsyncStorage`, SQLite, SecureStore, or files.
  3. When a vault is locked, or when the app transitions to `background` or `inactive` state, the active key buffer MUST be scrubbed immediately using `zeroizeBuffer()` before clearing references.

---

### Invariant 4: Mandatory Ephemeral File Cleanup in `finally` Blocks

- **Rule:**
  Whenever an unencrypted image or buffer is written to the sandbox filesystem for temporary processing (e.g. ML Kit / Apple Vision OCR):
  1. The temporary file must be generated with a unique, randomized name in `FileSystem.cacheDirectory`.
  2. The processing code MUST use `try ... finally`.
  3. The `finally` block MUST invoke `shredFile(tempPath)` unconditionally, ensuring zero unencrypted user files linger on the disk regardless of whether processing succeeds or throws an exception.

---

### Invariant 5: Authenticated Cipher & Tamper Verification

- **Rule:**
  1. All symmetric encryption must use AES-256-GCM with a unique 12-byte (96-bit) IV and 16-byte (128-bit) authentication tag.
  2. Decryption must strictly verify the authentication tag. If any byte is altered, decryption must fail with an explicit authentication error and never return truncated or partial plaintext.
  3. Every crypto service must include automated unit tests verifying that 1-bit or 1-byte ciphertext tampering is rejected.
