import * as FileSystem from 'expo-file-system/legacy';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { chatMessages, ootdLooks, persons, photos } from '../../db/schema';
import { deriveVaultKey, generateSalt, PBKDF2_ITERATIONS } from '../../crypto/kdf';
import { encryptBuffer, decryptBuffer, encryptString, decryptString } from '../../crypto/cipher';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { decryptImageBuffer } from '../media/imagePipeline';
import { shredFile } from '../media/fileShredder';
import { getDecryptedPhotoMetadata, ingestPhoto } from '../photos/photoService';
import { createPerson, listPersons } from '../persons/personService';
import {
  decryptLookSlotsStrict,
  saveOotdLook,
  linkFitCheckPhoto,
} from '../../engine/lookbookStore';
import { decryptMessageTextStrict } from '../chat/chatService';
import {
  BackupEncryptedFrame,
  BackupExportResult,
  BackupHeader,
  BackupImportResult,
  BackupManifest,
  OOTD_BACKUP_FORMAT,
} from './types';

function manifestAad(): string {
  return `${OOTD_BACKUP_FORMAT}:manifest`;
}

function mediaAad(mediaKey: string): string {
  return `${OOTD_BACKUP_FORMAT}:media:${mediaKey}`;
}

/**
 * Generates a passphrase-encrypted chunked NDJSON `.ootdbackup` file containing all Persons,
 * Plain-Text Memories, Avatars, Wardrobe & Past OOTD photos, Looks, and optionally Chats.
 * Processes media binaries sequentially so peak decrypted memory remains minimal.
 * Callers must pass an action callback if sharing so temporary archive is shredded in `finally`.
 */
