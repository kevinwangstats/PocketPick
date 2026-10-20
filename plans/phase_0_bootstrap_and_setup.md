# Phase 0: Environment Bootstrap & Best Practices Setup

## 1. Overview & Objectives

The primary goal of Phase 0 is to establish a deterministic, high-integrity monorepo foundation for PocketPick on macOS targeting iOS. This phase provisions the Expo TypeScript environment, configures code quality guardrails (Husky, ESLint, Prettier, TypeScript strict mode), configures testing scaffolding (Jest, React Native Testing Library), and establishes the token-based minimalist UI design system via NativeWind (Tailwind CSS for React Native).

By the conclusion of Phase 0, any developer or autonomous AI agent working in Antigravity IDE will operate under strict automated guardrails, ensuring that zero untyped or malformed code can be committed.

---

## 2. Prerequisites & Tooling

- **Hardware/OS:** macOS (Apple Silicon or Intel) with Xcode 15+ and Command Line Tools installed.
- **Node.js:** v20.x+ (LTS) with `npm` or `pnpm` (standardized on `npm` for Expo compatibility).
- **Package Manager:** `npm` v10+.
- **CLI Utilities:** `watchman`, `cocoapods` (`pod`), `git`.
- **IDE/Agent:** Google Antigravity IDE with workspace root at `/Users/kevinwang/projects/PocketPick`.

---

## 3. Architecture & File Layout

```
PocketPick/
├── .agents/
│   ├── rules/
│   │   ├── security-invariants.md
│   │   ├── minimalist-ui.md
│   │   └── code-quality.md
│   └── skills/
│       ├── db-migration/
│       │   └── SKILL.md
│       └── crypto-audit/
│           └── SKILL.md
├── .husky/
│   ├── pre-commit
│   └── pre-push
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── Typography.tsx
│   ├── theme/
│   │   └── tokens.ts
│   └── types/
│       └── index.ts
├── __tests__/
│   ├── setup.ts
│   └── components/
│       └── ui/
│           ├── Button.test.tsx
│           └── Input.test.tsx
├── AGENTS.md
├── app.json
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── jest.config.js
└── babel.config.js
```

---

## 4. Detailed Implementation Tasks

### 4.1 Git Repository & Expo Scaffolding (Task 0.1)

- [x] Initialize git repo (if not already initialized) and configure `.gitignore` (ignoring `node_modules/`, `.expo/`, `ios/`, `android/`, `.env*`, coverage, artifacts).
- [x] Bootstrap Expo application using blank TypeScript template:
  ```bash
  npx create-expo-app@latest . --template blank-typescript
  ```
- [x] Configure `app.json`:
  - `name`: "PocketPick"
  - `slug`: "pocketpick"
  - `scheme`: "pocketpick"
  - `ios.bundleIdentifier`: `com.pocketpick.app`
  - `ios.supportsTablet`: false
  - `userInterfaceStyle`: "dark" / "light" (locked to strict high-contrast monochrome)
- [x] Verify clean initial TypeScript compilation:
  ```bash
  npx tsc --noEmit
  ```

### 4.2 Agentic Context, Rules & Skills Architecture (Task 0.2A)

- [x] Create root `AGENTS.md` (always-on context) detailing:
  - Repository map and architectural constraints.
  - Planning mode requirement prior to multi-file edits.
  - Mandatory TDD requirement for crypto, database, and business logic.
- [x] Create `.agents/rules/security-invariants.md`:
  - **Invariant 1:** NEVER log cryptographic keys, raw passphrases, plaintext secrets, or decrypted payloads to `console.log` or logging sinks.
  - **Invariant 2:** NEVER store unencrypted sensitive user resources (photos, notes, keys) on disk or in persistent storage (AsyncStorage/unencrypted SQLite).
  - **Invariant 3:** ALWAYS clear sensitive memory (ephemeral session keys, decrypted buffers) immediately upon lock or completion.
  - **Invariant 4:** ALWAYS wipe temporary decrypted OCR files inside a mandatory `finally` block using cryptographic file shredding or atomic deletion.
