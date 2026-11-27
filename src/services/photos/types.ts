import { Photo, PhotoKind, WardrobeCategory } from '../../db/schema';

export type { Photo, PhotoKind, WardrobeCategory };

export const CANONICAL_ITEM_CHIPS: Record<WardrobeCategory, string[]> = {
  top: ['tshirt', 'blouse', 'camisole', 'crop top', 'sweater', 'shirt'],
  bottom: ['pants', 'jeans', 'skirt', 'shorts', 'leggings'],
  underwear: ['bra', 'bralette', 'panties', 'thong', 'lingerie set', 'bodysuit'],
  hosiery: ['thigh-highs', 'tights', 'stockings', 'sheer socks', 'garter'],
  others: ['heels', 'boots', 'jacket', 'dress', 'jewelry', 'bag'],
};

export interface DecryptedPhotoMetadata {
  item: string;
  description: string;
}

export interface DecryptedPhotoRecord {
  photo: Photo;
  item: string;
  description: string;
}

export interface IngestPhotoOptions {
  photoKind?: PhotoKind;
  category?: WardrobeCategory;
  item?: string;
  description?: string;
  aiHasHumanBody?: boolean | null;
}

export interface IngestPhotoResult {
  photoId: string;
  fileHash: string;
  isDuplicate: boolean;
  photo?: Photo;
}

export interface PhotoAiClassification {
  hasHumanBodyMainSubject: boolean;
  photoKind: PhotoKind;
  category: WardrobeCategory;
  item: string;
  description: string;
}