export async function buildEncryptedBackupArchive(params: {
  sessionKey: Buffer;
  backupPassphrase: string;
  includeChats?: boolean;
}): Promise<BackupExportResult> {
  const { sessionKey, backupPassphrase, includeChats = true } = params;
  if (!backupPassphrase || backupPassphrase.length < 6) {
    throw new Error('Backup passphrase must be at least 6 characters');
  }

  const salt = generateSalt();
  const backupKey = deriveVaultKey(backupPassphrase, salt);

  try {
    const db = await getDatabase();
    const [personRows, photoRows, lookRows, chatRows] = await Promise.all([
      listPersons(),
      db.select().from(photos).orderBy(asc(photos.createdAt)),
      db.select().from(ootdLooks).orderBy(asc(ootdLooks.createdAt)),
      includeChats
        ? db.select().from(chatMessages).orderBy(asc(chatMessages.createdAt))
        : Promise.resolve([]),
    ]);

    const manifest: BackupManifest = {
      schemaVersion: 1,
      exportedAtIso: new Date().toISOString(),
      includeChats,
      persons: personRows.map((p) => ({
        id: p.id,
        name: p.name,
        bio: p.bio ?? null,
        tonePreset: p.tonePreset ?? null,
        personalityPrompt: p.personalityPrompt,
        memoryText: p.memoryText,
        hasAvatar: Boolean(p.avatarEncryptedPath && p.avatarIv && p.avatarTag),
      })),
      photos: photoRows.map((ph) => {
        const meta = getDecryptedPhotoMetadata(ph, sessionKey);
        return {
          id: ph.id,
          photoKind: ph.photoKind,
          aiHasHumanBody: ph.aiHasHumanBody === 1 ? true : ph.aiHasHumanBody === 0 ? false : null,
          category: ph.category,
          item: meta.item,
          description: meta.description,
          lastWornAtIso: ph.lastWornAt ? ph.lastWornAt.toISOString() : null,
          createdAtIso: ph.createdAt.toISOString(),
        };
      }),
      looks: lookRows.flatMap((lk) => {
        try {
          const slots = decryptLookSlotsStrict(lk, sessionKey);
          return [
            {
              id: lk.id,
              personId: lk.personId,
              triggerType: lk.triggerType,
              slots,
              isFavorite: lk.isFavorite === 1,
              wornAtIso: lk.wornAt ? lk.wornAt.toISOString() : null,
              fitcheckPhotoId: lk.fitcheckPhotoId ?? null,
              createdAtIso: lk.createdAt.toISOString(),
            },
          ];
        } catch {
          return [];
        }
      }),
      chats: chatRows.flatMap((ch) => {
        try {
          const text = decryptMessageTextStrict(ch, sessionKey, ch.personId);
          return [
            {
              id: ch.id,
              personId: ch.personId,
              role: ch.role,
              text,
              photoId: ch.photoId ?? null,
              ootdLookId: ch.ootdLookId ?? null,
              createdAtIso: ch.createdAt.toISOString(),
            },
          ];
        } catch {
          return [];
        }
      }),
    };

    const lines: string[] = [];
    const encManifest = encryptString(JSON.stringify(manifest), backupKey, manifestAad());
    const manifestFrame: BackupEncryptedFrame = {
      type: 'manifest',
      iv: encManifest.iv,
      tag: encManifest.tag,
      ciphertext: encManifest.ciphertext,
    };
    lines.push(JSON.stringify(manifestFrame));

    // Stream/encrypt each avatar and photo frame sequentially (one decrypted buffer at a time)
    for (const p of personRows) {
      if (p.avatarEncryptedPath && p.avatarIv && p.avatarTag) {
        const buf = await decryptImageBuffer({
          encryptedPath: p.avatarEncryptedPath,
          iv: p.avatarIv,
          tag: p.avatarTag,
          sessionKey,
          aad: `avatar:${p.id}`,
        });
        const mediaKey = `avatar:${p.id}`;
        const reenc = encryptBuffer(buf, backupKey, mediaAad(mediaKey));
        zeroizeBuffer(buf);
        const frame: BackupEncryptedFrame = {
          type: 'media',
          mediaKey,
          iv: reenc.iv,
          tag: reenc.tag,
          ciphertext: reenc.ciphertext,
        };
        lines.push(JSON.stringify(frame));
      }
    }

    for (const ph of photoRows) {
      const buf = await decryptImageBuffer({
        encryptedPath: ph.encryptedFilePath,
        iv: ph.fileIv,
        tag: ph.fileTag,
        sessionKey,
        aad: ph.id,
      });
      const mediaKey = `photo:${ph.id}`;
      const reenc = encryptBuffer(buf, backupKey, mediaAad(mediaKey));
      zeroizeBuffer(buf);
      const frame: BackupEncryptedFrame = {
        type: 'media',
        mediaKey,
        iv: reenc.iv,
        tag: reenc.tag,
        ciphertext: reenc.ciphertext,
      };
      lines.push(JSON.stringify(frame));
    }

    const header: BackupHeader = {
      format: OOTD_BACKUP_FORMAT,
      salt: salt.toString('base64'),
      iterations: PBKDF2_ITERATIONS,
      frameCount: lines.length,
    };

    const outputLines = [JSON.stringify(header), ...lines].join('\n');
    const randSuffix = QuickCrypto.randomBytes(4).toString('hex');
    const archiveUri = `${FileSystem.cacheDirectory}pocketpick_ootd_${randSuffix}.ootdbackup`;
    await FileSystem.writeAsStringAsync(archiveUri, outputLines, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      archiveUri,
      personsCount: manifest.persons.length,
      photosCount: manifest.photos.length,
      looksCount: manifest.looks.length,
      chatsCount: manifest.chats.length,
    };
  } finally {
    zeroizeBuffer(backupKey);
  }
}

/**
 * Exports an encrypted `.ootdbackup` archive via an injected presenter (e.g. Sharing.shareAsync)
 * and unconditionally shreds the temporary archive file in `finally`.
 */
export async function exportEncryptedBackup(params: {
  sessionKey: Buffer;
  backupPassphrase: string;
  includeChats?: boolean;
  shareArchive: (archiveUri: string) => Promise<void>;
}): Promise<BackupExportResult> {
  const result = await buildEncryptedBackupArchive({
    sessionKey: params.sessionKey,
    backupPassphrase: params.backupPassphrase,
    includeChats: params.includeChats,
  });

  try {
    await params.shareArchive(result.archiveUri);
    return result;
  } finally {
    await shredFile(result.archiveUri);
  }
}

/**
 * Verifies every frame's GCM auth tag before mutating the local database, then imports
 * Persons, Plain-Text Memories, Avatars, Photos, Looks, and Chats under `sessionKey`.
 */
