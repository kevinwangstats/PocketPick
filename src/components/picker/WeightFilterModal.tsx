import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Card, H2, Label, Button, Body, Mono } from '../ui';

export type ResourceTypeFilter = 'all' | 'ticket' | 'photo';

export interface PoolFilterModalProps {
  visible: boolean;
  onClose: () => void;
  typeFilter: ResourceTypeFilter;
  onSelectTypeFilter: (filter: ResourceTypeFilter) => void;
}

// Backward-compatible alias for existing references
export interface WeightFilterModalProps {
  visible: boolean;
  onClose: () => void;
  isWeighted?: boolean;
  onToggleWeighted?: (weighted: boolean) => void;
  typeFilter: ResourceTypeFilter;
  onSelectTypeFilter: (filter: ResourceTypeFilter) => void;
}

export function WeightFilterModal({
  visible,
  onClose,
  typeFilter,
  onSelectTypeFilter,
}: WeightFilterModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-center items-center p-6">
        <Card className="w-full max-w-sm border-2 border-white p-6 bg-black">
          <H2 className="text-white mb-2">SELECTION POOL FILTER</H2>
          <Body className="text-xs text-zinc-500 mb-4">
            Configure which vault items are eligible for CSPRNG random selection.
          </Body>

          <Label className="text-zinc-400 mb-2">SELECTION ALGORITHM</Label>
          <View className="p-3 bg-zinc-950 border border-zinc-800 mb-5">
            <Mono className="text-xs text-white font-bold mb-1">STRICTLY UNIFORM (1/N)</Mono>
            <Body className="text-[11px] text-zinc-400">
              Every eligible item has an exact equal 1/N probability of selection via hardware
              CSPRNG.
            </Body>
          </View>

          <Label className="text-zinc-400 mb-2">FILTER POOL TYPE</Label>
          <View className="flex-row space-x-2 gap-2 mb-6">
            {(['all', 'ticket', 'photo'] as ResourceTypeFilter[]).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => onSelectTypeFilter(filter)}
                className={`flex-1 py-2.5 border items-center ${
                  typeFilter === filter ? 'border-white bg-white' : 'border-zinc-800 bg-zinc-950'
                }`}
              >
                <Label className={typeFilter === filter ? 'text-black font-bold' : 'text-zinc-400'}>
                  {filter.toUpperCase()}
                </Label>
              </Pressable>
            ))}
          </View>

          <Button variant="primary" onPress={onClose}>
            APPLY FILTER
          </Button>
        </Card>
      </View>
    </Modal>
  );
}

export const PoolFilterModal = WeightFilterModal;
