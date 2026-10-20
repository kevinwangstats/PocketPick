# Phase 3: Encrypted Resource Management (Tickets & Photos)

## 1. Overview & Objectives

Phase 3 implements the data management pipeline for the two primary content types stored within PocketPick vaults: **Text Tickets** and **Encrypted Photos**.

Key technical priorities include:

1. End-to-end envelope encryption for all user content using the active vault key from `useSessionStore`.
2. A zero-leak image pipeline: importing an image creates an encrypted thumbnail and an encrypted full-resolution file, immediately shredding the raw unencrypted temporary photo.
3. 60 FPS scrolling performance in a photo gallery using `@shopify/flash-list` with bounded in-memory thumbnail decryption (never decrypting full-resolution files during scroll).
4. Atomic and secure file deletion ensuring all encrypted disk artifacts (`.enc`) are removed before SQLite database records are deleted.

---

## 2. Prerequisites & Dependencies

- Completion of Phase 1 (Database schema) and Phase 2 (Cryptographic engine & `useSessionStore`).
- Packages:
  ```bash
  npx expo install expo-image-picker expo-image-manipulator expo-file-system
  npm install @shopify/flash-list lru-cache
  ```

---

## 3. Architecture & File Layout

```
PocketPick/
├── src/
│   ├── services/
│   │   ├── tickets/
│   │   │   └── ticketService.ts      # Encrypt, insert, fetch, update, delete tickets
│   │   ├── media/
│   │   │   ├── imagePipeline.ts      # Image pick -> resize -> encrypt -> write .enc -> cleanup temp
│   │   │   ├── fileShredder.ts       # Secure file deletion utility
│   │   │   └── thumbnailCache.ts     # Bounded in-memory LRU cache for decrypted base64 thumbs
│   │   └── resources/
│   │       └── resourceManager.ts    # Unified CRUD & cascade deletion orchestrator
│   ├── components/
│   │   ├── tickets/
│   │   │   ├── TicketList.tsx
│   │   │   ├── TicketCard.tsx
│   │   │   └── TicketEditorModal.tsx
│   │   └── media/
│   │       ├── EncryptedGallery.tsx  # FlashList grid
│   │       ├── ThumbnailTile.tsx     # On-the-fly thumbnail decrypter & image renderer
│   │       └── FullImageModal.tsx    # Single-item full-resolution decrypter
│   └── app/
│       └── vault/
│           └── [id].tsx              # Vault detail view with Tickets and Photos tabs
└── __tests__/
    ├── services/
    │   ├── ticketService.test.ts
    │   ├── imagePipeline.test.ts
    │   └── fileShredder.test.ts
    └── components/
        └── ThumbnailTile.test.tsx
```

---

## 4. Detailed Implementation Tasks

### 4.1 Encrypted Ticket CRUD (Task 3.1)

- [x] Implement `src/services/tickets/ticketService.ts`:
  - `createTicket(vaultId: string, payload: { title: string; content: string; weight?: number }): Promise<string>`
    1. Retrieve active key from `useSessionStore`. Verify vault is unlocked.
    2. Serialize ticket payload to JSON string.
    3. Encrypt string using `encryptString(payloadJson, vaultKey, vaultId)`.
    4. Insert into `resources` table with `type: 'ticket'`, `encryptedPayload: ciphertext`, `payloadIv: iv`, `payloadTag: tag`, `weight`.
    5. Return generated resource ID.
  - `getDecryptedTickets(vaultId: string): Promise<DecryptedTicket[]>`
    1. Query all resources where `vaultId = ?` and `type = 'ticket'`.
    2. Decrypt each payload using active vault key.
    3. Return array of typed tickets.
  - `updateTicket(ticketId: string, payload: Partial<TicketPayload>): Promise<void>`
  - `deleteTicket(ticketId: string): Promise<void>`
- [x] Build minimalist Ticket UI in `src/components/tickets/`:
  - `TicketEditorModal.tsx`: High-contrast form with Title, Content, and Weight slider/input.
  - `TicketCard.tsx`: Monochromatic card with title, preview, weight badge, and swipe-to-delete.
  - `TicketList.tsx`: Clean list with search and pull-to-refresh.
- [x] Write unit tests verifying ticket creation, decryption, and tampering checks in `__tests__/services/ticketService.test.ts`.

### 4.2 Secure Image Ingestion Pipeline (Task 3.2)