export async function importEncryptedBackup(params: {
  archiveUri: string;
  backupPassphrase: string;
  sessionKey: Buffer;
}): Promise<BackupImportResult> {
  const { archiveUri, backupPassphrase, sessionKey } = params;
  if (!backupPassphrase) {
    throw new Error('Backup passphrase is required');
  }

  let backupKey: Buffer | null = null;
  const tempMediaFiles: string[] = [];

  try {
    const rawArchive = await FileSystem.readAsStringAsync(archiveUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const rawLines = rawArchive
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (rawLines.length < 2) {
      throw new Error('Invalid or empty backup archive');
    }

    const header = JSON.parse(rawLines[0]) as BackupHeader;
    if (header.format !== OOTD_BACKUP_FORMAT || !header.salt) {
      throw new Error('Unsupported backup archive format');
    }

    const saltBuf = Buffer.from(header.salt, 'base64');
    backupKey = deriveVaultKey(backupPassphrase, saltBuf);

    // 1. Parse and strictly authenticate ALL frames before writing to DB
    const manifestFrame = JSON.parse(rawLines[1]) as BackupEncryptedFrame;
    if (manifestFrame.type !== 'manifest') {
      throw new Error('Missing backup manifest frame');
    }

    const manifestJson = decryptString(
      {
        ciphertext: manifestFrame.ciphertext,
        iv: manifestFrame.iv,
        tag: manifestFrame.tag,
      },
      backupKey,
      manifestAad(),
    );
    const manifest = JSON.parse(manifestJson) as BackupManifest;

    const verifiedMediaFrames = new Map<string, BackupEncryptedFrame>();
    for (let i = 2; i < rawLines.length; i++) {
      const frame = JSON.parse(rawLines[i]) as BackupEncryptedFrame;
      if (frame.type !== 'media' || !frame.mediaKey) {
        throw new Error('Corrupt media frame in backup');
      }
      // Verify GCM auth tag upfront without retaining plaintext in RAM
      const checkBuf = decryptBuffer(
        { ciphertext: frame.ciphertext, iv: frame.iv, tag: frame.tag },
        backupKey,
        mediaAad(frame.mediaKey),
      );
      zeroizeBuffer(checkBuf);
      verifiedMediaFrames.set(frame.mediaKey, frame);
    }

    // 2. Import Photos (re-encrypting under destination appSessionKey, deduplicating by fileHash)
    const photoIdMap = new Map<string, string>();
    let photosImported = 0;
    let photosDeduplicated = 0;

    for (const ph of manifest.photos) {
      const frame = verifiedMediaFrames.get(`photo:${ph.id}`);
      if (!frame) continue;

      const decBuf = decryptBuffer(
        { ciphertext: frame.ciphertext, iv: frame.iv, tag: frame.tag },
        backupKey,
        mediaAad(`photo:${ph.id}`),
      );
      const tempPath = `${FileSystem.cacheDirectory}imp_ph_${QuickCrypto.randomBytes(6).toString('hex')}.jpg`;
      tempMediaFiles.push(tempPath);
      await FileSystem.writeAsStringAsync(tempPath, decBuf.toString('base64'), {
        encoding: FileSystem.EncodingType.Base64,
      });
      zeroizeBuffer(decBuf);

      const ingested = await ingestPhoto(tempPath, sessionKey, {
        photoKind: ph.photoKind,
        aiHasHumanBody: ph.aiHasHumanBody,
        category: ph.category,
        item: ph.item,
        description: ph.description,
      });

      photoIdMap.set(ph.id, ingested.photoId);
      if (ingested.isDuplicate) photosDeduplicated += 1;
      else photosImported += 1;
    }

    // 3. Import Persons & Avatars (handling duplicate names gracefully)
    const existingPersons = await listPersons();
    const existingNames = new Set(existingPersons.map((p) => p.name.trim().toLowerCase()));
    const personIdMap = new Map<string, string>();
    let personsImported = 0;

    for (const p of manifest.persons) {
      let targetName = p.name.trim();
      if (existingNames.has(targetName.toLowerCase())) {
        let suffix = 1;
        while (existingNames.has(`${targetName} (imported ${suffix})`.toLowerCase())) {
          suffix += 1;
        }
        targetName =
          suffix === 1 && !existingNames.has(`${targetName} (imported)`.toLowerCase())
            ? `${targetName} (Imported)`
            : `${targetName} (Imported ${suffix})`;
      }
      existingNames.add(targetName.toLowerCase());

      let avatarTempPath: string | undefined;
      const avatarFrame = verifiedMediaFrames.get(`avatar:${p.id}`);
      if (avatarFrame) {
        const decAvatar = decryptBuffer(
          { ciphertext: avatarFrame.ciphertext, iv: avatarFrame.iv, tag: avatarFrame.tag },
          backupKey,
          mediaAad(`avatar:${p.id}`),
        );
        avatarTempPath = `${FileSystem.cacheDirectory}imp_av_${QuickCrypto.randomBytes(6).toString('hex')}.jpg`;
        tempMediaFiles.push(avatarTempPath);
        await FileSystem.writeAsStringAsync(avatarTempPath, decAvatar.toString('base64'), {
          encoding: FileSystem.EncodingType.Base64,
        });
        zeroizeBuffer(decAvatar);
      }

      const created = await createPerson({
        name: targetName,
        bio: p.bio ?? undefined,
        tonePreset: p.tonePreset ?? undefined,
        personalityPrompt: p.personalityPrompt,
        memoryText: p.memoryText,
        avatarUri: avatarTempPath,
        sessionKey,
      });

      personIdMap.set(p.id, created.id);
      personsImported += 1;
    }

    // 4. Import OOTD Looks (remapping personId & photoId)
    const lookIdMap = new Map<string, string>();
    let looksImported = 0;
    const db = await getDatabase();

    for (const lk of manifest.looks) {
      const mappedPersonId = personIdMap.get(lk.personId);
      if (!mappedPersonId) continue;

      const remappedSlots = lk.slots.map((s) => {
        const mappedPhotoId = s.photoId ? (photoIdMap.get(s.photoId) ?? null) : null;
        return {
          ...s,
          photoId: mappedPhotoId,
          isMissing: mappedPhotoId ? false : s.isMissing,
        };
      });

      const savedLook = await saveOotdLook({
        personId: mappedPersonId,
        triggerType: lk.triggerType,
        slots: remappedSlots,
        sessionKey,
        isFavorite: lk.isFavorite,
        wornAt: lk.wornAtIso ? new Date(lk.wornAtIso) : null,
      });

      if (lk.fitcheckPhotoId) {
        const mappedFitId = photoIdMap.get(lk.fitcheckPhotoId);
        if (mappedFitId) {
          await linkFitCheckPhoto(savedLook.id, mappedFitId);
        }
      }

      lookIdMap.set(lk.id, savedLook.id);
      looksImported += 1;
    }

    // 5. Import Chats (re-encrypting under destination sessionKey)
    let chatsImported = 0;
    for (const ch of manifest.chats) {
      const mappedPersonId = personIdMap.get(ch.personId);
      if (!mappedPersonId) continue;

      const newMsgId = QuickCrypto.randomBytes(16).toString('hex');
      const enc = encryptString(ch.text, sessionKey, mappedPersonId);
      await db.insert(chatMessages).values({
        id: newMsgId,
        personId: mappedPersonId,
        role: ch.role,
        encryptedContent: enc.ciphertext,
        contentIv: enc.iv,
        contentTag: enc.tag,
        photoId: ch.photoId ? (photoIdMap.get(ch.photoId) ?? null) : null,
        ootdLookId: ch.ootdLookId ? (lookIdMap.get(ch.ootdLookId) ?? null) : null,
        createdAt: new Date(ch.createdAtIso),
      });
      chatsImported += 1;
    }

    // Touch updatedAt for imported persons
    for (const newPersonId of personIdMap.values()) {
      await db.update(persons).set({ updatedAt: new Date() }).where(eq(persons.id, newPersonId));
    }

    return {
      personsImported,
      photosImported,
      photosDeduplicated,
      looksImported,
      chatsImported,
    };
  } finally {
    if (backupKey) {
      zeroizeBuffer(backupKey);
    }
    for (const tmp of tempMediaFiles) {
      await shredFile(tmp);
    }
    if (archiveUri && archiveUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(archiveUri);
    }
  }
}
