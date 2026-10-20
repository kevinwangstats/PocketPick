import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Card, H2, Label, Button, Body } from '../ui';

export type ResourceTypeFilter = 'all' | 'ticket' | 'photo';

export interface WeightFilterModalProps {
  visible: boolean;
  onClose: () => void;
  isWeighted: boolean;
  onToggleWeighted: (weighted: boolean) => void;
  typeFilter: ResourceTypeFilter;
  onSelectTypeFilter: (filter: ResourceTypeFilter) => void;
}

export function WeightFilterModal({
  visible,
  onClose,
  isWeighted,
  onToggleWeighted,
  typeFilter,
  onSelectTypeFilter,
}: WeightFilterModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-center items-center p-6">
        <Card className="w-full max-w-sm border-2 border-white p-6 bg-black">
          <H2 className="text-white mb-4">PICKER SETTINGS</H2>

          <Label className="text-zinc-400 mb-2">SAMPLING ALGORITHM</Label>
          <View className="flex-row space-x-2 gap-2 mb-6">
            <Pressable
              onPress={() => onToggleWeighted(false)}
              className={`flex-1 py-3 px-2 border items-center ${
                !isWeighted ? 'border-white bg-white' : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              <Label className={!isWeighted ? 'text-black' : 'text-zinc-400'}>UNIFORM (1/N)</Label>
            </Pressable>
            <Pressable
              onPress={() => onToggleWeighted(true)}
              className={`flex-1 py-3 px-2 border items-center ${
                isWeighted ? 'border-white bg-white' : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              <Label className={isWeighted ? 'text-black' : 'text-zinc-400'}>WEIGHTED</Label>
            </Pressable>
          </View>

          <Label className="text-zinc-400 mb-2">FILTER POOL TYPE</Label>
          <View className="flex-row space-x-2 gap-2 mb-6">
            {(['all', 'ticket', 'photo'] as ResourceTypeFilter[]).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => onSelectTypeFilter(filter)}
                className={`flex-1 py-2 border items-center ${
                  typeFilter === filter ? 'border-white bg-white' : 'border-zinc-800 bg-zinc-950'
                }`}
              >
                <Label className={typeFilter === filter ? 'text-black' : 'text-zinc-400'}>
                  {filter.toUpperCase()}
                </Label>
              </Pressable>
            ))}
          </View>

          <Body className="text-xs text-zinc-500 mb-6">
            CSPRNG rejection sampling guarantees unbiased random draws under both uniform and
            weighted distributions.
          </Body>

          <Button variant="primary" onPress={onClose}>
            APPLY & CLOSE
          </Button>
        </Card>
      </View>
    </Modal>
  );
}