- [x] Create `.agents/rules/minimalist-ui.md`:
  - Enforce pure monochrome palette (black `#000000`, white `#FFFFFF`, neutral zinc/gray scale).
  - High contrast ratio (WCAG AAA compliant: minimum 7:1).
  - Strict typography scale using system fonts (`San Francisco` on iOS).
  - No drop shadows (`shadow-none`), no gradients, no decorative rounded pills (default to `rounded-none` or sharp `rounded-sm`).
- [x] Create `.agents/rules/code-quality.md`:
  - Zero TypeScript warnings or `any` escapes without explicit review.
  - Explicit function return types on all exported services.
- [x] Create `.agents/skills/db-migration/SKILL.md` (schema diff and migration verification instructions).
- [x] Create `.agents/skills/crypto-audit/SKILL.md` (heuristic regex scan for plaintext leaks, lingering files, insecure random generators).

### 4.3 Testing & Quality Assurance Tooling (Task 0.2B)

- [x] Install testing dependencies:
  ```bash
  npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest ts-jest
  ```
- [x] Configure `jest.config.js`:
  - Preset: `jest-expo`.
  - Setup files after env: `['@testing-library/jest-native/extend-expect', '<rootDir>/__tests__/setup.ts']`.
  - Module name mapper for `@/*` path aliases.
  - Coverage threshold: 85%+ on services and utilities.
- [x] Install linting and formatting tooling:
  ```bash
  npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks @typescript-eslint/eslint-plugin @typescript-eslint/parser husky lint-staged
  ```
- [x] Configure `lint-staged` in `package.json`:
  ```json
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "bash -c 'npx tsc --noEmit'"
    ]
  }
  ```
- [x] Initialize Husky and configure `.husky/pre-commit` to execute `npx lint-staged` and run quick unit tests.

### 4.4 Minimalist Design System & NativeWind Setup (Task 0.3)

- [x] Install NativeWind and Tailwind CSS:
  ```bash
  npm install nativewind tailwindcss react-native-reanimated react-native-safe-area-context
  ```
- [x] Configure `tailwind.config.js` with monochrome design tokens:
  ```javascript
  module.exports = {
    content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
      extend: {
        colors: {
          surface: {
            DEFAULT: '#FFFFFF',
            dark: '#000000',
            subtle: '#F4F4F5',
            'subtle-dark': '#18181B',
            muted: '#71717A',
            border: '#E4E4E7',
            'border-dark': '#27272A',
          },
          accent: {
            DEFAULT: '#000000',
            inverted: '#FFFFFF',
          },
        },
        fontFamily: {
          mono: ['Courier', 'Menlo', 'monospace'],
        },
        borderRadius: {
          none: '0px',
          sm: '2px',
        },
      },
    },
    plugins: [],
  };
  ```
- [x] Create atomic, minimalist UI components in `src/components/ui/`:
  - `Button.tsx`: Variants (`primary`, `secondary`, `destructive`), states (`disabled`, `loading`), haptic feedback hook placeholder.
  - `Input.tsx`: High-contrast border, monospace option for keys/passwords, clean error state.
  - `Card.tsx`: Bordered box, zero drop shadow, sharp corners.
  - `Typography.tsx`: `H1`, `H2`, `Body`, `Label`, `Mono` typography wrappers.
- [x] Write unit tests for each UI component in `__tests__/components/ui/` asserting render states, accessibility labels, and interaction callbacks.

---

## 5. Verification & Acceptance Criteria

1. **Lint & Typecheck:** `npm run lint` and `npx tsc --noEmit` execute with 0 warnings, 0 errors.
2. **Jest Suite:** `npm test` executes cleanly and passes all initial UI component unit tests.
3. **Husky Verification:** Attempting to commit a syntax error or a failing test must be aborted by the pre-commit hook.
4. **Agent Rules Active:** `.agents/rules/` and `AGENTS.md` are present and properly formatted.
5. **Clean Metro Bundler Start:** `npx expo start` starts without configuration errors or Babel transpilation warnings.
