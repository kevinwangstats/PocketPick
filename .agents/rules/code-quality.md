# Code Quality & TypeScript Standards

---

### 1. TypeScript Strictness

- **Strict Mode:** `strict: true` is enabled in `tsconfig.json`.
- **No Implicit Any:** All variables, function parameters, and return types must be fully typed.
- **Explicit Return Types:** All public services, custom hooks, and utility functions must specify explicit return types.
- **Type Assertions:** Avoid `as any`. If type casting is strictly necessary for third-party native bridge types, use `unknown as T` with an accompanying explanatory comment.

---

### 2. Linting & Formatting

- **ESLint & Prettier:** Automated via `husky` and `lint-staged`.
- **Imports:** Group imports logically:
  1. React & React Native core
  2. Third-party libraries (Expo, Zustand, Drizzle)
  3. Internal aliases (`@/components`, `@/services`, `@/crypto`, `@/types`)
  4. Relative local imports

---

### 3. Architecture Separation of Concerns

- **UI Components:** UI components must never import native crypto libraries (`react-native-quick-crypto`) or raw database clients directly.
- **Hook / Service Layer:** UI components interact exclusively with custom hooks (`useVaultAuth`, `usePicker`, `useAutoLock`) or domain services (`ticketService`, `imagePipeline`).
- **Data Flow:**
  - `Database <-> Drizzle ORM <-> Service Classes <-> Custom Hooks <-> UI Components`

---

### 4. Git & Commit Discipline

- **One Commit per Task:** Make a dedicated, descriptive git commit immediately upon completing each distinct task or checklist item.
- **No Monolithic Commits:** Do not bundle unrelated changes, multiple plan tasks, or entire multi-file phases into a single commit.
- **Verification Before Commit:** Always verify `npm test` and `npx tsc --noEmit` pass prior to staging and committing.
- **Conventional Commits:** Standardize messages using `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, or `chore:` with the affected scope (e.g. `feat(crypto): ...`, `test(picker): ...`).
