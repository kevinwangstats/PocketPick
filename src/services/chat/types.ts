import { Photo, PhotoKind, WardrobeCategory } from '../../db/schema';
import { DecryptedOotdLook, OutfitSlotKey } from '../../engine/types';

export type ChatAttachmentInput =
  | {
      kind: 'new_photo';
      uri: string;
      photoKind?: PhotoKind;
      category?: WardrobeCategory;
      item?: string;
      description?: string;
    }
  | {
      kind: 'existing_photo';
      photoId: string;
    };

export interface DecryptedChatMessage {
  id: string;
  personId: string;
  role: 'user' | 'assistant';
  text: string;
  photo: Photo | null;
  ootdLook: DecryptedOotdLook | null;
  createdAt: Date;
}

export interface SendChatMessageParams {
  personId: string;
  text: string;
  attachment?: ChatAttachmentInput | null;
  overrideSlots?: OutfitSlotKey[];
  forceStyleMode?: 'random' | 'ai';
  sessionKey: Buffer;
}

export interface SendChatMessageResult {
  userMessage: DecryptedChatMessage;
  assistantMessage: DecryptedChatMessage | null;
  autoMovedToPastOotdPhotoId: string | null;
  error?: string;
}
