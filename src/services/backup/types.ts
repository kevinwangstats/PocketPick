import { PhotoKind, WardrobeCategory } from '../../db/schema';
import { OotdSlotSelection, OotdTriggerType } from '../../engine/types';

export const OOTD_BACKUP_FORMAT = 'OOTD_BACKUP_V1' as const;

export interface BackupHeader {
  format: typeof OOTD_BACKUP_FORMAT;
  salt: string;
  iterations: number;
  frameCount: number;
}

export interface BackupEncryptedFrame {
  type: 'manifest' | 'media';
  mediaKey?: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface BackupPersonRecord {
  id: string;
  name: string;
  bio: string | null;
  tonePreset: string | null;
  personalityPrompt: string;
  memoryText: string;
  hasAvatar: boolean;
}

export interface BackupPhotoRecord {
  id: string;
  photoKind: PhotoKind;
  aiHasHumanBody: boolean | null;
  category: WardrobeCategory;
  item: string;
  description: string;
  lastWornAtIso: string | null;
  createdAtIso: string;
}

export interface BackupChatRecord {
  id: string;
  personId: string;
  role: 'user' | 'assistant';
  text: string;
  photoId: string | null;
  ootdLookId: string | null;
  createdAtIso: string;
}

export interface BackupLookRecord {
  id: string;
  personId: string;
  triggerType: OotdTriggerType;
  slots: OotdSlotSelection[];
  isFavorite: boolean;
  wornAtIso: string | null;
  fitcheckPhotoId: string | null;
  createdAtIso: string;
}

export interface BackupManifest {
  schemaVersion: 1;
  exportedAtIso: string;
  includeChats: boolean;
  persons: BackupPersonRecord[];
  photos: BackupPhotoRecord[];
  looks: BackupLookRecord[];
  chats: BackupChatRecord[];
}

export interface BackupExportResult {
  archiveUri: string;
  personsCount: number;
  photosCount: number;
  looksCount: number;
  chatsCount: number;
}

export interface BackupImportResult {
  personsImported: number;
  photosImported: number;
  photosDeduplicated: number;
  looksImported: number;
  chatsImported: number;
}
