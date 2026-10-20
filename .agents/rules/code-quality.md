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
