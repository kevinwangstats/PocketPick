# Phase 2: Cryptographic Core & Vault Management

## 1. Overview & Objectives
Phase 2 builds the core cryptographic engine and vault lifecycle management for PocketPick. The security model relies on envelope encryption: while the SQLCipher database protects metadata with a device-level master key, every individual vault is secured by an independent, user-defined passphrase.

The key derivation function (PBKDF2-HMAC-SHA512) and AES-256-GCM authenticated cipher operations must be implemented strictly via native JSI C++ (`react-native-quick-crypto`) to avoid freezing the JavaScript thread. 

This phase also implements:
1. Pure in-memory session key management (`useSessionStore`) using Zustand.
2. Minimalist UI for creating, unlocking, and managing vaults.
3. Strict iOS `AppState` auto-lock, memory zeroization, and background snapshot protection.

---

## 2. Prerequisites & Dependencies
- Successful completion and verification of Phase 1.
- `react-native-quick-crypto` operational on iOS Simulator.
- Drizzle ORM database client initialized.

---

## 3. Architecture & Security Invariants

### 3.1 Cryptographic Parameters
- **KDF:** PBKDF2 with HMAC-SHA512.
  - Iterations: `100,000` rounds.
  - Salt Length: `32` bytes (`QuickCrypto.randomBytes(32)`).
  - Derived Key Length: `32` bytes (256 bits).
- **Symmetric Cipher:** AES-256-GCM (Galois/Counter Mode).
  - IV/Nonce Length: `12` bytes (96 bits) uniquely generated for every single encryption operation.
  - Auth Tag Length: `16` bytes (128 bits).
  - Associated Data (AAD): Optional vault ID binding to prevent cross-vault ciphertext swapping.
- **Passphrase Verifier Pattern:**
  - When a vault is created, a constant verification string (`"POCKETPICK_VAULT_VERIFIER_V1"`) is encrypted with the derived vault key.
  - The resulting ciphertext, IV, and auth tag are stored in the `vaults` table.
  - During unlock, the candidate key attempts to decrypt the verifier. If decryption succeeds and matches the constant, the passphrase is valid and the key is loaded into `useSessionStore`. If the auth tag check fails, decryption throws immediately without exposing timing vulnerabilities.

### 3.2 Ephemeral Session Model
- Derived vault keys (`Uint8Array` or `Buffer`) MUST ONLY live in memory inside a Zustand store.
- **NEVER** persist session keys to `AsyncStorage`, `SecureStore`, file system, or logs.
- Provide a `zeroize()` method that overwrites the key buffer with zeroes before garbage collection.

---

## 4. Architecture & File Layout
```
PocketPick/
├── src/
│   ├── crypto/
│   │   ├── types.ts            # EncryptedData, CipherParams interfaces
│   │   ├── kdf.ts              # PBKDF2 derivation service
│   │   ├── cipher.ts           # AES-256-GCM encrypt/decrypt buffers and strings
│   │   └── zeroize.ts          # Safe memory scrubbing utility
│   ├── stores/
│   │   ├── useSessionStore.ts  # In-memory ephemeral vault key store
│   │   └── useVaultStore.ts    # Unlocked vault metadata & active vault ID
│   ├── hooks/
│   │   ├── useAutoLock.ts      # iOS AppState listener & auto-lock timer
│   │   └── useVaultAuth.ts     # Unlock, create, lock flows
│   ├── components/
│   │   ├── security/
│   │   │   └── PrivacyShield.tsx # Monochromatic blur/lock screen for iOS App Switcher
│   │   └── vault/
│   │       ├── CreateVaultModal.tsx
│   │       ├── UnlockVaultModal.tsx
│   │       └── VaultCard.tsx
│   └── app/
│       └── (tabs)/index.tsx    # Vault list with lock/unlock status indicators
└── __tests__/
    ├── crypto/
    │   ├── kdf.test.ts
    │   └── cipher.test.ts
    ├── stores/
    │   └── sessionStore.test.ts
    └── hooks/
        └── useAutoLock.test.ts
```

---

## 5. Detailed Implementation Tasks

### 5.1 Cryptographic Core Engine (TDD) (Task 2.1)
- [ ] Define cryptographic interfaces in `src/crypto/types.ts`:
  ```typescript
  export interface EncryptedPayload {
    ciphertext: string; // Base64
    iv: string;         // Base64 (12 bytes)
    tag: string;        // Base64 (16 bytes)
  }
  
  export interface EncryptedFileMetadata {
    filePath: string;
    iv: string;
    tag: string;
  }
  ```
- [ ] Implement `src/crypto/kdf.ts`:
  - `deriveVaultKey(passphrase: string, salt: Buffer | string): Promise<Buffer>`
  - Uses `QuickCrypto.pbkdf2Sync(passphrase, saltBuffer, 100000, 32, 'sha512')`.
- [ ] Implement `src/crypto/cipher.ts`:
  - `encryptBuffer(plainBuffer: Buffer, key: Buffer, aad?: string): EncryptedPayload`
  - `decryptBuffer(encrypted: EncryptedPayload, key: Buffer, aad?: string): Buffer`
  - `encryptString(plaintext: string, key: Buffer, aad?: string): EncryptedPayload`
  - `decryptString(encrypted: EncryptedPayload, key: Buffer, aad?: string): string`
