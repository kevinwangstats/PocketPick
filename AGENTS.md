# PocketPick: Autonomous AI & Engineering Guidelines

## 1. Project Overview & Architecture

PocketPick is an iOS-first, secure mobile application that enables isolated, password-protected vaults with envelope encryption, encrypted photo galleries, a cryptographically fair randomizer engine, local audit history, and ephemeral on-device OCR with quota-controlled LLM analysis.

- **Framework:** React Native with Expo (Custom Dev Client).
- **Persistence:** OP-SQLite with SQLCipher (256-bit AES) + Drizzle ORM.
- **Cryptography:** Native JSI C++ via `react-native-quick-crypto` (PBKDF2-HMAC-SHA512, AES-256-GCM, CSPRNG).
- **Hardware Storage:** iOS Keychain via `expo-secure-store`.
- **UI:** NativeWind (Tailwind CSS for React Native) adhering to strict high-contrast monochrome tokens.
- **State:** Zustand with strict separation: UI state vs. transient `useSessionStore` (in-memory only).

---

## 2. Agentic Workflow Invariants

1. **Always Work in Planning Mode for Multi-File Changes:**
   Before implementing features spanning multiple files, review the phase plans in `plans/` and generate a concrete task checklist.
2. **Mandatory Test-Driven Development (TDD):**
   - For all crypto utilities, key derivation, cipher logic, and database operations, write Jest unit tests alongside or before implementation.
   - If a test fails, STOP and fix the root cause. Never comment out or weaken test assertions.
   - Always test 1-bit/1-byte tampering on ciphertext and auth tags to verify authentication errors.
3. **Strict Zero-Leak Security Invariants:**
   - Refer to `.agents/rules/security-invariants.md`.
   - Never log keys, secrets, or decrypted payloads to `console.log`.
   - Never persist ephemeral session keys.
   - Always delete temporary OCR/image files inside a `finally` block.
4. **Minimalist UI Aesthetic:**
   - Refer to `.agents/rules/minimalist-ui.md`.
   - Strictly adhere to monochrome palette: black (`#000000`), white (`#FFFFFF`), neutral zinc.
   - No drop shadows, no colorful gradients, no unstyled default elements.
5. **Code Quality:**
   - Refer to `.agents/rules/code-quality.md`.
   - Strict TypeScript: no unreviewed `any`, explicit return types on public services.
   - Pre-commit hooks (`husky`) run `lint-staged` with ESLint, Prettier, and `tsc --noEmit`.
6. **Atomic Commit Discipline (One Commit per Completed Task):**
   - Make a dedicated, descriptive git commit immediately upon finishing each individual task or checklist item.
   - Never batch multiple distinct features, refactors, or plan tasks into a single monolithic commit.
   - Use conventional commit messages: `feat(...)`, `test(...)`, `fix(...)`, `docs(...)`, `refactor(...)`.
   - Ensure `npm test` and `npx tsc --noEmit` pass cleanly before committing each task.
7. **Continuous User Stories & Feature Documentation (`USER_STORIES.md`):**
   - Whenever the user makes a feature request or provides feedback, document it into a single living document (`USER_STORIES.md`) in a coherent, structured manner.
   - **No Past State Accumulation:** Past or obsolete state must NOT be recorded in this document. If a new feature or user request replaces or alters old behavior, directly edit and update the specification for that behavior to reflect the current active product state.
   - Maintain standard Agile user story structure: _As a... I want to... So that..._, accompanied by concrete _Acceptance Criteria_ and technical feature details.

---

## 3. Key Commands

```bash
# Typecheck
npx tsc --noEmit

# Run Unit & Component Tests
npm test

# Run Tests in Watch Mode
npm test -- --watch

# Linting & Formatting
npm run lint
npm run format

# Run on iOS Simulator (Dev Client)
npx expo run:ios

# Run Maestro E2E Tests
maestro test .maestro/flows/
```
