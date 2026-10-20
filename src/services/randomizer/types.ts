import { Resource } from '../../db/schema';

export interface PickableItem {
  id: string;
  weight: number;
  [key: string]: unknown;
}

export interface DecryptedWinner {
  resource: Resource;
  title: string;
  content?: string;
  isPhoto: boolean;
  thumbnailBase64?: string;
}

export type PickerState = 'idle' | 'shuffling' | 'decelerating' | 'revealed';
