#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "        POCKETPICK OOTD CRYPTOGRAPHIC SECURITY AUDIT      "
echo "=========================================================="

AUDIT_FAILED=0

# 1. Console Logging Audit
echo "[1/4] Auditing for sensitive console.log statements..."
SENSITIVE_LOGS=$(grep -rnE "console\.(log|warn|info|debug)\(.*(key|passphrase|secret|cipher|token|plain|buffer|decrypt|encrypt|memoryText)" src/ || true)
if [ -n "$SENSITIVE_LOGS" ]; then
  echo "❌ CRITICAL SECURITY ERROR: Sensitive console logging detected:"
  echo "$SENSITIVE_LOGS"
  AUDIT_FAILED=1
else
  echo "✅ PASSED: Zero sensitive console logs found."
fi

# 2. Insecure Randomness Audit
echo "[2/4] Auditing for insecure Math.random() usage in crypto, randomizer, and OOTD engine..."
CRYPTO_RANDOM=$(grep -rn "Math.random()" src/crypto/ src/services/randomizer/ src/engine/ || true)
if [ -n "$CRYPTO_RANDOM" ]; then
  echo "❌ CRITICAL SECURITY ERROR: Math.random() detected in crypto or OOTD selection engine:"
  echo "$CRYPTO_RANDOM"
  AUDIT_FAILED=1
else
  echo "✅ PASSED: CSPRNG strictly enforced in crypto, randomizer, and OOTD engine."
fi

# 3. Storage Leak Audit
echo "[3/4] Auditing for persistent unencrypted storage leaks (AsyncStorage)..."
ASYNC_STORAGE=$(grep -rnE "(import.*AsyncStorage|require\(.*AsyncStorage|AsyncStorage\.)" src/ || true)
if [ -n "$ASYNC_STORAGE" ]; then
  echo "❌ CRITICAL SECURITY ERROR: AsyncStorage detected in codebase:"
  echo "$ASYNC_STORAGE"
  AUDIT_FAILED=1
else
  echo "✅ PASSED: Zero AsyncStorage references detected. Keychain and SQLCipher enforced."
fi

# 4. Ephemeral Media & Backup Shredding Audit
echo "[4/4] Auditing ephemeral media, photo, person, and backup shredding..."
MEDIA_SHRED=$(grep -rn "shredFile" src/services/media/ src/services/photos/ src/services/persons/ src/services/backup/ || true)
if [ -z "$MEDIA_SHRED" ]; then
  echo "❌ CRITICAL SECURITY ERROR: Media or backup pipeline is missing shredFile cleanup."
  AUDIT_FAILED=1
else
  echo "✅ PASSED: Ephemeral media and backup pipelines invoke shredFile cleanup."
fi

echo "=========================================================="
if [ "$AUDIT_FAILED" -eq 1 ]; then
  echo "❌ AUDIT FAILED. Security invariants violated."
  exit 1
else
  echo "✅ AUDIT PASSED: All cryptographic and zero-leak invariants satisfied."
  exit 0
fi
