# Phase 4: Random Picker & Local History Tracker

## 1. Overview & Objectives

Phase 4 implements the core randomizer selection engine and chronological selection audit log for PocketPick. The engine must adhere to cryptographic fairness: biased modulo operations are prohibited, and random values must be obtained exclusively from a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG via `QuickCrypto.randomBytes` or `crypto.getRandomValues`).

Key deliverables include:

1. CSPRNG-driven weighted and uniform selection algorithms verified with statistical chi-square goodness-of-fit unit tests.
2. A high-contrast, minimalist picker interface featuring tactile iOS haptics (`expo-haptics`), a mechanical deceleration shuffle animation, and instant decryption of the chosen winner.
3. Atomic SQLite transactions logging every pick event into `history_logs`.
4. A chronological timeline view that decrypts logged item summaries on-the-fly.

---

## 2. Prerequisites & Dependencies

- Completion of Phases 1, 2, and 3.
- Additional packages:
  ```bash
  npx expo install expo-haptics
  npm install react-native-reanimated
  ```

---

## 3. Architecture & File Layout

```
PocketPick/
├── src/
│   ├── services/
│   │   ├── randomizer/
│   │   │   ├── csprng.ts             # Unbiased uniform integer generator
│   │   │   ├── pickerEngine.ts       # Weighted & uniform selection algorithms
│   │   │   └── types.ts              # PickableItem, SelectionResult interfaces
│   │   └── history/
│   │       └── historyService.ts     # Atomic transaction logging & timeline queries
│   ├── hooks/
│   │   ├── usePicker.ts              # Shuffle animation state machine & haptics coordinator
│   │   └── useHistory.ts             # Chronological timeline pagination & filter
│   ├── components/
│   │   ├── picker/
│   │   │   ├── ShuffleDisplay.tsx    # Monospaced cycling animation display
│   │   │   ├── WinnerCard.tsx        # Decrypted winner reveal card with actions
│   │   │   └── WeightFilterModal.tsx # Filter out low-weight or excluded items
│   │   └── history/
│   │       ├── HistoryTimeline.tsx   # Reverse-chronological feed
│   │       └── HistoryItemRow.tsx    # Decrypted entry with timestamp and badge
│   └── app/
│       └── (tabs)/
│           ├── randomizer.tsx        # Main picker tab screen
│           └── history.tsx           # History timeline tab screen
└── __tests__/
    ├── services/
    │   ├── csprng.test.ts
    │   ├── pickerEngine.test.ts
    │   └── historyService.test.ts
    └── components/
        └── ShuffleDisplay.test.tsx
```

---

## 4. Detailed Implementation Tasks

### 4.1 CSPRNG & Selection Engine (TDD) (Task 4.1)

- [x] Implement `src/services/randomizer/csprng.ts`:
  - `getRandomInt(min: number, max: number): number`
  - Rejection sampling to avoid modulo bias:
    ```typescript
    import QuickCrypto from 'react-native-quick-crypto';

    export function getRandomUint32(): number {
      const buffer = QuickCrypto.randomBytes(4);
      return buffer.readUInt32BE(0);
    }

    export function getRandomInt(min: number, max: number): number {
      const range = max - min + 1;
      if (range <= 0) throw new Error('Invalid range');
      const maxAllowed = Math.floor(0xffffffff / range) * range;
      let rand: number;
      do {
        rand = getRandomUint32();
      } while (rand >= maxAllowed);
      return min + (rand % range);
    }
    ```
- [x] Implement `src/services/randomizer/pickerEngine.ts`:
  - `pickUniform<T extends PickableItem>(items: T[]): T`
  - `pickWeighted<T extends PickableItem>(items: T[]): T`:
    - Calculate `totalWeight = sum(items.map(i => i.weight))`.
    - Generate random integer `target` in `[0, totalWeight - 1]`.
    - Iterate or binary search cumulative weights to select winning item.
- [x] Write rigorous TDD unit tests in `__tests__/services/pickerEngine.test.ts`:
  - Test empty list throwing an `EmptyPoolError`.
  - Test single item selection.
  - Test weighted distribution: Run simulation with 10,000 picks across items with weights `[1, 2, 7]`. Assert statistical deviation within expected standard distribution tolerance (< 2.5% margin of error).
  - Verify zero modulo bias.

### 4.2 Minimalist Shuffle & Decryption Picker UI (Task 4.2)

- [x] Implement `src/hooks/usePicker.ts`:
  - State machine: `idle` -> `shuffling` -> `decelerating` -> `revealed`.
  - Ticking interval starts fast (50ms), linearly or exponentially decays over 2.0 seconds to 300ms, then halts on the winner.
  - Trigger `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on every tick; trigger `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` on reveal.
- [x] Implement `src/components/picker/ShuffleDisplay.tsx`:
  - Monochrome monospace counter display.
  - While shuffling, displays cycling placeholder names, ticket snippets, or random alphanumeric hashes.
- [x] Implement `src/components/picker/WinnerCard.tsx`:
  - Decrypts the chosen item using the active vault key.
  - If ticket: displays full title, description, and weight badge.
  - If photo: decrypts thumbnail immediately and offers "View Full Resolution" modal.
  - Action buttons: "Keep / Confirm", "Re-Pick", "Discard Item".

### 4.3 Atomic History Logging via DB Transactions (Task 4.3)

- [x] Implement `src/services/history/historyService.ts`:
  - `logPickTransaction(vaultId: string, resourceId: string, actionType: 'pick' | 're_pick' | 'discard', notes?: string): Promise<string>`
  - Wrap database execution inside an OP-SQLite transaction:
    ```typescript
    export async function logPickTransaction(
      db: DrizzleClient,
      vaultId: string,
      resourceId: string,
      actionType: 'pick' | 're_pick' | 'discard',
      notes?: string,
    ): Promise<string> {
      const logId = uuidv4();
      await db.transaction(async (tx) => {
        await tx.insert(historyLogs).values({
          id: logId,
          vaultId,
          resourceId,
          actionType,
          notes,
          selectedAt: new Date(),
        });
      });
      return logId;
    }
    ```
- [x] Unit test transactional rollback: Ensure that a database failure in transaction rolls back cleanly without leaving partial logs.

### 4.4 Timeline View & Dynamic Decryption (Task 4.4)

- [x] Implement `src/components/history/HistoryTimeline.tsx`:
  - Query `history_logs` joined with `resources` table ordered by `selected_at DESC`.
  - Paginated infinite scroll (20 items per page).
  - Filter chips: All, Tickets, Photos, Re-picks.
- [x] Implement `src/components/history/HistoryItemRow.tsx`:
  - Decrypts ticket title or photo thumbnail on the fly using active vault key.
  - If vault is locked or key is unavailable, displays a redacted placeholder: `[LOCKED - VAULT ENCRYPTED]`.
  - Displays relative timestamp (e.g., "12m ago", "Yesterday at 14:30") and action badge.

---

## 5. Verification & Acceptance Criteria

1. **Statistical Fairness:** 10,000-iteration Monte Carlo tests demonstrate uniform and weighted random distributions within expected variance bounds.
2. **Animation & Haptics:** Triggering "PICK" activates seamless deceleration animation with tactile haptic clicks, stopping cleanly on the winner.
3. **Instant Decryption:** The winner is decrypted and presented with zero noticeable latency (< 50ms) upon animation completion.
4. **Transaction Integrity:** Every pick produces an immutable row in `history_logs` referencing the valid `resource_id` and `vault_id`.
5. **Locked State Gracefulness:** If the vault locks while browsing the timeline, rows immediately redact their decrypted titles and revert to secure placeholder state.