- [x] Implement `src/services/media/imagePipeline.ts`:
  ```typescript
  export interface IngestionResult {
    resourceId: string;
    filePath: string;
    fileIv: string;
    fileTag: string;
    thumbnailPath: string;
    thumbnailIv: string;
    thumbnailTag: string;
  }

  export async function ingestImage(
    sourceUri: string,
    vaultId: string,
    key: Buffer,
  ): Promise<IngestionResult>;
  ```
  **Step-by-Step Ingestion Workflow:**
  1. **Generate Thumbnail:** Use `expo-image-manipulator` to generate a 300x300 thumbnail (`ImageManipulator.manipulateAsync(sourceUri, [{ resize: { width: 300 } }], { compress: 0.7, format: SaveFormat.JPEG })`).
  2. **Read Raw Files:** Read original full-res image and generated thumbnail into binary Buffers via `expo-file-system`.
  3. **Encrypt Binaries:**
     - Encrypt full-res buffer using `encryptBuffer(fullBuffer, key, vaultId)`.
     - Encrypt thumbnail buffer using `encryptBuffer(thumbBuffer, key, vaultId)`.
  4. **Target Directory Setup:** Ensure directory `FileSystem.documentDirectory + 'vaults/' + vaultId + '/resources/'` exists.
  5. **Write Encrypted Files:**
     - Write full-res ciphertext to `${resourceId}.enc`.
     - Write thumbnail ciphertext to `${resourceId}_thumb.enc`.
  6. **Secure Temporary Cleanup:** Delete `sourceUri` (if copied to app cache) and the temporary thumbnail file using `deleteAsync()`.
  7. **Persist Record:** Insert row into `resources` table with file paths, IVs, tags, and timestamps.
- [x] Implement `src/services/media/fileShredder.ts`:
  - `shredFile(path: string): Promise<void>`:
    - Attempt to overwrite file with random bytes before unlinking (defense-in-depth on flash storage).
    - Unlink file from file system.

### 4.3 High-Performance FlashList Gallery & Thumbnail Cache (Task 3.3)

- [x] Implement `src/services/media/thumbnailCache.ts`:
  - In-memory `LRUCache<string, string>` (mapping `resourceId -> base64DataUri`).
  - Maximum size: 50 thumbnails in memory.
  - Eviction automatically clears references to reduce garbage collection pressure.
- [x] Implement `src/components/media/ThumbnailTile.tsx`:
  - Check `thumbnailCache` first.
  - If cache miss, read `${resourceId}_thumb.enc`, decrypt with active key, convert decrypted buffer to base64 data URI (`data:image/jpeg;base64,...`), store in LRU cache, and render.
  - Render with smooth fade-in animation and monochromatic placeholder skeleton while decrypting.
- [x] Implement `src/components/media/EncryptedGallery.tsx`:
  - Use `@shopify/flash-list` configured with `numColumns={3}` and `estimatedItemSize={120}`.
  - Optimized for 60 FPS scrolling on iOS.
- [x] Implement `src/components/media/FullImageModal.tsx`:
  - Triggered only when tapping a specific gallery tile.
  - Reads `${resourceId}.enc`, decrypts full buffer in memory, renders full-screen with zoom/pan.
  - When modal is dismissed, decrypted buffer is discarded and garbage collected.

### 4.4 Secure Cascade Deletion (Task 3.4)

- [x] Implement `deleteResource(resourceId: string): Promise<void>` in `src/services/resources/resourceManager.ts`:
  1. Fetch resource record.
  2. If `type === 'photo'`:
     - Securely shred `encryptedFilePath`.
     - Securely shred `encryptedThumbnailPath`.
     - Evict thumbnail from `thumbnailCache`.
  3. Execute Drizzle database delete (`DELETE FROM resources WHERE id = ?`).
- [x] Implement `deleteVault(vaultId: string): Promise<void>`:
  1. Retrieve all photo resources associated with `vaultId`.
  2. Shred all `.enc` and `_thumb.enc` files from the filesystem.
  3. Remove entire vault directory `vaults/${vaultId}/`.
  4. Cascade delete vault row from `vaults` table in SQLite.

---

## 5. Verification & Acceptance Criteria

1. **Zero Raw Photo Lingering:** After image import, inspecting `FileSystem.cacheDirectory` and `documentDirectory` reveals zero unencrypted `.jpg`/`.png` files; only `.enc` files exist.
2. **FlashList Scroll Rate:** Gallery with 100+ encrypted photos scrolls at 60 FPS on the iOS Simulator without UI thread hiccups. Full-res files are never opened during scroll.
3. **Tampered File Handling:** Modifying bytes in a `.enc` file causes the UI to display a clean "Decryption Error" placeholder rather than crashing.
4. **Shredding Verification:** Deleting an item removes both the SQLite row and the physical `.enc` files from the iOS sandbox file system.
