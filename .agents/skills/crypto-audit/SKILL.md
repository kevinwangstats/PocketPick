---
name: crypto-audit
description: Audits the PocketPick codebase and filesystem for plaintext security leaks, console logging of sensitive keys, and uncleaned temporary files.
---

# Cryptographic & Security Leak Audit

Run this audit skill before finalizing any phase or committing security-sensitive features.

## 1. Static Analysis: Console Logging Audit

Scan the codebase for forbidden log messages containing keys, tokens, or plaintext secrets:

```bash
# Grep for console logs in src/
grep -rnE "console\.(log|warn|info|debug)\(.*(key|passphrase|secret|cipher|token|plain|buffer|decrypt|encrypt)" src/
```

**Expected Result:** Zero matches. Any match must be eliminated.

## 2. Insecure Randomness Audit

Ensure `Math.random()` is never used in cryptographic or selection contexts:

```bash
grep -rn "Math.random()" src/
```

**Expected Result:** Matches only allowed for non-sensitive random UI mock jitter or temp file suffix generation, NEVER for cryptographic keys, salts, IVs, or random picker selections.

## 3. Storage Leaks Audit

Verify that persistent non-secure storage (`AsyncStorage`, unencrypted SQLite, plaintext files) is not being used for keys:

```bash
grep -rn "AsyncStorage" src/
```

**Expected Result:** Zero matches.

## 4. Ephemeral OCR Cleanup Verification

Verify all calls in `src/services/ocr/` utilize `try ... finally` with explicit file deletion:

```bash
grep -rn "shredFile" src/services/ocr/
```

**Expected Result:** Every OCR invocation contains an associated `finally` cleanup call.