- [ ] Write rigorous TDD unit tests in `__tests__/crypto/cipher.test.ts`:
  - Test valid roundtrip encryption and decryption of string and binary buffers.
  - **Tamper Test:** Alter a single bit/byte in `ciphertext` and assert that `decryptBuffer` throws an authentication error.
  - **IV Tamper Test:** Alter a single byte in `iv` or `tag` and assert failure.
  - **AAD Mismatch Test:** Decrypt with wrong AAD and assert failure.
  - **Empty Buffer / Edge Case Tests:** Zero-length buffers, unicode/multibyte emoji text strings.

### 5.2 Ephemeral Session Store & Memory Zeroization (Task 2.2)
- [ ] Implement `src/crypto/zeroize.ts`:
  - Fill Buffer with zeroes (`buffer.fill(0)`).
- [ ] Implement `src/stores/useSessionStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { zeroizeBuffer } from '../crypto/zeroize';

  interface SessionState {
    activeVaultId: string | null;
    activeVaultKey: Buffer | null;
    lastActiveTimestamp: number | null;
    setActiveVault: (vaultId: string, key: Buffer) => void;
    lockVault: () => void;
    touchActivity: () => void;
  }

  export const useSessionStore = create<SessionState>((set, get) => ({
    activeVaultId: null,
    activeVaultKey: null,
    lastActiveTimestamp: null,
    setActiveVault: (vaultId, key) => {
      const prevKey = get().activeVaultKey;
      if (prevKey) zeroizeBuffer(prevKey);
      set({ activeVaultId: vaultId, activeVaultKey: key, lastActiveTimestamp: Date.now() });
    },
    lockVault: () => {
      const currentKey = get().activeVaultKey;
      if (currentKey) zeroizeBuffer(currentKey);
      set({ activeVaultId: null, activeVaultKey: null, lastActiveTimestamp: null });
    },
    touchActivity: () => set({ lastActiveTimestamp: Date.now() }),
  }));
  ```
- [ ] Unit test `useSessionStore` to confirm `lockVault()` zeroes out the active key buffer and sets state to null.

### 5.3 Vault Management UI & Verification Flow (Task 2.3)
- [ ] Implement `src/hooks/useVaultAuth.ts`:
  - `createVault(name: string, description: string, passphrase: string): Promise<string>`
    1. Generate 32-byte salt using `QuickCrypto.randomBytes(32)`.
    2. Derive key via `deriveVaultKey(passphrase, salt)`.
    3. Encrypt `"POCKETPICK_VAULT_VERIFIER_V1"` with derived key.
    4. Insert record into `vaults` table with Drizzle ORM.
    5. Call `setActiveVault(vaultId, derivedKey)`.
  - `unlockVault(vaultId: string, passphrase: string): Promise<boolean>`
    1. Fetch vault record (salt, verifierCipher, verifierIv, verifierTag).
    2. Derive candidate key using provided passphrase and stored salt.
    3. Attempt decryption of verifier.
    4. If matches, call `setActiveVault(vaultId, candidateKey)` and return `true`.
    5. If decrypt throws, zeroize candidate key, return `false`.
- [ ] Build minimalist UI components:
  - `CreateVaultModal.tsx`: Passphrase input with confirmation and strength meter (length, entropy), high-contrast monochrome inputs.
  - `UnlockVaultModal.tsx`: Clean PIN/passphrase modal with auto-focus and clear failure feedback.
  - `VaultCard.tsx`: Displays vault name, resource count, locked/unlocked indicator badge.

### 5.4 AppState Auto-Lock & Privacy Shield (Task 2.4)
- [ ] Implement `src/hooks/useAutoLock.ts`:
  - Listen to `AppState` changes (`active` -> `background` | `inactive`).
  - When app transitions to `background` or `inactive`:
    1. Trigger `lockVault()` immediately (zeroize key, clear session).
    2. Set `isShieldActive = true`.
  - Support configurable timeout (e.g., immediate, 1 minute, 5 minutes of inactivity).
- [ ] Implement `src/components/security/PrivacyShield.tsx`:
  - Full-screen absolute overlay covering the entire window with solid pitch black (`#000000`) and the minimalist PocketPick logo or lock icon.
  - Prevents the iOS App Switcher from caching or snapshotting decrypted tickets, photos, or vault titles.
- [ ] Add `useAutoLock` and `PrivacyShield` to root `src/app/_layout.tsx`.

---

## 6. Verification & Acceptance Criteria
1. **Cryptographic Integrity:** 100% of unit tests in `__tests__/crypto/` pass. 1-byte tampered ciphertexts reject with an explicit authentication exception.
2. **PBKDF2 Performance:** Key derivation on iOS Simulator completes in under 350ms without dropping frames or triggering UI lockup.
3. **Zeroization:** Inspected memory buffer tests demonstrate that `zeroizeBuffer` replaces all bytes with `0x00`.
4. **Vault Lifecycle:** Creating a vault stores valid salt and verifier; unlocking with correct passphrase succeeds; wrong passphrase fails cleanly with no crash.
5. **App Switcher Privacy:** Placing the app in the background on the iOS Simulator displays the `PrivacyShield` overlay in the iOS task switcher, and returning to the app requires entering the passphrase again.
