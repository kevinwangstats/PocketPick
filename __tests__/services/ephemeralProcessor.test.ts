import { processEphemeralOcr } from '../../src/services/ocr/ephemeralProcessor';
import * as fileShredder from '../../src/services/media/fileShredder';
import * as cipher from '../../src/crypto/cipher';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import QuickCrypto from 'react-native-quick-crypto';

describe('Ephemeral OCR Processor (Zero-Leak Verification)', () => {
  const dummyKey = QuickCrypto.randomBytes(32);
  const iv = QuickCrypto.randomBytes(12).toString('base64');
  const tag = QuickCrypto.randomBytes(16).toString('base64');
  const dummyEncryptedPath = '/mock/vaults/vault1/resources/res1.enc';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decrypts image, extracts text, and shreds temporary file on success', async () => {
    const shredSpy = jest.spyOn(fileShredder, 'shredFile');
    const readSpy = jest
      .spyOn(FileSystem, 'readAsStringAsync')
      .mockResolvedValueOnce(Buffer.from('mock ciphertext').toString('base64'));
    const writeSpy = jest.spyOn(FileSystem, 'writeAsStringAsync').mockResolvedValueOnce();

    jest.spyOn(cipher, 'decryptBuffer').mockReturnValueOnce(Buffer.from('fake image binary'));

    const text = await processEphemeralOcr({
      encryptedFilePath: dummyEncryptedPath,
      key: dummyKey,
      iv,
      tag,
      vaultId: 'v1',
    });

    expect(text).toBe('Extracted OCR Mock Text 12345');
    expect(readSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
    // Invariant: shredFile MUST be called
    expect(shredSpy).toHaveBeenCalledTimes(1);
    expect(shredSpy.mock.calls[0][0]).toContain('ocr_ephemeral_');
  });

  it('guarantees shredFile is called even if TextRecognition throws an error', async () => {
    const shredSpy = jest.spyOn(fileShredder, 'shredFile');
    jest
      .spyOn(FileSystem, 'readAsStringAsync')
      .mockResolvedValueOnce(Buffer.from('mock ciphertext').toString('base64'));
    jest.spyOn(FileSystem, 'writeAsStringAsync').mockResolvedValueOnce();
    jest.spyOn(cipher, 'decryptBuffer').mockReturnValueOnce(Buffer.from('fake image binary'));

    // Inject native OCR failure
    jest
      .spyOn(TextRecognition, 'recognize')
      .mockRejectedValueOnce(new Error('Native Vision Engine Failure'));

    await expect(
      processEphemeralOcr({
        encryptedFilePath: dummyEncryptedPath,
        key: dummyKey,
        iv,
        tag,
        vaultId: 'v1',
      }),
    ).rejects.toThrow('Native Vision Engine Failure');

    // Invariant: shredFile MUST still have been called in finally block
    expect(shredSpy).toHaveBeenCalledTimes(1);
    expect(shredSpy.mock.calls[0][0]).toContain('ocr_ephemeral_');
  });
});
