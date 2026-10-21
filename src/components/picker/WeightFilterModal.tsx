import React from 'react';
import { View, Modal, Pressable, Text } from 'react-native';
import { Card, H2, Label, Button, Body, Mono } from '../ui';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <Card className="w-full max-w-sm p-6">
          <H2 className="mb-2">
            {theme.isUppercase ? 'SELECTION POOL FILTER' : 'Selection Pool Filter'}
          </H2>
          <Body style={{ color: theme.colors.textMuted }} className="text-xs mb-4">
            Configure which vault items are eligible for CSPRNG random selection.
          </Body>

          <Label className="mb-2">SELECTION ALGORITHM</Label>
          <View
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 8 : 0,
              padding: 12,
              marginBottom: 20,
            }}
          >
            <Mono style={{ color: theme.colors.textPrimary }} className="text-xs font-bold mb-1">
              STRICTLY UNIFORM (1/N)
            </Mono>
            <Body style={{ color: theme.colors.textSecondary }} className="text-[11px]">
              Every eligible item has an exact equal 1/N probability of selection via hardware
              CSPRNG.
            </Body>
          </View>

          <Label className="mb-2">FILTER POOL TYPE</Label>
          <View className="flex-row space-x-2 gap-2 mb-6">
            {(['all', 'ticket', 'photo'] as const).map((filter) => {
              const isSelected = typeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => onSelectTypeFilter(filter as ResourceTypeFilter)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: theme.borderRadius ? 8 : 0,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                    backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 12,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                      letterSpacing: theme.isUppercase ? 0.8 : 0,
                    }}
                  >
                    {filter.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button variant="primary" onPress={onClose}>
            {theme.isUppercase ? 'APPLY FILTER' : 'Apply Filter'}
          </Button>
        </Card>
      </View>
    </Modal>
  );
}

export const PoolFilterModal = WeightFilterModal;
