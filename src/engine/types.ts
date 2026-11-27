import { Photo, WardrobeCategory } from '../db/schema';

export type OutfitSlotKey =
  'top' | 'bottom' | 'underwear' | 'bra' | 'panties' | 'hosiery' | 'others';

export const SKIN_OUTWARD_SLOT_ORDER: OutfitSlotKey[] = [
  'underwear',
  'bra',
  'panties',
  'hosiery',
  'top',
  'bottom',
  'others',
];

export type OotdCommandType = 'ootd' | 'secret' | 'style' | 'fitcheck';
export type OotdTriggerType = 'ootd' | 'secret' | 'style';

export interface ParsedOotdCommand {
  command: OotdCommandType | null;
  rawArgs: string;
  activeSlots: OutfitSlotKey[];
  pairBraAndPanties: boolean;
  excludedCategories: WardrobeCategory[];
}

export interface WardrobeCandidate {
  photo: Photo;
  category: WardrobeCategory;
  item: string;
  description: string;
}

export interface OotdSlotSelection {
  slot: OutfitSlotKey;
  category: WardrobeCategory;
  photoId: string | null;
  itemLabel: string;
  description: string;
  thumbnailPath: string | null;
  thumbnailIv: string | null;
  thumbnailTag: string | null;
  isMissing?: boolean;
}

export interface PickOutfitOptions {
  commandText: string;
  overrideSlots?: OutfitSlotKey[];
  cooldownDays?: number;
  personPrompt?: string;
  personMemory?: string;
  forceStyleMode?: 'random' | 'ai';
  sessionKey: Buffer;
}

export interface PickOutfitResult {
  triggerType: OotdTriggerType;
  slots: OotdSlotSelection[];
  excludedCategories: WardrobeCategory[];
  emptySlots: OutfitSlotKey[];
  usedAiCuration: boolean;
  rawConstraintText: string;
  totalWardrobeCount: number;
}

export interface DecryptedOotdLook {
  id: string;
  personId: string;
  triggerType: OotdTriggerType;
  slots: OotdSlotSelection[];
  isFavorite: boolean;
  wornAt: Date | null;
  fitcheckPhotoId: string | null;
  createdAt: Date;
}
