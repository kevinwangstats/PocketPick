import { resolveResourcePath } from '../media/pathResolver';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Buffer } from '@craftzdog/react-native-buffer';
import { decryptBuffer } from '../../crypto/cipher';
import { shredFile } from '../media/fileShredder';
import QuickCrypto from 'react-native-quick-crypto';

export interface EphemeralOcrOptions {
  encryptedFilePath: string;
  key: Buffer;
  iv: string;
  tag: string;
  vaultId?: string;
}

/**
 * Ephemeral OCR Pipeline:
 * 1. Reads ciphertext from encrypted disk file.
 * 2. Decrypts buffer in memory using the active vault key.
 * 3. Writes temporary plaintext file to sandbox cache.
 * 4. Executes on-device text recognition.
 * 5. INVARIANT: Always overwrites and shreds the temporary plaintext file inside a `finally` block.
 */
export async function processEphemeralOcr({
  encryptedFilePath,
  key,
  iv,
  tag,
  vaultId,
}: EphemeralOcrOptions): Promise<string> {
  const randomSuffix = QuickCrypto.randomBytes(8).toString('hex');
  const tempFileName = `ocr_ephemeral_${Date.now()}_${randomSuffix}.tmp`;
  const tempPath = `${FileSystem.cacheDirectory ?? ''}${tempFileName}`;

  try {
    // 1. Read encrypted file from disk (resolving sandbox relative path if needed)
    const resolvedPath = resolveResourcePath(encryptedFilePath) ?? encryptedFilePath;
    const ciphertextBase64 = await FileSystem.readAsStringAsync(resolvedPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Decrypt in memory
    const decryptedBuffer = decryptBuffer(
      {
        ciphertext: ciphertextBase64,
        iv,
        tag,
      },
      key,
      vaultId,
    );

    // 3. Write temporary unencrypted image for native OCR engine
    await FileSystem.writeAsStringAsync(tempPath, decryptedBuffer.toString('base64'), {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 4. Run on-device text recognition
    const result = await TextRecognition.recognize(tempPath);
    return result.text;
  } finally {
    // 5. Mandatory zero-leak cleanup: shred temporary unencrypted file
    await shredFile(tempPath).catch(() => {
      // Defense-in-depth: silence error after attempting shred
    });
  }
}
