# Phase 1: Native Foundation & Database Layer (iOS Focus)

## 1. Overview & Objectives

Phase 1 implements the native infrastructure and persistence layer for PocketPick on iOS. Because PocketPick relies on C++/JSI-accelerated cryptography (`react-native-quick-crypto`), hardware-backed SQLite with SQLCipher (`@op-engineering/op-sqlite`), and the iOS Keychain (`expo-secure-store`), standard Expo Go cannot be used. We will configure an Expo Custom Dev Client, run `expo prebuild`, generate native Xcode projects, and compile directly to the iOS Simulator.

Additionally, this phase establishes:

1. The root database master key lifecycle in iOS Keychain via `SecureStore`.
2. The complete relational database schema using Drizzle ORM over SQLCipher.
3. The foundational Expo Router application navigation structure adhering to minimalist UX guidelines.

---

## 2. Prerequisites & Native Tooling

- Completion of Phase 0.
- **Xcode:** 15.0+ installed with iOS Simulator runtimes (e.g., iPhone 15 / 16 Pro).
- **CocoaPods:** `pod --version` >= 1.13.0.
- **Node.js & Expo CLI:** `npx expo` compatible with SDK 51/52.

---

## 3. Architecture & File Layout

```
PocketPick/
├── ios/                          # Generated native iOS project via expo prebuild
│   ├── Podfile
│   └── PocketPick.xcworkspace
├── src/
│   ├── db/
│   │   ├── client.ts             # OP-SQLite + Drizzle initialization with SQLCipher
│   │   ├── schema.ts             # Drizzle tables: vaults, resources, history_logs, api_quotas
│   │   ├── migrations/           # Generated SQL migrations
│   │   └── security.ts           # DB_MASTER_KEY retrieval/generation in SecureStore
│   ├── app/                      # Expo Router filesystem routing
│   │   ├── _layout.tsx           # Root provider stack (Theme, AppState, DB init)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # Bottom tabs: Vaults, Randomizer, History, Settings
│   │   │   ├── index.tsx         # Vault list screen
│   │   │   ├── randomizer.tsx    # Picker screen
│   │   │   ├── history.tsx       # Timeline audit screen
│   │   │   └── settings.tsx      # Quotas & API config
│   │   └── vault/
│   │       ├── [id].tsx          # Unlocked vault contents / gallery
│   │       └── unlock.tsx        # Passcode/biometric modal
│   └── services/
│       └── storage/
│           ├── secureStore.ts    # SecureStore abstraction with iOS Keychain accessibility flags
│           └── fileSystem.ts     # DocumentDirectory & protected cache paths
├── __tests__/
│   ├── mocks/
│   │   ├── op-sqlite.mock.ts
│   │   └── secure-store.mock.ts
│   └── db/
│       ├── security.test.ts
│       └── schema.test.ts
```

---

## 4. Detailed Implementation Tasks

### 4.1 Custom Dev Client & Native Dependencies (Task 1.1)

- [x] Install native packages:
  ```bash
  npx expo install expo-secure-store expo-router expo-constants expo-linking react-native-safe-area-context react-native-screens
  npm install @op-engineering/op-sqlite drizzle-orm react-native-quick-crypto
  npm install --save-dev drizzle-kit
  ```
- [x] Configure `app.json` plugins for custom native build:
  - Add `expo-router` plugin.
  - Add `expo-secure-store` with iOS Keychain accessibility entitlement (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
- [x] Configure native build manifests and entry points.
- [x] Verify JSI bindings mocks load without crash (validate that `QuickCrypto` and `op-sqlite` C++ symbols resolve properly).

### 4.2 DB Master Key Bootstrap via SecureStore (Task 1.2)

- [x] Define `src/services/storage/secureStore.ts`:
  - Implement `getSecureItem(key: string): Promise<string | null>`.
  - Implement `setSecureItem(key: string, value: string): Promise<void>` with Keychain accessibility flags.
  - Implement `deleteSecureItem(key: string): Promise<void>`.
- [x] Implement `src/db/security.ts`:
  - `getOrCreateDatabaseMasterKey(): Promise<string>`:
    1. Query SecureStore for `POCKETPICK_DB_MASTER_KEY`.
    2. If absent, generate a cryptographically secure 256-bit random key (64 hex characters or 32 raw bytes base64) using `QuickCrypto.randomBytes(32).toString('hex')`.
    3. Persist into SecureStore with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
    4. Return the key.
- [x] Write Jest unit tests in `__tests__/db/security.test.ts`:
  - Test initial key generation and persistence.
  - Test subsequent retrieval returning existing key.
  - Test recovery behavior if SecureStore returns null/corrupted values.

### 4.3 OP-SQLite + SQLCipher & Drizzle ORM Schema (Task 1.3)

- [x] Configure OP-SQLite connection with SQLCipher encryption:
  ```typescript
  // src/db/client.ts
  import { open } from '@op-engineering/op-sqlite';
  import { drizzle } from 'drizzle-orm/op-sqlite';
  import * as schema from './schema';
  import { getOrCreateDatabaseMasterKey } from './security';

  export async function initializeDatabase() {
    const encryptionKey = await getOrCreateDatabaseMasterKey();
    const opsqliteDb = open({
      name: 'pocketpick.db',
      encryptionKey: encryptionKey, // Enforces SQLCipher 256-bit AES
    });
    return drizzle(opsqliteDb, { schema });
  }
  ```
- [x] Define complete schema in `src/db/schema.ts`:
  - `vaults`, `resources`, `history_logs`, `api_quotas`.
- [x] Configure `drizzle.config.ts`.
- [x] Implement database initialization script that runs migrations/DDL automatically on first boot.

### 4.4 Expo Router Foundation & Minimalist Layouts (Task 1.4)

- [x] Create `src/app/_layout.tsx` incorporating safe area views, dark mode theme provider, and database initialization guard.
- [x] Create `src/app/(tabs)/_layout.tsx`:
  - 4 monochrome tab buttons:
    - `index`: "VAULTS"
    - `randomizer`: "PICK"
    - `history`: "TIMELINE"
    - `settings`: "SYSTEM"
  - Pure monochrome styling: black background, crisp white active icons/text, muted gray inactive indicators, zero blur or translucent tab bar artifacts.
- [x] Create placeholder screens with standard minimalist headers and empty state cards.
- [x] Implement stack routes `src/app/vault/[id].tsx` and `src/app/vault/unlock.tsx`.

---

## 5. Verification & Acceptance Criteria

1. **iOS Simulator Build:** `npx expo run:ios` compiles cleanly via Xcode and launches inside the iOS Simulator without errors.
2. **Key Generation:** On first run, SecureStore stores a 256-bit `POCKETPICK_DB_MASTER_KEY`; subsequent reboots read the identical key.
3. **Encrypted SQLite Integrity:** Database file is confirmed to be encrypted with SQLCipher. Attempting to open `pocketpick.db` with a standard unencrypted SQLite CLI fails with `file is not a database` or `database disk image is malformed`.
4. **Drizzle Migrations:** Tables `vaults`, `resources`, `history_logs`, and `api_quotas` are successfully created with foreign key cascade rules enabled.
5. **Tab Navigation:** All four bottom tabs switch deterministically with zero lag and compliant monochrome styling.
