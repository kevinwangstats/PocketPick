import React, { useState } from 'react';
import { View, Modal, Pressable, Text, TextInput } from 'react-native';
import { OutfitSlotKey } from '../../engine/types';
import { Button, H2, Label } from '../ui';
import { useTheme } from '../../theme';

const ALL_BUILDER_SLOTS: Array<{ key: OutfitSlotKey; label: string }> = [
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'bra', label: 'Bra' },
  { key: 'panties', label: 'Panties' },
  { key: 'hosiery', label: 'Hosiery' },
  { key: 'others', label: 'Others' },
];

export interface OotdQuickBuilderSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (slots: OutfitSlotKey[], mode: 'random' | 'ai', note: string) => void;
}

export const OotdQuickBuilderSheet: React.FC<OotdQuickBuilderSheetProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();
  const [selectedSlots, setSelectedSlots] = useState<OutfitSlotKey[]>([
    'top',
    'bottom',
    'bra',
    'panties',
    'hosiery',
    'others',
  ]);
  const [mode, setMode] = useState<'random' | 'ai'>('random');
  const [note, setNote] = useState('');

  const toggleSlot = (slot: OutfitSlotKey) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.borderRadius ? 20 : 0,
            borderTopRightRadius: theme.borderRadius ? 20 : 0,
            borderTopWidth: 1,
            borderColor: theme.colors.cardBorder,
            padding: 20,
            paddingBottom: 32,
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <H2>OOTD Quick Builder</H2>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>

          <Label className="mb-2">QUICK PRESETS</Label>
          <View className="flex-row flex-wrap gap-2 mb-4">
            <Pressable
              onPress={() =>
                setSelectedSlots(['top', 'bottom', 'bra', 'panties', 'hosiery', 'others'])
              }
              style={{
                backgroundColor: theme.colors.badgeBg,
                borderRadius: theme.borderRadius ? 10 : 0,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '700' }}>
                Full Look
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedSlots(['bra', 'panties'])}
              style={{
                backgroundColor: theme.colors.badgeBg,
                borderRadius: theme.borderRadius ? 10 : 0,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '700' }}>
                Bra & Panties Only
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedSlots(['bra', 'panties', 'hosiery'])}
              style={{
                backgroundColor: theme.colors.badgeBg,
                borderRadius: theme.borderRadius ? 10 : 0,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '700' }}>
                Secret Underneath
              </Text>
            </Pressable>
          </View>

          <Label className="mb-2">INCLUDE CATEGORIES</Label>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {ALL_BUILDER_SLOTS.map((item) => {
              const isSelected = selectedSlots.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => toggleSlot(item.key)}
                  style={{
                    borderRadius: theme.borderRadius ? 14 : 0,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                    backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.inputBg,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                      fontSize: 12,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Label className="mb-2">SELECTION MODE</Label>
          <View className="flex-row gap-2 mb-4">
            {[
              { id: 'random' as const, label: 'Random (CSPRNG)' },
              { id: 'ai' as const, label: 'AI Styled (/style)' },
            ].map((m) => {
              const isSelected = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMode(m.id)}
                  style={{
                    flex: 1,
                    borderRadius: theme.borderRadius ? 10 : 0,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                    backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.inputBg,
                    paddingVertical: 9,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 12,
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional mood or occasion (e.g. candlelit dinner)..."
            placeholderTextColor={theme.colors.inputPlaceholder}
            style={{
              backgroundColor: theme.colors.inputBg,
              borderColor: theme.colors.inputBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 10 : 0,
              color: theme.colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 13,
              marginBottom: 14,
            }}
          />

          <Button
            variant="primary"
            disabled={selectedSlots.length === 0}
            onPress={() => {
              onSubmit(selectedSlots, mode, note);
              setNote('');
              onClose();
            }}
          >
            Generate Outfit
          </Button>
        </View>
      </View>
    </Modal>
  );
};
